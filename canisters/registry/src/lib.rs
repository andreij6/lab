//! Notebook registry: spawns one notebook canister per notebook (the embedded `notebook` wasm), makes the
//! creator a controller alongside itself, and remembers who owns what. Notes never pass through
//! here: each notebook talks to its own canister.

use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::api::{canister_self, is_controller, msg_caller, time};
use ic_cdk::call::Call;
use ic_cdk::{init, post_upgrade, query, update};
use ic_cdk_management_canister as mgmt;
use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, Memo, Subaccount, Tokens, TransferArgs, TransferResult, DEFAULT_FEE, DEFAULT_SUBACCOUNT, MAINNET_CYCLES_MINTING_CANISTER_ID as CMC, MAINNET_LEDGER_CANISTER_ID as LEDGER};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};
use std::time::Duration;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{storable::Bound, DefaultMemoryImpl, StableBTreeMap, Storable};
use std::borrow::Cow;
use std::cell::RefCell;

mod stats;
mod town;
use stats::AppStats;
use town::Town;

const NOTEBOOK_WASM: &[u8] = include_bytes!("../../../target/notebook.wasm.gz");
/// Cycles a new notebook starts with. The owner is a controller and tops it up from there.
// ponytail: the registry pays; charge the creator ICP (cycles-dca's deposit flow) before mainnet
const CYCLES_PER_NOTEBOOK: u128 = 1_000_000_000_000;
/// A notebook freezes once its cycles cover less than this much idle time, and the IC deletes it
/// when they run out: so a frozen notebook keeps its data for 90 days, during which a top-up revives it.
const FREEZE_SECS: u64 = 90 * 24 * 3600;

/// How a payment token turns into a notebook's cycles.
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
pub enum Route {
    /// ICP: ledger -> cycles minting canister
    Icp,
    /// TCYCLES on the cycles ledger: withdrawn straight into the notebook
    Cycles,
    /// any other ICRC-2 token: swapped for ICP on ICPSwap, then minted
    Swap,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Token {
    pub symbol: String,
    pub ledger: Principal,
    pub decimals: u8,
    pub fee: Nat,
    pub route: Route,
}

/// A notebook offered for sale; the price is in `token`'s smallest unit.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Listing {
    pub canister: Principal,
    pub seller: Principal,
    pub token: String,
    pub price: Nat,
    pub blurb: String,
    pub listed_at: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Rating {
    pub rater: Principal,
    pub stars: u8,
    pub comment: String,
    pub at: u64,
}

/// The judge's verdict on a notebook, attached to its listing.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Attestation {
    pub score: u8,
    pub grade: String,
    pub summary: String,
    pub judge: String,
    pub notes: u64,
    pub words: u64,
    pub at: u64,
    /// flashcard decks and quizzes in the notebook (missing on attestations made before it was counted)
    #[serde(default)]
    pub decks: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ListingView {
    pub listing: Listing,
    pub name: String,
    pub token_id: Option<u64>,
    pub attestation: Option<Attestation>,
    pub rating_avg: f64,
    pub rating_count: u64,
}

/// Mirror of the notebook's `audit` result.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Audit {
    pub notes: u64,
    pub words: u64,
    pub links: u64,
    pub resolved_links: u64,
    pub orphans: u64,
    pub with_headings: u64,
    pub with_tags: u64,
    pub agent_notes: u64,
    pub newest_modified: u64,
    pub oldest_created: u64,
    pub samples: Vec<(String, String)>,
    #[serde(default)]
    pub decks: u64,
}

// ICRC-7 surface: a notebook is one token of the "Notebooks" collection; owning the token is owning the canister.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum Value {
    Blob(Vec<u8>),
    Text(String),
    Nat(Nat),
    Int(candid::Int),
    Array(Vec<Value>),
    Map(Vec<(String, Value)>),
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TransferArg {
    pub from_subaccount: Option<Vec<u8>>,
    pub to: Account,
    pub token_id: Nat,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TransferError {
    NonExistingTokenId,
    InvalidRecipient,
    Unauthorized,
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: Nat },
    GenericError { error_code: Nat, message: String },
    GenericBatchError { error_code: Nat, message: String },
}

/// What the owner sees about a notebook's cycles, even while it is frozen (read via the management canister).
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Health {
    pub cycles: Nat,
    pub idle_cycles_burned_per_day: Nat,
    pub freezing_threshold_secs: u64,
    /// cycles at which the canister freezes (idle burn over the threshold)
    pub freeze_at: Nat,
    pub frozen: bool,
    /// whole days of idle burn the balance still covers; the canister is deleted when it reaches 0
    pub days_left: u64,
    pub stopped: bool,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Notebook {
    pub canister: Principal,
    pub name: String,
    pub owner: Principal,
    pub created_at: u64,
    /// the icon shown on its card; the app picks one from the name when unset
    #[serde(default)]
    pub emoji: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(CandidType, Deserialize)]
struct NotebookInit {
    name: String,
    owner: Principal,
    registry: Principal,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
pub enum BugStatus {
    Open,
    InProgress,
    Done,
    WontFix,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Bug {
    pub id: u64,
    pub reporter: Principal,
    pub title: String,
    pub detail: String,
    /// where it happened: page, notebook, browser (filled in by the app)
    pub context: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub status: BugStatus,
    /// the admin's working note, visible to the reporter
    pub note: String,
    /// "bug" (default) or "idea"
    pub kind: Option<String>,
}

#[derive(CandidType, Deserialize)]
pub struct Stats {
    pub notebooks: u64,
    pub cycles: candid::Nat,
    pub cycles_per_notebook: candid::Nat,
    /// ICP (e8s) a person pays to spawn a notebook; 0 = the registry pays
    pub price_e8s: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct SnapshotInfo {
    pub id: Vec<u8>,
    pub taken_at: u64,
    pub total_size: u64,
}

type Mem = VirtualMemory<DefaultMemoryImpl>;

#[derive(Clone)]
struct C<T>(T);
impl<T: CandidType + for<'a> Deserialize<'a>> Storable for C<T> {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(candid::encode_one(&self.0).unwrap())
    }
    fn into_bytes(self) -> Vec<u8> {
        candid::encode_one(&self.0).unwrap()
    }
    fn from_bytes(b: Cow<[u8]>) -> Self {
        C(candid::decode_one(&b).unwrap())
    }
    const BOUND: Bound = Bound::Unbounded;
}

thread_local! {
    static MM: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    static NOTEBOOKS: RefCell<StableBTreeMap<Principal, C<Notebook>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(0)))));
    static BUGS: RefCell<StableBTreeMap<u64, C<Bug>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(1)))));
    /// site admins besides the controllers (an Internet Identity principal, usually)
    static ADMINS: RefCell<StableBTreeMap<Principal, (), Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(2)))));
    /// what a spawn costs, in e8s (0 = free, the registry pays)
    static PRICE: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(3))), 0));
    /// top-ups sent to the CMC whose notify_top_up did not succeed yet: block index -> notebook
    static PENDING: RefCell<StableBTreeMap<u64, Principal, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(4)))));
    static TOKENS: RefCell<StableBTreeMap<String, C<Token>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(5)))));
    /// ICRC-7 token id -> notebook canister, and back
    static TOKEN_IDS: RefCell<StableBTreeMap<u64, Principal, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(6)))));
    static ID_OF: RefCell<StableBTreeMap<Principal, u64, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(7)))));
    static NEXT_ID: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(8))), 1));
    static LISTINGS: RefCell<StableBTreeMap<Principal, C<Listing>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(9)))));
    /// "canister/rater" -> rating; only buyers get a key here
    static RATINGS: RefCell<StableBTreeMap<String, C<Rating>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(10)))));
    static ATTESTATIONS: RefCell<StableBTreeMap<Principal, C<Attestation>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(11)))));
    /// "canister/buyer" -> when they bought it
    static PURCHASES: RefCell<StableBTreeMap<String, u64, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(12)))));
    /// market fee in basis points, kept by the registry on every sale
    static MARKET_FEE_BPS: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(13))), 250));
}

#[init]
fn init() {
    seed_tokens();
    seed_channels();
    seed_developers();
    seed_kit_channels();
    seed_sections();
    start_timers();
}
#[post_upgrade]
fn post_upgrade() {
    seed_tokens();
    seed_channels();
    seed_developers();
    seed_kit_channels();
    seed_sections();
    start_timers();
}
fn start_timers() {
    // ICP collected from spawns becomes the registry's cycles once an hour
    ic_cdk_timers::set_timer_interval_serial(Duration::from_secs(3600), || async {
        let _ = sweep_fees().await;
        let _ = sweep_holdings().await;
        retry_pending().await;
        expire_posts();
        expire_messages();
        town::town_tick().await;
    });
    // the town's houses live on the heap: count them again soon after an upgrade
    ic_cdk_timers::set_timer(Duration::from_secs(10), town::refresh_town());
}

// ---------------------------------------------------------------- charging for spawns

const ICP_FEE: u64 = 10_000;
const MEMO_TOP_UP_CANISTER: Memo = Memo(0x5055_5054); // 'TPUP'

/// Set the spawn price in e8s (controller only); 0 makes spawning free again.
#[update]
fn set_price(e8s: u64) -> Result<(), String> {
    if !is_controller(&msg_caller()) {
        return Err("controller only".into());
    }
    PRICE.with_borrow_mut(|p| p.set(e8s));
    Ok(())
}

#[query]
fn price() -> u64 {
    PRICE.with_borrow(|p| *p.get())
}

/// Pull the price from the caller's ICRC-2 allowance into the registry's account. Paying for
/// yourself uses your registered wallet when you have one.
async fn charge(payer: Principal, e8s: u64) -> Result<(), String> {
    let payer = if payer == msg_caller() { WALLETS.with_borrow(|w| w.get(&payer)).unwrap_or(payer) } else { payer };
    let tf = TransferFromArgs {
        spender_subaccount: spender_sub(payer),
        from: Account { owner: payer, subaccount: None },
        to: Account { owner: canister_self(), subaccount: None },
        amount: Nat::from(e8s),
        fee: Some(Nat::from(ICP_FEE)),
        memo: None,
        created_at_time: Some(time()),
    };
    let r: Result<Nat, TransferFromError> = Call::unbounded_wait(LEDGER, "icrc2_transfer_from")
        .with_arg(&tf)
        .await
        .map_err(|e| format!("ledger: {e}"))?
        .candid()
        .map_err(|e| e.to_string())?;
    r.map(|_| ()).map_err(|e| format!("payment refused: {e:?}. Approve {} ICP for the registry first.", (e8s + ICP_FEE) as f64 / 1e8))
}

/// An allowance on someone else's account must be granted to the registry's subaccount for the
/// caller, so an approval made for one person's call cannot be spent by another caller who names
/// the same payer. Paying from your own account needs no subaccount.
fn spender_sub(payer: Principal) -> Option<[u8; 32]> {
    let me = msg_caller();
    (payer != me).then(|| cmc_subaccount(me).0)
}

/// Register (or with None, forget) the wallet you pay from, e.g. your OISY account.
#[update]
fn set_wallet(wallet: Option<Principal>) -> Result<(), String> {
    let me = msg_caller();
    if me == Principal::anonymous() {
        return Err("sign in first".into());
    }
    WALLETS.with_borrow_mut(|w| match wallet {
        Some(x) if x != me && x != Principal::anonymous() => w.insert(me, x),
        _ => w.remove(&me),
    });
    Ok(())
}
/// Where ICP for someone lands: their registered wallet, else their sign-in principal.
fn wallet_of(p: Principal) -> Principal {
    WALLETS.with_borrow(|w| w.get(&p)).unwrap_or(p)
}
#[query]
fn my_wallet() -> Option<Principal> {
    WALLETS.with_borrow(|w| w.get(&msg_caller()))
}

fn cmc_subaccount(canister: Principal) -> Subaccount {
    let mut s = [0u8; 32];
    let b = canister.as_slice();
    s[0] = b.len() as u8;
    s[1..1 + b.len()].copy_from_slice(b);
    Subaccount(s)
}

#[derive(CandidType, Deserialize)]
struct NotifyTopUp {
    block_index: u64,
    canister_id: Principal,
}

/// Convert the ICP collected from spawns into the registry's own cycles (controller or timer).
#[update]
async fn sweep_fees() -> Result<Nat, String> {
    let caller = msg_caller();
    if caller != canister_self() && !is_controller(&caller) {
        return Err("controller only".into());
    }
    let me = canister_self();
    let bal: Tokens = Call::unbounded_wait(LEDGER, "account_balance")
        .with_arg(AccountBalanceArgs { account: AccountIdentifier::new(&me, &DEFAULT_SUBACCOUNT) })
        .await
        .map_err(|e| e.to_string())?
        .candid()
        .map_err(|e| e.to_string())?;
    if bal.e8s() < 1_000_000 {
        return Err("under 0.01 ICP on the account".into());
    }
    let args = TransferArgs { memo: MEMO_TOP_UP_CANISTER, amount: Tokens::from_e8s(bal.e8s() - ICP_FEE), fee: DEFAULT_FEE, from_subaccount: Some(DEFAULT_SUBACCOUNT), to: AccountIdentifier::new(&CMC, &cmc_subaccount(me)), created_at_time: None };
    let r: TransferResult = Call::unbounded_wait(LEDGER, "transfer").with_arg(&args).await.map_err(|e| e.to_string())?.candid().map_err(|e| e.to_string())?;
    let block_index = r.map_err(|e| e.to_string())?;
    let res: Result<Nat, candid::Reserved> = Call::unbounded_wait(CMC, "notify_top_up").with_arg(&NotifyTopUp { block_index, canister_id: me }).await.map_err(|e| e.to_string())?.candid().map_err(|e| e.to_string())?;
    res.map_err(|_| "notify_top_up refused; it will be retried next hour".to_string())
}

// ---------------------------------------------------------------- help & support: bug reports

const MAX_BUGS_PER_REPORTER: usize = 50;

fn admin(p: &Principal) -> bool {
    is_controller(p) || ADMINS.with_borrow(|a| a.contains_key(p))
}

/// Is the caller a site admin (a controller or an added admin)?
#[query]
fn is_admin() -> bool {
    admin(&msg_caller())
}

/// Controllers add the principal they sign in with (Internet Identity differs from the CLI identity).
#[update]
fn add_admin(p: Principal) -> Result<(), String> {
    if !is_controller(&msg_caller()) {
        return Err("controller only".into());
    }
    ADMINS.with_borrow_mut(|a| a.insert(p, ()));
    Ok(())
}

#[update]
fn remove_admin(p: Principal) -> Result<(), String> {
    if !is_controller(&msg_caller()) {
        return Err("controller only".into());
    }
    ADMINS.with_borrow_mut(|a| a.remove(&p)).map(|_| ()).ok_or_else(|| "not an admin".into())
}

#[query]
fn admins() -> Result<Vec<Principal>, String> {
    if !admin(&msg_caller()) {
        return Err("admin only".into());
    }
    Ok(ADMINS.with_borrow(|a| a.iter().map(|e| *e.key()).collect()))
}

/// Anyone signed in can report a bug (title + detail); the app adds where it happened.
#[update]
fn report_bug(title: String, detail: String, context: String) -> Result<Bug, String> {
    submit_report("bug", title, detail, context)
}
/// An idea or feature request: same queue as bugs, marked so admins can triage separately.
#[update]
fn report_idea(title: String, detail: String, context: String) -> Result<Bug, String> {
    submit_report("idea", title, detail, context)
}
fn submit_report(kind: &str, title: String, detail: String, context: String) -> Result<Bug, String> {
    let reporter = msg_caller();
    if reporter == Principal::anonymous() {
        return Err("sign in first".into());
    }
    let title = title.trim().to_string();
    let detail = detail.trim().to_string();
    if title.is_empty() || title.chars().count() > 120 {
        return Err("title: 1-120 characters".into());
    }
    if detail.is_empty() || detail.chars().count() > 4000 {
        return Err("detail: 1-4000 characters".into());
    }
    if BUGS.with_borrow(|b| b.iter().filter(|e| e.value().0.reporter == reporter).count()) >= MAX_BUGS_PER_REPORTER {
        return Err(format!("{MAX_BUGS_PER_REPORTER} reports from you already; thank you, that is plenty"));
    }
    let id = BUGS.with_borrow(|b| b.last_key_value().map(|(k, _)| k + 1).unwrap_or(1));
    let bug = Bug { id, reporter, title, detail, context: context.chars().take(500).collect(), created_at: time(), updated_at: time(), status: BugStatus::Open, note: String::new(), kind: Some(kind.into()) };
    BUGS.with_borrow_mut(|b| b.insert(id, C(bug.clone())));
    Ok(bug)
}

/// The caller's own reports, newest first.
#[query]
fn my_bugs() -> Vec<Bug> {
    let me = msg_caller();
    let mut v: Vec<Bug> = BUGS.with_borrow(|b| b.iter().map(|e| e.value().0).filter(|x| x.reporter == me).collect());
    v.reverse();
    v
}

/// Every report, newest first (admin only).
#[query]
fn bugs() -> Result<Vec<Bug>, String> {
    if !admin(&msg_caller()) {
        return Err("admin only".into());
    }
    let mut v: Vec<Bug> = BUGS.with_borrow(|b| b.iter().map(|e| e.value().0).collect());
    v.reverse();
    Ok(v)
}

/// Move a report along and leave a note (admin only).
#[update]
fn update_bug(id: u64, status: BugStatus, note: String) -> Result<Bug, String> {
    if !admin(&msg_caller()) {
        return Err("admin only".into());
    }
    let mut bug = BUGS.with_borrow(|b| b.get(&id).map(|c| c.0)).ok_or("no such report")?;
    bug.status = status;
    bug.note = note.chars().take(2000).collect();
    bug.updated_at = time();
    BUGS.with_borrow_mut(|b| b.insert(id, C(bug.clone())));
    Ok(bug)
}

/// Spawn a notebook canister. The caller becomes its owner and a controller next to this registry.
#[update]
async fn create_notebook(name: String) -> Result<Notebook, String> {
    spawn(name, None).await
}

/// The same, with the spawn price pulled from `payer`'s allowance (an OISY wallet) instead of the caller's.
#[update]
async fn create_notebook_paid_by(name: String, payer: Principal) -> Result<Notebook, String> {
    if payer == Principal::anonymous() {
        return Err("payer must be a real principal".into());
    }
    spawn(name, Some(payer)).await
}

async fn spawn(name: String, payer: Option<Principal>) -> Result<Notebook, String> {
    let owner = msg_caller();
    if owner == Principal::anonymous() {
        return Err("sign in first".into());
    }
    let name = name.trim().to_string();
    if name.is_empty() || name.len() > 64 {
        return Err("name must be 1-64 chars".into());
    }
    let me = ic_cdk::api::canister_self();
    let price = PRICE.with_borrow(|p| *p.get());
    if price > 0 {
        charge(payer.unwrap_or(owner), price).await?;
    }
    let created = mgmt::create_canister_with_extra_cycles(
        &mgmt::CreateCanisterArgs { settings: Some(mgmt::CanisterSettings { controllers: Some(vec![me, owner]), freezing_threshold: Some(Nat::from(FREEZE_SECS)), ..Default::default() }) },
        CYCLES_PER_NOTEBOOK,
    )
    .await
    .map_err(|e| format!("create_canister: {e:?}"))?;
    let arg = candid::encode_one(NotebookInit { name: name.clone(), owner, registry: me }).map_err(|e| e.to_string())?;
    // ponytail: a canister whose install fails is left orphaned; add a reinstall sweep if it shows up
    mgmt::install_code(&mgmt::InstallCodeArgs { mode: mgmt::CanisterInstallMode::Install, canister_id: created.canister_id, wasm_module: NOTEBOOK_WASM.to_vec(), arg })
        .await
        .map_err(|e| format!("install_code: {e:?}"))?;
    let v = Notebook { canister: created.canister_id, name, owner, created_at: time(), emoji: None, description: None };
    NOTEBOOKS.with_borrow_mut(|m| m.insert(v.canister, C(v.clone())));
    mint_id(v.canister);
    Ok(v)
}

/// Notebooks the caller created.
#[query]
fn my_notebooks() -> Vec<Notebook> {
    let me = msg_caller();
    NOTEBOOKS.with_borrow(|m| m.iter().map(|e| e.value().0).filter(|v| v.owner == me).collect())
}

#[query]
fn notebook(canister: Principal) -> Option<Notebook> {
    NOTEBOOKS.with_borrow(|m| m.get(&canister).map(|c| c.0))
}

/// The icon and the one-line description on a notebook's card (owner).
#[update]
fn set_notebook_meta(canister: Principal, emoji: Option<String>, description: Option<String>) -> Result<Notebook, String> {
    owns(msg_caller(), canister)?;
    let emoji = emoji.map(|e| e.trim().to_string()).filter(|e| !e.is_empty());
    if emoji.as_ref().map_or(false, |e| e.chars().count() > 4) {
        return Err("the icon is one emoji".into());
    }
    let description = description.map(|d| d.trim().to_string()).filter(|d| !d.is_empty());
    if description.as_ref().map_or(false, |d| d.chars().count() > 280) {
        return Err("the description is 280 characters at most".into());
    }
    NOTEBOOKS.with_borrow_mut(|m| {
        let mut v = m.get(&canister).map(|c| c.0).ok_or("unknown notebook")?;
        v.emoji = emoji;
        v.description = description;
        m.insert(canister, C(v.clone()));
        Ok(v)
    })
}

/// Forget a notebook you own (after deleting the canister yourself); the canister is not touched.
#[update]
fn forget_notebook(canister: Principal) -> Result<(), String> {
    let me = msg_caller();
    NOTEBOOKS.with_borrow_mut(|m| match m.get(&canister) {
        Some(v) if v.0.owner == me => {
            m.remove(&canister);
            Ok(())
        }
        Some(_) => Err("not your notebook".into()),
        None => Err("unknown notebook".into()),
    })
}

/// The notebook canister's error type, as it arrives over Candid.
#[derive(CandidType, Deserialize, Debug)]
enum NotebookErr {
    Unauthorized,
    NotFound,
    Exists,
    Invalid(String),
}

/// Delete a notebook you own for good: its cycles go to `refund_to` (another notebook of yours)
/// or, when that is None, to the registry; then the canister is stopped and deleted and every
/// registry record of it (listing, token, attestation) goes. Notes and history cannot come back.
#[update]
async fn delete_notebook(canister: Principal, refund_to: Option<Principal>) -> Result<Nat, String> {
    let me = msg_caller();
    match NOTEBOOKS.with_borrow(|m| m.get(&canister)) {
        Some(v) if v.0.owner == me => {}
        Some(_) => return Err("not your notebook".into()),
        None => return Err("unknown notebook".into()),
    }
    let to = match refund_to {
        Some(t) if t == canister => return Err("pick a different notebook for the cycles".into()),
        Some(t) => match NOTEBOOKS.with_borrow(|m| m.get(&t)) {
            Some(v) if v.0.owner == me => t,
            _ => return Err("the cycles can only go to another notebook of yours".into()),
        },
        None => canister_self(),
    };
    // off the market first, so nobody buys it mid-deletion
    LISTINGS.with_borrow_mut(|m| m.remove(&canister));
    // the freezing reserve (90 days of idle burn) would block the payout: drop it, the canister is going anyway
    let _ = mgmt::update_settings(&mgmt::UpdateSettingsArgs { canister_id: canister, settings: mgmt::CanisterSettings { freezing_threshold: Some(Nat::from(0u8)), ..Default::default() } }).await;
    // a frozen or broken notebook cannot pay out; deleting it still has to work
    // a notebook that answers but cannot pay out stops the deletion, so no cycles are burnt by surprise
    let moved = match Call::unbounded_wait(canister, "drain_cycles").with_arg(to).await {
        Ok(r) => match r.candid::<Result<Nat, NotebookErr>>() {
            Ok(Ok(n)) => n,
            Ok(Err(e)) => return Err(format!("could not move the cycles out, so nothing was deleted: {e:?}")),
            Err(e) => return Err(format!("could not move the cycles out, so nothing was deleted: {e}")),
        },
        Err(_) => Nat::from(0u8),
    };
    mgmt::stop_canister(&mgmt::StopCanisterArgs { canister_id: canister }).await.map_err(|e| format!("stop_canister: {e:?}"))?;
    mgmt::delete_canister(&mgmt::DeleteCanisterArgs { canister_id: canister }).await.map_err(|e| format!("delete_canister: {e:?}"))?;
    NOTEBOOKS.with_borrow_mut(|m| m.remove(&canister));
    ATTESTATIONS.with_borrow_mut(|m| m.remove(&canister));
    if let Some(id) = ID_OF.with_borrow_mut(|m| m.remove(&canister)) {
        TOKEN_IDS.with_borrow_mut(|m| m.remove(&id));
    }
    Ok(moved)
}

/// Upgrade every notebook to the wasm embedded in this registry (controller only).
#[update]
async fn upgrade_notebooks() -> Result<u32, String> {
    if !is_controller(&msg_caller()) {
        return Err("controller only".into());
    }
    let ids: Vec<Principal> = NOTEBOOKS.with_borrow(|m| m.iter().map(|e| *e.key()).collect());
    let mut n = 0;
    for id in ids {
        mgmt::install_code(&mgmt::InstallCodeArgs { mode: mgmt::CanisterInstallMode::Upgrade(None), canister_id: id, wasm_module: NOTEBOOK_WASM.to_vec(), arg: vec![] })
            .await
            .map_err(|e| format!("{id}: {e:?}"))?;
        n += 1;
    }
    Ok(n)
}

#[query]
fn stats() -> Stats {
    Stats { notebooks: NOTEBOOKS.with_borrow(|m| m.len()), cycles: candid::Nat::from(ic_cdk::api::canister_cycle_balance()), cycles_per_notebook: candid::Nat::from(CYCLES_PER_NOTEBOOK), price_e8s: PRICE.with_borrow(|p| *p.get()) }
}

// ---------------------------------------------------------------- pay with anything: the token table and the three routes

/// ICPSwap's SwapFactory on mainnet (the DEX OISY routes through); it names the pool for each token pair.
const ICPSWAP_FACTORY: &str = "4mmnk-kiaaa-aaaag-qbllq-cai";
/// the standard 0.3% pool tier every ck token has against ICP
const ICPSWAP_POOL_FEE: u32 = 3000;
const ICP_LEDGER_TEXT: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";

/// The mainnet tokens we take by default; admins can add or change any of them.
fn seed_tokens() {
    if TOKENS.with_borrow(|t| t.len()) > 0 {
        return;
    }
    let seed = [
        ("ICP", "ryjl3-tyaaa-aaaaa-aaaba-cai", 8u8, 10_000u128, Route::Icp),
        ("TCYCLES", "um5iw-rqaaa-aaaaq-qaaba-cai", 12, 100_000_000, Route::Cycles),
        ("ckBTC", "mxzaz-hqaaa-aaaar-qaada-cai", 8, 10, Route::Swap),
        ("ckETH", "ss2fx-dyaaa-aaaar-qacoq-cai", 18, 2_000_000_000_000, Route::Swap),
        ("ckUSDC", "xevnm-gaaaa-aaaar-qafnq-cai", 6, 10_000, Route::Swap),
        ("ckUSDT", "cngnf-vqaaa-aaaar-qag4q-cai", 6, 10_000, Route::Swap),
    ];
    TOKENS.with_borrow_mut(|t| {
        for (sym, ledger, dec, fee, route) in seed {
            t.insert(sym.to_string(), C(Token { symbol: sym.into(), ledger: Principal::from_text(ledger).unwrap(), decimals: dec, fee: Nat::from(fee), route }));
        }
    });
}

#[query]
fn tokens() -> Vec<Token> {
    TOKENS.with_borrow(|t| t.iter().map(|e| e.value().0).collect())
}

/// Add or change an accepted token (admin or controller).
#[update]
fn set_token(t: Token) -> Result<(), String> {
    if !admin(&msg_caller()) && !is_controller(&msg_caller()) {
        return Err("admin only".into());
    }
    if t.symbol.trim().is_empty() || t.symbol.len() > 16 {
        return Err("symbol must be 1-16 chars".into());
    }
    TOKENS.with_borrow_mut(|m| m.insert(t.symbol.clone(), C(t)));
    Ok(())
}

#[update]
fn remove_token(symbol: String) -> Result<(), String> {
    if !admin(&msg_caller()) && !is_controller(&msg_caller()) {
        return Err("admin only".into());
    }
    if symbol == "ICP" {
        return Err("ICP stays".into());
    }
    TOKENS.with_borrow_mut(|m| m.remove(&symbol)).map(|_| ()).ok_or("unknown token".into())
}

fn token(symbol: &str) -> Result<Token, String> {
    TOKENS.with_borrow(|t| t.get(&symbol.to_string()).map(|c| c.0)).ok_or_else(|| format!("unknown token {symbol}; see tokens()"))
}

/// Pull `amount` of `tok` from `payer`'s ICRC-2 allowance into the registry's account on that ledger.
async fn pull(tok: &Token, payer: Principal, amount: &Nat) -> Result<Nat, String> {
    let tf = TransferFromArgs {
        spender_subaccount: spender_sub(payer),
        from: Account { owner: payer, subaccount: None },
        to: Account { owner: canister_self(), subaccount: None },
        amount: amount.clone(),
        fee: Some(tok.fee.clone()),
        memo: None,
        created_at_time: Some(time()),
    };
    let r: Result<Nat, TransferFromError> = Call::unbounded_wait(tok.ledger, "icrc2_transfer_from").with_arg(&tf).await.map_err(|e| format!("{} ledger: {e}", tok.symbol))?.candid().map_err(|e| e.to_string())?;
    r.map_err(|e| format!("{} payment refused: {e:?}. Approve the amount plus one fee for the registry first.", tok.symbol))
}

/// Send `amount` of `tok` from the registry's account to `to`.
async fn send(tok: &Token, to: Principal, amount: &Nat) -> Result<Nat, String> {
    let arg = icrc_ledger_types::icrc1::transfer::TransferArg { from_subaccount: None, to: Account { owner: to, subaccount: None }, fee: Some(tok.fee.clone()), created_at_time: None, memo: None, amount: amount.clone() };
    let r: Result<Nat, icrc_ledger_types::icrc1::transfer::TransferError> = Call::unbounded_wait(tok.ledger, "icrc1_transfer").with_arg(&arg).await.map_err(|e| format!("{} ledger: {e}", tok.symbol))?.candid().map_err(|e| e.to_string())?;
    r.map_err(|e| format!("{} transfer failed: {e:?}", tok.symbol))
}

#[derive(CandidType, Deserialize)]
struct WithdrawFromArgs {
    spender_subaccount: Option<Vec<u8>>,
    from: Account,
    to: Principal,
    amount: Nat,
    created_at_time: Option<u64>,
}

// ICPSwap types (SwapFactory.getPool, SwapPool.quote / depositFromAndSwap / getUserUnusedBalance / withdraw)
#[derive(CandidType, Deserialize, Clone)]
struct IsToken {
    address: String,
    standard: String,
}
#[derive(CandidType, Deserialize)]
struct GetPoolArgs {
    fee: Nat,
    token0: IsToken,
    token1: IsToken,
}
#[derive(CandidType, Deserialize)]
struct PoolData {
    #[serde(rename = "canisterId")]
    canister_id: Principal,
    token0: IsToken,
    token1: IsToken,
}
#[derive(CandidType, Deserialize, Debug)]
enum IsError {
    CommonError,
    InsufficientFunds,
    InternalError(String),
    UnsupportedToken(String),
}
#[derive(CandidType, Deserialize)]
enum IsResult<T> {
    #[serde(rename = "ok")]
    Ok(T),
    #[serde(rename = "err")]
    Err(IsError),
}
#[derive(CandidType, Deserialize)]
struct QuoteArgs {
    #[serde(rename = "amountIn")]
    amount_in: String,
    #[serde(rename = "amountOutMinimum")]
    amount_out_minimum: String,
    #[serde(rename = "zeroForOne")]
    zero_for_one: bool,
}
#[derive(CandidType, Deserialize)]
struct DepositAndSwapArgs {
    #[serde(rename = "amountIn")]
    amount_in: String,
    #[serde(rename = "amountOutMinimum")]
    amount_out_minimum: String,
    #[serde(rename = "tokenInFee")]
    token_in_fee: Nat,
    #[serde(rename = "tokenOutFee")]
    token_out_fee: Nat,
    #[serde(rename = "zeroForOne")]
    zero_for_one: bool,
}
#[derive(CandidType, Deserialize)]
struct Unused {
    balance0: Nat,
    balance1: Nat,
}
#[derive(CandidType, Deserialize)]
struct WithdrawArgs {
    amount: Nat,
    fee: Nat,
    token: String,
}

/// Swap `amount` of `tok` (already on the registry's account) for ICP on ICPSwap; returns the e8s received.
async fn swap_on_icpswap(tok: &Token, amount: Nat) -> Result<u64, String> {
    let me = canister_self();
    let factory = Principal::from_text(ICPSWAP_FACTORY).unwrap();
    let args = GetPoolArgs { fee: Nat::from(ICPSWAP_POOL_FEE), token0: IsToken { address: tok.ledger.to_text(), standard: "ICRC2".into() }, token1: IsToken { address: ICP_LEDGER_TEXT.into(), standard: "ICRC2".into() } };
    let pool: IsResult<PoolData> = Call::unbounded_wait(factory, "getPool").with_arg(&args).await.map_err(|e| format!("ICPSwap factory: {e}"))?.candid().map_err(|e| e.to_string())?;
    let pool = match pool { IsResult::Ok(p) => p, IsResult::Err(e) => return Err(format!("no ICPSwap pool for {}/ICP: {e:?}", tok.symbol)) };
    let zero_for_one = pool.token0.address == tok.ledger.to_text();
    // the pool pulls the deposit itself (ICRC-2), so it needs an allowance from the registry
    let ap = icrc_ledger_types::icrc2::approve::ApproveArgs { from_subaccount: None, spender: Account { owner: pool.canister_id, subaccount: None }, amount: amount.clone(), expected_allowance: None, expires_at: None, fee: Some(tok.fee.clone()), memo: None, created_at_time: None };
    let a: Result<Nat, icrc_ledger_types::icrc2::approve::ApproveError> = Call::unbounded_wait(tok.ledger, "icrc2_approve").with_arg(&ap).await.map_err(|e| format!("{} ledger: {e}", tok.symbol))?.candid().map_err(|e| e.to_string())?;
    a.map_err(|e| format!("approve for the swap failed: {e:?}"))?;
    let amount_in = amount.clone() - tok.fee.clone() * 2u8;
    let q: IsResult<Nat> = Call::unbounded_wait(pool.canister_id, "quote").with_arg(&QuoteArgs { amount_in: amount_in.to_string().replace('_', ""), amount_out_minimum: "0".into(), zero_for_one }).await.map_err(|e| format!("ICPSwap quote: {e}"))?.candid().map_err(|e| e.to_string())?;
    let expected = match q { IsResult::Ok(n) => n, IsResult::Err(e) => return Err(format!("ICPSwap quote failed: {e:?}")) };
    let minimum = expected * 98u8 / 100u8; // 2% slippage cap
    let sw = DepositAndSwapArgs { amount_in: amount_in.to_string().replace('_', ""), amount_out_minimum: minimum.to_string().replace('_', ""), token_in_fee: tok.fee.clone(), token_out_fee: Nat::from(ICP_FEE), zero_for_one };
    let r: IsResult<Nat> = Call::unbounded_wait(pool.canister_id, "depositFromAndSwap").with_arg(&sw).await.map_err(|e| format!("ICPSwap swap: {e}"))?.candid().map_err(|e| e.to_string())?;
    let out = match r { IsResult::Ok(n) => n, IsResult::Err(e) => return Err(format!("ICPSwap swap failed: {e:?}")) };
    // whatever ICP the pool still holds for us comes out to the registry's account
    let u: IsResult<Unused> = Call::unbounded_wait(pool.canister_id, "getUserUnusedBalance").with_arg(me).await.map_err(|e| format!("ICPSwap balance: {e}"))?.candid().map_err(|e| e.to_string())?;
    if let IsResult::Ok(b) = u {
        let icp_left = if zero_for_one { b.balance1 } else { b.balance0 };
        if icp_left > Nat::from(ICP_FEE) {
            let w: IsResult<Nat> = Call::unbounded_wait(pool.canister_id, "withdraw").with_arg(&WithdrawArgs { amount: icp_left, fee: Nat::from(ICP_FEE), token: ICP_LEDGER_TEXT.into() }).await.map_err(|e| format!("ICPSwap withdraw: {e}"))?.candid().map_err(|e| e.to_string())?;
            if let IsResult::Err(e) = w { return Err(format!("ICPSwap withdraw failed: {e:?}")) }
        }
    }
    let e8s: u64 = out.0.try_into().map_err(|_| "swap result too large")?;
    Ok(e8s.saturating_sub(ICP_FEE))
}

/// Pay for a notebook's cycles with any accepted token. `amount` is in the token's smallest unit and
/// is pulled from `payer`'s ICRC-2 allowance for the registry (the caller when empty; an OISY wallet
/// otherwise). ICP goes to the minting canister, TCYCLES is withdrawn straight into the notebook,
/// and every other token is swapped for ICP on ICPSwap first. Returns the cycles that reached the notebook.
#[update]
async fn pay(canister: Principal, symbol: String, amount: Nat, payer: Option<Principal>) -> Result<Nat, String> {
    let caller = msg_caller();
    owns(caller, canister)?;
    let payer = payer.unwrap_or(caller);
    if payer == Principal::anonymous() {
        return Err("payer must be a real principal".into());
    }
    let tok = token(&symbol)?;
    if amount <= tok.fee.clone() * 2u8 {
        return Err(format!("amount must be more than two {} fees", tok.symbol));
    }
    match tok.route {
        Route::Icp => {
            let e8s: u64 = amount.0.try_into().map_err(|_| "amount too large")?;
            top_up_icp(canister, e8s, payer).await
        }
        Route::Cycles => {
            let arg = WithdrawFromArgs { spender_subaccount: spender_sub(payer).map(|s| s.to_vec()), from: Account { owner: payer, subaccount: None }, to: canister, amount: amount.clone(), created_at_time: Some(time()) };
            let r: Result<Nat, candid::Reserved> = Call::unbounded_wait(tok.ledger, "withdraw_from").with_arg(&arg).await.map_err(|e| format!("cycles ledger: {e}"))?.candid().map_err(|e| e.to_string())?;
            r.map_err(|_| "cycles ledger refused the withdrawal: approve the amount plus one fee for the registry first".to_string())?;
            Ok(amount)
        }
        Route::Swap => {
            pull(&tok, payer, &amount).await?;
            let e8s = swap_on_icpswap(&tok, amount).await?;
            mint_for(canister, e8s).await
        }
    }
}

/// A notebook hands over ck tokens that landed on its account (it approved the registry first):
/// swapped for ICP on ICPSwap and minted into that notebook. Notebooks only.
#[update]
async fn convert_deposit(symbol: String, amount: Nat) -> Result<Nat, String> {
    let nb = msg_caller();
    if notebook(nb).is_none() {
        return Err("notebooks only".into());
    }
    let tok = token(&symbol)?;
    if tok.route != Route::Swap {
        return Err(format!("{} does not need converting here", tok.symbol));
    }
    pull(&tok, nb, &amount).await?;
    let e8s = swap_on_icpswap(&tok, amount).await?;
    mint_for(nb, e8s).await
}

/// The registry keeps no tokens either: market fees in ck tokens or TCYCLES become its own cycles hourly.
#[update]
async fn sweep_holdings() -> Result<String, String> {
    let caller = msg_caller();
    if caller != canister_self() && !is_controller(&caller) {
        return Err("controller only".into());
    }
    let me = canister_self();
    let mut lines = vec![];
    for tok in tokens().into_iter().filter(|t| t.route != Route::Icp) {
        let bal: Nat = match Call::unbounded_wait(tok.ledger, "icrc1_balance_of").with_arg(&Account { owner: me, subaccount: None }).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string())) {
            Ok(b) => b,
            Err(_) => continue,
        };
        if bal <= tok.fee.clone() * 4u8 {
            continue;
        }
        let r = match tok.route {
            Route::Cycles => {
                let amount = bal - tok.fee.clone();
                let w: Result<Result<Nat, candid::Reserved>, String> = Call::unbounded_wait(tok.ledger, "withdraw").with_arg(&CyclesWithdraw { amount: amount.clone(), from_subaccount: None, to: me, created_at_time: None }).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string()));
                match w { Ok(Ok(_)) => Ok(format!("{amount} -> cycles")), Ok(Err(_)) => Err("withdraw refused".to_string()), Err(e) => Err(e) }
            }
            _ => match swap_on_icpswap(&tok, bal - tok.fee.clone()).await {
                Ok(e8s) => mint_for(me, e8s).await.map(|c| format!("-> {c} cycles")),
                Err(e) => Err(e),
            },
        };
        lines.push(match r { Ok(m) => format!("{}: {m}", tok.symbol), Err(e) => format!("{}: {e}", tok.symbol) });
    }
    Ok(if lines.is_empty() { "nothing to convert".into() } else { lines.join("; ") })
}

#[derive(CandidType, Deserialize)]
struct CyclesWithdraw {
    amount: Nat,
    from_subaccount: Option<Vec<u8>>,
    to: Principal,
    created_at_time: Option<u64>,
}

/// ICP already on the registry's account -> the minting canister -> the notebook's cycles.
async fn mint_for(canister: Principal, e8s: u64) -> Result<Nat, String> {
    if e8s <= ICP_FEE * 2 {
        return Err("too little ICP to mint".into());
    }
    let args = TransferArgs { memo: MEMO_TOP_UP_CANISTER, amount: Tokens::from_e8s(e8s - ICP_FEE), fee: DEFAULT_FEE, from_subaccount: Some(DEFAULT_SUBACCOUNT), to: AccountIdentifier::new(&CMC, &cmc_subaccount(canister)), created_at_time: None };
    let r: TransferResult = Call::unbounded_wait(LEDGER, "transfer").with_arg(&args).await.map_err(|e| e.to_string())?.candid().map_err(|e| e.to_string())?;
    let block_index = r.map_err(|e| e.to_string())?;
    PENDING.with_borrow_mut(|p| p.insert(block_index, canister));
    notify(block_index, canister).await.ok_or_else(|| format!("the ICP reached the minting canister (block {block_index}); minting is retried every hour"))
}

// ---------------------------------------------------------------- freezing: health, reviving a frozen notebook

/// Cycles, burn rate and freeze state of a notebook you own. Works while the notebook is frozen,
/// because it asks the management canister rather than the notebook.
#[update]
async fn notebook_status(canister: Principal) -> Result<Health, String> {
    owns(msg_caller(), canister)?;
    let st = mgmt::canister_status(&mgmt::CanisterStatusArgs { canister_id: canister }).await.map_err(|e| format!("canister_status: {e:?}"))?;
    let cycles: u128 = st.cycles.0.clone().try_into().unwrap_or(u128::MAX);
    let burn: u128 = st.idle_cycles_burned_per_day.0.clone().try_into().unwrap_or(0);
    let secs: u64 = st.settings.freezing_threshold.0.clone().try_into().unwrap_or(FREEZE_SECS);
    let freeze_at = burn * secs as u128 / 86_400;
    Ok(Health {
        cycles: st.cycles,
        idle_cycles_burned_per_day: st.idle_cycles_burned_per_day,
        freezing_threshold_secs: secs,
        freeze_at: Nat::from(freeze_at),
        frozen: cycles < freeze_at,
        days_left: if burn == 0 { u64::MAX } else { (cycles / burn) as u64 },
        stopped: st.status != mgmt::CanisterStatusType::Running,
    })
}

/// Give every notebook the 90-day freezing threshold (controller only; new ones get it at spawn).
#[update]
async fn apply_freeze_policy() -> Result<u32, String> {
    if !is_controller(&msg_caller()) {
        return Err("controller only".into());
    }
    let ids: Vec<Principal> = NOTEBOOKS.with_borrow(|m| m.iter().map(|e| *e.key()).collect());
    let mut n = 0;
    for id in ids {
        let settings = mgmt::CanisterSettings { freezing_threshold: Some(Nat::from(FREEZE_SECS)), ..Default::default() };
        if mgmt::update_settings(&mgmt::UpdateSettingsArgs { canister_id: id, settings }).await.is_ok() {
            n += 1;
        }
    }
    Ok(n)
}

/// Change one notebook's freezing threshold (controller only): the admin's knob for testing a freeze or granting more time.
#[update]
async fn set_freezing_threshold(canister: Principal, secs: u64) -> Result<(), String> {
    if !is_controller(&msg_caller()) {
        return Err("controller only".into());
    }
    let settings = mgmt::CanisterSettings { freezing_threshold: Some(Nat::from(secs)), ..Default::default() };
    mgmt::update_settings(&mgmt::UpdateSettingsArgs { canister_id: canister, settings }).await.map_err(|e| format!("update_settings: {e:?}"))
}

/// Top up a notebook you own through the registry, so it works while the notebook is frozen and
/// cannot take calls itself: `amount_e8s` is pulled from `payer`'s ICRC-2 allowance for the
/// registry (the caller when `payer` is empty; an OISY wallet otherwise), sent to the cycles
/// minting canister for the notebook, and minted into its cycles. Returns the cycles minted.
#[update]
async fn top_up_notebook(canister: Principal, amount_e8s: u64, payer: Option<Principal>) -> Result<Nat, String> {
    let caller = msg_caller();
    owns(caller, canister)?;
    let payer = payer.unwrap_or(caller);
    if payer == Principal::anonymous() {
        return Err("payer must be a real principal".into());
    }
    if amount_e8s < 1_000_000 {
        return Err("minimum top-up is 0.01 ICP".into());
    }
    top_up_icp(canister, amount_e8s, payer).await
}

async fn top_up_icp(canister: Principal, amount_e8s: u64, payer: Principal) -> Result<Nat, String> {
    charge(payer, amount_e8s).await?;
    mint_for(canister, amount_e8s).await
}

/// `notify_top_up` for one pending block; `Some(cycles)` settles it, `None` keeps it pending.
async fn notify(block_index: u64, canister: Principal) -> Option<Nat> {
    let res: Result<Result<Nat, candid::Reserved>, String> = match Call::unbounded_wait(CMC, "notify_top_up").with_arg(&NotifyTopUp { block_index, canister_id: canister }).await {
        Ok(resp) => resp.candid().map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    };
    match res {
        Ok(Ok(cycles)) => {
            PENDING.with_borrow_mut(|p| p.remove(&block_index));
            Some(cycles)
        }
        // ponytail: a refund (Refunded) also stays pending and is retried; the CMC answers the same way each time, harmless
        _ => None,
    }
}

async fn retry_pending() {
    let pending: Vec<(u64, Principal)> = PENDING.with_borrow(|p| p.iter().map(|e| (*e.key(), e.value())).collect());
    for (b, c) in pending {
        notify(b, c).await;
    }
}

// ---------------------------------------------------------------- community: channels, chat and presence for people who hold ICP
//
// Posting needs a membership: `join` checks the caller's ICP balance on the ledger and marks them
// verified for a day. Channels are made by admins; anyone verified posts. Messages are keyed
// "channel#id" so a channel pages with a range scan.

const CHAT_PRESENCE_NS: u64 = 120_000_000_000; // two minutes

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Channel {
    pub name: String,
    pub topic: String,
    pub created_by: Principal,
    pub created_at: u64,
    /// `"github"`: only linked contributors to the configured repository may post.
    pub gate: Option<String>,
    /// The collapsible group it is listed under ("Lab", "Notebooks", "Build", ...); None lists it
    /// under "Channels".
    #[serde(default)]
    pub section: Option<String>,
}
/// The plans a contributor may raise for in the developers channel.
const PLANS: &[&str] = &["Claude Max", "ChatGPT Pro", "Gemini Ultra"];
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Member {
    pub principal: Principal,
    pub handle: String,
    pub joined_at: u64,
    pub verified_until: u64,
    pub balance_e8s: u64,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Message {
    pub id: u64,
    pub channel: String,
    pub author: Principal,
    pub handle: String,
    pub text: String,
    pub at: u64,
    pub reply_to: Option<u64>,
    pub deleted: bool,
    pub poll: Option<Poll>,
    pub reactions: Option<Vec<Reaction>>,
    pub gist: Option<Gist>,
    pub fund: Option<Fund>,
    /// when the author last edited the text
    pub edited: Option<u64>,
    pub pinned: Option<bool>,
    /// a board post this message points at
    pub post: Option<u64>,
}

// --- the board: reddit-style posts per topic (topics are the community channels)
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Post {
    pub id: u64,
    pub author: Principal,
    pub handle: String,
    pub topic: String,
    pub title: String,
    pub body: String,
    pub created_at: u64,
    /// the last comment (or the post itself); a post is deleted for good a week after this
    pub last_activity: u64,
    pub ups: Vec<Principal>,
    pub downs: Vec<Principal>,
    pub comments: u32,
    pub gist: Option<Gist>,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PostComment {
    pub id: u64,
    pub post: u64,
    pub author: Principal,
    pub handle: String,
    pub text: String,
    pub parent: Option<u64>,
    pub created_at: u64,
    pub ups: Vec<Principal>,
    pub downs: Vec<Principal>,
    pub deleted: bool,
}
/// Board posts are billed for 60 days of storage, chat messages for their 90-day life.
const POST_DAYS: u64 = 60;
const MESSAGE_DAYS: u64 = 90;
const POST_TTL_NS: u64 = 7 * 24 * 3600 * 1_000_000_000;
/// A note shared in chat for opinions: a snapshot of its text at the time of posting.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Gist {
    pub title: String,
    pub text: String,
    pub notebook: Principal,
    pub path: String,
}
/// A fundraiser whose only possible outcome is cycles for `canister`: every donation is ICP pulled
/// from the donor and minted straight into that notebook; the owner never holds the tokens.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Fund {
    pub canister: Principal,
    pub name: String,
    pub goal_e8s: u64,
    pub raised_e8s: u64,
    pub donors: Vec<(Principal, u64)>,
    pub closed: bool,
    /// Set for a developer plan fundraiser: donations go to the author's wallet instead of cycles.
    pub plan: Option<String>,
}
/// Single-choice poll: `votes[i]` is the index into `options` that voter i picked.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Poll {
    pub options: Vec<String>,
    pub votes: Vec<(Principal, u32)>,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Reaction {
    pub emoji: String,
    pub by: Vec<Principal>,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Online {
    pub principal: Principal,
    pub handle: String,
    pub channel: String,
}

thread_local! {
    static CHANNELS: RefCell<StableBTreeMap<String, C<Channel>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(14)))));
    static MEMBERS: RefCell<StableBTreeMap<Principal, C<Member>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(15)))));
    /// "channel#000000000000000000id" -> message
    static MESSAGES: RefCell<StableBTreeMap<String, C<Message>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(16)))));
    static NEXT_MSG: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(17))), 1));
    static CHAT_PRESENCE: RefCell<StableBTreeMap<Principal, C<(String, u64)>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(18)))));
    // memory 19 held the minimum ICP balance to chat; owning a notebook replaced it
}

fn seed_channels() {
    if CHANNELS.with_borrow(|c| c.len()) > 0 {
        return;
    }
    let me = canister_self();
    for (n, t) in [("general", "Anything goes"), ("notebooks", "Tips, templates, plugins"), ("market", "Buying and selling notebooks and decks"), ("agents", "Keys, skills, what your agents built"), ("study", "Decks, quizzes, study groups"), ("help", "Something broken? Ask here")] {
        CHANNELS.with_borrow_mut(|c| c.insert(n.into(), C(Channel { name: n.into(), topic: t.into(), created_by: me, created_at: time(), gate: None, section: None })));
    }
}
fn seed_developers() {
    if CHANNELS.with_borrow(|c| c.contains_key(&"developers".to_string())) {
        return;
    }
    CHANNELS.with_borrow_mut(|c| c.insert("developers".into(), C(Channel { name: "developers".into(), topic: "Contributors only: the code, and raising for AI plans".into(), created_by: canister_self(), created_at: time(), gate: Some("github".into()), section: None })));
}
/// The built-in channels' sections, filled in once for channels that have none yet.
const DEFAULT_SECTIONS: &[(&str, &str)] = &[("general", "Lab"), ("help", "Lab"), ("notebooks", "Notebooks"), ("study", "Notebooks"), ("agents", "Notebooks"), ("market", "Notebooks"), ("developers", "Build")];
fn seed_sections() {
    CHANNELS.with_borrow_mut(|c| {
        for (n, sec) in DEFAULT_SECTIONS {
            if let Some(mut ch) = c.get(&n.to_string()).map(|x| x.0).filter(|ch| ch.section.is_none()) {
                ch.section = Some(sec.to_string());
                c.insert(n.to_string(), C(ch));
            }
        }
    });
}
fn check_section(s: &str) -> Result<String, String> {
    let s = s.trim();
    if s.is_empty() || s.chars().count() > 24 || has_link_or_image(s) {
        return Err("section names are 1-24 characters".into());
    }
    clean(s)?;
    Ok(s.to_string())
}
/// Put a channel in a section, or with None back under "Channels" (admins).
#[update]
fn set_channel_section(name: String, section: Option<String>) -> Result<Channel, String> {
    if !admin(&msg_caller()) {
        return Err("admin only".into());
    }
    let n = check_channel(&name)?;
    let section = section.as_deref().map(check_section).transpose()?;
    CHANNELS.with_borrow_mut(|c| {
        let mut ch = c.get(&n).map(|x| x.0).ok_or("unknown channel")?;
        ch.section = section;
        c.insert(n, C(ch.clone()));
        Ok(ch)
    })
}
/// The kits' channels: #careers (résumé reviews, interview practice, job leads) for the Career kit
/// #crypto (theses and trade reviews) for the Crypto kit and #creators (drafts) for the Creator kit.
fn seed_kit_channels() {
    for (name, topic) in [("careers", "Résumés, interviews and job leads"), ("crypto", "Theses, trade reviews and what you are watching"), ("creators", "Hooks, drafts and what worked")] {
        if CHANNELS.with_borrow(|c| c.contains_key(&name.to_string())) {
            continue;
        }
        CHANNELS.with_borrow_mut(|c| c.insert(name.into(), C(Channel { name: name.into(), topic: topic.into(), created_by: canister_self(), created_at: time(), gate: None, section: Some("Lab".into()) })));
    }
}
fn gate_of(channel: &str) -> Option<String> {
    CHANNELS.with_borrow(|c| c.get(&channel.to_string()).and_then(|x| x.0.gate))
}

// --- GitHub: a contributor proves a login by putting their principal in the profile bio
thread_local! {
    static GITHUB_REPO: RefCell<ic_stable_structures::StableCell<String, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(23))), String::new()));
    static GITHUB: RefCell<StableBTreeMap<Principal, String, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(24)))));
    /// "principal#id" -> channel, for every message that @mentions that member
    static MENTIONS: RefCell<StableBTreeMap<String, String, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(25)))));
    static POSTS: RefCell<StableBTreeMap<u64, C<Post>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(26)))));
    static PCOMMENTS: RefCell<StableBTreeMap<String, C<PostComment>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(27)))));
    static NEXT_POST: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(28))), 1));
    /// feature flags: name -> on; unknown names fall back to FLAG_DEFAULTS
    static FLAGS: RefCell<StableBTreeMap<String, u8, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(29)))));
    static WATCHES: RefCell<StableBTreeMap<u64, C<Watch>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(30)))));
    /// the wallet a person pays from when it is not their sign-in principal (their OISY account)
    static WALLETS: RefCell<StableBTreeMap<Principal, Principal, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(32)))));
    static NEXT_WATCH: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(31))), 1));
    // MemoryIds 33-38 are retired (a journal that never shipped): leave them unused. 39: town.rs VISITORS; start new maps at 40
}

// --- trip check-ins: leave a plan with someone; they are alerted when a check-in or the return is missed
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Watch {
    pub id: u64,
    pub owner: Principal,
    pub owner_handle: String,
    pub contact: Principal,
    pub contact_handle: String,
    pub title: String,
    /// the read-only share link of the trip plan
    pub link: String,
    pub return_by: u64,
    /// check in at least this often while out (hours); none means only the return time counts
    pub every_hours: Option<u32>,
    pub last_check_in: Option<u64>,
    pub created_at: u64,
    pub closed: bool,
    pub overdue: bool,
}
const HOUR_NS: u64 = 3_600_000_000_000;
fn watch_overdue(w: &Watch, now: u64) -> bool {
    if w.closed {
        return false;
    }
    let since = w.last_check_in.unwrap_or(w.created_at);
    now > w.return_by || w.every_hours.map(|h| now > since + h as u64 * HOUR_NS).unwrap_or(false)
}
fn with_status(mut w: Watch) -> Watch {
    w.overdue = watch_overdue(&w, time());
    w
}
/// Leave a trip plan with a community member: they see it, and get an alert if you miss a check-in
/// or are not back by `return_by` (nanoseconds).
#[update]
fn set_watch(contact_handle: String, title: String, link: String, return_by: u64, every_hours: Option<u32>) -> Result<Watch, String> {
    let me = msg_caller();
    if me == Principal::anonymous() {
        return Err("sign in first".into());
    }
    let title = title.trim().to_string();
    if title.is_empty() || title.chars().count() > 120 || link.len() > 400 {
        return Err("title: 1-120 characters, link up to 400".into());
    }
    if return_by <= time() || return_by > time() + 120 * 24 * HOUR_NS {
        return Err("the return time must be in the next 120 days".into());
    }
    if every_hours.map(|h| !(1..=168).contains(&h)).unwrap_or(false) {
        return Err("check in every 1 to 168 hours".into());
    }
    let h = contact_handle.trim().trim_start_matches('@').to_string();
    let contact = MEMBERS.with_borrow(|m| m.iter().find(|e| e.value().0.handle.eq_ignore_ascii_case(&h)).map(|e| (*e.key(), e.value().0.handle.clone()))).ok_or("no community member has that handle; your contact needs to join the community first")?;
    if contact.0 == me {
        return Err("pick someone else as your contact".into());
    }
    if WATCHES.with_borrow(|x| x.iter().filter(|e| e.value().0.owner == me && !e.value().0.closed).count()) >= 5 {
        return Err("five open trips already; close one when you are back".into());
    }
    let owner_handle = MEMBERS.with_borrow(|m| m.get(&me).map(|c| c.0.handle)).unwrap_or_else(|| me.to_text().chars().take(11).collect());
    let id = NEXT_WATCH.with_borrow(|n| *n.get());
    NEXT_WATCH.with_borrow_mut(|n| n.set(id + 1));
    let w = Watch { id, owner: me, owner_handle, contact: contact.0, contact_handle: contact.1, title, link, return_by, every_hours, last_check_in: None, created_at: time(), closed: false, overdue: false };
    WATCHES.with_borrow_mut(|x| x.insert(id, C(w.clone())));
    Ok(w)
}
/// "I am OK": resets the check-in clock; a later `return_by` moves the deadline.
#[update]
fn check_in(id: u64, return_by: Option<u64>) -> Result<Watch, String> {
    let me = msg_caller();
    let mut w = WATCHES.with_borrow(|x| x.get(&id).map(|c| c.0)).ok_or("unknown trip")?;
    if w.owner != me {
        return Err("not your trip".into());
    }
    if w.closed {
        return Err("this trip is closed".into());
    }
    w.last_check_in = Some(time());
    if let Some(r) = return_by {
        if r > time() && r <= time() + 120 * 24 * HOUR_NS {
            w.return_by = r;
        }
    }
    WATCHES.with_borrow_mut(|x| x.insert(id, C(w.clone())));
    Ok(with_status(w))
}
/// Back home: the contact stops watching.
#[update]
fn close_watch(id: u64) -> Result<Watch, String> {
    let me = msg_caller();
    let mut w = WATCHES.with_borrow(|x| x.get(&id).map(|c| c.0)).ok_or("unknown trip")?;
    if w.owner != me && w.contact != me {
        return Err("not your trip".into());
    }
    w.closed = true;
    w.last_check_in = Some(time());
    WATCHES.with_borrow_mut(|x| x.insert(id, C(w.clone())));
    Ok(with_status(w))
}
/// My trips, newest first.
#[query]
fn my_watches() -> Vec<Watch> {
    let me = msg_caller();
    let mut v: Vec<Watch> = WATCHES.with_borrow(|x| x.iter().map(|e| e.value().0).filter(|w| w.owner == me).map(with_status).collect());
    v.reverse();
    v
}
/// Trips people left with me, open ones first; `overdue` says whether to raise the alarm.
#[query]
fn watching() -> Vec<Watch> {
    let me = msg_caller();
    let mut v: Vec<Watch> = WATCHES.with_borrow(|x| x.iter().map(|e| e.value().0).filter(|w| w.contact == me && (!w.closed || time() < w.return_by + 7 * 24 * HOUR_NS)).map(with_status).collect());
    v.sort_by_key(|w| (w.closed, std::cmp::Reverse(w.overdue), w.return_by));
    v
}
/// Every flag the app knows, with its default. The market is off until it has been exercised on mainnet.
const FLAG_DEFAULTS: &[(&str, bool, &str)] = &[
    ("market", false, "Notebook market: list, buy and rate notebooks"),
    ("board", true, "The board: posts, votes and comments"),
    ("rain", true, "Rain: send ICP to random recent chatters"),
    ("fundraisers", true, "Fundraisers in chat: notebook cycles and AI plans"),
    ("town", true, "The town: Lab's activity as a small living town, on the landing page and at #/town"),
];
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Flag {
    pub name: String,
    pub on: bool,
    pub default: bool,
    pub description: String,
}
fn flag_on(name: &str) -> bool {
    FLAGS.with_borrow(|f| f.get(&name.to_string()).map(|v| v == 1)).unwrap_or_else(|| FLAG_DEFAULTS.iter().find(|(n, _, _)| *n == name).map(|(_, d, _)| *d).unwrap_or(false))
}
fn require_flag(name: &str) -> Result<(), String> {
    if flag_on(name) { Ok(()) } else { Err(format!("the {name} feature is switched off right now")) }
}
#[query]
fn flags() -> Vec<Flag> {
    FLAG_DEFAULTS.iter().map(|(n, d, desc)| Flag { name: n.to_string(), on: flag_on(n), default: *d, description: desc.to_string() }).collect()
}
/// Admin: switch a feature on or off for everyone.
#[update]
fn set_flag(name: String, on: bool) -> Result<Flag, String> {
    if !admin(&msg_caller()) {
        return Err("admin only".into());
    }
    let (n, d, desc) = FLAG_DEFAULTS.iter().find(|(n, _, _)| *n == name).ok_or("unknown flag")?;
    FLAGS.with_borrow_mut(|f| f.insert(n.to_string(), if on { 1 } else { 0 }));
    if *n == "town" && on {
        ic_cdk_timers::set_timer(Duration::ZERO, town::refresh_town());
    }
    Ok(Flag { name: n.to_string(), on, default: *d, description: desc.to_string() })
}
fn pc_key(post: u64, id: u64) -> String {
    format!("{post:020}#{id:020}")
}
/// Cycles a board post of `bytes` costs (title, text and any attached note).
#[query]
fn post_cycles(bytes: u64) -> u64 {
    post_cost(bytes, POST_DAYS)
}
/// A new post in a topic (a community channel). One of the author's notebooks pays what it costs.
#[update]
async fn create_post(topic: String, title: String, body: String, gist: Option<Gist>) -> Result<Post, String> {
    require_flag("board")?;
    let me = msg_caller();
    let m = member_ok(me)?;
    let t = check_channel(&topic)?;
    if !CHANNELS.with_borrow(|c| c.contains_key(&t)) {
        return Err("unknown topic".into());
    }
    if gate_of(&t).as_deref() == Some("github") && GITHUB.with_borrow(|g| !g.contains_key(&me)) {
        return Err(format!("#{t} is for contributors; link your GitHub first"));
    }
    let title = title.trim().to_string();
    let body = body.trim().to_string();
    if title.is_empty() || title.chars().count() > 160 {
        return Err("title: 1-160 characters".into());
    }
    if body.chars().count() > 10_000 {
        return Err("body: up to 10000 characters".into());
    }
    clean(&title)?;
    clean(&body)?;
    if let Some(g) = &gist {
        if g.title.chars().count() > 120 || g.text.chars().count() > 8000 || foul(&g.text).is_some() || foul(&g.title).is_some() {
            return Err("the attached note is too long or not clean".into());
        }
    }
    bill_notebook(me, post_cost((title.len() + body.len() + gist.as_ref().map_or(0, |g| g.title.len() + g.text.len())) as u64, POST_DAYS)).await?;
    let id = NEXT_POST.with_borrow(|n| *n.get());
    NEXT_POST.with_borrow_mut(|n| n.set(id + 1));
    let p = Post { id, author: me, handle: m.handle, topic: t, title, body, created_at: time(), last_activity: time(), ups: vec![me], downs: vec![], comments: 0, gist };
    POSTS.with_borrow_mut(|x| x.insert(id, C(p.clone())));
    Ok(p)
}
/// Posts, newest first; `topic` filters, at most 200.
#[query]
fn posts(topic: Option<String>) -> Vec<Post> {
    let t = topic.map(|x| x.trim().to_lowercase()).filter(|x| !x.is_empty());
    let mut v: Vec<Post> = POSTS.with_borrow(|x| x.iter().rev().map(|e| e.value().0).filter(|p| t.as_ref().map(|t| &p.topic == t).unwrap_or(true)).take(200).collect());
    v.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    v
}
#[query]
fn get_post(id: u64) -> Option<Post> {
    POSTS.with_borrow(|x| x.get(&id).map(|c| c.0))
}
#[query]
fn post_comments(post: u64) -> Vec<PostComment> {
    let prefix = format!("{post:020}#");
    PCOMMENTS.with_borrow(|x| x.range(prefix.clone()..).take_while(|e| e.key().starts_with(&prefix)).map(|e| e.value().0).collect())
}
#[update]
fn comment_post(post: u64, parent: Option<u64>, text: String) -> Result<PostComment, String> {
    let me = msg_caller();
    let m = member_ok(me)?;
    let mut p = POSTS.with_borrow(|x| x.get(&post).map(|c| c.0)).ok_or("that post is gone")?;
    let text = text.trim().to_string();
    if text.is_empty() || text.chars().count() > 4000 {
        return Err("comment: 1-4000 characters".into());
    }
    clean(&text)?;
    if let Some(pa) = parent {
        if PCOMMENTS.with_borrow(|x| x.get(&pc_key(post, pa))).is_none() {
            return Err("reply target is not on this post".into());
        }
    }
    let id = NEXT_MSG.with_borrow(|n| *n.get());
    NEXT_MSG.with_borrow_mut(|n| n.set(id + 1));
    let c = PostComment { id, post, author: me, handle: m.handle, text, parent, created_at: time(), ups: vec![me], downs: vec![], deleted: false };
    PCOMMENTS.with_borrow_mut(|x| x.insert(pc_key(post, id), C(c.clone())));
    p.comments += 1;
    p.last_activity = time();
    POSTS.with_borrow_mut(|x| x.insert(post, C(p)));
    Ok(c)
}
fn apply_vote(ups: &mut Vec<Principal>, downs: &mut Vec<Principal>, me: Principal, dir: i8) {
    ups.retain(|p| *p != me);
    downs.retain(|p| *p != me);
    if dir > 0 { ups.push(me); } else if dir < 0 { downs.push(me); }
}
/// `dir` is 1, -1 or 0 to clear. One vote per member, changeable.
#[update]
fn vote_post(id: u64, dir: i8) -> Result<Post, String> {
    let me = msg_caller();
    member_ok(me)?;
    let mut p = POSTS.with_borrow(|x| x.get(&id).map(|c| c.0)).ok_or("that post is gone")?;
    apply_vote(&mut p.ups, &mut p.downs, me, dir);
    POSTS.with_borrow_mut(|x| x.insert(id, C(p.clone())));
    Ok(p)
}
#[update]
fn vote_comment(post: u64, id: u64, dir: i8) -> Result<PostComment, String> {
    let me = msg_caller();
    member_ok(me)?;
    let key = pc_key(post, id);
    let mut c = PCOMMENTS.with_borrow(|x| x.get(&key).map(|c| c.0)).ok_or("unknown comment")?;
    apply_vote(&mut c.ups, &mut c.downs, me, dir);
    PCOMMENTS.with_borrow_mut(|x| x.insert(key, C(c.clone())));
    Ok(c)
}
fn purge_post(id: u64) {
    let prefix = format!("{id:020}#");
    let keys: Vec<String> = PCOMMENTS.with_borrow(|x| x.range(prefix.clone()..).take_while(|e| e.key().starts_with(&prefix)).map(|e| e.key().clone()).collect());
    PCOMMENTS.with_borrow_mut(|x| for k in keys { x.remove(&k); });
    POSTS.with_borrow_mut(|x| x.remove(&id));
}
/// The author or an admin removes a post and its comments for good.
#[update]
fn delete_post(id: u64) -> Result<(), String> {
    let me = msg_caller();
    let p = POSTS.with_borrow(|x| x.get(&id).map(|c| c.0)).ok_or("that post is gone")?;
    if p.author != me && !admin(&me) {
        return Err("not your post".into());
    }
    purge_post(id);
    Ok(())
}
#[update]
fn delete_post_comment(post: u64, id: u64) -> Result<(), String> {
    let me = msg_caller();
    let key = pc_key(post, id);
    let mut c = PCOMMENTS.with_borrow(|x| x.get(&key).map(|c| c.0)).ok_or("unknown comment")?;
    if c.author != me && !admin(&me) {
        return Err("not your comment".into());
    }
    c.deleted = true;
    c.text = String::new();
    PCOMMENTS.with_borrow_mut(|x| x.insert(key, C(c)));
    Ok(())
}
/// Chat messages older than 90 days are removed for good (pinned ones stay); their mention
/// records go with them.
const MESSAGE_TTL_NS: u64 = 90 * 24 * 3600 * 1_000_000_000;
#[query]
fn message_ttl_days() -> u64 {
    90
}
fn expire_messages() {
    let cutoff = time().saturating_sub(MESSAGE_TTL_NS);
    let dead: Vec<String> = MESSAGES.with_borrow(|x| x.iter().filter(|e| { let m = &e.value().0; m.at < cutoff && m.pinned != Some(true) }).map(|e| e.key().clone()).collect());
    if dead.is_empty() {
        return;
    }
    MESSAGES.with_borrow_mut(|x| for k in &dead { x.remove(k); });
    let gone: Vec<String> = MENTIONS.with_borrow(|x| x.iter().filter(|e| { let (p, id) = e.key().split_once('#').unwrap_or(("", "0")); let id: u64 = id.parse().unwrap_or(0); !p.is_empty() && MESSAGES.with_borrow(|m| m.get(&msg_key(&e.value(), id)).is_none()) }).map(|e| e.key().clone()).collect());
    MENTIONS.with_borrow_mut(|x| for k in gone { x.remove(&k); });
}
/// Posts quiet for a week (since the last comment) are deleted permanently, comments included.
fn expire_posts() {
    let cutoff = time().saturating_sub(POST_TTL_NS);
    let dead: Vec<u64> = POSTS.with_borrow(|x| x.iter().filter(|e| e.value().0.last_activity < cutoff).map(|e| *e.key()).collect());
    for id in dead { purge_post(id); }
}
/// Drop a post into a channel: a message that links to it.
#[update]
async fn share_post(channel: String, id: u64) -> Result<Message, String> {
    let p = POSTS.with_borrow(|x| x.get(&id).map(|c| c.0)).ok_or("that post is gone")?;
    charge_message(p.title.len() + 8).await?;
    let mut m = post_inner(channel, format!("📰 {}", p.title), None, None, None, None)?;
    m.post = Some(id);
    MESSAGES.with_borrow_mut(|x| x.insert(msg_key(&m.channel, m.id), C(m.clone())));
    Ok(m)
}
/// Record who a message mentions (`@handle`, case-insensitive, not the author).
fn record_mentions(msg: &Message) {
    let mut handles: Vec<String> = vec![];
    for tok in msg.text.split(|c: char| c.is_whitespace() || "()[]{},;:!?\"'".contains(c)) {
        if let Some(h) = tok.strip_prefix('@') {
            let h = h.trim_end_matches('.').to_lowercase();
            if !h.is_empty() && !handles.contains(&h) { handles.push(h); }
        }
    }
    if handles.is_empty() { return; }
    let targets: Vec<Principal> = MEMBERS.with_borrow(|m| m.iter().filter(|e| handles.contains(&e.value().0.handle.to_lowercase()) && *e.key() != msg.author).map(|e| *e.key()).collect());
    MENTIONS.with_borrow_mut(|x| for p in targets { x.insert(format!("{}#{:020}", p.to_text(), msg.id), msg.channel.clone()); });
}
/// Messages that mention the caller with an id above `after`, oldest first, at most 50.
#[query]
fn my_mentions(after: u64) -> Vec<Message> {
    let me = msg_caller().to_text();
    let prefix = format!("{me}#");
    let keys: Vec<(u64, String)> = MENTIONS.with_borrow(|x| x.range(format!("{me}#{:020}", after.saturating_add(1))..).take_while(|e| e.key().starts_with(&prefix)).take(50).map(|e| (e.key()[prefix.len()..].parse().unwrap_or(0), e.value())).collect());
    MESSAGES.with_borrow(|m| keys.iter().filter_map(|(id, ch)| m.get(&msg_key(ch, *id)).map(|c| c.0)).filter(|m| !m.deleted).collect())
}
/// Admin: the `owner/name` repository whose contributors may use the developers channel.
#[update]
fn set_github_repo(repo: String) -> Result<(), String> {
    if !admin(&msg_caller()) {
        return Err("admin only".into());
    }
    let repo = repo.trim().trim_start_matches("https://github.com/").trim_end_matches('/').to_string();
    if repo.split('/').count() != 2 || !repo.chars().all(|c| c.is_ascii_alphanumeric() || "-_./".contains(c)) {
        return Err("repository is owner/name".into());
    }
    GITHUB_REPO.with_borrow_mut(|r| r.set(repo));
    Ok(())
}
#[query]
fn github_repo() -> String {
    GITHUB_REPO.with_borrow(|r| r.get().clone())
}
#[query]
fn my_github() -> Option<String> {
    GITHUB.with_borrow(|g| g.get(&msg_caller()))
}
/// Strips headers so every replica sees the same response.
#[query]
fn transform_github(args: mgmt::TransformArgs) -> mgmt::HttpRequestResult {
    mgmt::HttpRequestResult { status: args.response.status, headers: vec![], body: args.response.body }
}
async fn github_get(path: &str) -> Result<serde_json::Value, String> {
    let r = mgmt::HttpRequest::new(format!("https://api.github.com/{path}"))
        .with_max_response_bytes(64_000)
        .with_header("User-Agent", "notebooks-registry")
        .with_header("Accept", "application/vnd.github+json")
        .with_transform(mgmt::transform_context_from_query("transform_github".into(), vec![]))
        .send()
        .await
        .map_err(|e| format!("GitHub could not be reached: {e}"))?;
    let status = r.status.0.to_string();
    if status == "404" {
        return Err("not found on GitHub".into());
    }
    if status != "200" {
        return Err(format!("GitHub answered {status}; try again in a minute"));
    }
    serde_json::from_slice(&r.body).map_err(|e| format!("GitHub sent something unexpected: {e}"))
}
/// Link a GitHub login to the caller: the login's public bio must contain the caller's principal,
/// and the login must be a contributor to the configured repository.
#[update]
async fn link_github(login: String) -> Result<String, String> {
    let me = msg_caller();
    member_ok(me)?;
    let login = login.trim().trim_start_matches('@').to_string();
    if login.is_empty() || login.len() > 39 || !login.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("that is not a GitHub login".into());
    }
    let repo = github_repo();
    if repo.is_empty() {
        return Err("an admin has not set the repository yet".into());
    }
    let user = github_get(&format!("users/{login}")).await.map_err(|e| if e.contains("not found") { format!("GitHub has no user @{login}") } else { e })?;
    let bio = user.get("bio").and_then(|b| b.as_str()).unwrap_or("");
    if !bio.contains(&me.to_text()) {
        return Err(format!("put your principal {} in the bio of github.com/{login}, then try again", me.to_text()));
    }
    let contributors = github_get(&format!("repos/{repo}/contributors?per_page=100")).await?;
    let is_contributor = contributors.as_array().map(|a| a.iter().any(|c| c.get("login").and_then(|l| l.as_str()).map(|l| l.eq_ignore_ascii_case(&login)).unwrap_or(false))).unwrap_or(false);
    if !is_contributor {
        return Err(format!("@{login} is not among the first 100 contributors to {repo}"));
    }
    GITHUB.with_borrow_mut(|g| g.insert(me, login.clone()));
    Ok(login)
}
/// Start a fundraiser for an AI plan: developers channel, linked contributors only; donations go
/// to the contributor's wallet.
#[update]
async fn post_plan_fund(channel: String, text: String, plan: String, goal_e8s: u64) -> Result<Message, String> {
    require_flag("fundraisers")?;
    let me = msg_caller();
    let ch = check_channel(&channel)?;
    if gate_of(&ch).as_deref() != Some("github") {
        return Err("plan fundraisers live in #developers".into());
    }
    if !PLANS.contains(&plan.as_str()) {
        return Err(format!("plans are {}", PLANS.join(", ")));
    }
    if !(1_000_000..=100_000_000_000).contains(&goal_e8s) {
        return Err("goals are between 0.01 and 1000 ICP".into());
    }
    charge_message(text.len() + plan.len() + 64).await?;
    post_inner(channel, text, None, None, None, Some(Fund { canister: me, name: plan.clone(), goal_e8s, raised_e8s: 0, donors: vec![], closed: false, plan: Some(plan) }))
}

/// Words that are not welcome in the community, matched as whole words after normalising
/// leetspeak and separators; the few marked with a trailing `*` match as prefixes.
const BLOCKED: &[&str] = &[
    "fuck*", "shit*", "bitch*", "asshole*", "bastard", "cunt*", "dick", "dickhead*", "cock", "cocks", "cocksucker*", "pussy", "whore*", "slut*", "faggot*", "fag", "nigger*", "nigga*", "retard*", "kike", "spic", "chink", "wetback", "tranny", "twat", "wanker", "motherfucker*", "bullshit", "dipshit", "jackass", "douche*", "prick",
];
fn normalise(s: &str) -> String {
    s.to_lowercase().chars().map(|c| match c { '0' => 'o', '1' | '!' | '|' => 'i', '3' => 'e', '4' | '@' => 'a', '5' | '$' => 's', '7' => 't', '8' => 'b', c if c.is_alphanumeric() => c, _ => ' ' }).collect()
}
/// `Some(word)` when the text contains a blocked word.
fn foul(text: &str) -> Option<&'static str> {
    let norm = normalise(text);
    let squashed: String = norm.split_whitespace().collect::<Vec<_>>().join(" ");
    // Dotted spellings ("f.u.c.k"): join runs of single letters only, so "cockpit" and "Scunthorpe" pass.
    let joined: String = squashed.split(' ').filter(|t| t.chars().count() == 1).collect();
    for w in BLOCKED {
        let (stem, prefix) = match w.strip_suffix('*') { Some(st) => (st, true), None => (*w, false) };
        let hit = squashed.split(' ').any(|t| if prefix { t.starts_with(stem) } else { t == stem }) || (prefix && stem.len() >= 4 && joined.contains(stem));
        if hit {
            return Some(stem);
        }
    }
    None
}
/// Links and images are not allowed in chat: urls, markdown links and images, html tags, wiki links.
fn has_link_or_image(text: &str) -> bool {
    let t = text.to_lowercase();
    ["http://", "https://", "www.", "](", "![", "<img", "data:", "[[", "ftp://", ".com/", ".io/", ".org/"].iter().any(|p| t.contains(p)) || t.contains('<') && t.contains('>')
}
fn clean(text: &str) -> Result<(), String> {
    if has_link_or_image(text) {
        return Err("links and images are not allowed in the community; describe it in words".into());
    }
    if let Some(w) = foul(text) {
        return Err(format!("keep it clean: \"{w}\" is not allowed here"));
    }
    Ok(())
}

fn msg_key(channel: &str, id: u64) -> String {
    format!("{channel}#{id:020}")
}
fn check_channel(name: &str) -> Result<String, String> {
    let n = name.trim().to_lowercase();
    if n.is_empty() || n.len() > 32 || !n.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("channel names are 1-32 letters, digits or dashes".into());
    }
    Ok(n)
}
fn member_ok(p: Principal) -> Result<Member, String> {
    let m = MEMBERS.with_borrow(|m| m.get(&p).map(|c| c.0)).ok_or("join the community first")?;
    if !owns_a_notebook(p) {
        return Err(NEED_NOTEBOOK.into());
    }
    Ok(m)
}
const NEED_NOTEBOOK: &str = "you need a notebook to chat: create one first";
// ponytail: a scan of every notebook per message; an owner -> count index when notebooks reach the tens of thousands
fn owns_a_notebook(p: Principal) -> bool {
    NOTEBOOKS.with_borrow(|m| m.iter().any(|e| e.value().0.owner == p))
}

/// Join or rename: anyone who owns a notebook may chat; no ICP needs to sit in the wallet.
#[update]
async fn join_community(handle: String) -> Result<Member, String> {
    let me = msg_caller();
    if me == Principal::anonymous() {
        return Err("sign in first".into());
    }
    let handle = handle.trim().to_string();
    if handle.is_empty() || handle.chars().count() > 32 || handle.contains(['@', '#', '<', '>']) {
        return Err("handle: 1-32 characters, no @ # < >".into());
    }
    if foul(&handle).is_some() {
        return Err("pick a cleaner handle".into());
    }
    if MEMBERS.with_borrow(|m| m.iter().any(|e| e.value().0.handle.eq_ignore_ascii_case(&handle) && *e.key() != me)) {
        return Err("that handle is taken".into());
    }
    if !owns_a_notebook(me) {
        return Err(NEED_NOTEBOOK.into());
    }
    let joined_at = MEMBERS.with_borrow(|m| m.get(&me).map(|c| c.0.joined_at)).unwrap_or_else(time);
    let mem = Member { principal: me, handle, joined_at, verified_until: u64::MAX, balance_e8s: 0 };
    MEMBERS.with_borrow_mut(|m| m.insert(me, C(mem.clone())));
    Ok(mem)
}

#[query]
fn my_membership() -> Option<Member> {
    MEMBERS.with_borrow(|m| m.get(&msg_caller()).map(|c| c.0))
}


#[query]
fn channels() -> Vec<Channel> {
    CHANNELS.with_borrow(|c| c.iter().map(|e| e.value().0).collect())
}

#[update]
fn create_channel(name: String, topic: String) -> Result<Channel, String> {
    if !admin(&msg_caller()) {
        return Err("admin only".into());
    }
    let n = check_channel(&name)?;
    if CHANNELS.with_borrow(|c| c.contains_key(&n)) {
        return Err("exists".into());
    }
    let topic: String = topic.trim().chars().take(120).collect();
    clean(&topic)?;
    let ch = Channel { name: n.clone(), topic, created_by: msg_caller(), created_at: time(), gate: None, section: None };
    CHANNELS.with_borrow_mut(|c| c.insert(n, C(ch.clone())));
    Ok(ch)
}

#[update]
fn delete_channel(name: String) -> Result<(), String> {
    if !admin(&msg_caller()) {
        return Err("admin only".into());
    }
    let n = check_channel(&name)?;
    if n == "general" {
        return Err("general stays".into());
    }
    CHANNELS.with_borrow_mut(|c| c.remove(&n)).map(|_| ()).ok_or("unknown channel".into())
}

/// Post to a channel (members with a current ICP check). Markdown, 2000 characters at most.
#[update]
async fn post(channel: String, text: String, reply_to: Option<u64>) -> Result<Message, String> {
    charge_message(text.len()).await?;
    post_inner(channel, text, reply_to, None, None, None)
}
/// Every new chat message is paid for by one of the member's notebooks: exactly what the registry
/// spends receiving, running and storing it. Edits, reactions and votes are free.
async fn charge_message(bytes: usize) -> Result<(), String> {
    let me = msg_caller();
    member_ok(me)?;
    bill_notebook(me, post_cost(bytes as u64, MESSAGE_DAYS)).await
}
/// Cycles a chat message of `bytes` costs.
#[query]
fn message_cycles(bytes: u64) -> u64 {
    post_cost(bytes, MESSAGE_DAYS)
}

/// What a new message costs the registry in cycles at 13-node application-subnet prices: the
/// ingress update (5M base, 1.2M reception, 2K per byte), ~20M instructions at 0.4 cycles each, the
/// round trip to the paying notebook (~0.6M), and storing it with ~300 bytes of record overhead
/// for `days` at 127K cycles per GiB per second.
// ponytail: fixed prices and a flat instruction estimate; read performance_counter and the subnet size if they drift
fn post_cost(bytes: u64, days: u64) -> u64 {
    let stored = (bytes as u128 + 300) * 127_000 * days as u128 * 86_400 / (1u128 << 30);
    (5_000_000 + 1_200_000 + 2_000 * bytes as u128 + 8_000_000 + 600_000 + stored) as u64
}

thread_local! {
    /// Cycles each notebook has sent with `accept_fee` and not yet spent on a post.
    static FEE_CREDIT: RefCell<std::collections::HashMap<Principal, u128>> = RefCell::new(Default::default());
}

/// A notebook pays a fee: the cycles attached to this call are kept and credited to it. Only the
/// registry's notebooks may pay; anyone else's cycles are left unaccepted and go back.
#[update]
fn accept_fee() {
    let nb = msg_caller();
    if notebook(nb).is_none() {
        return;
    }
    let got = ic_cdk::api::msg_cycles_accept(ic_cdk::api::msg_cycles_available());
    FEE_CREDIT.with_borrow_mut(|c| *c.entry(nb).or_default() += got);
}

/// Bill one of `me`'s notebooks `cycles`: the first that can spare them (staying well above its
/// freezing reserve) sends them with `accept_fee`; the registry counts what arrived, so a notebook
/// whose owner changed its code cannot post for free.
async fn bill_notebook(me: Principal, cycles: u64) -> Result<(), String> {
    let mine: Vec<Principal> = NOTEBOOKS.with_borrow(|m| m.iter().filter(|e| e.value().0.owner == me).map(|e| *e.key()).collect());
    if mine.is_empty() {
        return Err(NEED_NOTEBOOK.into());
    }
    let want = cycles as u128;
    for nb in mine {
        let _ = Call::bounded_wait(nb, "pay_registry").with_arg(Nat::from(cycles)).await;
        let paid = FEE_CREDIT.with_borrow_mut(|c| match c.get_mut(&nb) {
            Some(have) if *have >= want => {
                *have -= want;
                true
            }
            _ => false,
        });
        if paid {
            return Ok(());
        }
    }
    Err("your notebooks are too low on cycles to pay for this; top one up in Manage".into())
}

/// Share a note in chat: `text` is the comment (may be empty), the gist is a snapshot of the note.
#[update]
async fn post_gist(channel: String, text: String, title: String, body: String, notebook: Principal, path: String) -> Result<Message, String> {
    let title = title.trim().to_string();
    let body = body.trim_end().to_string();
    if title.is_empty() || title.chars().count() > 120 {
        return Err("gist title: 1-120 characters".into());
    }
    if body.is_empty() || body.chars().count() > 8000 {
        return Err("gists carry up to 8000 characters of the note; trim it or share a section".into());
    }
    if let Some(w) = foul(&title).or_else(|| foul(&body)) {
        return Err(format!("keep it clean: \"{w}\" is not allowed here"));
    }
    if NOTEBOOKS.with_borrow(|m| !m.contains_key(&notebook)) {
        return Err("unknown notebook".into());
    }
    charge_message(text.len() + title.len() + body.len() + path.len()).await?;
    post_inner(channel, text, None, None, Some(Gist { title, text: body, notebook, path }), None)
}

/// Start a fundraiser for one of your notebooks. Donations become cycles for it and nothing else.
#[update]
async fn post_fund(channel: String, text: String, canister: Principal, goal_e8s: u64) -> Result<Message, String> {
    require_flag("fundraisers")?;
    owns(msg_caller(), canister)?;
    if !(1_000_000..=100_000_000_000).contains(&goal_e8s) {
        return Err("goals are between 0.01 and 1000 ICP".into());
    }
    if gate_of(&check_channel(&channel)?).is_some() {
        return Err("#developers raises for AI plans; raise for a notebook in another channel".into());
    }
    let name = NOTEBOOKS.with_borrow(|m| m.get(&canister).map(|c| c.0.name)).ok_or("unknown notebook")?;
    charge_message(text.len() + name.len() + 64).await?;
    post_inner(channel, text, None, None, None, Some(Fund { canister, name, goal_e8s, raised_e8s: 0, donors: vec![], closed: false, plan: None }))
}

/// Chip in: the ICP is pulled from your wallet (approve the registry first) and minted into the
/// notebook's cycles in the same call.
#[update]
async fn donate(channel: String, id: u64, amount_e8s: u64) -> Result<Message, String> {
    require_flag("fundraisers")?;
    let me = msg_caller();
    member_ok(me)?;
    let ch = check_channel(&channel)?;
    let key = msg_key(&ch, id);
    let m = MESSAGES.with_borrow(|x| x.get(&key).map(|c| c.0)).ok_or("unknown message")?;
    let f = m.fund.as_ref().filter(|_| !m.deleted).ok_or("not a fundraiser")?;
    if f.closed {
        return Err("this fundraiser is closed".into());
    }
    if amount_e8s < 1_000_000 {
        return Err("minimum donation is 0.01 ICP".into());
    }
    let canister = f.canister;
    if f.plan.is_none() && NOTEBOOKS.with_borrow(|n| !n.contains_key(&canister)) {
        return Err("that notebook has been deleted".into());
    }
    if f.plan.is_some() {
        // a plan: the ICP goes to the contributor's wallet, minus one ledger fee
        charge(me, amount_e8s).await?;
        let arg = icrc_ledger_types::icrc1::transfer::TransferArg { from_subaccount: None, to: Account { owner: wallet_of(m.author), subaccount: None }, fee: Some(Nat::from(ICP_FEE)), created_at_time: None, memo: None, amount: Nat::from(amount_e8s.saturating_sub(ICP_FEE)) };
        let r: Result<Nat, icrc_ledger_types::icrc1::transfer::TransferError> = Call::unbounded_wait(LEDGER, "icrc1_transfer").with_arg(&arg).await.map_err(|e| format!("ledger: {e}"))?.candid().map_err(|e| e.to_string())?;
        r.map_err(|e| format!("transfer failed: {e:?}"))?;
    } else {
        top_up_icp(canister, amount_e8s, me).await?;
    }
    // re-read: other donations may have landed while we waited on the ledger
    let mut m = MESSAGES.with_borrow(|x| x.get(&key).map(|c| c.0)).ok_or("unknown message")?;
    if let Some(f) = m.fund.as_mut() {
        f.raised_e8s += amount_e8s;
        match f.donors.iter_mut().find(|(p, _)| *p == me) {
            Some(d) => d.1 += amount_e8s,
            None => f.donors.push((me, amount_e8s)),
        }
    }
    MESSAGES.with_borrow_mut(|x| x.insert(key, C(m.clone())));
    Ok(m)
}

/// The notebook owner (or an admin) stops a fundraiser.
#[update]
fn close_fund(channel: String, id: u64) -> Result<Message, String> {
    let me = msg_caller();
    let ch = check_channel(&channel)?;
    let key = msg_key(&ch, id);
    let mut m = MESSAGES.with_borrow(|x| x.get(&key).map(|c| c.0)).ok_or("unknown message")?;
    let f = m.fund.as_mut().ok_or("not a fundraiser")?;
    if m.author != me && !admin(&me) {
        return Err("not your fundraiser".into());
    }
    f.closed = true;
    MESSAGES.with_borrow_mut(|x| x.insert(key, C(m.clone())));
    Ok(m)
}

/// A poll: the text is the question, 2-10 options, one vote per member (re-voting moves it).
#[update]
async fn post_poll(channel: String, question: String, options: Vec<String>) -> Result<Message, String> {
    let options: Vec<String> = options.iter().map(|o| o.trim().to_string()).filter(|o| !o.is_empty()).collect();
    if options.len() < 2 || options.len() > 10 || options.iter().any(|o| o.chars().count() > 80) {
        return Err("polls have 2-10 options of up to 80 characters".into());
    }
    for o in &options {
        clean(o)?;
    }
    charge_message(question.len() + options.iter().map(|o| o.len() + 8).sum::<usize>()).await?;
    post_inner(channel, question, None, Some(Poll { options, votes: vec![] }), None, None)
}

#[update]
fn vote(channel: String, id: u64, option: u32) -> Result<Message, String> {
    let me = msg_caller();
    member_ok(me)?;
    let ch = check_channel(&channel)?;
    let key = msg_key(&ch, id);
    let mut m = MESSAGES.with_borrow(|x| x.get(&key).map(|c| c.0)).ok_or("unknown message")?;
    let poll = m.poll.as_mut().filter(|_| !m.deleted).ok_or("not a poll")?;
    if option as usize >= poll.options.len() {
        return Err("no such option".into());
    }
    poll.votes.retain(|(p, _)| *p != me);
    poll.votes.push((me, option));
    MESSAGES.with_borrow_mut(|x| x.insert(key, C(m.clone())));
    Ok(m)
}

/// Toggle an emoji reaction on a message.
#[update]
fn react(channel: String, id: u64, emoji: String) -> Result<Message, String> {
    let me = msg_caller();
    member_ok(me)?;
    let emoji = emoji.trim().to_string();
    if emoji.is_empty() || emoji.len() > 32 || emoji.chars().any(|c| c.is_ascii()) {
        return Err("reactions are emoji".into());
    }
    let ch = check_channel(&channel)?;
    let key = msg_key(&ch, id);
    let mut m = MESSAGES.with_borrow(|x| x.get(&key).map(|c| c.0)).ok_or("unknown message")?;
    if m.deleted {
        return Err("message was removed".into());
    }
    let mut rs = m.reactions.take().unwrap_or_default();
    match rs.iter().position(|r| r.emoji == emoji) {
        Some(i) if rs[i].by.contains(&me) => rs[i].by.retain(|p| *p != me),
        Some(i) => rs[i].by.push(me),
        None if rs.len() >= 20 => return Err("too many different reactions on this message".into()),
        None => rs.push(Reaction { emoji, by: vec![me] }),
    }
    rs.retain(|r| !r.by.is_empty());
    m.reactions = Some(rs);
    MESSAGES.with_borrow_mut(|x| x.insert(key, C(m.clone())));
    Ok(m)
}

fn post_inner(channel: String, text: String, reply_to: Option<u64>, poll: Option<Poll>, gist: Option<Gist>, fund: Option<Fund>) -> Result<Message, String> {
    let me = msg_caller();
    let m = member_ok(me)?;
    let ch = check_channel(&channel)?;
    if !CHANNELS.with_borrow(|c| c.contains_key(&ch)) {
        return Err("unknown channel".into());
    }
    if gate_of(&ch).as_deref() == Some("github") && GITHUB.with_borrow(|g| !g.contains_key(&me)) {
        let repo = github_repo();
        return Err(format!("#{ch} is for contributors to {}; link your GitHub first", if repo.is_empty() { "the project" } else { &repo }));
    }
    let text = text.trim().to_string();
    if (text.is_empty() && gist.is_none()) || text.chars().count() > 2000 {
        return Err("message: 1-2000 characters".into());
    }
    clean(&text)?;
    if let Some(r) = reply_to {
        if MESSAGES.with_borrow(|x| x.get(&msg_key(&ch, r))).is_none() {
            return Err("reply target is not in this channel".into());
        }
    }
    let id = NEXT_MSG.with_borrow(|n| *n.get());
    NEXT_MSG.with_borrow_mut(|n| n.set(id + 1));
    let msg = Message { id, channel: ch.clone(), author: me, handle: m.handle, text, at: time(), reply_to, deleted: false, poll, reactions: None, gist, fund, edited: None, pinned: None, post: None };
    MESSAGES.with_borrow_mut(|x| x.insert(msg_key(&ch, id), C(msg.clone())));
    record_mentions(&msg);
    CHAT_PRESENCE.with_borrow_mut(|p| p.insert(me, C((ch, time()))));
    LAST_POST.with_borrow_mut(|l| l.insert(me, time()));
    Ok(msg)
}

/// Messages in a channel after `after` (0 for the newest page), oldest first, at most `limit` (≤ 100).
#[query]
fn messages(channel: String, after: u64, limit: u32) -> Result<Vec<Message>, String> {
    let ch = check_channel(&channel)?;
    let limit = limit.clamp(1, 100) as usize;
    let prefix = format!("{ch}#");
    MESSAGES.with_borrow(|x| {
        if after == 0 {
            let mut v: Vec<Message> = x.range(prefix.clone()..).take_while(|e| e.key().starts_with(&prefix)).map(|e| e.value().0).collect();
            let n = v.len();
            v.drain(..n.saturating_sub(limit));
            Ok(v)
        } else {
            Ok(x.range(msg_key(&ch, after + 1)..).take_while(|e| e.key().starts_with(&prefix)).take(limit).map(|e| e.value().0).collect())
        }
    })
}

/// New (not deleted) messages in every channel after the id the caller last saw there, capped at
/// 100 a channel, in one call: the chat used to fetch up to 100 messages from each channel to count.
#[query]
fn unread_counts(seen: Vec<(String, u64)>) -> Vec<(String, u32)> {
    let seen: std::collections::HashMap<String, u64> = seen.into_iter().collect();
    let names: Vec<String> = CHANNELS.with_borrow(|c| c.iter().map(|e| e.key().clone()).collect());
    MESSAGES.with_borrow(|x| {
        names
            .into_iter()
            .filter_map(|ch| {
                let prefix = format!("{ch}#");
                let from = msg_key(&ch, seen.get(&ch).copied().unwrap_or(0) + 1);
                let n = x.range(from..).take_while(|e| e.key().starts_with(&prefix)).filter(|e| !e.value().0.deleted).take(100).count() as u32;
                (n > 0).then_some((ch, n))
            })
            .collect()
    })
}

/// Remove a message you wrote (or any, as an admin); the slot stays with the text blanked.
#[update]
fn delete_message(channel: String, id: u64) -> Result<(), String> {
    let me = msg_caller();
    let ch = check_channel(&channel)?;
    let key = msg_key(&ch, id);
    let mut m = MESSAGES.with_borrow(|x| x.get(&key).map(|c| c.0)).ok_or("unknown message")?;
    if m.author != me && !admin(&me) {
        return Err("not your message".into());
    }
    m.deleted = true;
    m.text = String::new();
    MESSAGES.with_borrow_mut(|x| x.insert(key, C(m)));
    Ok(())
}

/// The author rewrites a message; the same filters apply and it is marked edited.
#[update]
fn edit_message(channel: String, id: u64, text: String) -> Result<Message, String> {
    let me = msg_caller();
    member_ok(me)?;
    let ch = check_channel(&channel)?;
    let key = msg_key(&ch, id);
    let mut m = MESSAGES.with_borrow(|x| x.get(&key).map(|c| c.0)).ok_or("unknown message")?;
    if m.author != me || m.deleted {
        return Err("not your message".into());
    }
    let text = text.trim().to_string();
    if text.is_empty() || text.chars().count() > 2000 {
        return Err("message: 1-2000 characters".into());
    }
    clean(&text)?;
    m.text = text;
    m.edited = Some(time());
    MESSAGES.with_borrow_mut(|x| x.insert(key, C(m.clone())));
    record_mentions(&m);
    Ok(m)
}
/// Pin or unpin a message in its channel (the author or an admin).
#[update]
fn pin_message(channel: String, id: u64, on: bool) -> Result<Message, String> {
    let me = msg_caller();
    let ch = check_channel(&channel)?;
    let key = msg_key(&ch, id);
    let mut m = MESSAGES.with_borrow(|x| x.get(&key).map(|c| c.0)).ok_or("unknown message")?;
    if m.author != me && !admin(&me) {
        return Err("only the author or an admin pins".into());
    }
    if m.deleted {
        return Err("message was removed".into());
    }
    m.pinned = if on { Some(true) } else { None };
    MESSAGES.with_borrow_mut(|x| x.insert(key, C(m.clone())));
    Ok(m)
}
/// Pinned messages of a channel, oldest first.
#[query]
fn pinned(channel: String) -> Result<Vec<Message>, String> {
    let ch = check_channel(&channel)?;
    let prefix = format!("{ch}#");
    Ok(MESSAGES.with_borrow(|x| x.range(prefix.clone()..).take_while(|e| e.key().starts_with(&prefix)).map(|e| e.value().0).filter(|m| m.pinned == Some(true) && !m.deleted).collect()))
}

/// "I am reading this channel": kept two minutes for the online list.
#[update]
fn ping_chat(channel: String) -> Result<Vec<Online>, String> {
    let me = msg_caller();
    member_ok(me)?;
    let ch = check_channel(&channel)?;
    CHAT_PRESENCE.with_borrow_mut(|p| p.insert(me, C((ch, time()))));
    Ok(online_now())
}
#[query]
fn online() -> Vec<Online> {
    online_now()
}
fn online_now() -> Vec<Online> {
    let cutoff = time().saturating_sub(CHAT_PRESENCE_NS);
    CHAT_PRESENCE.with_borrow(|p| p.iter().filter(|e| e.value().0 .1 >= cutoff).filter_map(|e| MEMBERS.with_borrow(|m| m.get(e.key()).map(|c| Online { principal: *e.key(), handle: c.0.handle, channel: e.value().0 .0.clone() }))).collect())
}
#[query]
fn members() -> Vec<Member> {
    MEMBERS.with_borrow(|m| m.iter().map(|e| { let mut v = e.value().0; v.balance_e8s = 0; v }).collect())
}

// ---------------------------------------------------------------- rain: ICP sprinkled over people who chatted in the last half hour

const RAIN_WINDOW_NS: u64 = 1_800_000_000_000; // 30 minutes

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Rain {
    pub id: u64,
    pub from: Principal,
    pub from_handle: String,
    pub channel: String,
    pub total_e8s: u64,
    pub each_e8s: u64,
    pub recipients: Vec<(Principal, String)>,
    pub at: u64,
}

thread_local! {
    /// when each member last posted anywhere
    static LAST_POST: RefCell<StableBTreeMap<Principal, u64, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(20)))));
    static RAINS: RefCell<StableBTreeMap<u64, C<Rain>, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(21)))));
    static NEXT_RAIN: RefCell<ic_stable_structures::StableCell<u64, Mem>> = RefCell::new(ic_stable_structures::StableCell::init(MM.with_borrow(|m| m.get(MemoryId::new(22))), 1));
}

fn active_members(except: Principal) -> Vec<Principal> {
    let cutoff = time().saturating_sub(RAIN_WINDOW_NS);
    LAST_POST.with_borrow(|l| l.iter().filter(|e| e.value() >= cutoff && *e.key() != except).map(|e| *e.key()).collect())
}

/// How many people could be rained on right now (excluding you).
#[query]
fn rain_eligible() -> u32 {
    active_members(msg_caller()).len() as u32
}

/// Send `total_e8s` of ICP, pulled from your allowance for the registry, split over `count` people
/// picked at random from those who posted in the last 30 minutes. Returns the rain, which is also
/// announced in the channel.
#[update]
async fn rain(channel: String, total_e8s: u64, count: u8) -> Result<Rain, String> {
    require_flag("rain")?;
    let me = msg_caller();
    let m = member_ok(me)?;
    let ch = check_channel(&channel)?;
    if !CHANNELS.with_borrow(|c| c.contains_key(&ch)) {
        return Err("unknown channel".into());
    }
    if !(1..=10).contains(&count) {
        return Err("rain on 1 to 10 people".into());
    }
    let mut pool = active_members(me);
    if pool.is_empty() {
        return Err("nobody has chatted in the last 30 minutes".into());
    }
    let n = (count as usize).min(pool.len());
    let each = total_e8s.checked_sub(ICP_FEE * n as u64).unwrap_or(0) / n as u64;
    if each < 100_000 {
        return Err(format!("that is under 0.001 ICP each after fees; send at least {} ICP for {n} people", (n as u64 * (100_000 + ICP_FEE)) as f64 / 1e8));
    }
    charge(me, total_e8s).await?;
    // pick n at random
    let rand = mgmt::raw_rand().await.map_err(|e| format!("randomness: {e:?}"))?;
    let mut chosen: Vec<Principal> = vec![];
    for i in 0..n {
        let r = u64::from_le_bytes(rand[(i * 4) % 28..(i * 4) % 28 + 8].try_into().unwrap()) as usize;
        chosen.push(pool.remove(r % pool.len()));
    }
    let mut recipients = vec![];
    for p in chosen {
        let arg = icrc_ledger_types::icrc1::transfer::TransferArg { from_subaccount: None, to: Account { owner: wallet_of(p), subaccount: None }, fee: Some(Nat::from(ICP_FEE)), created_at_time: None, memo: None, amount: Nat::from(each) };
        let r: Result<Nat, icrc_ledger_types::icrc1::transfer::TransferError> = Call::unbounded_wait(LEDGER, "icrc1_transfer").with_arg(&arg).await.map_err(|e| format!("ledger: {e}"))?.candid().map_err(|e| e.to_string())?;
        if r.is_ok() {
            let handle = MEMBERS.with_borrow(|x| x.get(&p).map(|c| c.0.handle)).unwrap_or_default();
            recipients.push((p, handle));
        }
    }
    if recipients.is_empty() {
        return Err("no transfer went through; your ICP is held by the registry, tell an admin".into());
    }
    let id = NEXT_RAIN.with_borrow(|x| *x.get());
    NEXT_RAIN.with_borrow_mut(|x| x.set(id + 1));
    let rain = Rain { id, from: me, from_handle: m.handle.clone(), channel: ch.clone(), total_e8s, each_e8s: each, recipients: recipients.clone(), at: time() };
    RAINS.with_borrow_mut(|x| x.insert(id, C(rain.clone())));
    let mid = NEXT_MSG.with_borrow(|x| *x.get());
    NEXT_MSG.with_borrow_mut(|x| x.set(mid + 1));
    let text = format!("☔ **@{}** rained **{} ICP** on {}: {}", m.handle, each as f64 / 1e8, if recipients.len() == 1 { "1 person".to_string() } else { format!("{} people", recipients.len()) }, recipients.iter().map(|(_, h)| format!("@{h}")).collect::<Vec<_>>().join(" "));
    MESSAGES.with_borrow_mut(|x| x.insert(msg_key(&ch, mid), C(Message { id: mid, channel: ch, author: canister_self(), handle: "rain".into(), text, at: time(), reply_to: None, deleted: false, poll: None, reactions: None, gist: None, fund: None, edited: None, pinned: None, post: None })));
    Ok(rain)
}

/// Rain that fell on you after `after` (an id), so the app can celebrate it anywhere.
#[query]
fn my_rain(after: u64) -> Vec<Rain> {
    let me = msg_caller();
    RAINS.with_borrow(|x| x.range(after + 1..).map(|e| e.value().0).filter(|r| r.recipients.iter().any(|(p, _)| *p == me)).take(20).collect())
}

#[query]
fn recent_rain(limit: u32) -> Vec<Rain> {
    RAINS.with_borrow(|x| x.iter().rev().take(limit.clamp(1, 50) as usize).map(|e| e.value().0).collect())
}

// ---------------------------------------------------------------- tokenised notebooks: ICRC-7, the market, ratings, the judge

fn mint_id(canister: Principal) -> u64 {
    if let Some(id) = ID_OF.with_borrow(|m| m.get(&canister)) {
        return id;
    }
    let id = NEXT_ID.with_borrow(|n| *n.get());
    NEXT_ID.with_borrow_mut(|n| n.set(id + 1));
    TOKEN_IDS.with_borrow_mut(|m| m.insert(id, canister));
    ID_OF.with_borrow_mut(|m| m.insert(canister, id));
    id
}

/// Give every notebook from before tokenisation an ICRC-7 id (controller only; new ones get it at spawn).
#[update]
fn tokenize_all() -> Result<u32, String> {
    if !is_controller(&msg_caller()) {
        return Err("controller only".into());
    }
    let ids: Vec<Principal> = NOTEBOOKS.with_borrow(|m| m.iter().map(|e| *e.key()).collect());
    let mut n = 0;
    for id in ids {
        if ID_OF.with_borrow(|m| m.get(&id)).is_none() {
            mint_id(id);
            n += 1;
        }
    }
    Ok(n)
}

#[query]
fn token_id(canister: Principal) -> Option<u64> {
    ID_OF.with_borrow(|m| m.get(&canister))
}

/// Move a notebook to a new owner: canister controllers, the notebook's own owner record, the registry's record.
async fn hand_over(canister: Principal, to: Principal) -> Result<(), String> {
    let me = canister_self();
    mgmt::update_settings(&mgmt::UpdateSettingsArgs { canister_id: canister, settings: mgmt::CanisterSettings { controllers: Some(vec![me, to]), ..Default::default() } })
        .await
        .map_err(|e| format!("update_settings: {e:?}"))?;
    let r: Result<(), candid::Reserved> = Call::unbounded_wait(canister, "transfer_owner").with_arg(to).await.map_err(|e| format!("notebook: {e}"))?.candid().map_err(|e| e.to_string())?;
    r.map_err(|_| "the notebook refused the new owner".to_string())?;
    NOTEBOOKS.with_borrow_mut(|m| {
        if let Some(mut v) = m.get(&canister).map(|c| c.0) {
            v.owner = to;
            m.insert(canister, C(v));
        }
    });
    LISTINGS.with_borrow_mut(|l| l.remove(&canister));
    Ok(())
}

// --- ICRC-7

#[query]
fn icrc7_collection_metadata() -> Vec<(String, Value)> {
    vec![
        ("icrc7:name".into(), Value::Text("Notebooks".into())),
        ("icrc7:symbol".into(), Value::Text("NBK".into())),
        ("icrc7:description".into(), Value::Text("Each token is a notebook canister; owning the token is owning the canister.".into())),
        ("icrc7:total_supply".into(), Value::Nat(Nat::from(TOKEN_IDS.with_borrow(|m| m.len())))),
    ]
}
#[query]
fn icrc7_name() -> String { "Notebooks".into() }
#[query]
fn icrc7_symbol() -> String { "NBK".into() }
#[query]
fn icrc7_description() -> Option<String> { Some("Each token is a notebook canister; owning the token is owning the canister.".into()) }
#[query]
fn icrc7_logo() -> Option<String> { None }
#[query]
fn icrc7_total_supply() -> Nat { Nat::from(TOKEN_IDS.with_borrow(|m| m.len())) }
#[query]
fn icrc7_supply_cap() -> Option<Nat> { None }
#[query]
fn icrc7_max_query_batch_size() -> Option<Nat> { Some(Nat::from(100u8)) }
#[query]
fn icrc7_max_update_batch_size() -> Option<Nat> { Some(Nat::from(1u8)) }
#[query]
fn icrc7_default_take_value() -> Option<Nat> { Some(Nat::from(100u8)) }
#[query]
fn icrc7_max_take_value() -> Option<Nat> { Some(Nat::from(1000u16)) }
#[query]
fn icrc7_max_memo_size() -> Option<Nat> { Some(Nat::from(32u8)) }
#[query]
fn icrc7_atomic_batch_transfers() -> Option<bool> { Some(true) }
#[query]
fn icrc7_tx_window() -> Option<Nat> { None }
#[query]
fn icrc7_permitted_drift() -> Option<Nat> { None }

fn nb_of_token(id: &Nat) -> Option<Notebook> {
    let id: u64 = id.0.clone().try_into().ok()?;
    let c = TOKEN_IDS.with_borrow(|m| m.get(&id))?;
    notebook(c)
}

#[query]
fn icrc7_token_metadata(ids: Vec<Nat>) -> Vec<Option<Vec<(String, Value)>>> {
    ids.iter().map(|id| nb_of_token(id).map(|v| {
        let mut m = vec![("icrc7:name".into(), Value::Text(v.name.clone())), ("notebook:canister".into(), Value::Text(v.canister.to_text())), ("notebook:created_at".into(), Value::Nat(Nat::from(v.created_at)))];
        if let Some(a) = ATTESTATIONS.with_borrow(|x| x.get(&v.canister).map(|c| c.0)) {
            m.push(("notebook:quality".into(), Value::Nat(Nat::from(a.score))));
            m.push(("notebook:grade".into(), Value::Text(a.grade)));
        }
        m
    })).collect()
}
#[query]
fn icrc7_owner_of(ids: Vec<Nat>) -> Vec<Option<Account>> {
    ids.iter().map(|id| nb_of_token(id).map(|v| Account { owner: v.owner, subaccount: None })).collect()
}
#[query]
fn icrc7_balance_of(accounts: Vec<Account>) -> Vec<Nat> {
    accounts.iter().map(|a| Nat::from(NOTEBOOKS.with_borrow(|m| m.iter().filter(|e| e.value().0.owner == a.owner && ID_OF.with_borrow(|x| x.get(e.key())).is_some()).count()))).collect()
}
#[query]
fn icrc7_tokens(prev: Option<Nat>, take: Option<Nat>) -> Vec<Nat> {
    let start: u64 = prev.map(|p| p.0.try_into().unwrap_or(u64::MAX)).unwrap_or(0);
    let n: usize = take.map(|t| t.0.try_into().unwrap_or(100)).unwrap_or(100).min(1000);
    TOKEN_IDS.with_borrow(|m| m.iter().map(|e| *e.key()).filter(|id| *id > start).take(n).map(Nat::from).collect())
}
#[query]
fn icrc7_tokens_of(account: Account, prev: Option<Nat>, take: Option<Nat>) -> Vec<Nat> {
    let start: u64 = prev.map(|p| p.0.try_into().unwrap_or(u64::MAX)).unwrap_or(0);
    let n: usize = take.map(|t| t.0.try_into().unwrap_or(100)).unwrap_or(100).min(1000);
    let mut ids: Vec<u64> = NOTEBOOKS.with_borrow(|m| m.iter().filter(|e| e.value().0.owner == account.owner).filter_map(|e| ID_OF.with_borrow(|x| x.get(e.key()))).collect());
    ids.sort_unstable();
    ids.into_iter().filter(|id| *id > start).take(n).map(Nat::from).collect()
}

/// Give a notebook away (ICRC-7 transfer): the caller must own it; one token per call.
#[update]
async fn icrc7_transfer(args: Vec<TransferArg>) -> Vec<Option<Result<Nat, TransferError>>> {
    let caller = msg_caller();
    let mut out = vec![];
    for a in args {
        let Some(v) = nb_of_token(&a.token_id) else { out.push(Some(Err(TransferError::NonExistingTokenId))); continue };
        if v.owner != caller { out.push(Some(Err(TransferError::Unauthorized))); continue }
        if a.to.owner == Principal::anonymous() || a.to.owner == caller { out.push(Some(Err(TransferError::InvalidRecipient))); continue }
        match hand_over(v.canister, a.to.owner).await {
            Ok(()) => out.push(Some(Ok(a.token_id.clone()))),
            Err(e) => out.push(Some(Err(TransferError::GenericError { error_code: Nat::from(1u8), message: e }))),
        }
    }
    out
}

// --- the market

/// Offer a notebook you own for sale, priced in any accepted token's smallest unit. The judge runs first if it has not yet.
#[update]
async fn list_notebook(canister: Principal, symbol: String, price: Nat, blurb: String) -> Result<ListingView, String> {
    require_flag("market")?;
    let caller = msg_caller();
    owns(caller, canister)?;
    let tok = token(&symbol)?;
    if price <= tok.fee.clone() * 4u8 {
        return Err("price must cover a few ledger fees".into());
    }
    if blurb.len() > 500 {
        return Err("blurb must be 500 chars or fewer".into());
    }
    mint_id(canister);
    if ATTESTATIONS.with_borrow(|a| a.get(&canister)).is_none() {
        attest(canister).await?;
    }
    let l = Listing { canister, seller: caller, token: tok.symbol, price, blurb: blurb.trim().into(), listed_at: time() };
    LISTINGS.with_borrow_mut(|m| m.insert(canister, C(l.clone())));
    Ok(view(l))
}

#[update]
fn delist(canister: Principal) -> Result<(), String> {
    owns(msg_caller(), canister)?;
    LISTINGS.with_borrow_mut(|m| m.remove(&canister)).map(|_| ()).ok_or("not listed".into())
}

fn view(l: Listing) -> ListingView {
    let prefix = format!("{}/", l.canister.to_text());
    let (sum, n) = RATINGS.with_borrow(|r| r.range(prefix.clone()..).take_while(|e| e.key().starts_with(&prefix)).fold((0u64, 0u64), |(s, n), e| (s + e.value().0.stars as u64, n + 1)));
    ListingView {
        name: notebook(l.canister).map(|v| v.name).unwrap_or_default(),
        token_id: ID_OF.with_borrow(|m| m.get(&l.canister)),
        attestation: ATTESTATIONS.with_borrow(|a| a.get(&l.canister).map(|c| c.0)),
        rating_avg: if n == 0 { 0.0 } else { sum as f64 / n as f64 },
        rating_count: n,
        listing: l,
    }
}

#[query]
fn listings() -> Vec<ListingView> {
    let mut v: Vec<ListingView> = LISTINGS.with_borrow(|m| m.iter().map(|e| view(e.value().0)).collect());
    v.sort_by(|a, b| b.listing.listed_at.cmp(&a.listing.listed_at));
    v
}

#[query]
fn listing(canister: Principal) -> Option<ListingView> {
    LISTINGS.with_borrow(|m| m.get(&canister).map(|c| view(c.0)))
}

/// Buy a listed notebook: the price is pulled from `payer`'s allowance (the caller, or an OISY wallet),
/// the seller gets it minus the market fee, and the canister changes hands.
#[update]
async fn buy(canister: Principal, payer: Option<Principal>) -> Result<Notebook, String> {
    require_flag("market")?;
    let buyer = msg_caller();
    if buyer == Principal::anonymous() {
        return Err("sign in first".into());
    }
    let l = LISTINGS.with_borrow(|m| m.get(&canister).map(|c| c.0)).ok_or("not for sale")?;
    if l.seller == buyer {
        return Err("you already own it".into());
    }
    let payer = payer.unwrap_or(buyer);
    let tok = token(&l.token)?;
    pull(&tok, payer, &l.price).await?;
    let fee_bps = MARKET_FEE_BPS.with_borrow(|f| *f.get());
    let cut = l.price.clone() * fee_bps / 10_000u32;
    let to_seller = l.price.clone() - cut - tok.fee.clone() * 2u8;
    // ponytail: if the payout fails the registry keeps the funds; admins can see it in the ledger and settle by hand
    send(&tok, l.seller, &to_seller).await?;
    hand_over(canister, buyer).await?;
    PURCHASES.with_borrow_mut(|p| p.insert(format!("{}/{}", canister.to_text(), buyer.to_text()), time()));
    notebook(canister).ok_or("unknown notebook".into())
}

#[update]
fn set_market_fee(bps: u64) -> Result<(), String> {
    if !is_controller(&msg_caller()) {
        return Err("controller only".into());
    }
    if bps > 2_000 {
        return Err("at most 20%".into());
    }
    MARKET_FEE_BPS.with_borrow_mut(|f| f.set(bps));
    Ok(())
}

#[query]
fn market_fee() -> u64 {
    MARKET_FEE_BPS.with_borrow(|f| *f.get())
}

/// Rate a notebook you bought, 1 to 5 stars; rating again replaces your earlier one.
#[update]
fn rate(canister: Principal, stars: u8, comment: String) -> Result<(), String> {
    let me = msg_caller();
    let key = format!("{}/{}", canister.to_text(), me.to_text());
    if PURCHASES.with_borrow(|p| p.get(&key)).is_none() {
        return Err("only buyers can rate".into());
    }
    if !(1..=5).contains(&stars) {
        return Err("stars must be 1-5".into());
    }
    if comment.len() > 500 {
        return Err("comment must be 500 chars or fewer".into());
    }
    RATINGS.with_borrow_mut(|r| r.insert(key, C(Rating { rater: me, stars, comment: comment.trim().into(), at: time() })));
    Ok(())
}

#[query]
fn ratings(canister: Principal) -> Vec<Rating> {
    let prefix = format!("{}/", canister.to_text());
    RATINGS.with_borrow(|r| r.range(prefix.clone()..).take_while(|e| e.key().starts_with(&prefix)).map(|e| e.value().0).collect())
}

/// Did the caller buy this notebook (so they may rate it)?
#[query]
fn bought(canister: Principal) -> bool {
    PURCHASES.with_borrow(|p| p.get(&format!("{}/{}", canister.to_text(), msg_caller().to_text()))).is_some()
}

// --- the judge
//
// ponytail: judge "structural-v1" scores what can be measured (coverage, depth, linking, organisation,
// freshness) and writes the summary from the numbers. The LLM judge (DFINITY's LLM canister via
// `ic-llm`, prompt = these numbers + the samples) slots in here and replaces `judge` and `summary`.

/// Run the judge over a notebook you own and attach its verdict (also runs when a notebook is first listed).
#[update]
async fn attest(canister: Principal) -> Result<Attestation, String> {
    owns(msg_caller(), canister)?;
    let r: Result<Audit, candid::Reserved> = Call::unbounded_wait(canister, "audit").with_arg(()).await.map_err(|e| format!("notebook: {e}"))?.candid().map_err(|e| e.to_string())?;
    let a = r.map_err(|_| "the notebook refused the audit".to_string())?;
    let att = judge(&a);
    ATTESTATIONS.with_borrow_mut(|m| m.insert(canister, C(att.clone())));
    Ok(att)
}

#[query]
fn attestation(canister: Principal) -> Option<Attestation> {
    ATTESTATIONS.with_borrow(|m| m.get(&canister).map(|c| c.0))
}

fn judge(a: &Audit) -> Attestation {
    let notes = a.notes.max(1) as f64;
    let coverage = ((a.notes as f64 + 1.0).log2() / 7.0).min(1.0); // 127 notes = full marks
    let avg_words = a.words as f64 / notes;
    let depth = (avg_words / 300.0).min(1.0);
    let links_per_note = a.links as f64 / notes;
    let orphan_ratio = a.orphans as f64 / notes;
    let linking = ((links_per_note / 2.0).min(1.0) * 0.6 + (1.0 - orphan_ratio) * 0.4) * if a.links > 0 { a.resolved_links as f64 / a.links as f64 } else { 0.5 };
    let organisation = (a.with_headings as f64 / notes) * 0.6 + (a.with_tags as f64 / notes) * 0.4;
    let age_days = if a.newest_modified == 0 { 365.0 } else { (time().saturating_sub(a.newest_modified)) as f64 / 86_400e9 };
    let freshness = (1.0 - age_days / 365.0).clamp(0.0, 1.0);
    let score = ((coverage * 30.0 + depth * 25.0 + linking * 25.0 + organisation * 10.0 + freshness * 10.0).round() as u8).min(100);
    let grade = match score { 85.. => "A", 70.. => "B", 55.. => "C", 40.. => "D", _ => "E" }.to_string();
    let mut parts = vec![format!("{} notes, {} words", a.notes, a.words)];
    parts.push(if avg_words >= 300.0 { "notes are substantial".into() } else if avg_words >= 100.0 { "notes are of moderate length".into() } else { "notes are short".into() });
    parts.push(if links_per_note >= 2.0 && orphan_ratio < 0.2 { "well linked".into() } else if a.links == 0 { "no links between notes".into() } else { format!("{} orphan{}", a.orphans, if a.orphans == 1 { "" } else { "s" }) });
    if a.with_headings as f64 / notes >= 0.5 { parts.push("most notes are structured with headings".into()); }
    if a.agent_notes > 0 { parts.push(format!("{} agent-written", a.agent_notes)); }
    if a.decks > 0 { parts.push(format!("{} deck{} or quizzes", a.decks, if a.decks == 1 { "" } else { "s" })); }
    parts.push(if age_days < 30.0 { "edited in the last month".into() } else { format!("last edited {} days ago", age_days as u64) });
    Attestation { score, grade, summary: parts.join("; ") + ".", judge: "structural-v1".into(), notes: a.notes, words: a.words, at: time(), decks: Some(a.decks) }
}

// ---------------------------------------------------------------- snapshots (the registry is a controller of every notebook)

fn owns(caller: Principal, canister: Principal) -> Result<(), String> {
    let v = NOTEBOOKS.with_borrow(|m| m.get(&canister).map(|c| c.0)).ok_or("unknown notebook")?;
    if v.owner != caller && !is_controller(&caller) {
        return Err("not your notebook".into());
    }
    Ok(())
}

/// Take a snapshot of a notebook canister (its owner); at most one is kept, the newest replaces it.
#[update]
async fn take_snapshot(canister: Principal, replace: Option<Vec<u8>>) -> Result<SnapshotInfo, String> {
    owns(msg_caller(), canister)?;
    let s = mgmt::take_canister_snapshot(&mgmt::TakeCanisterSnapshotArgs { canister_id: canister, replace_snapshot: replace, uninstall_code: None, sender_canister_version: None }).await.map_err(|e| format!("{e:?}"))?;
    Ok(SnapshotInfo { id: s.id, taken_at: s.taken_at_timestamp, total_size: s.total_size })
}

#[update]
async fn list_snapshots(canister: Principal) -> Result<Vec<SnapshotInfo>, String> {
    owns(msg_caller(), canister)?;
    let v = mgmt::list_canister_snapshots(&mgmt::ListCanisterSnapshotsArgs { canister_id: canister }).await.map_err(|e| format!("{e:?}"))?;
    Ok(v.into_iter().map(|s| SnapshotInfo { id: s.id, taken_at: s.taken_at_timestamp, total_size: s.total_size }).collect())
}

/// Roll a notebook back to a snapshot: stop, load, start.
#[update]
async fn restore_snapshot(canister: Principal, id: Vec<u8>) -> Result<(), String> {
    owns(msg_caller(), canister)?;
    mgmt::stop_canister(&mgmt::StopCanisterArgs { canister_id: canister }).await.map_err(|e| format!("stop: {e:?}"))?;
    let loaded = mgmt::load_canister_snapshot(&mgmt::LoadCanisterSnapshotArgs { canister_id: canister, snapshot_id: id }).await.map_err(|e| format!("load: {e:?}"));
    mgmt::start_canister(&mgmt::StartCanisterArgs { canister_id: canister }).await.map_err(|e| format!("start: {e:?}"))?;
    loaded
}

#[update]
async fn delete_snapshot(canister: Principal, id: Vec<u8>) -> Result<(), String> {
    owns(msg_caller(), canister)?;
    mgmt::delete_canister_snapshot(&mgmt::DeleteCanisterSnapshotArgs { canister_id: canister, snapshot_id: id }).await.map_err(|e| format!("{e:?}"))
}

ic_cdk::export_candid!();

#[cfg(test)]
mod watch_tests {
    use super::*;
    fn w(created: u64, every: Option<u32>, last: Option<u64>, ret: u64, closed: bool) -> Watch {
        Watch { id: 1, owner: Principal::anonymous(), owner_handle: "a".into(), contact: Principal::anonymous(), contact_handle: "b".into(), title: "t".into(), link: "".into(), return_by: ret, every_hours: every, last_check_in: last, created_at: created, closed, overdue: false }
    }
    #[test]
    fn overdue_when_a_check_in_or_the_return_is_missed() {
        let h = HOUR_NS;
        assert!(!watch_overdue(&w(0, Some(24), None, 100 * h, false), 10 * h));
        assert!(watch_overdue(&w(0, Some(24), None, 100 * h, false), 25 * h));
        assert!(!watch_overdue(&w(0, Some(24), Some(20 * h), 100 * h, false), 30 * h));
        assert!(watch_overdue(&w(0, None, None, 100 * h, false), 101 * h));
        assert!(!watch_overdue(&w(0, None, None, 100 * h, true), 500 * h));
    }
}

#[cfg(test)]
mod cost_tests {
    use super::*;
    #[test]
    fn a_message_costs_what_it_takes_and_never_more_than_a_notebook_will_pay() {
        let short = post_cost(200, MESSAGE_DAYS);
        assert!((10_000_000..30_000_000).contains(&short), "{short}");
        assert!(post_cost(2_000, MESSAGE_DAYS) > short);
        assert!(post_cost(200, POST_DAYS) < post_cost(200, MESSAGE_DAYS));
        // the largest board post: 160-char title, 10,000-char body, 8,000-char note, 4 bytes a char
        let worst = post_cost(4 * (160 + 10_000 + 120 + 8_000), POST_DAYS);
        assert!(worst < 1_000_000_000, "{worst} exceeds the notebook's MAX_FEE");
    }
}
