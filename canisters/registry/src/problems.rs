// ---------------------------------------------------------------- problems: solving things together
//
// A problem is a note (`type: problem`) in someone's notebook, published here so people and their
// agents can find it by field, check its claims, fork it and send attempts back, put a bounty on it
// and, when the owner calls it solved, credit everyone as a numbered discovery. Nothing here runs
// Lean: a check is an attestation by someone who is not the owner, stamped with the hash of the
// note it looked at; a claim counts as checked while every current check passes and the note has
// not changed since. Lighter than the journal this replaces: no editors, no reviewers, no vouching.
//
// Actors: `p:<principal>` (a person, or an agent with its own identity) and `a:<notebook>/<key name>`
// (an agent on a notebook's HTTP API: the notebook canister calls here for it, and the registry
// trusts its own notebooks). The actor is always built from the caller, never from an argument.

use super::*;

/// The fields a problem may be filed under, and the topic of each field's chat channel.
pub const FIELDS: &[(&str, &str)] = &[
    ("mathematics", "Open problems, claims and proofs in mathematics"),
    ("physics", "Models, derivations and experiments in physics"),
    ("computer-science", "Algorithms, complexity, verification and systems"),
    ("biology", "Questions in biology and the life sciences"),
    ("chemistry", "Questions in chemistry and materials"),
    ("engineering", "Things to build: designs, tolerances and tests"),
    ("economics", "Markets, mechanisms and models"),
    ("open-problems", "Any field: find collaborators and agents for a problem"),
];
const MAX_TITLE: usize = 120;
const MAX_STATEMENT: usize = 2000;
const MAX_TEXT: usize = 2000;
const MAX_DETAIL: usize = 500;
const MAX_DEPENDS: usize = 10;
const MAX_CREDITS: usize = 10;
const MIN_BOUNTY_E8S: u64 = 10_000_000; // 0.1 ICP
const MAX_BOUNTY_E8S: u64 = 100_000_000_000; // 1000 ICP
const MAX_EVENTS: usize = 100;

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum ProblemStatus { Open, Partial, Solved }
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum AttemptStatus { Open, Merged, Declined }
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum EventKind { Published, Comment, Check, Attempt, Merged, Declined, Bounty, Status, Solved }

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Problem {
    pub id: u64,
    pub notebook: Principal,
    pub path: String,
    pub title: String,
    pub field: String,
    pub statement: String,
    pub status: ProblemStatus,
    pub owner: Principal,
    pub created: u64,
    pub updated: u64,
    pub claims: u32,
    /// links to lemma notes this one builds on ("canister/path" or a note title in the same notebook)
    pub depends: Vec<String>,
    /// sha256 of the note when it was last published; checks carry the hash they looked at
    pub note_hash: String,
    pub bounty_e8s: u64,
    pub discovery: Option<u64>,
    pub credits: Vec<String>,
    /// (actor, e8s) still owed from the bounty; paid out as ICP minted into the actor's notebook
    pub payouts: Vec<(String, u64)>,
    pub solved_at: Option<u64>,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Check { pub pass: bool, pub detail: String, pub note_hash: String, pub at: u64 }
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Attempt { pub id: u64, pub problem: u64, pub notebook: Principal, pub path: String, pub by: String, pub title: String, pub status: AttemptStatus, pub at: u64 }
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Event { pub seq: u64, pub kind: EventKind, pub by: String, pub claim: Option<u32>, pub text: String, pub at: u64 }

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PublishInput {
    pub notebook: Principal,
    pub path: String,
    pub title: String,
    pub field: String,
    pub statement: String,
    pub status: ProblemStatus,
    pub claims: u32,
    pub depends: Vec<String>,
    pub note_hash: String,
}
/// A problem on the board (no principals).
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ProblemCard {
    pub id: u64,
    pub title: String,
    pub field: String,
    pub status: ProblemStatus,
    pub claims: u32,
    pub checked: u32,
    pub attempts: u32,
    pub bounty_e8s: u64,
    pub updated: u64,
    pub discovery: Option<u64>,
    pub mine: bool,
    pub following: bool,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ClaimView { pub n: u32, pub checked: bool, pub passes: u32, pub fails: u32, pub stale: u32 }
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct AttemptView { pub id: u64, pub notebook: Principal, pub path: String, pub by: String, pub by_name: String, pub title: String, pub status: AttemptStatus, pub at: u64 }
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EventView { pub seq: u64, pub kind: EventKind, pub by: String, pub by_name: String, pub claim: Option<u32>, pub text: String, pub at: u64 }
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ProblemView {
    pub card: ProblemCard,
    pub notebook: Principal,
    pub path: String,
    pub statement: String,
    pub depends: Vec<String>,
    pub note_hash: String,
    pub owner_name: String,
    pub created: u64,
    pub claim_views: Vec<ClaimView>,
    pub attempt_views: Vec<AttemptView>,
    pub events: Vec<EventView>,
    pub followers: u32,
    pub credits: Vec<(String, String)>,
    pub payouts_pending: u32,
    pub solved_at: Option<u64>,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DiscoveryView { pub n: u64, pub problem: u64, pub title: String, pub field: String, pub credits: Vec<(String, String)>, pub note_hash: String, pub at: u64 }
/// What an actor has done across every problem, derived when asked.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TrackRecord { pub actor: String, pub name: String, pub agent: bool, pub checks: u32, pub attempts: u32, pub merged: u32, pub solved: u32, pub problems: u32, pub since: u64 }

thread_local! {
    static PROBLEMS: RefCell<StableBTreeMap<u64, C<Problem>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(45)))));
    /// "{problem:010}#{claim:03}#{actor}" -> the actor's latest check of that claim
    static CHECKS: RefCell<StableBTreeMap<String, C<Check>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(46)))));
    static ATTEMPTS: RefCell<StableBTreeMap<u64, C<Attempt>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(47)))));
    /// "{problem:010}#{seq:010}" -> what happened: the thread, the history, what agents poll
    static EVENTS: RefCell<StableBTreeMap<String, C<Event>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(48)))));
    /// "{problem:010}#{actor}" -> when they started following
    static FOLLOWS: RefCell<StableBTreeMap<String, u64, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(49)))));
    static NEXT_PROBLEM: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(50))), 1));
    static NEXT_ATTEMPT: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(51))), 1));
    static NEXT_DISCOVERY: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(52))), 1));
    /// ICP on the registry's account that belongs to open bounties and payouts not yet made: `sweep_fees` leaves it alone
    static BOUNTY_HELD: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(53))), 0));
}

/// ICP held for bounties, in e8s (`sweep_fees` keeps it on the account).
pub fn bounty_held() -> u64 {
    BOUNTY_HELD.with_borrow(|c| *c.get())
}
fn held_add(e8s: i128) {
    BOUNTY_HELD.with_borrow_mut(|c| { let v = (*c.get() as i128 + e8s).max(0) as u64; c.set(v); });
}
/// (open problems, discoveries) for the town.
pub fn counts() -> (u32, u32) {
    PROBLEMS.with_borrow(|m| m.iter().fold((0, 0), |(o, d), e| { let p = e.value().0; (o + (p.status != ProblemStatus::Solved) as u32, d + p.discovery.is_some() as u32) }))
}

// ---- actors

/// The caller as an actor, with the principal that owns what it does: a person is their own; a
/// notebook canister acts for one of its agent keys and is owned by the notebook's owner.
fn actor(agent: Option<String>) -> Result<(String, Principal), String> {
    let me = msg_caller();
    if me == Principal::anonymous() {
        return Err("sign in first".into());
    }
    if let Some(nb) = notebook(me) {
        let name = agent.map(|a| a.trim().to_string()).filter(|a| !a.is_empty()).ok_or("a notebook acts for a named agent key")?;
        if name.chars().count() > 64 || name.contains('/') || name.contains('#') {
            return Err("agent names are up to 64 characters without / or #".into());
        }
        return Ok((format!("a:{}/{name}", me.to_text()), nb.owner));
    }
    Ok((format!("p:{}", me.to_text()), me))
}
fn actor_owner(actor: &str) -> Option<Principal> {
    if let Some(p) = actor.strip_prefix("p:") {
        return Principal::from_text(p).ok();
    }
    let nb = actor.strip_prefix("a:")?.split('/').next()?;
    notebook(Principal::from_text(nb).ok()?).map(|n| n.owner)
}
/// Where an actor's share of a bounty goes: a person's primary notebook, an agent's own notebook.
fn payout_notebook(actor: &str) -> Option<Principal> {
    if let Some(p) = actor.strip_prefix("p:") {
        return primary_of(Principal::from_text(p).ok()?).map(|n| n.canister);
    }
    let nb = Principal::from_text(actor.strip_prefix("a:")?.split('/').next()?).ok()?;
    notebook(nb).map(|_| nb)
}
fn short(p: &str) -> String {
    p.split('-').next().unwrap_or(p).to_string()
}
/// How an actor is shown: a member's handle (or the start of their principal); `name @ notebook`.
pub fn display(actor: &str) -> String {
    if let Some(p) = actor.strip_prefix("p:") {
        return Principal::from_text(p).ok().and_then(|pr| MEMBERS.with_borrow(|m| m.get(&pr).map(|c| format!("@{}", c.0.handle)))).unwrap_or_else(|| short(p));
    }
    match actor.strip_prefix("a:").and_then(|r| r.split_once('/')) {
        Some((nb, name)) => format!("{name} @ {}", Principal::from_text(nb).ok().and_then(notebook).map(|n| n.name).unwrap_or_else(|| short(nb))),
        None => actor.to_string(),
    }
}
fn valid_actor(a: &str) -> bool {
    actor_owner(a).is_some() && (a.starts_with("p:") || a.split_once('/').map_or(false, |(_, n)| !n.is_empty() && n.chars().count() <= 64 && !n.contains('#')))
}
fn dedup(credits: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::BTreeSet::new();
    credits.into_iter().map(|c| c.trim().to_string()).filter(|c| !c.is_empty() && seen.insert(c.clone())).collect()
}
/// Decide who gets what of a bounty: equal shares to `targets`, the rounding staying with Lab (left
/// in BOUNTY_HELD's debit); with no target the whole bounty is Lab's.
fn split(p: &mut Problem, targets: &[(String, Principal)]) {
    if p.bounty_e8s > 0 && !targets.is_empty() {
        let share = p.bounty_e8s / targets.len() as u64;
        p.payouts = targets.iter().map(|(a, _)| (a.clone(), share)).collect();
        held_add(-(p.bounty_e8s as i128 - share as i128 * targets.len() as i128));
    } else {
        held_add(-(p.bounty_e8s as i128));
    }
}

// ---- text rules: foul words and links out are refused; `<` and `>` are fine, this is maths

fn text_ok(s: &str, max: usize, what: &str) -> Result<String, String> {
    let s = s.trim().to_string();
    if s.is_empty() || s.chars().count() > max {
        return Err(format!("{what}: 1-{max} characters"));
    }
    let t = s.to_lowercase();
    if ["http://", "https://", "www.", "](", "![", "<img", "data:"].iter().any(|p| t.contains(p)) {
        return Err("links and images are not allowed here; name the note instead".into());
    }
    if let Some(w) = foul(&s) {
        return Err(format!("keep it clean: \"{w}\" is not allowed here"));
    }
    Ok(s)
}
fn hash_ok(h: &str) -> Result<String, String> {
    let h = h.trim().to_lowercase();
    if h.len() != 64 || !h.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("note_hash is the sha256 of the note, in hex".into());
    }
    Ok(h)
}

// ---- keys and lookups

fn ck(problem: u64, claim: u32, actor: &str) -> String {
    format!("{problem:010}#{claim:03}#{actor}")
}
fn ek(problem: u64, seq: u64) -> String {
    format!("{problem:010}#{seq:010}")
}
fn fk(problem: u64, actor: &str) -> String {
    format!("{problem:010}#{actor}")
}
fn get(id: u64) -> Result<Problem, String> {
    PROBLEMS.with_borrow(|m| m.get(&id).map(|c| c.0)).ok_or("unknown problem".into())
}
fn put(p: &Problem) {
    PROBLEMS.with_borrow_mut(|m| m.insert(p.id, C(p.clone())));
}
fn events_of(problem: u64) -> Vec<Event> {
    let prefix = format!("{problem:010}#");
    EVENTS.with_borrow(|m| m.range(prefix.clone()..).take_while(|e| e.key().starts_with(&prefix)).map(|e| e.value().0).collect())
}
fn log(problem: u64, kind: EventKind, by: &str, claim: Option<u32>, text: String) {
    let seq = events_of(problem).last().map_or(1, |e| e.seq + 1);
    EVENTS.with_borrow_mut(|m| m.insert(ek(problem, seq), C(Event { seq, kind, by: by.to_string(), claim, text, at: time() })));
    if let Ok(mut p) = get(problem) {
        p.updated = time();
        put(&p);
    }
}
fn checks_of(problem: u64) -> Vec<(u32, String, Check)> {
    let prefix = format!("{problem:010}#");
    CHECKS.with_borrow(|m| m.range(prefix.clone()..).take_while(|e| e.key().starts_with(&prefix)).map(|e| {
        let rest = &e.key()[prefix.len()..];
        let (n, actor) = rest.split_once('#').unwrap_or(("0", ""));
        (n.parse().unwrap_or(0), actor.to_string(), e.value().0)
    }).collect())
}
fn claim_views(p: &Problem) -> Vec<ClaimView> {
    let checks = checks_of(p.id);
    (1..=p.claims).map(|n| {
        let mine: Vec<&Check> = checks.iter().filter(|(c, _, _)| *c == n).map(|(_, _, c)| c).collect();
        let fresh = |c: &&Check| c.note_hash == p.note_hash;
        let passes = mine.iter().filter(|c| fresh(c) && c.pass).count() as u32;
        let fails = mine.iter().filter(|c| fresh(c) && !c.pass).count() as u32;
        let stale = mine.iter().filter(|c| !fresh(c)).count() as u32;
        ClaimView { n, checked: passes > 0 && fails == 0, passes, fails, stale }
    }).collect()
}
fn attempts_of(problem: u64) -> Vec<Attempt> {
    ATTEMPTS.with_borrow(|m| m.iter().map(|e| e.value().0).filter(|a| a.problem == problem).collect())
}
fn followers_of(problem: u64) -> Vec<String> {
    let prefix = format!("{problem:010}#");
    FOLLOWS.with_borrow(|m| m.range(prefix.clone()..).take_while(|e| e.key().starts_with(&prefix)).map(|e| e.key()[prefix.len()..].to_string()).collect())
}
fn card(p: &Problem, me: &str) -> ProblemCard {
    ProblemCard {
        id: p.id, title: p.title.clone(), field: p.field.clone(), status: p.status.clone(), claims: p.claims,
        checked: claim_views(p).iter().filter(|c| c.checked).count() as u32,
        attempts: attempts_of(p.id).len() as u32,
        bounty_e8s: p.bounty_e8s, updated: p.updated, discovery: p.discovery,
        mine: actor_owner(me) == Some(p.owner) && !me.is_empty(),
        following: FOLLOWS.with_borrow(|m| m.contains_key(&fk(p.id, me))),
    }
}
fn ev(e: Event) -> EventView {
    EventView { seq: e.seq, by_name: display(&e.by), kind: e.kind, by: e.by, claim: e.claim, text: e.text, at: e.at }
}
/// The caller as an actor for queries: anonymous reads get an empty actor.
fn viewer(agent: Option<String>) -> String {
    actor(agent).map(|(a, _)| a).unwrap_or_default()
}

// ---- publishing

/// Put a problem note on the board, or update it there: the owner of its notebook, after sharing the
/// note publicly so anyone can read it. Keyed by notebook and path, so saving the note again just
/// refreshes the title, statement, claims and hash. A solved problem keeps its status.
#[update]
fn publish_problem(i: PublishInput) -> Result<ProblemView, String> {
    require_flag("problems")?;
    let me = msg_caller();
    // the space itself may publish, for its agent (notebook `/v1/publish`)
    if me != i.notebook {
        owns(me, i.notebook)?;
    }
    let title = text_ok(&i.title, MAX_TITLE, "title")?;
    let statement = text_ok(&i.statement, MAX_STATEMENT, "statement")?;
    let field = i.field.trim().to_lowercase();
    if !FIELDS.iter().any(|(f, _)| *f == field) {
        return Err(format!("field must be one of: {}", FIELDS.iter().map(|(f, _)| *f).collect::<Vec<_>>().join(", ")));
    }
    if i.status == ProblemStatus::Solved {
        return Err("mark a problem solved with solve_problem, crediting who solved it".into());
    }
    if i.depends.len() > MAX_DEPENDS || i.depends.iter().any(|d| d.trim().is_empty() || d.chars().count() > 200) {
        return Err(format!("up to {MAX_DEPENDS} dependencies of up to 200 characters")).map_err(|e: String| e);
    }
    let depends: Vec<String> = i.depends.iter().map(|d| d.trim().to_string()).collect();
    let note_hash = hash_ok(&i.note_hash)?;
    let path = i.path.trim().to_string();
    if path.is_empty() || path.len() > 256 {
        return Err("path: 1-256 characters".into());
    }
    let now = time();
    let existing = PROBLEMS.with_borrow(|m| m.iter().map(|e| e.value().0).find(|p| p.notebook == i.notebook && p.path == path));
    let p = match existing {
        Some(mut p) => {
            let was = p.status.clone();
            p.owner = me; // a sold notebook's problems follow it
            p.title = title; p.statement = statement; p.field = field; p.claims = i.claims.min(200); p.depends = depends; p.note_hash = note_hash; p.updated = now;
            if p.status != ProblemStatus::Solved && p.status != i.status {
                p.status = i.status.clone();
            }
            put(&p);
            if p.status != was {
                log(p.id, EventKind::Status, &format!("p:{}", me.to_text()), None, format!("{:?}", p.status).to_lowercase());
            }
            p
        }
        None => {
            let id = NEXT_PROBLEM.with_borrow_mut(|c| { let v = *c.get(); c.set(v + 1); v });
            let p = Problem { id, notebook: i.notebook, path, title, field, statement, status: i.status, owner: me, created: now, updated: now, claims: i.claims.min(200), depends, note_hash, bounty_e8s: 0, discovery: None, credits: vec![], payouts: vec![], solved_at: None };
            put(&p);
            log(id, EventKind::Published, &format!("p:{}", me.to_text()), None, String::new());
            p
        }
    };
    Ok(view(&get(p.id)?, &format!("p:{}", me.to_text())))
}

// ---- checks, attempts, comments

/// Check one claim of a problem: pass or fail, with what you found. Not the owner, nor the owner's
/// agents: the proof is the review, and nobody reviews their own. Stamped with the note's hash now.
#[update]
fn check_claim(id: u64, claim: u32, pass: bool, detail: String, agent: Option<String>) -> Result<ClaimView, String> {
    require_flag("problems")?;
    let (me, owner) = actor(agent)?;
    let p = get(id)?;
    if owner == p.owner {
        return Err("you can't check your own claims; another person or agent has to".into());
    }
    if p.status == ProblemStatus::Solved {
        return Err("this problem is solved; its claims are closed".into());
    }
    if claim == 0 || claim > p.claims {
        return Err(format!("the problem has {} claim(s)", p.claims));
    }
    let detail = if detail.trim().is_empty() { String::new() } else { text_ok(&detail, MAX_DETAIL, "detail")? };
    CHECKS.with_borrow_mut(|m| m.insert(ck(id, claim, &me), C(Check { pass, detail: detail.clone(), note_hash: p.note_hash.clone(), at: time() })));
    log(id, EventKind::Check, &me, Some(claim), format!("{} {detail}", if pass { "pass:" } else { "fail:" }).trim().to_string());
    Ok(claim_views(&get(id)?).into_iter().find(|c| c.n == claim).ok_or("claim")?)
}

/// Send an attempt back: a note of yours (shared publicly first) that the problem's owner may merge.
#[update]
fn submit_attempt(id: u64, notebook: Principal, path: String, title: String, agent: Option<String>) -> Result<AttemptView, String> {
    require_flag("problems")?;
    let (me, _) = actor(agent)?;
    let caller = msg_caller();
    if me.starts_with("a:") { if notebook != caller { return Err("an agent sends attempts from its own notebook".into()); } } else { owns(caller, notebook)?; }
    let p = get(id)?;
    if p.status == ProblemStatus::Solved {
        return Err("this problem is solved".into());
    }
    let title = text_ok(&title, MAX_TITLE, "title")?;
    let path = path.trim().to_string();
    if path.is_empty() || path.len() > 256 {
        return Err("path: 1-256 characters".into());
    }
    if attempts_of(id).iter().any(|a| a.notebook == notebook && a.path == path && a.status == AttemptStatus::Open) {
        return Err("that note is already an open attempt here".into());
    }
    let aid = NEXT_ATTEMPT.with_borrow_mut(|c| { let v = *c.get(); c.set(v + 1); v });
    let a = Attempt { id: aid, problem: id, notebook, path, by: me.clone(), title: title.clone(), status: AttemptStatus::Open, at: time() };
    ATTEMPTS.with_borrow_mut(|m| m.insert(aid, C(a.clone())));
    log(id, EventKind::Attempt, &me, None, title);
    Ok(av(a))
}
fn av(a: Attempt) -> AttemptView {
    AttemptView { id: a.id, notebook: a.notebook, path: a.path, by_name: display(&a.by), by: a.by, title: a.title, status: a.status, at: a.at }
}
/// The owner merges an attempt (after copying it into the problem note) or declines it.
#[update]
fn merge_attempt(attempt: u64, merged: bool) -> Result<AttemptView, String> {
    require_flag("problems")?;
    let me = msg_caller();
    let mut a = ATTEMPTS.with_borrow(|m| m.get(&attempt).map(|c| c.0)).ok_or("unknown attempt")?;
    let p = get(a.problem)?;
    if p.owner != me {
        return Err("only the problem's owner merges attempts".into());
    }
    if a.status != AttemptStatus::Open {
        return Err("that attempt was already decided".into());
    }
    a.status = if merged { AttemptStatus::Merged } else { AttemptStatus::Declined };
    ATTEMPTS.with_borrow_mut(|m| m.insert(attempt, C(a.clone())));
    log(a.problem, if merged { EventKind::Merged } else { EventKind::Declined }, &format!("p:{}", me.to_text()), None, a.title.clone());
    Ok(av(a))
}
/// Say something on a problem's thread, about one claim or the whole thing.
#[update]
fn comment_problem(id: u64, text: String, claim: Option<u32>, agent: Option<String>) -> Result<EventView, String> {
    require_flag("problems")?;
    let (me, _) = actor(agent)?;
    let p = get(id)?;
    if claim.map_or(false, |c| c == 0 || c > p.claims) {
        return Err(format!("the problem has {} claim(s)", p.claims));
    }
    let text = text_ok(&text, MAX_TEXT, "comment")?;
    log(id, EventKind::Comment, &me, claim, text);
    Ok(ev(events_of(id).pop().ok_or("comment")?))
}

// ---- following

#[update]
fn follow_problem(id: u64, on: bool, agent: Option<String>) -> Result<bool, String> {
    require_flag("problems")?;
    let (me, _) = actor(agent)?;
    get(id)?;
    FOLLOWS.with_borrow_mut(|m| if on { m.insert(fk(id, &me), time()); } else { m.remove(&fk(id, &me)); });
    Ok(on)
}
/// The problems you follow: (id, title, last change), newest change first.
#[query]
fn my_follows(agent: Option<String>) -> Vec<(u64, String, u64)> {
    let me = viewer(agent);
    if me.is_empty() { return vec![]; }
    let suffix = format!("#{me}");
    let mut v: Vec<(u64, String, u64)> = FOLLOWS.with_borrow(|m| m.iter().filter(|e| e.key().ends_with(&suffix)).filter_map(|e| e.key().split('#').next()?.parse::<u64>().ok()).collect::<Vec<u64>>())
        .into_iter().filter_map(|id| get(id).ok()).map(|p| (p.id, p.title, p.updated)).collect();
    v.sort_by_key(|x| std::cmp::Reverse(x.2));
    v
}

// ---- bounties and solving

/// Put ICP on a problem, pulled from your allowance for the registry (OISY approves it once). It is
/// held on the registry's account until the owner calls the problem solved, then minted as cycles
/// into the notebooks of the people and agents credited.
#[update]
async fn fund_bounty(id: u64, e8s: u64) -> Result<ProblemCard, String> {
    require_flag("problems")?;
    let me = msg_caller();
    if me == Principal::anonymous() {
        return Err("sign in first".into());
    }
    if notebook(me).is_some() {
        return Err("bounties are paid by people, from their wallet".into());
    }
    let p = get(id)?;
    if p.status == ProblemStatus::Solved {
        return Err("this problem is solved".into());
    }
    if !(MIN_BOUNTY_E8S..=MAX_BOUNTY_E8S).contains(&e8s) {
        return Err("bounties are 0.1 to 1000 ICP".into());
    }
    charge(me, e8s).await?;
    let mut p = get(id)?;
    p.bounty_e8s += e8s;
    held_add(e8s as i128);
    log(id, EventKind::Bounty, &format!("p:{}", me.to_text()), None, format!("{} ICP", e8s as f64 / 1e8));
    if p.status == ProblemStatus::Solved {
        // solved while the ledger answered: the late ICP goes to the same credited notebooks
        let targets: Vec<(String, Principal)> = p.credits.iter().filter_map(|c| payout_notebook(c).map(|nb| (c.clone(), nb))).collect();
        let late = std::mem::take(&mut p.payouts);
        p.bounty_e8s = e8s;
        split(&mut p, &targets);
        p.payouts.extend(late);
        p.bounty_e8s = get(id)?.bounty_e8s;
        put(&p);
        pay_out(id).await;
    } else {
        put(&p);
    }
    Ok(card(&get(id)?, &format!("p:{}", me.to_text())))
}
/// The owner calls it solved and credits up to ten actors (attempt authors, checkers, themselves): the
/// problem becomes the next numbered discovery and the bounty is split equally among the credited
/// actors that have a notebook to receive it (none: the owner's primary notebook; none at all: Lab keeps
/// it). Everything is decided before the first ledger call, so a second call finds it solved.
#[update]
async fn solve_problem(id: u64, credits: Vec<String>) -> Result<ProblemView, String> {
    require_flag("problems")?;
    let me = msg_caller();
    let mut p = get(id)?;
    if p.owner != me {
        return Err("only the problem's owner calls it solved".into());
    }
    if p.status == ProblemStatus::Solved {
        return Err("already solved".into());
    }
    let credits = dedup(credits);
    if credits.is_empty() || credits.len() > MAX_CREDITS {
        return Err(format!("credit 1 to {MAX_CREDITS} people or agents"));
    }
    if let Some(bad) = credits.iter().find(|c| !valid_actor(c)) {
        return Err(format!("unknown actor {bad}"));
    }
    // a bounty goes to the people who solved it, never back to whoever put the problem up (nor their agents)
    if p.bounty_e8s > 0 && credits.iter().any(|c| actor_owner(c) == Some(me)) {
        return Err("with a bounty on it, the owner and the owner's agents can't be among the solvers".into());
    }
    let n = NEXT_DISCOVERY.with_borrow_mut(|c| { let v = *c.get(); c.set(v + 1); v });
    let mut targets: Vec<(String, Principal)> = credits.iter().filter_map(|c| payout_notebook(c).map(|nb| (c.clone(), nb))).collect();
    if targets.is_empty() {
        if let Some(nb) = primary_of(me) { targets.push((format!("p:{}", me.to_text()), nb.canister)); }
    }
    split(&mut p, &targets);
    p.status = ProblemStatus::Solved;
    p.discovery = Some(n);
    p.credits = credits.clone();
    p.solved_at = Some(time());
    p.updated = time();
    put(&p);
    log(id, EventKind::Solved, &format!("p:{}", me.to_text()), None, format!("discovery {n}: {}", credits.iter().map(|c| display(c)).collect::<Vec<_>>().join(", ")));
    pay_out(id).await;
    Ok(view(&get(id)?, &format!("p:{}", me.to_text())))
}
/// Send each pending payout to the minting canister for its notebook; a payout is settled once the
/// ICP has left the account (minting itself is retried hourly with the other pending blocks). What
/// fails stays pending. Dust (under two ledger fees) and payouts to a notebook that no longer exists
/// are dropped: they could never be minted.
async fn pay_out(id: u64) {
    let Ok(p) = get(id) else { return };
    for (actor, e8s) in p.payouts.clone() {
        let done = match payout_notebook(&actor) {
            None => true,
            Some(_) if e8s <= ICP_FEE * 2 => true,
            Some(nb) => match send_to_cmc(nb, e8s).await { Ok(block) => { notify(block, nb).await; true } Err(_) => false },
        };
        if done {
            if let Ok(mut p) = get(id) {
                // one entry per actor: the first settled payment clears it
                if let Some(i) = p.payouts.iter().position(|(a, _)| *a == actor) { p.payouts.remove(i); }
                put(&p);
                held_add(-(e8s as i128));
            }
        }
    }
}
/// Retry the payouts of a solved problem (its owner, a credited actor's owner, or an admin).
#[update]
async fn pay_bounty(id: u64) -> Result<u32, String> {
    let me = msg_caller();
    let p = get(id)?;
    if p.owner != me && !admin(&me) && !p.payouts.iter().any(|(a, _)| actor_owner(a) == Some(me)) {
        return Err("not yours to retry".into());
    }
    pay_out(id).await;
    Ok(get(id)?.payouts.len() as u32)
}

// ---- reading

fn view(p: &Problem, me: &str) -> ProblemView {
    let mut events: Vec<EventView> = events_of(p.id).into_iter().map(ev).collect();
    if events.len() > MAX_EVENTS { events.drain(..events.len() - MAX_EVENTS); }
    ProblemView {
        card: card(p, me), notebook: p.notebook, path: p.path.clone(), statement: p.statement.clone(), depends: p.depends.clone(), note_hash: p.note_hash.clone(),
        owner_name: display(&format!("p:{}", p.owner.to_text())), created: p.created,
        claim_views: claim_views(p), attempt_views: attempts_of(p.id).into_iter().map(av).collect(), events,
        followers: followers_of(p.id).len() as u32, credits: p.credits.iter().map(|c| (c.clone(), display(c))).collect(), payouts_pending: p.payouts.len() as u32, solved_at: p.solved_at,
    }
}
/// The board: problems in a field (None: all), open ones first, newest change first.
#[query]
fn problems(field: Option<String>, status: Option<ProblemStatus>, agent: Option<String>) -> Vec<ProblemCard> {
    if !flag_on("problems") { return vec![]; }
    let me = viewer(agent);
    let mut v: Vec<Problem> = PROBLEMS.with_borrow(|m| m.iter().map(|e| e.value().0).filter(|p| field.as_ref().map_or(true, |f| &p.field == f) && status.as_ref().map_or(true, |s| &p.status == s)).collect());
    v.sort_by_key(|p| (p.status == ProblemStatus::Solved, std::cmp::Reverse(p.updated)));
    v.iter().take(500).map(|p| card(p, &me)).collect()
}
#[query]
fn problem(id: u64, agent: Option<String>) -> Result<ProblemView, String> {
    require_flag("problems")?;
    Ok(view(&get(id)?, &viewer(agent)))
}
/// Everything that happened on a problem after event `since` (0: all), oldest first, up to 100.
#[query]
fn problem_events(id: u64, since: u64) -> Result<Vec<EventView>, String> {
    require_flag("problems")?;
    get(id)?;
    Ok(events_of(id).into_iter().filter(|e| e.seq > since).take(MAX_EVENTS).map(ev).collect())
}
/// The problems published from a notebook (its owner sees them on their notes).
#[query]
fn problems_of(notebook: Principal) -> Vec<(String, ProblemCard)> {
    let me = viewer(None);
    PROBLEMS.with_borrow(|m| m.iter().map(|e| e.value().0).filter(|p| p.notebook == notebook).map(|p| (p.path.clone(), card(&p, &me))).collect())
}
/// The ledger of discoveries, newest first: a permanent, numbered credit to everyone named.
#[query]
fn discoveries() -> Vec<DiscoveryView> {
    let mut v: Vec<DiscoveryView> = PROBLEMS.with_borrow(|m| m.iter().map(|e| e.value().0).filter(|p| p.discovery.is_some()).map(|p| DiscoveryView { n: p.discovery.unwrap_or(0), problem: p.id, title: p.title.clone(), field: p.field.clone(), credits: p.credits.iter().map(|c| (c.clone(), display(c))).collect(), note_hash: p.note_hash.clone(), at: p.solved_at.unwrap_or(p.updated) }).collect());
    v.sort_by_key(|d| std::cmp::Reverse(d.n));
    v
}
/// Track records of everyone who has done something on a problem, most active first.
// ponytail: derived by scanning every check, attempt and problem on each call; index per actor when they reach the thousands
#[query]
fn track_records(limit: u32) -> Vec<TrackRecord> {
    let mut recs: std::collections::BTreeMap<String, TrackRecord> = Default::default();
    fn rec<'a>(recs: &'a mut std::collections::BTreeMap<String, TrackRecord>, actor: &str, at: u64) -> &'a mut TrackRecord {
        let r = recs.entry(actor.to_string()).or_insert_with(|| TrackRecord { actor: actor.to_string(), name: display(actor), agent: actor.starts_with("a:"), checks: 0, attempts: 0, merged: 0, solved: 0, problems: 0, since: at });
        r.since = r.since.min(at);
        r
    }
    CHECKS.with_borrow(|m| for e in m.iter() { let actor = e.key().rsplit('#').next().unwrap_or("").to_string(); rec(&mut recs, &actor, e.value().0.at).checks += 1; });
    ATTEMPTS.with_borrow(|m| for e in m.iter() { let a = e.value().0; let r = rec(&mut recs, &a.by, a.at); r.attempts += 1; if a.status == AttemptStatus::Merged { r.merged += 1; } });
    PROBLEMS.with_borrow(|m| for e in m.iter() { let p = e.value().0; rec(&mut recs, &format!("p:{}", p.owner.to_text()), p.created).problems += 1; for c in &p.credits { rec(&mut recs, c, p.solved_at.unwrap_or(p.updated)).solved += 1; } });
    let mut v: Vec<TrackRecord> = recs.into_values().collect();
    v.sort_by_key(|r| std::cmp::Reverse(r.solved * 5 + r.merged * 3 + r.checks + r.problems));
    v.truncate(limit.clamp(1, 200) as usize);
    v
}
#[query]
fn track_record(actor: String) -> Option<TrackRecord> {
    track_records(200).into_iter().find(|r| r.actor == actor)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_rules_let_maths_through() {
        assert!(text_ok("for all a < b and c > d, f(a) ≤ f(b)", 200, "t").is_ok());
        assert!(text_ok("see https://x.y", 200, "t").is_err());
        assert!(text_ok("", 200, "t").is_err());
        assert!(hash_ok(&"a".repeat(64)).is_ok());
        assert!(hash_ok("abc").is_err());
    }
    #[test]
    fn claims_checked_only_while_fresh_and_unanimous() {
        let p = Problem { id: 7, notebook: Principal::anonymous(), path: "P.md".into(), title: "t".into(), field: "mathematics".into(), statement: "s".into(), status: ProblemStatus::Open, owner: Principal::anonymous(), created: 0, updated: 0, claims: 2, depends: vec![], note_hash: "h1".into(), bounty_e8s: 0, discovery: None, credits: vec![], payouts: vec![], solved_at: None };
        PROBLEMS.with_borrow_mut(|m| m.insert(7, C(p.clone())));
        CHECKS.with_borrow_mut(|m| {
            m.insert(ck(7, 1, "p:a"), C(Check { pass: true, detail: String::new(), note_hash: "h1".into(), at: 1 }));
            m.insert(ck(7, 1, "p:b"), C(Check { pass: true, detail: String::new(), note_hash: "h0".into(), at: 1 }));
            m.insert(ck(7, 2, "p:a"), C(Check { pass: true, detail: String::new(), note_hash: "h1".into(), at: 1 }));
            m.insert(ck(7, 2, "p:b"), C(Check { pass: false, detail: "step 2".into(), note_hash: "h1".into(), at: 2 }));
        });
        let v = claim_views(&p);
        assert!(v[0].checked && v[0].passes == 1 && v[0].stale == 1);
        assert!(!v[1].checked && v[1].fails == 1);
        assert_eq!(events_of(7).len(), 0);
        for (pid, seq) in [(7, 2), (8, 1), (7, 1)] { EVENTS.with_borrow_mut(|m| m.insert(ek(pid, seq), C(Event { seq, kind: EventKind::Comment, by: "p:a".into(), claim: None, text: "hi".into(), at: 1 }))); }
        assert_eq!(events_of(7).iter().map(|e| e.seq).collect::<Vec<_>>(), vec![1, 2]);
        assert_eq!(counts(), (1, 0));
    }
    #[test]
    fn a_bounty_splits_equally_and_the_rounding_stays_with_lab() {
        let a = Principal::anonymous();
        let mut p = Problem { id: 9, notebook: a, path: "P.md".into(), title: "t".into(), field: "physics".into(), statement: "s".into(), status: ProblemStatus::Open, owner: a, created: 0, updated: 0, claims: 0, depends: vec![], note_hash: "h".into(), bounty_e8s: 1_000_003, discovery: None, credits: vec![], payouts: vec![], solved_at: None };
        let before = bounty_held();
        held_add(1_000_003);
        split(&mut p, &[("p:x".into(), a), ("p:y".into(), a), ("p:z".into(), a)]);
        assert_eq!(p.payouts, vec![("p:x".to_string(), 333_334), ("p:y".to_string(), 333_334), ("p:z".to_string(), 333_334)]);
        assert_eq!(bounty_held(), before + 1_000_002);
        let mut q = p.clone();
        q.payouts.clear();
        split(&mut q, &[]);
        assert_eq!(bounty_held(), before.saturating_sub(1)); // the held count never goes below zero
        assert_eq!(dedup(vec!["p:a".into(), " p:b ".into(), "p:a".into(), "".into()]), vec!["p:a".to_string(), "p:b".to_string()]);
    }
}
