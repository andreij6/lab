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
    /// the wallet a person pays from when it is not their sign-in principal (their OISY account)
    static WALLETS: RefCell<StableBTreeMap<Principal, Principal, Mem>> = RefCell::new(StableBTreeMap::init(MM.with_borrow(|m| m.get(MemoryId::new(32)))));
    // Retired MemoryIds, never to be reused: 6-13 (tokenised notebooks, the market, the judge), 14-31 and
    // 33-55 (community, board, inbox, GitHub, trip check-ins, flags, AI fees, primary notebooks, town,
    // sponsors, problems, newcomers; removed, see the git tag all-features). Start new maps at 56.
}

#[init]
fn init() {
    seed_tokens();
    start_timers();
}
#[post_upgrade]
fn post_upgrade() {
    seed_tokens();
    start_timers();
}
fn start_timers() {
    // ICP collected from spawns becomes the registry's cycles once an hour
    ic_cdk_timers::set_timer_interval_serial(Duration::from_secs(3600), || async {
        let _ = sweep_fees().await;
        let _ = sweep_holdings().await;
        retry_pending().await;
    });
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
    let free = bal.e8s();
    if free < 1_000_000 {
        return Err("under 0.01 ICP on the account".into());
    }
    let args = TransferArgs { memo: MEMO_TOP_UP_CANISTER, amount: Tokens::from_e8s(free - ICP_FEE), fee: DEFAULT_FEE, from_subaccount: Some(DEFAULT_SUBACCOUNT), to: AccountIdentifier::new(&CMC, &cmc_subaccount(me)), created_at_time: None };
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
    spawn_for(msg_caller(), name, None).await
}

/// The same, with the spawn price pulled from `payer`'s allowance (an OISY wallet) instead of the caller's.
#[update]
async fn create_notebook_paid_by(name: String, payer: Principal) -> Result<Notebook, String> {
    if payer == Principal::anonymous() {
        return Err("payer must be a real principal".into());
    }
    spawn_for(msg_caller(), name, Some(payer)).await
}

async fn spawn_for(owner: Principal, name: String, payer: Option<Principal>) -> Result<Notebook, String> {
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
/// registry record of it goes. Notes and history cannot come back.
#[update]
async fn delete_notebook(canister: Principal, refund_to: Option<Principal>) -> Result<Nat, String> {
    let me = msg_caller();
    match NOTEBOOKS.with_borrow(|m| m.get(&canister)) {
        Some(v) if v.0.owner == me => {}
        Some(_) => return Err("not your notebook".into()),
        None => return Err("unknown notebook".into()),
    }
    // a deleted space's cycles go back to the registry, whatever the caller asks (the argument stays for old clients)
    let _ = refund_to;
    let to = canister_self();
    // the freezing reserve (90 days of idle burn) would block the payout: drop it, the canister is going anyway
    let _ = mgmt::update_settings(&mgmt::UpdateSettingsArgs { canister_id: canister, settings: mgmt::CanisterSettings { freezing_threshold: Some(Nat::from(0u8)), ..Default::default() } }).await;
    // a frozen or broken notebook cannot pay out; deleting it still has to work
    // a notebook that answers but cannot pay out stops the deletion, so no cycles are burnt by surprise
    let moved = match Call::unbounded_wait(canister, "drain_cycles").with_arg(to).await {
        Ok(r) => match r.candid::<Result<Nat, NotebookErr>>() {
            Ok(Ok(n)) => n,
            Ok(Err(NotebookErr::Invalid(m))) => return Err(format!("nothing was deleted: {m}")),
            Ok(Err(e)) => return Err(format!("could not move the cycles out, so nothing was deleted: {e:?}")),
            Err(e) => return Err(format!("could not move the cycles out, so nothing was deleted: {e}")),
        },
        Err(_) => Nat::from(0u8),
    };
    mgmt::stop_canister(&mgmt::StopCanisterArgs { canister_id: canister }).await.map_err(|e| format!("stop_canister: {e:?}"))?;
    mgmt::delete_canister(&mgmt::DeleteCanisterArgs { canister_id: canister }).await.map_err(|e| format!("delete_canister: {e:?}"))?;
    NOTEBOOKS.with_borrow_mut(|m| m.remove(&canister));
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

/// The registry keeps no tokens either: ck tokens or TCYCLES on its account become its own cycles hourly.
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

/// ICP already on the registry's account -> the minting canister, for `canister`; the block is kept
/// in PENDING until `notify` settles it. Ok means the ICP has left the account.
async fn send_to_cmc(canister: Principal, e8s: u64) -> Result<u64, String> {
    if e8s <= ICP_FEE * 2 {
        return Err("too little ICP to mint".into());
    }
    let args = TransferArgs { memo: MEMO_TOP_UP_CANISTER, amount: Tokens::from_e8s(e8s - ICP_FEE), fee: DEFAULT_FEE, from_subaccount: Some(DEFAULT_SUBACCOUNT), to: AccountIdentifier::new(&CMC, &cmc_subaccount(canister)), created_at_time: None };
    let r: TransferResult = Call::unbounded_wait(LEDGER, "transfer").with_arg(&args).await.map_err(|e| e.to_string())?.candid().map_err(|e| e.to_string())?;
    let block_index = r.map_err(|e| e.to_string())?;
    PENDING.with_borrow_mut(|p| p.insert(block_index, canister));
    Ok(block_index)
}
/// ICP already on the registry's account -> the minting canister -> the notebook's cycles.
async fn mint_for(canister: Principal, e8s: u64) -> Result<Nat, String> {
    let block_index = send_to_cmc(canister, e8s).await?;
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

/// Top up a notebook through the registry, so it works while the notebook is frozen and cannot
/// take calls itself: `amount_e8s` is pulled from `payer`'s ICRC-2 allowance for the registry
/// (the caller when `payer` is empty; an OISY wallet otherwise), sent to the cycles minting
/// canister for the notebook, and minted into its cycles. Returns the cycles minted. Any
/// registered notebook, from anyone: it is the payer's ICP and the notebook only gains.
#[update]
async fn top_up_notebook(canister: Principal, amount_e8s: u64, payer: Option<Principal>) -> Result<Nat, String> {
    let caller = msg_caller();
    if notebook(canister).is_none() {
        return Err("unknown notebook".into());
    }
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

