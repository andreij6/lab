// ---------------------------------------------------------------- the town
//
// Lab's activity as a small town: a house for each person with a notebook edited in the last 30
// days, community buildings for the public spaces. Only counts and small buckets leave the canister:
// no names, principals, handles or canister ids. A house's lot is its owner's lowest token id - 1,
// which is already public through ICRC-7, so the town shows nothing that ICRC-7 and each notebook's
// usage() don't already show; it is not anonymous, and a lot can be traced to its owner.

use super::*;
use std::cell::Cell;

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
pub struct TownHouse {
    pub lot: u32,
    /// notebooks owned, 1-3
    pub storeys: u8,
    /// notes in them: 0 under 10, 1 under 50, 2 under 200, 3 more
    pub size: u8,
    /// last edited: 0 within 30 days, 1 within 7, 2 within 24 hours
    pub lit: u8,
    /// one of the notebooks has under 30 days of cycles left
    pub low: bool,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TownChannel {
    pub name: String,
    pub online: u32,
    pub messages_24h: u32,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Town {
    /// when the houses were counted; 0 while the town is still waking up. The houses themselves come
    /// from town_houses(), which only changes when this does.
    pub at: u64,
    /// people who own a notebook
    pub people: u32,
    pub homes: u32,
    /// owners whose notebooks have all been quiet for 30 days
    pub quiet: u32,
    /// your lot (signed in, owning a notebook); no house there means your notebooks are quiet
    pub mine: Option<u32>,
    pub my_channel: Option<String>,
    pub channels: Vec<TownChannel>,
    /// the topics of the newest live posts
    pub post_topics: Vec<String>,
    pub posts_live: u32,
    pub posts_24h: u32,
    pub listings: u32,
    pub rains_24h: u32,
    pub last_rain: Option<u64>,
    /// trips out right now that are on time, at most 6
    pub hikers: u8,
    /// lots with a notebook made in the last 3 days: building sites (or a new storey going up)
    pub building: Vec<u32>,
    pub notebooks: u32,
    /// notebooks the registry made in the last day and week (the factory)
    pub spawned_24h: u32,
    pub spawned_7d: u32,
    /// people who joined the community in the last week (the school)
    pub newcomers_7d: u32,
    /// cycles every notebook holds, and what they burn a day between them (the water tower)
    pub cycles: Nat,
    pub burn_per_day: Nat,
    /// people who signed in within 30 days and have no notebook yet: tents in the campground
    pub campers: u32,
    /// you are one of them
    pub me_camping: bool,
    /// fundraisers in chat that are still open, and what they raised (the chapel)
    pub fundraisers_open: u32,
    pub raised_e8s: u64,
    /// which of board, market, rain, fundraisers are switched off
    pub off: Vec<String>,
}

const DAY_NS: u64 = 24 * HOUR_NS;
const MAX_HOUSES: usize = 20_000;
const REFRESH_NS: u64 = 6 * HOUR_NS;
const LOW_DAYS: u128 = 30;
const BUILDING_NS: u64 = 3 * DAY_NS;

#[derive(Default)]
struct Counted {
    at: u64,
    houses: Vec<TownHouse>,
    people: u32,
    homes: u32,
    quiet: u32,
    cycles: u128,
    burn: u128,
    fundraisers_open: u32,
    raised_e8s: u64,
}
/// Clears the busy flag however a refresh ends (even if a call's callback traps).
struct Busy;
impl Drop for Busy {
    fn drop(&mut self) {
        TOWN_BUSY.set(false);
    }
}
/// What the notebooks list says, counted every five minutes so a look at the town stays cheap however
/// many notebooks there are.
#[derive(Default)]
struct Quick {
    building: Vec<u32>,
    notebooks: u32,
    spawned_24h: u32,
    spawned_7d: u32,
    newcomers_7d: u32,
    campers: u32,
    /// owner -> their lot (their lowest token id - 1)
    lots: std::collections::HashMap<Principal, u32>,
    owners: std::collections::HashSet<Principal>,
}
thread_local! {
    static QUICK: RefCell<Quick> = RefCell::new(Quick::default());
    /// principal -> when they last signed in (counted once an hour at most)
    static VISITORS: RefCell<StableBTreeMap<Principal, u64, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(39)))));
    static TOWN: RefCell<Counted> = RefCell::new(Counted::default());
    static TOWN_BUSY: Cell<bool> = const { Cell::new(false) };
}

/// A house from what one person owns: how many notebooks, how many notes in them, when one was
/// last edited. None when every notebook has been quiet for 30 days.
pub fn house_of(notebooks: u64, notes: u64, newest: Option<u64>, now: u64) -> Option<(u8, u8, u8)> {
    let age = now.saturating_sub(newest?);
    if age > stats::ACTIVE_NS {
        return None;
    }
    let lit = if age <= DAY_NS { 2 } else if age <= 7 * DAY_NS { 1 } else { 0 };
    let size = match notes { 0..=9 => 0, 10..=49 => 1, 50..=199 => 2, _ => 3 };
    Some((notebooks.clamp(1, 3) as u8, size, lit))
}

/// Count the houses again: ask every notebook when it was last edited. Runs every 6 hours, 10
/// seconds after an upgrade, and when the town is switched on.
pub async fn refresh_town() {
    if !flag_on("town") || TOWN_BUSY.get() {
        return;
    }
    TOWN_BUSY.set(true);
    let _busy = Busy;
    let now = time();
    let nbs: Vec<Notebook> = NOTEBOOKS.with_borrow(|m| m.iter().map(|e| e.value().0).collect());
    let usage = stats::usage_all(&nbs).await;
    let status = status_all(&nbs).await;
    let (mut cycles, mut burn) = (0u128, 0u128);
    // owner -> (lowest token id, notebooks, notes, newest edit, low on cycles)
    let mut by: std::collections::BTreeMap<Principal, (u64, u64, u64, Option<u64>, bool)> = Default::default();
    for ((n, u), st) in nbs.iter().zip(usage.iter()).zip(status.iter()) {
        if let Some((c, b)) = st {
            cycles += c;
            burn += b;
        }
        // notebooks from before tokens only have an address once tokenize_all has run
        let Some(id) = ID_OF.with_borrow(|m| m.get(&n.canister)) else { continue };
        let e = by.entry(n.owner).or_insert((u64::MAX, 0, 0, None, false));
        e.0 = e.0.min(id);
        e.1 += 1;
        e.4 |= st.is_some_and(|(c, b)| b > 0 && c / b < LOW_DAYS);
        // an unreachable notebook (frozen, out of cycles) counts as quiet
        if let Some(u) = u {
            e.2 += u.notes;
            e.3 = e.3.max(u.last_modified);
        }
    }
    let mut people: u32 = 0;
    let mut houses: Vec<TownHouse> = Vec::new();
    for (_, (id, count, notes, newest, low)) in by {
        people += 1;
        if let Some((storeys, size, lit)) = house_of(count, notes, newest, now) {
            houses.push(TownHouse { lot: (id - 1) as u32, storeys, size, lit, low });
        }
    }
    // the chapel: fundraisers still open, and what fundraisers raised (messages go after 90 days)
    let (mut fundraisers_open, mut raised_e8s) = (0, 0);
    if flag_on("fundraisers") {
        // ponytail: scans every message every 6 hours; keep running totals if chat grows large
        MESSAGES.with_borrow(|m| {
            for e in m.iter() {
                if let Some(f) = e.value().0.fund {
                    fundraisers_open += !f.closed as u32;
                    raised_e8s += f.raised_e8s;
                }
            }
        });
    }
    let homes = houses.len() as u32;
    let quiet = people.saturating_sub(homes);
    // the most lit first when there are too many to draw, then in street order
    houses.sort_by_key(|h| (std::cmp::Reverse(h.lit), h.lot));
    houses.truncate(MAX_HOUSES);
    houses.sort_by_key(|h| h.lot);
    TOWN.with_borrow_mut(|t| *t = Counted { at: now, houses, people, homes, quiet, cycles, burn, fundraisers_open, raised_e8s });
}
/// Every notebook's cycles and what it burns a day while idle (the registry controls them all).
async fn status_all(nbs: &[Notebook]) -> Vec<Option<(u128, u128)>> {
    let mut out = Vec::new();
    for chunk in nbs.chunks(100) {
        let calls = chunk.iter().map(|n| async move {
            let st = mgmt::canister_status(&mgmt::CanisterStatusArgs { canister_id: n.canister }).await.ok()?;
            Some((st.cycles.0.try_into().unwrap_or(u128::MAX), st.idle_cycles_burned_per_day.0.try_into().unwrap_or(0)))
        });
        out.extend(stats::join_all(calls.collect()).await);
    }
    out
}
/// Count what the notebooks list says: building sites, the factory's output, everyone's lot, campers.
pub fn town_quick() {
    let now = time();
    let (day, week, soon) = (now.saturating_sub(DAY_NS), now.saturating_sub(7 * DAY_NS), now.saturating_sub(BUILDING_NS));
    let mut q = Quick::default();
    let mut new_owners = std::collections::BTreeSet::new();
    NOTEBOOKS.with_borrow(|m| {
        for e in m.iter() {
            let n = e.value().0;
            q.notebooks += 1;
            q.owners.insert(n.owner);
            q.spawned_24h += (n.created_at >= day) as u32;
            q.spawned_7d += (n.created_at >= week) as u32;
            if n.created_at >= soon {
                new_owners.insert(n.owner);
            }
            if let Some(id) = ID_OF.with_borrow(|i| i.get(e.key())) {
                let l = q.lots.entry(n.owner).or_insert((id - 1) as u32);
                *l = (*l).min((id - 1) as u32);
            }
        }
    });
    q.building = new_owners.iter().filter_map(|o| q.lots.get(o).copied()).take(60).collect();
    let month = now.saturating_sub(stats::ACTIVE_NS);
    q.campers = VISITORS.with_borrow(|v| v.iter().filter(|e| e.value() >= month && !q.owners.contains(e.key())).count()) as u32;
    q.newcomers_7d = MEMBERS.with_borrow(|m| m.iter().filter(|e| e.value().0.joined_at >= week).count()) as u32;
    QUICK.with_borrow_mut(|x| *x = q);
}
/// Every house in town, by lot (they change when Town.at does).
#[query]
fn town_houses() -> Result<Vec<TownHouse>, String> {
    require_flag("town")?;
    Ok(TOWN.with_borrow(|t| t.houses.clone()))
}
/// From the hourly timer: count again when the houses are 6 hours old.
pub async fn town_tick() {
    if time().saturating_sub(TOWN.with_borrow(|t| t.at)) >= REFRESH_NS {
        refresh_town().await;
    }
}

// ponytail: anyone can make identities for free, so new visitors stop being recorded at this many;
// prune by last visit if a real crowd ever gets near it
const MAX_VISITORS: u64 = 100_000;
/// The app says hello when someone signs in, so the town can count people without a notebook yet.
#[update]
fn visit() {
    let me = msg_caller();
    if me == Principal::anonymous() {
        return;
    }
    let now = time();
    VISITORS.with_borrow_mut(|v| match v.get(&me) {
        Some(at) if now.saturating_sub(at) < HOUR_NS => {}
        Some(_) => { v.insert(me, now); }
        None if v.len() < MAX_VISITORS => { v.insert(me, now); }
        None => {}
    });
}

/// The town right now: the houses (counted every few hours) and the public spaces (live).
#[query]
fn town() -> Result<Town, String> {
    require_flag("town")?;
    let now = time();
    let me = msg_caller();
    let since = now.saturating_sub(DAY_NS);
    // who is in which channel now
    let mut online: std::collections::HashMap<String, u32> = Default::default();
    let mut my_channel = None;
    CHAT_PRESENCE.with_borrow(|p| {
        for e in p.iter() {
            let (ch, at) = e.value().0;
            if now.saturating_sub(at) < CHAT_PRESENCE_NS {
                if *e.key() == me {
                    my_channel = Some(ch.clone());
                }
                *online.entry(ch).or_default() += 1;
            }
        }
    });
    let mut chans: Vec<Channel> = CHANNELS.with_borrow(|c| c.iter().map(|e| e.value().0).collect());
    chans.sort_by(|a, b| (a.section.as_deref().unwrap_or("~"), &a.name).cmp(&(b.section.as_deref().unwrap_or("~"), &b.name)));
    let channels = chans.into_iter().take(16).map(|c| {
        // keys are "channel#id" with ids rising, so the newest are at the end of the channel's range
        let messages_24h = MESSAGES.with_borrow(|m| m.range(format!("{}#", c.name)..format!("{}$", c.name)).rev().map(|e| e.value().0).take_while(|x| x.at >= since).take(999).filter(|x| !x.deleted).count() as u32);
        TownChannel { online: online.get(&c.name).copied().unwrap_or(0), messages_24h, name: c.name }
    }).collect();
    let on = |f: &str| flag_on(f);
    let (mut post_topics, mut posts_live, mut posts_24h) = (Vec::new(), 0, 0);
    if on("board") {
        POSTS.with_borrow(|p| {
            for e in p.iter().rev() {
                let post = e.value().0;
                posts_live += 1;
                posts_24h += (post.created_at >= since) as u32;
                if post_topics.len() < 12 {
                    post_topics.push(post.topic);
                }
            }
        });
    }
    let listings = if on("market") { LISTINGS.with_borrow(|l| l.len()) as u32 } else { 0 };
    let (mut rains_24h, mut last_rain) = (0, None);
    if on("rain") {
        RAINS.with_borrow(|r| {
            for e in r.iter().rev() {
                let at = e.value().0.at;
                last_rain = last_rain.or(Some(at));
                if at < since {
                    break;
                }
                rains_24h += 1;
            }
        });
    }
    // ponytail: scans every check-in; keep a running count if there are ever thousands
    let hikers = WATCHES.with_borrow(|w| w.iter().filter(|e| { let w = e.value().0; !w.closed && !watch_overdue(&w, now) }).count()).min(6) as u8;
    let off = ["board", "market", "rain", "fundraisers"].iter().filter(|f| !on(f)).map(|f| f.to_string()).collect();
    let me_visited = me != Principal::anonymous() && VISITORS.with_borrow(|v| v.contains_key(&me));
    Ok(QUICK.with_borrow(|q| TOWN.with_borrow(|t| Town { at: t.at, homes: t.homes, people: t.people, quiet: t.quiet, mine: q.lots.get(&me).copied(), my_channel, channels, post_topics, posts_live, posts_24h, listings, rains_24h, last_rain, hikers, off, building: q.building.clone(), notebooks: q.notebooks, spawned_24h: q.spawned_24h, spawned_7d: q.spawned_7d, newcomers_7d: q.newcomers_7d, cycles: Nat::from(t.cycles), burn_per_day: Nat::from(t.burn), campers: q.campers, me_camping: me_visited && !q.owners.contains(&me), fundraisers_open: t.fundraisers_open, raised_e8s: t.raised_e8s })))
}

#[cfg(test)]
mod tests {
    use super::*;
    const D: u64 = DAY_NS;
    #[test]
    fn houses_from_buckets() {
        let now = 100 * D;
        assert_eq!(house_of(1, 0, None, now), None);
        assert_eq!(house_of(1, 5, Some(now - 31 * D), now), None);
        assert_eq!(house_of(1, 9, Some(now - 30 * D), now), Some((1, 0, 0)));
        assert_eq!(house_of(2, 10, Some(now - 8 * D), now), Some((2, 1, 0)));
        assert_eq!(house_of(5, 49, Some(now - 7 * D), now), Some((3, 1, 1)));
        assert_eq!(house_of(1, 50, Some(now - 25 * HOUR_NS), now), Some((1, 2, 1)));
        assert_eq!(house_of(1, 199, Some(now - HOUR_NS), now), Some((1, 2, 2)));
        assert_eq!(house_of(1, 200, Some(now), now), Some((1, 3, 2)));
    }
}
