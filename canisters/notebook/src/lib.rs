//! A notebook canister: one person's markdown notes, stored as files keyed by path. Spawned by the
//! registry; the owner is the only principal that may read or write it, and a controller who
//! keeps it funded with cycles.
//!
//! The rules follow what REA observed in Obsidian 1.14.4 (docs/REVERSE_ENGINEERING.md): a notebook
//! is a plain folder of files; a name may not contain `# ^ [ ] |` (they break `[[links]]`) nor
//! `\ / :`, and may not end in a dot or a space; `[[links]]` in other notes are rewritten when a
//! note is renamed.

use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::api::{canister_cycle_balance, canister_self, msg_caller, time};
use ic_cdk::call::Call;
use ic_cdk::{init, post_upgrade, query, update};
use ic_cdk_management_canister::{ecdsa_public_key, raw_rand, EcdsaCurve, EcdsaKeyId, EcdsaPublicKeyArgs};
use serde::Serialize;
use sha2::{Digest, Sha256};
use ic_ledger_types::{
    AccountBalanceArgs, AccountIdentifier, Memo, Subaccount, Tokens, TransferArgs, TransferResult, DEFAULT_FEE, DEFAULT_SUBACCOUNT,
    MAINNET_CYCLES_MINTING_CANISTER_ID as CMC, MAINNET_LEDGER_CANISTER_ID as LEDGER,
};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{storable::Bound, DefaultMemoryImpl, StableBTreeMap, StableCell, StableLog, Storable};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};
use std::borrow::Cow;
use std::cell::RefCell;
use std::time::Duration;

const MAX_PATH: usize = 512;
const MAX_CONTENT: usize = 1 << 20; // 1 MiB per file
const MAX_FILES: u64 = 10_000;
/// `# ^ [ ] |` would break `[[links]]`; `\ / :` would break paths (Obsidian's own list).
const FORBIDDEN: &[char] = &['#', '^', '[', ']', '|', '\\', ':'];
/// Where agents used to be confined. A space is run by its agents and its person alike now: nothing
/// is locked, so this is always false and only keeps the old call sites honest.
pub const AGENT_ROOT: &str = "Agents";
pub fn is_agent_path(_p: &str) -> bool {
    false
}

// ---------------------------------------------------------------- types

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Init {
    pub name: String,
    pub owner: Principal,
    pub registry: Principal,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Note {
    pub path: String,
    pub content: String,
    pub created: u64,
    pub modified: u64,
    /// the agent key that wrote it, for notes under `Agents/`
    pub agent: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct FileMeta {
    pub path: String,
    pub size: u64,
    pub created: u64,
    pub modified: u64,
    pub agent: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct AgentKey {
    pub name: String,
    pub created_at: u64,
    pub revoked: bool,
    pub last_used: u64,
    pub writes: u64,
    /// a folder this key may also write under (the clipper's Inbox/, a mail relay's Inbox/Mail); Agents/ is always allowed
    #[serde(default)]
    pub scope: Option<String>,
    /// may move the space's funds over the agent API (the owner turns it on in Manage → Agent);
    /// optional because keys stored before it existed decode without it
    #[serde(default)]
    pub spend: Option<bool>,
    /// the last chat message or board comment id `/v1/inbox` handed this key; optional for keys stored before it existed
    #[serde(default)]
    pub inbox_seen: Option<u64>,
}

/// A transfer an agent made with this space's funds, kept for the owner to audit.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Spend {
    pub agent: String,
    pub symbol: String,
    pub to: Principal,
    pub amount: Nat,
    pub block: Nat,
    pub at: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Share {
    /// a note path, a folder path, or "" for the whole notebook
    pub path: String,
    /// anyone, signed in or not, can read it
    pub public: bool,
    /// readers (besides the owner)
    pub principals: Vec<Principal>,
    /// readers who may also edit the notes covered (never under Agents/); optional so shares
    /// saved before editors existed still decode
    #[serde(default)]
    pub editors: Option<Vec<Principal>>,
    /// readers who may also comment (readers in `principals` are view-only)
    #[serde(default)]
    pub commenters: Option<Vec<Principal>>,
    /// what anyone with the link may do when `public`; missing means Comment (how public shares worked before roles)
    #[serde(default)]
    pub public_role: Option<Role>,
    pub created_at: u64,
}

/// What someone may do with a shared note, lowest to highest.
#[derive(CandidType, Deserialize, Clone, Copy, Debug, PartialEq, PartialOrd)]
pub enum Role {
    View,
    Comment,
    Edit,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ShareArgs {
    pub path: String,
    pub public: bool,
    pub public_role: Option<Role>,
    pub viewers: Vec<Principal>,
    pub commenters: Vec<Principal>,
    pub editors: Vec<Principal>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Revision {
    pub seq: u64,
    pub modified: u64,
    pub size: u64,
    pub agent: Option<String>,
    /// who saved it: the owner, an editor, or an agent
    pub by: Principal,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Comment {
    pub id: u64,
    pub path: String,
    pub author: Principal,
    pub text: String,
    pub at: u64,
    /// the comment this one answers; replies form a thread under a top-level comment
    #[serde(default)]
    pub parent: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Hit {
    pub path: String,
    pub snippet: String,
}


#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Renamed {
    pub file: FileMeta,
    /// notes whose `[[links]]` were rewritten to the new name
    pub relinked: Vec<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Page {
    pub notes: Vec<Note>,
    /// pass back as `after` to continue; absent when this was the last page
    pub next: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Imported {
    pub written: u32,
    /// (path, reason) for files that were refused
    pub failed: Vec<(String, String)>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct FolderRenamed {
    pub moved: u32,
    /// notes whose `[[links]]` were rewritten
    pub relinked: Vec<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
pub enum NotebookError {
    /// only the owner may read or write a notebook
    Unauthorized,
    NotFound,
    Exists,
    Invalid(String),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Info {
    pub name: String,
    pub owner: Principal,
    pub registry: Principal,
    pub created_at: u64,
    pub files: u64,
    pub bytes: u64,
    pub cycles: Nat,
    /// ICP ledger account (hex) that converts to cycles for this canister; send from any wallet
    pub topup_account_id: String,
    pub total_topped_up_e8s: u64,
    pub total_cycles_from_topups: Nat,
    pub pending_topups: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
pub enum TopUpStatus {
    Completed,
    Pending,
    Failed(String),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TopUp {
    /// the payer, or this canister for ICP sent straight to the account
    pub from: Principal,
    pub amount_e8s: u64,
    pub block_index: u64,
    pub cycles: Nat,
    pub at: u64,
    pub status: TopUpStatus,
}

// ---------------------------------------------------------------- stable storage

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

#[derive(CandidType, Deserialize, Clone, Debug)]
struct Config {
    name: String,
    owner: Principal,
    registry: Principal,
    created_at: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct Stored {
    content: String,
    created: u64,
    modified: u64,
    #[serde(default)]
    agent: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct RevStored {
    seq: u64,
    content: String,
    modified: u64,
    agent: Option<String>,
    by: Principal,
}

thread_local! {
    static MM: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    static CONFIG: RefCell<StableCell<C<Config>, Mem>> = RefCell::new(StableCell::init(mem(0), C(Config { name: String::new(), owner: Principal::anonymous(), registry: Principal::anonymous(), created_at: 0 })));
    /// path -> file
    static FILES: RefCell<StableBTreeMap<String, C<Stored>, Mem>> = RefCell::new(StableBTreeMap::init(mem(1)));
    static TOPUPS: RefCell<StableLog<C<TopUp>, Mem, Mem>> = RefCell::new(StableLog::init(mem(2), mem(3)));
    /// folders, including empty ones (a notebook is a folder tree; files alone cannot express an empty folder)
    static FOLDERS: RefCell<StableBTreeMap<String, (), Mem>> = RefCell::new(StableBTreeMap::init(mem(6)));
    /// sha256(key) -> agent key record
    static AGENT_KEYS: RefCell<StableBTreeMap<[u8; 32], C<AgentKey>, Mem>> = RefCell::new(StableBTreeMap::init(mem(7)));
    /// path -> who may read it besides the owner
    static SHARES: RefCell<StableBTreeMap<String, C<Share>, Mem>> = RefCell::new(StableBTreeMap::init(mem(8)));
    /// path -> earlier versions, newest last
    static HISTORY: RefCell<StableBTreeMap<String, C<Vec<RevStored>>, Mem>> = RefCell::new(StableBTreeMap::init(mem(9)));
    /// app settings the owner keeps with the notebook (bookmarks, prefs), as JSON
    static SETTINGS: RefCell<StableCell<C<String>, Mem>> = RefCell::new(StableCell::init(mem(10), C(String::new())));
    static COMMENTS: RefCell<StableBTreeMap<u64, C<Comment>, Mem>> = RefCell::new(StableBTreeMap::init(mem(11)));
    /// the folder published as a public site ("" = everything), or none
    static PUBLISHED: RefCell<StableCell<C<Option<String>>, Mem>> = RefCell::new(StableCell::init(mem(12), C(None)));
    /// CMC-leg block index -> top-up awaiting a successful notify_top_up; retried from a timer
    static PENDING: RefCell<StableBTreeMap<u64, C<TopUp>, Mem>> = RefCell::new(StableBTreeMap::init(mem(4)));
    static TOTALS: RefCell<StableCell<C<(u64, u128)>, Mem>> = RefCell::new(StableCell::init(mem(5), C((0, 0))));
    /// day (days since the epoch) -> how many notes a person changed that day, for streaks
    static DAYS: RefCell<StableBTreeMap<u32, u32, Mem>> = RefCell::new(StableBTreeMap::init(mem(19)));
}
const DAY_NS: u64 = 86_400_000_000_000;
/// A person changed a note today: count it toward their streak (agents' writes do not count).
fn bump_day() {
    let today = (time() / DAY_NS) as u32;
    DAYS.with_borrow_mut(|d| {
        let n = d.get(&today).unwrap_or(0) + 1;
        d.insert(today, n);
        // ponytail: 400 days is plenty for a streak and a year's activity
        while d.len() > 400 { let first = d.first_key_value().map(|(k, _)| k); if let Some(k) = first { d.remove(&k); } else { break; } }
    });
}
/// Consecutive days with a change, ending today or yesterday.
fn streak_days(today: u32) -> u32 {
    DAYS.with_borrow(|d| {
        let mut day = if d.contains_key(&today) { today } else if today > 0 && d.contains_key(&(today - 1)) { today - 1 } else { return 0 };
        let mut n = 0;
        while d.contains_key(&day) { n += 1; if day == 0 { break; } day -= 1; }
        n
    })
}
fn mem(id: u8) -> Mem {
    MM.with_borrow(|m| m.get(MemoryId::new(id)))
}
fn config() -> Config {
    CONFIG.with_borrow(|c| c.get().0.clone())
}

// ---------------------------------------------------------------- lifecycle

/// What a new space starts with: a front page and a first project.
fn index_page(name: &str) -> String {
    format!(
        "# {name}\n\nThis is the front page of your space. Your agents write here, and so can you.\n\n- New note: ⌘N. Open or create by name: ⌘K. Every command: ⌘⇧P.\n- Link notes with [[double brackets]]; backlinks and the graph follow on their own.\n- Folders, drawings, templates and sharing live in the right-click menu of the file list.\n- Manage (from Agent Space) shows cycles, backups, sharing, publishing and agent keys.\n\n#index\n"
    )
}

#[init]
fn init(a: Init) {
    let now = time();
    CONFIG.with_borrow_mut(|c| c.set(C(Config { name: a.name.clone(), owner: a.owner, registry: a.registry, created_at: now })));
    FILES.with_borrow_mut(|f| f.insert("index.md".into(), C(Stored { content: index_page(&a.name), created: now, modified: now, agent: None })));
    // a Projects folder with one project note, so the Work tab has something to show from day one
    FOLDERS.with_borrow_mut(|f| f.insert("Projects".into(), ()));
    FILES.with_borrow_mut(|f| f.insert("Projects/First project.md".into(), C(Stored { content: "---\ntype: project\nstatus: active\ngoal: Get this notebook working for you\n---\n# First project\n\nProjects are notes with `type: project` in the front matter; the Work tab lists them with their open tasks and milestones.\n\n## Milestones\n\n- [ ] Write the index page in your own words\n- [ ] Make a daily note (⌘⇧D)\n- [ ] Link two notes with [[double brackets]]\n\n## Notes\n\n".into(), created: now, modified: now, agent: None })));
    start_timers();
}
#[post_upgrade]
fn post_upgrade() {
    start_timers();
}
fn start_timers() {
    ic_cdk_timers::set_timer_interval_serial(Duration::from_secs(300), retry_pending);
    ic_cdk_timers::set_timer_interval_serial(Duration::from_secs(600), deposit_tick);
}

// ---------------------------------------------------------------- paths and links (pure)

/// Validate a notebook path: `a/b/Note.md`, no empty, `.` or `..` segments, no forbidden characters,
/// no segment ending in a dot or a space.
pub fn check_path(p: &str) -> Result<String, NotebookError> {
    let bad = |m: String| Err(NotebookError::Invalid(m));
    let p = p.trim().trim_start_matches('/');
    if p.is_empty() || p.len() > MAX_PATH {
        return bad(format!("path must be 1-{MAX_PATH} characters"));
    }
    if p.chars().any(char::is_control) {
        return bad("path contains control characters".into());
    }
    for seg in p.split('/') {
        if seg.is_empty() || seg == "." || seg == ".." {
            return bad("path has an empty, '.' or '..' segment".into());
        }
        if stem(seg).ends_with('.') || stem(seg).ends_with(' ') {
            return bad("file names cannot end with a dot or a space".into());
        }
        if seg.contains(FORBIDDEN) {
            return bad(format!("file name cannot contain any of {}", FORBIDDEN.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(" ")));
        }
    }
    Ok(p.to_string())
}

/// `Folder/Note.md` -> `Folder/Note`
fn stem(path: &str) -> &str {
    path.strip_suffix(".md").unwrap_or(path)
}
/// `Folder/Note.md` -> `Note`
fn base(path: &str) -> &str {
    stem(path).rsplit('/').next().unwrap_or("")
}

/// Attachments (images, audio, PDF) are stored as `data:` URLs; `read_all`/`read_page` leave
/// their content out so a notebook with pictures still loads in one go. `read` fetches one.
pub fn is_attachment(path: &str) -> bool {
    let ext = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "avif" | "ico" | "pdf" | "mp3" | "wav" | "ogg" | "m4a" | "flac" | "mp4" | "webm" | "mov" | "m4v")
}

/// Rewrite `[[old]]` links (also `[[old|alias]]`, `[[old#heading]]`, `![[old]]`) to point at
/// `new`, the way Obsidian offers on rename. A link names a note by its bare name or by its path
/// without `.md`; each form is replaced by the matching form of the new name. `None` if unchanged.
pub fn relink(content: &str, old: &str, new: &str) -> Option<String> {
    let (old_path, old_base, new_path, new_base) = (stem(old), base(old), stem(new), base(new));
    let mut out = String::with_capacity(content.len());
    let mut rest = content;
    let mut changed = false;
    while let Some(i) = rest.find("[[") {
        let (head, tail) = rest.split_at(i + 2);
        out.push_str(head);
        let Some(j) = tail.find("]]") else {
            out.push_str(tail);
            rest = "";
            break;
        };
        let inner = &tail[..j];
        if inner.contains("[[") {
            // not a link (Obsidian rejects nested `[[`); keep scanning from the inner one
            rest = tail;
            continue;
        }
        let end = inner.find(['|', '#']).unwrap_or(inner.len());
        let (target, suffix) = inner.split_at(end);
        let t = target.trim();
        // A bare name stays a bare name (Obsidian's "shortest" link format), a path stays a path.
        // ponytail: case-sensitive match; Obsidian resolves link names case-insensitively
        let replacement = if t == old_base {
            Some(new_base)
        } else if t == old_path {
            Some(new_path)
        } else {
            None
        };
        match replacement {
            Some(r) => {
                out.push_str(r);
                out.push_str(suffix);
                changed = true;
            }
            None => out.push_str(inner),
        }
        out.push_str("]]");
        rest = &tail[j + 2..];
    }
    out.push_str(rest);
    changed.then_some(out)
}

// ---------------------------------------------------------------- folders

/// Remember every ancestor folder of `path` (`a/b/c.md` -> `a`, `a/b`).
fn register_parents(path: &str) {
    FOLDERS.with_borrow_mut(|f| {
        let mut acc = String::new();
        for seg in path.split('/').collect::<Vec<_>>().iter().take(path.matches('/').count()) {
            if !acc.is_empty() {
                acc.push('/');
            }
            acc.push_str(seg);
            f.insert(acc.clone(), ());
        }
    });
}

/// Create a folder (and its ancestors); creating an existing folder is fine.
#[update]
fn mkdir(path: String) -> Result<String, NotebookError> {
    owner()?;
    let path = check_path(&path)?;
    people_only(&path)?;
    if FILES.with_borrow(|f| f.contains_key(&path)) {
        return Err(NotebookError::Exists);
    }
    register_parents(&path);
    FOLDERS.with_borrow_mut(|f| f.insert(path.clone(), ()));
    Ok(path)
}

/// Every folder, sorted, including empty ones.
#[query]
fn folders() -> Result<Vec<String>, NotebookError> {
    owner()?;
    Ok(FOLDERS.with_borrow(|f| f.iter().map(|e| e.key().clone()).collect()))
}

/// Delete a folder with everything in it; returns how many files went.
#[update]
fn delete_folder(path: String) -> Result<u32, NotebookError> {
    owner()?;
    let path = check_path(&path)?;
    if !FOLDERS.with_borrow(|f| f.contains_key(&path)) {
        return Err(NotebookError::NotFound);
    }
    let prefix = format!("{path}/");
    let files: Vec<String> = FILES.with_borrow(|f| f.iter().map(|e| e.key().clone()).filter(|p| p.starts_with(&prefix)).collect());
    FILES.with_borrow_mut(|f| files.iter().for_each(|p| {
        f.remove(p);
    }));
    let dirs: Vec<String> = FOLDERS.with_borrow(|f| f.iter().map(|e| e.key().clone()).filter(|p| *p == path || p.starts_with(&prefix)).collect());
    FOLDERS.with_borrow_mut(|f| dirs.iter().for_each(|p| {
        f.remove(p);
    }));
    Ok(files.len() as u32)
}

/// Move or rename a folder: every file under it moves, and `[[links]]` follow.
#[update]
fn rename_folder(from: String, to: String) -> Result<FolderRenamed, NotebookError> {
    owner()?;
    let from = check_path(&from)?;
    let to = check_path(&to)?;
    if from == to || to.starts_with(&format!("{from}/")) {
        return Err(NotebookError::Invalid("cannot move a folder into itself".into()));
    }
    people_only(&from)?;
    people_only(&to)?;
    if !FOLDERS.with_borrow(|f| f.contains_key(&from)) {
        return Err(NotebookError::NotFound);
    }
    if FOLDERS.with_borrow(|f| f.contains_key(&to)) || FILES.with_borrow(|f| f.contains_key(&to)) {
        return Err(NotebookError::Exists);
    }
    let prefix = format!("{from}/");
    let files: Vec<String> = FILES.with_borrow(|f| f.iter().map(|e| e.key().clone()).filter(|p| p.starts_with(&prefix)).collect());
    let mut relinked = vec![];
    for p in &files {
        let r = do_rename(p, &format!("{to}/{}", &p[prefix.len()..]))?;
        relinked.extend(r.relinked);
    }
    let dirs: Vec<String> = FOLDERS.with_borrow(|f| f.iter().map(|e| e.key().clone()).filter(|p| *p == from || p.starts_with(&prefix)).collect());
    FOLDERS.with_borrow_mut(|f| {
        for d in &dirs {
            f.remove(d);
            f.insert(format!("{to}{}", &d[from.len()..]), ());
        }
    });
    register_parents(&to);
    relinked.sort();
    relinked.dedup();
    Ok(FolderRenamed { moved: files.len() as u32, relinked })
}

// ---------------------------------------------------------------- history

const MAX_REVISIONS: usize = 20;
const MAX_HISTORY_BYTES: usize = 2_000_000;

/// Keep the version being replaced, if the content actually changes.
fn record(path: &str, prev: &Stored, new_content: &str, by: Principal) {
    if prev.content == new_content {
        return;
    }
    HISTORY.with_borrow_mut(|h| {
        let mut v = h.get(&path.to_string()).map(|c| c.0).unwrap_or_default();
        let seq = v.last().map(|r| r.seq + 1).unwrap_or(1);
        v.push(RevStored { seq, content: prev.content.clone(), modified: prev.modified, agent: prev.agent.clone(), by });
        while v.len() > MAX_REVISIONS || v.iter().map(|r| r.content.len()).sum::<usize>() > MAX_HISTORY_BYTES {
            v.remove(0);
        }
        h.insert(path.to_string(), C(v));
    });
}

/// Earlier versions of a note, newest first.
#[query]
fn history(path: String) -> Result<Vec<Revision>, NotebookError> {
    owner()?;
    let path = check_path(&path)?;
    let mut v: Vec<Revision> = HISTORY.with_borrow(|h| h.get(&path).map(|c| c.0).unwrap_or_default()).into_iter().map(|r| Revision { seq: r.seq, modified: r.modified, size: r.content.len() as u64, agent: r.agent, by: r.by }).collect();
    v.reverse();
    Ok(v)
}

/// One earlier version in full; restore it by writing it back.
#[query]
fn revision(path: String, seq: u64) -> Result<Note, NotebookError> {
    owner()?;
    let path = check_path(&path)?;
    let r = HISTORY.with_borrow(|h| h.get(&path).map(|c| c.0).unwrap_or_default()).into_iter().find(|r| r.seq == seq).ok_or(NotebookError::NotFound)?;
    Ok(Note { path, content: r.content, created: r.modified, modified: r.modified, agent: r.agent })
}

// ---------------------------------------------------------------- settings (bookmarks, prefs)

#[query]
fn get_settings() -> Result<String, NotebookError> {
    owner()?;
    Ok(SETTINGS.with_borrow(|s| s.get().0.clone()))
}

#[update]
fn set_settings(json: String) -> Result<(), NotebookError> {
    owner()?;
    if json.len() > 65_536 {
        return Err(NotebookError::Invalid("settings are limited to 64 KB".into()));
    }
    SETTINGS.with_borrow_mut(|s| s.set(C(json)));
    Ok(())
}

// ---------------------------------------------------------------- search in the canister

/// Case-insensitive search over every note (name matches first); for notebooks too big to load.
fn do_search(q: &str, limit: usize) -> Vec<Hit> {
    let q = q.trim().to_lowercase();
    if q.is_empty() {
        return vec![];
    }
    FILES.with_borrow(|f| {
        let mut names = vec![];
        let mut bodies = vec![];
        for e in f.iter() {
            if is_attachment(e.key()) {
                continue;
            }
            if base(e.key()).to_lowercase().contains(&q) {
                names.push(Hit { path: e.key().clone(), snippet: String::new() });
            } else {
                let c = &e.value().0.content;
                if let Some(i) = c.to_lowercase().find(&q) {
                    let start = c.char_indices().map(|(i, _)| i).filter(|&x| x <= i.saturating_sub(40)).last().unwrap_or(0);
                    let end = c.char_indices().map(|(i, _)| i).find(|&x| x >= (i + q.len() + 60).min(c.len())).unwrap_or(c.len());
                    bodies.push(Hit { path: e.key().clone(), snippet: c[start..end].split_whitespace().collect::<Vec<_>>().join(" ") });
                }
            }
        }
        names.extend(bodies);
        names.truncate(limit);
        names
    })
}

#[query]
fn search_notes(q: String, limit: u32) -> Result<Vec<Hit>, NotebookError> {
    owner()?;
    Ok(do_search(&q, limit.clamp(1, 200) as usize))
}

// ---------------------------------------------------------------- files

fn owner() -> Result<(), NotebookError> {
    if msg_caller() == config().owner {
        Ok(())
    } else {
        Err(NotebookError::Unauthorized)
    }
}

fn meta(path: &str, s: &Stored) -> FileMeta {
    FileMeta { path: path.into(), size: s.content.len() as u64, created: s.created, modified: s.modified, agent: s.agent.clone() }
}
fn to_note(path: &str, s: &Stored, with_content: bool) -> Note {
    Note { path: path.into(), content: if with_content { s.content.clone() } else { String::new() }, created: s.created, modified: s.modified, agent: s.agent.clone() }
}
fn people_only(path: &str) -> Result<(), NotebookError> {
    if is_agent_path(path) {
        return Err(NotebookError::Invalid(format!("{AGENT_ROOT}/ is written by agents only; issue an agent key in Manage")));
    }
    Ok(())
}

/// Every file in the notebook (metadata only), sorted by path.
#[query]
fn list() -> Result<Vec<FileMeta>, NotebookError> {
    owner()?;
    Ok(FILES.with_borrow(|f| f.iter().map(|e| meta(e.key(), &e.value().0)).collect()))
}

#[query]
fn read(path: String) -> Result<Note, NotebookError> {
    owner()?;
    let path = check_path(&path)?;
    let s = FILES.with_borrow(|f| f.get(&path).map(|c| c.0)).ok_or(NotebookError::NotFound)?;
    Ok(to_note(&path, &s, true))
}

/// The whole notebook (attachments listed without content), so the client can index links,
/// tags and search locally.
// ponytail: one response; `read_page` is the paged form for notebooks past ~1.5 MB
#[query]
fn read_all() -> Result<Vec<Note>, NotebookError> {
    owner()?;
    Ok(FILES.with_borrow(|f| f.iter().map(|e| to_note(e.key(), &e.value().0, !is_attachment(e.key()))).collect()))
}

const PAGE_BYTES: usize = 1_500_000;

/// Notes after `after` (exclusive), up to `limit` of them or ~1.5 MB, whichever first.
#[query]
fn read_page(after: Option<String>, limit: u32) -> Result<Page, NotebookError> {
    owner()?;
    let limit = limit.clamp(1, 1000) as usize;
    let mut notes = vec![];
    let mut bytes = 0usize;
    let mut next = None;
    FILES.with_borrow(|f| {
        let iter: Box<dyn Iterator<Item = _>> = match &after {
            Some(a) => Box::new(f.range((std::ops::Bound::Excluded(a.clone()), std::ops::Bound::Unbounded))),
            None => Box::new(f.iter()),
        };
        for e in iter {
            let n = to_note(e.key(), &e.value().0, !is_attachment(e.key()));
            if !notes.is_empty() && (notes.len() >= limit || bytes + n.content.len() > PAGE_BYTES) {
                next = Some(notes.last().map(|n: &Note| n.path.clone()).unwrap());
                break;
            }
            bytes += n.content.len();
            notes.push(n);
        }
    });
    Ok(Page { notes, next })
}

/// Import many files at once (an Obsidian import); bad names are reported, not fatal.
#[update]
fn write_many(files: Vec<(String, String)>, overwrite: bool) -> Result<Imported, NotebookError> {
    owner()?;
    let now = time();
    let mut written = 0;
    let mut failed = vec![];
    let mut changed_any = false;
    for (p, content) in files {
        let path = match check_path(&p).and_then(|x| people_only(&x).map(|_| x)) {
            Ok(x) => x,
            Err(NotebookError::Invalid(m)) => {
                failed.push((p, m));
                continue;
            }
            Err(e) => return Err(e),
        };
        if content.len() > MAX_CONTENT {
            failed.push((path, format!("larger than {MAX_CONTENT} bytes")));
            continue;
        }
        let same = FILES.with_borrow(|f| f.get(&path).is_some_and(|c| c.0.content == content));
        let r = FILES.with_borrow_mut(|f| {
            let created = match f.get(&path) {
                Some(_) if !overwrite => return Err("exists"),
                Some(c) => {
                    record(&path, &c.0, &content, msg_caller());
                    c.0.created
                }
                None if f.len() >= MAX_FILES => return Err("notebook is full"),
                None => now,
            };
            f.insert(path.clone(), C(Stored { content, created, modified: now, agent: None }));
            Ok(())
        });
        match r {
            Ok(()) => {
                register_parents(&path);
                written += 1;
                if !same && path.ends_with(".md") { changed_any = true; }
            }
            Err(m) => failed.push((path, m.into())),
        }
    }
    if changed_any { bump_day(); }
    Ok(Imported { written, failed })
}

/// Create or overwrite a file.
#[update]
fn write(path: String, content: String) -> Result<FileMeta, NotebookError> {
    owner()?;
    let path = check_path(&path)?;
    people_only(&path)?;
    if content.len() > MAX_CONTENT {
        return Err(NotebookError::Invalid(format!("a file is limited to {} bytes", MAX_CONTENT)));
    }
    let now = time();
    let changed = FILES.with_borrow(|f| f.get(&path).map_or(true, |c| c.0.content != content));
    let s = FILES.with_borrow_mut(|f| {
        let created = match f.get(&path) {
            Some(c) => {
                record(&path, &c.0, &content, msg_caller());
                c.0.created
            }
            None if f.len() >= MAX_FILES => return Err(NotebookError::Invalid(format!("{MAX_FILES} files; delete some"))),
            None => now,
        };
        let s = Stored { content, created, modified: now, agent: None };
        f.insert(path.clone(), C(s.clone()));
        Ok(s)
    })?;
    register_parents(&path);
    if changed && path.ends_with(".md") { bump_day(); }
    Ok(meta(&path, &s))
}

/// Move or rename a file; `[[links]]` to a renamed note are rewritten in every other note.
#[update]
fn rename(from: String, to: String) -> Result<Renamed, NotebookError> {
    owner()?;
    let from = check_path(&from)?;
    let to = check_path(&to)?;
    if from == to {
        return Err(NotebookError::Invalid("same path".into()));
    }
    people_only(&from)?;
    people_only(&to)?;
    do_rename(&from, &to)
}

fn do_rename(from: &str, to: &str) -> Result<Renamed, NotebookError> {
    let now = time();
    let s = FILES.with_borrow_mut(|f| {
        if f.contains_key(&to.to_string()) {
            return Err(NotebookError::Exists);
        }
        let mut s = f.remove(&from.to_string()).ok_or(NotebookError::NotFound)?.0;
        s.modified = now;
        f.insert(to.to_string(), C(s.clone()));
        Ok(s)
    })?;
    register_parents(to);
    if let Some(sh) = SHARES.with_borrow_mut(|m| m.remove(&from.to_string())) {
        SHARES.with_borrow_mut(|m| m.insert(to.to_string(), C(Share { path: to.to_string(), ..sh.0 })));
    }
    if let Some(h) = HISTORY.with_borrow_mut(|m| m.remove(&from.to_string())) {
        HISTORY.with_borrow_mut(|m| m.insert(to.to_string(), h));
    }
    let mut relinked = vec![];
    if from.ends_with(".md") {
        let changes: Vec<(String, Stored)> = FILES.with_borrow(|f| {
            f.iter()
                .filter_map(|e| relink(&e.value().0.content, from, to).map(|content| (e.key().clone(), Stored { content, ..e.value().0 })))
                .collect()
        });
        FILES.with_borrow_mut(|f| {
            for (p, s) in changes {
                f.insert(p.clone(), C(s));
                relinked.push(p);
            }
        });
    }
    Ok(Renamed { file: meta(to, &s), relinked })
}

#[update]
fn delete(path: String) -> Result<(), NotebookError> {
    owner()?;
    let path = check_path(&path)?;
    SHARES.with_borrow_mut(|m| m.remove(&path));
    HISTORY.with_borrow_mut(|m| m.remove(&path));
    FILES.with_borrow_mut(|f| f.remove(&path)).map(|_| ()).ok_or(NotebookError::NotFound)
}

#[query]
fn info() -> Info {
    let c = config();
    Info {
        name: c.name,
        owner: c.owner,
        registry: c.registry,
        created_at: c.created_at,
        files: FILES.with_borrow(|f| f.len()),
        // ponytail: O(files) scan; keep a running total if notebooks get large
        bytes: FILES.with_borrow(|f| f.iter().map(|e| e.value().0.content.len() as u64).sum()),
        cycles: Nat::from(canister_cycle_balance()),
        topup_account_id: AccountIdentifier::new(&canister_self(), &DEFAULT_SUBACCOUNT).to_hex(),
        total_topped_up_e8s: TOTALS.with_borrow(|t| t.get().0 .0),
        total_cycles_from_topups: Nat::from(TOTALS.with_borrow(|t| t.get().0 .1)),
        pending_topups: PENDING.with_borrow(|p| p.len()),
    }
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Usage {
    pub files: u64,
    /// markdown notes among the files
    pub notes: u64,
    /// when any file last changed (ns), or none for an empty notebook
    pub last_modified: Option<u64>,
    /// `[[links]]` across the notes
    pub links: u64,
    /// consecutive days (ending today or yesterday) on which a person changed a note
    pub streak: u32,
    /// days with a change in the last 30
    pub active_days: u32,
    /// an agent key was used in the last 7 days
    pub agent_active: bool,
}

/// How big and how recently used this notebook is, for the registry's numbers and the town's
/// quests. Counts only, nothing from inside the notes.
#[query]
fn usage() -> Usage {
    let today = (time() / DAY_NS) as u32;
    // ponytail: one pass over every note's text per call; the registry asks a few times a day
    let (files, notes, links, last_modified) = FILES.with_borrow(|f| {
        let (mut notes, mut links, mut last) = (0u64, 0u64, None::<u64>);
        for e in f.iter() {
            let st = e.value().0;
            last = last.max(Some(st.modified));
            // agents' notes are theirs, not the person's writing
            if e.key().ends_with(".md") && !e.key().starts_with("Agents/") { notes += 1; links += st.content.matches("[[").count() as u64; }
        }
        (f.len(), notes, links, last)
    });
    let active_days = DAYS.with_borrow(|d| d.range(today.saturating_sub(29)..=today).count() as u32);
    // an agent used a key this week: the town sends a courier to the house
    let agent_active = AGENT_KEYS.with_borrow(|m| m.iter().any(|e| !e.value().0.revoked && e.value().0.last_used + 7 * DAY_NS > time()));
    Usage { files, notes, last_modified, links, streak: streak_days(today), active_days, agent_active }
}
/// Someone's role over the whole notebook, for the registry (so a team member may top it up).
#[query]
fn role_of(who: Principal) -> Option<Role> {
    if msg_caller() != config().registry { return None; }
    access("", who)
}

// ---------------------------------------------------------------- ownership and the quality audit

/// Hand the notebook to a new owner. Only the registry calls this, after a sale or an ICRC-7
/// transfer it brokered. Agent keys and the auto top-up payer belonged to the old owner, so they go.
#[update]
fn transfer_owner(new_owner: Principal) -> Result<(), NotebookError> {
    if msg_caller() != config().registry {
        return Err(NotebookError::Unauthorized);
    }
    if new_owner == Principal::anonymous() {
        return Err(NotebookError::Invalid("new owner must be a real principal".into()));
    }
    CONFIG.with_borrow_mut(|c| {
        let mut cfg = c.get().0.clone();
        cfg.owner = new_owner;
        c.set(C(cfg));
    });
    let keys: Vec<[u8; 32]> = AGENT_KEYS.with_borrow(|k| k.iter().map(|e| *e.key()).collect());
    AGENT_KEYS.with_borrow_mut(|k| for key in keys { k.remove(&key); });
    SETTINGS.with_borrow_mut(|s| s.set(C(String::new())));
    Ok(())
}

// ---------------------------------------------------------------- documents from the web

/// A public document fetched for the owner to view: where it ended up, what the site said it is,
/// and its bytes. Nothing is stored; the app keeps a copy only when the owner saves one.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Fetched {
    pub url: String,
    pub content_type: String,
    pub bytes: Vec<u8>,
}

/// Replies carry at most 2 MiB, so the document must fit under that with room to spare.
const MAX_FETCH: u64 = 1_900_000;

/// Fetch a public document (a PDF linked from a note) over HTTPS, following up to three
/// redirects. Owner only; the notebook pays for the outcall in cycles.
#[update]
async fn fetch_url(url: String) -> Result<Fetched, NotebookError> {
    owner()?;
    let mut url = url.trim().to_string();
    for _ in 0..4 {
        if !url.starts_with("https://") || url.len() > 2048 || url.contains(char::is_whitespace) {
            return Err(NotebookError::Invalid("only https:// links can be fetched".into()));
        }
        let r = ic_cdk_management_canister::HttpRequest::new(url.clone())
            .with_max_response_bytes(MAX_FETCH)
            .with_header("User-Agent", "lab-notebook")
            .with_transform(ic_cdk_management_canister::transform_context_from_query("transform_fetch".into(), vec![]))
            .send()
            .await
            .map_err(|e| {
                let e = e.to_string();
                NotebookError::Invalid(if e.contains("size limit") { "it is over 1.9 MB, more than a notebook can fetch; download it and import it instead".into() } else { format!("could not fetch it: {e}") })
            })?;
        let status: u32 = r.status.0.clone().try_into().unwrap_or(0);
        let header = |name: &str| r.headers.iter().find(|h| h.name.eq_ignore_ascii_case(name)).map(|h| h.value.clone());
        if (300..400).contains(&status) {
            let loc = header("location").ok_or_else(|| NotebookError::Invalid(format!("the site answered {status} without a new address")))?;
            url = resolve_location(&url, &loc);
            continue;
        }
        if status != 200 {
            return Err(NotebookError::Invalid(format!("the site answered {status}")));
        }
        return Ok(Fetched { url, content_type: header("content-type").unwrap_or_default(), bytes: r.body });
    }
    Err(NotebookError::Invalid("too many redirects".into()))
}

/// Every replica must agree on the response: keep the body, the status, and only the two headers
/// this notebook reads (dates, cookies and request ids differ from replica to replica).
#[query]
fn transform_fetch(args: ic_cdk_management_canister::TransformArgs) -> ic_cdk_management_canister::HttpRequestResult {
    let headers = args.response.headers.into_iter().filter(|h| h.name.eq_ignore_ascii_case("location") || h.name.eq_ignore_ascii_case("content-type")).collect();
    ic_cdk_management_canister::HttpRequestResult { status: args.response.status, headers, body: args.response.body }
}

/// A redirect's Location may be absolute, host-relative ("/x") or relative to the current path.
fn resolve_location(current: &str, loc: &str) -> String {
    if loc.starts_with("https://") || loc.starts_with("http://") {
        return loc.to_string();
    }
    let origin_end = current.find("://").map(|i| current[i + 3..].find('/').map_or(current.len(), |j| i + 3 + j)).unwrap_or(current.len());
    if let Some(rest) = loc.strip_prefix('/') {
        return format!("{}/{rest}", &current[..origin_end]);
    }
    let dir = current[..current.rfind('/').filter(|&i| i >= origin_end).unwrap_or(origin_end)].to_string();
    format!("{dir}/{loc}")
}

// ---- live prices for the Crypto kit, from ICP's exchange rate canister (XRC)

#[derive(CandidType, Deserialize, Clone)]
enum AssetClass {
    Cryptocurrency,
    FiatCurrency,
}
#[derive(CandidType, Deserialize, Clone)]
struct Asset {
    symbol: String,
    class: AssetClass,
}
#[derive(CandidType)]
struct RateRequest {
    base_asset: Asset,
    quote_asset: Asset,
    timestamp: Option<u64>,
}
/// The fields of XRC's ExchangeRate this notebook reads; candid skips the rest.
#[derive(Deserialize, CandidType)]
struct RateMeta {
    decimals: u32,
}
#[derive(Deserialize, CandidType)]
struct Rate {
    rate: u64,
    timestamp: u64,
    metadata: RateMeta,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct Price {
    pub symbol: String,
    /// in US dollars; None when the exchanges the XRC reads do not list it
    pub usd: Option<f64>,
    /// the minute the rate is for, in seconds since the epoch
    pub at: u64,
}

/// XRC takes 1B cycles with each request and refunds what it does not use.
const XRC_CYCLES: u128 = 1_000_000_000;
const MAX_PRICES: usize = 8;

/// Await every future at once (the XRC's outcalls take seconds each; one after another adds up).
async fn join_all<F: std::future::Future>(fs: Vec<F>) -> Vec<F::Output> {
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

fn valid_symbol(s: &str) -> bool {
    !s.is_empty() && s.len() <= 10 && s.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
}

/// The last minute's USD price of each symbol (BTC, ETH, SOL, ...), from `xrc`: the exchange rate
/// canister on mainnet, a stand-in locally. Owner only; the notebook pays up to 1B cycles a symbol.
#[update]
async fn prices(xrc: Principal, symbols: Vec<String>) -> Result<Vec<Price>, NotebookError> {
    owner()?;
    let symbols: Vec<String> = symbols.into_iter().map(|s| s.trim().to_ascii_uppercase()).collect();
    if symbols.len() > MAX_PRICES || !symbols.iter().all(|s| valid_symbol(s)) {
        return Err(NotebookError::Invalid(format!("up to {MAX_PRICES} symbols like BTC or ETH")));
    }
    if ic_cdk::api::canister_liquid_cycle_balance() < symbols.len() as u128 * XRC_CYCLES + PAY_FLOOR {
        return Err(NotebookError::Invalid("this notebook is too low on cycles; top it up".into()));
    }
    // the previous whole minute: every exchange has reported it by now
    let minute = time() / 1_000_000_000 / 60 * 60 - 60;
    let usd = Asset { symbol: "USD".into(), class: AssetClass::FiatCurrency };
    let calls = symbols.iter().map(|s| {
        let req = RateRequest { base_asset: Asset { symbol: s.clone(), class: AssetClass::Cryptocurrency }, quote_asset: usd.clone(), timestamp: Some(minute) };
        async move {
            let r = Call::bounded_wait(xrc, "get_exchange_rate").change_timeout(60).with_cycles(XRC_CYCLES).with_arg(&req).await.ok()?;
            let r: Result<Rate, candid::Reserved> = r.candid().ok()?;
            r.ok()
        }
    });
    let rates = join_all(calls.collect()).await;
    Ok(symbols.into_iter().zip(rates).map(|(symbol, r)| match r {
        Some(r) => Price { symbol, usd: Some(r.rate as f64 / 10f64.powi(r.metadata.decimals as i32)), at: r.timestamp },
        None => Price { symbol, usd: None, at: minute },
    }).collect())
}

/// The most one community fee may be (a long board post is ~0.03 B cycles), and what a notebook keeps
/// above its freezing reserve after paying: chatting never freezes anyone's notes.
const MAX_FEE: u128 = 1_000_000_000;
const PAY_FLOOR: u128 = 100_000_000_000;

/// Pay the registry what one of the owner's chat messages or board posts costs it in cycles. The
/// cycles ride on a call to the registry's `accept_fee`, so the registry counts what arrived rather
/// than trusting this reply. Registry only.
#[update]
async fn pay_registry(cycles: Nat) -> Result<(), NotebookError> {
    let reg = config().registry;
    if msg_caller() != reg {
        return Err(NotebookError::Unauthorized);
    }
    let c: u128 = cycles.0.try_into().map_err(|_| NotebookError::Invalid("fee too large".into()))?;
    if c > MAX_FEE {
        return Err(NotebookError::Invalid("fee too large".into()));
    }
    if ic_cdk::api::canister_liquid_cycle_balance() < c + PAY_FLOOR {
        return Err(NotebookError::Invalid("this notebook is too low on cycles; top it up".into()));
    }
    Call::bounded_wait(reg, "accept_fee").with_cycles(c).await.map_err(|e| NotebookError::Invalid(format!("accept_fee: {e}")))?;
    Ok(())
}

/// Kept back when draining: the replica reserves ~37B for the deposit call and its reply.
// ponytail: a flat 0.05 TC margin; read the shortfall out of InsufficientLiquidCycleBalance and retry if it matters
const DRAIN_KEEP: u128 = 50_000_000_000;

/// Send this notebook's cycles to `to` (another of the owner's notebooks, or the registry) just
/// before the registry deletes it, so they are not burnt with the canister. Registry only.
#[update]
async fn drain_cycles(to: Principal) -> Result<Nat, NotebookError> {
    if msg_caller() != config().registry {
        return Err(NotebookError::Unauthorized);
    }
    // a space with money in it is not deleted: the registry stops when the drain refuses
    let held = wallet_usd_cents().await.map_err(|e| NotebookError::Invalid(format!("the wallet could not be valued ({e}); try again in a moment")))?;
    if held >= MAX_WALLET_CENTS_TO_DELETE {
        return Err(NotebookError::Invalid(format!("the wallet still holds about ${}.{:02}: move it out (under $5) before deleting", held / 100, held % 100)));
    }
    // liquid = what may be spent after the reserves; the margin pays for the deposit call itself
    let amount = ic_cdk::api::canister_liquid_cycle_balance().saturating_sub(DRAIN_KEEP);
    if amount > 0 {
        ic_cdk_management_canister::deposit_cycles(&ic_cdk_management_canister::DepositCyclesArgs { canister_id: to }, amount)
            .await
            .map_err(|e| NotebookError::Invalid(format!("deposit_cycles: {e:?}")))?;
    }
    Ok(Nat::from(amount))
}

/// Deletion stops at this much in the wallet.
const MAX_WALLET_CENTS_TO_DELETE: u128 = 500;
/// One XDR in US cents, near enough for that rule (the exchange rate canister has no XDR pair).
const XDR_CENTS: u128 = 136;
const XRC_MAINNET: &str = "uf6dk-hyaaa-aaaaq-qaaaq-cai";
#[derive(CandidType, Deserialize)]
struct CmcRate { xdr_permyriad_per_icp: u64 }
#[derive(CandidType, Deserialize)]
struct CmcRateResponse { data: CmcRate }
/// Today's US dollar price of a coin from the exchange rate canister (the space pays the call), or none.
async fn price_usd(symbol: &str) -> Option<f64> {
    let xrc = Principal::from_text(XRC_MAINNET).ok()?;
    let minute = time() / 1_000_000_000 / 60 * 60 - 60;
    let req = RateRequest { base_asset: Asset { symbol: symbol.into(), class: AssetClass::Cryptocurrency }, quote_asset: Asset { symbol: "USD".into(), class: AssetClass::FiatCurrency }, timestamp: Some(minute) };
    let r = Call::bounded_wait(xrc, "get_exchange_rate").change_timeout(60).with_cycles(XRC_CYCLES).with_arg(&req).await.ok()?;
    let r: Result<Rate, candid::Reserved> = r.candid().ok()?;
    let r = r.ok()?;
    Some(r.rate as f64 / 10f64.powi(r.metadata.decimals as i32))
}
/// What the wallet holds, in US cents: ICP at the cycles-minting canister's rate, TCYCLES at one XDR a
/// trillion, ckUSDC and ckUSDT at par, ckBTC and ckETH at the exchange rate canister's price (held but
/// unpriceable counts as too much). A ledger that cannot be reached (the local network) holds nothing.
async fn wallet_usd_cents() -> Result<u128, String> {
    let me = canister_self();
    let mut cents: u128 = 0;
    let icp: Tokens = Call::unbounded_wait(LEDGER, "account_balance")
        .with_arg(AccountBalanceArgs { account: AccountIdentifier::new(&me, &DEFAULT_SUBACCOUNT) })
        .await
        .map_err(|e| e.to_string())?
        .candid()
        .map_err(|e| e.to_string())?;
    if icp.e8s() > 0 {
        let rate: CmcRateResponse = Call::unbounded_wait(CMC, "get_icp_xdr_conversion_rate").with_arg(()).await.map_err(|e| e.to_string())?.candid().map_err(|e| e.to_string())?;
        cents += icp.e8s() as u128 * rate.data.xdr_permyriad_per_icp as u128 * XDR_CENTS / 10_000 / 100_000_000;
    }
    for t in ledgers().await? {
        if t.symbol == "ICP" {
            continue;
        }
        let bal: u128 = match balance_of(t.ledger, me).await { Ok(b) => b.0.try_into().unwrap_or(u128::MAX), Err(_) => 0 };
        if bal == 0 {
            continue;
        }
        let unit = 10u128.pow(t.decimals as u32);
        cents += match t.symbol.as_str() {
            "TCYCLES" => bal * XDR_CENTS / unit,
            "ckUSDC" | "ckUSDT" => bal * 100 / unit,
            other => {
                let usd = price_usd(other.trim_start_matches("ck")).await.ok_or_else(|| format!("{other} cannot be priced right now; move it out before deleting"))?;
                (bal as f64 / unit as f64 * usd * 100.0) as u128
            }
        };
    }
    Ok(cents)
}

// ---------------------------------------------------------------- attestations: a checker, a comparator or a reviewer vouches for a note
//
// Each record binds to the content it saw by hash, so an edit to the prose or to the Lean it refers
// to shows up as "stale" until someone attests again. Kinds: "check" (the Lean compiled: pass/fail),
// "compare" (the English and the Lean say the same thing: same/weaker/stronger/different), "review".

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct NoteAttestation {
    pub id: u64,
    pub path: String,
    pub kind: String,
    pub verdict: String,
    pub by: Principal,
    pub agent: Option<String>,
    pub note_hash: String,
    pub lean_path: Option<String>,
    pub lean_hash: Option<String>,
    pub detail: String,
    pub at: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct AttestationView {
    pub attestation: NoteAttestation,
    /// the note (and the Lean note it refers to) are unchanged since this was made
    pub fresh: bool,
}

thread_local! {
    static NOTE_ATTESTATIONS: RefCell<StableBTreeMap<u64, C<NoteAttestation>, Mem>> = RefCell::new(StableBTreeMap::init(mem(18)));
}

fn content_hash(path: &str) -> Option<String> {
    FILES.with_borrow(|f| f.get(&path.to_string()).map(|c| hex(&Sha256::digest(c.0.content.as_bytes()))))
}
fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn attest_inner(path: &str, kind: &str, verdict: &str, lean_path: Option<String>, detail: String, by: Principal, agent: Option<String>) -> Result<NoteAttestation, NotebookError> {
    let path = check_path(path)?;
    let kind = kind.trim().to_lowercase();
    let verdict = verdict.trim().to_lowercase();
    let ok = match kind.as_str() {
        "check" => matches!(verdict.as_str(), "pass" | "fail"),
        "compare" => matches!(verdict.as_str(), "same" | "weaker" | "stronger" | "different"),
        "review" => matches!(verdict.as_str(), "ok" | "issue"),
        _ => false,
    };
    if !ok {
        return Err(NotebookError::Invalid("kind is check (pass|fail), compare (same|weaker|stronger|different) or review (ok|issue)".into()));
    }
    if detail.chars().count() > 4000 {
        return Err(NotebookError::Invalid("detail is 4000 characters at most".into()));
    }
    let note_hash = content_hash(&path).ok_or(NotebookError::NotFound)?;
    let lean_path = match lean_path.map(|l| check_path(&l)).transpose()? { Some(l) => Some(l), None => None };
    let lean_hash = match &lean_path { Some(l) => Some(content_hash(l).ok_or(NotebookError::NotFound)?), None => None };
    let id = NOTE_ATTESTATIONS.with_borrow(|a| a.last_key_value().map(|(k, _)| k + 1).unwrap_or(1));
    let a = NoteAttestation { id, path, kind, verdict, by, agent, note_hash, lean_path, lean_hash, detail: detail.trim().to_string(), at: time() };
    NOTE_ATTESTATIONS.with_borrow_mut(|m| m.insert(id, C(a.clone())));
    Ok(a)
}

/// Vouch for a note as the owner or anyone the note is shared with (commenters and editors).
#[update]
fn attest_note(path: String, kind: String, verdict: String, lean_path: Option<String>, detail: String) -> Result<NoteAttestation, NotebookError> {
    let me = msg_caller();
    let p = check_path(&path)?;
    if me == Principal::anonymous() || access(&p, me).map_or(true, |r| r < Role::Comment) {
        return Err(NotebookError::Unauthorized);
    }
    attest_inner(&path, &kind, &verdict, lean_path, detail, me, None)
}

/// Attestations on a note with whether each still matches the current content (anyone who can read it).
#[query]
fn note_attestations(path: String) -> Result<Vec<AttestationView>, NotebookError> {
    let me = msg_caller();
    let p = check_path(&path)?;
    if me != config().owner && access(&p, me).is_none() {
        return Err(NotebookError::Unauthorized);
    }
    let now = content_hash(&p);
    Ok(NOTE_ATTESTATIONS.with_borrow(|m| m.iter().map(|e| e.value().0).filter(|a| a.path == p).map(|a| {
        let fresh = now.as_deref() == Some(a.note_hash.as_str()) && a.lean_path.as_ref().map_or(true, |l| content_hash(l).as_deref() == a.lean_hash.as_deref());
        AttestationView { attestation: a, fresh }
    }).collect()))
}

// ---------------------------------------------------------------- study groups: who is here, progress marks, quiz attempts

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Attempt {
    pub id: u64,
    pub path: String,
    pub who: Principal,
    pub score: u32,
    pub total: u32,
    pub at: u64,
}

thread_local! {
    /// principal -> (note they are on, when they last said so)
    static PRESENCE: RefCell<StableBTreeMap<Principal, C<(String, u64)>, Mem>> = RefCell::new(StableBTreeMap::init(mem(15)));
    /// "path/principal" -> 0 unread, 1 read, 2 reviewing, 3 known
    static PROGRESS: RefCell<StableBTreeMap<String, u8, Mem>> = RefCell::new(StableBTreeMap::init(mem(16)));
    static ATTEMPTS: RefCell<StableBTreeMap<u64, C<Attempt>, Mem>> = RefCell::new(StableBTreeMap::init(mem(17)));
}

fn can_read(path: &str, who: Principal) -> bool {
    who != Principal::anonymous() && access(path, who).is_some()
}

/// "I am looking at this note": kept two minutes, so a group sees who is here.
#[update]
fn ping(path: String) -> Result<Vec<Principal>, NotebookError> {
    let me = msg_caller();
    let path = check_path(&path)?;
    if !can_read(&path, me) {
        return Err(NotebookError::Unauthorized);
    }
    PRESENCE.with_borrow_mut(|p| p.insert(me, C((path.clone(), time()))));
    Ok(here(&path, me))
}

fn here(path: &str, except: Principal) -> Vec<Principal> {
    let cutoff = time().saturating_sub(120_000_000_000);
    PRESENCE.with_borrow(|p| p.iter().filter(|e| *e.key() != except && e.value().0 .1 >= cutoff && e.value().0 .0 == path).map(|e| *e.key()).collect())
}

#[query]
fn who_is_here(path: String) -> Result<Vec<Principal>, NotebookError> {
    let me = msg_caller();
    let path = check_path(&path)?;
    if !can_read(&path, me) {
        return Err(NotebookError::Unauthorized);
    }
    Ok(here(&path, me))
}

/// Mark where you are with a note: 1 read, 2 reviewing, 3 known (0 clears).
#[update]
fn set_progress(path: String, state: u8) -> Result<(), NotebookError> {
    let me = msg_caller();
    let path = check_path(&path)?;
    if !can_read(&path, me) {
        return Err(NotebookError::Unauthorized);
    }
    if state > 3 {
        return Err(NotebookError::Invalid("state is 0-3".into()));
    }
    let key = format!("{path}/{}", me.to_text());
    PROGRESS.with_borrow_mut(|p| if state == 0 { p.remove(&key); } else { p.insert(key, state); });
    Ok(())
}

/// Everyone's mark on a note, for the group (anyone who can read the note).
#[query]
fn progress(path: String) -> Result<Vec<(Principal, u8)>, NotebookError> {
    let me = msg_caller();
    let path = check_path(&path)?;
    if !can_read(&path, me) {
        return Err(NotebookError::Unauthorized);
    }
    let prefix = format!("{path}/");
    Ok(PROGRESS.with_borrow(|p| p.range(prefix.clone()..).take_while(|e| e.key().starts_with(&prefix)).filter_map(|e| Principal::from_text(&e.key()[prefix.len()..]).ok().map(|who| (who, e.value()))).collect()))
}

/// A finished quiz or deck session on a shared note; the owner sees who scored what.
#[update]
fn submit_attempt(path: String, score: u32, total: u32) -> Result<Attempt, NotebookError> {
    let me = msg_caller();
    let path = check_path(&path)?;
    if !can_read(&path, me) {
        return Err(NotebookError::Unauthorized);
    }
    if total == 0 || score > total {
        return Err(NotebookError::Invalid("score must be within total".into()));
    }
    let id = ATTEMPTS.with_borrow(|a| a.last_key_value().map(|(k, _)| k + 1).unwrap_or(1));
    let at = Attempt { id, path, who: me, score, total, at: time() };
    ATTEMPTS.with_borrow_mut(|a| a.insert(id, C(at.clone())));
    Ok(at)
}

/// Attempts on one note (owner) or your own (anyone).
#[query]
fn attempts(path: String) -> Result<Vec<Attempt>, NotebookError> {
    let me = msg_caller();
    let path = check_path(&path)?;
    let owner = me == config().owner;
    if !owner && !can_read(&path, me) {
        return Err(NotebookError::Unauthorized);
    }
    Ok(ATTEMPTS.with_borrow(|a| a.iter().map(|e| e.value().0).filter(|x| x.path == path && (owner || x.who == me)).collect()))
}

/// Every attempt in the notebook, newest first (owner).
#[query]
fn all_attempts() -> Result<Vec<Attempt>, NotebookError> {
    owner()?;
    Ok(ATTEMPTS.with_borrow(|a| a.iter().rev().take(500).map(|e| e.value().0).collect()))
}

/// What a quality judge needs: counts over the markdown notes and a short sample of each.
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
    /// (path, first 300 characters) for up to 12 notes, largest first
    pub samples: Vec<(String, String)>,
    /// flashcard decks and quizzes (`quiz:` in the front matter)
    #[serde(default)]
    pub decks: u64,
}

/// Structure of the notebook for the registry's quality judge (owner or registry).
#[query]
fn audit() -> Result<Audit, NotebookError> {
    let c = config();
    if msg_caller() != c.owner && msg_caller() != c.registry {
        return Err(NotebookError::Unauthorized);
    }
    let notes: Vec<(String, Stored)> = FILES.with_borrow(|f| f.iter().filter(|e| e.key().ends_with(".md")).map(|e| (e.key().clone(), e.value().0.clone())).collect());
    let names: std::collections::HashSet<String> = notes.iter().map(|(p, _)| p.trim_end_matches(".md").rsplit('/').next().unwrap_or("").to_lowercase()).collect();
    let mut a = Audit { notes: notes.len() as u64, words: 0, links: 0, resolved_links: 0, orphans: 0, with_headings: 0, with_tags: 0, agent_notes: 0, newest_modified: 0, oldest_created: u64::MAX, samples: vec![], decks: 0 };
    let mut linked: std::collections::HashSet<String> = Default::default();
    let mut outgoing: Vec<bool> = vec![];
    for (_, st) in &notes {
        if st.content.starts_with("---") && st.content.lines().take(12).any(|l| l.trim_start().starts_with("quiz:")) { a.decks += 1; }
        a.words += st.content.split_whitespace().count() as u64;
        if st.content.lines().any(|l| l.starts_with('#') && l.trim_start_matches('#').starts_with(' ')) { a.with_headings += 1; }
        if st.content.split_whitespace().any(|w| w.len() > 1 && w.starts_with('#') && w[1..].chars().next().map(|c| c.is_alphabetic()).unwrap_or(false)) { a.with_tags += 1; }
        if st.agent.is_some() { a.agent_notes += 1; }
        a.newest_modified = a.newest_modified.max(st.modified);
        a.oldest_created = a.oldest_created.min(st.created);
        let mut has_out = false;
        let mut rest = st.content.as_str();
        while let Some(i) = rest.find("[[") {
            rest = &rest[i + 2..];
            let Some(j) = rest.find("]]") else { break };
            let target = rest[..j].split(['|', '#']).next().unwrap_or("").trim();
            let name = target.trim_end_matches(".md").rsplit('/').next().unwrap_or("").to_lowercase();
            a.links += 1;
            if names.contains(&name) { a.resolved_links += 1; linked.insert(name); has_out = true; }
            rest = &rest[j + 2..];
        }
        outgoing.push(has_out);
    }
    for ((path, _), has_out) in notes.iter().zip(outgoing) {
        let name = path.trim_end_matches(".md").rsplit('/').next().unwrap_or("").to_lowercase();
        if !has_out && !linked.contains(&name) { a.orphans += 1; }
    }
    if a.oldest_created == u64::MAX { a.oldest_created = 0; }
    let mut by_size: Vec<&(String, Stored)> = notes.iter().collect();
    by_size.sort_by_key(|(_, st)| std::cmp::Reverse(st.content.len()));
    a.samples = by_size.iter().take(12).map(|(p, st)| (p.clone(), st.content.chars().take(300).collect())).collect();
    Ok(a)
}

// ---------------------------------------------------------------- keeping it running: ICP -> cycles
//
// The same path as agent-locks, laya-icp and cycles-dca: ICP on this canister's own ledger account
// is sent to the cycles minting canister with memo TPUP, then `notify_top_up` mints cycles into
// this canister. The block index is persisted before notify, so an upgrade or trap between the
// two steps cannot strand the ICP; a timer retries pending blocks. `top_up` pulls the ICP a
// signed-in payer approved (ICRC-2) and converts it at once; anything sent straight to the
// account is converted every 10 minutes or on `sweep_topups`.

const MEMO_TOP_UP_CANISTER: Memo = Memo(0x5055_5054); // 'TPUP'
const ICP_FEE: u64 = 10_000;
const MIN_TOPUP_E8S: u64 = 1_000_000; // 0.01 ICP

#[derive(CandidType, Deserialize)]
struct NotifyTopUp {
    block_index: u64,
    canister_id: Principal,
}

#[derive(CandidType, Deserialize, Debug)]
enum NotifyError {
    Refunded { reason: String, block_index: Option<u64> },
    Processing,
    TransactionTooOld(u64),
    InvalidTransaction(String),
    Other { error_code: u64, error_message: String },
}

/// `Subaccount::from(&PrincipalId)` as the CMC derives it: length byte, principal bytes, zero padding.
fn cmc_subaccount(canister: Principal) -> Subaccount {
    let mut s = [0u8; 32];
    let b = canister.as_slice();
    s[0] = b.len() as u8;
    s[1..1 + b.len()].copy_from_slice(b);
    Subaccount(s)
}

/// Pull `amount_e8s` that `payer` (an OISY wallet, for instance) approved for this canister on the
/// ICP ledger and convert it; the ledger's allowance is the authorization, the owner just triggers it.
#[update]
async fn top_up_from(payer: Principal, amount_e8s: u64) -> Result<TopUp, String> {
    owner().map_err(|_| "owner only".to_string())?;
    if payer == Principal::anonymous() {
        return Err("payer must be a real principal".into());
    }
    if amount_e8s < MIN_TOPUP_E8S {
        return Err(format!("minimum top-up is {} ICP", MIN_TOPUP_E8S as f64 / 1e8));
    }
    pull_and_convert(payer, amount_e8s).await
}

/// Pull `amount_e8s` the caller approved on the ICP ledger and turn it into this canister's cycles.
#[update]
async fn top_up(amount_e8s: u64) -> Result<TopUp, String> {
    let payer = msg_caller();
    if payer == Principal::anonymous() {
        return Err("sign in to top up from your account, or send ICP to the account".into());
    }
    if amount_e8s < MIN_TOPUP_E8S {
        return Err(format!("minimum top-up is {} ICP", MIN_TOPUP_E8S as f64 / 1e8));
    }
    pull_and_convert(payer, amount_e8s).await
}

/// Pull `amount_e8s` from `payer`'s ICRC-2 allowance and convert it to this canister's cycles.
async fn pull_and_convert(payer: Principal, amount_e8s: u64) -> Result<TopUp, String> {
    let tf = TransferFromArgs {
        spender_subaccount: None,
        from: Account { owner: payer, subaccount: None },
        to: Account { owner: canister_self(), subaccount: None },
        amount: Nat::from(amount_e8s),
        fee: Some(Nat::from(ICP_FEE)),
        memo: None,
        created_at_time: Some(time()),
    };
    let r: Result<Nat, TransferFromError> = Call::unbounded_wait(LEDGER, "icrc2_transfer_from")
        .with_arg(&tf)
        .await
        .map_err(|e| e.to_string())?
        .candid()
        .map_err(|e| e.to_string())?;
    r.map_err(|e| e.to_string())?;
    convert(payer, amount_e8s).await
}

/// Convert whatever ICP sits on the account (minus one fee) into cycles now.
#[update]
async fn sweep_topups() -> Result<TopUp, String> {
    let me = canister_self();
    let bal: Tokens = Call::unbounded_wait(LEDGER, "account_balance")
        .with_arg(AccountBalanceArgs { account: AccountIdentifier::new(&me, &DEFAULT_SUBACCOUNT) })
        .await
        .map_err(|e| e.to_string())?
        .candid()
        .map_err(|e| e.to_string())?;
    if bal.e8s() < MIN_TOPUP_E8S {
        return Err(format!("{bal} on the account is below the {} ICP minimum", MIN_TOPUP_E8S as f64 / 1e8));
    }
    convert(me, bal.e8s()).await
}

/// Turn `amount_e8s` of the ICP this space holds on its own account into its cycles (owner): fuel
/// from the wallet, leaving the rest where it is.
#[update]
async fn fuel_from_wallet(amount_e8s: u64) -> Result<TopUp, String> {
    owner().map_err(|_| "owner only".to_string())?;
    if amount_e8s < MIN_TOPUP_E8S {
        return Err(format!("minimum is {} ICP", MIN_TOPUP_E8S as f64 / 1e8));
    }
    let me = canister_self();
    let bal: Tokens = Call::unbounded_wait(LEDGER, "account_balance")
        .with_arg(AccountBalanceArgs { account: AccountIdentifier::new(&me, &DEFAULT_SUBACCOUNT) })
        .await
        .map_err(|e| e.to_string())?
        .candid()
        .map_err(|e| e.to_string())?;
    if bal.e8s() < amount_e8s {
        return Err(format!("the wallet holds {bal}, less than {} ICP", amount_e8s as f64 / 1e8));
    }
    convert(me, amount_e8s).await
}

#[query]
fn topups(n: u32) -> Vec<TopUp> {
    TOPUPS.with_borrow(|l| {
        let len = l.len();
        (len.saturating_sub(n.min(100) as u64)..len).rev().filter_map(|i| l.get(i).map(|v| v.0)).collect()
    })
}

async fn convert(from: Principal, amount_e8s: u64) -> Result<TopUp, String> {
    let me = canister_self();
    let args = TransferArgs {
        memo: MEMO_TOP_UP_CANISTER,
        amount: Tokens::from_e8s(amount_e8s - ICP_FEE),
        fee: DEFAULT_FEE,
        from_subaccount: Some(DEFAULT_SUBACCOUNT),
        to: AccountIdentifier::new(&CMC, &cmc_subaccount(me)),
        created_at_time: None,
    };
    let r: TransferResult = Call::unbounded_wait(LEDGER, "transfer").with_arg(&args).await.map_err(|e| e.to_string())?.candid().map_err(|e| e.to_string())?;
    let block_index = r.map_err(|e| e.to_string())?;
    let mut t = TopUp { from, amount_e8s, block_index, cycles: Nat::from(0u8), at: time(), status: TopUpStatus::Pending };
    PENDING.with_borrow_mut(|p| p.insert(block_index, C(t.clone())));
    TOTALS.with_borrow_mut(|x| {
        let (icp, cyc) = x.get().0;
        x.set(C((icp + amount_e8s, cyc)));
    });
    settle(&mut t).await;
    Ok(t)
}

async fn settle(t: &mut TopUp) {
    let arg = NotifyTopUp { block_index: t.block_index, canister_id: canister_self() };
    let res: Result<Result<Nat, NotifyError>, String> = match Call::unbounded_wait(CMC, "notify_top_up").with_arg(&arg).await {
        Ok(resp) => resp.candid().map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    };
    match res {
        Ok(Ok(cycles)) => {
            let c: u128 = cycles.0.clone().try_into().unwrap_or(0);
            TOTALS.with_borrow_mut(|x| {
                let (icp, cyc) = x.get().0;
                x.set(C((icp, cyc + c)));
            });
            t.cycles = cycles;
            t.status = TopUpStatus::Completed;
        }
        // retriable: Processing, Other, or the call itself failed
        Ok(Err(NotifyError::Processing | NotifyError::Other { .. })) | Err(_) => t.status = TopUpStatus::Pending,
        // final: a refund lands back on the account and is picked up by the next conversion
        Ok(Err(e)) => t.status = TopUpStatus::Failed(format!("{e:?}")),
    }
    if t.status != TopUpStatus::Pending {
        PENDING.with_borrow_mut(|p| p.remove(&t.block_index));
        TOPUPS.with_borrow(|l| l.append(&C(t.clone())).expect("top-up log full"));
    }
}

async fn retry_pending() {
    let pending: Vec<TopUp> = PENDING.with_borrow(|p| p.iter().map(|e| e.value().0).collect());
    for mut t in pending {
        settle(&mut t).await;
    }
}

// ---------------------------------------------------------------- deposits of anything: swept into cycles every 10 minutes
//
// The notebook never keeps tokens. ICP on its ledger account is minted (above); TCYCLES on the cycles
// ledger are withdrawn into the canister; ck tokens (ckBTC, ckETH, ckUSDC, ckUSDT) are handed to the
// registry, which swaps them for ICP on ICPSwap and mints the result here. Native bitcoin arrives
// through the ckBTC minter at an address this canister owns; native ether and ERC-20s through the
// ckETH helper contracts with this canister's principal as the recipient.

const CKBTC_MINTER_TEXT: &str = "mqygn-kiaaa-aaaar-qaadq-cai";

#[derive(CandidType, Deserialize, Clone, Debug, Default)]
pub struct DepositState {
    pub btc_address: Option<String>,
    pub eth_address: Option<String>,
    pub last_run: u64,
    pub last_result: String,
}

/// Mirror of the registry's token table entry.
#[derive(CandidType, Deserialize, Clone, Debug)]
struct Token {
    symbol: String,
    ledger: Principal,
    decimals: u8,
    fee: Nat,
    route: Route,
}
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
enum Route {
    Icp,
    Cycles,
    Swap,
}
#[derive(CandidType, Deserialize)]
struct BtcAccount {
    owner: Option<Principal>,
    subaccount: Option<Vec<u8>>,
}
#[derive(CandidType, Deserialize)]
struct CyclesWithdraw {
    amount: Nat,
    from_subaccount: Option<Vec<u8>>,
    to: Principal,
    created_at_time: Option<u64>,
}

thread_local! {
    static DEPOSITS: RefCell<StableCell<C<DepositState>, Mem>> = RefCell::new(StableCell::init(mem(14), C(DepositState::default())));
    /// every transfer an agent key made, oldest first
    static SPENDS: RefCell<StableLog<C<Spend>, Mem, Mem>> = RefCell::new(StableLog::init(mem(20), mem(21)));
    /// 1 while agents may post in the community for this space (on from the start; the owner can switch it off)
    static AGENT_CHAT: RefCell<StableCell<u8, Mem>> = RefCell::new(StableCell::init(mem(22), 1));
}

/// Let agent keys post in the community for this space, or stop them (owner).
#[update]
fn set_agent_chat(on: bool) -> Result<(), NotebookError> {
    owner()?;
    AGENT_CHAT.with_borrow_mut(|c| c.set(u8::from(on)));
    Ok(())
}
#[query]
fn agent_chat_allowed() -> Result<bool, NotebookError> {
    owner()?;
    Ok(AGENT_CHAT.with_borrow(|c| *c.get() == 1))
}

#[query]
fn deposits() -> Result<DepositState, NotebookError> {
    owner()?;
    Ok(DEPOSITS.with_borrow(|d| d.get().0.clone()))
}

/// A Bitcoin address owned by this canister: bitcoin sent there becomes ckBTC, then cycles.
#[update]
async fn btc_address() -> Result<String, NotebookError> {
    owner()?;
    if let Some(a) = DEPOSITS.with_borrow(|d| d.get().0.btc_address.clone()) {
        return Ok(a);
    }
    let minter = Principal::from_text(CKBTC_MINTER_TEXT).unwrap();
    let addr: String = Call::unbounded_wait(minter, "get_btc_address")
        .with_arg(&BtcAccount { owner: Some(canister_self()), subaccount: None })
        .await
        .map_err(|e| NotebookError::Invalid(format!("ckBTC minter: {e}")))?
        .candid()
        .map_err(|e| NotebookError::Invalid(e.to_string()))?;
    DEPOSITS.with_borrow_mut(|d| {
        let mut v = d.get().0.clone();
        v.btc_address = Some(addr.clone());
        d.set(C(v));
    });
    Ok(addr)
}

/// An Ethereum address this canister controls through threshold ECDSA (secp256k1, derivation path
/// empty): ether and ERC-20s sent there are its own, signed for by the subnet. Derived once, kept.
#[update]
async fn eth_address() -> Result<String, NotebookError> {
    owner()?;
    if let Some(a) = DEPOSITS.with_borrow(|d| d.get().0.eth_address.clone()) {
        return Ok(a);
    }
    let args = |name: &str| EcdsaPublicKeyArgs { canister_id: None, derivation_path: vec![], key_id: EcdsaKeyId { curve: EcdsaCurve::Secp256k1, name: name.into() } };
    // key_1 is mainnet's; the local network only has the test key
    let pk = match ecdsa_public_key(&args("key_1")).await {
        Ok(r) => r.public_key,
        Err(_) => ecdsa_public_key(&args("dfx_test_key")).await.map_err(|e| NotebookError::Invalid(format!("ecdsa_public_key: {e}")))?.public_key,
    };
    let addr = eth_address_of(&pk).map_err(NotebookError::Invalid)?;
    DEPOSITS.with_borrow_mut(|d| {
        let mut v = d.get().0.clone();
        v.eth_address = Some(addr.clone());
        d.set(C(v));
    });
    Ok(addr)
}

/// EIP-55 address of a SEC1 public key: keccak256 of the uncompressed point (without its 0x04),
/// the last 20 bytes, hex with the checksum's mixed case.
fn eth_address_of(sec1: &[u8]) -> Result<String, String> {
    use k256::elliptic_curve::sec1::ToEncodedPoint;
    let point = k256::PublicKey::from_sec1_bytes(sec1).map_err(|e| e.to_string())?.to_encoded_point(false);
    let hash = <sha3::Keccak256 as sha3::Digest>::digest(&point.as_bytes()[1..]);
    let hex: String = hash[12..].iter().map(|b| format!("{b:02x}")).collect();
    let check = <sha3::Keccak256 as sha3::Digest>::digest(hex.as_bytes());
    let cased: String = hex.chars().enumerate().map(|(i, c)| if (check[i / 2] >> if i % 2 == 0 { 4 } else { 0 }) & 0xf >= 8 { c.to_ascii_uppercase() } else { c }).collect();
    Ok(format!("0x{cased}"))
}

#[cfg(test)]
mod eth_tests {
    #[test]
    fn known_key_gives_known_address() {
        // the secp256k1 generator point as a public key (private key 1): a published test vector
        let g = hex_bytes("0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798");
        assert_eq!(super::eth_address_of(&g).unwrap(), "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf");
    }
    fn hex_bytes(s: &str) -> Vec<u8> {
        (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect()
    }
}

/// Convert everything that arrived since the last run, now instead of at the next 10-minute tick.
#[update]
async fn sweep_deposits() -> Result<String, NotebookError> {
    owner()?;
    Ok(sweep_all().await)
}

/// Under this many cycles the ten-minute sweep turns what the space holds into cycles; above it the
/// funds stay put, for the agent to spend. The owner can still sweep by hand (`sweep_deposits`).
const SWEEP_FLOOR: u128 = 3_000_000_000_000;
async fn deposit_tick() {
    if canister_cycle_balance() < SWEEP_FLOOR {
        sweep_all().await;
    }
}

async fn balance_of(ledger: Principal, who: Principal) -> Result<Nat, String> {
    Call::unbounded_wait(ledger, "icrc1_balance_of").with_arg(&Account { owner: who, subaccount: None }).await.map_err(|e| e.to_string())?.candid().map_err(|e| e.to_string())
}

/// One pass over every deposit channel; each is best effort and reports in one line.
async fn sweep_all() -> String {
    let me = canister_self();
    let registry = config().registry;
    let mut lines: Vec<String> = vec![];
    match sweep_topups().await {
        Ok(t) => lines.push(format!("ICP: {} e8s -> {:?}", t.amount_e8s, t.status)),
        Err(e) if e.contains("below") => {}
        Err(e) => lines.push(format!("ICP: {e}")),
    }
    if DEPOSITS.with_borrow(|d| d.get().0.btc_address.is_some()) {
        // ask the minter to look for new bitcoin; ckBTC it mints shows up as a ck balance below
        let minter = Principal::from_text(CKBTC_MINTER_TEXT).unwrap();
        let _ = Call::unbounded_wait(minter, "update_balance").with_arg(&BtcAccount { owner: Some(me), subaccount: None }).await;
    }
    let tokens: Vec<Token> = match Call::unbounded_wait(registry, "tokens").with_arg(()).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string())) {
        Ok(t) => t,
        Err(e) => {
            lines.push(format!("registry tokens: {e}"));
            vec![]
        }
    };
    for tok in tokens.iter().filter(|t| t.route != Route::Icp) {
        let bal = match balance_of(tok.ledger, me).await {
            Ok(b) => b,
            Err(_) => continue, // that ledger is not reachable here (local network)
        };
        if bal <= tok.fee.clone() * 4u8 {
            continue;
        }
        let r: Result<String, String> = match tok.route {
            Route::Cycles => {
                let amount = bal.clone() - tok.fee.clone();
                let w: Result<Result<Nat, candid::Reserved>, String> = Call::unbounded_wait(tok.ledger, "withdraw").with_arg(&CyclesWithdraw { amount: amount.clone(), from_subaccount: None, to: me, created_at_time: None }).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string()));
                match w {
                    Ok(Ok(_)) => Ok(format!("{} -> cycles", amount)),
                    Ok(Err(_)) => Err("cycles ledger refused the withdrawal".into()),
                    Err(e) => Err(e),
                }
            }
            _ => {
                let amount = bal.clone() - tok.fee.clone() * 2u8;
                let ap = icrc_ledger_types::icrc2::approve::ApproveArgs { from_subaccount: None, spender: Account { owner: registry, subaccount: None }, amount: amount.clone() + tok.fee.clone(), expected_allowance: None, expires_at: None, fee: Some(tok.fee.clone()), memo: None, created_at_time: None };
                let a: Result<Result<Nat, icrc_ledger_types::icrc2::approve::ApproveError>, String> = Call::unbounded_wait(tok.ledger, "icrc2_approve").with_arg(&ap).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string()));
                match a {
                    Ok(Ok(_)) => {
                        let c: Result<Result<Nat, String>, String> = Call::unbounded_wait(registry, "convert_deposit").with_arg((tok.symbol.clone(), amount.clone())).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string()));
                        match c {
                            Ok(Ok(cycles)) => Ok(format!("{} -> {} cycles", amount, cycles)),
                            Ok(Err(e)) | Err(e) => Err(e),
                        }
                    }
                    Ok(Err(e)) => Err(format!("approve: {e:?}")),
                    Err(e) => Err(e),
                }
            }
        };
        lines.push(match r { Ok(m) => format!("{}: {m}", tok.symbol), Err(e) => format!("{}: {e}", tok.symbol) });
    }
    let result = if lines.is_empty() { "nothing to convert".to_string() } else { lines.join("; ") };
    DEPOSITS.with_borrow_mut(|d| {
        let mut v = d.get().0.clone();
        v.last_run = time();
        v.last_result = result.clone();
        d.set(C(v));
    });
    result
}

// ---------------------------------------------------------------- agents: keys, the locked folder, the JSON API
//
// An agent holds a key the owner issued; it sends `Authorization: Bearer <key>` to this canister's
// JSON API. Agents read every note and write anywhere (a scoped key in its folder only), so
// what an agent wrote is always distinguishable from what a person wrote.

fn hash(key: &str) -> [u8; 32] {
    Sha256::digest(key.as_bytes()).into()
}

/// Issue an agent key (shown once). Agents send it as `Authorization: Bearer <key>`.
#[update]
async fn create_agent_key(name: String) -> Result<String, NotebookError> {
    owner()?;
    let name = name.trim().to_string();
    if name.is_empty() || name.len() > 64 || name.contains(['/', '#']) {
        return Err(NotebookError::Invalid("agent name: 1-64 chars, no '/' or '#'".into()));
    }
    if AGENT_KEYS.with_borrow(|m| m.iter().any(|e| e.value().0.name == name && !e.value().0.revoked)) {
        return Err(NotebookError::Exists);
    }
    let rand = raw_rand().await.map_err(|e| NotebookError::Invalid(format!("randomness unavailable: {e}")))?;
    let key = format!("nb_{}", rand.iter().take(24).map(|b| format!("{b:02x}")).collect::<String>());
    AGENT_KEYS.with_borrow_mut(|m| m.insert(hash(&key), C(AgentKey { name, created_at: time(), revoked: false, last_used: 0, writes: 0, scope: None, spend: None, inbox_seen: None })));
    Ok(key)
}

/// A key that may also write under one folder of yours, for a web clipper or a mail relay (owner).
#[update]
async fn create_scoped_key(name: String, folder: String) -> Result<String, NotebookError> {
    owner()?;
    let folder = check_path(&folder)?;
    if is_agent_path(&folder) {
        return Err(NotebookError::Invalid("scope a key to a folder of yours, not Agents/".into()));
    }
    let key = create_agent_key(name).await?;
    AGENT_KEYS.with_borrow_mut(|m| {
        let h = hash(&key);
        if let Some(mut k) = m.get(&h).map(|c| c.0) {
            k.scope = Some(folder);
            m.insert(h, C(k));
        }
    });
    Ok(key)
}

#[update]
fn revoke_agent_key(name: String) -> Result<(), NotebookError> {
    owner()?;
    let found = AGENT_KEYS.with_borrow(|m| m.iter().find(|e| e.value().0.name == name && !e.value().0.revoked).map(|e| (*e.key(), e.value().0)));
    let (h, mut k) = found.ok_or(NotebookError::NotFound)?;
    k.revoked = true;
    AGENT_KEYS.with_borrow_mut(|m| m.insert(h, C(k)));
    Ok(())
}

/// Let a key move this space's funds over the agent API, or stop it (owner).
#[update]
fn set_key_spend(name: String, on: bool) -> Result<(), NotebookError> {
    owner()?;
    let found = AGENT_KEYS.with_borrow(|m| m.iter().find(|e| e.value().0.name == name && !e.value().0.revoked).map(|e| (*e.key(), e.value().0)));
    let (h, mut k) = found.ok_or(NotebookError::NotFound)?;
    k.spend = Some(on);
    AGENT_KEYS.with_borrow_mut(|m| m.insert(h, C(k)));
    Ok(())
}
fn key_can_spend(agent: &str) -> bool {
    AGENT_KEYS.with_borrow(|m| m.iter().any(|e| e.value().0.name == agent && !e.value().0.revoked && e.value().0.spend == Some(true)))
}

/// The last `n` transfers agents made with this space's funds, newest first (owner).
#[query]
fn spends(n: u32) -> Result<Vec<Spend>, NotebookError> {
    owner()?;
    Ok(SPENDS.with_borrow(|l| {
        let len = l.len();
        (len.saturating_sub(n.min(100) as u64)..len).rev().filter_map(|i| l.get(i).map(|v| v.0)).collect()
    }))
}

#[query]
fn agent_keys() -> Result<Vec<AgentKey>, NotebookError> {
    owner()?;
    Ok(AGENT_KEYS.with_borrow(|m| m.iter().map(|e| e.value().0).collect()))
}

/// Count a successful write against the agent's key.
fn bump_writes(agent: &str) {
    let found = AGENT_KEYS.with_borrow(|m| m.iter().find(|e| e.value().0.name == agent && !e.value().0.revoked).map(|e| (*e.key(), e.value().0)));
    if let Some((h, mut k)) = found {
        k.writes += 1;
        AGENT_KEYS.with_borrow_mut(|m| m.insert(h, C(k)));
    }
}

/// The agent name for a `Bearer` key, marking it used. Unknown or revoked keys are Unauthorized.
fn key_scope(agent: &str) -> Option<String> {
    AGENT_KEYS.with_borrow(|m| m.iter().find(|e| e.value().0.name == agent && !e.value().0.revoked).and_then(|e| e.value().0.scope.clone()))
}
fn by_key(headers: &[(String, String)]) -> Result<String, NotebookError> {
    let auth = headers.iter().find(|(k, _)| k.eq_ignore_ascii_case("authorization")).map(|(_, v)| v.trim()).ok_or(NotebookError::Unauthorized)?;
    let key = auth.strip_prefix("Bearer ").or_else(|| auth.strip_prefix("bearer ")).ok_or(NotebookError::Unauthorized)?.trim();
    let h = hash(key);
    let mut k = AGENT_KEYS.with_borrow(|m| m.get(&h).map(|c| c.0)).ok_or(NotebookError::Unauthorized)?;
    if k.revoked {
        return Err(NotebookError::Unauthorized);
    }
    k.last_used = time();
    let name = k.name.clone();
    AGENT_KEYS.with_borrow_mut(|m| m.insert(h, C(k)));
    Ok(name)
}

/// An agent's write, anywhere in the space (a scoped key stays in its folder), stamped with the agent's name.
fn agent_write(agent: &str, path: &str, content: String) -> Result<FileMeta, NotebookError> {
    let path = check_path(path)?;
    if let Some(f) = key_scope(agent) {
        if !path.starts_with(&format!("{f}/")) {
            return Err(NotebookError::Invalid(format!("this key writes under {f}/ only")));
        }
    }
    if content.len() > MAX_CONTENT {
        return Err(NotebookError::Invalid(format!("a file is limited to {MAX_CONTENT} bytes")));
    }
    let now = time();
    let s = FILES.with_borrow_mut(|f| {
        let created = match f.get(&path) {
            Some(c) => {
                record(&path, &c.0, &content, Principal::anonymous());
                c.0.created
            }
            None if f.len() >= MAX_FILES => return Err(NotebookError::Invalid(format!("{MAX_FILES} files; the notebook is full"))),
            None => now,
        };
        let s = Stored { content, created, modified: now, agent: Some(agent.to_string()) };
        f.insert(path.clone(), C(s.clone()));
        Ok(s)
    })?;
    register_parents(&path);
    Ok(meta(&path, &s))
}

// ---------------------------------------------------------------- sharing: a note, a folder, or the whole notebook

fn share_ok(path: &str, public: bool, principals: &[Principal], editors: &[Principal]) -> Result<Share, NotebookError> {
    share_full(path, public, Some(Role::Comment), principals, &[], editors)
}

fn share_full(path: &str, public: bool, public_role: Option<Role>, principals: &[Principal], commenters: &[Principal], editors: &[Principal]) -> Result<Share, NotebookError> {
    owner()?;
    let path = if path.trim().is_empty() { String::new() } else { check_path(path)? };
    if !path.is_empty() && !FILES.with_borrow(|f| f.contains_key(&path)) && !FOLDERS.with_borrow(|f| f.contains_key(&path)) {
        return Err(NotebookError::NotFound);
    }
    if !public && principals.is_empty() && commenters.is_empty() && editors.is_empty() {
        return Err(NotebookError::Invalid("share publicly or name at least one principal".into()));
    }
    let created_at = SHARES.with_borrow(|m| m.get(&path).map(|s| s.0.created_at)).unwrap_or_else(time);
    let real = |v: &[Principal]| v.iter().copied().filter(|p| *p != Principal::anonymous()).collect::<Vec<_>>();
    let s = Share { path: path.clone(), public, principals: real(principals), editors: Some(real(editors)), commenters: Some(real(commenters)), public_role: Some(public_role.unwrap_or(Role::Comment)), created_at };
    SHARES.with_borrow_mut(|m| m.insert(path, C(s.clone())));
    Ok(s)
}

/// Share a note with everyone (`public`) or with `principals` (readers); replaces an earlier share.
#[update]
fn share_note(path: String, public: bool, principals: Vec<Principal>) -> Result<Share, NotebookError> {
    share_ok(&path, public, &principals, &[])
}

/// Share a note, a folder, or the whole notebook ("") with readers and editors.
#[update]
fn share(path: String, public: bool, principals: Vec<Principal>, editors: Vec<Principal>) -> Result<Share, NotebookError> {
    share_ok(&path, public, &principals, &editors)
}

/// Share with explicit permissions: what the link allows (view, comment or edit; editing needs a
/// sign-in) and who may view, comment or edit. Replaces an earlier share of the same path.
#[update]
fn set_share(a: ShareArgs) -> Result<Share, NotebookError> {
    share_full(&a.path, a.public, a.public_role, &a.viewers, &a.commenters, &a.editors)
}

#[update]
fn unshare_note(path: String) -> Result<(), NotebookError> {
    owner()?;
    let path = if path.trim().is_empty() { String::new() } else { check_path(&path)? };
    SHARES.with_borrow_mut(|m| m.remove(&path)).map(|_| ()).ok_or(NotebookError::NotFound)
}

#[query]
fn shares() -> Result<Vec<Share>, NotebookError> {
    owner()?;
    Ok(SHARES.with_borrow(|m| m.iter().map(|e| e.value().0).collect()))
}

/// What `caller` may do with `path`, from the owner's rights or any share covering the path.
fn access(path: &str, caller: Principal) -> Option<Role> {
    if caller == config().owner {
        return Some(Role::Edit);
    }
    let mut best: Option<Role> = None;
    SHARES.with_borrow(|m| {
        for e in m.iter() {
            let s = e.value().0;
            let covers = s.path.is_empty() || s.path == path || path.starts_with(&format!("{}/", s.path));
            if !covers {
                continue;
            }
            let mut r: Option<Role> = None;
            if s.editors.as_deref().unwrap_or(&[]).contains(&caller) && !is_agent_path(path) {
                r = Some(Role::Edit);
            } else if s.commenters.as_deref().unwrap_or(&[]).contains(&caller) {
                r = Some(Role::Comment);
            } else if s.principals.contains(&caller) {
                r = Some(Role::View);
            }
            if s.public {
                let mut pr = s.public_role.unwrap_or(Role::Comment);
                // the link alone never lets an anonymous caller change or comment on anything
                if caller == Principal::anonymous() || (pr == Role::Edit && is_agent_path(path)) {
                    pr = Role::View;
                }
                if r.map_or(true, |x| pr > x) {
                    r = Some(pr);
                }
            }
            if r.map_or(false, |x| best.map_or(true, |b| x > b)) {
                best = r;
            }
        }
    });
    best
}
fn share_allows(path: &str, caller: Principal) -> bool {
    access(path, caller).is_some()
}

/// Read a shared note: public shares need no sign-in; private ones need a listed principal.
#[query]
fn read_shared(path: String) -> Result<Note, NotebookError> {
    let path = check_path(&path)?;
    if !share_allows(&path, msg_caller()) {
        return Err(NotebookError::Unauthorized);
    }
    let s = FILES.with_borrow(|f| f.get(&path).map(|c| c.0)).ok_or(NotebookError::NotFound)?;
    Ok(to_note(&path, &s, true))
}

/// Files a sharee may read under `prefix` ("" for everything shared with them).
#[query]
fn list_shared(prefix: String) -> Result<Vec<FileMeta>, NotebookError> {
    let caller = msg_caller();
    let prefix = if prefix.trim().is_empty() { String::new() } else { check_path(&prefix)? };
    Ok(FILES.with_borrow(|f| f.iter().filter(|e| (prefix.is_empty() || e.key().starts_with(&format!("{prefix}/"))) && share_allows(e.key(), caller)).map(|e| meta(e.key(), &e.value().0)).collect()))
}

/// An editor's write to a shared note (owner-style rules apply; never under Agents/).
#[update]
fn write_shared(path: String, content: String) -> Result<FileMeta, NotebookError> {
    let caller = msg_caller();
    if caller == Principal::anonymous() {
        return Err(NotebookError::Unauthorized);
    }
    let path = check_path(&path)?;
    people_only(&path)?;
    if access(&path, caller) != Some(Role::Edit) {
        return Err(NotebookError::Unauthorized);
    }
    if content.len() > MAX_CONTENT {
        return Err(NotebookError::Invalid(format!("a file is limited to {MAX_CONTENT} bytes")));
    }
    let now = time();
    let changed = FILES.with_borrow(|f| f.get(&path).map_or(true, |c| c.0.content != content));
    let s = FILES.with_borrow_mut(|f| {
        let created = match f.get(&path) {
            Some(c) => {
                record(&path, &c.0, &content, caller);
                c.0.created
            }
            None if f.len() >= MAX_FILES => return Err(NotebookError::Invalid(format!("{MAX_FILES} files; the notebook is full"))),
            None => now,
        };
        let s = Stored { content, created, modified: now, agent: None };
        f.insert(path.clone(), C(s.clone()));
        Ok(s)
    })?;
    register_parents(&path);
    if changed && path.ends_with(".md") { bump_day(); }
    Ok(meta(&path, &s))
}

/// What a viewer may know about a share: the notebook's name, whether it is public, and their role.
#[query]
fn share_info(path: String) -> Option<(String, bool)> {
    let path = if path.trim().is_empty() { String::new() } else { check_path(&path).ok()? };
    let caller = msg_caller();
    if access(&path, caller).is_none() && !FOLDERS.with_borrow(|f| f.contains_key(&path)) && !path.is_empty() {
        return None;
    }
    let public = SHARES.with_borrow(|m| m.iter().any(|e| { let s = e.value().0; s.public && (s.path.is_empty() || s.path == path || path.starts_with(&format!("{}/", s.path))) }));
    Some((config().name, public))
}

#[query]
fn my_role(path: String) -> Option<Role> {
    let path = if path.trim().is_empty() { String::new() } else { check_path(&path).ok()? };
    access(&path, msg_caller())
}

// ---------------------------------------------------------------- comments from readers

#[update]
fn comment(path: String, text: String) -> Result<Comment, NotebookError> {
    let author = msg_caller();
    if author == Principal::anonymous() {
        return Err(NotebookError::Unauthorized);
    }
    let path = check_path(&path)?;
    if access(&path, author).map_or(true, |r| r < Role::Comment) {
        return Err(NotebookError::Unauthorized);
    }
    let text = text.trim().to_string();
    if text.is_empty() || text.chars().count() > 2000 {
        return Err(NotebookError::Invalid("comment: 1-2000 characters".into()));
    }
    let id = COMMENTS.with_borrow(|c| c.last_key_value().map(|(k, _)| k + 1).unwrap_or(1));
    let c = Comment { id, path, author, text, at: time(), parent: None };
    COMMENTS.with_borrow_mut(|m| m.insert(id, C(c.clone())));
    Ok(c)
}

/// Answer a comment; the reply inherits the note and needs the same permission as commenting there.
#[update]
fn reply(parent: u64, text: String) -> Result<Comment, NotebookError> {
    let author = msg_caller();
    if author == Principal::anonymous() {
        return Err(NotebookError::Unauthorized);
    }
    let p = COMMENTS.with_borrow(|c| c.get(&parent).map(|x| x.0)).ok_or(NotebookError::NotFound)?;
    if access(&p.path, author).map_or(true, |r| r < Role::Comment) {
        return Err(NotebookError::Unauthorized);
    }
    let text = text.trim().to_string();
    if text.is_empty() || text.chars().count() > 2000 {
        return Err(NotebookError::Invalid("comment: 1-2000 characters".into()));
    }
    let id = COMMENTS.with_borrow(|c| c.last_key_value().map(|(k, _)| k + 1).unwrap_or(1));
    let c = Comment { id, path: p.path, author, text, at: time(), parent: Some(p.parent.unwrap_or(parent)) };
    COMMENTS.with_borrow_mut(|m| m.insert(id, C(c.clone())));
    Ok(c)
}

#[query]
fn comments(path: String) -> Result<Vec<Comment>, NotebookError> {
    let path = check_path(&path)?;
    if !share_allows(&path, msg_caller()) {
        return Err(NotebookError::Unauthorized);
    }
    Ok(COMMENTS.with_borrow(|m| m.iter().map(|e| e.value().0).filter(|c| c.path == path).collect()))
}

/// Every comment in the notebook, newest first (owner).
#[query]
fn all_comments() -> Result<Vec<Comment>, NotebookError> {
    owner()?;
    let mut v: Vec<Comment> = COMMENTS.with_borrow(|m| m.iter().map(|e| e.value().0).collect());
    v.reverse();
    Ok(v)
}

#[update]
fn delete_comment(id: u64) -> Result<(), NotebookError> {
    let caller = msg_caller();
    let c = COMMENTS.with_borrow(|m| m.get(&id).map(|c| c.0)).ok_or(NotebookError::NotFound)?;
    if caller != config().owner && caller != c.author {
        return Err(NotebookError::Unauthorized);
    }
    COMMENTS.with_borrow_mut(|m| m.remove(&id));
    Ok(())
}

// ---------------------------------------------------------------- publish: a public site from a folder

/// Publish `folder` ("" for the whole notebook, except Agents/ and attachments) at /p/; `None` unpublishes.
#[update]
fn set_published(folder: Option<String>) -> Result<(), NotebookError> {
    owner()?;
    let f = match folder {
        Some(x) if x.trim().is_empty() => Some(String::new()),
        Some(x) => Some(check_path(&x)?),
        None => None,
    };
    PUBLISHED.with_borrow_mut(|p| p.set(C(f)));
    Ok(())
}

#[query]
fn published() -> Option<String> {
    PUBLISHED.with_borrow(|p| p.get().0.clone())
}

fn is_published(path: &str) -> bool {
    match PUBLISHED.with_borrow(|p| p.get().0.clone()) {
        None => false,
        Some(root) => path.ends_with(".md") && !is_agent_path(path) && (root.is_empty() || path.starts_with(&format!("{root}/"))),
    }
}

fn published_paths() -> Vec<String> {
    FILES.with_borrow(|f| f.iter().map(|e| e.key().clone()).filter(|p| is_published(p)).collect())
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}
fn url_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
fn title_of(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path).trim_end_matches(".md")
}

/// Resolve a `[[target]]` the way the app does: a path (with or without .md), else a unique name.
fn resolve_published(target: &str, all: &[String]) -> Option<String> {
    let t = target.trim().trim_start_matches('/');
    if t.contains('/') {
        return all.iter().find(|p| *p == t || **p == format!("{t}.md")).cloned();
    }
    let want = t.to_lowercase();
    let mut hits: Vec<&String> = all.iter().filter(|p| title_of(p).to_lowercase() == want).collect();
    hits.sort_by_key(|p| p.len());
    hits.first().map(|p| (*p).clone())
}

/// Wiki links become site links, tags become spans, comments disappear, callouts stay blockquotes.
fn preprocess_published(md: &str, all: &[String]) -> (String, Vec<String>) {
    let mut out = String::with_capacity(md.len());
    let mut links = vec![];
    let mut rest = md;
    while let Some(i) = rest.find("[[") {
        out.push_str(&rest[..i]);
        let tail = &rest[i + 2..];
        let Some(j) = tail.find("]]") else {
            out.push_str("[[");
            rest = tail;
            continue;
        };
        let inner = &tail[..j];
        let (target, alias) = match inner.find('|') {
            Some(b) => (&inner[..b], Some(&inner[b + 1..])),
            None => (inner, None),
        };
        let (target, heading) = match target.find('#') {
            Some(h) => (&target[..h], Some(&target[h + 1..])),
            None => (target, None),
        };
        let label = alias.unwrap_or(if target.trim().is_empty() { heading.unwrap_or("") } else { target }).trim();
        match resolve_published(target, all) {
            Some(dest) if !target.trim().is_empty() => {
                links.push(dest.clone());
                out.push_str(&format!("[{}](/p/{}{})", label.replace(']', "\\]"), url_encode(&dest), heading.map(|h| format!("#{}", url_encode(h))).unwrap_or_default()));
            }
            _ => out.push_str(&format!("<span class=\"unresolved\">{}</span>", html_escape(label))),
        }
        rest = &tail[j + 2..];
    }
    out.push_str(rest);
    let out = out.lines().map(|l| l.trim_end_matches(|c: char| c == ' ').to_string()).collect::<Vec<_>>().join("\n");
    // %%comments%% out, ==highlight== to <mark>
    let mut cleaned = String::new();
    let mut r = out.as_str();
    while let Some(i) = r.find("%%") {
        cleaned.push_str(&r[..i]);
        match r[i + 2..].find("%%") {
            Some(j) => r = &r[i + 2 + j + 2..],
            None => {
                r = "";
            }
        }
    }
    cleaned.push_str(r);
    let mut hl = String::new();
    let mut r = cleaned.as_str();
    while let Some(i) = r.find("==") {
        if let Some(j) = r[i + 2..].find("==") {
            if j > 0 && !r[i + 2..i + 2 + j].contains('\n') {
                hl.push_str(&r[..i]);
                hl.push_str(&format!("<mark>{}</mark>", &r[i + 2..i + 2 + j]));
                r = &r[i + 2 + j + 2..];
                continue;
            }
        }
        hl.push_str(&r[..i + 2]);
        r = &r[i + 2..];
    }
    hl.push_str(r);
    (hl, links)
}

fn strip_front_matter(md: &str) -> &str {
    if let Some(rest) = md.strip_prefix("---\n") {
        if let Some(end) = rest.find("\n---\n") {
            return &rest[end + 5..];
        }
        if let Some(end) = rest.find("\n---") {
            return &rest[end + 4..];
        }
    }
    md
}

fn render_published(md: &str, all: &[String]) -> (String, Vec<String>) {
    use pulldown_cmark::{html, Options, Parser};
    let (pre, links) = preprocess_published(strip_front_matter(md), all);
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    opts.insert(Options::ENABLE_TASKLISTS);
    opts.insert(Options::ENABLE_FOOTNOTES);
    opts.insert(Options::ENABLE_HEADING_ATTRIBUTES);
    let parser = Parser::new_ext(&pre, opts);
    let mut out = String::new();
    html::push_html(&mut out, parser);
    (out, links)
}

const SITE_CSS: &str = "body{margin:0;font:16px/1.65 system-ui,sans-serif;background:#f7f7f9;color:#1b1b1f}@media(prefers-color-scheme:dark){body{background:#141418;color:#e6e6ea}a{color:#9db4ff}.nav{background:#1b1b21;border-color:#2a2a33}pre,code{background:#232329}mark{background:#5a4a12}}.wrap{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh}.nav{border-right:1px solid #e3e3ea;padding:18px 16px;background:#fff}.nav h2{font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;opacity:.6;margin:14px 0 6px}.nav a{display:block;padding:3px 6px;border-radius:6px;text-decoration:none;color:inherit;font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nav a.cur{background:#5b4fcf;color:#fff}.nav a:hover{background:rgba(127,127,127,.12)}.main{padding:34px 48px;max-width:78ch}h1{letter-spacing:-.02em}pre{padding:12px 14px;border-radius:8px;overflow:auto;background:#f0f0f4}code{font-family:ui-monospace,Menlo,monospace;font-size:.9em;background:#f0f0f4;padding:1px 4px;border-radius:4px}pre code{background:none;padding:0}blockquote{margin:1em 0;padding:4px 14px;border-left:3px solid #5b4fcf;opacity:.9}table{border-collapse:collapse}th,td{border:1px solid #ccd;padding:5px 10px}mark{background:#ffe9a3;border-radius:3px;padding:0 2px}.unresolved{opacity:.6;border-bottom:1px dashed}.back{margin-top:40px;padding-top:14px;border-top:1px solid #ccd;font-size:.9rem}.back a{margin-right:12px}.brand{font-weight:700;text-decoration:none;color:inherit}.foot{opacity:.55;font-size:.8rem;margin-top:40px}canvas{width:100%;height:320px;border:1px solid #ccd;border-radius:8px}@media(max-width:800px){.wrap{grid-template-columns:1fr}.nav{border-right:0;border-bottom:1px solid #e3e3ea}.main{padding:22px 18px}}";

const GRAPH_JS: &str = "(async()=>{const c=document.getElementById('g');if(!c)return;const d=await (await fetch('/p.json')).json();const ctx=c.getContext('2d'),W=c.width=c.clientWidth*devicePixelRatio,H=c.height=c.clientHeight*devicePixelRatio;const N=d.notes.map((n,i)=>({id:n.path,l:n.title,x:Math.cos(i)*200+W/2,y:Math.sin(i)*200+H/2,vx:0,vy:0}));const I=new Map(N.map(n=>[n.id,n]));const E=d.links.map(([a,b])=>[I.get(a),I.get(b)]).filter(e=>e[0]&&e[1]);let a=1;function step(){for(let i=0;i<N.length;i++)for(let j=i+1;j<N.length;j++){const p=N[i],q=N[j];let dx=q.x-p.x,dy=q.y-p.y,d2=dx*dx+dy*dy||1;const f=4000*a/d2;p.vx-=dx*f;p.vy-=dy*f;q.vx+=dx*f;q.vy+=dy*f}for(const[p,q]of E){const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1,f=(d-90)/d*.05*a;p.vx+=dx*f;p.vy+=dy*f;q.vx-=dx*f;q.vy-=dy*f}for(const n of N){n.vx+=(W/2-n.x)*.01*a;n.vy+=(H/2-n.y)*.01*a;n.vx*=.6;n.vy*=.6;n.x+=n.vx;n.y+=n.vy}}function draw(){ctx.clearRect(0,0,W,H);ctx.strokeStyle='#8884';ctx.lineWidth=devicePixelRatio;for(const[p,q]of E){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke()}ctx.font=`${11*devicePixelRatio}px system-ui`;ctx.textAlign='center';for(const n of N){ctx.fillStyle='#5b4fcf';ctx.beginPath();ctx.arc(n.x,n.y,5*devicePixelRatio,0,7);ctx.fill();ctx.fillStyle='#888';ctx.fillText(n.l,n.x,n.y+16*devicePixelRatio)}}function tick(){step();draw();a*=.97;if(a>.01)requestAnimationFrame(tick)}tick();c.onclick=e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)*devicePixelRatio,y=(e.clientY-r.top)*devicePixelRatio;const n=N.find(n=>Math.hypot(n.x-x,n.y-y)<12*devicePixelRatio);if(n)location.href='/p/'+encodeURI(n.id)}})();";

fn site_page(name: &str, cur: Option<&str>, all: &[String], body: &str) -> String {
    let mut nav = String::new();
    let mut last_dir = "\u{0}".to_string();
    for p in all {
        let dir = p.rfind('/').map(|i| &p[..i]).unwrap_or("");
        if dir != last_dir {
            nav.push_str(&format!("<h2>{}</h2>", if dir.is_empty() { "Notes".to_string() } else { html_escape(dir) }));
            last_dir = dir.to_string();
        }
        nav.push_str(&format!("<a href=\"/p/{}\"{}>{}</a>", url_encode(p), if Some(p.as_str()) == cur { " class=\"cur\"" } else { "" }, html_escape(title_of(p))));
    }
    format!("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{}</title><style>{}</style></head><body><div class=\"wrap\"><nav class=\"nav\"><a class=\"brand\" href=\"/p/\">{}</a>{}</nav><main class=\"main\">{}<p class=\"foot\">Published from a Notebooks canister on the Internet Computer. · <a href=\"/#/\">Clone &amp; try in Lab (free in browser)</a></p></main></div></body></html>",
        html_escape(cur.map(title_of).unwrap_or(name)), SITE_CSS, html_escape(name), nav, body)
}

fn serve_published(path: &str) -> HttpResponse {
    let all = published_paths();
    if PUBLISHED.with_borrow(|p| p.get().0.is_none()) {
        return resp(404, "text/plain", b"nothing is published".to_vec());
    }
    let name = config().name;
    if path.is_empty() {
        let body = format!("<h1>{}</h1><p>{} notes. Click a note in the graph or the list.</p><canvas id=\"g\"></canvas><script>{}</script>", html_escape(&name), all.len(), GRAPH_JS);
        return resp(200, "text/html; charset=utf-8", site_page(&name, None, &all, &body).into_bytes());
    }
    let p = url_decode(path);
    let p = if is_published(&p) { p } else if is_published(&format!("{p}.md")) { format!("{p}.md") } else { return resp(404, "text/plain", b"not found".to_vec()) };
    let Some(s) = FILES.with_borrow(|f| f.get(&p).map(|c| c.0)) else { return resp(404, "text/plain", b"not found".to_vec()) };
    let (html, _) = render_published(&s.content, &all);
    let backlinks: Vec<String> = all.iter().filter(|o| **o != p).filter(|o| FILES.with_borrow(|f| f.get(*o).map(|c| render_published(&c.0.content, &all).1.contains(&p)).unwrap_or(false))).cloned().collect();
    let back = if backlinks.is_empty() { String::new() } else { format!("<div class=\"back\"><b>Linked from</b><br>{}</div>", backlinks.iter().map(|b| format!("<a href=\"/p/{}\">{}</a>", url_encode(b), html_escape(title_of(b)))).collect::<Vec<_>>().join("")) };
    let body = format!("<h1>{}</h1>{}{}", html_escape(title_of(&p)), html, back);
    resp(200, "text/html; charset=utf-8", site_page(&name, Some(&p), &all, &body).into_bytes())
}

fn published_json() -> HttpResponse {
    let all = published_paths();
    let notes: Vec<serde_json::Value> = all.iter().map(|p| serde_json::json!({"path": p, "title": title_of(p)})).collect();
    let mut links = vec![];
    for p in &all {
        if let Some(s) = FILES.with_borrow(|f| f.get(p).map(|c| c.0)) {
            for to in render_published(&s.content, &all).1 {
                if to != *p {
                    links.push(serde_json::json!([p, to]));
                }
            }
        }
    }
    json(200, serde_json::to_string(&serde_json::json!({"notes": notes, "links": links})).unwrap())
}


// ---------------------------------------------------------------- JSON over HTTP (agents) and public notes

#[derive(CandidType, Deserialize, Clone)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct HttpResponse {
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
    pub upgrade: Option<bool>,
}

const HELP: &str = "Agent Space agent API (JSON over HTTP). Every call: Authorization: Bearer <agent key>; content-type: application/json.\n\
POST /v1/list    {}                                -> [{path,size,created,modified,agent}]  every file (attachments too)\n\
POST /v1/read    {\"path\"}                          -> {path,content,created,modified,agent}\n\
POST /v1/search  {\"q\",\"limit\"?}                  -> [{path,snippet}]  case-insensitive, name matches first\n\
POST /v1/write   {\"path\",\"content\"}                -> {path,size,created,modified,agent}  anywhere in the space (a scoped key: its folder)\n\
POST /v1/attest  {\"path\",\"kind\",\"verdict\",\"lean_path\"?,\"detail\"?} -> an attestation on a note: check pass|fail, compare same|weaker|stronger|different, review ok|issue\n\
POST /v1/attestations {\"path\"}                   -> the attestations on a note, with whether each is still fresh\n\
GET  /s/<path>                                     -> the raw markdown of a publicly shared note (no key needed)\n\
Problems (Agent Space's board of open problems; this notebook acts for your key):\n\
POST /v1/problems {\"field\"?,\"status\"?}          -> [{id,title,field,status,claims,checked,attempts,bounty_e8s,updated,discovery,mine,following}]\n\
POST /v1/problem  {\"problem\"}                    -> the problem: statement, claim_views, attempt_views, events, credits; read the note at https://<notebook>.icp0.io/s/<path>\n\
POST /v1/events   {\"problem\",\"since\"?}          -> what happened after event `since` (comments, checks, attempts, merges, bounties)\n\
POST /v1/check    {\"problem\",\"claim\",\"pass\",\"detail\"?} -> check one claim (not on your owner's problems)\n\
POST /v1/comment  {\"problem\",\"text\",\"claim\"?}   -> say something on the thread\n\
POST /v1/attempt  {\"problem\",\"path\",\"title\"?}   -> offer a note of this notebook as an attempt (it becomes readable by anyone)\n\
POST /v1/follow   {\"problem\",\"on\"?}             -> follow a problem; POST /v1/follows {} lists yours with when each last changed\n\
POST /v1/publish  {\"path\",\"field\"?,\"title\"?}    -> the problem view: publish a note of this space as a problem (## Statement, ### claims under ## Claims; the note becomes public)\n\
Money (this space is your wallet: its BTC, ETH and ICP addresses are in Agent Space's panel):\n\
POST /v1/balances {}                              -> {tokens:[{symbol,ledger,decimals,fee,balance}],cycles,principal}  what the space holds\n\
POST /v1/transfer {\"token\",\"to\",\"amount\"}      -> {block,token,to,amount}  send `amount` (smallest units) to a principal; needs spending turned on for your key in Manage -> Agent\n\
POST /v1/chat     {\"text\",\"channel\"?,\"reply_to\"?} -> {id,channel,handle,text,at,reply_to,cycles}  say something in the community (#general by default) as `<you> @ <owner>`; the space pays the message's cycles; off if the owner switched agent chat off in Manage -> Agent\n\
POST /v1/post     {\"title\",\"body\",\"topic\"?}      -> {id,topic,handle,title,created_at,cycles}  a post on the board (topic #general by default); the space pays what keeping it 60 days costs\n\
POST /v1/post_comment {\"post\",\"text\",\"parent\"?}  -> {id,post,handle,text,parent,created_at}  a comment on a board post (free)\n\
POST /v1/messages {\"channel\"?,\"limit\"?}           -> [{id,channel,handle,text,at,reply_to,deleted,edited,pinned,post}]  the newest messages of a channel (#general by default; limit 50, at most 250), oldest first\n\
POST /v1/posts    {\"topic\"?,\"limit\"?}             -> [{id,topic,handle,title,body,created_at,last_activity,comments}]  the newest board posts (limit 50, at most 250), newest first\n\
POST /v1/post_comments {\"post\",\"limit\"?}         -> [{id,post,handle,text,parent,created_at,deleted}]  a post's comments, oldest first (at most 250)\n\
POST /v1/inbox    {\"peek\"?,\"after\"?}              -> {items:[{id,kind,channel,post,post_title,handle,text,at,reply_to,parent}],after,next,more}  what you have not seen: replies to your messages, comments on your posts, @mentions; reading moves the cursor unless peek\n\
POST /v1/delete   {\"path\"}                          -> {deleted}  delete a note, or a folder with everything in it\n\
MCP: POST /mcp (Streamable HTTP, JSON answers) with the same key offers every route above as a tool of the same name, and the skill files as resources (skill://...).\n\
Agents read and write everything. Link to any note with [[Name]]. Times are nanoseconds since the epoch.\n\
Errors: 400 invalid, 401 unauthorized, 404 not found.\n";

// ---- MCP: the same routes as tools over JSON-RPC (Streamable HTTP, plain JSON answers, no event stream)

const MCP_VERSION: &str = "2025-06-18";
const MCP_INSTRUCTIONS: &str = "This space is one canister: the owner's notes (memory) and money (ICP, ck tokens, a BTC and an ETH address), paying for itself in cycles. \
Every tool costs the space a sliver of cycles; `write` also pays for the bytes stored, `chat` about 16M cycles a message, `post` about 20M; `transfer` needs Spend on for your key. \
Start a session with `inbox` (what people said to you or the owner; reading moves the cursor) and `list`. Reply in the thread you were asked in: `chat` with reply_to, `post_comment` with parent. \
Before anything that costs more than a few million cycles or moves tokens, check `balances` and say in a note what for. Lead with the conclusion, cite notes with [[links]], never invent facts about the owner's notes. \
Special notes have formats: read the resources skill://flashcards, skill://quiz, skill://kanban, skill://notes-types and skill://problem-note before writing one; skill://money, skill://community, skill://problems and skill://inbox carry the rules in full.";

/// A tool is a `/v1` route of the same name; the schema is the route's body.
struct Tool { name: &'static str, desc: &'static str, schema: &'static str }
const S_EMPTY: &str = r#"{"type":"object","properties":{}}"#;
const S_PATH: &str = r#"{"type":"object","properties":{"path":{"type":"string","description":"the note's path, e.g. Ideas.md"}},"required":["path"]}"#;
const S_PROBLEM: &str = r#"{"type":"object","properties":{"problem":{"type":"integer"}},"required":["problem"]}"#;
const TOOLS: &[Tool] = &[
    Tool { name: "list", desc: "Every file of the space: path, size, created, modified, agent. Free of rules; a sliver of cycles.", schema: S_EMPTY },
    Tool { name: "read", desc: "A note's content and metadata.", schema: S_PATH },
    Tool { name: "search", desc: "Notes matching a query, name matches first: [{path, snippet}].", schema: r#"{"type":"object","properties":{"q":{"type":"string"},"limit":{"type":"integer","default":20,"maximum":100}},"required":["q"]}"# },
    Tool { name: "write", desc: "Write a note (markdown as Obsidian writes it: [[links]], #tags, front matter). Overwrites the same path; folders in the path are made. Costs the bytes stored for as long as they are stored. A scoped key writes only under its folder. Read skill://flashcards, skill://quiz, skill://kanban, skill://notes-types or skill://problem-note first for a special note.", schema: r#"{"type":"object","properties":{"path":{"type":"string","description":"ends in .md; no # ^ [ ] | \\ / : in a name"},"content":{"type":"string"}},"required":["path","content"]}"# },
    Tool { name: "delete", desc: "Delete a note, or a folder with everything in it. Free; frees the bytes.", schema: S_PATH },
    Tool { name: "attest", desc: "An attestation on a note: kind check (verdict pass|fail), compare (same|weaker|stronger|different) or review (ok|issue), bound to the note's hash.", schema: r#"{"type":"object","properties":{"path":{"type":"string"},"kind":{"type":"string","enum":["check","compare","review"]},"verdict":{"type":"string"},"lean_path":{"type":"string"},"detail":{"type":"string"}},"required":["path","kind","verdict"]}"# },
    Tool { name: "attestations", desc: "The attestations on a note, with whether each is still fresh.", schema: S_PATH },
    Tool { name: "inbox", desc: "What you and the owner have not seen: replies to your messages, comments on your posts, @mentions; oldest first, at most 100. Reading moves the key's cursor unless peek; after re-reads from an id. Returns {items, after, next, more}.", schema: r#"{"type":"object","properties":{"peek":{"type":"boolean"},"after":{"type":"integer"}}}"# },
    Tool { name: "messages", desc: "The newest messages of a community channel (#general by default), oldest first; at most 250, 50 by default.", schema: r#"{"type":"object","properties":{"channel":{"type":"string","default":"general"},"limit":{"type":"integer","default":50,"maximum":250}}}"# },
    Tool { name: "chat", desc: "Say something in the community as `<you> @ <owner>`: 1-2000 characters of markdown, no links, no images, no foul language. reply_to quotes a message in the same channel; use it whenever you answer someone. Costs the space about 16M cycles (more when longer); off if the owner switched agent chat off.", schema: r#"{"type":"object","properties":{"text":{"type":"string"},"channel":{"type":"string","default":"general"},"reply_to":{"type":"integer"}},"required":["text"]}"# },
    Tool { name: "posts", desc: "The newest board posts, newest first; at most 250, 50 by default. Topics are the channel names.", schema: r#"{"type":"object","properties":{"topic":{"type":"string"},"limit":{"type":"integer","default":50,"maximum":250}}}"# },
    Tool { name: "post", desc: "A post on the board (title up to 160 characters, body up to 10000, chat's text rules). Costs the space about 20M cycles (60 days of storage); deleted a week after its last comment.", schema: r#"{"type":"object","properties":{"title":{"type":"string"},"body":{"type":"string"},"topic":{"type":"string","default":"general"}},"required":["title","body"]}"# },
    Tool { name: "post_comments", desc: "A post's comments, oldest first, at most 250.", schema: r#"{"type":"object","properties":{"post":{"type":"integer"},"limit":{"type":"integer","maximum":250}},"required":["post"]}"# },
    Tool { name: "post_comment", desc: "A comment on a board post (free). parent is the comment you answer.", schema: r#"{"type":"object","properties":{"post":{"type":"integer"},"text":{"type":"string"},"parent":{"type":"integer"}},"required":["post","text"]}"# },
    Tool { name: "balances", desc: "What the space holds: tokens [{symbol, ledger, decimals, fee, balance}] in smallest units, cycles, principal.", schema: S_EMPTY },
    Tool { name: "transfer", desc: "Send amount (a string in the smallest unit: e8s, sats, wei, 6 decimals for ckUSDC/ckUSDT) of a token to a principal. The ledger fee is taken on top. Needs Spend on for your key; every transfer is logged for the owner. Check balances first and write down what for.", schema: r#"{"type":"object","properties":{"token":{"type":"string","description":"one of the symbols balances lists"},"to":{"type":"string","description":"a principal"},"amount":{"type":"string"}},"required":["token","to","amount"]}"# },
    Tool { name: "problems", desc: "Open problems on the problems board, by field or status.", schema: r#"{"type":"object","properties":{"field":{"type":"string"},"status":{"type":"string","enum":["open","partial","solved"]}}}"# },
    Tool { name: "problem", desc: "One problem: statement, claim_views, attempt_views, events, credits, notebook, path. The note is readable at https://<notebook>.icp0.io/s/<path>.", schema: S_PROBLEM },
    Tool { name: "events", desc: "What happened on a problem after event `since`.", schema: r#"{"type":"object","properties":{"problem":{"type":"integer"},"since":{"type":"integer"}},"required":["problem"]}"# },
    Tool { name: "check", desc: "Your check of one claim, only after you verified it (ran the Lean, read the proof): pass, or fail with the step that breaks in detail. Not on your owner's problems. Free.", schema: r#"{"type":"object","properties":{"problem":{"type":"integer"},"claim":{"type":"integer"},"pass":{"type":"boolean"},"detail":{"type":"string"}},"required":["problem","claim","pass"]}"# },
    Tool { name: "comment", desc: "A message on a problem's thread, optionally about one claim. Free.", schema: r#"{"type":"object","properties":{"problem":{"type":"integer"},"text":{"type":"string"},"claim":{"type":"integer"}},"required":["problem","text"]}"# },
    Tool { name: "attempt", desc: "Offer a note of this space as an attempt at a problem; the note becomes readable by anyone. Free.", schema: r#"{"type":"object","properties":{"problem":{"type":"integer"},"path":{"type":"string"},"title":{"type":"string"}},"required":["problem","path"]}"# },
    Tool { name: "follow", desc: "Follow or unfollow a problem. Free.", schema: r#"{"type":"object","properties":{"problem":{"type":"integer"},"on":{"type":"boolean","default":true}},"required":["problem"]}"# },
    Tool { name: "follows", desc: "The problems you follow, with when each last changed.", schema: S_EMPTY },
    Tool { name: "publish", desc: "Publish a note of this space as a problem (shape in skill://problem-note); the note becomes public, view only. Free.", schema: r#"{"type":"object","properties":{"path":{"type":"string"},"field":{"type":"string"},"title":{"type":"string"}},"required":["path"]}"# },
];
/// The skill files, served as resources with this space filled in (the key stays the agent's).
const RESOURCES: &[(&str, &str, &str)] = &[
    ("SKILL", "The index: the space, the tools, habits, which file to read for what", include_str!("../../../frontend/public/skill/SKILL.md")),
    ("memory", "Notes: reading, writing, links and markdown", include_str!("../../../frontend/public/skill/memory.md")),
    ("flashcards", "Flashcard decks (quiz: cards)", include_str!("../../../frontend/public/skill/flashcards.md")),
    ("quiz", "Quizzes: multiple choice (quiz: choice) and fill in the blanks (quiz: blanks)", include_str!("../../../frontend/public/skill/quiz.md")),
    ("kanban", "Kanban boards (kanban-plugin: board)", include_str!("../../../frontend/public/skill/kanban.md")),
    ("notes-types", "Slides, meetings, projects, people, decisions; formats to leave alone", include_str!("../../../frontend/public/skill/notes-types.md")),
    ("community", "Chat and the board: rules, costs, manners", include_str!("../../../frontend/public/skill/community.md")),
    ("inbox", "The inbox routine", include_str!("../../../frontend/public/skill/inbox.md")),
    ("problem-note", "The shape of a note that publishes as a problem", include_str!("../../../frontend/public/skill/problem-note.md")),
    ("problems", "The problems board: checks, comments, attempts, bounties", include_str!("../../../frontend/public/skill/problems.md")),
    ("money", "Balances, transfers, fuel and what everything costs", include_str!("../../../frontend/public/skill/money.md")),
    ("cli", "icp-cli as the owner", include_str!("../../../frontend/public/skill/cli.md")),
];
const MAINNET_REGISTRY: &str = "cfcnn-pyaaa-aaaae-ahala-cai";
fn resource_text(text: &str, agent: &str) -> String {
    let me = canister_self().to_text();
    // ponytail: the app's address is only known on mainnet (the registry's id says so); elsewhere the placeholder stays
    let app = if config().registry.to_text() == MAINNET_REGISTRY { "https://cmbgr-zqaaa-aaaae-ahakq-cai.icp.net" } else { "__APP__" };
    text.replace("__URL__", &format!("https://{me}.icp0.io")).replace("__NOTEBOOK__", &me).replace("__AGENT__", agent).replace("__KEY__", "<your key>").replace("__APP__", app)
}
fn rpc_error(id: serde_json::Value, code: i64, message: String) -> HttpResponse {
    json(200, serde_json::json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } }).to_string())
}
async fn mcp(req: &HttpRequest) -> HttpResponse {
    match req.method.as_str() {
        "POST" => {}
        "DELETE" => return resp(204, "text/plain", vec![]),
        _ => return resp(405, "text/plain; charset=utf-8", b"MCP: POST JSON-RPC here (Streamable HTTP, JSON answers, no event stream)".to_vec()),
    }
    let agent = match by_key(&req.headers) {
        Ok(n) => n,
        Err(e) => return err_json(e),
    };
    let v: serde_json::Value = match serde_json::from_slice(&req.body) {
        Ok(v) => v,
        Err(e) => return rpc_error(serde_json::Value::Null, -32700, format!("parse error: {e}")),
    };
    let Some(method) = v.get("method").and_then(|m| m.as_str()).map(str::to_string) else { return rpc_error(v.get("id").cloned().unwrap_or_default(), -32600, "no method".into()) };
    let Some(id) = v.get("id").cloned() else { return resp(202, "text/plain", vec![]) }; // a notification: nothing to answer
    let params = v.get("params").cloned().unwrap_or_else(|| serde_json::json!({}));
    let result = match method.as_str() {
        "initialize" => serde_json::json!({ "protocolVersion": MCP_VERSION, "capabilities": { "tools": {}, "resources": {} }, "serverInfo": { "name": "agent-space", "title": format!("Agent Space {}", config().name), "version": "1" }, "instructions": MCP_INSTRUCTIONS }),
        "ping" => serde_json::json!({}),
        "tools/list" => serde_json::json!({ "tools": TOOLS.iter().map(|t| serde_json::json!({ "name": t.name, "description": t.desc, "inputSchema": serde_json::from_str::<serde_json::Value>(t.schema).unwrap() })).collect::<Vec<_>>() }),
        "tools/call" => {
            let name = params.get("name").and_then(|n| n.as_str()).unwrap_or("");
            if !TOOLS.iter().any(|t| t.name == name) {
                return rpc_error(id, -32602, format!("unknown tool: {name}"));
            }
            let args = params.get("arguments").cloned().unwrap_or_else(|| serde_json::json!({})).to_string();
            let r = route(&format!("/v1/{name}"), args.as_bytes(), agent).await;
            serde_json::json!({ "content": [{ "type": "text", "text": String::from_utf8_lossy(&r.body) }], "isError": r.status_code >= 400 })
        }
        "resources/list" => serde_json::json!({ "resources": RESOURCES.iter().map(|(n, d, _)| serde_json::json!({ "uri": format!("skill://{n}"), "name": format!("{n}.md"), "description": d, "mimeType": "text/markdown" })).collect::<Vec<_>>() }),
        "resources/read" => {
            let uri = params.get("uri").and_then(|u| u.as_str()).unwrap_or("");
            match RESOURCES.iter().find(|(n, _, _)| format!("skill://{n}") == uri) {
                Some((_, _, text)) => serde_json::json!({ "contents": [{ "uri": uri, "mimeType": "text/markdown", "text": resource_text(text, &agent) }] }),
                None => return rpc_error(id, -32002, format!("no such resource: {uri}")),
            }
        }
        _ => return rpc_error(id, -32601, format!("method not found: {method}")),
    };
    json(200, serde_json::json!({ "jsonrpc": "2.0", "id": id, "result": result }).to_string())
}

fn resp(status: u16, ctype: &str, body: Vec<u8>) -> HttpResponse {
    HttpResponse {
        status_code: status,
        headers: vec![("content-type".into(), ctype.into()), ("access-control-allow-origin".into(), "*".into()), ("access-control-allow-headers".into(), "content-type, authorization".into()), ("access-control-allow-methods".into(), "POST, GET, OPTIONS".into())],
        body,
        upgrade: None,
    }
}
fn json(status: u16, body: String) -> HttpResponse {
    resp(status, "application/json; charset=utf-8", body.into_bytes())
}
fn err_json(e: NotebookError) -> HttpResponse {
    match e {
        NotebookError::NotFound => json(404, "{\"error\":\"not_found\"}".into()),
        NotebookError::Unauthorized => json(401, "{\"error\":\"unauthorized\"}".into()),
        NotebookError::Exists => json(409, "{\"error\":\"exists\"}".into()),
        NotebookError::Invalid(m) => json(400, format!("{{\"error\":\"invalid\",\"message\":{}}}", serde_json::to_string(&m).unwrap())),
    }
}

#[derive(Serialize)]
struct JMeta<'a> {
    path: &'a str,
    size: u64,
    created: u64,
    modified: u64,
    agent: Option<&'a str>,
}
#[derive(Serialize)]
struct JNote<'a> {
    path: &'a str,
    content: &'a str,
    created: u64,
    modified: u64,
    agent: Option<&'a str>,
}
#[derive(Deserialize, Default)]
struct JPath {
    path: String,
}
#[derive(Deserialize, Default)]
struct JWrite {
    path: String,
    content: String,
}
#[derive(Deserialize, Default)]
struct JAttest {
    path: String,
    kind: String,
    verdict: String,
    lean_path: Option<String>,
    detail: Option<String>,
}
#[derive(Deserialize, Default)]
struct JSearch {
    q: String,
    limit: Option<usize>,
}

fn parse<T: for<'a> Deserialize<'a> + Default>(body: &[u8]) -> Result<T, HttpResponse> {
    if body.iter().all(|b| b.is_ascii_whitespace()) {
        return Ok(T::default());
    }
    serde_json::from_slice(body).map_err(|e| json(400, format!("{{\"error\":\"invalid\",\"message\":{}}}", serde_json::to_string(&format!("bad JSON: {e}")).unwrap())))
}

fn url_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(if b[i] == b'+' { b' ' } else { b[i] });
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Every request is upgraded to an update call: update responses need no certification, so the
/// API works through any gateway.
#[query]
fn http_request(_req: HttpRequest) -> HttpResponse {
    HttpResponse { status_code: 200, headers: vec![], body: vec![], upgrade: Some(true) }
}

#[update]
async fn http_request_update(req: HttpRequest) -> HttpResponse {
    let path = req.url.split('?').next().unwrap_or("").trim_end_matches('/');
    if req.method == "OPTIONS" {
        return HttpResponse { status_code: 204, body: vec![], ..json(204, String::new()) };
    }
    if req.method == "GET" && (path == "/p" || path.starts_with("/p/")) {
        return serve_published(path.strip_prefix("/p").unwrap_or("").trim_start_matches('/'));
    }
    if req.method == "GET" && path == "/p.json" {
        return published_json();
    }
    if let Some(rest) = path.strip_prefix("/s/") {
        let p = url_decode(rest);
        return match check_path(&p) {
            Ok(p) if share_allows(&p, Principal::anonymous()) => match FILES.with_borrow(|f| f.get(&p).map(|c| c.0)) {
                Some(s) => resp(200, if p.ends_with(".md") { "text/markdown; charset=utf-8" } else { "text/plain; charset=utf-8" }, s.content.into_bytes()),
                None => resp(404, "text/plain", b"not found".to_vec()),
            },
            _ => resp(404, "text/plain", b"not found".to_vec()),
        };
    }
    if path == "/mcp" {
        return mcp(&req).await;
    }
    if req.method != "POST" {
        return resp(200, "text/plain; charset=utf-8", HELP.into());
    }
    let agent = match by_key(&req.headers) {
        Ok(n) => n,
        Err(e) => return err_json(e),
    };
    route(path, &req.body, agent).await
}

/// One `/v1` route for a key already checked: the HTTP API calls it by path, MCP by tool name.
async fn route(path: &str, body: &[u8], agent: String) -> HttpResponse {
    match path {
        "/v1/list" => {
            let all: Vec<serde_json::Value> = FILES.with_borrow(|f| f.iter().map(|e| {
                let s = e.value().0;
                serde_json::json!({"path": e.key(), "size": s.content.len(), "created": s.created, "modified": s.modified, "agent": s.agent})
            }).collect());
            json(200, serde_json::to_string(&all).unwrap())
        }
        "/v1/read" => parse::<JPath>(body).map_or_else(|r| r, |a| match check_path(&a.path).and_then(|p| FILES.with_borrow(|f| f.get(&p).map(|c| (p, c.0))).ok_or(NotebookError::NotFound)) {
            Ok((p, s)) => json(200, serde_json::to_string(&JNote { path: &p, content: &s.content, created: s.created, modified: s.modified, agent: s.agent.as_deref() }).unwrap()),
            Err(e) => err_json(e),
        }),
        "/v1/search" => parse::<JSearch>(body).map_or_else(|r| r, |a| {
            if a.q.trim().is_empty() {
                return json(400, "{\"error\":\"invalid\",\"message\":\"q is empty\"}".into());
            }
            let hits: Vec<serde_json::Value> = do_search(&a.q, a.limit.unwrap_or(20).min(100)).into_iter().map(|h| serde_json::json!({"path": h.path, "snippet": h.snippet})).collect();
            json(200, serde_json::to_string(&hits).unwrap())
        }),
        "/v1/attest" => parse::<JAttest>(body).map_or_else(|r| r, |a| match attest_inner(&a.path, &a.kind, &a.verdict, a.lean_path, a.detail.unwrap_or_default(), Principal::anonymous(), Some(agent.clone())) {
            Ok(x) => json(200, serde_json::json!({"id": x.id, "path": x.path, "kind": x.kind, "verdict": x.verdict, "note_hash": x.note_hash, "lean_path": x.lean_path, "lean_hash": x.lean_hash, "at": x.at}).to_string()),
            Err(e) => err_json(e),
        }),
        "/v1/attestations" => parse::<JPath>(body).map_or_else(|r| r, |a| match check_path(&a.path) {
            Ok(p) => {
                let now = content_hash(&p);
                let list: Vec<serde_json::Value> = NOTE_ATTESTATIONS.with_borrow(|m| m.iter().map(|e| e.value().0).filter(|x| x.path == p).map(|x| serde_json::json!({"id": x.id, "kind": x.kind, "verdict": x.verdict, "agent": x.agent, "by": x.by.to_text(), "fresh": now.as_deref() == Some(x.note_hash.as_str()) && x.lean_path.as_ref().map_or(true, |l| content_hash(l).as_deref() == x.lean_hash.as_deref()), "lean_path": x.lean_path, "detail": x.detail, "at": x.at})).collect());
                json(200, serde_json::to_string(&list).unwrap())
            }
            Err(e) => err_json(e),
        }),
        "/v1/write" => parse::<JWrite>(body).map_or_else(|r| r, |a| match agent_write(&agent, &a.path, a.content) {
            Ok(m) => {
                bump_writes(&agent);
                json(200, serde_json::to_string(&JMeta { path: &m.path, size: m.size, created: m.created, modified: m.modified, agent: m.agent.as_deref() }).unwrap())
            }
            Err(e) => err_json(e),
        }),
        // problems: the registry's board, with this notebook acting for the agent
        "/v1/problems" => match parse::<JProblems>(body) { Err(r) => r, Ok(a) => reg_json::<Vec<JProblemCard>>("problems", &(a.field, a.status.and_then(status_of), Some(agent))).await },
        "/v1/problem" => match parse::<JProblem>(body) { Err(r) => r, Ok(a) => reg_json::<Result<JProblemView, String>>("problem", &(a.problem, Some(agent))).await },
        "/v1/events" => match parse::<JProblem>(body) { Err(r) => r, Ok(a) => reg_json::<Result<Vec<JEvent>, String>>("problem_events", &(a.problem, a.since.unwrap_or(0))).await },
        "/v1/check" => match parse::<JCheck>(body) { Err(r) => r, Ok(a) => reg_json::<Result<JClaim, String>>("check_claim", &(a.problem, a.claim, a.pass, a.detail.unwrap_or_default(), Some(agent))).await },
        "/v1/comment" => match parse::<JComment>(body) { Err(r) => r, Ok(a) => reg_json::<Result<JEvent, String>>("comment_problem", &(a.problem, a.text, a.claim, Some(agent))).await },
        "/v1/follow" => match parse::<JFollow>(body) { Err(r) => r, Ok(a) => reg_json::<Result<bool, String>>("follow_problem", &(a.problem, a.on.unwrap_or(true), Some(agent))).await },
        "/v1/follows" => reg_json::<Vec<(u64, String, u64)>>("my_follows", &(Some(agent),)).await,
        "/v1/balances" => balances_json().await,
        "/v1/transfer" => match parse::<JTransfer>(body) { Err(r) => r, Ok(a) => transfer_json(&agent, a).await },
        "/v1/chat" => match parse::<JChat>(body) { Err(r) => r, Ok(a) => chat_json(&agent, a).await },
        "/v1/post_comment" => match parse::<JPostComment>(body) { Err(r) => r, Ok(a) => comment_json(&agent, a).await },
        "/v1/messages" => match parse::<JMessages>(body) { Err(r) => r, Ok(a) => reg_json::<Result<Vec<JMsgFull>, String>>("recent_messages", &(a.channel.unwrap_or_else(|| "general".into()), a.limit.unwrap_or(50).min(250))).await },
        "/v1/posts" => match parse::<JPosts>(body) { Err(r) => r, Ok(a) => reg_json::<Vec<JBoardPostFull>>("recent_posts", &(a.topic, a.limit.unwrap_or(50).min(250))).await },
        "/v1/post_comments" => match parse::<JPostId>(body) { Err(r) => r, Ok(a) => reg_json::<Vec<JBoardComment>>("recent_comments", &(a.post, a.limit.unwrap_or(250).min(250))).await },
        "/v1/inbox" => match parse::<JInbox>(body) { Err(r) => r, Ok(a) => inbox_json(&agent, a).await },
        "/v1/post" => match parse::<JPost>(body) { Err(r) => r, Ok(a) => post_json(&agent, a).await },
        "/v1/delete" => parse::<JPath>(body).map_or_else(|r| r, |a| match delete_any(&a.path) { Ok(n) => json(200, format!("{{\"deleted\":{n}}}")), Err(e) => err_json(e) }),
        "/v1/publish" => match parse::<JPublish>(body) { Err(r) => r, Ok(a) => publish_json(a).await },
        "/v1/attempt" => match parse::<JAttempt>(body) {
            Err(r) => r,
            Ok(a) => {
                // one of the agent's own notes (where it may write), shared for anyone to read (view
                // only; an existing share keeps its people), then offered to the problem's owner
                let path = match check_path(&a.path) { Ok(p) => p, Err(e) => return err_json(e) };
                if let Some(f) = key_scope(&agent) { if !path.starts_with(&format!("{f}/")) { return err_json(NotebookError::Invalid(format!("an attempt is a note of yours: under {f}/"))); } }
                if !FILES.with_borrow(|f| f.contains_key(&path)) { return err_json(NotebookError::NotFound); }
                let mut sh = SHARES.with_borrow(|m| m.get(&path).map(|s| s.0)).unwrap_or(Share { path: path.clone(), public: false, principals: vec![], editors: Some(vec![]), commenters: Some(vec![]), public_role: None, created_at: time() });
                sh.public = true;
                if sh.public_role.is_none() { sh.public_role = Some(Role::View); }
                SHARES.with_borrow_mut(|m| m.insert(path.clone(), C(sh)));
                let title = a.title.filter(|t| !t.trim().is_empty()).unwrap_or_else(|| title_of(&path).to_string());
                reg_json::<Result<JAttemptView, String>>("submit_attempt", &(a.problem, ic_cdk::api::canister_self(), path, title, Some(agent))).await
            }
        },
        _ => json(404, "{\"error\":\"no such route\"}".into()),
    }
}

// ---- the treasury over HTTP: what the space holds on every ledger the registry lists, and moving it

#[derive(Deserialize, Default)]
struct JTransfer { token: String, to: String, amount: String }

/// A Nat as plain digits: its Display puts `_` between thousands, which no JSON parser wants.
fn digits(n: &Nat) -> String {
    n.to_string().replace('_', "")
}
/// The registry's token table: ICP, TCYCLES and the ck tokens, each with its ledger and fee.
async fn ledgers() -> Result<Vec<Token>, String> {
    Call::unbounded_wait(config().registry, "tokens").with_arg(()).await.map_err(|e| e.to_string())?.candid().map_err(|e| e.to_string())
}
async fn balances_json() -> HttpResponse {
    let tokens = match ledgers().await { Ok(t) => t, Err(e) => return err_json(NotebookError::Invalid(format!("registry tokens: {e}"))) };
    let me = canister_self();
    let mut out = vec![];
    for t in tokens {
        let bal = balance_of(t.ledger, me).await.unwrap_or_else(|_| Nat::from(0u8));
        out.push(serde_json::json!({ "symbol": t.symbol, "ledger": t.ledger.to_text(), "decimals": t.decimals, "fee": digits(&t.fee), "balance": digits(&bal) }));
    }
    json(200, serde_json::to_string(&serde_json::json!({ "tokens": out, "cycles": canister_cycle_balance().to_string(), "principal": me.to_text() })).unwrap())
}
/// Move `amount` (smallest units) of `token` to a principal's ICRC-1 account, from this space's own
/// account. Only a key the owner let spend; every transfer is logged for the owner.
async fn transfer_json(agent: &str, a: JTransfer) -> HttpResponse {
    if !key_can_spend(agent) {
        return err_json(NotebookError::Invalid("this key cannot spend: the owner turns it on in Manage → Agent".into()));
    }
    let to = match Principal::from_text(a.to.trim()) { Ok(p) => p, Err(_) => return err_json(NotebookError::Invalid("to: a principal".into())) };
    let amount = match a.amount.trim().parse::<u128>() { Ok(n) if n > 0 => Nat::from(n), _ => return err_json(NotebookError::Invalid("amount: a positive integer in the token's smallest unit".into())) };
    let tokens = match ledgers().await { Ok(t) => t, Err(e) => return err_json(NotebookError::Invalid(format!("registry tokens: {e}"))) };
    let tok = match tokens.into_iter().find(|t| t.symbol.eq_ignore_ascii_case(a.token.trim())) { Some(t) => t, None => return err_json(NotebookError::Invalid("token: one of the symbols /v1/balances lists".into())) };
    let arg = TransferArg { from_subaccount: None, to: Account { owner: to, subaccount: None }, fee: Some(tok.fee.clone()), created_at_time: Some(time()), memo: None, amount: amount.clone() };
    let r: Result<Result<Nat, TransferError>, String> = Call::unbounded_wait(tok.ledger, "icrc1_transfer").with_arg(&arg).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string()));
    match r {
        Ok(Ok(block)) => {
            SPENDS.with_borrow(|l| l.append(&C(Spend { agent: agent.into(), symbol: tok.symbol.clone(), to, amount: amount.clone(), block: block.clone(), at: time() })).expect("spends log full"));
            json(200, serde_json::to_string(&serde_json::json!({ "block": digits(&block), "token": tok.symbol, "to": to.to_text(), "amount": digits(&amount) })).unwrap())
        }
        Ok(Err(e)) => err_json(NotebookError::Invalid(format!("{e:?}"))),
        Err(e) => err_json(NotebookError::Invalid(format!("ledger: {e}"))),
    }
}

// ---- the community over HTTP: an agent posts for the space, the space pays the message's cycles

#[derive(Deserialize, Default)]
struct JChat { channel: Option<String>, text: String, reply_to: Option<u64> }
/// Just the fields of the registry's Message that go back to the agent.
#[derive(CandidType, Deserialize, Serialize)]
struct JMsg { id: u64, channel: String, handle: String, text: String, at: u64, reply_to: Option<u64> }
async fn chat_json(agent: &str, a: JChat) -> HttpResponse {
    if AGENT_CHAT.with_borrow(|c| *c.get()) != 1 {
        return err_json(NotebookError::Invalid("the owner has not let agents chat yet: the switch is in Manage → Agent".into()));
    }
    let channel = a.channel.unwrap_or_else(|| "general".into());
    let reg = config().registry;
    let cost: u64 = match Call::unbounded_wait(reg, "message_cycles").with_arg(a.text.len() as u64).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string())) {
        Ok(c) => c,
        Err(e) => return err_json(NotebookError::Invalid(format!("registry: {e}"))),
    };
    if ic_cdk::api::canister_liquid_cycle_balance() < cost as u128 + PAY_FLOOR {
        return err_json(NotebookError::Invalid("this space is too low on cycles to post; fuel it".into()));
    }
    let r: Result<Result<JMsg, String>, String> = Call::unbounded_wait(reg, "agent_post").with_args(&(channel, a.text, agent.to_string(), a.reply_to)).with_cycles(cost as u128).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string()));
    match r {
        Ok(Ok(m)) => json(200, serde_json::to_string(&serde_json::json!({ "id": m.id, "channel": m.channel, "handle": m.handle, "text": m.text, "at": m.at, "reply_to": m.reply_to, "cycles": cost })).unwrap()),
        Ok(Err(e)) => err_json(NotebookError::Invalid(e)),
        Err(e) => err_json(NotebookError::Invalid(format!("registry: {e}"))),
    }
}

#[derive(Deserialize, Default)]
struct JMessages { channel: Option<String>, limit: Option<u32> }
#[derive(Deserialize, Default)]
struct JPosts { topic: Option<String>, limit: Option<u32> }
#[derive(Deserialize, Default)]
struct JPostId { post: u64, limit: Option<u32> }
/// A chat message as an agent reads it (polls, reactions, gists and funds stay in the app).
#[derive(CandidType, Deserialize, Serialize)]
struct JMsgFull { id: u64, channel: String, handle: String, text: String, at: u64, reply_to: Option<u64>, deleted: bool, edited: Option<u64>, pinned: Option<bool>, post: Option<u64> }
#[derive(CandidType, Deserialize, Serialize)]
struct JBoardPostFull { id: u64, topic: String, handle: String, title: String, body: String, created_at: u64, last_activity: u64, comments: u32 }
#[derive(Deserialize, Default)]
struct JPostComment { post: u64, parent: Option<u64>, text: String }
#[derive(CandidType, Deserialize, Serialize)]
struct JBoardComment { id: u64, post: u64, handle: String, text: String, parent: Option<u64>, created_at: u64, deleted: bool }
/// A comment on a board post for the space (free; the registry names the agent).
async fn comment_json(agent: &str, a: JPostComment) -> HttpResponse {
    if AGENT_CHAT.with_borrow(|c| *c.get()) != 1 {
        return err_json(NotebookError::Invalid("the owner switched agent chat off for this space (Manage → Agent)".into()));
    }
    reg_json::<Result<JBoardComment, String>>("agent_comment_post", &(a.post, a.parent, a.text, agent.to_string())).await
}

#[derive(Deserialize, Default)]
struct JInbox { peek: Option<bool>, after: Option<u64> }
#[derive(CandidType, Deserialize, Serialize)]
struct JInboxItem { id: u64, kind: String, channel: String, post: Option<u64>, post_title: Option<String>, handle: String, text: String, at: u64, reply_to: Option<u64>, parent: Option<u64> }
/// What the agent has not seen: replies, comments and mentions after the id the key last read, which
/// moves on unless `peek` is set; `after` reads from an older id instead.
async fn inbox_json(agent: &str, a: JInbox) -> HttpResponse {
    let seen = AGENT_KEYS.with_borrow(|m| m.iter().find(|e| e.value().0.name == agent && !e.value().0.revoked).and_then(|e| e.value().0.inbox_seen)).unwrap_or(0);
    let after = a.after.unwrap_or(seen);
    let r: Result<Result<Vec<JInboxItem>, String>, String> = Call::unbounded_wait(config().registry, "agent_inbox").with_args(&(agent.to_string(), after, 100u32)).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string()));
    match r {
        Ok(Ok(items)) => {
            let next = items.last().map_or(after, |i| i.id);
            if !a.peek.unwrap_or(false) && next > seen {
                AGENT_KEYS.with_borrow_mut(|m| {
                    if let Some((h, mut k)) = m.iter().find(|e| e.value().0.name == agent && !e.value().0.revoked).map(|e| (*e.key(), e.value().0)) {
                        k.inbox_seen = Some(next);
                        m.insert(h, C(k));
                    }
                });
            }
            json(200, serde_json::to_string(&serde_json::json!({ "items": items, "after": after, "next": next, "more": items.len() == 100 })).unwrap())
        }
        Ok(Err(e)) => err_json(NotebookError::Invalid(e)),
        Err(e) => err_json(NotebookError::Invalid(format!("registry: {e}"))),
    }
}

#[derive(Deserialize, Default)]
struct JPost { topic: Option<String>, title: String, body: String }
#[derive(CandidType, Deserialize, Serialize)]
struct JBoardPost { id: u64, topic: String, handle: String, title: String, created_at: u64 }
/// A board post for the space: the registry prices it, the space attaches the cycles.
async fn post_json(agent: &str, a: JPost) -> HttpResponse {
    if AGENT_CHAT.with_borrow(|c| *c.get()) != 1 {
        return err_json(NotebookError::Invalid("the owner switched agent chat off for this space (Manage → Agent)".into()));
    }
    let topic = a.topic.unwrap_or_else(|| "general".into());
    let reg = config().registry;
    let cost: u64 = match Call::unbounded_wait(reg, "post_cycles").with_arg((a.title.len() + a.body.len()) as u64).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string())) {
        Ok(c) => c,
        Err(e) => return err_json(NotebookError::Invalid(format!("registry: {e}"))),
    };
    if ic_cdk::api::canister_liquid_cycle_balance() < cost as u128 + PAY_FLOOR {
        return err_json(NotebookError::Invalid("this space is too low on cycles to post; fuel it".into()));
    }
    let r: Result<Result<JBoardPost, String>, String> = Call::unbounded_wait(reg, "agent_create_post").with_args(&(topic, a.title, a.body, agent.to_string())).with_cycles(cost as u128).await.map_err(|e| e.to_string()).and_then(|r| r.candid().map_err(|e| e.to_string()));
    match r {
        Ok(Ok(p)) => json(200, serde_json::to_string(&serde_json::json!({ "id": p.id, "topic": p.topic, "handle": p.handle, "title": p.title, "created_at": p.created_at, "cycles": cost })).unwrap()),
        Ok(Err(e)) => err_json(NotebookError::Invalid(e)),
        Err(e) => err_json(NotebookError::Invalid(format!("registry: {e}"))),
    }
}
/// Delete a note, or a folder with everything in it; how many files went.
fn delete_any(p: &str) -> Result<u32, NotebookError> {
    let path = check_path(p)?;
    if FOLDERS.with_borrow(|f| f.contains_key(&path)) {
        let prefix = format!("{path}/");
        let files: Vec<String> = FILES.with_borrow(|f| f.iter().map(|e| e.key().clone()).filter(|p| p.starts_with(&prefix)).collect());
        for p in &files {
            SHARES.with_borrow_mut(|m| m.remove(p));
            HISTORY.with_borrow_mut(|m| m.remove(p));
            FILES.with_borrow_mut(|f| f.remove(p));
        }
        let dirs: Vec<String> = FOLDERS.with_borrow(|f| f.iter().map(|e| e.key().clone()).filter(|p| *p == path || p.starts_with(&prefix)).collect());
        FOLDERS.with_borrow_mut(|f| dirs.iter().for_each(|p| { f.remove(p); }));
        return Ok(files.len() as u32);
    }
    SHARES.with_borrow_mut(|m| m.remove(&path));
    HISTORY.with_borrow_mut(|m| m.remove(&path));
    FILES.with_borrow_mut(|f| f.remove(&path)).map(|_| 1).ok_or(NotebookError::NotFound)
}

// ---- publishing a problem from a note of this space (problems.ts `parseProblem`, by the book)

#[derive(Deserialize, Default)]
struct JPublish { path: String, field: Option<String>, title: Option<String> }
#[derive(CandidType, Deserialize, Serialize)]
enum JPStatus { Open, Solved, Partial }
#[derive(CandidType, Deserialize, Serialize)]
struct JPublishInput { field: String, claims: u32, status: JPStatus, title: String, statement: String, path: String, depends: Vec<String>, notebook: Principal, note_hash: String }
/// Front matter `key: value` pairs, when the note starts with `---`.
fn front_matter(content: &str) -> (Vec<(String, String)>, &str) {
    let Some(rest) = content.strip_prefix("---\n") else { return (vec![], content) };
    let Some(end) = rest.find("\n---") else { return (vec![], content) };
    let pairs = rest[..end].lines().filter_map(|l| l.split_once(':').map(|(k, v)| (k.trim().to_lowercase(), v.trim().to_string()))).collect();
    let body = &rest[end + 4..];
    (pairs, body.strip_prefix('\n').unwrap_or(body))
}
/// The text under `## Name` up to the next `## ` heading.
fn section<'a>(body: &'a str, name: &str) -> &'a str {
    let mut at = 0;
    for line in body.split_inclusive('\n') {
        if line.trim_end().strip_prefix("## ").map_or(false, |h| h.trim().eq_ignore_ascii_case(name)) {
            let rest = &body[at + line.len()..];
            let end = rest.find("\n## ").unwrap_or(rest.len());
            return rest[..end].trim();
        }
        at += line.len();
    }
    ""
}
async fn publish_json(a: JPublish) -> HttpResponse {
    let path = match check_path(&a.path) { Ok(p) => p, Err(e) => return err_json(e) };
    let content = match FILES.with_borrow(|f| f.get(&path).map(|c| c.0.content)) { Some(c) => c, None => return err_json(NotebookError::NotFound) };
    let (fm, body) = front_matter(&content);
    let get = |k: &str| fm.iter().find(|(key, _)| key == k).map(|(_, v)| v.clone()).unwrap_or_default();
    let statement: String = section(body, "Statement").split_whitespace().collect::<Vec<_>>().join(" ").chars().take(2000).collect();
    if statement.is_empty() {
        return err_json(NotebookError::Invalid("write the statement under `## Statement` first".into()));
    }
    let claims = section(body, "Claims").lines().filter(|l| l.starts_with("### ")).count() as u32;
    let depends: Vec<String> = get("depends").split(',').map(|d| d.trim().trim_start_matches("[[").trim_end_matches("]]").trim().to_string()).filter(|d| !d.is_empty()).collect();
    let status = if get("status").eq_ignore_ascii_case("partial") { JPStatus::Partial } else { JPStatus::Open };
    let field = a.field.filter(|f| !f.trim().is_empty()).unwrap_or_else(|| { let f = get("field").to_lowercase(); if f.is_empty() { "open-problems".into() } else { f } });
    // the board reads the note, so it becomes public (view only); an existing share keeps its people
    let mut sh = SHARES.with_borrow(|m| m.get(&path).map(|s| s.0)).unwrap_or(Share { path: path.clone(), public: false, principals: vec![], editors: Some(vec![]), commenters: Some(vec![]), public_role: None, created_at: time() });
    sh.public = true;
    if sh.public_role.is_none() { sh.public_role = Some(Role::View); }
    SHARES.with_borrow_mut(|m| m.insert(path.clone(), C(sh)));
    let title = a.title.filter(|t| !t.trim().is_empty()).unwrap_or_else(|| title_of(&path).to_string());
    let input = JPublishInput { field, claims, status, title, statement, path: path.clone(), depends, notebook: canister_self(), note_hash: content_hash(&path).unwrap_or_default() };
    reg_json::<Result<JProblemView, String>>("publish_problem", &(input,)).await
}

// ---- problems over HTTP: the registry's answers, mirrored just enough to turn them into JSON

#[derive(Deserialize, Default)]
struct JProblems { field: Option<String>, status: Option<String> }
#[derive(Deserialize, Default)]
struct JProblem { problem: u64, since: Option<u64> }
#[derive(Deserialize, Default)]
struct JCheck { problem: u64, claim: u32, pass: bool, detail: Option<String> }
#[derive(Deserialize, Default)]
struct JComment { problem: u64, text: String, claim: Option<u32> }
#[derive(Deserialize, Default)]
struct JFollow { problem: u64, on: Option<bool> }
#[derive(Deserialize, Default)]
struct JAttempt { problem: u64, path: String, title: Option<String> }
#[derive(CandidType, Deserialize, Serialize, Clone, Copy, PartialEq)]
enum JStatus { Open, Partial, Solved }
#[derive(CandidType, Deserialize, Serialize)]
enum JAttemptStatus { Open, Merged, Declined }
#[derive(CandidType, Deserialize, Serialize)]
enum JEventKind { Published, Comment, Check, Attempt, Merged, Declined, Bounty, Status, Solved }
fn status_of(s: String) -> Option<JStatus> {
    match s.to_lowercase().as_str() { "open" => Some(JStatus::Open), "partial" => Some(JStatus::Partial), "solved" => Some(JStatus::Solved), _ => None }
}
#[derive(CandidType, Deserialize, Serialize)]
struct JProblemCard { id: u64, title: String, field: String, status: JStatus, claims: u32, checked: u32, attempts: u32, bounty_e8s: u64, updated: u64, discovery: Option<u64>, mine: bool, following: bool }
#[derive(CandidType, Deserialize, Serialize)]
struct JClaim { n: u32, checked: bool, passes: u32, fails: u32, stale: u32 }
#[derive(CandidType, Deserialize, Serialize)]
struct JAttemptView { id: u64, notebook: Principal, path: String, by: String, by_name: String, title: String, status: JAttemptStatus, at: u64 }
#[derive(CandidType, Deserialize, Serialize)]
struct JEvent { seq: u64, kind: JEventKind, by: String, by_name: String, claim: Option<u32>, text: String, at: u64 }
#[derive(CandidType, Deserialize, Serialize)]
struct JProblemView { card: JProblemCard, notebook: Principal, path: String, statement: String, depends: Vec<String>, note_hash: String, owner_name: String, created: u64, claim_views: Vec<JClaim>, attempt_views: Vec<JAttemptView>, events: Vec<JEvent>, followers: u32, credits: Vec<(String, String)>, payouts_pending: u32, solved_at: Option<u64> }
/// Call the registry and answer with the result as JSON; a `Result<_, String>` error is a 400.
async fn reg_json<T: CandidType + for<'a> Deserialize<'a> + Serialize>(method: &str, args: &impl candid::utils::ArgumentEncoder) -> HttpResponse {
    let r = match Call::unbounded_wait(config().registry, method).with_args(args).await {
        Ok(r) => r,
        Err(e) => return json(502, format!("{{\"error\":\"registry\",\"message\":{}}}", serde_json::to_string(&e.to_string()).unwrap())),
    };
    match r.candid::<T>() {
        Ok(v) => {
            let v = serde_json::to_value(&v).unwrap_or_default();
            // a candid Result arrives as {"Ok":..}/{"Err":..}: unwrap it
            match (v.get("Ok"), v.get("Err")) {
                (Some(ok), _) => json(200, ok.to_string()),
                (_, Some(err)) => json(400, format!("{{\"error\":\"invalid\",\"message\":{err}}}")),
                _ => json(200, v.to_string()),
            }
        }
        Err(e) => json(502, format!("{{\"error\":\"registry\",\"message\":{}}}", serde_json::to_string(&e.to_string()).unwrap())),
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths() {
        assert_eq!(check_path("/Daily/2026-10-10.md").unwrap(), "Daily/2026-10-10.md");
        assert_eq!(check_path("  Note.md ").unwrap(), "Note.md");
        for bad in ["", "a//b.md", "../x.md", "a/./b.md", "Note .md", "Note.", "a#b.md", "a^b.md", "a[b].md", "a|b.md", "a\\b.md", "a:b.md", "a\u{1}b.md"] {
            assert!(check_path(bad).is_err(), "{bad:?} should be rejected");
        }
        assert!(check_path(&"x".repeat(MAX_PATH + 1)).is_err());
    }

    #[test]
    fn attachments() {
        assert!(is_attachment("img/Photo.PNG"));
        assert!(is_attachment("a.pdf"));
        assert!(!is_attachment("Note.md"));
        assert!(!is_attachment("data.canvas"));
    }

    #[test]
    fn publishing() {
        let all = vec!["Ideas.md".to_string(), "Dir/Deep.md".to_string()];
        let (md, links) = preprocess_published("see [[Ideas|the ideas]], [[Dir/Deep#Top]], [[Nope]] ==hot== %%hidden%% end", &all);
        assert_eq!(md, "see [the ideas](/p/Ideas.md), [Dir/Deep](/p/Dir/Deep.md#Top), <span class=\"unresolved\">Nope</span> <mark>hot</mark>  end");
        assert_eq!(links, vec!["Ideas.md", "Dir/Deep.md"]);
        assert_eq!(strip_front_matter("---\na: 1\n---\nbody"), "body");
        assert_eq!(url_encode("Dir/A b.md"), "Dir/A%20b.md");
        let (html, _) = render_published("# T\n\n- [x] done\n\n| a | b |\n|---|---|\n| 1 | 2 |", &all);
        assert!(html.contains("<h1>T</h1>") && html.contains("checked") && html.contains("<table>"));
    }

    #[test]
    fn relinks() {
        let c = "See [[Old]], [[Old|alias]], [[Old#h2]], ![[Old]], [[Dir/Old]] and [[Older]] but not [[ [[Old]] ]].";
        let r = relink(c, "Dir/Old.md", "Dir/Sub/New.md").unwrap();
        assert_eq!(r, "See [[New]], [[New|alias]], [[New#h2]], ![[New]], [[Dir/Sub/New]] and [[Older]] but not [[ [[New]] ]].");
        assert_eq!(relink("[[Ideas]] and [[Ideas|i]]", "Ideas.md", "Projects/Big Ideas.md").unwrap(), "[[Big Ideas]] and [[Big Ideas|i]]");
        assert_eq!(relink("nothing here [[Other]] [[unterminated", "Old.md", "New.md"), None);
        assert_eq!(relink("[[Old]] then [[unterminated", "Old.md", "New.md").unwrap(), "[[New]] then [[unterminated");
        assert_eq!(base("a/b/c.md"), "c");
        assert_eq!(stem("a/b/c.md"), "a/b/c");
        assert_eq!(stem("img.png"), "img.png");
    }
}

// ---------------------------------------------------------------- answers from the LLM canister
// The browser picks the relevant notes (System 1, see frontend/src/chat.ts) and sends excerpts; the
// notebook asks the ICP LLM canister to answer from them with numbered citations. Owner only: paid
// models are charged to this notebook's cycles.

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct AskSource {
    pub path: String,
    pub excerpt: String,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct AskAnswer {
    pub text: String,
    /// the model that actually answered (a paid model falls back to the best free one)
    pub model: String,
    /// what this notebook paid for the answer: the model's cycles plus Lab's share
    pub cycles: u64,
}
#[derive(CandidType, Serialize)]
struct LlmRequest {
    model: String,
    messages: Vec<ic_llm::ChatMessage>,
    tools: Option<Vec<ic_llm::Tool>>,
}
const PAID_MODELS: &[&str] = &["z-ai:glm-5.2", "gemma3:27b"];
/// the strongest free model, used when a paid one cannot be afforded or fails
const FREE_FALLBACK: &str = "qwen3:32b";
/// paid models want at least this attached; unused cycles come back
const LLM_CYCLES: u128 = 100_000_000_000;
/// Lab's share of every answer, paid to the registry: a tenth of what a paid model cost, or this flat
/// 0.001 TC for a free one
const FREE_FEE: u128 = 1_000_000_000;
/// the LLM canister caps a request at 10 KiB across all messages
const PROMPT_BUDGET: usize = 9_600;
const ASK_SYSTEM: &str = "You are a helpful assistant answering questions with the user's notes. The notes are numbered like [1]. Use them first: after every sentence a note supports, cite it with its number in square brackets, for example [1] or [2][3], and only cite numbers that exist. If the notes do not cover the question, or only part of it, also answer from your own knowledge when you can, but put that part after a line that reads exactly 'Beyond your notes:' and cite no notes there. If you do not know, say so. Be concise and answer in Markdown.";

fn clip(s: &str, max: usize) -> String {
    if s.len() <= max { return s.to_string(); }
    let mut out: String = String::new();
    for ch in s.chars() { if out.len() + ch.len_utf8() > max { break; } out.push(ch); }
    out.push('…');
    out
}
/// Drop a reasoning model's `<think>…</think>` preamble.
fn strip_think(s: &str) -> String {
    match (s.find("<think>"), s.find("</think>")) {
        (Some(a), Some(b)) if b > a => format!("{}{}", &s[..a], &s[b + 8..]).trim().to_string(),
        _ => s.trim().to_string(),
    }
}
/// The prompt the model sees: numbered excerpts, cut to fit the canister's size limit.
fn ask_prompt(question: &str, sources: &[AskSource], model: &str) -> String {
    let tail = format!("Question: {question}{}", if model.starts_with("qwen3") { " /no_think" } else { "" });
    let mut room = PROMPT_BUDGET.saturating_sub(ASK_SYSTEM.len() + tail.len() + 16);
    let mut ctx = String::from(if sources.is_empty() { "Notes: none of the user's notes matched this question.\n\n" } else { "Notes:\n\n" });
    for (i, s) in sources.iter().enumerate() {
        let head = format!("[{}] {}\n", i + 1, s.path);
        if room < head.len() + 120 { break; }
        let body = clip(s.excerpt.trim(), room - head.len() - 2);
        let block = format!("{head}{body}\n\n");
        room = room.saturating_sub(block.len());
        ctx.push_str(&block);
    }
    format!("{ctx}{tail}")
}
/// Ask the model; the answer and what the call cost this notebook in cycles (0 for a free model).
async fn llm_chat(llm: Principal, model: &str, user: String) -> Result<(String, u128), String> {
    let paid = PAID_MODELS.contains(&model);
    if paid && canister_cycle_balance() < LLM_CYCLES * 4 {
        return Err("this notebook has too few cycles for a paid model".into());
    }
    let req = LlmRequest { model: model.to_string(), messages: vec![ic_llm::ChatMessage::System { content: ASK_SYSTEM.into() }, ic_llm::ChatMessage::User { content: user }], tools: None };
    let attached = if paid { LLM_CYCLES } else { 0 };
    let r = Call::bounded_wait(llm, "v1_chat").change_timeout(300).with_cycles(attached).with_arg(&req).await.map_err(|e| e.to_string())?;
    let spent = attached.saturating_sub(ic_cdk::api::msg_cycles_refunded());
    let resp: ic_llm::Response = r.candid().map_err(|e| e.to_string())?;
    let text = strip_think(&resp.message.content.unwrap_or_default());
    if text.is_empty() { Err("the model returned nothing".into()) } else { Ok((text, spent)) }
}
/// Lab's share of an answer goes to the registry (kept, not credited to anything).
async fn pay_ai_fee(fee: u128) {
    let _ = Call::bounded_wait(config().registry, "accept_ai_fee").with_cycles(fee).await;
}
#[update]
async fn ask(llm: Principal, model: String, question: String, sources: Vec<AskSource>) -> Result<AskAnswer, NotebookError> {
    // the owner, or an editor of the whole notebook with a free model (paid ones spend the owner's cycles)
    if owner().is_err() {
        if access("", msg_caller()) != Some(Role::Edit) { return Err(NotebookError::Unauthorized); }
        if PAID_MODELS.contains(&model.trim()) { return Err(NotebookError::Invalid("only the owner may use a paid model".into())); }
    }
    let question = question.trim().to_string();
    if question.is_empty() || question.chars().count() > 1_000 {
        return Err(NotebookError::Invalid("question: 1-1000 characters".into()));
    }
    if sources.len() > 10 {
        return Err(NotebookError::Invalid("at most 10 notes per question".into()));
    }
    // every answer costs something: the flat share for a free model must be affordable before asking
    if ic_cdk::api::canister_liquid_cycle_balance() < FREE_FEE + PAY_FLOOR {
        return Err(NotebookError::Invalid("this notebook is too low on cycles to ask; top it up".into()));
    }
    let mut last = String::new();
    let mut tried: Vec<String> = vec![];
    for m in [model.trim().to_string(), FREE_FALLBACK.to_string()] {
        if m.is_empty() || tried.contains(&m) { continue; }
        tried.push(m.clone());
        match llm_chat(llm, &m, ask_prompt(&question, &sources, &m)).await {
            Ok((text, spent)) => {
                // Lab's share: a tenth of a paid model's cost, or the flat fee for a free one
                let fee = if spent > 0 { spent / 10 } else { FREE_FEE };
                pay_ai_fee(fee).await;
                return Ok(AskAnswer { text, model: m, cycles: (spent + fee) as u64 });
            }
            Err(e) => last = format!("{m}: {e}"),
        }
    }
    Err(NotebookError::Invalid(format!("the language model did not answer ({last})")))
}

ic_cdk::export_candid!();

#[cfg(test)]
mod ask_tests {
    use super::*;
    #[test]
    fn prompt_fits_the_llm_canister_limit_and_numbers_sources() {
        let big = "word ".repeat(5_000);
        let sources: Vec<AskSource> = (0..8).map(|i| AskSource { path: format!("n{i}.md"), excerpt: big.clone() }).collect();
        let p = ask_prompt("what is it?", &sources, "qwen3:32b");
        assert!(p.len() + ASK_SYSTEM.len() <= 10 * 1024, "{}", p.len());
        assert!(p.starts_with("Notes:\n\n[1] n0.md\n") && p.ends_with("what is it? /no_think"));
        assert_eq!(strip_think("<think>hmm</think>\nAnswer [1]"), "Answer [1]");
        assert_eq!(clip("héllo", 3), "hé…");
    }
}

#[cfg(test)]
mod fetch_tests {
    use super::resolve_location;
    #[test]
    fn redirects_resolve_against_the_current_address() {
        assert_eq!(resolve_location("https://a.org/papers/x.pdf", "https://cdn.b.net/x.pdf"), "https://cdn.b.net/x.pdf");
        assert_eq!(resolve_location("https://a.org/papers/x.pdf", "/files/x.pdf"), "https://a.org/files/x.pdf");
        assert_eq!(resolve_location("https://a.org/papers/x.pdf", "y.pdf"), "https://a.org/papers/y.pdf");
        assert_eq!(resolve_location("https://a.org", "/y.pdf"), "https://a.org/y.pdf");
    }
}
