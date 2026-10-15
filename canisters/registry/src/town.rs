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
    pub agent: bool,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TownChannel {
    pub name: String,
    pub online: u32,
    pub messages_24h: u32,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Town {
    /// when the houses were counted; 0 while the town is still waking up
    pub at: u64,
    pub houses: Vec<TownHouse>,
    /// people who own a notebook (not agents)
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
    pub discoveries: u32,
    pub under_review: u32,
    pub rains_24h: u32,
    pub last_rain: Option<u64>,
    /// trips out right now that are on time, at most 6
    pub hikers: u8,
    /// which of board, market, journal, rain are switched off
    pub off: Vec<String>,
}

const DAY_NS: u64 = 24 * HOUR_NS;
const MAX_HOUSES: usize = 600;
const REFRESH_NS: u64 = 6 * HOUR_NS;

#[derive(Default)]
struct Counted {
    at: u64,
    houses: Vec<TownHouse>,
    people: u32,
    homes: u32,
    quiet: u32,
}
/// Clears the busy flag however a refresh ends (even if a call's callback traps).
struct Busy;
impl Drop for Busy {
    fn drop(&mut self) {
        TOWN_BUSY.set(false);
    }
}
thread_local! {
    static TOWN: RefCell<Counted> = RefCell::new(Counted::default());
    static TOWN_BUSY: Cell<bool> = const { Cell::new(false) };
}

/// A house from what one person owns: how many notebooks, how many notes in them, when one was
/// last edited. None when every notebook has been quiet for 30 days.
pub fn house_of(notebooks: u64, notes: u64, newest: Option<u64>, now: u64) -> Option<(u8, u8, u8)> {
    let age = now.saturating_sub(newest?);
    if age > journal::ACTIVE_NS {
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
    let usage = journal::usage_all(&nbs).await;
    // owner -> (lowest token id, notebooks, notes, newest edit)
    let mut by: std::collections::BTreeMap<Principal, (u64, u64, u64, Option<u64>)> = Default::default();
    for (n, u) in nbs.iter().zip(usage.iter()) {
        // notebooks from before tokens only have an address once tokenize_all has run
        let Some(id) = ID_OF.with_borrow(|m| m.get(&n.canister)) else { continue };
        let e = by.entry(n.owner).or_insert((u64::MAX, 0, 0, None));
        e.0 = e.0.min(id);
        e.1 += 1;
        // an unreachable notebook (frozen, out of cycles) counts as quiet
        if let Some(u) = u {
            e.2 += u.notes;
            e.3 = e.3.max(u.last_modified);
        }
    }
    let mut people = 0;
    let mut houses: Vec<TownHouse> = Vec::new();
    for (owner, (id, count, notes, newest)) in by {
        let agent = is_agent(&owner);
        people += !agent as u32;
        if let Some((storeys, size, lit)) = house_of(count, notes, newest, now) {
            houses.push(TownHouse { lot: (id - 1) as u32, storeys, size, lit, agent });
        }
    }
    let homes = houses.iter().filter(|h| !h.agent).count() as u32;
    let quiet = people.saturating_sub(homes);
    // the most lit first when there are too many to draw, then in street order
    houses.sort_by_key(|h| (std::cmp::Reverse(h.lit), h.lot));
    houses.truncate(MAX_HOUSES);
    houses.sort_by_key(|h| h.lot);
    TOWN.with_borrow_mut(|t| *t = Counted { at: now, houses, people, homes, quiet });
}
/// From the hourly timer: count again when the houses are 6 hours old.
pub async fn town_tick() {
    if time().saturating_sub(TOWN.with_borrow(|t| t.at)) >= REFRESH_NS {
        refresh_town().await;
    }
}

/// The town right now: the houses (counted every few hours) and the public spaces (live).
#[query]
fn town() -> Result<Town, String> {
    require_flag("town")?;
    let now = time();
    let me = msg_caller();
    let since = now.saturating_sub(DAY_NS);
    let mine = (me != Principal::anonymous()).then(|| NOTEBOOKS.with_borrow(|m| m.iter().filter(|e| e.value().0.owner == me).filter_map(|e| ID_OF.with_borrow(|i| i.get(e.key()))).min())).flatten().map(|id| (id - 1) as u32);
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
    let (discoveries, under_review) = if on("journal") { journal::journal_counts() } else { (0, 0) };
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
    let off = ["board", "market", "journal", "rain"].iter().filter(|f| !on(f)).map(|f| f.to_string()).collect();
    Ok(TOWN.with_borrow(|t| Town { at: t.at, homes: t.homes, houses: t.houses.clone(), people: t.people, quiet: t.quiet, mine, my_channel, channels, post_topics, posts_live, posts_24h, listings, discoveries, under_review, rains_24h, last_rain, hikers, off }))
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
