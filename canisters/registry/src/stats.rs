// ---------------------------------------------------------------- admin numbers
//
// How many people, notebooks and notes there are and how many were active lately; the town uses
// the same fan-out to count its houses.

use super::*;

/// a person, a notebook: active when something changed within this long
pub const ACTIVE_NS: u64 = 30 * 24 * 3_600_000_000_000;

#[derive(CandidType, Deserialize, Clone, Debug, Default)]
pub struct AppStats {
    /// people: notebook owners and community members
    pub users: u64,
    pub active_users: u64,
    pub notebooks: u64,
    pub active_notebooks: u64,
    pub notes: u64,
    pub files: u64,
    pub members: u64,
    /// notebooks that did not answer (frozen or out of cycles)
    pub unreachable: u64,
    /// cycles earned from model answers, all time
    pub ai_fees_cycles: u128,
    pub at: u64,
}
#[derive(CandidType, Deserialize)]
pub struct Usage {
    pub files: u64,
    pub notes: u64,
    pub last_modified: Option<u64>,
    /// `[[links]]`, the writing streak and days active in 30: None from a notebook not yet upgraded
    pub links: Option<u64>,
    pub streak: Option<u32>,
    pub active_days: Option<u32>,
    /// an agent key used in the last week: None from a notebook not yet upgraded
    pub agent_active: Option<bool>,
}
thread_local! {
    static STATS_CACHE: RefCell<Option<AppStats>> = const { RefCell::new(None) };
}
/// Await every future at once.
pub async fn join_all<F: std::future::Future>(fs: Vec<F>) -> Vec<F::Output> {
    let mut fs: Vec<_> = fs.into_iter().map(Box::pin).collect();
    let mut out: Vec<Option<F::Output>> = fs.iter().map(|_| None).collect();
    std::future::poll_fn(|cx| {
        let mut done = true;
        for (f, o) in fs.iter_mut().zip(out.iter_mut()) {
            if o.is_none() {
                match f.as_mut().poll(cx) {
                    std::task::Poll::Ready(v) => *o = Some(v),
                    std::task::Poll::Pending => done = false,
                }
            }
        }
        if done { std::task::Poll::Ready(()) } else { std::task::Poll::Pending }
    })
    .await;
    out.into_iter().map(|o| o.unwrap()).collect()
}
/// Every notebook's counts and last edit, None for those that did not answer.
pub async fn usage_all(nbs: &[Notebook]) -> Vec<Option<Usage>> {
    let mut usage: Vec<Option<Usage>> = Vec::new();
    // ponytail: 50 calls at a time to every notebook; sample or keep running counts past a few thousand
    for chunk in nbs.chunks(50) {
        let calls = chunk.iter().map(|n| async move { Call::bounded_wait(n.canister, "usage").await.ok().and_then(|r| r.candid::<Usage>().ok()) });
        usage.extend(join_all(calls.collect()).await);
    }
    usage
}
/// How many people, notebooks and notes there are, and how many were active in the last 30 days
/// (admins). Asks every notebook for its counts; cached for ten minutes.
#[update]
async fn app_stats(fresh: bool) -> Result<AppStats, String> {
    if !admin(&msg_caller()) {
        return Err("admin only".into());
    }
    let now = time();
    if let Some(c) = STATS_CACHE.with_borrow(|c| c.clone()).filter(|c| !fresh && now.saturating_sub(c.at) < 600_000_000_000) {
        return Ok(c);
    }
    let nbs: Vec<Notebook> = NOTEBOOKS.with_borrow(|m| m.iter().map(|e| e.value().0).collect());
    let usage = usage_all(&nbs).await;
    let cutoff = now.saturating_sub(ACTIVE_NS);
    let mut people = std::collections::HashSet::new();
    let mut active_people = std::collections::HashSet::new();
    let mut st = AppStats { notebooks: nbs.len() as u64, at: now, ai_fees_cycles: AI_FEES.with_borrow(|c| *c.get()), ..Default::default() };
    for (n, u) in nbs.iter().zip(usage.iter()) {
        people.insert(n.owner);
        let Some(u) = u else {
            st.unreachable += 1;
            continue;
        };
        st.notes += u.notes;
        st.files += u.files;
        if u.last_modified.map_or(false, |t| t >= cutoff) {
            st.active_notebooks += 1;
            active_people.insert(n.owner);
        }
    }
    MEMBERS.with_borrow(|m| {
        st.members = m.len();
        for e in m.iter() {
            people.insert(*e.key());
        }
    });
    LAST_POST.with_borrow(|l| {
        for e in l.iter().filter(|e| e.value() >= cutoff) {
            active_people.insert(*e.key());
        }
    });
    (st.users, st.active_users) = (people.len() as u64, active_people.len() as u64);
    STATS_CACHE.with_borrow_mut(|c| *c = Some(st.clone()));
    Ok(st)
}
