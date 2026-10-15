// ---------------------------------------------------------------- sponsored landmarks
//
// Projects on the Internet Computer pay ICP by the month for a building in the town's Sponsors
// district. Anyone signed in may propose one; an admin approves it (the town links out to it, so
// nothing goes up unseen); then the sponsor pays for the months they want. The ICP joins the
// registry's own, swept into cycles like a notebook's price.

use super::*;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Sponsor {
    pub id: u64,
    pub by: Principal,
    pub name: String,
    pub blurb: String,
    pub url: String,
    /// a hex colour for the building's banner
    pub color: String,
    pub created_at: u64,
    pub approved: bool,
    /// paid through this time (ns); 0 while unpaid
    pub paid_until: u64,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct SponsorInput {
    pub name: String,
    pub blurb: String,
    pub url: String,
    pub color: String,
}
/// What anyone may see of a sponsor (no principal).
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct SponsorView {
    pub id: u64,
    pub name: String,
    pub blurb: String,
    pub url: String,
    pub color: String,
    pub approved: bool,
    pub paid_until: u64,
    pub mine: bool,
}
impl Sponsor {
    fn view(&self, me: Principal) -> SponsorView {
        SponsorView { id: self.id, name: self.name.clone(), blurb: self.blurb.clone(), url: self.url.clone(), color: self.color.clone(), approved: self.approved, paid_until: self.paid_until, mine: self.by == me }
    }
}
const MONTH_NS: u64 = 30 * 24 * HOUR_NS;
const DEFAULT_PRICE_E8S: u64 = 500_000_000; // 5 ICP a month
const MAX_PENDING: usize = 3;

thread_local! {
    static SPONSORS: RefCell<StableBTreeMap<u64, C<Sponsor>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(41)))));
    static NEXT_SPONSOR: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(42))), 1));
    static SPONSOR_PRICE: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(43))), DEFAULT_PRICE_E8S));
}

fn check_input(i: &SponsorInput) -> Result<SponsorInput, String> {
    let name = i.name.trim().to_string();
    let blurb = i.blurb.trim().to_string();
    let url = i.url.trim().to_string();
    let color = i.color.trim().to_lowercase();
    if name.chars().count() < 2 || name.chars().count() > 40 { return Err("name: 2-40 characters".into()); }
    if blurb.chars().count() > 160 { return Err("blurb: 160 characters at most".into()); }
    if !url.starts_with("https://") || url.len() < 12 || url.len() > 200 || url.contains(char::is_whitespace) || !url[8..].contains('.') || url[8..].starts_with('.') { return Err("the link must be a real https:// address".into()); }
    if color.len() != 7 || !color.starts_with('#') || !color[1..].chars().all(|c| c.is_ascii_hexdigit()) { return Err("colour: a hex colour like #29abe2".into()); }
    if let Some(w) = foul(&name).or_else(|| foul(&blurb)) { return Err(format!("mind your language ({w})")); }
    Ok(SponsorInput { name, blurb, url, color })
}
/// Propose a building (signed in). It shows once an admin approves it and you have paid.
#[update]
fn sponsor(input: SponsorInput) -> Result<SponsorView, String> {
    require_flag("sponsors")?;
    let me = msg_caller();
    if me == Principal::anonymous() { return Err("sign in first".into()); }
    let i = check_input(&input)?;
    let pending = SPONSORS.with_borrow(|s| s.iter().filter(|e| { let x = e.value().0; x.by == me && !x.approved }).count());
    if pending >= MAX_PENDING { return Err(format!("{MAX_PENDING} proposals are waiting for review already")); }
    let id = NEXT_SPONSOR.with_borrow(|n| *n.get());
    NEXT_SPONSOR.with_borrow_mut(|n| n.set(id + 1));
    let sp = Sponsor { id, by: me, name: i.name, blurb: i.blurb, url: i.url, color: i.color, created_at: time(), approved: false, paid_until: 0 };
    SPONSORS.with_borrow_mut(|s| s.insert(id, C(sp.clone())));
    Ok(sp.view(me))
}
/// Admin: approve a proposal, or turn it down (which removes it).
#[update]
fn review_sponsor(id: u64, approved: bool) -> Result<(), String> {
    if !admin(&msg_caller()) { return Err("admin only".into()); }
    SPONSORS.with_borrow_mut(|s| {
        let mut sp = s.get(&id).map(|c| c.0).ok_or("unknown proposal")?;
        if approved { sp.approved = true; s.insert(id, C(sp)); } else { s.remove(&id); }
        Ok(())
    })
}
/// Pay for an approved building for `months` (1-12), pulled from your allowance for the registry.
/// Paying again extends the time.
#[update]
async fn pay_sponsor(id: u64, months: u8) -> Result<SponsorView, String> {
    require_flag("sponsors")?;
    let me = msg_caller();
    let sp = SPONSORS.with_borrow(|s| s.get(&id).map(|c| c.0)).ok_or("unknown proposal")?;
    if sp.by != me { return Err("not your proposal".into()); }
    if !sp.approved { return Err("not approved yet".into()); }
    if !(1..=12).contains(&months) { return Err("pay for 1 to 12 months".into()); }
    let price = SPONSOR_PRICE.with_borrow(|p| *p.get());
    charge(me, price * months as u64).await?;
    let now = time();
    // paid: if an admin turned it down while the ledger answered, the payment still counts and it comes back
    let mut sp = SPONSORS.with_borrow(|s| s.get(&id).map(|c| c.0)).unwrap_or(sp);
    sp.paid_until = sp.paid_until.max(now) + months as u64 * MONTH_NS;
    SPONSORS.with_borrow_mut(|s| s.insert(id, C(sp.clone())));
    Ok(sp.view(me))
}
/// Admin: what a month costs, in e8s.
#[update]
fn set_sponsor_price(e8s: u64) -> Result<(), String> {
    if !admin(&msg_caller()) { return Err("admin only".into()); }
    SPONSOR_PRICE.with_borrow_mut(|p| p.set(e8s));
    Ok(())
}
#[query]
fn sponsor_price() -> u64 {
    SPONSOR_PRICE.with_borrow(|p| *p.get())
}
pub fn live_sponsors(now: u64) -> Vec<Sponsor> {
    SPONSORS.with_borrow(|s| s.iter().map(|e| e.value().0).filter(|x| x.approved && x.paid_until > now).collect())
}
/// The buildings in the Sponsors district: approved and paid for.
#[query]
fn sponsors() -> Vec<SponsorView> {
    let me = msg_caller();
    live_sponsors(time()).into_iter().map(|x| x.view(me)).collect()
}
/// Your own proposals, pending, approved or paid.
#[query]
fn my_sponsors() -> Vec<SponsorView> {
    let me = msg_caller();
    SPONSORS.with_borrow(|s| s.iter().map(|e| e.value().0).filter(|x| x.by == me).map(|x| x.view(me)).collect())
}
/// Admin: proposals waiting for review.
#[query]
fn pending_sponsors() -> Result<Vec<SponsorView>, String> {
    let me = msg_caller();
    if !admin(&me) { return Err("admin only".into()); }
    Ok(SPONSORS.with_borrow(|s| s.iter().map(|e| e.value().0).filter(|x| !x.approved).map(|x| x.view(me)).collect()))
}
