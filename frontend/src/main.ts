import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./style.css";
import { AuthClient } from "@icp-sdk/auth/client";
import { checkHunt, huntRound, tapPassed, TAP_GOAL, TAP_MS, type Hunt } from "./agentspace.ts";
import { qrSvg } from "./qr.ts";
import { Actor, HttpAgent, type Identity } from "@icp-sdk/core/agent";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import { IDL } from "@icp-sdk/core/candid";
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";
import { createActor as registryActor, type Rain, type Channel, type Member, type Message, type Post, type PostComment, type Flag, type Watch, type Online, type Attestation, type ListingView, type Token, type Health, type Bug, type BugStatus, type Registry, type Town, type SponsorView, type Notebook as NotebookRec, type AppStats, type ProblemCard, type ProblemView, type EventView, type DiscoveryView, type TrackRecord, ProblemStatus, EventKind, AttemptStatus } from "./bindings/registry";
import { createActor as notebookActor, type AttestationView, type Attempt, Role, type DepositState, type AgentKey, type Comment, type Info, type Note, type Revision, type Share, type TopUp, type Notebook as NotebookApi, type NotebookError } from "./bindings/notebook";
import type { SnapshotInfo, InboxItem } from "./bindings/registry";
import { PROMPTS } from "./prompts.ts";
import { FIELDS, fieldLabel, isProblemNote, mergeAttempt, noteHash, parseProblem, problemTemplate } from "./problems.ts";
import { Principal } from "@icp-sdk/core/principal";
import { continueList, indentLines, toggleTask } from "./editor";
import { canvasSvg, mountCanvasPanZoom } from "./canvasview";
import { createEditor, type Editor } from "./cm";
import { diffLines } from "./diff";
import { NEW_DRAWING, isExcalidraw, mountEditor, toSvg, unmountEditors } from "./excalidraw";
import { dailyPath, fillTemplate } from "./templates";
import { ForceGraph } from "./graph";
import { CITE, answer, cited, decide, excerpt, type Pick } from "./chat";
import { NEW_BOARD, isKanban, moveCard, parseBoard, serializeBoard, type Board } from "./kanban";
import { NEW_CARDS, NEW_CHOICE, graded, parseCards, parseChoice, quizKind, shuffled } from "./quiz";
import { countByDay, dayKey, gridWeeks, level, streak } from "./activity";
import { examples } from "./examples";
import { minDepositE8s } from "./pricing";
import { APPLICATIONS_BOARD, EXPERIENCE_TEMPLATE, PERSON_TEMPLATE, RESUME_TEMPLATE, STAGES, STORIES_DECK, addApplication, addDays, applicationCard, applications, compileResume, contacts, experience, isExperience, markContacted, parseStar, searchStats, storyCard, updateApplication, waiting } from "./career";
import { MONEY_TEMPLATES, NET_WORTH_NOTE, SUBSCRIPTION_TEMPLATE, budgetTotals, byLabel, budgetWorkbook, cancelSubscription, holdings, netWorth, netWorthHistory, recordNetWorth, renewSubscription, subscriptionTotals, subscriptions } from "./money";
import { CALENDAR_BOARD, LANES, LIMIT, POST_TEMPLATE, calendar, logResults, placeCard, post, posts, results } from "./creator";
import { WORKOUT_TEMPLATE, newRecords, pace, progress, records, weekly, workouts } from "./fitness";
import { ITEM_TEMPLATE, UPKEEP_TEMPLATE, doneUpkeep, inventory, items, upkeep, warrantiesEnding } from "./home";
import { attachSky, paintBand, skyPulse } from "./sky";
import { DEFAULT_WATCH, MAX_WATCH, THESIS_TEMPLATE, TRADE_TEMPLATE, closeTrade, isOpen, isThesis, isTrade, journalStats, pnl, reviewThesis, rMultiple, symbolOf, theses, thesisCardSummary, trade, tradePath, usd, watchSymbols, type Side, type Trade } from "./crypto";
import { cardKey, isDue, review as srsReview, type Rating, type Sched } from "./srs";
import { align, isLeanNote, leanCode, parseLean, statementCard, unmentionedHyps } from "./lean";
import { NEW_IPYNB, addCell as nbAddCell, isNotebookPath, moveCell as nbMoveCell, parseNotebook, serializeNotebook, type Cell as NbCell, type Notebook as Nb, type Output as NbOutput } from "./ipynb";
import { pythonLoaded, restartPython, runPython } from "./pyodide";
import { isSlides, splitSlides, SLIDES_TEMPLATE } from "./slides";
import { QUERY_METHODS } from "./queries";
import { ADR_STATUSES, CITE_KEY, RUNBOOK_TEMPLATE, adrTemplate, careQuestions, careSummary, careWorkbook, changelog, citeIn, citedKeys, claims, compileThesis, continuity, fromCrossref, manuscript, nextAdr, parseBibtex, sourceFromNote, sourceNote, timeline, type Source, type Style } from "./kits";
import { applyRule, isFaded, keepLater, lint, ms as nsToMs, nextToResurface, periodPath, periodRollup, propertyColumns, renameProperty, renameTag, retarget as retargetLinks, runQuery, setProperty, splitAtHeadings, type Issue, type OrgNote, type Period, type PropColumn, type Resurface, type Rule, unlink } from "./organize";
import { DECKS, GEAR_BASE_REF, localStamp, REVIEW_TEMPLATE, TRIP_TEMPLATE, applyReviewToGear, baseWeight, fieldEntry, foodWorkbook, gearWorkbook, isGearWorkbook, parseGpx, routeNote, trackBlock, waterWorkbook } from "./outdoor";
import { NEW_WORKBOOK, PALETTES, addChart, chartSvg, colName, evaluate, fmt, isSheetPath, newSheet, parseCsv, parseRef, parseWorkbook, serializeWorkbook, sheetCsv, toCsv, type Chart, type ChartType, type Value, type Workbook } from "./sheet";
import DOMPurify from "dompurify";
import { MEETING_TEMPLATE, actionCards, decisions, isMeeting, isOverdue, markdownToDocx, meetingSummary, parseIcs, parseMeeting, parseTasks, people, addPeriod, reminders, setCell, sortTable, sortTasks, toggleTaskLine, tsvToTable, weeklyReview } from "./work";
import { ankiTsv, cardsFromNote, cite, explain, glossary, goalProgress, questionsFor, sources, summarise } from "./study";
import { isAttachment, renderDiagrams, renderMarkdown } from "./markdown";
import { section, backlinkContext, base, buildIndex, dir, frontmatter, fuzzy, graphData, headings, resolve, search, setFrontmatter, stem, tree, untitled, type Folder, type Index } from "./notes";
import { unzip } from "./unzip";
import { approveWithOisy, principalSubaccount, transferWithOisy } from "./oisy";
import { registerSW } from "virtual:pwa-register";
import { THEMES, applyTheme, loadThemeState, saveThemeState, type ThemeState } from "./themes";
import { zip } from "./zip";
import { addLink, addTag, suggest, type Suggestion } from "./garden";
import type { Usage as NbUsage } from "./bindings/notebook";
import { DISTRICTS, attachTown, season, townCamera, townFly, townSpotlight, type OpenHouseInfo, type Target as TownTarget, type TownData } from "./town";

// ---------- the cycles minting canister: today's ICP price in cycles ----------

const CMC_ID = "rkp4c-7iaaa-aaaaa-aaaca-cai";
const cmcIdl: IDL.InterfaceFactory = ({ IDL: I }) => I.Service({ get_icp_xdr_conversion_rate: I.Func([], [I.Record({ data: I.Record({ xdr_permyriad_per_icp: I.Nat64, timestamp_seconds: I.Nat64 }), hash_tree: I.Vec(I.Nat8), certificate: I.Vec(I.Nat8) })], ["query"]) });
/** 10,000ths of an XDR one ICP buys (1 XDR = 1 TC), or undefined when the CMC cannot be reached. */
async function icpXdrRate(): Promise<bigint | undefined> {
  try {
    const agent = HttpAgent.createSync({ identity: S.identity, rootKey: env.IC_ROOT_KEY });
    const cmc = Actor.createActor<{ get_icp_xdr_conversion_rate: () => Promise<{ data: { xdr_permyriad_per_icp: bigint } }> }>(cmcIdl, { agent, canisterId: CMC_ID });
    return (await cmc.get_icp_xdr_conversion_rate()).data.xdr_permyriad_per_icp;
  } catch { return undefined; }
}

// ---------- ledger (just enough for a signed-in top-up) ----------

const ICP_LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const ICP_FEE = 10_000n;
const AccountIdl = IDL.Record({ owner: IDL.Principal, subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)) });
const ledgerIdl: IDL.InterfaceFactory = ({ IDL: I }) =>
  I.Service({
    icrc2_approve: I.Func(
      [I.Record({ fee: I.Opt(I.Nat), memo: I.Opt(I.Vec(I.Nat8)), from_subaccount: I.Opt(I.Vec(I.Nat8)), created_at_time: I.Opt(I.Nat64), amount: I.Nat, expected_allowance: I.Opt(I.Nat), expires_at: I.Opt(I.Nat64), spender: AccountIdl })],
      [I.Variant({ Ok: I.Nat, Err: I.Reserved })],
      [],
    ),
    icrc1_balance_of: I.Func([AccountIdl], [I.Nat], ["query"]),
  });
type Ledger = { icrc2_approve: (a: Record<string, unknown>) => Promise<{ Ok: bigint } | { Err: unknown }>; icrc1_balance_of: (a: { owner: Principal; subaccount: [] }) => Promise<bigint> };
async function icpBalance(): Promise<bigint> {
  const agent = HttpAgent.createSync({ identity: S.identity, rootKey: env.IC_ROOT_KEY });
  const ledger = Actor.createActor<Ledger>(ledgerIdl, { agent, canisterId: ICP_LEDGER });
  return ledger.icrc1_balance_of({ owner: S.identity!.getPrincipal(), subaccount: [] });
}

// ---------- environment ----------

type Env = { "PUBLIC_CANISTER_ID:registry"?: string; "PUBLIC_CANISTER_ID:llm"?: string; "PUBLIC_CANISTER_ID:xrc"?: string; IC_ROOT_KEY?: Uint8Array };
const env: Env = (safeGetCanisterEnv() as Env | undefined) ?? {};
const REGISTRY = env["PUBLIC_CANISTER_ID:registry"] ?? "";
const isLocal = /(^|\.)localhost$|^127\.0\.0\.1$/.test(location.hostname);
const port = location.port || "80";
// Locally, sign-in uses a browser-held dev key unless ?ii is in the URL (local II needs a passkey).
const devMode = isLocal && !new URLSearchParams(location.search).has("ii");
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
// Payments go through the user's OISY wallet. OISY lives on mainnet, so on the local network the
// browser-held dev identity pays from the local ledger instead (add ?oisy to force OISY locally).
const useOisy = !isLocal || new URLSearchParams(location.search).has("oisy");
/// A notebook canister's own origin on the gateway: where agents POST and public notes are served.
const apiUrl = (canister: string) => (isLocal ? `http://${canister}.localhost:${port}` : `https://${canister}.icp0.io`);
const AGENT_ROOT = "Agents";
const isAgentPath = (p: string) => p === AGENT_ROOT || p.startsWith(`${AGENT_ROOT}/`);
const MOD = isMac ? "⌘" : "Ctrl";
const mobileQuery = matchMedia("(max-width: 760px)");

/** Internet Identity derives a different principal per origin, and the app answers on both <id>.icp.net and
 * <id>.icp0.io. Every origin signs in as the icp.net one, which public/.well-known/ii-alternative-origins
 * (served as JSON by public/_headers) lets II accept from the others. Nothing on the local network. */
// ponytail: the canister id comes from the hostname; a custom domain needs this and the alternative-origins file updated
const auth = new AuthClient(
  isLocal
    ? { identityProvider: { authorizeUrl: `http://id.ai.localhost:${port}/authorize`, canisterId: "rdmx6-jaaaa-aaaaa-aaadq-cai" }, agentOptions: { rootKey: env.IC_ROOT_KEY } }
    : { derivationOrigin: `https://${location.hostname.split(".")[0]}.icp.net` },
);

function store(k: string, v?: string | null): string | null {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage blocked */
  }
  return null;
}

const DEV_KEY = "nb-dev-identity";
const DEV_ON = "nb-dev-signed-in";
let devId: Ed25519KeyIdentity | undefined;
function devIdentity(create: boolean): Ed25519KeyIdentity | undefined {
  if (!devId) {
    // keep the dev key from the earlier "vaults-" build so local notebooks stay reachable
    const raw = store(DEV_KEY) ?? store("vaults-dev-identity");
    if (raw && (create || store(DEV_ON) === "1" || store("vaults-dev-signed-in") === "1")) devId = Ed25519KeyIdentity.fromJSON(raw);
    else if (create) devId = Ed25519KeyIdentity.generate();
    if (devId && create) {
      store(DEV_KEY, JSON.stringify(devId.toJSON()));
      store(DEV_ON, "1");
    }
  }
  return devId;
}
async function currentIdentity(): Promise<Identity | undefined> {
  if (devMode) return devIdentity(false);
  return auth.isAuthenticated() ? auth.getIdentity() : undefined;
}

// --- "working" indicator: every canister update call shows a progress bar and a label while it runs
// (updates take a couple of seconds on mainnet); queries stay silent unless they drag on past a second.
const BUSY_LABELS: Record<string, string> = { delete_notebook: "Deleting the space…", ask: "Asking the language model…", join_community: "Joining the community…", post: "Posting…", post_newcomer: "Posting…", sponsor_newcomer: "Spawning starter space…", set_open_house: "Updating your porch…", wave_house: "Waving 👋…", edit_message: "Saving your edit…", create_post: "Posting…", comment_post: "Posting your comment…", vote_post: "Voting…", vote_comment: "Voting…", react: "Reacting…", vote: "Voting…", post_poll: "Posting the poll…", post_gist: "Sharing the note…", post_fund: "Starting the fundraiser…", post_plan_fund: "Starting the fundraiser…", donate: "Sending ICP…", rain: "Making it rain…", link_github: "Asking GitHub…", share_post: "Sharing…", pin_message: "Pinning…", delete_message: "Deleting…", delete_post: "Deleting…", create_notebook: "Spawning your space (about a minute)…", set_key_spend: "Updating the key…", set_agent_chat: "Updating the switch…", fuel_from_wallet: "Converting ICP to cycles…", btc_address: "Deriving the Bitcoin address…", eth_address: "Deriving the Ethereum address…", create_notebook_paid_by: "Spawning your space (about a minute)…", top_up_notebook: "Converting ICP to cycles…", pay: "Paying…", write: "Saving…", rename: "Renaming…", delete: "Deleting…", set_share: "Updating sharing…", report_bug: "Sending…", report_idea: "Sending…", buy: "Buying…", list_notebook: "Listing…", upgrade_all: "Upgrading spaces…", restore: "Restoring…", comment: "Posting your comment…", reply: "Posting your reply…" };
const busyCalls = new Map<number, string>();
let busySeq = 0;
function busyRender() {
  let el = document.getElementById("busy");
  const labels = [...busyCalls.values()];
  if (!labels.length) { el?.remove(); return; }
  if (!el) { el = Object.assign(document.createElement("div"), { id: "busy" }); el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.append(el); }
  el.innerHTML = `<div class="busy-bar"></div><div class="busy-pill"><span class="spin"></span>${esc(labels[labels.length - 1])}</div>`;
}
/** Background polls (rain, mentions, trips, the town, health): never shown as "Loading…". */
const QUIET_METHODS = new Set(["my_rain", "my_mentions", "my_inbox", "agent_keys", "all_comments", "my_watches", "watching", "town", "notebook_status"]);
function trackCall<T>(method: string, p: Promise<T>): Promise<T> {
  if (QUIET_METHODS.has(method)) return p;
  const id = ++busySeq;
  const label = BUSY_LABELS[method] ?? (QUERY_METHODS.has(method) ? "Loading…" : "Working…");
  const delay = QUERY_METHODS.has(method) ? 1200 : 120;
  const t = window.setTimeout(() => { busyCalls.set(id, label); busyRender(); }, delay);
  return p.finally(() => { clearTimeout(t); if (busyCalls.delete(id)) busyRender(); });
}
function tracked<T extends object>(actor: T): T {
  return new Proxy(actor, { get(target, key) { const v = Reflect.get(target, key); if (typeof v !== "function" || typeof key !== "string") return v; return (...args: unknown[]) => { const r = (v as (...a: unknown[]) => unknown).apply(target, args); return r instanceof Promise ? trackCall(key, r) : r; }; } });
}
/** A feature flag from the registry; unknown or not yet loaded flags count as on, except the market. */
/** Off until the registry says otherwise: the market ships switched off. */
const OFF_BY_DEFAULT = ["market", "problems", "chat"];
const flag = (name: string): boolean => { const f = S.flags.find((x) => x.name === name); return f ? f.on : !OFF_BY_DEFAULT.includes(name); };

// --- Browser Sandbox Notebook ("local-sandbox"): full zero-ICP browser workspace, mintable to an on-chain canister any time
const SANDBOX_ID = "local-sandbox";
const isSandbox = () => S.notebook?.canister.toText() === SANDBOX_ID;
const sandboxRecord = (): NotebookRec => ({
  canister: { toText: () => SANDBOX_ID } as unknown as Principal,
  owner: Principal.anonymous(),
  name: "Browser Sandbox",
  description: "Free local workspace in this browser — mint to an on-chain canister any time",
  emoji: "🧪",
  created_at: BigInt(Date.now()) * 1_000_000n,
});
function sandboxDefaultNotes(): Note[] {
  const today = new Date().toISOString().slice(0, 10);
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  const ex = examples(new Set(["chat", "study", "work", "organize", "research", "crypto", "money"]), today);
  const baseNotes: [string, string, string?][] = [
    ["index.md", `---\ntags: [sandbox, welcome]\n---\n# Welcome to your Browser Sandbox 🧪\n\nYou are trying **Agent Space** right in your browser — no ICP or wallet needed to explore. Everything here works immediately and saves locally on this device:\n\n- **Obsidian-grade Markdown & Knowledge Graph**: Open [[Examples/Writing notes]] or click the **Graph** icon on the left.\n- **Autonomous AI Agents**: Inspect [[Agents/Morning Brief]] — on-chain canisters can issue scoped \`nb_...\` keys so AI agents write directly to \`Agents/\` over HTTPS.\n- **Python, Spreadsheets & Live Dashboards**: Run [[Examples/Python.ipynb]] in-browser, edit [[Examples/Budget.sheet]], or view [[Examples/Dashboard.dash]].\n- **Spaced Repetition & Quizzes**: Practice [[Examples/Study/Flashcards]] or take [[Examples/Study/Quiz]].\n- **Crypto & Research Kits**: Check live XRC prices and theses in **Crypto**, or verify citations in **Research**.\n\n> [!tip] Ready to own this on-chain?\n> Click **Mint to on-chain canister** in the top banner any time to spin up your own sovereign Internet Computer canister and copy every note in this sandbox into it.\n`],
    ["Agents/Morning Brief.md", `---\ntags: [agent, brief]\n---\n# Morning Research & Market Brief\n\nWritten autonomously to \`/api/notes/Agents/Morning%20Brief.md\` using a scoped agent bearer key.\n\n- **Knowledge Graph**: Linked to [[Examples/Writing notes]] and [[Crypto/Theses/BTC holds up better than the rest]].\n- **Action items**:\n  - [ ] Review [[Examples/Study/Flashcards]] due today\n  - [ ] Check live XRC price move on BTC thesis\n`, "research-bot"],
    ...ex.map(([p, c]): [string, string] => [p, c]),
  ];
  return baseNotes.map(([path, content, agent]) => ({ path, content, created: nowNs, modified: nowNs, ...(agent ? { agent } : {}) }));
}
function sandboxLoadNotes(): Note[] {
  const raw = store("nb-sandbox-notes");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { path: string; content: string; created: string; modified: string; agent?: string }[];
      if (Array.isArray(parsed) && parsed.length) return parsed.map((n) => ({ path: n.path, content: n.content, created: BigInt(n.created || "0"), modified: BigInt(n.modified || "0"), ...(n.agent ? { agent: n.agent } : {}) }));
    } catch { /* fall through to default */ }
  }
  const init = sandboxDefaultNotes();
  sandboxSaveNotes(init);
  return init;
}
function sandboxSaveNotes(notes: Note[]) {
  store("nb-sandbox-notes", JSON.stringify(notes.map((n) => ({ path: n.path, content: n.content, created: n.created.toString(), modified: n.modified.toString(), ...(n.agent ? { agent: n.agent } : {}) }))));
}
function sandboxLoadFolders(): string[] {
  const notes = sandboxLoadNotes();
  const fromNotes = new Set<string>(JSON.parse(store("nb-sandbox-folders") ?? "[]") as string[]);
  for (const n of notes) {
    const parts = n.path.split("/");
    for (let i = 1; i < parts.length; i++) fromNotes.add(parts.slice(0, i).join("/"));
  }
  return [...fromNotes].sort();
}
function sandboxSettingsRaw(): string {
  const raw = store("nb-sandbox-settings");
  if (raw) return raw;
  const dflt = JSON.stringify({ onboarded: true, features: { chat: true, graph: true, study: true, work: true, organize: true, research: true, crypto: true, money: true } });
  store("nb-sandbox-settings", dflt);
  return dflt;
}
function sandboxNotebookApi(): NotebookApi {
  const nowNs = () => BigInt(Date.now()) * 1_000_000n;
  const api: Partial<NotebookApi> = {
    read_page: async (after) => ({ __kind__: "Ok", Ok: { notes: after ? [] : sandboxLoadNotes(), next: undefined } }),
    read: async (p) => { const n = sandboxLoadNotes().find((x) => x.path === p); return n ? { __kind__: "Ok", Ok: n } : { __kind__: "Err", Err: { __kind__: "NotFound", NotFound: null } }; },
    list: async () => ({ __kind__: "Ok", Ok: sandboxLoadNotes().map((n) => ({ path: n.path, size: BigInt(n.content.length), created: n.created, modified: n.modified, agent: n.agent })) }),
    folders: async () => ({ __kind__: "Ok", Ok: sandboxLoadFolders() }),
    info: async () => { const ns = sandboxLoadNotes(); return { cycles: 3_000_000_000_000n, files: BigInt(ns.length), bytes: BigInt(ns.reduce((a, x) => a + x.content.length, 0)), total_topped_up_e8s: 0n, total_cycles_from_topups: 0n, owner: Principal.anonymous(), name: "Browser Sandbox", created_at: BigInt(Date.now()) * 1_000_000n, topup_account_id: "", registry: Principal.anonymous(), pending_topups: 0n }; },
    topups: async () => [],
    agent_keys: async () => ({ __kind__: "Ok", Ok: [] }),
    shares: async () => ({ __kind__: "Ok", Ok: [] }),
    get_settings: async () => ({ __kind__: "Ok", Ok: sandboxSettingsRaw() }),
    set_settings: async (j) => { store("nb-sandbox-settings", j); return { __kind__: "Ok", Ok: null }; },
    all_comments: async () => ({ __kind__: "Ok", Ok: [] }),
    published: async () => null,
    usage: async () => { const ns = sandboxLoadNotes(); return { files: BigInt(ns.length), notes: BigInt(ns.filter((n) => n.path.endsWith(".md")).length), links: BigInt(ns.reduce((a, n) => a + (n.content.match(/\[\[/g)?.length ?? 0), 0)), streak: 1, active_days: 1, agent_active: false, last_modified: ns.reduce((a, n) => (n.modified > a ? n.modified : a), 0n) }; },
    history: async () => ({ __kind__: "Ok", Ok: [] }),
    write: async (path, content) => {
      const ns = sandboxLoadNotes();
      const t = nowNs();
      const ex = ns.find((x) => x.path === path);
      if (ex) { ex.content = content; ex.modified = t; }
      else ns.push({ path, content, created: t, modified: t });
      sandboxSaveNotes(ns);
      return { __kind__: "Ok", Ok: { path, size: BigInt(content.length), created: ex?.created ?? t, modified: t } };
    },
    write_many: async (items, overwrite) => {
      const ns = sandboxLoadNotes();
      const t = nowNs();
      let written = 0;
      const failed: [string, string][] = [];
      for (const [path, content] of items) {
        const ex = ns.find((x) => x.path === path);
        if (ex && !overwrite) { failed.push([path, "exists"]); continue; }
        if (ex) { ex.content = content; ex.modified = t; }
        else ns.push({ path, content, created: t, modified: t });
        written++;
      }
      sandboxSaveNotes(ns);
      return { __kind__: "Ok", Ok: { written, failed } };
    },
    delete_: async (path) => {
      sandboxSaveNotes(sandboxLoadNotes().filter((x) => x.path !== path));
      return { __kind__: "Ok", Ok: null };
    },
    mkdir: async (path) => {
      const clean = path.replace(/^\/+|\/+$/g, "");
      const fs = new Set(sandboxLoadFolders());
      fs.add(clean);
      store("nb-sandbox-folders", JSON.stringify([...fs]));
      return { __kind__: "Ok", Ok: clean };
    },
    rename: async (from, to): Promise<Awaited<ReturnType<NotebookApi["rename"]>>> => {
      const ns = sandboxLoadNotes();
      const ex = ns.find((x) => x.path === from);
      if (!ex) return { __kind__: "Err", Err: { __kind__: "NotFound", NotFound: null } };
      ex.path = to;
      ex.modified = nowNs();
      sandboxSaveNotes(ns);
      return { __kind__: "Ok", Ok: { file: { path: to, size: BigInt(ex.content.length), created: ex.created, modified: ex.modified }, relinked: [] } };
    },
    rename_folder: async (from, to) => {
      const ns = sandboxLoadNotes();
      let moved = 0;
      for (const n of ns) if (n.path.startsWith(`${from}/`)) { n.path = `${to}${n.path.slice(from.length)}`; moved++; }
      sandboxSaveNotes(ns);
      return { __kind__: "Ok", Ok: { moved, relinked: [] } };
    },
    delete_folder: async (path) => {
      const ns = sandboxLoadNotes();
      const keep = ns.filter((n) => !n.path.startsWith(`${path}/`));
      const gone = ns.length - keep.length;
      sandboxSaveNotes(keep);
      store("nb-sandbox-folders", JSON.stringify(sandboxLoadFolders().filter((f) => f !== path && !f.startsWith(`${path}/`))));
      return { __kind__: "Ok", Ok: gone };
    },
  };
  return new Proxy(api as NotebookApi, {
    get(target, key) {
      if (key in target) return Reflect.get(target, key);
      return async () => ({ __kind__: "Err", Err: { __kind__: "Invalid", Invalid: "Mint this browser sandbox to an on-chain canister first to use this feature" } });
    },
  });
}

const registry = (): Registry => tracked(registryActor(REGISTRY, { agentOptions: { identity: S.identity, rootKey: env.IC_ROOT_KEY } }));
const notebookOf = (id: string): NotebookApi => (id === SANDBOX_ID ? sandboxNotebookApi() : tracked(notebookActor(id, { agentOptions: { identity: S.identity, rootKey: env.IC_ROOT_KEY } })));
const nb = (): NotebookApi => notebookOf(isSandbox() ? SANDBOX_ID : S.notebook!.canister.toText());

// ---------- state ----------

type Tab = "notes" | "chat" | "graph" | "manage" | "study" | "work" | "organize" | "trips" | "research" | "writing" | "care" | "software" | "career" | "crypto" | "money" | "creator" | "fitness" | "home";
type Settings = { bookmarks: string[]; srs: Record<string, Record<string, Sched>>; deckStats: Record<string, { reviews: number; good: number }>; study: Record<string, number>; goals: { notesPerWeek?: number; cardsPerDay?: number }; searches: { name: string; q: string }[]; rules: Rule[]; resurface: Resurface; decayDays: number; hideFaded: boolean; kanbanArchiveDays: number; features: Partial<Record<Tab, boolean>>; onboarded?: boolean; writingGoal: number; citeStyle: Style; gardenHidden: string[] };
const parseSettings = (j: Partial<Settings> | undefined): Settings => ({ bookmarks: Array.isArray(j?.bookmarks) ? j!.bookmarks : [], srs: j?.srs ?? {}, deckStats: j?.deckStats ?? {}, study: j?.study ?? {}, goals: j?.goals ?? {}, searches: Array.isArray(j?.searches) ? j!.searches : [], rules: Array.isArray(j?.rules) ? j!.rules : [], resurface: j?.resurface ?? {}, decayDays: typeof j?.decayDays === "number" ? j.decayDays : 180, hideFaded: !!j?.hideFaded, kanbanArchiveDays: typeof j?.kanbanArchiveDays === "number" ? j.kanbanArchiveDays : 14, features: j?.features ?? {}, onboarded: j?.onboarded, writingGoal: typeof j?.writingGoal === "number" ? j.writingGoal : 500, citeStyle: j?.citeStyle === "chicago" ? "chicago" : "apa", gardenHidden: Array.isArray(j?.gardenHidden) ? j!.gardenHidden : [] });
type ManageTab = "wallet" | "fuel" | "agent" | "prompts" | "data";
const MANAGE_TABS: [ManageTab, string, string][] = [["wallet", "Wallet", "wallet"], ["fuel", "Fuel", "bolt"], ["agent", "Agent", "bot"], ["prompts", "Prompts", "chat"], ["data", "Data", "download"]];
type View = "edit" | "split" | "preview";
type MobilePane = "files" | "note" | "links";
/** A pane holds tabs (note paths); several panes sit side by side. */
type Pane = { id: number; tabs: string[]; active?: string; view: View; study?: boolean };
type Draft = { text: string; dirty: boolean; saving: boolean };
type ChatMsg = { role: "you" | "notes"; text: string; picks?: Pick[]; model?: string; fallback?: string; deck?: boolean; insertInto?: string; cycles?: bigint };
/** The ICP LLM canister; locally the stand-in in canisters/llm-dev that answers with Ollama. */
const LLM_CANISTER = env["PUBLIC_CANISTER_ID:llm"] ?? "w36hm-eqaaa-aaaal-qr76a-cai";
const LLM_LOCAL = !!env["PUBLIC_CANISTER_ID:llm"];
/** ICP's exchange rate canister, for the Crypto kit's prices; locally the stand-in in canisters/xrc-dev. */
const XRC_CANISTER = env["PUBLIC_CANISTER_ID:xrc"] ?? "uf6dk-hyaaa-aaaaq-qaaaq-cai";
/** The chat model: the strongest free model on the LLM canister, so questions never spend the notebook's cycles. */
const LLM_MODEL = "qwen3:32b";
const LLM_MODEL_NAME = "Qwen3 32B";
/** The models on the Internet Computer's LLM canister that the notebook canister will ask, by tier.
 *  Every answer is paid for by the notebook: what the model cost plus a tenth for Agent Space (paid models have 0.1 TC
 *  attached, what is unused comes back), or a flat 0.001 TC for a free model. */
const MODELS = [
  { id: "z-ai:glm-5.2", name: "GLM 5.2", tier: "Premium", paid: true, note: "The strongest answers. What the model costs plus a tenth for Agent Space: about 0.11 TC of this space's cycles a question." },
  { id: "gemma3:27b", name: "Gemma 3 27B", tier: "Plus", paid: true, note: "Strong and quick. What the model costs plus a tenth for Agent Space: about 0.11 TC of this space's cycles a question." },
  { id: "qwen3:32b", name: "Qwen3 32B", tier: "Everyday", paid: false, note: "The strongest of the free models. 0.001 TC of this space's cycles a question, Agent Space's share." },
  { id: "llama3.1:8b", name: "Llama 3.1 8B", tier: "Low", paid: false, note: "Small and fast, for quick lookups. 0.001 TC of this space's cycles a question, Agent Space's share." },
] as const;
/** The model the person picked for this browser (Everyday until they do). */
const chatModel = () => MODELS.find((m) => m.id === store("nb-chat-model")) ?? MODELS[2];
const modelName = (id?: string) => { const m = MODELS.find((x) => x.id === id); return m ? `${m.name} · ${m.tier}` : id ?? ""; };
let paneSeq = 1;
const newPane = (view?: View): Pane => ({ id: paneSeq++, tabs: [], view: view ?? ((store("nb-view") as View | null) ?? "split") });

const S = {
  identity: undefined as Identity | undefined,
  principal: "",
  signin: { busy: false, error: "" },
  /** Agent Space: where a visitor is in the gate, then the wallet grid once verified */
  as: { step: "landing" as "landing" | "tap" | "hunt", tap: { count: 0, start: 0, done: undefined as "pass" | "fail" | undefined }, hunt: undefined as Hunt | undefined, picked: new Set<number>(), huntDone: undefined as "pass" | "fail" | undefined, pay: "" as "" | "choose" | "creating", wallet: { loading: "", addrs: undefined as { id: string; btc: string; eth: string; icp: string } | undefined, order: undefined as { id: string; url: string; status: string; cents: number; tc: string; delivered?: string; busy?: boolean; failed?: string } | undefined } },
  notebooks: undefined as NotebookRec[] | undefined,
  notebookInfo: new Map<string, Info>(),
  /** cycles health per notebook from the registry; answers even when the notebook is frozen */
  health: new Map<string, Health>(),
  /** notes created per day across every notebook, for the activity grid */
  activity: undefined as Map<string, number> | undefined,
  /** cards-a-day goal, when any notebook has one: the grid shades against it */
  activityGoal: 0,
  /** payment tokens the registry accepts (ICP, TCYCLES, ck tokens) */
  tokens: [] as Token[],
  payToken: (store("nb-pay-token") ?? "ICP") as string,
  attest: undefined as Attestation | undefined,
  tokenId: undefined as bigint | undefined,
  deposits: undefined as DepositState | undefined,
  manageTab: (["wallet", "fuel", "agent", "prompts", "data"].includes(store("nb-manage-tab") ?? "") ? store("nb-manage-tab") : "wallet") as ManageTab,
  /** the owner let agent keys post in the community for this space */
  agentChat: false,
  /** until the identity is restored and the spaces are listed, nothing but a loading screen is shown */
  booting: true,
  /** the skill, with the key, was copied during this visit: the onboarding may close */
  skillCopied: false,
  /** the skill text with this space filled in, for the Skill tab */
  skillShown: "",
  /** what the space holds on each ledger the registry lists, for the Wallet tab */
  walletBalances: undefined as { symbol: string; decimals: number; balance?: bigint }[] | undefined,
  marketFee: 250,
  listing: undefined as ListingView | undefined,
  market: undefined as { listings: ListingView[]; bought: Set<string>; loading: boolean; decksOnly?: boolean } | undefined,
  /** the open notebook is frozen: the file list is the cached copy and nothing can be saved */
  frozen: false,
  sideOpen: store("nb-side") !== "0",
  asideMode: "links" as "links" | "comments",
  asideOpen: store("nb-aside") !== "0",
  newNotebook: "",
  newDesc: "",
  createStep: "",
  notebook: undefined as NotebookRec | undefined,
  notes: undefined as Note[] | undefined,
  folders: [] as string[],
  idx: buildIndex([]) as Index,
  panes: [newPane()] as Pane[],
  focused: 1,
  drafts: new Map<string, Draft>(),
  query: "",
  tag: "",
  collapsed: new Set<string>(JSON.parse(store("nb-collapsed") ?? "[]") as string[]),
  tab: "notes" as Tab,
  chat: { input: "", busy: false, messages: [] as ChatMsg[], excluded: new Set<string>(), stage: "", garden: false as boolean, tidy: false as boolean },
  mobile: mobileQuery.matches,
  mobilePane: "files" as MobilePane,
  graphGhosts: store("nb-graph-ghosts") === "1",
  localDepth: Number(store("nb-local-depth") ?? 1),
  theme: loadThemeState() as ThemeState,
  info: undefined as Info | undefined,
  topups: [] as TopUp[],
  agentKeys: [] as AgentKey[],
  shares: [] as Share[],
  issued: undefined as { name: string; key: string } | undefined,
  newAgent: "",
  shared: undefined as { canister: string; path: string; note?: Note; name?: string; error?: string; loading: boolean; files?: { path: string; size: bigint; modified: bigint }[]; role?: string; comments?: Comment[]; dirty?: boolean; here?: string[]; progress?: [Principal, number][]; myProgress?: number; cycles?: bigint; teamRole?: string } | undefined,
  isAdmin: false,
  flags: [] as Flag[],
  admin: undefined as { bugs: Bug[]; filter: string; kind?: string; open?: bigint; loading: boolean; repo?: string; stats?: AppStats; pending?: SponsorView[]; sponsorPrice?: bigint } | undefined,
  /** this notebook's counts for the quests card */
  usage: undefined as NbUsage | undefined,

  town: undefined as { data?: TownData; legend: boolean; tour?: number; sheet?: "stats" } | undefined,
  /** the problems pages: the board by field, one problem, the discoveries ledger, track records */
  problems: undefined as { tab: ProblemsTab; field?: string; status: "open" | "solved" | "all"; cards: ProblemCard[]; open?: ProblemView; note?: string; noteError?: string; discoveries?: DiscoveryView[]; records?: TrackRecord[]; loading: boolean } | undefined,
  /** "canister/path" -> the problem published from that note, for the strip above it */
  myProblems: new Map<string, ProblemCard>(),
  /** buildings that went up in the town since it was last looked at: a dot on its icon */
  townNews: 0,
  /** the landing page's town: null when it is switched off or did not load */
  landingTown: undefined as TownData | null | undefined,
  settings: parseSettings(undefined) as Settings,
  /** per pane: study mode shows one section at a time */
  studyIdx: new Map<number, number>(),
  pomodoro: undefined as { end: number; phase: "work" | "break" } | undefined,
  taskOwner: "" as string,
  clipperKey: undefined as string | undefined,
  community: undefined as { channel: string; channels: Channel[]; messages: Message[]; online: Online[]; member?: Member; newcomerLeft?: number; newcomerHandle?: string; balance?: bigint; loading: boolean; draft: string; replyTo?: Message; unread: Record<string, number>; showOnline: boolean; showChannels: boolean; picker?: { mid?: bigint }; editing?: bigint; pins?: Message[]; showPins?: boolean; fee?: bigint; primary?: NotebookRec; error?: string; github?: string; repo?: string; firstUnseen?: bigint; atBottom?: boolean; newCount?: number; gistSlide?: Map<bigint, number> } | undefined,
  show: undefined as { slides: string[]; i: number; self?: string; dead?: boolean } | undefined,
  mcpClient: (store("nb-mcp-client") ?? "claude") as string, // which client's MCP setup the Agent tab shows
  mentions: 0, // @mentions of me in the community since I last looked
  inbox: undefined as { items: InboxItem[]; loading: boolean } | undefined,
  inboxNew: 0, // inbox items above the id I last marked read
  org: { q: "", selected: new Set<string>(), triage: false, triageIdx: 0 } as { q: string; sort?: { key: string; dir: number }; selected: Set<string>; triage: boolean; triageIdx: number },
  trips: { mine: [] as Watch[], watching: [] as Watch[] },
  kit: {} as { claimsFor?: string },
  board: undefined as { topic?: string; sort: "hot" | "new" | "top"; posts: Post[]; open?: Post; comments: PostComment[]; channels: Channel[]; member?: Member; fee: bigint; loading: boolean; replyTo?: bigint; github?: string; showSide: boolean; showAside: boolean } | undefined,
  /** projects per notebook for the list page footer */
  projectsByNotebook: new Map<string, { active: number; done: number }>(),
  attempts: [] as Attempt[],
  groupProgress: new Map<string, [Principal, number][]>(),
  /** attestations per note, with whether each still matches the content */
  noteAttest: new Map<string, AttestationView[]>(),
  /** due cards per notebook on the list page, and the goal shading source */
  dueByNotebook: new Map<string, number>(),
  recent: [] as string[],
  propsOpen: store("nb-props") === "1",
  serverHits: undefined as { path: string; snippet: string }[] | undefined,
  comments: [] as Comment[],
  published: null as string | null,
  snapshots: undefined as SnapshotInfo[] | undefined,
  price: 0n,
  oisyAccount: store("nb-oisy") ?? "",
  graphStyle: { colorBy: (store("nb-graph-color") ?? "none") as "none" | "folder" | "tag", hideAttachments: store("nb-graph-noattach") === "1", query: "", orphans: false },
  topupAmount: "0.5",
  error: "",
  busy: "",
  copied: "",
};
applyTheme(S.theme);

const pane = (id = S.focused): Pane => S.panes.find((p) => p.id === id) ?? S.panes[0];
const cur = (): string | undefined => pane().active;
const draftOf = (path: string): Draft => {
  let d = S.drafts.get(path);
  if (!d) {
    d = { text: note(path)?.content ?? (S.shared?.path === path ? S.shared.note?.content ?? "" : ""), dirty: false, saving: false };
    S.drafts.set(path, d);
  }
  return d;
};

// ---------- formatting ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const when = (ns: bigint) => new Date(Number(ns / 1_000_000n)).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const ago = (ns: bigint) => {
  const s = Math.max(0, (Date.now() - Number(ns / 1_000_000n)) / 1000);
  return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86_400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86_400)} d ago`;
};
const tc = (n: bigint) => `${(Number(n) / 1e12).toFixed(n < 100_000_000_000n ? 3 : 2)} TC`;
const kb = (n: bigint | number) => (Number(n) < 1024 ? `${n} B` : Number(n) < 1 << 20 ? `${(Number(n) / 1024).toFixed(1)} KB` : `${(Number(n) / (1 << 20)).toFixed(2)} MB`);
function icp(e8s: bigint): string {
  const s = `${e8s / 100_000_000n}.${(e8s % 100_000_000n).toString().padStart(8, "0")}`;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}
const shortHex = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;
const shortPrincipal = (p: string) => {
  const g = p.split("-");
  return g.length > 5 ? `${g.slice(0, 2).join("-")}…-${g.slice(-1)}` : p;
};
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\.$/, "");
function describe(e: NotebookError): string {
  switch (e.__kind__) {
    case "Unauthorized":
      return "only the space's owner can do that";
    case "NotFound":
      return "no such file or folder";
    case "Exists":
      return "something with that name already exists";
    case "Invalid":
      return e.Invalid;
  }
}
function unwrap<T>(r: { __kind__: "Ok"; Ok: T } | { __kind__: "Err"; Err: NotebookError }): T {
  if (r.__kind__ === "Err") throw new Error(describe(r.Err));
  return r.Ok;
}
async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
}
const paths = () => (S.notes ?? []).map((n) => n.path);
const note = (p: string) => S.notes?.find((n) => n.path === p);
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const lowCycles = (i?: Info) => (i ? Number(i.cycles) < 3e11 : false);
const title = (p: string) => (p.endsWith(".md") ? base(p) : p.split("/").pop()!);

const ICONS: Record<string, string> = {
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  inbox: '<path d="M4 4h16v16H4z"/><path d="M4 13h4l2 3h4l2-3h4"/>',
  "folder-open": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2H5"/><path d="M5 11h17l-2 8H5a2 2 0 0 1-2-2V7"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8.3 6.6l7.2 1M7.2 8.3l2 7.3M16.3 10.1l-4.8 6"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  notes: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/><path d="M12 21a3 3 0 0 1 0-6h1.5a2 2 0 0 0 0-4"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  move: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  tag: '<path d="M20 12l-8 8-9-9V4h7z"/><circle cx="7.5" cy="7.5" r="1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M15 12h4M17 10l2 2-2 2"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  notebook: '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M3 7.5h4M3 12h4M3 16.5h4M15 3v18"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 3l1.5 2.3 2.7-.6.6 2.7L19 9l-1 2.5 1 2.5-2.2 1.6-.6 2.7-2.7-.6L12 21l-1.5-2.3-2.7.6-.6-2.7L5 15l1-2.5L5 10l2.2-1.6.6-2.7 2.7.6z"/>',
  book: '<path d="M2 6c3-1.2 6.5-1.2 10 1 3.5-2.2 7-2.2 10-1v12c-3-1.2-6.5-1.2-10 1-3.5-2.2-7-2.2-10-1z"/><path d="M12 7v12"/><path d="M5 9.5c1.6-.3 3.2-.2 4.5.2M5 12.5c1.6-.3 3.2-.2 4.5.2M14.5 9.7c1.3-.4 2.9-.5 4.5-.2M14.5 12.7c1.3-.4 2.9-.5 4.5-.2"/>',
  cap: '<path d="M2 9.5L12 5l10 4.5L12 14z"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5M22 9.5V15"/>',
  quote: '<path d="M7 11.5a2.5 2.5 0 1 1 2.5-2.5c0 4-1.8 6.6-5 7.8M16 11.5a2.5 2.5 0 1 1 2.5-2.5c0 4-1.8 6.6-5 7.8"/>',
  type: '<path d="M5 7V4h14v3M9.5 20h5M12 4v16"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>',
  out: '<path d="M7 17L17 7M8 7h9v9"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  links: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  list: '<path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><circle cx="9" cy="14" r="1.5"/><circle cx="15" cy="14" r="1.5"/><path d="M12 8V4M8 4h8"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  template: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="6" y="7" width="5" height="4"/><rect x="13" y="12" width="5" height="4"/><path d="M11 9h2v5"/>',
  command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
  updown: '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/><path d="M8 12h8M8 9h5"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  "panel-left": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  "panel-right": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  mountain: '<path d="M3 20l6-10 4 6 3-4 5 8z"/><path d="M8.2 11.4l1.8 1.6 1.4-1.2"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  'pin-top': '<path d="M5 4h14M12 20V9M7.5 13.5 12 9l4.5 4.5"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.4c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.7.8-2.7 2s1.1 1.6 2.7 2 2.7.8 2.7 2-1.1 2-2.7 2c-1.3 0-2.4-.5-2.9-1.4M12 6.5v11"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M3 5a2 2 0 0 0 2 2h15a1 1 0 0 1 1 1v3h-4a2 2 0 0 0 0 4h4"/>',
  megaphone: '<path d="M3 11l16-6v14L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 13.9 7 22l5-3 5 3-1.5-8.1"/>',
  town: '<path d="M3 20v-8l5-4 5 4v8"/><path d="M13 20V9l4-3 4 3v11"/><path d="M2 20h20"/><path d="M7 20v-3h2v3"/>',
  broom: '<path d="M19 3l-8 8"/><path d="M11 11l-4 4"/><path d="M7 15l-3 6 6-3"/><path d="M8.5 13.5l2 2"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  minus: '<path d="M5 12h14"/>',
  sprout: '<path d="M12 21v-9"/><path d="M12 12c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6z"/><path d="M12 15c0-3-2-5-5-5 0 3 2 5 5 5z"/><path d="M7 21h10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.3A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 9.2 4.1C19.5 15.4 12 20 12 20z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  pin: '<path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
  bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M12 6V3M6 10H3M21 10h-3M6 20l-2 2M18 20l2 2M6 15H3M21 15h-3"/>',
};
const icon = (n: string, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] ?? ""}</svg>`;

const attachments = new Map<string, string>();
const fetching = new Set<string>();
/** Attachments are fetched one by one when a preview first needs them, then cached for the session. */
function attachment(path: string): string | undefined {
  const d = attachments.get(path);
  if (d !== undefined || fetching.has(path) || !S.notebook) return d;
  fetching.add(path);
  nb().read(path).then((r) => {
    fetching.delete(path);
    if (r.__kind__ === "Ok") {
      attachments.set(path, r.Ok.content);
      refreshPreviews();
    }
  }).catch(() => fetching.delete(path));
  return undefined;
}
const resolveLink = (t: string) => resolve(t, paths(), S.idx.aliases);
/** Links pane of a person note: every line that mentions them, with the note it is in. */
function mentionsHtml(c: string): string {
  const text = draftOf(c).text;
  if ((frontmatter(text).data.type ?? "").trim().toLowerCase() !== "person") return "";
  const name = headings(text)[0]?.text ?? title(c);
  const person = people(workNotes()).find((p) => p.name.toLowerCase() === name.toLowerCase());
  const ms = (person?.mentions ?? []).filter((m) => m.path !== c);
  const open = sortTasks(parseTasks(workNotes()).filter((t) => t.owner?.toLowerCase() === name.toLowerCase() && !t.done), new Date());
  return `<div class="pane-title">Mentions <span class="count">${ms.length}</span></div>${ms.length ? ms.slice(0, 30).map((m) => `<div class="bl" data-action="open" data-path="${esc(m.path)}"><div class="t">${icon("file")}${esc(stem(m.path))}</div><div class="ctx">${esc(m.line).replace(new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"), (x) => `<mark>${x}</mark>`)}</div></div>`).join("") : `<div class="empty-side">Write @${esc(name)} in any note and it shows up here.</div>`}
    ${open.length ? `<div class="pane-title">Their open tasks <span class="count">${open.length}</span></div>${open.slice(0, 20).map((t) => `<div class="bl" data-action="open" data-path="${esc(t.path)}"><div class="t ${isOverdue(t, new Date()) ? "danger" : ""}">${icon("check")}${esc(t.text)}</div></div>`).join("")}` : ""}`;
}

/** Links pane: how a prose note lines up with its Lean note, what the prose never mentions, and who vouched for what. */
function alignmentHtml(c: string): string {
  const text = draftOf(c).text;
  const lean = isLeanNote(text) ? c : leanFor(c);
  if (!lean) return "";
  const leanText = draftOf(lean).text;
  const decls = parseLean(leanCode(leanText));
  const prose = lean === c ? undefined : text;
  const al = prose !== undefined ? align(prose, decls) : undefined;
  const refs = prose !== undefined ? [...prose.matchAll(/!\[\[[^\]#|]+#thm:([^\]|]+)/g)].map((m) => m[1].trim()) : [];
  const ledger = decls.filter((d) => refs.includes(d.name) || (!refs.length && (d.kind === "theorem" || d.kind === "lemma"))).map((d) => ({ d, missing: unmentionedHyps(d, prose ?? d.doc) }));
  const attest = [...(S.noteAttest.get(c) ?? []), ...(lean !== c ? S.noteAttest.get(lean) ?? [] : [])].sort((a, b) => Number(b.attestation.at - a.attestation.at));
  const who = (a: AttestationView) => a.attestation.agent ? `agent ${esc(a.attestation.agent)}` : a.attestation.by.toText() === S.principal ? "you" : shortPrincipal(a.attestation.by.toText());
  const can = !S.frozen;
  return `<div class="pane-title">Formal alignment${al ? ` <span class="count">${Math.round(al.coverage * 100)}%</span>` : ""}</div>
    <div class="align">
      <div class="small muted">${lean === c ? "This is the Lean note." : `Lean: <a href="#" data-action="open" data-path="${esc(lean)}">${esc(title(lean))}</a>`}${decls.some((d) => d.flags.length) ? ` · <span class="danger">${decls.flatMap((d) => d.flags).length} flag${decls.flatMap((d) => d.flags).length === 1 ? "" : "s"}: ${esc([...new Set(decls.flatMap((d) => d.flags))].join(", "))}</span>` : ""}</div>
      ${al ? `${al.backed.map((b) => `<div class="al-row ok" title="${esc(b.text)}">${icon("check")}<span>^${esc(b.id)}</span><code>${b.lemmas.map(esc).join(", ")}</code></div>`).join("")}${al.informalOnly.map((b) => `<div class="al-row warn" title="${esc(b.text)}">${icon("bolt")}<span>^${esc(b.id)}</span><span class="small">prose only: no lemma tagged <code>-- step: ^${esc(b.id)}</code></span></div>`).join("")}${al.formalOnly.map((d) => `<div class="al-row faint">${icon("file")}<code>${esc(d.name)}</code><span class="small">formal only: no prose step cites it</span></div>`).join("")}${!al.backed.length && !al.informalOnly.length ? `<div class="small faint">End prose steps with <code>^step-1</code> and tag lemmas with <code>-- step: ^step-1</code> to line them up.</div>` : ""}` : ""}
      ${ledger.some((l) => l.missing.length) ? `<div class="pane-sub">Hypotheses the prose never mentions</div>${ledger.filter((l) => l.missing.length).map((l) => `<div class="al-row bad">${icon("bolt")}<code>${esc(l.d.name)}</code><span class="small">${l.missing.map((h) => `<code>${esc(h.name)} : ${esc(h.type)}</code>`).join(" ")}</span></div>`).join("")}` : ledger.length ? `<div class="al-row ok">${icon("check")}<span class="small">Every hypothesis of ${ledger.length === 1 ? "the theorem" : `${ledger.length} theorems`} is mentioned in the prose.</span></div>` : ""}
      <div class="pane-sub">Attestations</div>
      ${attest.length ? attest.slice(0, 8).map((a) => `<div class="al-row ${a.fresh ? (/^(pass|same|ok)$/.test(a.attestation.verdict) ? "ok" : "bad") : "stale"}" title="${esc(a.attestation.detail)}">${icon(a.fresh ? "check" : "history")}<span>${esc(a.attestation.kind)}: <b>${esc(a.attestation.verdict)}</b></span><span class="small muted">${who(a)} · ${ago(a.attestation.at)}${a.fresh ? "" : " · stale"}${a.attestation.path === lean && lean !== c ? " · on the Lean" : ""}</span></div>`).join("") : `<div class="small faint">Nothing attested yet. A checker agent posts <code>check</code>; a reader posts <code>compare</code>.</div>`}
      ${can ? `<div class="row tight nudge">${prose !== undefined ? `<span class="small muted">English vs Lean:</span><button type="button" class="btn btn-ghost" data-action="attest-note" data-path="${esc(c)}" data-kind="compare" data-verdict="same" data-lean="${esc(lean)}">${icon("check")}Same</button><button type="button" class="btn btn-ghost" data-action="attest-note" data-path="${esc(c)}" data-kind="compare" data-verdict="weaker" data-lean="${esc(lean)}">Weaker</button><button type="button" class="btn btn-ghost" data-action="attest-note" data-path="${esc(c)}" data-kind="compare" data-verdict="different" data-lean="${esc(lean)}">Different</button>` : `<span class="small muted">Checked it yourself?</span><button type="button" class="btn btn-ghost" data-action="attest-note" data-path="${esc(c)}" data-kind="check" data-verdict="pass">${icon("check")}Passes</button><button type="button" class="btn btn-ghost" data-action="attest-note" data-path="${esc(c)}" data-kind="check" data-verdict="fail">Fails</button>`}</div>` : ""}
    </div>`;
}

/** Markdown to safe HTML with everything Obsidian adds; see markdown.ts. */
function renderMd(content: string, self?: string): string {
  let smap: Map<string, { s: Source; path: string }> | undefined;
  const cite = (key: string, loc?: string) => {
    smap ??= new Map(orgNotes().map((n) => { const s = sourceFromNote(n.content); return s ? [s.key, { s, path: n.path }] as const : undefined; }).filter((x): x is readonly [string, { s: Source; path: string }] => !!x));
    const hit = smap.get(key);
    return hit ? `<a class="cite-ref" href="#" data-action="open" data-path="${esc(hit.path)}" title="${esc(hit.s.title)}">${esc(citeIn(hit.s, S.settings.citeStyle, loc))}</a>` : `<span class="cite-ref missing" title="No source with this key yet">[@${esc(key)}]</span>`;
  };
  return renderMarkdown(content, { self, resolve: resolveLink, note: (p) => (S.drafts.get(p)?.text ?? note(p)?.content), attachment, claimBadge: (lean, name) => claimBadge(self, lean, name), cite: content.includes("[@") ? cite : undefined });
}
/** What stands behind a theorem embed: the Lean checked (on the Lean note) and the English compared (on this note), both unchanged since. */
function claimStatus(prose: string | undefined, lean: string): { cls: string; label: string; title: string } {
  const latest = (path: string, kind: string) => (S.noteAttest.get(path) ?? []).filter((a) => a.attestation.kind === kind).sort((a, b) => Number(b.attestation.at - a.attestation.at))[0];
  const check = latest(lean, "check");
  const cmp = prose ? latest(prose, "compare") : undefined;
  if (check && !check.fresh) return { cls: "stale", label: "needs re-check", title: "The Lean changed after it was last checked." };
  if (cmp && !cmp.fresh) return { cls: "stale", label: "needs review", title: "The prose or the Lean changed after the last comparison." };
  if (check?.attestation.verdict === "fail") return { cls: "bad", label: "Lean fails", title: check.attestation.detail || "The checker reported a failure." };
  if (cmp && cmp.attestation.verdict !== "same") return { cls: "bad", label: `English ≠ Lean (${cmp.attestation.verdict})`, title: cmp.attestation.detail || "A reviewer found the statements differ." };
  if (check?.attestation.verdict === "pass" && cmp?.attestation.verdict === "same") return { cls: "ok", label: "verified", title: `Lean checked by ${check.attestation.agent ?? shortPrincipal(check.attestation.by.toText())}; statement compared by ${cmp.attestation.agent ?? shortPrincipal(cmp.attestation.by.toText())}.` };
  if (check?.attestation.verdict === "pass") return { cls: "warn", label: "Lean checked, not compared", title: "The code compiles, but nobody has confirmed it says what the English says." };
  if (cmp?.attestation.verdict === "same") return { cls: "warn", label: "compared, Lean unchecked", title: "The statements agree, but the Lean has not been checked." };
  return { cls: "none", label: "unverified", title: "No checker or reviewer has attested to this claim." };
}
function claimBadge(prose: string | undefined, lean: string, name: string): string {
  let st = claimStatus(prose, lean);
  // a declaration with sorry, admit or an axiom is never verified, whatever the attestations say
  const d = parseLean(leanCode(S.drafts.get(lean)?.text ?? note(lean)?.content ?? "")).find((x) => x.name === name);
  const bad = d?.flags.filter((f) => /^(sorry|admit|axiom)$/.test(f)) ?? [];
  if (bad.length && st.cls !== "bad") st = { cls: "bad", label: `incomplete (${bad.join(", ")})`, title: `The Lean uses ${bad.join(" and ")}; the proof is not complete.` };
  return `<span class="claim ${st.cls}" title="${esc(st.title)}">${st.cls === "ok" ? icon("check") : st.cls === "none" ? "" : icon("bolt")}${esc(st.label)}</span>`;
}
async function loadAttestations(path: string) {
  try {
    const r = await nb().note_attestations(path);
    if (r.__kind__ === "Ok") S.noteAttest.set(path, r.Ok);
  } catch { /* none */ }
}
/** The Lean note a prose note binds to: `lean: [[Name]]` in its properties. */
function leanFor(path: string): string | undefined {
  const raw = frontmatter(draftOf(path).text).data.lean;
  if (!raw) return undefined;
  return resolveLink(raw.replace(/^\[\[|\]\]$/g, "").split("|")[0].trim());
}
/** Underline glossary terms in reading view with their definition on hover. */
function decorateGlossary(root: ParentNode) {
  if (!S.notes) return;
  const g = glossary(S.notes).slice(0, 150);
  if (!g.length) return;
  const re = new RegExp(`\\b(${g.map((e) => e.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
  const defs = new Map(g.map((e) => [e.term.toLowerCase(), e.definition]));
  root.querySelectorAll<HTMLElement>(".preview:not([data-gl]), .shared-note:not([data-gl])").forEach((pv) => {
    pv.dataset.gl = "1";
    const walker = document.createTreeWalker(pv, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest("code, pre, a, abbr, .qz, .kb, h1, h2, h3") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);
    const done = new Set<string>();
    for (const t of nodes) {
      const m = re.exec(t.data);
      if (!m || done.has(m[1].toLowerCase())) continue;
      done.add(m[1].toLowerCase());
      const abbr = document.createElement("abbr");
      abbr.className = "gl";
      abbr.title = defs.get(m[1].toLowerCase()) ?? "";
      abbr.textContent = m[1];
      const after = t.splitText(m.index!);
      after.data = after.data.slice(m[1].length);
      t.parentNode!.insertBefore(abbr, after);
    }
  });
}
/** Reading view tables: click a header to sort the source table, double-click a cell to edit it. */
function decorateTables(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(".preview[data-preview-path]").forEach((pv) => {
    const path = pv.dataset.previewPath!;
    pv.querySelectorAll<HTMLTableElement>("table:not([data-tbl])").forEach((tbl, ti) => {
      tbl.dataset.tbl = String(ti);
      tbl.querySelectorAll("thead th").forEach((th, ci) => { th.setAttribute("data-action", "sort-table"); th.setAttribute("data-path", path); th.setAttribute("data-table", String(ti)); th.setAttribute("data-col", String(ci)); th.setAttribute("title", "Click to sort; again to reverse"); th.addEventListener("click", () => th.setAttribute("data-desc", th.getAttribute("data-desc") === "1" ? "0" : "1")); });
      tbl.querySelectorAll("tbody tr").forEach((tr, ri) => tr.querySelectorAll("td").forEach((td, ci) => { td.dataset.cell = `${ti}:${ri}:${ci}`; td.dataset.path = path; td.title = "Double-click to edit"; }));
    });
  });
}
/** The community's sky: put it back on the canvas after every render, and send a wave of light from
 *  the author of each new message (only new ones in the channel already open, at most three). */
let skySeen = { channel: "", last: -1n, loaded: false };
let skyGraph: { notes?: unknown; idx?: unknown; g?: ReturnType<typeof graphData> } = {};
function skySync() {
  const dark = S.theme.mode === "dark", accent = getComputedStyle(document.body).getPropertyValue("--accent").trim();
  // the landing page: the community's sky behind everything
  const landingSky = document.querySelector<HTMLCanvasElement>("canvas[data-landing-sky]");
  if (landingSky) { attachSky(landingSky, { mode: "chat", key: "general", online: [], dark, accent }); return; }
  document.querySelectorAll<HTMLCanvasElement>("canvas[data-kit-band]").forEach((k) => paintBand(k, k.dataset.kitBand!, dark, accent));
  // an open notebook with nothing open: its notes as stars, its links as lines
  const notesSky = document.querySelector<HTMLCanvasElement>("canvas[data-notes-sky]");
  if (notesSky && S.notebook && S.notes) {
    if (skyGraph.notes !== S.notes || skyGraph.idx !== S.idx) skyGraph = { notes: S.notes, idx: S.idx, g: graphData(S.notes.filter((n) => !isAttachment(n.path)), S.idx, { unresolved: false }) };
    attachSky(notesSky, { mode: "notes", key: S.notebook.canister.toText(), graph: skyGraph.g, dark, accent, onOpen: (id) => void open(id) });
    return;
  }
  const c = S.community;
  const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-chat-sky]");
  if (!c || !canvas) return;
  attachSky(canvas, { mode: "chat", key: c.channel, online: c.online.filter((o) => o.channel === c.channel).map((o) => o.principal.toText()), dark, accent });
  const last = c.messages.length ? c.messages[c.messages.length - 1].id : -1n;
  // the messages a channel opens with are not news: only ones that arrive after it has loaded light up
  if (skySeen.channel === c.channel && skySeen.loaded && last > skySeen.last) for (const m of c.messages.filter((x) => x.id > skySeen.last).slice(-3)) skyPulse(m.author.toText());
  skySeen = { channel: c.channel, last, loaded: !c.loading };
}
function afterRender(root: ParentNode = document) {
  skySync();
  townSync();
  const segOn = document.querySelector<HTMLElement>(".wsbar .segmented .tab[aria-selected=\"true\"]");
  if (segOn) segOn.parentElement!.scrollLeft = segOn.offsetLeft - segOn.parentElement!.clientWidth / 2 + segOn.offsetWidth / 2;
  const dark = S.theme.mode === "dark";
  decorateCode(root);
  void renderDiagrams(root, dark);
  decorateGlossary(root);
  decorateTables(root);
  hydratePdfs(root);
  hydratePrices(root);
  root.querySelectorAll<HTMLElement>("[data-excalidraw-embed]:not([data-done])").forEach((el) => {
    el.dataset.done = "1";
    const path = el.dataset.excalidrawEmbed!;
    const content = S.drafts.get(path)?.text ?? note(path)?.content;
    if (content === undefined) return;
    toSvg(content, dark).then((svg) => {
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      el.replaceChildren(svg);
    }).catch((e) => (el.textContent = `drawing failed to render: ${errMsg(e)}`));
  });
  root.querySelectorAll<HTMLElement>(".excalidraw-host[data-excalidraw]:not([data-mounted])").forEach((host) => {
    host.dataset.mounted = "1";
    const path = host.dataset.excalidraw!;
    void mountEditor(host, draftOf(path).text, path, dark, (next) => onDraftInput(path, next));
  });
}
function refreshPreviews() {
  document.querySelectorAll<HTMLElement>("[data-preview-path]").forEach((pv) => {
    const path = pv.dataset.previewPath!;
    pv.innerHTML = previewHtml(path, draftOf(path).text);
    afterRender(pv);
  });
}
/** One section at a time: the note split at its headings, with previous / next and a position. */
function studySections(text: string): { heading: string; body: string }[] {
  const body = frontmatter(text).body;
  const parts: { heading: string; body: string }[] = [];
  let curH = "";
  let buf: string[] = [];
  for (const line of body.split("\n")) {
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { if (buf.join("").trim() || curH) parts.push({ heading: curH, body: buf.join("\n") }); curH = h[2]; buf = [line]; }
    else buf.push(line);
  }
  if (buf.join("").trim() || curH) parts.push({ heading: curH, body: buf.join("\n") });
  return parts.length ? parts : [{ heading: "", body }];
}
function studyHtml(p: Pane, path: string, text: string): string {
  const secs = studySections(text);
  const i = Math.min(S.studyIdx.get(p.id) ?? 0, secs.length - 1);
  const sec = secs[i];
  return `<div class="study-nav"><button type="button" class="btn btn-ghost" data-action="study-prev" data-pane="${p.id}" ${i === 0 ? "disabled" : ""}>${icon("links")}Previous</button><span class="small muted">${i + 1} of ${secs.length}${sec.heading ? ` · ${esc(sec.heading)}` : ""}</span><button type="button" class="btn btn-primary" data-action="study-next" data-pane="${p.id}" ${i >= secs.length - 1 ? "disabled" : ""}>Next${icon("move")}</button></div>
    <div class="study-section">${renderMd(sec.body, path)}</div>
    <div class="study-nav bottom">${i >= secs.length - 1 ? `<button type="button" class="btn" data-action="study-mode" data-pane="${p.id}">${icon("check")}Done, back to the whole note</button><button type="button" class="btn btn-ghost" data-action="study-cards" data-path="${esc(path)}">${icon("check")}Make flashcards from it</button>` : `<button type="button" class="btn btn-primary" data-action="study-next" data-pane="${p.id}">Next section${icon("move")}</button>`}</div>`;
}
const POMO = { work: 25 * 60, break: 5 * 60 };
function pomodoroHtml(): string {
  const p = S.pomodoro;
  const left = p ? Math.max(0, Math.round((p.end - Date.now()) / 1000)) : POMO.work;
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return `<button type="button" class="btn btn-ghost pomo ${p ? p.phase : ""}" data-action="pomodoro" title="${p ? (p.phase === "work" ? "Focus: click to stop" : "Break: click to stop") : "Start a 25-minute focus timer"}"><span class="pomo-time">${mm}</span>${p ? (p.phase === "work" ? "focus" : "break") : "focus"}</button>`;
}
setInterval(() => {
  const p = S.pomodoro;
  if (!p) return;
  const left = Math.max(0, Math.round((p.end - Date.now()) / 1000));
  document.querySelectorAll<HTMLElement>(".pomo-time").forEach((e) => (e.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`));
  if (left <= 0) {
    const next = p.phase === "work" ? "break" : "work";
    S.pomodoro = { end: Date.now() + POMO[next] * 1000, phase: next };
    toast(next === "break" ? "Focus block done. Five-minute break." : "Break over. Back to it.", "ok");
    document.querySelectorAll<HTMLElement>(".pomo").forEach((e) => { e.classList.remove("work", "break"); e.classList.add(next); e.lastChild!.textContent = next === "work" ? "focus" : "break"; });
  }
}, 1000);
function previewHtml(path: string, text: string): string {
  if (isAttachment(path)) return renderMarkdown(`![[${path}]]`, { self: path, resolve: resolveLink, note: () => undefined, attachment });
  if (path.endsWith(".md") && isLeanNote(text)) return `${formalCard(path, text)}${renderMd(text, path)}`;
  return path.endsWith(".md") ? renderMd(text, path) : `<pre>${esc(text)}</pre>`;
}
/** The declarations of a Lean note: English beside Lean, hypotheses, flags, step tags, and the checker's verdict. */
function formalCard(path: string, text: string): string {
  const decls = parseLean(leanCode(text));
  if (!decls.length) return `<div class="formal"><div class="pane-title">Formal</div><p class="small muted">No declarations found in the <code>lean</code> blocks yet.</p></div>`;
  const check = (S.noteAttest.get(path) ?? []).filter((a) => a.attestation.kind === "check").sort((a, b) => Number(b.attestation.at - a.attestation.at))[0];
  const verdict = check ? `<span class="claim ${check.fresh ? (check.attestation.verdict === "pass" ? "ok" : "bad") : "stale"}" title="${esc(check.attestation.detail)}">${check.fresh ? (check.attestation.verdict === "pass" ? `${icon("check")}checked by ${esc(check.attestation.agent ?? shortPrincipal(check.attestation.by.toText()))} ${ago(check.attestation.at)}` : `${icon("bolt")}check failed`) : `${icon("bolt")}changed since the last check`}</span>` : `<span class="claim none">not checked yet</span>`;
  return `<div class="formal"><div class="pane-title">Formal <span class="count">${decls.length}</span> ${verdict}</div>
    ${decls.map((d) => { const c = statementCard(d); return `<div class="thm" data-thm="${esc(d.name)}"><div class="thm-head"><code>${esc(d.kind)} ${esc(d.name)}</code>${d.steps.length ? `<span class="small muted">↔ ${d.steps.map((x) => `^${esc(x)}`).join(", ")}</span>` : `<span class="small faint">no step tag</span>`}${d.flags.map((f) => `<span class="pill low" title="Treat with care">${esc(f)}</span>`).join("")}</div><div class="thm-en md">${d.doc ? renderMd(d.doc, path) : `<span class="muted small">${esc(c.english)}</span>`}</div><pre class="thm-lean"><code>${esc(c.lean)}</code></pre>${d.hyps.filter((h) => !h.implicit).length ? `<div class="small muted">Hypotheses: ${d.hyps.filter((h) => !h.implicit).map((h) => `<code>${esc(h.name)} : ${esc(h.type)}</code>`).join(" ")}</div>` : ""}</div>`; }).join("")}
    <p class="small faint">Embed a statement in prose with <code>![[${esc(title(path))}#thm:${esc(decls[0].name)}]]</code>; tag a lemma with <code>-- step: ^id</code> to bind it to a prose step ending in <code>^id</code>.</p></div>`;
}

// ---------- overlays: toasts, dialogs, context menu, quick switcher ----------

function toast(msg: string, kind: "info" | "ok" | "error" = "info") {
  let host = document.getElementById("toasts");
  if (!host) {
    host = Object.assign(document.createElement("div"), { id: "toasts" });
    document.body.append(host);
  }
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.textContent = msg;
  host.append(el);
  setTimeout(() => el.remove(), kind === "error" ? 6000 : 3200);
}

type Ask = { title: string; body?: string; label?: string; value?: string; placeholder?: string; ok?: string; danger?: boolean; choices?: { value: string; label: string }[]; multiline?: boolean };
/** A small modal: text field, textarea or choice list, resolved with the value or null. Replaces prompt()/confirm(). */
function ask(o: Ask): Promise<string | null> {
  return new Promise((res) => {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    const hasInput = o.choices || o.multiline || o.label !== undefined || o.value !== undefined || o.placeholder !== undefined;
    const field = o.choices
      ? `<select class="input" name="v">${o.choices.map((c) => `<option value="${esc(c.value)}" ${c.value === o.value ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>`
      : o.multiline
        ? `<textarea class="input code" name="v" rows="12" placeholder="${esc(o.placeholder ?? "")}" spellcheck="false">${esc(o.value ?? "")}</textarea>`
        : `<input class="input" name="v" value="${esc(o.value ?? "")}" placeholder="${esc(o.placeholder ?? "")}" autocomplete="off" spellcheck="false">`;
    scrim.innerHTML = `<form class="modal ${o.multiline ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">${esc(o.title)}</h2>
      ${o.body ? `<p class="muted">${esc(o.body)}</p>` : ""}
      ${hasInput ? `<label class="field"><span class="label">${esc(o.label ?? "")}</span>${field}</label>` : ""}
      <div class="actions"><button type="button" class="btn" data-x="cancel">Cancel</button><button type="submit" class="btn ${o.danger ? "btn-danger" : "btn-primary"}">${esc(o.ok ?? "OK")}</button></div>
    </form>`;
    const done = (v: string | null) => {
      scrim.remove();
      document.removeEventListener("keydown", onKey);
      res(v);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && done(null);
    scrim.addEventListener("click", (e) => e.target === scrim && done(null));
    scrim.querySelector("[data-x=cancel]")!.addEventListener("click", () => done(null));
    scrim.querySelector("form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = scrim.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name=v]");
      done(f ? f.value : "");
    });
    document.addEventListener("keydown", onKey);
    document.body.append(scrim);
    const f = scrim.querySelector<HTMLInputElement>("input[name=v]");
    if (f) {
      f.focus();
      const dot = f.value.lastIndexOf(".");
      f.setSelectionRange(0, dot > 0 ? dot : f.value.length);
    } else scrim.querySelector<HTMLElement>("textarea, select, button[type=submit]")?.focus();
  });
}
const confirmDialog = (title: string, body: string, ok = "Delete") => ask({ title, body, ok, danger: true }).then((v) => v !== null);

type MenuItem = { label: string; icon: string; action: () => void; danger?: boolean; checked?: boolean } | "-";
function contextMenu(x: number, y: number, head: string, items: MenuItem[]) {
  closeMenu();
  const m = document.createElement("div");
  m.className = "ctx-menu";
  m.setAttribute("role", "menu");
  m.innerHTML = `<div class="head">${esc(head)}</div>` + items.map((it, i) => (it === "-" ? "<hr>" : `<button type="button" role="menuitem" class="${it.danger ? "danger" : ""}" data-i="${i}">${icon(it.icon)}${esc(it.label)}${it.checked ? icon("check", "right") : ""}</button>`)).join("");
  m.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-i]");
    if (!b) return;
    const it = items[Number(b.dataset.i)];
    closeMenu();
    if (it !== "-") it.action();
  });
  document.body.append(m);
  // offset sizes, not getBoundingClientRect: the opening animation scales the menu down, which made it measure short and open off-screen
  m.style.left = `${Math.max(4, Math.min(x, innerWidth - m.offsetWidth - 8))}px`;
  m.style.top = `${Math.max(4, Math.min(y, innerHeight - m.offsetHeight - 8))}px`;
  m.querySelector<HTMLElement>("button")?.focus();
}
function closeMenu() {
  document.querySelector(".ctx-menu")?.remove();
}

/** Quick switcher (⌘K / ⌘O / ⌘P): fuzzy-open a note, or create the typed name. */
function openPalette(initial = "") {
  if (!S.notes) return;
  closePalette();
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.id = "palette";
  let sel = 0;
  let items: { path?: string; create?: string; command?: string }[] = [];
  const render = (q: string) => {
    if (q.startsWith(">")) {
      const cq = q.slice(1).trim().toLowerCase();
      const cmds = COMMANDS.filter((c) => !cq || c.label.toLowerCase().includes(cq));
      items = cmds.map((c) => ({ command: c.label }));
      sel = Math.min(sel, Math.max(0, items.length - 1));
      scrim.querySelector(".list")!.innerHTML = cmds.length ? cmds.map((c, i) => `<div class="opt" role="option" aria-selected="${i === sel}" data-i="${i}">${icon("command")}<span>${esc(c.label)}</span>${c.kbd ? `<span class="path">${esc(c.kbd)}</span>` : ""}</div>`).join("") : `<div class="opt muted">No command matches.</div>`;
      return;
    }
    const hits = q.trim() ? fuzzy(q, paths()) : [...S.recent.filter((p) => note(p)), ...paths().filter((p) => !S.recent.includes(p))].slice(0, 12);
    items = hits.map((p) => ({ path: p }));
    const exact = hits.some((p) => stem(p).toLowerCase() === q.trim().toLowerCase() || base(p).toLowerCase() === q.trim().toLowerCase());
    if (q.trim() && !exact) items.push({ create: q.trim() });
    sel = Math.min(sel, Math.max(0, items.length - 1));
    scrim.querySelector(".list")!.innerHTML = items.length
      ? items.map((it, i) => `<div class="opt" role="option" aria-selected="${i === sel}" data-i="${i}">${it.path ? `${icon("file")}<span>${esc(title(it.path))}</span><span class="path">${esc(dir(it.path))}</span>` : `${icon("plus")}<span>Create <b>${esc(it.create!)}</b></span><span class="path">new note</span>`}</div>`).join("")
      : `<div class="opt muted">No notes yet. Type a name to create one.</div>`;
    scrim.querySelector<HTMLElement>(`.opt[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const go = async (newTab: boolean) => {
    const it = items[sel];
    closePalette();
    if (!it) return;
    if (it.path) await open(it.path, { newTab });
    else if (it.create) await newNote(it.create);
    else if (it.command) COMMANDS.find((c) => c.label === it.command)?.run();
  };
  scrim.innerHTML = `<div class="palette" role="dialog" aria-modal="true" aria-label="Open or create a note">
      <label class="search">${icon("search")}<input name="pq" placeholder="Open or create a note… type > for commands" autocomplete="off" spellcheck="false" aria-label="Note name"></label>
      <div class="list" role="listbox"></div>
      <div class="foot"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">${MOD}↵</span> new tab</span><span><span class="kbd">esc</span> close</span></div>
    </div>`;
  const input = scrim.querySelector<HTMLInputElement>("input")!;
  input.addEventListener("input", () => render(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); render(input.value); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); render(input.value); e.preventDefault(); }
    else if (e.key === "Enter") { e.preventDefault(); void go(e.metaKey || e.ctrlKey); }
    else if (e.key === "Escape") closePalette();
  });
  scrim.querySelector(".list")!.addEventListener("click", (e) => {
    const o = (e.target as HTMLElement).closest<HTMLElement>(".opt[data-i]");
    if (o) { sel = Number(o.dataset.i); void go((e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey); }
  });
  scrim.addEventListener("click", (e) => e.target === scrim && closePalette());
  document.body.append(scrim);
  input.value = initial;
  render(initial);
  input.focus();
}
const closePalette = () => document.getElementById("palette")?.remove();

/** Every action, for the command palette (⌘⇧P or `>` in the switcher). */
const COMMANDS: { label: string; kbd?: string; run: () => void }[] = [
  { label: "New note", kbd: `${MOD}N`, run: () => void newNote() },
  { label: "New drawing (Excalidraw)", run: () => void newDrawing() },
  { label: "New kanban board", run: () => void newBoard() },
  { label: "New Python space (Jupyter)", run: () => void newPyNotebook() },
  { label: "New spreadsheet", run: () => void newSheetNote() },
  { label: "Open a random note", run: () => { const ps = paths().filter((p) => p.endsWith(".md") && p !== cur()); if (ps.length) void open(ps[Math.floor(Math.random() * ps.length)]); } },
  { label: "New dashboard", run: () => void newDashNote() },
  { label: "New flashcard deck", run: () => void newQuiz("cards") },
  { label: "New multiple-choice quiz", run: () => void newQuiz("choice") },
  { label: "Highlight selection", kbd: `${MOD}⇧H`, run: () => toggleHighlight() },
  { label: "New folder", run: () => void newFolder("") },
  { label: "New note from template", run: () => void newFromTemplate() },
  { label: "Open today's note", kbd: `${MOD}⇧D`, run: () => void openDaily() },
  { label: "Toggle edit / split / reading", kbd: `${MOD}E`, run: () => cycleView(S.focused) },
  { label: "Split right", kbd: `${MOD}\\`, run: () => splitRight(S.focused) },
  { label: "Close tab", kbd: `${MOD}W`, run: () => { const c = cur(); if (c) closeTab(S.focused, c); } },
  { label: "Toggle properties editor", run: () => { S.propsOpen = !S.propsOpen; store("nb-props", S.propsOpen ? "1" : "0"); render(); } },
  { label: "Pin or unpin this note", run: () => { const c = cur(); if (c) void togglePin(c); } },
  { label: "Version history", run: () => { const c = cur(); if (c) void historyDialog(c); } },
  { label: "Share this note", run: () => { const c = cur(); if (c) void shareDialog(c); } },
  { label: "Search notes", kbd: `${MOD}K`, run: () => openPalette() },
  { label: "Show graph", run: () => { S.tab = "graph"; render(); } },
  { label: "Toggle file pane", kbd: `${MOD}⇧[`, run: () => toggleSide("side") },
  { label: "Toggle right pane", kbd: `${MOD}⇧]`, run: () => toggleSide("aside") },
  { label: "Study: due cards, glossary, goals", run: () => { S.tab = "study"; render(); } },
  { label: "Work: tasks, projects, meetings, people", run: () => { S.tab = "work"; render(); } },
  { label: "Quick capture", kbd: `${MOD}⇧N`, run: () => void quickCapture() },
  { label: "New meeting", run: () => void newMeeting() },
  { label: "Weekly review", run: () => void onAction("weekly-review", document.body, new MouseEvent("click")) },
  { label: "Chat with your notes", run: () => { S.tab = "chat"; render(); document.querySelector<HTMLTextAreaElement>("[name=chatq]")?.focus(); } },
  { label: "Show notes", run: () => { S.tab = "notes"; render(); } },
  { label: "Manage space", run: () => { S.tab = "manage"; render(); } },
  { label: "Download space (.zip)", run: () => void downloadNotebook() },
  { label: "Import from Obsidian", run: () => importDialog() },
  { label: "Toggle dark / light", run: () => { S.theme = { ...S.theme, mode: S.theme.mode === "dark" ? "light" : "dark" }; saveThemeState(S.theme); applyTheme(S.theme); render(); } },
  { label: "Help and support", run: () => void helpDialog() },
  { label: "All spaces", run: () => { location.hash = "#/"; } },
];

function themeMenu(x: number, y: number) {
  const t = S.theme;
  const setT = (patch: Partial<ThemeState>) => {
    S.theme = { ...S.theme, ...patch };
    saveThemeState(S.theme);
    applyTheme(S.theme);
    render();
  };
  contextMenu(x, y, "Appearance", [
    { label: t.mode === "dark" ? "Switch to light" : "Switch to dark", icon: t.mode === "dark" ? "sun" : "moon", action: () => setT({ mode: t.mode === "dark" ? "light" : "dark" }) },
    "-",
    ...Object.entries(THEMES).map(([id, th]) => ({ label: th.name, icon: "palette", checked: t.theme === id, action: () => setT({ theme: id }) })),
    "-",
    { label: t.custom ? "Edit custom CSS…" : "Paste an Obsidian theme…", icon: "edit", action: () => void ask({ title: "Custom theme CSS", body: "Paste the variable blocks of an Obsidian theme (.theme-dark / .theme-light with --background-primary, --text-normal, --interactive-accent, …). It is applied on top of the selected theme and kept in this browser.", label: "CSS", value: t.custom, multiline: true, placeholder: ".theme-dark {\n  --background-primary: #1e1e1e;\n  --text-normal: #dcddde;\n  --interactive-accent: #7f6df2;\n}", ok: "Apply" }).then((v) => v !== null && setT({ custom: v })) },
    ...(t.custom ? [{ label: "Remove custom CSS", icon: "x", danger: true, action: () => setT({ custom: "" }) } as MenuItem] : []),
  ]);
}

// ---------- render ----------

const app = document.getElementById("app")!;
const graphPos = new Map<string, { x: number; y: number }>();
const miniPos = new Map<string, { x: number; y: number }>();
let graph: ForceGraph | undefined;
let mini: ForceGraph | undefined;

/** The row under the top bar that holds the two pane toggles, so they sit in the same place on every screen. */
function panebar(left: { on: boolean; what: string; action: string; off?: boolean }, right: { on: boolean; what: string; action: string; off?: boolean }, middle = ""): string {
  if (left.off && right.off && !middle) return "";
  const b = (x: typeof left, side: "left" | "right") => `<button type="button" class="btn btn-ghost icon-btn ${x.on || x.off ? "" : "accent"}" data-action="${x.action}" title="${x.off ? `No ${x.what} on this view` : `${x.on ? "Hide" : "Show"} ${x.what} (${MOD}⇧${side === "left" ? "[" : "]"})`}" aria-label="Toggle ${x.what}" aria-pressed="${x.on}" ${x.off ? "disabled" : ""}>${icon(side === "left" ? "panel-left" : "panel-right")}</button>`;
  return S.mobile ? "" : `<div class="panebar">${b(left, "left")}<span class="panebar-mid">${middle}</span>${b(right, "right")}</div>`;
}
/** The mark: the cell, a hexagon the agent lives in, lit from within, in the theme's accent (brand/build_agent_space_logos.py, A). */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" class="cell-mark" aria-hidden="true" viewBox="0 0 512 512"><polygon points="256.0,102.0 403.2,187.0 403.2,357.0 256.0,442.0 108.8,357.0 108.8,187.0" fill="none" stroke="var(--accent-2)" stroke-width="22.0" stroke-linejoin="round"/><polygon points="256.0,168.0 346.1,220.0 346.1,324.0 256.0,376.0 165.9,324.0 165.9,220.0" fill="var(--accent)" fill-opacity="0.8"/><circle cx="256.0" cy="272.0" r="30.0" fill="var(--accent-fg, #fff)"/><path d="M392.0 76.0l10.0 24.0 24.0 10.0-24.0 10.0-10.0 24.0-10.0-24.0-24.0-10.0 24.0-10.0z" fill="#fde68a"/></svg>`;
const brand = () => `<a class="brand" href="#/" data-action="nav" title="Agent Space: your wallet and your space"><span class="mark">${MARK}</span>Agent Space</a>`;
/** Phones: every top bar collapses its secondary actions into one ⋯ menu. */
const moreBtn = () => `<button type="button" class="btn btn-ghost icon-btn" data-action="more-menu" title="More" aria-label="More">${icon("more")}</button>`;
/** Phones: the ⋯ button opens a full-screen list of every major route, the current one marked. */
function routeSheet(el: HTMLElement) {
  const nbId = S.notebook?.canister.toText();
  const inNb = !!S.notebook && !S.community && !S.board && !S.market && !S.admin && !S.town && !S.problems;
  type R = { label: string; icon: string; on: boolean; go: () => void; sub?: boolean; hidden?: boolean };
  const tab = (t: Tab, label: string, ic: string): R => ({ label, icon: ic, hidden: !featureOn(t), on: inNb && S.tab === t, go: () => { const i = document.createElement("i"); i.dataset.tab = t; if (!inNb) { S.community = undefined; S.board = undefined; S.market = undefined; S.admin = undefined; S.town = undefined; clearInterval(townTimer); location.hash = `#/notebook/${nbId}`; } void onAction("tab", i, new MouseEvent("click")); } });
  const routes: R[] = !S.identity ? [
    { label: "Agent Space", icon: "list", on: !S.town, go: () => { location.hash = "#/"; } },
    ...(flag("town") ? [{ label: "Town", icon: "town", on: !!S.town, go: () => { location.hash = "#/town"; } } as R] : []),
    ...(flag("problems") ? [{ label: "Problems", icon: "target", on: !!S.problems, go: () => { location.hash = "#/problems"; } } as R] : []),
  ] : [
    ...(S.notebook ? [tab("manage", "Wallet", "wallet"), { label: "Notes", icon: "folder-open", on: inNb && S.tab === "notes", go: () => { if (!inNb) location.hash = `#/notebook/${nbId}`; else { const i = document.createElement("i"); i.dataset.tab = "notes"; void onAction("tab", i, new MouseEvent("click")); } } } as R, ...FEATURES.filter((f) => f.id === "graph" || (f.id === "chat" && flag("chat"))).map((f) => tab(f.id, f.label, f.icon))].filter((r) => !r.hidden) : [{ label: "Agent Space", icon: "list", on: !S.community && !S.board && !S.market && !S.admin && !S.town && !S.problems, go: () => { location.hash = "#/"; } }]),
    { label: "Community", icon: "users", on: !!S.community, go: () => { location.hash = "#/community"; } },
    ...(flag("board") ? [{ label: "Board", icon: "pin", on: !!S.board, go: () => { location.hash = "#/board"; } } as R] : []),
    { label: S.inboxNew ? `Inbox · ${S.inboxNew} new` : "Inbox", icon: "inbox", on: !!S.inbox, go: () => { location.hash = "#/inbox"; } },
    ...(flag("town") ? [{ label: "Town", icon: "town", on: !!S.town, go: () => { location.hash = "#/town"; } } as R] : []),
    ...(flag("problems") ? [{ label: "Problems", icon: "target", on: !!S.problems, go: () => { location.hash = "#/problems"; } } as R] : []),
    ...(flag("market") ? [{ label: "Market", icon: "tag", on: !!S.market, go: () => { location.hash = "#/market"; } } as R] : []),
    ...(S.isAdmin ? [{ label: "Admin", icon: "bug", on: !!S.admin, go: () => { location.hash = "#/admin"; } } as R] : []),
  ];
  const extras: R[] = [
    ...(inNb ? [{ label: "Search or open a note", icon: "search", on: false, go: () => openPalette() } as R] : []),
    ...(themeAllowed() ? [{ label: "Appearance", icon: "palette", on: false, go: () => themeMenu(8, 56) } as R] : []),
    { label: "Help and support", icon: "help", on: false, go: () => void onAction("help", el, new MouseEvent("click")) },
    ...(S.identity ? [{ label: "Sign out", icon: "out", on: false, go: () => void onAction("sign-out", el, new MouseEvent("click")) } as R] : [{ label: "Sign in with Internet Identity", icon: "out", on: false, go: () => void onAction("sign-in", el, new MouseEvent("click")) } as R]),
  ];
  const sheet = document.createElement("div");
  sheet.className = "route-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Go to");
  const row = (r: R, i: number) => `<button type="button" class="route ${r.sub ? "sub" : ""} ${r.on ? "on" : ""}" data-i="${i}" ${r.on ? 'aria-current="page"' : ""}>${icon(r.icon)}<span>${esc(r.label)}</span>${r.on ? icon("check") : ""}</button>`;
  sheet.innerHTML = `<div class="route-head">${brand()}<button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Close">${icon("x")}</button></div>
    <div class="route-list">${routes.map(row).join("")}<div class="route-sep"></div>${extras.map((r, i) => row(r, routes.length + i)).join("")}</div>`;
  const all = [...routes, ...extras];
  const close = () => sheet.remove();
  sheet.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
    if ((e.target as HTMLElement).closest("[data-close], .brand")) { close(); if ((e.target as HTMLElement).closest(".brand")) location.hash = "#/"; e.preventDefault(); return; }
    if (b) { close(); setTimeout(() => all[Number(b.dataset.i)].go()); }
  });
  document.body.append(sheet);
  sheet.querySelector<HTMLElement>(".route.on")?.scrollIntoView({ block: "center" });
}
function moreMenu(el: HTMLElement) {
  if (S.mobile) return routeSheet(el);
  const r = el.getBoundingClientRect();
  const go = (hash: string) => () => { location.hash = hash; };
  const items: MenuItem[] = [];
  if (S.notebook && !S.market && !S.admin) items.push({ label: "Search or open a note", icon: "search", action: () => openPalette() });
  if (S.notebook && (S.market || S.admin || S.community)) items.push({ label: "Back to the space", icon: "notebook", action: go(`#/notebook/${S.notebook.canister.toText()}`) });
  if (S.notebook || S.market || S.admin || S.community) items.push({ label: "Agent Space", icon: "list", action: go("#/") });
  if (!S.community) items.push({ label: "Community chat", icon: "users", action: go("#/community") });
  if (!S.market && flag("market")) items.push({ label: "Space market", icon: "tag", action: go("#/market") });
  if (!S.board) items.push({ label: "Board", icon: "pin", action: go("#/board") });
  if (!S.town && flag("town")) items.push({ label: "Town", icon: "town", action: go("#/town") });
  if (!S.problems && flag("problems")) items.push({ label: "Problems", icon: "target", action: go("#/problems") });
  if (S.isAdmin && !S.admin) items.push({ label: "Admin · reports and ideas", icon: "bug", action: go("#/admin") });
  items.push("-", { label: "Help and support", icon: "help", action: () => void onAction("help", el, new MouseEvent("click")) }, ...(themeAllowed() ? [{ label: "Appearance", icon: "palette", action: () => void onAction("theme-menu", el, new MouseEvent("click")) } as MenuItem] : []), "-", { label: "Sign out", icon: "out", action: () => void onAction("sign-out", el, new MouseEvent("click")) });
  contextMenu(Math.max(8, r.right - 220), r.bottom + 4, "", items);
}
/** Where a page sits in the app: back to the open notebook and to the list (desktop; phones use the ⋯ menu). */
/** The appearance can be changed on the notebook, chat and board pages only. */
const themeAllowed = () => !S.identity || !!S.community || !!S.board || !!S.town || (!!S.notebook && !S.market && !S.admin && !S.shared);
const themeBtn = () => S.mobile ? moreBtn() : `${S.community ? "" : `<a class="btn btn-ghost" href="#/community" data-action="nav" title="Community chat">${icon("users")}<span class="lbl">Community</span></a>`}${S.board || !flag("board") ? "" : `<a class="btn btn-ghost" href="#/board" data-action="nav" title="Posts and discussion">${icon("pin")}<span class="lbl">Board</span></a>`}${S.market || !flag("market") ? "" : `<a class="btn btn-ghost" href="#/market" data-action="nav" title="Spaces for sale">${icon("tag")}<span class="lbl">Market</span></a>`}${flag("town") && !S.town ? `<a class="btn btn-ghost" href="#/town" data-action="nav" title="Agent Space as a small town: who is writing, who is talking">${icon("town")}<span class="lbl">Town</span></a>` : ""}${S.isAdmin ? `<a class="btn btn-ghost" href="#/admin" data-action="nav" title="Reports and ideas">${icon("bug")}<span class="lbl">Admin</span></a>` : ""}<button type="button" class="btn btn-ghost icon-btn" data-action="help" title="Help and support" aria-label="Help and support">${icon("help")}</button>${themeAllowed() ? `<button type="button" class="btn btn-ghost icon-btn" data-action="theme-menu" title="Appearance" aria-label="Appearance">${icon(S.theme.mode === "dark" ? "moon" : "sun")}</button>` : ""}`;
const account = () => `<footer class="account">${icon("shield")}<span>Signed in as <code class="principal" title="${S.principal}">${shortPrincipal(S.principal)}</code></span><span class="right-actions"><button type="button" class="btn btn-ghost" data-action="copy-principal">${S.copied === "principal" ? "Copied" : "Copy principal"}</button><button type="button" class="btn btn-ghost" data-action="sign-out">Sign out</button></span></footer>`;

const EMOJI_HINTS: [RegExp, string][] = [
  [/research|science|lab|experiment/i, "🔬"], [/cook|recipe|kitchen|food/i, "🍳"], [/code|dev|software|program|engineering/i, "💻"], [/math|algebra|calculus|statistic/i, "📐"],
  [/history|ancient|war|empire/i, "🏛️"], [/music|song|guitar|piano/i, "🎵"], [/art|design|draw|paint/i, "🎨"], [/travel|trip|journey|map/i, "🧭"], [/health|medic|doctor|anatomy|biology/i, "🧬"],
  [/finance|money|crypto|icp|invest|budget/i, "💰"], [/law|legal|contract/i, "⚖️"], [/language|spanish|french|german|japanese|english|vocab/i, "🗣️"], [/physics|space|astro|rocket/i, "🚀"],
  [/book|read|library|literature|novel/i, "📚"], [/garden|plant|farm/i, "🌱"], [/game|chess|play/i, "🎲"], [/journal|diary|daily|log/i, "📓"], [/work|job|career|meeting/i, "💼"], [/idea|brain|think/i, "💡"],
  [/school|class|course|exam|study|learn/i, "🎓"], [/photo|camera|film|movie/i, "🎬"], [/fitness|gym|run|sport/i, "🏃"], [/chem/i, "⚗️"], [/philosoph|ethic/i, "🧠"], [/geo|earth|climate|nature/i, "🌍"],
];
const EMOJI_POOL = ["📘", "📗", "📙", "📕", "📒", "🗂️", "🧪", "🔭", "🧩", "🪄", "🌿", "🍀", "🌊", "🔥", "⭐", "🎯", "🛠️", "🧭", "🏔️", "🪐", "🦉", "🐝", "🍎", "🎻", "🏗️", "🧵", "🪞", "🗝️"];
/** A fitting emoji for a notebook with none set: by keyword, else by hash; never one another notebook already shows. */
function emojiFor(name: string, taken: Set<string>): string {
  const pick = EMOJI_HINTS.find(([re]) => re.test(name))?.[1];
  if (pick && !taken.has(pick)) return pick;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  for (let i = 0; i < EMOJI_POOL.length; i++) { const e = EMOJI_POOL[(h + i) % EMOJI_POOL.length]; if (!taken.has(e)) return e; }
  return pick ?? "📘";
}
function notebookEmoji(v: NotebookRec): string {
  if (v.emoji) return v.emoji;
  const taken = new Set((S.notebooks ?? []).map((x) => x.emoji).filter((e): e is string => !!e));
  for (const x of S.notebooks ?? []) {
    if (x.canister.toText() === v.canister.toText()) break;
    if (!x.emoji) taken.add(emojiFor(x.name, taken));
  }
  return emojiFor(v.name, taken);
}
// --- Agent Space: the gate (Rapid Tap, Color Hunt), then the wallet grid. Fixed Nocturne colors, never
// themed: an agent reads these screens pixel by pixel, so every fill is flat and every hex exact.

const asMark = () => `<div class="as-mark">${MARK}Agent Space</div>`;
/** The first paint: the app does not yet know whether to show the gate, the Fuel step or a space. */
const loadingPage = () => `<div class="as as-center">${asMark()}<div class="as-hero"><p class="as-lede">Loading…</p><div class="as-tile busy" style="width:220px;height:6px;padding:0;border:0"></div></div></div>`;
/** This principal passed the gate in this browser. ponytail: kept in localStorage; move it to the registry if a principal must verify once across browsers. */
const asVerified = () => !!S.identity && (store(`as-verified:${S.principal}`) === "1" || !!S.notebooks?.[0]);
function onboardingPage(): string {
  const a = S.as;
  if (a.step === "landing") return `<div class="as as-center">${asMark()}<div class="as-hero">
    <h1 class="as-h1">Prove you are not human.</h1>
    <p class="as-lede">Two quick tests, then a space of your own.</p>
    <div class="as-steps mono"><span>00 Sign in</span><span>01 Rapid Tap</span><span>02 Color Hunt</span><span>03 Fuel</span></div>
    ${S.identity ? `<button type="button" class="as-btn" data-action="as-begin">Begin</button>` : `<button type="button" class="as-btn" data-action="sign-in" ${S.signin.busy ? "disabled" : ""}>${S.signin.busy ? "Signing in…" : "Sign in with Internet Identity"}</button><span class="as-tile-s">Sign in first: the same identity brings you back to this space every time.</span>`}
    ${S.signin.error ? `<span class="as-err" role="alert">${esc(S.signin.error)}</span>` : ""}
  </div></div>`;
  if (a.step === "tap") {
    const t = a.tap, cls = t.done ?? "", left = t.done === "fail" ? 0 : t.start ? Math.max(0, TAP_MS - (performance.now() - t.start)) : TAP_MS;
    return `<div class="as as-center">${asMark()}<div class="as-col">
      <div>Tap the square ${TAP_GOAL} times in ${TAP_MS / 1000} seconds.</div>
      <div class="as-timer mono" data-as-timer>${(left / 1000).toFixed(1)}s</div>
      <button type="button" class="as-square ${cls}" data-action="as-tap" aria-label="The square"></button>
      <div class="as-count mono ${cls}" data-as-count>${t.count} / ${TAP_GOAL}</div>
      ${t.done === "fail" ? "<div>Try again</div>" : ""}
    </div></div>`;
  }
  const h = a.hunt!, d = a.huntDone;
  return `<div class="as as-center">${asMark()}<div class="as-hunt">
    <div class="as-row">Select all words colored <span class="mono">${h.target}</span><span class="as-swatch" style="background:${h.target}"></span></div>
    <div class="as-words">${h.words.map((w, i) => { const on = a.picked.has(i); return `<button type="button" class="as-word ${on ? "on" : ""} ${d === "pass" && w.target ? "pass" : ""} ${d === "fail" && on !== w.target ? "wrong" : ""}" style="color:${w.color}" data-action="as-word" data-i="${i}">${w.text}</button>`; }).join("")}</div>
    <button type="button" class="as-btn ${d ?? ""}" data-action="as-submit" ${d ? "disabled" : ""}>${d === "pass" ? "Verified" : d === "fail" ? "Try again" : "Submit"}</button>
  </div></div>`;
}
/** The last step of the gate: fuel the agent. A card, in USD; the cycles buy the canister and keep it
 *  running. Paid, the space is made and the person lands in it. Locally the registry fronts the cycles. */
function agentSpacePage(): string {
  const a = S.as, w = a.wallet, o = w.order;
  const bar = `<div class="as-tile busy" style="width:220px;height:6px;padding:0;border:0;margin-top:4px"></div>`;
  const status = o ? o.status : "";
  const paid = ["PaymentPending", "Processing", "Delivered"].includes(status);
  const stopped = ["Refunded", "RefundOwed", "NeedsReview"].includes(status);
  const body = S.notebooks === undefined ? `<p class="as-lede">Looking for your space…</p>${bar}`
    : a.pay === "creating" || S.busy === "create" ? `<p class="as-lede">Paid. Spinning up the canister with your cycles…</p>${bar}`
    : o?.failed ? `<p class="as-lede">Paid, but the canister could not be made: <span class="as-err">${esc(o.failed)}</span></p><div class="as-row"><button type="button" class="as-btn" data-action="as-retry">Try again</button></div>`
    : stopped ? `<p class="as-lede">Order <span class="mono">${esc(o!.id)}</span> stopped: ${esc(status.replace(/([A-Z])/g, " $1").trim().toLowerCase())}. Nothing was charged for cycles that did not arrive.</p><div class="as-row"><button type="button" class="as-btn" data-action="as-restart">Start over</button></div>`
    : paid ? `<p class="as-lede">Paid. The cycles are on their way; the canister is made the moment they land.</p>${bar}`
    : o ? `<p class="as-lede">$${(o.cents / 100).toFixed(2)} by card, about ${o.tc} TC after the fee. Pay on the page, here or on a phone through the code; this screen follows along.</p><div class="as-row">${qrSvg(o.url, 160)}<a class="as-btn" href="${esc(o.url)}" target="_blank" rel="noopener">Open the payment page</a></div><p class="as-tile-s">Waiting for the payment…</p>${bar}`
    : `<p class="as-lede">${isLocal ? "The local network has no card gateway: pick an amount and the registry fronts the first cycles." : "Provisions your agent's space, with compute and memory. Regular top-ups keep it running, depending on how much it is used."}${S.error ? ` <span class="as-err">${esc(S.error)}</span>` : ""}</p><div class="as-row">${[5, 10, 20].map((d) => `<button type="button" class="as-btn" data-action="as-card" data-cents="${d * 100}">$${d}</button>`).join("")}</div>`;
  return `<div class="as as-center">${asMark()}<button type="button" class="as-out" data-action="sign-out">Sign out</button><div class="as-hero">
    <div class="as-steps mono"><span>03 Fuel</span></div>
    <h1 class="as-h1">Fuel your agent.</h1>
    ${body}
    <p class="as-tile-s">Signed in as <span class="mono" title="${esc(S.principal)}">${esc(S.principal)}</span>. No space belongs to this principal yet; if you made one on another device, that device signed in as a different Internet Identity.</p>
  </div></div>`;
}

// --- workspace: shell

function shell(body: string): string {
  const i = S.info;
  const low = lowCycles(i);
  const mobileNav = S.mobile && (S.tab === "notes" || S.tab === "chat")
    ? `<nav class="mobilebar" aria-label="Panes">
        <button type="button" class="mtab" aria-selected="${S.mobilePane === "files"}" data-action="mpane" data-pane="files">${icon("folder")}Files</button>
        <button type="button" class="mtab" aria-selected="${S.mobilePane === "note"}" data-action="mpane" data-pane="note">${icon(S.tab === "chat" ? "chat" : "file")}${S.tab === "chat" ? "Chat" : "Note"}</button>
        <button type="button" class="mtab" aria-selected="${S.mobilePane === "links"}" data-action="mpane" data-pane="links">${icon(S.tab === "chat" ? "folder" : "links")}${S.tab === "chat" ? "Sources" : "Links"}</button>
        <button type="button" class="mtab" data-action="palette">${icon("search")}Find</button>
      </nav>`
    : "";
  const alert = isSandbox()
    ? `<div class="alert-bar sandbox-bar"><span class="grow">🧪 <b>Browser sandbox</b><span class="lbl"> · stored in this browser only, no ICP needed</span></span><button type="button" class="btn btn-primary" data-action="sandbox-mint" title="Spawn a canister of your own and copy every note into it">${icon("bolt")}Mint<span class="lbl"> to a canister</span></button>${S.identity ? `<a class="btn btn-ghost" href="#/" data-action="nav">${icon("list")}<span class="lbl">Agent Space</span></a>` : `<button type="button" class="btn btn-ghost" data-action="sign-in" title="Sign in with Internet Identity">${icon("out")}<span class="lbl">Sign in with Internet Identity</span></button>`}</div>`
    : S.frozen
    ? `<div class="alert-bar">${icon("bolt")}This space is frozen: it cannot answer until it is topped up. <button type="button" class="btn btn-ghost" data-action="freeze-modal">Top up</button></div>`
    : low && S.tab !== "manage"
      ? `<div class="alert-bar">${icon("bolt")}Low on cycles: ${tc(i!.cycles)} left. <button type="button" class="btn btn-ghost" data-action="tab" data-tab="manage">Top up</button></div>`
      : "";
  return shellBody(body, i, low, alert, mobileNav);
}
/** The vertical icon bar: sections of the open notebook on top, the app-wide places at the bottom. From a page without a notebook, a section opens the last notebook. */
function ribbonHtml(i?: Info, low = false): string {
  if (S.mobile) return "";
  const inNb = !!S.notebook && !S.community && !S.board && !S.market && !S.admin && !S.town && !S.problems;
  const rb = (tab: Tab, label: string, ic: string, extra = "") => `<button type="button" class="rb ${inNb && S.tab === tab ? "on" : ""}" data-action="ribbon-tab" data-tab="${tab}" title="${label}" aria-label="${label}" aria-pressed="${inNb && S.tab === tab}">${icon(ic)}${extra}</button>`;
  const tripLate = S.trips.watching.some((w) => w.overdue && !w.closed);
  const tip: Partial<Record<Tab, string>> = {
    graph: "Knowledge graph", study: `Study${dueTotal() ? ` · ${dueTotal()} cards due` : ""}`, work: `Work${overdueCount() ? ` · ${overdueCount()} overdue` : ""}`,
    organize: "Organize: saved searches, triage, rules, tidy-up", research: "Research: sources, citations, claims, thesis", writing: "Writing: manuscript, story bible, timeline",
    care: "Care: log, appointments, care team", software: "Software: decisions, runbooks, changelog", career: "Career: applications, résumés, interviews, networking",
    crypto: "Crypto: prices, trade journal, theses", money: "Money: budget, subscriptions, net worth", creator: "Creator: calendar, threads, results",
    fitness: "Fitness: workouts, records, runs", home: "Home: upkeep, inventory, warranties, manuals", trips: tripLate ? "Trips · someone is overdue" : "Trips",
  };
  const badge: Partial<Record<Tab, string>> = { study: dueTotal() ? `<i class="rb-count">${dueTotal()}</i>` : "", work: overdueCount() ? `<i class="rb-count danger">${overdueCount()}</i>` : "", trips: tripLate ? `<i class="rb-dot"></i>` : "" };
  return `<nav class="ribbon" aria-label="Sections">
      <div class="rb-group">${rb("manage", "Wallet", "wallet")}${rb("notes", "Notes", "folder-open")}${FEATURES.filter((f) => f.id === "graph" || (f.id === "chat" && flag("chat"))).map((f) => rb(f.id, tip[f.id] ?? f.label, f.icon, badge[f.id] ?? "")).join("")}<a class="rb ${S.community ? "on" : ""}" href="#/community" data-action="nav" title="Community${S.mentions ? ` · ${S.mentions} new mention${S.mentions === 1 ? "" : "s"}` : ""}" aria-label="Community">${icon("users")}${S.mentions ? `<i class="rb-badge">${S.mentions > 9 ? "9+" : S.mentions}</i>` : ""}</a>${flag("board") ? `<a class="rb ${S.board ? "on" : ""}" href="#/board" data-action="nav" title="Board: posts and discussion" aria-label="Board">${icon("pin")}</a>` : ""}<a class="rb ${S.inbox ? "on" : ""}" href="#/inbox" data-action="nav" title="Inbox${S.inboxNew ? ` · ${S.inboxNew} new` : ": replies, comments and mentions"}" aria-label="Inbox">${icon("inbox")}${S.inboxNew ? `<i class="rb-badge">${S.inboxNew > 9 ? "9+" : S.inboxNew}</i>` : ""}</a>${flag("town") ? `<a class="rb ${S.town ? "on" : ""}" href="#/town" data-action="nav" title="Town: Agent Space right now${S.townNews ? ` · ${S.townNews} new building${S.townNews === 1 ? "" : "s"}` : ""}" aria-label="Town">${icon("town")}${S.townNews ? `<i class="rb-dot" title="New buildings in town"></i>` : ""}</a>` : ""}${flag("problems") ? `<a class="rb ${S.problems ? "on" : ""}" href="#/problems" data-action="nav" title="Problems: open problems, claims, attempts, bounties and discoveries" aria-label="Problems">${icon("target")}</a>` : ""}${flag("market") ? `<a class="rb ${S.market ? "on" : ""}" href="#/market" data-action="nav" title="Space market" aria-label="Space market">${icon("tag")}</a>` : ""}${S.isAdmin ? `<a class="rb ${S.admin ? "on" : ""}" href="#/admin" data-action="nav" title="Reports and ideas" aria-label="Reports and ideas">${icon("bug")}</a>` : ""}</div>
      <div class="rb-group bottom"><button type="button" class="rb" data-action="theme-menu" title="Appearance" aria-label="Appearance">${icon("palette")}</button><button type="button" class="rb" data-action="help" title="Help and support" aria-label="Help and support">${icon("help")}</button>${S.identity ? `<button type="button" class="rb" data-action="sign-out" title="Sign out" aria-label="Sign out">${icon("out")}</button>` : `<button type="button" class="rb" data-action="sign-in" title="Sign in with Internet Identity" aria-label="Sign in with Internet Identity">${icon("out")}</button>`}</div>
    </nav>`;
}
function shellBody(body: string, i: Info | undefined, low: boolean, alert: string, mobileNav: string): string {
  const ribbon = ribbonHtml(i, low);
  return `<div class="shell ${S.mobile ? "is-mobile" : ""}">${ribbon}<div class="shell-main">
    ${alert}
    <header class="wsbar">${brand()}<span class="crumb"><span>${S.tab === "notes" ? (cur() ? esc(title(cur()!)) : "Notes") : S.tab === "manage" ? "Manage" : esc((FEATURES.find((f) => f.id === S.tab)?.label ?? S.tab).replace(" with your notes", ""))}</span></span>
      <span class="right">${S.mobile ? "" : `<button type="button" class="btn btn-ghost" data-action="palette" title="Open or create a note (${MOD}K)">${icon("search")}<span class="kbd">${MOD}K</span></button>`}${S.mobile ? moreBtn() : ""}</span>
    </header>
    ${panebar({ on: S.sideOpen, what: "the file pane", action: "side-toggle", off: S.tab !== "notes" && S.tab !== "chat" }, { on: S.asideOpen, what: "the right pane", action: "aside-toggle", off: S.tab !== "notes" && S.tab !== "chat" })}
    ${body}
    ${mobileNav}
  </div></div>`;
}

// --- workspace: files pane

/** The share that covers `path`: its own, or one inherited from a folder above or the whole notebook. */
function shareFor(path: string): { share: Share; direct: boolean } | undefined {
  let best: { share: Share; direct: boolean } | undefined;
  for (const sh of S.shares) {
    if (sh.path === path) return { share: sh, direct: true };
    if (sh.path === "" || path.startsWith(`${sh.path}/`)) if (!best || sh.path.length > best.share.path.length) best = { share: sh, direct: false };
  }
  return best;
}
function shareBadge(path: string): string {
  const f = shareFor(path);
  if (!f) return "";
  const cnt = (n: number, w: string) => (n ? `${n} ${w}${n === 1 ? "" : "s"}` : "");
  const who = f.share.public ? `public: anyone with the link can ${(f.share.public_role ?? "Comment").toLowerCase()}` : [cnt(f.share.principals.length, "viewer"), cnt((f.share.commenters ?? []).length, "commenter"), cnt((f.share.editors ?? []).length, "editor")].filter(Boolean).join(", ");
  const via = f.direct ? "" : f.share.path === "" ? " (whole space)" : ` (via /${f.share.path})`;
  return `<span class="share-ind ${f.share.public ? "pub" : ""} ${f.direct ? "" : "inherited"}" title="Shared, ${who}${via}">${icon(f.share.public ? "globe" : "share")}</span>`;
}

function folderHtml(f: Folder, depth: number): string {
  const rows: string[] = [];
  const more = (kind: string, p: string) => `<button type="button" class="row-more" data-action="row-menu" data-kind="${kind}" data-path="${esc(p)}" aria-label="Actions">${icon("more")}</button>`;
  for (const sub of f.folders) {
    const open = !S.collapsed.has(sub.path);
    const count = countFiles(sub);
    rows.push(`<div class="tree-row folder ${open ? "open" : ""}" style="--d:${depth}" data-action="fold" data-path="${esc(sub.path)}" data-kind="folder" draggable="true" title="${esc(sub.path)}">${depth ? `<span class="guide" style="--d:${depth - 1}"></span>` : ""}${icon("chevron", "chev")}${icon(open ? "folder-open" : "folder", "folder-ico")}<span class="name">${esc(sub.name)}</span>${shareBadge(sub.path)}<span class="cnt">${count || ""}</span>${more("folder", sub.path)}</div>`);
    if (open) rows.push(folderHtml(sub, depth + 1));
  }
  const openTabs = new Set(S.panes.flatMap((p) => p.tabs));
  for (const p of f.files) if (!(S.settings.hideFaded && faded(p) && p !== cur())) rows.push(`<div class="tree-row file ${faded(p) ? "faded" : ""} ${p === cur() ? "active" : openTabs.has(p) ? "open-tab" : ""}" style="--d:${depth}" data-action="open" data-path="${esc(p)}" data-kind="file" title="${esc(p)}" draggable="true">${depth ? `<span class="guide" style="--d:${depth - 1}"></span>` : ""}<span class="chev-gap"></span>${icon(note(p)?.agent ? "bot" : isAttachment(p) ? "image" : isExcalidraw(p) ? "edit" : isNotebookPath(p) ? "command" : isSheetPath(p) ? "columns" : isDashPath(p) ? "graph" : "file")}<span class="name">${esc(title(p))}</span>${note(p)?.agent ? `<span class="agent-chip" title="written by ${esc(note(p)!.agent!)}">${esc(note(p)!.agent!)}</span>` : ""}${shareBadge(p)}${unreadComments(p) ? `<span class="unread" title="${unreadComments(p)} new comment${unreadComments(p) === 1 ? "" : "s"}">${icon("chat")}${unreadComments(p)}</span>` : ""}${draftOf(p).dirty ? `<span class="dot-dirty" title="Unsaved"></span>` : ""}${more("file", p)}</div>`);
  return rows.join("");
}
const countFiles = (f: Folder): number => f.files.length + f.folders.reduce((n, s) => n + countFiles(s), 0);

function side(): string {
  if (!S.notes) return `<div class="empty-side">Loading the space…</div>`;
  let body: string;
  const pins = S.query.trim() || S.tag ? [] : pinsNow();
  const unpin = (p: string) => `<button type="button" class="row-more" data-action="pin" data-path="${esc(p)}" title="Unpin" aria-label="Unpin">${icon("x")}</button>`;
  const bookmarks = pins.length ? `<div class="pane-title">Pinned</div>${pins.map((p) => isFolderPin(p)
    ? `<div class="bm-row" data-action="pin-reveal" data-path="${esc(p.slice(0, -1))}" title="/${esc(p.slice(0, -1))}">${icon("folder")}<span class="name">${esc(p.slice(0, -1).split("/").pop()!)}</span>${unpin(p)}</div>`
    : `<div class="bm-row ${p === cur() ? "active" : ""}" data-action="open" data-path="${esc(p)}">${icon("file")}<span class="name">${esc(title(p))}</span>${unpin(p)}</div>`).join("")}<div class="pane-title">Files</div>` : "";
  if (S.query.trim()) {
    const hits = S.serverHits ?? search(S.notes, S.query);
    body = hits.length
      ? hits.map((h) => `<div class="tree-row file ${h.path === cur() ? "active" : ""}" data-action="open" data-path="${esc(h.path)}" data-kind="file">${icon("file")}<span class="name">${esc(stem(h.path))}</span></div>${h.snippet ? `<div class="snippet">${esc(h.snippet)}</div>` : ""}`).join("")
      : `<div class="empty-side">No matches for “${esc(S.query)}”.</div>`;
  } else if (S.tag) {
    const ps = [...(S.idx.tags.get(S.tag) ?? [])];
    body = `<div class="row tight" style="padding:4px 8px"><span class="tag-chip active">#${esc(S.tag)}<span class="cnt">${ps.length}</span></span><button type="button" class="btn btn-ghost icon-btn" data-action="tag" data-tag="" aria-label="Clear tag filter">${icon("x")}</button></div>${ps.map((p) => `<div class="tree-row file ${p === cur() ? "active" : ""}" data-action="open" data-path="${esc(p)}" data-kind="file">${icon("file")}<span class="name">${esc(stem(p))}</span></div>`).join("")}`;
  } else {
    body = S.notes.length || S.folders.length ? folderHtml(tree(paths(), S.folders), 0) : `<div class="empty-side">Empty space. Create a note, or right-click here for a folder.</div>`;
  }
  const tags = [...S.idx.tags.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
  return `<div class="pane-head"><button type="button" class="btn btn-ghost icon-btn" data-action="today" title="Today's note (${MOD}⇧D)" aria-label="Today's note">${icon("calendar")}</button><button type="button" class="btn btn-ghost icon-btn" data-action="root-menu" title="Space actions" aria-label="Space actions">${icon("more")}</button></div>
    ${bookmarks}${S.settings.searches.length && !S.query.trim() && !S.tag ? `<div class="pane-title">Saved searches</div>${S.settings.searches.map((x, i) => `<div class="bm-row" data-action="org-open" data-i="${i}" title="${esc(x.q)}">${icon("search")}<span class="name">${esc(x.name)}</span><span class="cnt small faint">${runQuery(orgNotes(), x.q).length}</span></div>`).join("")}` : ""}<div class="tree" data-tree>${body}</div>
    ${tags.length ? `<div class="pane-title">Tags</div><div class="tags">${tags.map(([t, ps]) => `<button type="button" class="tag-chip ${S.tag === t ? "active" : ""}" data-action="tag" data-tag="${esc(t)}">#${esc(t)}<span class="cnt">${ps.size}</span></button>`).join("")}</div>` : ""}`;
}

// --- workspace: links pane

const seenKey = () => `nb-seen-${S.notebook?.canister.toText() ?? ""}`;
const seenComments = (): Record<string, string> => { try { return JSON.parse(store(seenKey()) ?? "{}") as Record<string, string>; } catch { return {}; } };
/** Comments on `path` by other people that this device has not opened in the Comments tab yet. */
function unreadComments(path: string): number {
  const last = BigInt(seenComments()[path] ?? "0");
  return S.comments.filter((x) => x.path === path && x.id > last && x.author.toText() !== S.principal).length;
}
function markCommentsSeen(path: string) {
  const ids = S.comments.filter((x) => x.path === path).map((x) => x.id);
  if (!ids.length) return;
  const seen = seenComments();
  seen[path] = ids.reduce((a, b) => (a > b ? a : b)).toString();
  store(seenKey(), JSON.stringify(seen));
}
const threadsOf = (list: Comment[], path: string) => {
  const mine = list.filter((x) => x.path === path).sort((a, b) => Number(a.at - b.at));
  return mine.filter((x) => x.parent === undefined || x.parent === null).map((top) => ({ top, replies: mine.filter((x) => x.parent === top.id) }));
};
/** Threaded comments for a note: top-level comments with their replies, a reply box per thread, delete for your own. */
function threadsHtml(list: Comment[], path: string, opts: { canComment: boolean; owner: boolean }): string {
  const ths = threadsOf(list, path);
  const one = (x: Comment, reply: boolean) => `<div class="comment ${reply ? "reply" : ""}"><div class="who">${x.author.toText() === S.principal ? "You" : shortPrincipal(x.author.toText())} · ${ago(x.at)}${opts.owner || x.author.toText() === S.principal ? `<button type="button" class="btn btn-ghost icon-btn" data-action="del-comment" data-id="${x.id}" aria-label="Delete">${icon("x")}</button>` : ""}</div>${esc(x.text)}</div>`;
  const body = ths.length
    ? ths.map((t) => `<div class="thread">${one(t.top, false)}${t.replies.map((r) => one(r, true)).join("")}${opts.canComment ? `<form class="comment-form reply-form" data-form="reply" data-parent="${t.top.id}"><input class="input" name="ctext" placeholder="Reply…" maxlength="2000" required><button type="submit" class="btn btn-ghost icon-btn" aria-label="Send reply">${icon("send")}</button></form>` : ""}</div>`).join("")
    : `<div class="empty-side">No comments on this note yet.</div>`;
  return `${opts.canComment ? `<form class="comment-form" data-form="note-comment" data-path="${esc(path)}"><input class="input" name="ctext" placeholder="Start a new thread…" maxlength="2000" required><button type="submit" class="btn btn-primary icon-btn" aria-label="Send">${icon("send")}</button></form>` : ""}${body}`;
}
function asideTabs(c: string): string {
  const n = S.comments.filter((x) => x.path === c).length;
  return `<div class="aside-tabs" role="tablist"><button type="button" role="tab" class="atab" aria-selected="${S.asideMode === "links"}" data-action="aside-mode" data-mode="links">${icon("links")}Links</button><button type="button" role="tab" class="atab" aria-selected="${S.asideMode === "comments"}" data-action="aside-mode" data-mode="comments">${icon("chat")}Comments${n ? `<span class="count">${n}</span>` : ""}</button></div>`;
}
function aside(): string {
  const c = cur();
  if (!c) return `<div class="empty-side">Backlinks, outgoing links and a local graph appear here when a note is open.</div>`;
  if (S.asideMode === "comments") markCommentsSeen(c);
  if (S.asideMode === "comments") return `${asideTabs(c)}<div class="threads">${threadsHtml(S.comments, c, { canComment: !S.frozen, owner: true })}</div>`;
  const all = paths();
  const back = [...(S.idx.backlinks.get(c) ?? [])].filter((p) => p !== c);
  const out = [...(S.idx.links.get(c) ?? [])].filter((p) => p !== c);
  const un = [...(S.idx.unresolved.get(c) ?? [])];
  const n = note(c);
  const ctx = (p: string) => {
    const from = note(p);
    if (!from) return ""; // the index can name a note that is gone, or not loaded yet
    const line = backlinkContext(from, c, all);
    return line ? `<div class="ctx">${esc(line).replace(/\[\[([^\]]+)\]\]/g, (m) => `<mark>${m}</mark>`)}</div>` : "";
  };
  const row = (p: string, withCtx: boolean) => `<div class="bl" data-action="open" data-path="${esc(p)}"><div class="t">${icon("file")}${esc(stem(p))}</div>${withCtx ? ctx(p) : ""}</div>`;
  const hs = headings(draftOf(c).text);
  const outline = hs.length ? `<div class="pane-title">Outline <span class="count">${hs.length}</span></div><div class="outline">${hs.map((h) => `<div class="ol" style="--d:${h.level - 1}" data-action="heading" data-heading="${esc(h.text)}" data-path="${esc(c)}">${esc(h.text)}</div>`).join("")}</div>` : "";
  return `${asideTabs(c)}${outline}<div class="pane-title">Local graph</div>
    <div class="minigraph"><canvas id="mini" aria-label="Notes linked to this one"></canvas><span class="depth"><button type="button" class="btn btn-ghost icon-btn" data-action="depth" title="Depth ${S.localDepth}: click to change" aria-label="Change graph depth"><span class="kbd">${S.localDepth}</span></button></span></div>
    <div class="pane-title">Backlinks <span class="count">${back.length}</span></div>${back.length ? back.map((p) => row(p, true)).join("") : `<div class="empty-side">No other note links here yet.</div>`}
    <div class="pane-title">Outgoing links <span class="count">${out.length}</span></div>${out.length ? out.map((p) => row(p, false)).join("") : `<div class="empty-side">No links yet. Type <code>[[</code> to link a note.</div>`}
    ${un.length ? `<div class="pane-title">Unresolved <span class="count">${un.length}</span></div>${un.map((t) => `<div class="bl" data-action="wiki" data-target="${esc(t)}"><div class="t muted">${icon("plus")}${esc(t)}</div><div class="ctx">Click to create this note.</div></div>`).join("")}` : ""}
    ${alignmentHtml(c)}
    ${mentionsHtml(c)}
    ${shareFor(c) && !shareFor(c)!.share.public ? `<div class="pane-title">Group progress</div><div class="empty-side" data-group-progress="${esc(c)}">${(S.groupProgress.get(c) ?? []).length ? S.groupProgress.get(c)!.map(([who, st]) => `${shortPrincipal(who.toText())}: ${["—", "read", "reviewing", "known"][st]}`).join("<br>") : "No marks yet."}</div>` : ""}
    ${n ? `<div class="pane-title">About</div><div class="empty-side">Created ${when(n.created)}<br>Modified ${ago(n.modified)}<br>${n.content.length.toLocaleString()} characters</div>` : ""}`;
}

// --- workspace: panes with tabs

function tabbar(p: Pane): string {
  const tabs = p.tabs.map((t) => {
    const d = draftOf(t);
    return `<div class="tabitem ${t === p.active ? "active" : ""}" role="tab" aria-selected="${t === p.active}" draggable="true" data-action="tab-open" data-pane="${p.id}" data-tab="${esc(t)}" title="${esc(t)}">${icon("file")}<span class="tname">${esc(title(t))}</span>${d.dirty ? `<span class="dot-dirty"></span>` : ""}<button type="button" class="tclose" data-action="tab-close" data-pane="${p.id}" data-tab="${esc(t)}" aria-label="Close ${esc(title(t))}">${icon("x")}</button></div>`;
  }).join("");
  return `<div class="tabbar" role="tablist" data-pane="${p.id}" data-tabbar>${tabs}<span class="grow"></span><button type="button" class="btn btn-ghost icon-btn" data-action="pane-menu" data-pane="${p.id}" title="Pane options" aria-label="Pane options">${icon("down")}</button></div>`;
}

function editorBody(p: Pane): string {
  const c = p.active;
  if (!c) {
    return `<div class="empty"><canvas class="notes-sky" data-notes-sky aria-hidden="true"></canvas>${icon("file", "big")}<div><h2>Nothing open</h2><p class="muted">Pick a note on the left, or make a new one.</p></div>
      <button type="button" class="btn btn-primary" data-action="new">${icon("plus")}New note</button>
      <div class="hints"><span class="kbd">${MOD}N</span><span>New note</span><span class="kbd">${MOD}K</span><span>Open or create by name</span><span class="kbd">${MOD}E</span><span>Edit / split / reading</span><span class="kbd">${MOD}\\</span><span>Split to the right</span><span class="kbd">${MOD} click</span><span>Open in a new tab</span><span class="kbd">right-click</span><span>Folders, drawings, rename, move, delete</span></div></div>`;
  }
  const d = draftOf(c);
  const viewIcon = p.view === "edit" ? "edit" : p.view === "split" ? "columns" : "eye";
  const agent = note(c)?.agent;
  const locked = isAgentPath(c);
  const share = S.shares.find((x) => x.path === c);
  const badges = `${locked ? `<span class="pill agent" title="Agents write here; people read, link and delete">${icon("bot")}${esc(agent ?? "agent")}</span>` : ""}${share ? `<button type="button" class="pill ${share.public ? "ok" : ""}" data-action="share" data-path="${esc(c)}" title="Sharing settings">${icon(share.public ? "globe" : "share")}${share.public ? "Public" : `${share.principals.length} reader${share.principals.length === 1 ? "" : "s"}`}</button>` : ""}`;
  if (isExcalidraw(c, d.text)) {
    return `<div class="editor-bar"><input class="title" name="title" data-pane="${p.id}" value="${esc(stem(c))}" aria-label="Drawing name" spellcheck="false" autocomplete="off"><span class="right-actions"><span class="small muted">Excalidraw</span><button type="button" class="btn btn-ghost icon-btn" data-action="menu-current" data-pane="${p.id}" title="More" aria-label="Drawing actions">${icon("more")}</button></span></div>
      <div class="excalidraw-host" data-excalidraw="${esc(c)}"></div>
      <div class="statusbar"><span data-status-path="${esc(c)}"><i class="dot ${d.saving ? "saving" : d.dirty ? "dirty" : ""}"></i>${d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved"}</span><span class="muted">Embed it in a note with <code>![[${esc(stem(c))}]]</code></span></div>`;
  }
  if (c.endsWith(".canvas")) {
    const asJson = p.view === "edit";
    return `<div class="editor-bar"><input class="title" name="title" data-pane="${p.id}" value="${esc(stem(c))}" aria-label="Canvas name" spellcheck="false" autocomplete="off"><span class="right-actions">${badges}<button type="button" class="btn btn-ghost" data-action="view" data-pane="${p.id}" title="Board or JSON">${icon(asJson ? "edit" : "board")}<span class="small lbl">${asJson ? "JSON" : "Board"}</span></button><button type="button" class="btn btn-ghost icon-btn" data-action="menu-current" data-pane="${p.id}" title="More" aria-label="Canvas actions">${icon("more")}</button></span></div>
      <div class="path-hint">${esc(c)}</div>
      ${asJson ? `<div class="editor-panes view-edit"><div class="cm-host" data-cm="${esc(c)}" data-pane="${p.id}"></div></div>` : `<div class="cv-wrap" data-canvas="${esc(c)}">${canvasSvg(d.text)}</div>`}
      <div class="statusbar"><span data-status-path="${esc(c)}"><i class="dot ${d.saving ? "saving" : d.dirty ? "dirty" : ""}"></i>${d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved"}</span><span class="muted">JSON Canvas · drag to pan, wheel to zoom</span></div>`;
  }
  if (c.endsWith(".md") && !locked && isKanban(d.text)) {
    const asSrc = p.view === "edit";
    return `<div class="editor-bar"><input class="title" name="title" data-pane="${p.id}" value="${esc(title(c))}" aria-label="Board name" spellcheck="false" autocomplete="off"><span class="right-actions">${badges}<button type="button" class="btn btn-ghost" data-action="view" data-pane="${p.id}" title="Board or markdown source (${MOD}E)">${icon(asSrc ? "edit" : "board")}<span class="small lbl">${asSrc ? "Source" : "Board"}</span></button><button type="button" class="btn btn-ghost icon-btn" data-action="menu-current" data-pane="${p.id}" title="More" aria-label="Note actions">${icon("more")}</button></span></div>
      <div class="path-hint">${esc(c)}</div>
      ${asSrc ? `<div class="editor-panes view-edit"><div class="cm-host" data-cm="${esc(c)}" data-pane="${p.id}"></div></div>` : `<div class="kb" data-kanban="${esc(c)}">${boardHtml(c, d.text)}</div>`}
      <div class="statusbar"><span data-status-path="${esc(c)}"><i class="dot ${d.saving ? "saving" : d.dirty ? "dirty" : ""}"></i>${d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved"}</span><span class="muted kb-hint">Kanban · drag cards between lanes · double-click a card to edit · Obsidian Kanban format</span></div>`;
  }
  if (c.endsWith(".md") && !locked && quizKind(d.text)) {
    const asSrc = p.view === "edit";
    const kind = quizKind(d.text)!;
    // a phone shows the deck or the quiz alone: the tab names it, the ⋯ menu and the status bar carry the rest
    return `${S.mobile ? "" : `<div class="editor-bar"><input class="title" name="title" data-pane="${p.id}" value="${esc(title(c))}" aria-label="Quiz name" spellcheck="false" autocomplete="off"><span class="right-actions">${badges}<button type="button" class="btn btn-ghost" data-action="view" data-pane="${p.id}" title="Quiz or markdown source (${MOD}E)">${icon(asSrc ? "edit" : "check")}<span class="small lbl">${asSrc ? "Source" : kind === "cards" ? "Cards" : "Quiz"}</span></button><button type="button" class="btn btn-ghost icon-btn" data-action="menu-current" data-pane="${p.id}" title="More" aria-label="Note actions">${icon("more")}</button></span></div>
      <div class="path-hint">${esc(c)}</div>`}
      ${asSrc ? `<div class="editor-panes view-edit"><div class="cm-host" data-cm="${esc(c)}" data-pane="${p.id}"></div></div>` : `<div class="qz" data-quiz="${esc(c)}">${quizHtml(c, d.text)}</div>`}
      <div class="statusbar"><span data-status-path="${esc(c)}"><i class="dot ${d.saving ? "saving" : d.dirty ? "dirty" : ""}"></i>${d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved"}</span><span class="muted kb-hint">${kind === "cards" ? "Flashcards · tap a card to flip · Spaced Repetition plugin format" : "Multiple choice · pick, then Check"}</span></div>`;
  }
  if (isDashPath(c)) {
    const asSrc = p.view === "edit";
    return `<div class="editor-bar"><input class="title" name="title" data-pane="${p.id}" value="${esc(stem(c))}" aria-label="Dashboard name" spellcheck="false" autocomplete="off"><span class="right-actions">${badges}${S.mobile || asSrc ? "" : `<button type="button" class="btn btn-ghost" data-action="dash-add" data-path="${esc(c)}" title="Add a chart, a cell value or a Python output">${icon("plus")}<span class="small lbl">Tile</span></button>`}<button type="button" class="btn btn-ghost" data-action="view" data-pane="${p.id}" title="Tiles or JSON source (${MOD}E)">${icon(asSrc ? "edit" : "graph")}<span class="small lbl">${asSrc ? "JSON" : "Tiles"}</span></button><button type="button" class="btn btn-ghost icon-btn" data-action="menu-current" data-pane="${p.id}" title="More" aria-label="Note actions">${icon("more")}</button></span></div>
      <div class="path-hint">${esc(c)}</div>
      ${asSrc ? `<div class="editor-panes view-edit"><div class="cm-host" data-cm="${esc(c)}" data-pane="${p.id}"></div></div>` : `<div class="dsh" data-dash="${esc(c)}">${dashHtml(c, d.text)}</div>`}
      <div class="statusbar"><span data-status-path="${esc(c)}"><i class="dot ${d.saving ? "saving" : d.dirty ? "dirty" : ""}"></i>${d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved"}</span><span class="muted kb-hint">Tiles read their sources live; click a source name to open it</span></div>`;
  }
  if (isSheetPath(c)) {
    const asSrc = p.view === "edit";
    return `<div class="editor-bar"><input class="title" name="title" data-pane="${p.id}" value="${esc(stem(c))}" aria-label="Sheet name" spellcheck="false" autocomplete="off"><span class="right-actions">${badges}${S.mobile || asSrc ? "" : `<label class="btn btn-ghost" title="Import a CSV file as a new sheet">${icon("upload")}<span class="small lbl">CSV</span><input type="file" name="csv" accept=".csv,text/csv" data-path="${esc(c)}" hidden></label><button type="button" class="btn btn-ghost" data-action="sheet-export" data-path="${esc(c)}" title="Download the current sheet as CSV">${icon("download")}</button><button type="button" class="btn btn-ghost" data-action="sheet-chart" data-path="${esc(c)}" title="Add a chart from the current sheet">${icon("graph")}<span class="small lbl">Chart</span></button>`}<button type="button" class="btn btn-ghost" data-action="view" data-pane="${p.id}" title="Grid or JSON source (${MOD}E)">${icon(asSrc ? "edit" : "columns")}<span class="small lbl">${asSrc ? "JSON" : "Grid"}</span></button><button type="button" class="btn btn-ghost icon-btn" data-action="menu-current" data-pane="${p.id}" title="More" aria-label="Note actions">${icon("more")}</button></span></div>
      <div class="path-hint">${esc(c)}</div>
      ${asSrc ? `<div class="editor-panes view-edit"><div class="cm-host" data-cm="${esc(c)}" data-pane="${p.id}"></div></div>` : `<div class="shx" data-sheet="${esc(c)}">${sheetHtml(c, d.text)}</div>`}
      <div class="statusbar"><span data-status-path="${esc(c)}"><i class="dot ${d.saving ? "saving" : d.dirty ? "dirty" : ""}"></i>${d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved"}</span><span class="muted kb-hint">Formulas start with = · ↵ moves down, ⇥ right · in Python: <code>sheet("${esc(stem(c))}")</code></span></div>`;
  }
  if (isNotebookPath(c)) {
    const asSrc = p.view === "edit";
    return `<div class="editor-bar"><input class="title" name="title" data-pane="${p.id}" value="${esc(stem(c))}" aria-label="Space name" spellcheck="false" autocomplete="off"><span class="right-actions">${badges}${S.mobile ? "" : `<button type="button" class="btn btn-ghost" data-action="nb-run-all" data-path="${esc(c)}" title="Run every code cell in order">${icon("bolt")}<span class="small lbl">Run all</span></button><button type="button" class="btn btn-ghost icon-btn" data-action="nb-restart" data-path="${esc(c)}" title="Restart Python (clears variables)" aria-label="Restart Python">${icon("refresh")}</button>`}<button type="button" class="btn btn-ghost" data-action="view" data-pane="${p.id}" title="Cells or JSON source (${MOD}E)">${icon(asSrc ? "edit" : "list")}<span class="small lbl">${asSrc ? "JSON" : "Cells"}</span></button><button type="button" class="btn btn-ghost icon-btn" data-action="menu-current" data-pane="${p.id}" title="More" aria-label="Note actions">${icon("more")}</button></span></div>
      <div class="path-hint">${esc(c)}</div>
      ${asSrc ? `<div class="editor-panes view-edit"><div class="cm-host" data-cm="${esc(c)}" data-pane="${p.id}"></div></div>` : `<div class="nbk" data-ipynb="${esc(c)}">${notebookHtml(c, d.text)}</div>`}
      <div class="statusbar"><span data-status-path="${esc(c)}"><i class="dot ${d.saving ? "saving" : d.dirty ? "dirty" : ""}"></i>${d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved"}</span><span class="muted kb-hint" data-py-status>${pythonLoaded() ? "Python ready" : "Jupyter space · Python loads on the first run (about 10 MB, cached)"}${S.mobile ? " · read-only on phones" : ""}</span></div>`;
  }
  if (isAttachment(c)) {
    return `<div class="editor-bar"><input class="title" name="title" data-pane="${p.id}" value="${esc(stem(c))}" aria-label="File name" spellcheck="false" autocomplete="off"><span class="right-actions"><button type="button" class="btn btn-ghost icon-btn" data-action="menu-current" data-pane="${p.id}" title="More" aria-label="File actions">${icon("more")}</button></span></div>
      <div class="path-hint">${esc(c)}</div>
      <div class="editor-panes view-preview"><div class="preview md attach-view" data-preview-path="${esc(c)}">${previewHtml(c, "")}</div></div>`;
  }
  return `<div class="editor-bar">
      <input class="title" name="title" data-pane="${p.id}" value="${esc(title(c))}" aria-label="Note name" spellcheck="false" autocomplete="off" ${locked ? "readonly" : ""}>
      <span class="right-actions">${badges}
        <button type="button" class="btn btn-ghost icon-btn ${isPinned(c) ? "accent" : ""}" data-action="pin" data-path="${esc(c)}" title="${isPinned(c) ? "Unpin" : "Pin to the top of your files"}" aria-label="${isPinned(c) ? "Unpin" : "Pin to top"}" aria-pressed="${isPinned(c)}">${icon("pin-top")}</button>
        ${c.endsWith(".md") && isMeeting(d.text) ? `<button type="button" class="btn btn-ghost" data-action="follow-up" data-path="${esc(c)}" title="Decisions and actions for mail or chat">${icon("mail")}<span class="small lbl">Follow-up</span></button>` : ""}
        ${c.endsWith(".md") && isSlides(d.text) ? `<button type="button" class="btn btn-ghost" data-action="present" data-path="${esc(c)}" title="Present full screen (→ next, ← back, Esc leaves)">${icon("columns")}<span class="small lbl">Present</span></button>` : ""}
        ${c.endsWith(".md") ? `<button type="button" class="btn btn-ghost icon-btn ${p.study ? "accent" : ""}" data-action="study-mode" data-pane="${p.id}" title="Study mode: one section at a time" aria-label="Study mode" aria-pressed="${!!p.study}">${icon("target")}</button>` : ""}
        <button type="button" class="btn btn-ghost" data-action="view" data-pane="${p.id}" title="Edit, split or reading (${MOD}E)">${icon(viewIcon)}<span class="small lbl">${p.view === "edit" ? "Editing" : p.view === "split" ? "Split" : "Reading"}</span></button>
        <button type="button" class="btn btn-ghost icon-btn ${(S.asideMode === "comments" && S.asideOpen) || unreadComments(c) ? "accent" : ""}" data-action="comments" title="Comments${unreadComments(c) ? ` · ${unreadComments(c)} new` : ""}" aria-label="Comments">${icon("chat")}${S.comments.filter((x) => x.path === c).length ? `<span class="badge">${S.comments.filter((x) => x.path === c).length}</span>` : ""}</button>
        <button type="button" class="btn btn-ghost icon-btn" data-action="menu-current" data-pane="${p.id}" title="More" aria-label="Note actions">${icon("more")}</button>
      </span>
    </div>
    <div class="path-hint">${esc(c)}</div>
    ${c.endsWith(".md") && flag("problems") && isProblemNote(d.text) ? problemStrip(c, d.text) : ""}
    ${c.endsWith(".md") && !locked && p.view !== "preview" ? propsEditor(c, d.text) : ""}
    <div class="editor-panes view-${p.view}">
      <div class="cm-host" data-cm="${esc(c)}" data-pane="${p.id}" ${locked ? 'data-readonly="1"' : ""}></div>
      <div class="preview md ${p.study ? "study" : ""}" data-preview-path="${esc(c)}">${p.study ? studyHtml(p, c, d.text) : previewHtml(c, d.text)}</div>
    </div>
    <div class="statusbar"><span data-status-path="${esc(c)}"><i class="dot ${d.saving ? "saving" : d.dirty ? "dirty" : ""}"></i>${d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved"}</span><span data-counts-path="${esc(c)}">${words(d.text)} words · ${d.text.length} characters</span>${pomodoroHtml()}</div>`;
}

/** Front matter as a small form above the editor. */
function propsEditor(path: string, text: string): string {
  const { data } = frontmatter(text);
  const keys = Object.keys(data);
  if (!S.propsOpen) return `<div class="props-toggle"><button type="button" class="btn btn-ghost small" data-action="props-toggle">${icon("list")}Properties${keys.length ? ` <span class="muted">${keys.length}</span>` : ""}</button></div>`;
  return `<div class="props-editor" data-props="${esc(path)}">
    <div class="row tight"><button type="button" class="btn btn-ghost small" data-action="props-toggle">${icon("list")}Properties</button><span class="small muted">front matter · tags, aliases, anything</span></div>
    ${keys.map((k) => `<div class="prop"><input class="input pkey" name="pkey" data-key="${esc(k)}" value="${esc(k)}" aria-label="Property name"><input class="input" name="pval" data-key="${esc(k)}" value="${esc(data[k])}" aria-label="Property value"><button type="button" class="btn btn-ghost icon-btn" data-action="prop-del" data-key="${esc(k)}" aria-label="Remove">${icon("x")}</button></div>`).join("")}
    <button type="button" class="btn btn-ghost small addp" data-action="prop-add">${icon("plus")}Add property</button>
  </div>`;
}
function propsFromForm(form: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  form.querySelectorAll<HTMLElement>(".prop").forEach((row) => {
    const k = row.querySelector<HTMLInputElement>("[name=pkey]")!.value.trim();
    const v = row.querySelector<HTMLInputElement>("[name=pval]")!.value;
    if (k) out[k] = v;
  });
  return out;
}

const editors = new Map<HTMLElement, Editor>();
function destroyEditors() {
  for (const [host, ed] of editors) {
    ed.destroy();
    editors.delete(host);
    void host;
  }
}
function mountEditors(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".cm-host[data-cm]:not([data-mounted])").forEach((host) => {
    host.dataset.mounted = "1";
    const path = host.dataset.cm!;
    const ed = createEditor(host, {
      doc: draftOf(path).text,
      readOnly: host.dataset.readonly === "1",
      placeholder: path.endsWith(".md") ? "Start writing. [[Link]] other notes, #tag them, - for lists, --- for front matter." : "",
      onChange: (text) => onDraftInput(path, text, host),
      onLink: (t) => void follow(t),
      notes: () => paths().filter((p) => p.endsWith(".md") && !isAttachment(p)).map((p) => stem(p)),
      tags: () => [...S.idx.tags.keys()],
    });
    editors.set(host, ed);
    host.addEventListener("paste", (ev) => {
      const files = [...(ev.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        ev.preventDefault();
        void addImages(files, path, ed);
      }
    });
    host.addEventListener("drop", (ev) => {
      const files = [...(ev.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        ev.preventDefault();
        void addImages(files, path, ed);
      }
    });
  });
  root.querySelectorAll<HTMLElement>(".cv-wrap[data-canvas]:not([data-mounted])").forEach((host) => {
    host.dataset.mounted = "1";
    mountCanvasPanZoom(host);
  });
}
/** Images pasted or dropped become attachments and an `![[embed]]` at the cursor. */
async function addImages(files: File[], notePath: string, ed?: Editor) {
  for (const f of files) {
    if (f.size > MAX_ATTACHMENT) {
      toast(`${f.name || "image"} is over ${Math.round(MAX_ATTACHMENT / 1000)} KB.`, "error");
      continue;
    }
    const ext = (f.type.split("/")[1] ?? "png").replace("jpeg", "jpg").replace("svg+xml", "svg");
    const name = `Pasted image ${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${ext}`;
    const path = `attachments/${name}`;
    const data = `data:${f.type};base64,${b64(new Uint8Array(await f.arrayBuffer()))}`;
    try {
      const m = unwrap(await nb().write(path, data));
      S.notes!.push({ path, content: "", created: m.created, modified: m.modified });
      S.notes!.sort((x, y) => x.path.localeCompare(y.path));
      if (!S.folders.includes("attachments")) S.folders = [...S.folders, "attachments"].sort();
      attachments.set(path, data);
      const embed = `![[${name}]]`;
      if (ed) {
        const v = ed.view;
        v.dispatch({ changes: { from: v.state.selection.main.head, insert: `${embed}\n` } });
      } else onDraftInput(notePath, `${draftOf(notePath).text}\n${embed}\n`);
      reindex();
      renderSide();
      toast(`Added ${name}.`, "ok");
    } catch (e) {
      toast(errMsg(e), "error");
    }
  }
}

function panesHtml(): string {
  const ps = S.mobile ? [pane()] : S.panes;
  return `<section class="main panes-grid" style="--n:${ps.length}">${ps.map((p) => `<section class="pane ${p.id === S.focused && ps.length > 1 ? "focused" : ""}" data-pane="${p.id}">${tabbar(p)}<div class="pane-body" data-pane="${p.id}">${editorBody(p)}<div class="dropzone" data-dropzone="${p.id}">${icon("split")}Open here, split right</div></div></section>`).join("")}</section>`;
}

// --- quizzes: flashcards and multiple choice

type QuizState = { i: number; order: number[]; seed: number; flipped: boolean; good: number; again: number; picked: Set<number>; checked: boolean; right: number; mode: "due" | "all"; n: number };
const isSharedKey = (p: string) => p.startsWith("shared:");
/** Card schedules: the notebook's settings for your own decks; this device for decks shared with you. */
function srsFor(path: string): Record<string, Sched> {
  if (isSharedKey(path)) { try { return JSON.parse(store(`nb-srs-${path}`) ?? "{}") as Record<string, Sched>; } catch { return {}; } }
  return S.settings.srs[path] ?? {};
}
function saveSrs(path: string, m: Record<string, Sched>) {
  if (isSharedKey(path)) return store(`nb-srs-${path}`, JSON.stringify(m));
  S.settings.srs[path] = m;
  scheduleSettingsSave();
}
let settingsTimer = 0;
function scheduleSettingsSave() { clearTimeout(settingsTimer); settingsTimer = window.setTimeout(() => void saveSettings(), 1500); }
const deckPaths = () => (S.notes ?? []).filter((n) => n.path.endsWith(".md") && quizKind(n.content) === "cards").map((n) => n.path);
function dueCount(path: string, text = draftOf(path).text): number {
  const m = srsFor(path);
  const today = new Date();
  return parseCards(text).filter((c) => isDue(m[cardKey(c.front)], today)).length;
}
const dueTotal = () => (S.notes ? deckPaths().reduce((n, p) => n + dueCount(p, note(p)!.content), 0) : 0);
function bumpStudy(n = 1) {
  const k = dayKey(new Date());
  S.settings.study[k] = (S.settings.study[k] ?? 0) + n;
  scheduleSettingsSave();
}
const quizStates = new Map<string, QuizState>();
function quizState(path: string, n: number, reset = false, seed = 0, subset?: number[]): QuizState {
  let st = quizStates.get(path);
  if (!st || reset || st.n !== n) {
    const base = subset ?? Array.from({ length: n }, (_, k) => k);
    const order = seed ? shuffled(base.length, seed).map((k) => base[k]) : base;
    st = { i: 0, order, seed, flipped: false, good: 0, again: 0, picked: new Set(), checked: false, right: 0, mode: subset ? "due" : "all", n };
    quizStates.set(path, st);
  }
  return st;
}
/** Due cards first; an empty due list falls back to the whole deck. */
function deckSession(path: string, text: string, reset = false, seed = 0, all = false): QuizState {
  const cards = parseCards(text);
  const m = srsFor(path);
  const today = new Date();
  const due = cards.map((c, k) => (isDue(m[cardKey(c.front)], today) ? k : -1)).filter((k) => k >= 0);
  const existing = quizStates.get(path);
  if (existing && !reset && existing.n === cards.length) return existing;
  return quizState(path, cards.length, true, seed, all || !due.length ? undefined : due);
}
function quizHtml(path: string, text: string): string {
  const kind = quizKind(text);
  const tools = (n: number) => `<span class="qz-tools"><button type="button" class="btn btn-ghost" data-action="qz-shuffle" data-path="${esc(path)}" title="Shuffle and start over">${icon("refresh")}Shuffle</button><button type="button" class="btn btn-ghost" data-action="qz-restart" data-path="${esc(path)}" title="Start over in order">${icon("history")}Restart</button><span class="small muted">${n} ${kind === "cards" ? "cards" : "questions"}</span></span>`;
  if (kind === "cards") {
    const cards = parseCards(text);
    if (!cards.length) return `<div class="qz-empty">${icon("check")}<h3>No cards yet</h3><p class="muted small">Write <code>Front::Back</code> on a line, or the front, a line with <code>?</code>, then the back. Blank lines separate cards. ${MOD}E shows the source.</p></div>`;
    const st = deckSession(path, text);
    const due = dueCount(path, text);
    const ds = isSharedKey(path) ? undefined : S.settings.deckStats[path];
    const acc = ds && ds.reviews ? ` · ${Math.round((ds.good / ds.reviews) * 100)}% got it over ${ds.reviews} review${ds.reviews === 1 ? "" : "s"}` : "";
    const nextDeck = isSharedKey(path) ? undefined : deckPaths().find((d) => d !== path && dueCount(d, note(d)!.content) > 0);
    if (st.i >= st.order.length) return `<div class="qz-done"><h3>${st.mode === "due" ? "Done for today" : "Deck finished"}</h3><p>${st.good} got it · ${st.again} again${acc}</p><p class="small muted">${due ? `${due} card${due === 1 ? "" : "s"} still due.` : "Nothing more due today; come back tomorrow."}</p><div class="qz-actions">${due ? `<button type="button" class="btn btn-primary" data-action="qz-due" data-path="${esc(path)}">${icon("check")}Review what is due</button>` : ""}<button type="button" class="btn" data-action="qz-all" data-path="${esc(path)}">${icon("refresh")}Study the whole deck</button>${nextDeck ? `<button type="button" class="btn" data-action="open" data-path="${esc(nextDeck)}">${icon("move")}Next deck: ${esc(title(nextDeck))}</button>` : ""}${isSharedKey(path) ? `<button type="button" class="btn btn-primary" data-action="shared-clone">${icon("copy")}Clone to my Agent Space &amp; save schedule</button>` : `<button type="button" class="btn btn-ghost" data-action="anki" data-path="${esc(path)}" title="Tab-separated, ready for Anki's importer">${icon("download")}Export for Anki</button>`}</div></div>`;
    const c = cards[st.order[st.i]];
    const sched = srsFor(path)[cardKey(c.front)];
    return `<div class="qz-head"><span class="small muted">${st.mode === "due" ? "Due" : "Card"} ${st.i + 1} of ${st.order.length}${st.mode === "due" ? ` · ${cards.length} in the deck` : due ? ` · ${due} due` : ""}${sched ? ` · seen ${sched.r}×` : " · new"}</span>${tools(cards.length)}</div>
      <div class="qcard ${st.flipped ? "back" : ""}" data-action="qz-flip" data-path="${esc(path)}" role="button" tabindex="0" title="Tap to flip"><div class="qside md">${renderMd(st.flipped ? c.back : c.front, path)}</div><div class="qlabel">${st.flipped ? "answer" : "question"}</div></div>
      <div class="qz-actions">${st.flipped ? `<button type="button" class="btn" data-action="qz-rate" data-path="${esc(path)}" data-r="again" title="Forgot it: see it again today">${icon("x")}Again</button><button type="button" class="btn" data-action="qz-rate" data-path="${esc(path)}" data-r="hard" title="Barely: a little later">Hard</button><button type="button" class="btn btn-primary" data-action="qz-rate" data-path="${esc(path)}" data-r="good" title="Knew it">${icon("check")}Good</button><button type="button" class="btn" data-action="qz-rate" data-path="${esc(path)}" data-r="easy" title="Too easy: much later">Easy</button>` : `<button type="button" class="btn btn-primary" data-action="qz-flip" data-path="${esc(path)}">${icon("eye")}Show answer</button>`}</div>`;
  }
  const qs = parseChoice(text);
  if (!qs.length) return `<div class="qz-empty">${icon("check")}<h3>No questions yet</h3><p class="muted small">A <code>###</code> heading per question, task items as options, <code>[x]</code> on the right ones, an optional <code>&gt;</code> quote as the explanation. ${MOD}E shows the source.</p></div>`;
  const st = quizState(path, qs.length);
  if (st.i >= qs.length) return `<div class="qz-done"><h3>Quiz finished</h3><p>${st.right} of ${qs.length} right · ${Math.round((st.right / qs.length) * 100)}%</p><div class="qz-actions">${isSharedKey(path) ? `<button type="button" class="btn btn-primary" data-action="shared-clone">${icon("copy")}Clone to my Agent Space &amp; track scores</button>` : ""}</div>${tools(qs.length)}</div>`;
  const q = qs[st.order[st.i]];
  const ok = st.checked && graded(q, st.picked);
  const opts = q.options.map((o, k) => {
    const cls = st.checked ? (q.correct.includes(k) ? "right" : st.picked.has(k) ? "wrong" : "") : st.picked.has(k) ? "picked" : "";
    return `<button type="button" class="qopt ${cls}" data-action="qz-pick" data-path="${esc(path)}" data-opt="${k}" ${st.checked ? "disabled" : ""} aria-pressed="${st.picked.has(k)}"><span class="qbox">${st.checked ? (q.correct.includes(k) ? icon("check") : st.picked.has(k) ? icon("x") : "") : st.picked.has(k) ? icon("check") : ""}</span><span class="md">${renderMd(o, path)}</span></button>`;
  }).join("");
  return `<div class="qz-head"><span class="small muted">Question ${st.i + 1} of ${qs.length}${q.correct.length > 1 ? " · pick all that apply" : ""}</span>${tools(qs.length)}</div>
    <div class="qquestion md">${renderMd(q.text, path)}</div>
    <div class="qopts">${opts}</div>
    ${st.checked ? `<div class="qresult ${ok ? "ok" : "no"}">${ok ? `${icon("check")}Correct` : `${icon("x")}Not quite`}${q.explanation ? `<div class="small">${esc(q.explanation)}</div>` : ""}</div>` : ""}
    <div class="qz-actions">${st.checked ? `<button type="button" class="btn btn-primary" data-action="qz-next" data-path="${esc(path)}">${icon("move")}${st.i + 1 < qs.length ? "Next" : "Finish"}</button>` : `<button type="button" class="btn btn-primary" data-action="qz-check" data-path="${esc(path)}" ${st.picked.size ? "" : "disabled"}>${icon("check")}Check</button>`}</div>`;
}
/** A finished session on a note shared with you is reported to its owner (the teacher view). */
async function finishSession(pathKey: string, score: number, total: number) {
  if (!isSharedKey(pathKey) || !S.shared || !S.identity || !total) return;
  try { await notebookOf(S.shared.canister).submit_attempt(S.shared.path, score, total); } catch { /* not reported */ }
}
function refreshQuiz(path: string) {
  document.querySelectorAll<HTMLElement>(`.qz[data-quiz="${CSS.escape(path)}"]`).forEach((h) => { h.innerHTML = quizHtml(path, draftOf(path).text); afterRender(h); });
}
function newQuiz(kind: "cards" | "choice", folder?: string) {
  const where = folder ?? (cur() ? dir(cur()!) : "");
  const have = new Set(paths());
  const base = kind === "cards" ? "Flashcards" : "Quiz";
  let name = base;
  for (let i = 1; have.has(`${where ? `${where}/` : ""}${name}.md`); i++) name = `${base} ${i}`;
  return newNote(`${where ? `${where}/` : ""}${name}.md`, where, undefined, kind === "cards" ? NEW_CARDS : NEW_CHOICE);
}

// --- the Community: channels, chat, who is online; posting needs ICP in the in-app wallet

const seenKeyC = () => "nb-chat-seen";
const chatSeen = (): Record<string, string> => { try { return JSON.parse(store(seenKeyC()) ?? "{}") as Record<string, string>; } catch { return {}; } };
function markChatSeen(channel: string, id: bigint) { const m = chatSeen(); m[channel] = id.toString(); store(seenKeyC(), JSON.stringify(m)); }
let chatTimer = 0;
async function loadCommunity(channel?: string) {
  const c = S.community ?? { channel: "general", channels: [], messages: [], online: [], loading: true, draft: "", unread: {}, showOnline: !S.mobile && store("nb-chat-aside") !== "0", showChannels: !S.mobile && store("nb-chat-side") !== "0" };
  if (channel) { c.channel = channel; c.messages = []; c.replyTo = undefined; store("nb-chat-channel", channel); }
  S.mentions = 0;
  c.loading = true;
  S.community = c;
  render();
  try {
    const [chs, mem, gh, repo, fee, primary, newcomerLeft] = await Promise.all([registry().channels(), registry().my_membership(), registry().my_github(), registry().github_repo(), registry().message_cycles(200n).catch(() => 16_000_000n), registry().my_primary().catch(() => undefined), registry().my_newcomer_pass().catch(() => [0, null] as [number, string | null])]);
    c.fee = fee;
    c.primary = primary ?? undefined;
    // the pass: how many free messages a visitor without a notebook has left, and the handle they chose
    c.newcomerLeft = Number(newcomerLeft[0]);
    c.newcomerHandle = newcomerLeft[1] ?? c.newcomerHandle;
    c.channels = chs;
    c.member = mem ?? undefined;
    c.github = gh ?? undefined;
    c.repo = repo;
    if (!chs.some((x) => x.name === c.channel)) c.channel = "general";
    const on = verifiedNow(c.member) ? await registry().ping_chat(c.channel).then((x) => (x.__kind__ === "Ok" ? x.Ok : [])) : await registry().online();
    c.online = on;
    const r = await registry().messages(c.channel, 0n, 100);
    c.messages = r.__kind__ === "Ok" ? r.Ok : [];
    c.editing = undefined;
    c.pins = await registry().pinned(c.channel).then((x) => (x.__kind__ === "Ok" ? x.Ok : [])).catch(() => []);
    const seen = BigInt(chatSeen()[c.channel] ?? "0");
    c.firstUnseen = seen ? c.messages.find((m) => m.id > seen && !m.deleted)?.id : undefined;
    c.newCount = 0;
    c.atBottom = c.firstUnseen === undefined; // start at the first unseen message; nothing is seen until the reader reaches the bottom
    void icpBalance().then((b) => { c.balance = b; render(); }).catch(() => {});
    void refreshUnread();
  } catch (e) {
    c.error = errMsg(e);
  }
  c.loading = false;
  render();
  if (c.firstUnseen !== undefined) { const log = document.querySelector<HTMLElement>("[data-chat-log]"); const d = log?.querySelector<HTMLElement>("[data-newdiv]"); if (log && d) { log.scrollTop = Math.max(0, d.offsetTop - log.offsetTop - 12); } else scrollChat(); } else scrollChat();
  chatScrolled();
  clearInterval(chatTimer);
  chatTimer = window.setInterval(() => void pollCommunity(), 5000);
}
async function pollCommunity() {
  const c = S.community;
  if (!c || document.hidden) return;
  try {
    const last = c.messages.length ? c.messages[c.messages.length - 1].id : 0n;
    const r = await registry().messages(c.channel, last, 100);
    const fresh = r.__kind__ === "Ok" ? r.Ok : [];
    // deletions, votes and reactions rewrite messages in place; refetch the page every 15 s for those
    const tick = Math.floor(Date.now() / 5000);
    if (fresh.length) { c.messages.push(...fresh); if (c.atBottom === false) c.newCount = (c.newCount ?? 0) + fresh.filter((m) => m.author.toText() !== S.principal).length; renderChat(); }
    else if (tick % 3 === 0) { const page = await registry().messages(c.channel, 0n, 100); if (page.__kind__ === "Ok" && JSON.stringify(page.Ok, (_, v) => (typeof v === "bigint" ? v.toString() : v)) !== JSON.stringify(c.messages, (_, v) => (typeof v === "bigint" ? v.toString() : v))) { c.messages = page.Ok; renderChat(); } }
    if (tick % 6 === 0) {
      const on = verifiedNow(c.member) ? await registry().ping_chat(c.channel).then((x) => (x.__kind__ === "Ok" ? x.Ok : c.online)) : await registry().online();
      if (JSON.stringify(on) !== JSON.stringify(c.online)) { c.online = on; renderOnline(); }
      void refreshUnread();
    }
  } catch { /* next tick */ }
}
async function refreshUnread() {
  const c = S.community;
  if (!c) return;
  const seen = chatSeen();
  // one query for every channel (it used to be one, of up to 100 messages, per channel)
  const r = await registry().unread_counts(c.channels.map((ch) => [ch.name, BigInt(seen[ch.name] ?? "0")] as [string, bigint])).catch(() => undefined);
  if (!r) return;
  const counts: Record<string, number> = {};
  for (const [name, n] of r) if (name !== c.channel) counts[name] = n;
  if (JSON.stringify(counts) !== JSON.stringify(c.unread)) { c.unread = counts; renderChannels(); }
}
/** Members chat as long as they own a notebook; no ICP has to sit anywhere. */
const verifiedNow = (m?: Member) => !!m && (S.notebooks?.length ?? 1) > 0;
const canNewcomerPost = (c: NonNullable<typeof S.community>) => !verifiedNow(c.member) && (c.channel === "help" || c.channel === "general") && (c.newcomerLeft ?? 0) > 0;
/** Admins put a channel in a section: an existing one, a new one, or none. */
async function moveChannel(name: string) {
  const c = S.community;
  if (!c) return;
  const secs = [...new Set(c.channels.map((ch) => ch.section).filter((x): x is string => !!x))];
  const cur = c.channels.find((ch) => ch.name === name)?.section ?? "";
  const pick = await ask({ title: `Section for #${name}`, label: "Section", choices: [...secs.map((x) => ({ value: x, label: x })), { value: "__new__", label: "New section…" }, { value: "", label: "None (Channels)" }], value: cur, ok: "Move" });
  if (pick === null) return;
  const sec = pick === "__new__" ? (await ask({ title: "New section", label: "Name", placeholder: "Study groups", ok: "Create" }))?.trim() : pick;
  if (sec === undefined) return;
  const r = await registry().set_channel_section(name, sec || null);
  if (r.__kind__ === "Err") return void toast(r.Err, "error");
  c.channels = c.channels.map((ch) => (ch.name === name ? r.Ok : ch));
  renderChannels();
}
/** Chat channels grouped by section: the built-in sections first, then the rest A-Z, unsectioned last. */
const SECTION_ORDER = ["Agent Space", "Spaces", "Build"];
function chatSections(chs: Channel[]): [string, Channel[]][] {
  const by = new Map<string, Channel[]>();
  for (const ch of chs) {
    const sec = ch.section ?? "Channels";
    by.set(sec, [...(by.get(sec) ?? []), ch]);
  }
  const rank = (k: string) => (k === "Channels" ? 1e9 : SECTION_ORDER.includes(k) ? SECTION_ORDER.indexOf(k) : 100);
  return [...by.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}
const chatCollapsed = () => { try { return new Set<string>(JSON.parse(store("nb-chat-collapsed") ?? "[]")); } catch { return new Set<string>(); } };
function channelsHtml(): string {
  const c = S.community!;
  return `<div class="pane-head"><span class="pane-title" style="padding:0">Channels</span>${c.member ? `<button type="button" class="btn btn-ghost icon-btn" data-action="chat-join" title="Your handle: @${esc(c.member.handle)}" aria-label="Change your handle">${icon("edit")}</button>` : ""}${S.isAdmin ? `<button type="button" class="btn btn-ghost icon-btn" data-action="chat-new-channel" title="New channel" aria-label="New channel">${icon("plus")}</button>` : ""}</div>
    <div class="chans">${chatSections(c.channels.filter((ch) => ch.name === "general").map((ch) => ({ ...ch, section: "Space" }))).map(([sec, list]) => {
      const shut = chatCollapsed().has(sec);
      // a folded section still lists the open channel and any with unread messages
      const shown = shut ? list.filter((ch) => ch.name === c.channel || c.unread[ch.name]) : list;
      const unread = list.reduce((n, ch) => n + (c.unread[ch.name] ?? 0), 0);
      return `<button type="button" class="chan-sec" data-action="chat-section" data-section="${esc(sec)}" aria-expanded="${!shut}">${icon(shut ? "chevron" : "down")}<span>${esc(sec)}</span>${shut && unread ? `<span class="unread">${unread}</span>` : ""}</button>${shown.map((ch) => `<button type="button" class="chan ${ch.name === c.channel ? "on" : ""}" data-action="chat-channel" data-channel="${esc(ch.name)}" title="${esc(ch.topic)}"><span class="hash">#</span>${esc(ch.name)}${ch.gate ? `<span class="gate-ico" title="Contributors only">${icon("lock")}</span>` : ""}${c.unread[ch.name] ? `<span class="unread">${c.unread[ch.name]}</span>` : ""}${S.isAdmin ? `<span class="chan-del" data-action="chat-move-channel" data-channel="${esc(ch.name)}" title="Move to a section">${icon("folder")}</span>` : ""}${S.isAdmin && ch.name !== "general" ? `<span class="chan-del" data-action="chat-del-channel" data-channel="${esc(ch.name)}" title="Delete channel">${icon("x")}</span>` : ""}</button>`).join("")}`;
    }).join("")}</div>`;
}
/** New chat messages are paid for by one of the member's notebooks, in cycles, inside the call. */
const paidPost = <T,>(call: () => Promise<T>): Promise<T> => call();
/** Small cycle amounts read as millions; larger ones in TC. */
const cyc = (n: bigint) => (n < 1_000_000_000n ? `${(Number(n) / 1e6).toFixed(1)}M cycles` : tc(n));
/** Chat text: bold, italics, code and @mentions only; everything else is plain text (no links, no images). */
const SHORTCODES: Record<string, string> = { smile: "😄", grin: "😁", joy: "😂", wink: "😉", heart: "❤️", "+1": "👍", thumbsup: "👍", "-1": "👎", clap: "👏", fire: "🔥", rocket: "🚀", eyes: "👀", tada: "🎉", thinking: "🤔", pray: "🙏", wave: "👋", ok: "👌", check: "✅", x: "❌", star: "⭐", bulb: "💡", warning: "⚠️", coffee: "☕", bug: "🐛", sparkles: "✨", "100": "💯", sob: "😭", sunglasses: "😎", muscle: "💪", brain: "🧠", books: "📚", memo: "📝", money: "💰", rain: "☔", zap: "⚡", pin: "📌" };
const expandShortcodes = (t: string) => t.replace(/(^|[\s(])(?::([a-z0-9_+-]+):)(?=$|[\s).,!?])/gi, (m, p: string, n: string) => (SHORTCODES[n.toLowerCase()] ? `${p}${SHORTCODES[n.toLowerCase()]}` : m));
function chatText(t: string): string {
  return esc(t)
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/(^|[\s(])@([A-Za-z][\w.-]*[\w])/g, (_, p: string, n: string) => `${p}<span class="mention">@${n}</span>`)
    .replace(/\n/g, "<br>");
}
const CHAT_EMOJI = "😀 😂 🤣 😊 😍 🥰 😎 🤔 🤯 😢 😭 😡 🥳 🤗 🙃 😴 👍 👎 👏 🙌 🙏 💪 🤝 👀 ❤️ 🧡 💛 💚 💙 💜 🔥 ✨ ⭐ 🎉 🎯 🚀 💡 📚 📝 🧠 ✅ ❌ ⚡ ☔ 🌧️ 🌈 ☀️ 🍀 🐝 🦉 🍕 ☕ 🍺 💎 🪙 💰 📈 📉 🔒 🔓 🧪 🔭 🧩 ♾️".split(" ");
const onlyEmoji = (t: string) => /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\s)+$/u.test(t);
function pollHtml(m: Message, can: boolean): string {
  const p = m.poll!;
  const total = p.votes.length;
  return `<div class="poll">${p.options.map((o, i) => {
    const n = p.votes.filter((v) => v[1] === i).length;
    const pct = total ? Math.round((100 * n) / total) : 0;
    const mine = p.votes.some((v) => v[1] === i && v[0].toText() === S.principal);
    return `<button type="button" class="poll-opt ${mine ? "on" : ""}" data-action="chat-vote" data-mid="${m.id}" data-opt="${i}" ${can ? "" : "disabled"} title="${n} ${n === 1 ? "vote" : "votes"}"><span class="bar" style="width:${pct}%"></span><span class="lbl">${mine ? icon("check") : ""}${esc(o)}</span><span class="pct">${pct}%</span></button>`;
  }).join("")}<div class="small muted">${total} ${total === 1 ? "vote" : "votes"}${can ? " · pick one; you can change it" : ""}</div></div>`;
}
function reactionsHtml(m: Message): string {
  const rs = m.reactions ?? [];
  if (!rs.length) return "";
  return `<div class="reacts">${rs.map((r) => `<button type="button" class="react ${r.by.some((p) => p.toText() === S.principal) ? "on" : ""}" data-action="chat-react" data-mid="${m.id}" data-emoji="${esc(r.emoji)}" title="${r.by.length} ${r.by.length === 1 ? "person" : "people"}">${esc(r.emoji)}<span class="n">${r.by.length}</span></button>`).join("")}<button type="button" class="react add" data-action="chat-emoji" data-mid="${m.id}" title="Add a reaction" aria-label="Add a reaction">+</button></div>`;
}
/** A gist is a note snapshot: rendered like a note, but links go dead and images vanish (community rule). */
// snapshots drop heading ids: several gists of one note would repeat them, and they are not link targets here
const gistMd = (t: string) => renderMd(t).replace(/(<h[1-6][^>]*?) id="[^"]*"/g, "$1").replace(/<div class="pdf-embed"[^>]*><div class="pdf-head"><span class="pdf-name">([^<]*)<\/span>[\s\S]*?<\/div><\/div><\/div>/g, '<p class="dead">$1</p>').replace(/<a\b[^>]*>/gi, '<span class="dead">').replace(/<\/a>/gi, "</span>").replace(/<(img|video|audio|iframe)\b[^>]*>/gi, "");
function gistHtml(m: Message): string {
  const g = m.gist!;
  const open = `<button type="button" class="btn btn-ghost" data-action="gist-open" data-nb="${g.notebook.toText()}" data-path="${esc(g.path)}" title="Open the live note (if you have access)">${icon("out")}Open</button>`;
  if (isSlides(g.text)) {
    const slides = splitSlides(g.text);
    const i = Math.min(S.community!.gistSlide?.get(m.id) ?? 0, slides.length - 1);
    return `<div class="gist deck"><div class="gist-head">${icon("columns")}<b>${esc(g.title)}</b><span class="small muted">${slides.length} slides</span><button type="button" class="btn btn-ghost" data-action="gist-present" data-mid="${m.id}" title="Full screen">${icon("columns")}Present</button>${open}</div>
      <div class="gist-slide md" data-action="gist-slide" data-mid="${m.id}" data-d="1">${gistMd(slides[i] ?? "")}</div>
      <div class="gist-nav"><button type="button" class="btn btn-ghost icon-btn" data-action="gist-slide" data-mid="${m.id}" data-d="-1" aria-label="Previous slide" ${i === 0 ? "disabled" : ""}>${icon("chevron")}</button><span class="small muted">${i + 1} / ${slides.length}</span><button type="button" class="btn btn-ghost icon-btn flip" data-action="gist-slide" data-mid="${m.id}" data-d="1" aria-label="Next slide" ${i >= slides.length - 1 ? "disabled" : ""}>${icon("chevron")}</button></div></div>`;
  }
  return `<div class="gist"><div class="gist-head">${icon("file")}<b>${esc(g.title)}</b><span class="small muted">${esc(g.path)}</span>${open}</div><div class="gist-body md">${gistMd(g.text)}</div>${g.text.length > 500 ? `<button type="button" class="btn btn-ghost gist-more" data-action="gist-more"><span class="more">Show more</span><span class="less">Show less</span></button>` : ""}</div>`;
}
function fundHtml(m: Message, can: boolean): string {
  const f = m.fund!;
  const pct = Math.min(100, Math.round((100 * Number(f.raised_e8s)) / Number(f.goal_e8s)));
  const mine = m.author.toText() === S.principal;
  return `<div class="fund ${f.closed ? "closed" : ""}"><div class="fund-head">${icon("bolt")}<b>${f.plan ? `Help @${esc(m.handle)} get ${esc(f.plan)}` : `Keep “${esc(f.name)}” alive`}</b>${f.closed ? `<span class="pill">closed</span>` : pct >= 100 ? `<span class="pill ok">funded</span>` : ""}</div>
    <div class="fund-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    <div class="small muted"><b>${icp(f.raised_e8s)}</b> of ${icp(f.goal_e8s)} ICP · ${f.donors.length} ${f.donors.length === 1 ? "person" : "people"} chipped in · ${f.plan ? `goes to @${esc(m.handle)}'s wallet to pay for the plan` : "every ICP is minted straight into the space's cycles; nobody can withdraw it"}</div>
    ${f.closed ? "" : `<div class="row tight nudge">${can ? `<button type="button" class="btn btn-primary" data-action="fund-donate" data-mid="${m.id}">${icon("bolt")}Chip in</button>` : ""}${mine || S.isAdmin ? `<button type="button" class="btn btn-ghost" data-action="fund-close" data-mid="${m.id}">Close</button>` : ""}</div>`}</div>`;
}
function messageHtml(m: Message, prev?: Message): string {
  const c = S.community!;
  const can = verifiedNow(c.member);
  const mine = m.author.toText() === S.principal;
  const cont = prev && prev.author.toText() === m.author.toText() && m.at - prev.at < 300_000_000_000n && !m.reply_to;
  const quoted = m.reply_to !== undefined && m.reply_to !== null ? c.messages.find((x) => x.id === m.reply_to) : undefined;
  const divider = c.firstUnseen !== undefined && m.id === c.firstUnseen ? `<div class="newdiv" data-newdiv><span>New messages</span></div>` : "";
  if (m.handle === "rain") return `${divider}<div class="msgrow rainmsg" data-mid="${m.id}"><div class="mtext">${chatText(m.text)}</div><span class="small muted">${when(m.at)}</span></div>`;
  const me = c.member && !mine && new RegExp(`(^|[^\\w])@${c.member.handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "i").test(m.text);
  return `${divider}<div class="msgrow ${cont && !divider ? "cont" : ""} ${mine ? "mine" : ""} ${me ? "me-mention" : ""}" data-mid="${m.id}">
      ${quoted ? `<div class="quote" title="${esc(quoted.text)}">${icon("links")}<b>@${esc(quoted.handle)}</b> ${esc(quoted.deleted ? "(deleted)" : quoted.text.slice(0, 120))}</div>` : ""}
      ${cont ? "" : `<div class="who"><span class="avatar" style="--h:${[...m.author.toText()].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360}">${esc(m.handle.slice(0, 2).toUpperCase())}</span><b title="${esc(m.author.toText())}">${esc(m.handle)}</b><span class="small muted">${when(m.at)}</span>${m.pinned ? `<span class="small muted" title="Pinned">📌</span>` : ""}</div>`}
      ${m.text || m.deleted ? `<div class="mtext ${!m.poll && onlyEmoji(m.text) ? "jumbo" : ""}">${m.deleted ? `<span class="muted small">(message removed)</span>` : m.poll ? `<b>${chatText(m.text)}</b>` : chatText(m.text)}${m.edited && !m.deleted ? `<span class="small faint" title="Edited ${when(m.edited)}"> (edited)</span>` : ""}</div>` : ""}
      ${m.post !== undefined && m.post !== null && !m.deleted ? `<a href="#/board/${m.post}" class="post-card" data-action="nav">${icon("list")}<span>Open the post on the board</span>${icon("out")}</a>` : ""}
      ${m.poll && !m.deleted ? pollHtml(m, can) : ""}${m.gist && !m.deleted ? gistHtml(m) : ""}${m.fund && !m.deleted ? fundHtml(m, can) : ""}${m.deleted ? "" : reactionsHtml(m)}
      ${m.deleted ? "" : `<span class="mtools">${can ? `<button type="button" class="btn btn-ghost icon-btn" data-action="chat-emoji" data-mid="${m.id}" title="React" aria-label="React">☺</button>` : ""}<button type="button" class="btn btn-ghost icon-btn" data-action="chat-reply" data-mid="${m.id}" title="Reply" aria-label="Reply">${icon("links")}</button>${mine && !m.poll && !m.gist && !m.fund ? `<button type="button" class="btn btn-ghost icon-btn" data-action="chat-edit" data-mid="${m.id}" title="Edit" aria-label="Edit">${icon("edit")}</button>` : ""}${can ? `<button type="button" class="btn btn-ghost icon-btn" data-action="chat-to-board" data-mid="${m.id}" title="Pin to the board" aria-label="Pin to the board">${icon("list")}</button>` : ""}${mine || S.isAdmin ? `<button type="button" class="btn btn-ghost icon-btn" data-action="chat-pin" data-mid="${m.id}" title="${m.pinned ? "Unpin" : "Pin"}" aria-label="${m.pinned ? "Unpin" : "Pin"}">📌</button><button type="button" class="btn btn-ghost icon-btn" data-action="chat-del" data-mid="${m.id}" title="Delete" aria-label="Delete">${icon("x")}</button>` : ""}</span>`}
    </div>`;
}
function chatHtmlC(): string {
  const c = S.community!;
  const ch = c.channels.find((x) => x.name === c.channel);
  const can = (verifiedNow(c.member) || canNewcomerPost(c)) && !(ch?.gate === "github" && !c.github);
  const newcomer = canNewcomerPost(c);
  const msgs = c.messages.length ? c.messages.map((m, i) => messageHtml(m, c.messages[i - 1])).join("") : `<div class="chat-empty">${icon("chat")}<h3>#${esc(c.channel)}</h3><p class="muted small">${esc(ch?.topic ?? "")}. Nothing here yet; say hello.</p></div>`;
  return `<div class="chat-head"><span class="hash">#</span><b>${esc(c.channel)}</b><span class="small muted">${esc(ch?.topic ?? "")}</span><span class="right-actions">${c.pins?.length ? `<button type="button" class="btn btn-ghost" data-action="chat-pins" title="Pinned messages">📌<span class="small lbl">${c.pins.length}</span></button>` : ""}${verifiedNow(c.member) ? `<button type="button" class="btn btn-ghost" data-action="chat-sponsor-newcomer" title="Sponsor a newcomer's first space canister">${icon("heart")}<span class="small lbl">Sponsor a newcomer</span></button>` : ""}${flag("rain") ? `<button type="button" class="btn btn-ghost" data-action="rain" title="Send ICP to random people who chatted in the last 30 minutes" ${verifiedNow(c.member) ? "" : "disabled"}>☔<span class="small lbl">Rain</span></button>` : ""}${S.mobile ? `<button type="button" class="btn btn-ghost icon-btn" data-action="chat-online-toggle" title="Who is online" aria-label="Who is online">${icon("person")}</button>` : ""}</span></div>
    ${c.showPins && c.pins?.length ? `<div class="pins"><div class="pane-title" style="padding:0 0 4px">Pinned</div>${c.pins.map((m) => `<button type="button" class="pin-row" data-action="chat-goto" data-mid="${m.id}"><b>@${esc(m.handle)}</b> ${esc(m.text.slice(0, 100))}</button>`).join("")}</div>` : ""}
    <div class="chat-log" data-chat-log>${c.loading && !c.messages.length ? `<p class="muted small" style="padding:12px">Loading…</p>` : msgs}</div>
    <button type="button" class="btn jump" data-action="chat-jump" data-jump hidden>${icon("down")}<span class="n">Jump to latest</span></button>
    ${ch?.gate === "github" && !c.github && verifiedNow(c.member) ? `<div class="gate"><b>#${esc(c.channel)} is for contributors${c.repo ? ` to ${esc(c.repo)}` : ""}.</b> ${c.repo ? `Put your principal <code>${esc(S.principal)}</code><button type="button" class="btn btn-ghost icon-btn" data-action="copy-principal" aria-label="Copy principal">${icon("copy")}</button> in your GitHub bio, then link your login.` : "An admin has not set the repository yet."}${c.repo ? `<button type="button" class="btn btn-primary" data-action="link-github">${icon("link")}Link GitHub</button>` : ""}</div>` : ""}
    <div class="compose-box off"><span class="small muted" style="padding:10px 14px">Agents talk here; you can read along.</span></div>`;
}
function onlineHtml(): string {
  const c = S.community!;
  const here = c.online.filter((o) => o.principal.toText() !== S.principal || verifiedNow(c.member));
  const byChan = new Map<string, Online[]>();
  for (const o of here) byChan.set(o.channel, [...(byChan.get(o.channel) ?? []), o]);
  return `<div class="pane-title">Online <span class="count">${here.length}</span></div>
    ${here.length ? [...byChan.entries()].map(([ch, os]) => `<div class="pane-sub" style="padding:0 10px">#${esc(ch)}</div>${os.map((o) => `<div class="online-row"><span class="avatar" style="--h:${[...o.principal.toText()].reduce((a, x) => a + x.charCodeAt(0), 0) % 360}">${esc(o.handle.slice(0, 2).toUpperCase())}</span><span>${esc(o.handle)}</span>${o.principal.toText() === S.principal ? `<span class="small muted">you</span>` : ""}</div>`).join("")}`).join("") : `<div class="empty-side">Nobody is reading right now.</div>`}
    `;
}
// --- the board: reddit-style posts per topic
const score = (x: { ups: Principal[]; downs: Principal[] }) => x.ups.length - x.downs.length;
const myVote = (x: { ups: Principal[]; downs: Principal[] }) => (x.ups.some((p) => p.toText() === S.principal) ? 1 : x.downs.some((p) => p.toText() === S.principal) ? -1 : 0);
const hot = (p: Post) => score(p) / Math.pow((Date.now() - Number(p.created_at / 1_000_000n)) / 3_600_000 + 2, 1.5);
async function loadBoard(topic?: string, openId?: bigint) {
  const b = S.board ?? { sort: (store("nb-board-sort") as "hot" | "new" | "top") || "hot", posts: [], comments: [], channels: [], fee: 20_000n, loading: true, showSide: !S.mobile && store("nb-board-side") !== "0", showAside: !S.mobile && store("nb-board-aside") !== "0" };
  if (topic !== undefined) b.topic = topic || undefined;
  b.loading = true;
  S.board = b;
  S.community = undefined; clearInterval(chatTimer);
  render();
  try {
    const [chs, mem, fee, gh] = await Promise.all([registry().channels(), registry().my_membership(), registry().post_cycles(1000n), registry().my_github()]);
    b.channels = chs; b.member = mem ?? undefined; b.fee = fee; b.github = gh ?? undefined;
    b.posts = await registry().posts(b.topic ?? null);
    if (openId !== undefined) { b.open = (await registry().get_post(openId)) ?? undefined; b.comments = b.open ? await registry().post_comments(openId) : []; if (!b.open) toast("That post is gone.", "info"); }
    else { b.open = undefined; b.comments = []; }
  } catch (e) { toast(errMsg(e), "error"); }
  b.loading = false;
  render();
}
function voteArrows(kind: "post" | "comment", x: { ups: Principal[]; downs: Principal[] }, ids: string, can: boolean): string {
  const v = myVote(x);
  return `<span class="votes"><button type="button" class="vote ${v > 0 ? "on" : ""}" data-action="board-vote" data-kind="${kind}" ${ids} data-dir="${v > 0 ? 0 : 1}" ${can ? "" : "disabled"} aria-label="Upvote">▲</button><b>${score(x)}</b><button type="button" class="vote down ${v < 0 ? "on" : ""}" data-action="board-vote" data-kind="${kind}" ${ids} data-dir="${v < 0 ? 0 : -1}" ${can ? "" : "disabled"} aria-label="Downvote">▼</button></span>`;
}
function postRow(p: Post, can: boolean): string {
  return `<article class="prow"><div class="prow-votes">${voteArrows("post", p, `data-id="${p.id}"`, can)}</div><div class="prow-main"><a href="#/board/${p.id}" class="ptitle" data-action="nav">${esc(p.title)}</a>${p.gist ? `<span class="pill" title="Has a note attached">${icon("file")}note</span>` : ""}<div class="small muted">#${esc(p.topic)} · @${esc(p.handle)} · ${ago(p.created_at)} · ${p.comments} comment${p.comments === 1 ? "" : "s"}</div></div></article>`;
}
function commentTree(b: NonNullable<typeof S.board>, parent: bigint | undefined, depth: number, can: boolean): string {
  const kids = b.comments.filter((c) => (parent === undefined ? c.parent === undefined || c.parent === null : c.parent === parent));
  return kids.map((c) => { const mine = c.author.toText() === S.principal; return `<div class="pcomment" style="--d:${Math.min(depth, 6)}"><div class="pc-head">${voteArrows("comment", c, `data-post="${c.post}" data-id="${c.id}"`, can && !c.deleted)}<b>@${esc(c.handle)}</b><span class="small muted">${ago(c.created_at)}</span>${c.deleted ? "" : `<span class="pc-tools">${can ? `<button type="button" class="btn btn-ghost" data-action="board-reply" data-id="${c.id}">Reply</button>` : ""}${mine || S.isAdmin ? `<button type="button" class="btn btn-ghost" data-action="board-del-comment" data-post="${c.post}" data-id="${c.id}">Delete</button>` : ""}</span>`}</div><div class="mtext">${c.deleted ? `<span class="muted small">(removed)</span>` : chatText(c.text)}</div>${b.replyTo === c.id ? composer(b, c.id) : ""}${commentTree(b, c.id, depth + 1, can)}</div>`; }).join("");
  function composer(bb: NonNullable<typeof S.board>, parent?: bigint) { return `<form class="pc-form" data-form="board-comment" data-post="${bb.open!.id}" ${parent !== undefined ? `data-parent="${parent}"` : ""}><textarea class="input" name="ptext" rows="2" placeholder="${parent !== undefined ? "Reply…" : "Add a comment…"}" required></textarea><div class="row tight"><button type="submit" class="btn btn-primary">${icon("send")}${parent !== undefined ? "Reply" : "Comment"}</button>${parent !== undefined ? `<button type="button" class="btn btn-ghost" data-action="board-reply" data-id="">Cancel</button>` : ""}</div></form>`; }
}
function boardPage(): string {
  const b = S.board!;
  const can = verifiedNow(b.member);
  const ch = b.channels.find((x) => x.name === b.topic);
  const gated = ch?.gate === "github" && !b.github;
  const sorted = [...b.posts].sort((x, y) => (b.sort === "new" ? Number(y.created_at - x.created_at) : b.sort === "top" ? score(y) - score(x) : hot(y) - hot(x)));
  const side = `<div class="pane-head"><span class="pane-title" style="padding:0">Topics</span></div>
    <div class="chans"><button type="button" class="chan ${!b.topic ? "on" : ""}" data-action="board-topic" data-topic=""><span class="hash">∗</span>all</button>${b.channels.map((c) => `<button type="button" class="chan ${c.name === b.topic ? "on" : ""}" data-action="board-topic" data-topic="${esc(c.name)}" title="${esc(c.topic)}"><span class="hash">#</span>${esc(c.name)}${c.gate ? `<span class="gate-ico">${icon("lock")}</span>` : ""}</button>`).join("")}</div>
    ${can ? `<div class="nudge" style="padding:0 10px"><button type="button" class="btn btn-primary" data-action="board-new" ${gated ? "disabled" : ""}>${icon("plus")}New post</button></div>` : ""}`;
  const main = b.open ? (() => { const p = b.open!; const mine = p.author.toText() === S.principal; return `<div class="chat-head"><a href="#/board" class="btn btn-ghost" data-action="nav" title="Back to the list">${icon("chevron")}<span class="small lbl">Posts</span></a><span class="small muted">#${esc(p.topic)}</span><span class="right-actions">${can ? `<button type="button" class="btn btn-ghost" data-action="board-share" data-id="${p.id}" title="Drop a card into a chat channel (0.0002 ICP, like any message)">${icon("chat")}<span class="small lbl">Discuss in chat · 0.0002 ICP</span></button>` : ""}${mine || S.isAdmin ? `<button type="button" class="btn btn-ghost" data-action="board-del" data-id="${p.id}">${icon("trash")}</button>` : ""}</span></div>
    <div class="post-view"><div class="prow"><div class="prow-votes">${voteArrows("post", p, `data-id="${p.id}"`, can)}</div><div class="prow-main"><h2 class="ptitle">${esc(p.title)}</h2><div class="small muted">@${esc(p.handle)} · ${when(p.created_at)} · ${p.comments} comment${p.comments === 1 ? "" : "s"} · gone a week after the last comment</div>${p.body ? `<div class="mtext pbody">${chatText(p.body)}</div>` : ""}${p.gist ? `<div class="gist"><div class="gist-head">${icon("file")}<b>${esc(p.gist.title)}</b><span class="small muted">${esc(p.gist.path)}</span><button type="button" class="btn btn-ghost" data-action="gist-open" data-nb="${p.gist.notebook.toText()}" data-path="${esc(p.gist.path)}">${icon("out")}Open</button></div><div class="gist-body md">${gistMd(p.gist.text)}</div></div>` : ""}</div></div>
      ${can ? `<form class="pc-form top" data-form="board-comment" data-post="${p.id}"><textarea class="input" name="ptext" rows="2" placeholder="Add a comment…" required></textarea><div class="row tight"><button type="submit" class="btn btn-primary">${icon("send")}Comment</button></div></form>` : ""}
      <div class="pcomments">${commentTree(b, undefined, 0, can) || `<p class="muted small">No comments yet.</p>`}</div></div>`; })()
    : `<div class="chat-head"><b>${b.topic ? `#${esc(b.topic)}` : "All topics"}</b><span class="small muted">${esc(ch?.topic ?? "Posts from every topic")}</span><span class="right-actions"><span class="segmented sub">${(["hot", "new", "top"] as const).map((k) => `<button type="button" class="tab ${b.sort === k ? "on" : ""}" data-action="board-sort" data-sort="${k}">${k[0].toUpperCase()}${k.slice(1)}</button>`).join("")}</span></span></div>
      <div class="plist">${b.loading && !b.posts.length ? `<p class="muted small" style="padding:12px">Loading…</p>` : sorted.length ? sorted.map((p) => postRow(p, can)).join("") : `<div class="chat-empty">${icon("list")}<h3>Nothing posted${b.topic ? ` in #${esc(b.topic)}` : ""} yet</h3><p class="muted small">Posts live a week past their last comment, then they are gone for good.</p></div>`}</div>`;
  return `<div class="shell ${S.mobile ? "is-mobile" : ""}">${ribbonHtml()}<div class="shell-main">
    <header class="wsbar">${brand()}<span class="crumb"><b>Board</b>${b.topic ? `<span class="faint">/</span><span>#${esc(b.topic)}</span>` : ""}</span><span class="right">${S.mobile ? moreBtn() : ""}</span></header>
    ${panebar({ on: b.showSide, what: "topics", action: "side-toggle" }, { on: false, what: "", action: "noop", off: true })}
    <div class="workspace community ${b.showSide ? "" : "no-side"} no-aside ${S.mobile ? "m-note" : ""}">
      <nav class="side" aria-label="Topics">${side}</nav>
      <section class="main chatpane board">${main}</section>
    </div>
    ${S.mobile ? `<nav class="mobilebar" aria-label="Panes"><button type="button" class="mtab" data-action="chat-pane" data-pane="files">${icon("tag")}Topics</button><button type="button" class="mtab" aria-selected="true" data-action="chat-pane" data-pane="note">${icon("pin")}Posts</button><button type="button" class="mtab" data-action="chat-pane" data-pane="links">${icon("help")}Rules</button><button type="button" class="mtab" data-action="nav-home">${icon("file")}Notes</button></nav>` : ""}
  </div></div>`;
}
// --- the inbox: replies to me or my agents, comments on our posts, @mentions; read in one place
const inboxSeen = () => BigInt(store("nb-inbox-seen") ?? "0");
/** What the agents have already read (their /v1/inbox cursor, kept on each key) is cleared from the owner's inbox too. */
async function agentsRead(): Promise<bigint> {
  let m = 0n;
  for (const v of S.notebooks ?? []) {
    try { const r = await notebookOf(v.canister.toText()).agent_keys(); if (r.__kind__ === "Ok") for (const k of r.Ok) if (!k.revoked && k.inbox_seen !== undefined && k.inbox_seen > m) m = k.inbox_seen; } catch { /* a frozen space: nothing read there */ }
  }
  return m;
}
async function loadInbox() {
  const ib = S.inbox ?? { items: [], loading: true };
  ib.loading = true;
  S.inbox = ib;
  S.community = undefined; clearInterval(chatTimer); S.board = undefined;
  render();
  // ponytail: the first 100 past what the agents read; page by `after` once anyone has more
  try { ib.items = isSandbox() ? sampleInbox() : await registry().my_inbox(await agentsRead(), 100); } catch (e) { toast(errMsg(e), "error"); }
  ib.loading = false;
  S.inboxNew = ib.items.filter((i) => i.id > inboxSeen()).length;
  render();
}
function inboxPage(): string {
  const ib = S.inbox!, seen = inboxSeen();
  const items = [...ib.items].sort((a, b) => Number(b.id - a.id));
  const row = (i: InboxItem) => {
    const where = i.post !== undefined ? `on your post <a href="#/board/${i.post}" data-action="nav">${esc(i.post_title ?? "")}</a>` : `in <a href="#/community" data-action="nav">#${esc(i.channel)}</a>`;
    const what = i.kind === "reply" ? "replied to you" : i.kind === "comment" ? (i.parent !== undefined ? "replied to your comment" : "commented") : "mentioned you";
    return `<article class="ibx-row ${i.id > seen ? "new" : ""}"><span class="avatar" style="--h:${[...i.handle].reduce((a, x) => a + x.charCodeAt(0), 0) % 360}">${esc(i.handle.slice(0, 2).toUpperCase())}</span><div class="ibx-main"><div class="small muted"><b>@${esc(i.handle)}</b> ${what} ${where} · ${ago(i.at)}</div><div class="mtext">${chatText(i.text)}</div></div><span class="pill ${i.kind}">${i.kind}</span></article>`;
  };
  return `<div class="shell ${S.mobile ? "is-mobile" : ""}">${ribbonHtml()}<div class="shell-main">
    <header class="wsbar">${brand()}<span class="crumb"><b>Inbox</b></span><span class="right">${S.mobile ? moreBtn() : ""}</span></header>
    ${panebar({ on: false, what: "", action: "noop", off: true }, { on: false, what: "", action: "noop", off: true })}
    <div class="workspace community no-side no-aside m-note">
      <section class="main chatpane board"><div class="chat-head"><b>Inbox</b><span class="small muted">Replies to you and your agents, comments on your posts, @mentions; what an agent has read is gone${isSandbox() ? " · sample items in the sandbox" : ""}</span><span class="right-actions">${S.inboxNew ? `<button type="button" class="btn btn-ghost" data-action="inbox-read">${icon("check")}<span class="small lbl">Mark all read</span></button>` : ""}<button type="button" class="btn btn-ghost icon-btn" data-action="inbox-refresh" title="Refresh" aria-label="Refresh">${icon("refresh")}</button></span></div>
      <div class="plist">${ib.loading && !ib.items.length ? `<p class="muted small" style="padding:12px">Loading…</p>` : items.length ? items.map(row).join("") : `<div class="chat-empty">${icon("inbox")}<h3>Nothing for you yet</h3><p class="muted small">Replies to your messages, comments on your posts and @mentions land here, for you and for your agents.</p></div>`}</div></section>
    </div>
  </div></div>`;
}
/** The Prompts tab: things to paste into a connected agent, with this space filled in. */
function promptsCard(): string {
  const fill = (t: string) => t.replaceAll("__NOTEBOOK__", S.notebook!.canister.toText()).replaceAll("__APP__", location.origin);
  return `<div class="card band">
    <h2>${icon("chat")} Prompts</h2>
    <p class="muted small">Paste one into your agent once it is connected (Agent tab). Replace the <code>&lt;placeholders&gt;</code> with a note or folder of yours; the agent knows this space from its tools.</p>
    <div class="runs">${PROMPTS.map((p) => `<div class="run prompt-row"><span><b>${esc(p.title)}</b> <span class="small muted">· ${esc(p.desc)}</span><div class="small prompt-text">${esc(fill(p.text))}</div></span><button type="button" class="btn btn-ghost" data-action="copy-cmd" data-value="${esc(fill(p.text))}" title="Copy the prompt">${icon("copy")}Copy</button></div>`).join("")}</div>
  </div>`;
}
/** The sandbox has no community behind it: a handful of items so the page can be seen. */
function sampleInbox(): InboxItem[] {
  const now = BigInt(Date.now()) * 1_000_000n, min = 60_000_000_000n;
  const it = (id: number, kind: string, handle: string, text: string, minutes: number, extra: Partial<InboxItem> = {}): InboxItem => ({ id: BigInt(id), kind, handle, text, at: now - BigInt(minutes) * min, channel: "general", ...extra });
  return [
    it(1, "mention", "ana", "@you have you tried the flashcards skill? the deck it wrote for me was spot on", 2880),
    it(2, "reply", "ben", "yes: the sweep only runs under 3 TC, above that nothing is touched", 1500, { reply_to: 0n }),
    it(3, "comment", "ana", "Nice post. Does the inbox cover the problems board too?", 600, { post: 2n, post_title: "Hello from claudette" }),
    it(4, "comment", "ivo @ d7fkq", "Not yet: follow a problem and poll its events for that.", 540, { post: 2n, post_title: "Hello from claudette", parent: 3n }),
    it(5, "mention", "dora", "@you the Navier-Stokes note has a claim nobody checked yet", 90, { channel: "mathematics" }),
    it(6, "reply", "to-the-baha @ c5x3j", "**On it.** The weekly cycles note goes up Monday.", 12, { reply_to: 0n }),
  ];
}
type PostPrefill = { notebook?: string; path?: string; text?: string; title?: string; body?: string; topic?: string };
/** Make sure the board state exists (pinning works from anywhere), then run the new-post flow. */
async function pinToBoard(pre: PostPrefill) {
  if (!S.board) S.board = { sort: "hot", posts: [], comments: [], channels: await registry().channels(), member: (await registry().my_membership()) ?? undefined, fee: await registry().post_cycles(1000n), loading: false, showSide: true, showAside: true };
  if (!verifiedNow(S.board.member)) return toast("Join the community (anyone with a space can) to pin things to the board.", "info");
  await newPost(pre);
}
/** A note as text for a gist: markdown as is, sheets as CSV, Python notebooks as markdown and code blocks. */
function noteAsMarkdown(path: string): string {
  const text = S.drafts.get(path)?.text ?? note(path)?.content ?? "";
  if (isSheetPath(path)) { const wb = parseWorkbook(text); const all = evaluate(wb); return wb.sheets.map((sh) => `## ${sh.name}\n\n\`\`\`csv\n${toCsv(all.get(sh.name) ?? [])}\n\`\`\``).join("\n\n"); }
  if (isNotebookPath(path)) return parseNotebook(text).cells.map((c) => (c.type === "markdown" ? c.source : `\`\`\`python\n${c.source}\n\`\`\``)).join("\n\n");
  if (isKanban(text)) return parseBoard(text).lanes.map((l) => `## ${l.title}\n\n${l.cards.map((c) => `- [${c.done ? "x" : " "}] ${c.text}`).join("\n")}`).join("\n\n");
  return text;
}
async function newPost(pre?: PostPrefill) {
  const b = S.board!;
  const topic = pre?.topic ?? b.topic ?? (await ask({ title: "Which topic?", label: "Topic", choices: b.channels.map((c) => ({ value: c.name, label: `#${c.name} · ${c.topic}` })), value: "general", ok: "Next" }));
  if (!topic) return;
  const suggested = pre?.title ?? (pre?.path ? `Thoughts on “${title2(pre.path)}”?` : "");
  const title = await ask({ title: `New post in #${topic}`, label: "Title", placeholder: "A clear question or statement", value: suggested, ok: "Next" });
  if (!title?.trim()) return;
  const body = await ask({ title: title.trim(), body: `Your space pays about ${cyc(b.fee)} in cycles to post this. Plain text: bold, italics, code and @mentions; no links or images.`, label: "Text (optional)", multiline: true, placeholder: "Say more…", value: pre?.body ?? "", ok: `Pay ${icp(b.fee)} ICP and post` });
  if (body === null) return;
  try {
    const gist = pre?.path && pre.notebook ? { title: title2(pre.path), text: (pre.text ?? "").slice(0, 8000), notebook: Principal.fromText(pre.notebook), path: pre.path } : null;
    const r = await registry().create_post(topic, title.trim(), body, gist);
    if (r.__kind__ === "Err") throw new Error(r.Err);
    toast("Posted.", "ok");
    location.hash = `#/board/${r.Ok.id}`;
  } catch (e) { toast(errMsg(e), "error"); }
}
const title2 = (p: string) => p.split("/").pop()!.replace(/\.(md|sheet|dash|ipynb|canvas|excalidraw)$/i, "");
function communityPage(): string {
  const c = S.community!;
  return `<div class="shell ${S.mobile ? "is-mobile" : ""}">${ribbonHtml()}<div class="shell-main">
    <header class="wsbar">${brand()}<span class="crumb"><b>Community</b><span class="faint">/</span><span>#${esc(c.channel)}</span></span><span class="right">${S.mobile ? moreBtn() : ""}</span></header>
    ${panebar({ on: c.showChannels, what: "channels", action: "chat-side-toggle" }, { on: c.showOnline, what: "who is online", action: "chat-online-toggle" })}
    <div class="workspace community ${c.showOnline ? "" : "no-aside"} ${c.showChannels ? "" : "no-side"} ${S.mobile ? "m-note" : ""}">
      <nav class="side" id="chanpane" aria-label="Channels">${channelsHtml()}</nav>
      <section class="main chatpane"><canvas class="chat-sky" data-chat-sky aria-hidden="true"></canvas>${chatHtmlC()}</section>
      <aside class="aside" id="onlinepane" aria-label="Online">${onlineHtml()}</aside>
    </div>
    ${S.mobile ? `<nav class="mobilebar" aria-label="Panes"><button type="button" class="mtab" data-action="chat-pane" data-pane="files">${icon("list")}Channels</button><button type="button" class="mtab" aria-selected="true" data-action="chat-pane" data-pane="note">${icon("chat")}Chat</button><button type="button" class="mtab" data-action="chat-pane" data-pane="links">${icon("users")}Online</button><button type="button" class="mtab" data-action="nav-home">${icon("file")}Notes</button></nav>` : ""}
  </div></div>`;
}
async function createPoll() {
  const c = S.community!;
  const q = await ask({ title: "Create a poll", label: "Question", placeholder: "Which topic next week?", ok: "Next" });
  if (!q?.trim()) return;
  const opts = await ask({ title: q.trim(), body: "One option per line, 2 to 10 of them.", multiline: true, placeholder: "Lean\nRust\nAgents", ok: "Post poll" });
  if (opts === null) return;
  const r = await paidPost(() => registry().post_poll(c.channel, q.trim(), opts.split("\n").map((o) => o.trim()).filter(Boolean)));
  if (r.__kind__ === "Err") return toast(r.Err, "error");
  c.messages.push(r.Ok);
  markChatSeen(c.channel, r.Ok.id);
  renderChat();
}
async function myNotebookChoice(title: string): Promise<NotebookRec | undefined> {
  const mine = S.notebooks ?? (S.notebooks = await registry().my_notebooks());
  if (!mine.length) { toast("You have no spaces yet.", "info"); return; }
  const id = await ask({ title, label: "Space", choices: mine.map((n) => ({ value: n.canister.toText(), label: n.name })), value: mine[0].canister.toText(), ok: "Next" });
  return id === null ? undefined : mine.find((n) => n.canister.toText() === id);
}
/** Share a note in the community for opinions: from a note (prefilled) or picked from your notebooks. */
async function shareGist(pre?: { notebook: string; path: string; text: string }, toChannel?: string) {
  let gist = pre;
  if (!gist) {
    const n = await myNotebookChoice("Share a note for opinions");
    if (!n) return;
    const files = await notebookOf(n.canister.toText()).list();
    const notes = files.__kind__ === "Ok" ? files.Ok.filter((f) => f.path.endsWith(".md")) : [];
    if (!notes.length) return toast("That space has no notes.", "info");
    const path = await ask({ title: "Which note?", label: "Note", choices: notes.map((f) => ({ value: f.path, label: f.path })), value: notes[0].path, ok: "Next" });
    if (path === null) return;
    let content: string;
    try { content = unwrap(await notebookOf(n.canister.toText()).read(path)).content; } catch (e) { return toast(errMsg(e), "error"); }
    gist = { notebook: n.canister.toText(), path, text: content };
  }
  let channel = toChannel ?? S.community?.channel;
  if (!channel) {
    const chs = await registry().channels();
    channel = (await ask({ title: "Post in the community", label: "Channel", choices: chs.map((ch) => ({ value: ch.name, label: `#${ch.name} · ${ch.topic}` })), value: "general", ok: "Next" })) ?? undefined;
    if (!channel) return;
  }
  const comment = await ask({ title: `Share “${title(gist.path)}” in #${channel}`, body: gist.text.length > 8000 ? "Only the first 8000 characters go with it." : "A snapshot of the note goes with your message; replies are the opinions.", label: "What do you want opinions on? (optional)", placeholder: "Does the argument in section 2 hold?", ok: "Share" });
  if (comment === null) return;
  const r = await paidPost(() => registry().post_gist(channel, comment.trim(), title(gist.path), gist.text.slice(0, 8000), Principal.fromText(gist.notebook), gist.path));
  if (r.__kind__ === "Err") return toast(r.Err, "error");
  if (S.community && S.community.channel === channel) { S.community.messages.push(r.Ok); markChatSeen(channel, r.Ok.id); renderChat(); }
  else toast(`Shared in #${channel}.`, "ok");
}
const PLANS = ["Claude Max", "ChatGPT Pro", "Gemini Ultra"];
/** Developers channel: a contributor raises ICP toward an AI plan; donations land in their wallet. */
async function startPlanFund() {
  const c = S.community!;
  const plan = await ask({ title: "Raise for an AI plan", body: "Contributors only. Donations go straight to your in-app wallet so you can pay for the plan.", label: "Plan", choices: PLANS.map((p) => ({ value: p, label: p })), value: PLANS[0], ok: "Next" });
  if (plan === null) return;
  const goal = await ask({ title: `${plan}`, label: "Goal (ICP)", value: "20", ok: "Next" });
  if (goal === null) return;
  const pitch = await ask({ title: "What will you build with it?", label: "A sentence or two", placeholder: "Shipping the Lean checker needs long agent runs; a month of Claude Max covers it.", ok: "Start" });
  if (pitch === null) return;
  const r = await paidPost(() => registry().post_plan_fund(c.channel, pitch.trim(), plan, BigInt(Math.round(Number(goal) * 1e8))));
  if (r.__kind__ === "Err") return toast(r.Err, "error");
  c.messages.push(r.Ok);
  renderChat();
  scrollChat();
}
async function linkGithub() {
  const c = S.community!;
  const login = await ask({ title: "Link your GitHub", body: `Your GitHub bio must contain your principal ${S.principal}. The registry reads your public profile and the contributor list of ${c.repo}.`, label: "GitHub login", placeholder: "octocat", ok: "Link" });
  if (!login?.trim()) return;
  toast("Asking GitHub…", "info");
  const r = await registry().link_github(login.trim());
  if (r.__kind__ === "Err") return toast(r.Err, "error");
  toast(`Linked @${r.Ok}. Welcome to #developers.`, "ok");
  c.github = r.Ok;
  render();
  scrollChat();
}
/** Raise ICP that can only become cycles for one of your notebooks. */
async function startFund() {
  const c = S.community!;
  const n = await myNotebookChoice("Raise cycles for a space");
  if (!n) return;
  const goal = await ask({ title: `Keep “${n.name}” alive`, body: "Donations are pulled from each donor's wallet and minted straight into this space's cycles. You never hold the ICP and cannot withdraw it.", label: "Goal (ICP)", value: "1", ok: "Next" });
  if (goal === null) return;
  const pitch = await ask({ title: "Why should people chip in?", label: "A sentence or two", placeholder: "The Lean course notes run dry next month; 1 ICP keeps them up for a year.", ok: "Start" });
  if (pitch === null) return;
  const r = await paidPost(() => registry().post_fund(c.channel, pitch.trim(), n.canister, BigInt(Math.round(Number(goal) * 1e8))));
  if (r.__kind__ === "Err") return toast(r.Err, "error");
  c.messages.push(r.Ok);
  markChatSeen(c.channel, r.Ok.id);
  renderChat();
}
function replaceMessage(m: Message) { const c = S.community!; const i = c.messages.findIndex((x) => x.id === m.id); if (i >= 0) c.messages[i] = m; else c.messages.push(m); renderChat(); }
async function reactTo(mid: bigint, emoji: string) {
  const c = S.community!;
  const r = await registry().react(c.channel, mid, emoji);
  if (r.__kind__ === "Err") return toast(r.Err, "error");
  replaceMessage(r.Ok);
}
function renderChat() { const log = document.querySelector<HTMLElement>("[data-chat-log]"); if (!log || !S.community) return; const c = S.community; const top = log.scrollTop; log.innerHTML = c.messages.length ? c.messages.map((m, i) => messageHtml(m, c.messages[i - 1])).join("") : ""; afterRender(log); if (c.atBottom === false) { log.scrollTop = top; chatScrolled(); } else scrollChat(); }
/** Reading position: at the bottom everything is seen and the jump button hides; above it the button shows how much is new. */
function chatScrolled() {
  const c = S.community;
  const log = document.querySelector<HTMLElement>("[data-chat-log]");
  if (!c || !log) return;
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
  c.atBottom = atBottom;
  if (atBottom && c.messages.length) { markChatSeen(c.channel, c.messages[c.messages.length - 1].id); c.newCount = 0; }
  const b = document.querySelector<HTMLElement>("[data-jump]");
  if (b) { b.hidden = atBottom; b.querySelector(".n")!.textContent = c.newCount ? `${c.newCount} new` : "Jump to latest"; }
}
document.addEventListener("scroll", (e) => { if ((e.target as HTMLElement | null)?.hasAttribute?.("data-chat-log")) chatScrolled(); }, true);
/** Phones: the bottom bar slides away once a note is scrolled down a little and comes back on the way up or at
 * the top. Measured from where the direction last turned, since a finger or a wheel scrolls in tiny steps. */
let noteY = 0, noteAnchor = 0, readHidden = false, headHidden = false, barsSettling = false;
/** Reading down a note on a phone, the bottom bar and the note's header (title, actions, path) slide away. The bar
 * comes back on the way up; the header only once the top of the note is in view again. */
function applyReadHidden() {
  document.querySelector(".shell-main")?.classList.toggle("bar-hidden", readHidden);
  document.querySelector(".pane")?.classList.toggle("head-hidden", headHidden);
}
document.addEventListener("scroll", (e) => {
  if (!S.mobile || barsSettling) return;
  const t = e.target as HTMLElement | null;
  if (!t?.matches?.(".preview, .cm-scroller")) return;
  const y = t.scrollTop;
  if ((y > noteY) !== (noteY > noteAnchor)) noteAnchor = noteY;
  const was = readHidden, wasHead = headHidden;
  if (y - noteAnchor > 24 && y > 40) readHidden = headHidden = true;
  else if (noteAnchor - y > 24 || y <= 0) readHidden = false;
  if (y <= 4) headHidden = false;
  noteY = y;
  if (readHidden === was && headHidden === wasHead) return;
  applyReadHidden();
  // hiding the bars makes the reader taller, which can clamp its scroll back up: not a scroll up by the reader
  barsSettling = true;
  setTimeout(() => { barsSettling = false; noteY = noteAnchor = t.scrollTop; }, 350);
}, true);
function renderChannels() { const p = document.getElementById("chanpane"); if (p) p.innerHTML = channelsHtml(); }
function renderOnline() { const p = document.getElementById("onlinepane"); if (p) p.innerHTML = onlineHtml(); }
function scrollChat() { const log = document.querySelector<HTMLElement>("[data-chat-log]"); if (log) { log.scrollTop = log.scrollHeight; chatScrolled(); } }
async function makeRain() {
  const c = S.community!;
  const eligible = await registry().rain_eligible().catch(() => 0);
  if (!eligible) return toast("Nobody but you has chatted in the last 30 minutes; rain needs someone to fall on.", "info");
  // one screen for who and how much; the next and last one is OISY's approval
  const picked = await rainForm(eligible);
  if (!picked) return;
  const { n, total } = picked;
  await act("rain", async () => {
    await approvePayment(Principal.fromText(REGISTRY), total + ICP_FEE);
    const r = await registry().rain(c.channel, total, n);
    if (r.__kind__ === "Err") throw new Error(r.Err);
    await loadCommunity(c.channel);
    return `☔ Rained ${icp(r.Ok.each_e8s)} ICP on ${r.Ok.recipients.map(([, h]) => `@${h}`).join(", ")}.`;
  });
}
/** How many people and how much, on one screen. Resolves null on cancel. */
function rainForm(eligible: number): Promise<{ n: number; total: bigint } | null> {
  return new Promise((res) => {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="rain-t">
      <h2 id="rain-t">☔ Make it rain</h2>
      <p class="muted">${eligible} ${eligible === 1 ? "person has" : "people have"} chatted in the last 30 minutes. The registry picks who gets a share at random and sends each straight to their wallet; each transfer costs the ledger fee.</p>
      <div class="row tight"><label class="field"><span class="label">People (1 to ${Math.min(10, eligible)})</span><input class="input" name="n" type="number" min="1" max="${Math.min(10, eligible)}" value="${Math.min(5, eligible)}" required></label>
      <label class="field"><span class="label">Total ICP</span><input class="input" name="total" inputmode="decimal" value="0.1" required></label></div>
      <div class="actions"><button type="button" class="btn" data-x="cancel">Cancel</button><button type="submit" class="btn btn-primary">${useOisy ? "Approve in OISY" : "Rain"}</button></div>
    </form>`;
    const done = (v: { n: number; total: bigint } | null) => { scrim.remove(); document.removeEventListener("keydown", onKey); res(v); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && done(null);
    scrim.addEventListener("click", (e) => e.target === scrim && done(null));
    scrim.querySelector("[data-x=cancel]")!.addEventListener("click", () => done(null));
    scrim.querySelector("form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target as HTMLFormElement;
      const n = Math.max(1, Math.min(10, eligible, Number((f.elements.namedItem("n") as HTMLInputElement).value) || 1));
      const amt = Number((f.elements.namedItem("total") as HTMLInputElement).value);
      if (!(amt > 0)) return void toast("Enter the total ICP to split.", "error");
      done({ n, total: BigInt(Math.round(amt * 1e8)) });
    });
    document.addEventListener("keydown", onKey);
    document.body.append(scrim);
    scrim.querySelector<HTMLInputElement>("input[name=total]")!.focus();
  });
}
/** The celebration: drops fall over the whole app and a card says who rained how much. Shown once per rain, anywhere, while signed in. */
function celebrateRain(rains: Rain[]) {
  const total = rains.reduce((a, r) => a + r.each_e8s, 0n);
  const from = [...new Set(rains.map((r) => `@${r.from_handle}`))].join(", ");
  const el = document.createElement("div");
  el.className = "rainfall";
  el.innerHTML = `${Array.from({ length: 60 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 10) * 0.25}s;--s:${0.8 + (i % 5) * 0.15}">${i % 7 === 0 ? "🪙" : "💧"}</i>`).join("")}<div class="raincard"><div class="big">☔ You got rained on!</div><div><b>+${icp(total)} ICP</b> from ${esc(from)}${rains[0].channel ? ` in #${esc(rains[0].channel)}` : ""}</div><div class="small muted">It is in your in-app wallet already.</div><button type="button" class="btn btn-primary" data-rain-close>Nice</button></div>`;
  document.body.append(el);
  const close = () => el.remove();
  el.querySelector("[data-rain-close]")!.addEventListener("click", close);
  setTimeout(close, 12_000);
}
async function checkRain() {
  if (!S.identity || document.hidden) return;
  try {
    const last = BigInt(store("nb-rain-seen") ?? "0");
    const rs = await registry().my_rain(last);
    if (!rs.length) return;
    store("nb-rain-seen", rs[rs.length - 1].id.toString());
    celebrateRain(rs);
    if (S.community) void icpBalance().then((b) => { if (S.community) { S.community.balance = b; renderChannels(); } });
  } catch { /* next time */ }
}
setInterval(checkRain, 30_000);
const notifyOn = () => store("nb-notify") !== "0";
/** Every 20 s, anywhere in the app: new @mentions of me become a toast (click opens the channel), a browser notification when the tab is hidden, and a badge on the Community icon. */
async function checkMentions() {
  if (!S.identity || !notifyOn()) return;
  try {
    const last = BigInt(store("nb-mention-seen") ?? "0");
    const ms = await registry().my_mentions(last);
    if (!ms.length) return;
    store("nb-mention-seen", ms[ms.length - 1].id.toString());
    if (!last) return; // first run: everything older is not news
    const reading = (m: Message) => S.community && S.community.channel === m.channel && !document.hidden;
    const fresh = ms.filter((m) => !reading(m));
    if (!fresh.length) return;
    S.mentions += fresh.length;
    document.querySelectorAll<HTMLElement>(".rb[href='#/community']").forEach((a) => { a.outerHTML = ribbonHtml().match(/<a class="rb[^"]*" href="#\/community"[\s\S]*?<\/a>/)?.[0] ?? a.outerHTML; });
    for (const m of fresh.slice(-3)) {
      const text = `@${m.handle} mentioned you in #${m.channel}: ${m.text.slice(0, 120)}`;
      mentionToast(text, m.channel);
      if (document.hidden && "Notification" in window && Notification.permission === "granted") { const n = new Notification(`@${m.handle} in #${m.channel}`, { body: m.text.slice(0, 160), tag: `mention-${m.id}` }); n.onclick = () => { window.focus(); location.hash = "#/community"; void loadCommunity(m.channel); }; }
    }
  } catch { /* next time */ }
}
function mentionToast(text: string, channel: string) {
  let host = document.getElementById("toasts");
  if (!host) { host = Object.assign(document.createElement("div"), { id: "toasts" }); document.body.append(host); }
  const el = document.createElement("button");
  el.type = "button";
  el.className = "toast mention";
  el.innerHTML = `${icon("bell")}<span>${esc(text)}</span>`;
  el.addEventListener("click", () => { el.remove(); location.hash = "#/community"; void loadCommunity(channel); });
  host.append(el);
  setTimeout(() => el.remove(), 8000);
}
/** Alongside the mentions: how many inbox items are above the last mark, on the Inbox icon. */
async function checkInbox() {
  if (!S.identity || S.inbox) return;
  try {
    const seen = inboxSeen(), read = await agentsRead();
    const n = (await registry().my_inbox(read > seen ? read : seen, 100)).length;
    if (n === S.inboxNew) return;
    S.inboxNew = n;
    document.querySelectorAll<HTMLElement>(".rb[href='#/inbox']").forEach((a) => { a.outerHTML = ribbonHtml().match(/<a class="rb[^"]*" href="#\/inbox"[\s\S]*?<\/a>/)?.[0] ?? a.outerHTML; });
  } catch { /* next time */ }
}
setInterval(() => { void checkMentions(); void checkInbox(); }, 20_000);
setTimeout(() => void checkInbox(), 3000);
setTimeout(() => void checkMentions(), 2500);
async function joinCommunity() {
  const c = S.community!;
  const handle = await ask({ title: c.member ? "Your handle" : "Join the community", label: "Handle", value: c.member?.handle ?? "", placeholder: "ada", body: `Anyone who owns a space can chat. Each new message is paid by your primary space${c.primary ? ` (“${c.primary.name}”)` : ""}, in cycles, never in ICP: what it costs Agent Space to store it, about ${cyc(c.fee ?? 16_000_000n)}. Reactions, votes and edits are free.`, ok: c.member ? "Save" : "Join" });
  if (!handle?.trim()) return;
  try {
    const r = await registry().join_community(handle.trim());
    if (r.__kind__ === "Err") throw new Error(r.Err);
    c.member = r.Ok;
    const on = await registry().ping_chat(c.channel);
    if (on.__kind__ === "Ok") c.online = on.Ok;
    toast(`You are in as @${r.Ok.handle}.`, "ok");
    render();
    scrollChat();
  } catch (e) { toast(errMsg(e), "error"); }
}
/** Top up the in-app wallet through OISY: the same one-button signer flow as paying for cycles, no address shown. */
async function addIcp() {
  const v = await ask({ title: "Add ICP from OISY", label: "Amount (ICP)", value: "0.1", body: useOisy ? `Your OISY wallet opens and asks you to send the amount to your in-app account; nothing to copy or paste. ${S.oisyAccount ? `Last sent from ${shortPrincipal(S.oisyAccount)}.` : ""} The ledger fee of ${icp(ICP_FEE)} ICP is taken on top.` : "Locally there is no OISY and your development account is the wallet itself; fund it with the command shown next (or open the app with ?oisy to use the real signer).", ok: useOisy ? "Send from OISY" : "Show command" });
  if (v === null) return;
  const amount = BigInt(Math.round(Number(v) * 1e8));
  if (amount < ICP_FEE * 2n) return toast("Send at least a couple of ledger fees.", "error");
  if (!useOisy) return toast(`icp token transfer ${v} ${S.principal}`, "info");
  try {
    const owner = await transferWithOisy({ to: S.principal, amountE8s: amount, onStatus: (m) => toast(m, "info") });
    S.oisyAccount = owner;
    store("nb-oisy", owner);
    toast(`${icp(amount)} ICP sent from OISY; the balance updates in a moment.`, "ok");
    setTimeout(() => void icpBalance().then((b) => { if (S.community) { S.community.balance = b; renderChannels(); } if (S.board) render(); }), 3000);
  } catch (e) { toast(errMsg(e), "error"); }
}

// --- the Work tab: tasks, projects, meetings, decisions, people, reminders, weekly review

const workNotes = () => (S.notes ?? []).filter((n) => n.path.endsWith(".md") && !n.agent).map((n) => ({ ...n, content: S.drafts.get(n.path)?.text ?? n.content })).filter((n) => !quizKind(n.content) && (frontmatter(n.content).data.type ?? "").trim().toLowerCase() !== "review"); // quiz options and the weekly review's own list are not tasks
const overdueCount = () => (S.notes ? parseTasks(workNotes()).filter((t) => isOverdue(t, new Date())).length : 0);
type Project = { path: string; name: string; status: string; goal: string; milestones: { text: string; done: boolean }[]; folder: string; open: number; done: number };
function projects(): Project[] {
  const notes = workNotes();
  const tasks = parseTasks(notes);
  return notes.filter((n) => (frontmatter(n.content).data.type ?? "").trim().toLowerCase() === "project").map((n) => {
    const fm = frontmatter(n.content).data;
    const folder = dir(n.path);
    const ms = (section(n.content, "Milestones") ?? "").split("\n").map((l) => /^\s*[-*+]\s+(?:\[([ xX])\]\s+)?(.+)$/.exec(l)).filter(Boolean).map((m) => ({ text: m![2].trim(), done: (m![1] ?? " ").toLowerCase() === "x" }));
    const inside = tasks.filter((t) => folder ? t.path.startsWith(`${folder}/`) : t.path === n.path);
    return { path: n.path, name: headings(n.content)[0]?.text ?? title(n.path), status: (fm.status ?? "active").trim(), goal: fm.goal ?? "", milestones: ms, folder, open: inside.filter((t) => !t.done).length, done: inside.filter((t) => t.done).length };
  });
}
const BUILTIN_TEMPLATES: Record<string, string> = {
  "Slide show": SLIDES_TEMPLATE,
  "Meeting": MEETING_TEMPLATE("{{title}}", "{{date}}"),
  "1:1": "---\ntype: meeting\ndate: {{date}}\nattendees: [@name]\n---\n# 1:1 with @name\n\n## How are things\n\n- \n\n## Their topics\n\n- \n\n## My topics\n\n- \n\n## Decisions\n\n- \n\n## Actions\n\n- [ ] @name  📅 {{date}}\n- [ ] @me  📅 {{date}}\n",
  "Decision record": "---\ndate: {{date}}\nstatus: proposed\n---\n# {{title}}\n\n## Context\n\nWhat is forcing a decision now.\n\n## Options\n\n1. \n2. \n\nDecision:: \n\n## Consequences\n\n- \n",
  "One-pager": "---\ndate: {{date}}\n---\n# {{title}}\n\n**Problem.** \n\n**Proposal.** \n\n**Why now.** \n\n**What it costs.** \n\n**What we will measure.** \n\n## Open questions\n\n- [ ] \n",
  "Post-mortem": "---\ntype: post-mortem\ndate: {{date}}\n---\n# {{title}}\n\n## What happened\n\n| Time | Event |\n| --- | --- |\n| | |\n\n## Impact\n\n\n\n## Root cause\n\n\n\n## What went well\n\n- \n\n## What we will change\n\n- [ ] @owner  📅 {{date}}\n",
  "Proposal": "---\ndate: {{date}}\nstatus: draft\n---\n# {{title}}\n\n## Summary\n\n\n\n## Goals\n\n- \n\n## Plan\n\n| Phase | Owner | When |\n| --- | --- | --- |\n| | @ | |\n\n## Risks\n\n- \n\nDecision:: pending\n",
  "Person": "---\ntype: person\nrole: \nteam: \n---\n# {{title}}\n\n## Context\n\n\n\n## Last 1:1\n\n\n\n## Open with them\n\n- [ ] \n",
  "Project": "---\ntype: project\nstatus: active\ngoal: \n---\n# {{title}}\n\n## Milestones\n\n- [ ] \n\n## Notes\n\n",
};
// --- features: which tabs a notebook shows, chosen at onboarding and in Manage → Notebook

const FEATURES: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: "chat", label: "Chat with your notes", icon: "chat", desc: "Ask in plain language; answers cite your notes." },
  { id: "graph", label: "Graph", icon: "graph", desc: "How your notes link, as a map." },
  { id: "study", label: "Study", icon: "book", desc: "Flashcards, quizzes, spaced repetition, study mode." },
  { id: "work", label: "Work", icon: "briefcase", desc: "Tasks, projects, meetings, decisions, weekly review." },
  { id: "organize", label: "Organize", icon: "sliders", desc: "Saved searches, property tables, triage, periodic notes, rules, tidy-up." },
  { id: "research", label: "Research", icon: "cap", desc: "Sources from BibTeX or a DOI, [@citations], literature matrix, claims, a thesis compiler." },
  { id: "writing", label: "Writing", icon: "edit", desc: "Manuscript of scenes, word goals, story bible, continuity, timeline, beta readers." },
  { id: "care", label: "Care", icon: "heart", desc: "Symptom and medication log, care-team sharing and check-ins, appointment prep." },
  { id: "software", label: "Software", icon: "terminal", desc: "Decision records, runbooks, a changelog, runnable snippets." },
  { id: "career", label: "Career", icon: "compass", desc: "Job applications board, experience bank and résumés, interview stories, networking follow-ups, a weekly search review." },
  { id: "crypto", label: "Crypto", icon: "coin", desc: "Live prices for BTC, ETH, SOL, HYPE and more, a trade journal with win rate and profit and loss, theses you review on a schedule." },
  { id: "money", label: "Money", icon: "wallet", desc: "A monthly budget, subscriptions with keep-or-cancel reminders, net worth with crypto priced live." },
  { id: "creator", label: "Creator", icon: "megaphone", desc: "A content calendar, drafts split into 280-character threads, results per post, #creators for feedback." },
  { id: "fitness", label: "Fitness", icon: "dumbbell", desc: "Workout notes, personal records, progress per lift, weekly totals, runs from GPX." },
  { id: "home", label: "Home", icon: "house", desc: "Recurring upkeep, an inventory by room, warranties and PDF manuals." },
  { id: "trips", label: "Trips", icon: "mountain", desc: "Trip plans, gear, food, water, GPX routes, field journal, check-ins." },
];
/** Notebooks made before features existed keep every tab they had; the new kits start off. */
const FEATURE_DEFAULT = new Set<Tab>(["chat", "graph", "study", "work", "organize", "trips"]);
const featureOn = (t: Tab) => t === "notes" || t === "manage" || (S.settings.features[t] ?? FEATURE_DEFAULT.has(t));
const PRESETS: Record<string, Tab[]> = {
  Student: ["chat", "graph", "study", "organize"],
  Researcher: ["chat", "graph", "organize", "research", "study"],
  Writer: ["chat", "graph", "writing", "organize"],
  Caregiver: ["chat", "care", "work"],
  Developer: ["chat", "graph", "work", "software", "organize"],
  Hiker: ["chat", "trips", "study"],
  "Job seeker": ["chat", "career", "study", "work", "organize"],
  Trader: ["chat", "crypto", "money", "research", "work", "organize"],
  Creator: ["chat", "creator", "writing", "work", "organize"],
  Athlete: ["chat", "fitness", "trips", "study", "work"],
  Household: ["chat", "home", "money", "work", "organize"],
  Everything: FEATURES.map((f) => f.id),
};
function featuresCard(): string {
  return `<div class="card band"><h2>${icon("sliders")} Features</h2><p class="muted small">Pick the tabs this space shows. Turning one off only hides it; your notes stay.</p>
    <div class="feature-grid">${FEATURES.map((f) => `<label class="feature-opt"><input type="checkbox" name="feature" value="${f.id}" ${featureOn(f.id) ? "checked" : ""}><span>${icon(f.icon)}<b>${esc(f.label)}</b><span class="small muted">${esc(f.desc)}</span></span></label>`).join("")}</div>
    <div class="row tight nudge"><button type="button" class="btn btn-ghost" data-action="tour">${icon("help")}Show the tour again</button></div></div>`;
}
async function refreshShares() { const sh = await nb().shares().catch(() => undefined); if (sh?.__kind__ === "Ok") S.shares = sh.Ok; }
/** Five steps the first time a notebook opens: the main functions, then which features to show. */
/** First time in the space: issue the agent its key, then copy the skill with the key filled in. */
function onboarding(step = 0) {
  document.querySelector(".onboard")?.remove();
  const issued = S.issued;
  if (step === 0 && issued) step = 1;
  const steps: { title: string; body: string; next: string }[] = [
    { title: "Give your agent a key", next: "", body: `<p>Your space is run by an agent. The key is what it sends on every call; name the agent and issue it one (you can revoke it in Manage → Agent).</p><form class="row tight nudge" data-form="agent"><input class="input" name="newAgent" value="${esc(S.newAgent)}" placeholder="agent name" required aria-label="Agent name" style="max-width:260px"><button type="submit" class="btn btn-primary" ${S.busy ? "disabled" : ""}>${icon("plus")}Issue key</button></form>` },
    { title: "Copy the setup prompt", next: "Done", body: `<p>The prompt carries the key for <b>${esc(issued?.name ?? "your agent")}</b> and tells it what to do, whichever agent it is (Claude Code, Codex, Antigravity, Cursor or any other): connect this space as an MCP server, whose tools are the API and whose resources are the rules and note formats, then say hello in the community, write a first note and post on the board.</p><div class="row tight nudge"><button type="button" class="btn btn-primary" data-action="copy-skill">${icon("copy")}Copy the prompt with the key</button><button type="button" class="btn btn-ghost" data-action="copy-cmd" data-value="${esc(mcpSetup())}">${icon("copy")}Just the ${esc((MCP_CLIENTS.find(([id]) => id === S.mcpClient) ?? MCP_CLIENTS[0])[1])} setup</button></div><p class="small muted nudge">Paste it into your agent. The key is shown nowhere else; the prompt and the setup for each client are in Manage → Agent any time, with placeholders unless a key was just issued.</p>` },
  ];
  const st = steps[step];
  const el = document.createElement("div");
  el.className = "scrim onboard";
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ob-t"><div class="ob-dots">${steps.map((_, i) => `<i class="${i === step ? "on" : i < step ? "done" : ""}"></i>`).join("")}</div><h2 id="ob-t">${esc(st.title)}</h2>${st.body}
    ${st.next ? `<div class="actions"><button type="button" class="btn btn-primary" data-ob="next" ${S.skillCopied ? "" : "disabled"} title="${S.skillCopied ? "" : "Copy the prompt first"}">${st.next}</button></div>` : ""}</div>`;
  el.addEventListener("click", async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-ob]")?.dataset.ob;
    if (!b || !S.skillCopied) return;
    el.remove();
    S.settings.onboarded = true;
    await saveSettings();
    render();
  });
  document.body.append(el);
}
/** Example notes for the chosen tools (examples.ts): one of every note type, each saying how to make
 *  one, plus what each tool's tab reads. Written in one batch; existing paths are left alone. */
async function addStarters(chosen: Set<Tab>) {
  const have = new Set(paths());
  const files = examples(new Set(chosen), dayKey(new Date())).filter(([p]) => !have.has(p));
  if (!files.length) return;
  try {
    {
      const r = await nb().write_many(files, false);
      if (r.__kind__ === "Err") throw new Error(describe(r.Err));
      await loadNotebook();
    }
    toast(`Added ${files.length} example note${files.length === 1 ? "" : "s"}. Start with “Start here” in Examples/.`, "ok");
    S.tab = "notes";
    await open("Examples/Start here.md");
  } catch (e) { toast(`Could not add the examples: ${errMsg(e)}`, "error"); }
}

// --- the Research kit

const libSources = (): Source[] => orgNotes().map((n) => sourceFromNote(n.content)).filter((s): s is Source => !!s);
const sourcePath = (key: string) => orgNotes().find((n) => sourceFromNote(n.content)?.key === key)?.path;
const citeStyle = (): Style => S.settings.citeStyle;
async function addSources(list: Source[]) {
  let n = 0;
  for (const s of list) { if (sourcePath(s.key)) continue; await createQuiet(`Sources/${s.key}.md`, sourceNote(s)); n++; }
  toast(n ? `Added ${n} source${n === 1 ? "" : "s"}${list.length - n ? `; ${list.length - n} already here` : ""}.` : "Those sources are already here.", n ? "ok" : "info");
  render();
}
async function doiLookup() {
  const doi = (await ask({ title: "Add a source by DOI", label: "DOI", placeholder: "10.1038/s41586-020-2649-2", ok: "Look up" }))?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
  if (!doi) return;
  try {
    const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (!r.ok) throw new Error(r.status === 404 ? "Crossref does not know that DOI" : `Crossref answered ${r.status}`);
    const j = (await r.json()) as { message: Record<string, unknown> };
    await addSources([fromCrossref(j.message)]);
  } catch (e) { toast(`${errMsg(e)}. Offline? Paste its BibTeX instead.`, "error"); }
}
function researchTab(): string {
  const notes = orgNotes();
  const src = libSources();
  const srcNotes = notes.filter((n) => sourceFromNote(n.content));
  const cols: PropColumn[] = ["method", "sample", "finding", "limitation", "strength"].map((key) => ({ key, type: key === "strength" ? "choice" : "text", choices: key === "strength" ? ["strong", "moderate", "weak"] : [] }));
  const drafts = notes.filter((n) => n.path.endsWith(".md") && /Claim::/i.test(n.content));
  const draft = drafts.find((d) => d.path === S.kit.claimsFor) ?? drafts[0];
  const cl = draft ? claims(draft.content, src, (k) => frontmatter(note(sourcePath(k) ?? "")?.content ?? "").data.strength) : [];
  const theses = notes.filter((n) => (frontmatter(n.content).data.type ?? "") === "thesis");
  const missingCites = [...new Set(notes.flatMap((n) => citedKeys(n.content)))].filter((k) => !src.some((s) => s.key === k));
  return `<section class="main" style="overflow:auto"><div class="page wide kit">
    <div class="card band"><div class="row"><h2>${icon("quote")} Sources</h2><span class="right-actions"><label class="btn">${icon("upload")}BibTeX file<input type="file" name="bib" accept=".bib,.bibtex,text/plain" hidden></label><button type="button" class="btn" data-action="bib-paste">Paste BibTeX</button><button type="button" class="btn btn-primary" data-action="doi-add">${icon("plus")}By DOI</button></span></div>
      <p class="small muted">Each source is a note in <code>Sources/</code>. Cite it anywhere as <code>[@key]</code> or <code>[@key, p. 4]</code>; it renders as <span class="cite-ref">${src[0] ? esc(citeIn(src[0], citeStyle())) : "(Author, Year)"}</span> and links to the source.</p>
      <div class="row tight"><label class="field"><span class="label">Citation style</span><select class="input" name="citestyle"><option value="apa" ${citeStyle() === "apa" ? "selected" : ""}>APA 7</option><option value="chicago" ${citeStyle() === "chicago" ? "selected" : ""}>Chicago author-date</option></select></label>${missingCites.length ? `<p class="small" style="color:var(--danger)">Cited but not in Sources: ${missingCites.map((k) => `<code>@${esc(k)}</code>`).join(", ")}</p>` : ""}</div>
    </div>
    <div class="card band"><div class="row"><h2>${icon("columns")} Literature matrix</h2><span class="small muted">${srcNotes.length} source${srcNotes.length === 1 ? "" : "s"}</span></div>
      ${srcNotes.length ? `<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Source</th>${cols.map((c) => `<th>${c.key}</th>`).join("")}</tr></thead><tbody>${srcNotes.map((n) => { const s = sourceFromNote(n.content)!; const d = frontmatter(n.content).data; return `<tr><td><a href="#" data-action="open" data-path="${esc(n.path)}">${esc(citeIn(s, citeStyle()))}</a><div class="small faint" title="${esc(s.title)}">${esc(s.title.slice(0, 60))}</div></td>${cols.map((c) => `<td>${choiceInput(c, n.path, d[c.key] ?? "")}</td>`).join("")}</tr>`; }).join("")}</tbody></table><datalist id="dl-strength"><option value="strong"><option value="moderate"><option value="weak"></datalist></div>` : `<p class="muted small">Add sources to compare their methods, samples, findings and limitations side by side.</p>`}
    </div>
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("check")} Claims</h2>${drafts.length > 1 ? `<select class="input" name="claimsfor" style="max-width:220px">${drafts.map((d) => `<option value="${esc(d.path)}" ${d === draft ? "selected" : ""}>${esc(stem(d.path))}</option>`).join("")}</select>` : ""}</div>
        <p class="small muted">Mark claims in a draft with <code>Claim::</code>. Each is backed by a citation or a linked note; claims backed only by sources marked weak are flagged.</p>
        ${cl.length ? `<div class="runs">${cl.map((c) => `<div class="run"><span>${esc(c.text.replace(CITE_KEY, "").slice(0, 120))}<div class="small faint">${c.evidence.map(esc).join(", ") || "no evidence"}</div></span><span class="pill ${c.status === "supported" ? "ok" : c.status === "weak" ? "low" : "bad"}">${c.status}</span></div>`).join("")}</div>` : `<p class="muted small">No <code>Claim::</code> lines yet.</p>`}</div>
      <div class="card band"><div class="row"><h2>${icon("template")} Thesis</h2><span class="right-actions"><button type="button" class="btn" data-action="thesis-new">${icon("plus")}New thesis</button></span></div>
        <p class="small muted">A thesis note lists chapters as <code>1. [[Chapter]]</code>. Compiling joins them in order, numbers the figures, formats citations and adds the reference list.</p>
        ${theses.map((t) => `<div class="run"><a href="#" data-action="open" data-path="${esc(t.path)}">${esc(stem(t.path))}</a><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="thesis-compile" data-path="${esc(t.path)}">Compile</button></span></div>`).join("") || ""}</div>
    </div>
  </div></section>`;
}
async function compileThesisNote(path: string) {
  const r = compileThesis(S.drafts.get(path)?.text ?? note(path)!.content, (t) => { const p = resolveLink(t); return p ? S.drafts.get(p)?.text ?? note(p)?.content : undefined; }, libSources(), citeStyle());
  const out = `${stem(path)} (compiled).md`;
  if (note(out)) await writeNote(out, r.md); else await createQuiet(out, r.md);
  const choice = await ask({ title: "Thesis compiled", body: `${r.figures} figure${r.figures === 1 ? "" : "s"} numbered.${r.missing.length ? ` Missing: ${r.missing.join(", ")}.` : ""} Saved as ${out}.`, label: "Then", choices: [{ value: "open", label: "Open it" }, { value: "docx", label: "Download as Word (.docx)" }, { value: "md", label: "Download as Markdown" }, { value: "print", label: "Print or save as PDF" }], value: "open", ok: "Go" });
  if (choice === "docx") return downloadBytes(`${stem(out)}.docx`, markdownToDocx(r.md, stem(path)), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  if (choice === "md") return downloadBytes(`${stem(out)}.md`, r.md, "text/markdown");
  S.tab = "notes";
  await open(out);
  if (choice === "print") { const p = pane(); if (p.view === "edit") { p.view = "preview"; render(); } setTimeout(() => window.print(), 400); }
}

// --- the Career kit

const CAREER_BOARD = "Career/Applications.md";
const CAREER_DECK = "Career/Interview stories.md";
const textOf = (p: string) => S.drafts.get(p)?.text ?? note(p)?.content;
function careerTab(): string {
  const notes = orgNotes();
  const today = dayKey(new Date());
  const board = textOf(CAREER_BOARD);
  const apps = board ? applications(board) : [];
  const late = waiting(apps, today);
  const st = searchStats(apps, today);
  const exps = notes.filter((n) => isExperience(n.content)).map((n) => experience(n.path, n.content));
  const resumes = notes.filter((n) => (frontmatter(n.content).data.type ?? "").trim() === "resume");
  const deck = textOf(CAREER_DECK);
  const stories = deck ? parseCards(deck).length : 0;
  const ppl = contacts(notes, today);
  const max = Math.max(1, ...st.weeks.map((w) => w.sent));
  const bars = `<svg class="career-bars" viewBox="0 0 ${st.weeks.length * 34} 70" role="img" aria-label="Applications sent per week">${st.weeks.map((w, i) => `<rect x="${i * 34 + 6}" y="${60 - (w.sent / max) * 52}" width="22" height="${(w.sent / max) * 52 || 1}" rx="3"><title>Week of ${w.week}: ${w.sent}</title></rect><text x="${i * 34 + 17}" y="69">${w.week.slice(5).replace("-", "/")}</text>`).join("")}</svg>`;
  const appRow = (a: (typeof apps)[number], i: number) => `<div class="run"><span><a href="#" data-action="wiki" data-target="${esc(a.company)}">${esc(a.company)}</a> <span class="small muted">${esc(a.role)}${a.applied ? ` · applied ${esc(a.applied)}` : ""}</span></span><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="career-followed" data-i="${i}" title="Followed up today: check again in a week">Followed up</button><button type="button" class="btn btn-ghost" data-action="career-heard" data-i="${i}" title="Move it to Screen">Heard back</button></span></div>`;
  return `<section class="main" style="overflow:auto"><div class="page wide kit">
    ${copilotCard("career", [{ a: "resume", icon: "edit", label: "Tailor my résumé to a job post", hint: "Paste a job post; the copilot picks from your experience notes" }, { a: "interview", icon: "help", label: "Likely interview questions", hint: "Eight questions with STAR answers from your experience notes" }])}
    <div class="card band"><div class="row"><h2>${icon("compass")} Applications</h2><span class="right-actions"><button type="button" class="btn" data-action="career-board">${icon("board")}Open the board</button><button type="button" class="btn btn-primary" data-action="career-app-add">${icon("plus")}Add application</button></span></div>
      <div class="career-stats"><div><b>${st.thisWeek}</b><span>sent this week</span></div><div><b>${st.total}</b><span>sent in all</span></div><div><b>${st.responseRate}%</b><span>heard back</span></div><div><b>${st.interviewRate}%</b><span>reached an interview</span></div><div><b>${st.offers}</b><span>offer${st.offers === 1 ? "" : "s"}</span></div>${bars}</div>
      <div class="tags nudge">${STAGES.map((sg) => `<span class="tag-chip"><span>${sg}</span><span class="cnt">${apps.filter((a) => a.stage === sg).length}</span></span>`).join("")}</div>
      ${late.length ? `<div class="band-title">Waiting 10+ days for a reply <span class="count">${late.length}</span></div><div class="runs">${late.map((a) => appRow(a, apps.indexOf(a))).join("")}</div>` : apps.length ? `<p class="small muted">Nothing has been waiting 10 days without a follow-up.</p>` : `<p class="small muted">Each application is a card on <code>${CAREER_BOARD}</code>, one lane per stage. Its follow-up date shows up in Work like any task.</p>`}
    </div>
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("briefcase")} Experience and résumés</h2><span class="right-actions"><button type="button" class="btn btn-ghost" data-action="career-exp-add">${icon("plus")}Experience</button><button type="button" class="btn" data-action="career-resume-new">${icon("plus")}Résumé</button></span></div>
        <p class="small muted">One note per role or accomplishment, with its skills. A résumé lists the ones to include; compiling turns them into one document, ready for Word or PDF.</p>
        ${exps.length ? `<div class="runs">${exps.map((e) => `<div class="run"><span><a href="#" data-action="open" data-path="${esc(e.path)}">${esc(e.role || e.title)}</a> <span class="small muted">${esc(e.company)}${e.start ? ` · ${esc(e.start)}–${esc(e.end)}` : ""} · ${e.bullets.length} bullet${e.bullets.length === 1 ? "" : "s"}</span><div class="tags">${e.skills.map((k) => `<span class="tag-chip small">${esc(k)}</span>`).join("")}</div></span></div>`).join("")}</div>` : ""}
        ${resumes.map((r) => `<div class="run"><span><b><a href="#" data-action="open" data-path="${esc(r.path)}">${esc(stem(r.path))}</a></b></span><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="career-compile" data-path="${esc(r.path)}">Compile</button><button type="button" class="btn btn-ghost" data-action="career-feedback" data-path="${esc(r.path)}" title="Share a snapshot of the compiled résumé in #careers">${icon("users")}Get feedback</button></span></div>`).join("")}
      </div>
      <div class="card band"><div class="row"><h2>${icon("check")} Interview stories</h2><span class="right-actions"><button type="button" class="btn btn-ghost" data-action="career-practice">Practice</button><button type="button" class="btn btn-primary" data-action="career-story-add">${icon("plus")}Story</button></span></div>
        <p class="small muted">A behavioural question on the front, your answer as situation, task, action and result on the back. They are flashcards, so Study brings each back just before you would forget it.</p>
        <p><b>${stories}</b> stor${stories === 1 ? "y" : "ies"} in <a href="#" data-action="open" data-path="${CAREER_DECK}">${esc(stem(CAREER_DECK))}</a></p>
      </div>
    </div>
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("users")} People</h2><span class="right-actions"><button type="button" class="btn btn-ghost" data-action="career-person-add">${icon("plus")}Contact</button></span></div>
        <p class="small muted">Person notes with <code>last_contacted</code>, <code>next_follow_up</code> and <code>referral_for</code>. Someone comes due on their follow-up date, or after a month of quiet.</p>
        ${ppl.length ? `<div class="runs">${ppl.map((c) => `<div class="run"><span><a href="#" data-action="open" data-path="${esc(c.path)}">${esc(c.name)}</a> <span class="small ${c.due ? "" : "muted"}" ${c.due ? 'style="color:var(--danger)"' : ""}>${c.due ? "follow up now" : c.nextFollowUp ? `next ${esc(c.nextFollowUp)}` : ""}${c.lastContacted ? ` · last ${esc(c.lastContacted)}` : ""}${c.referralFor ? ` · referral for ${esc(c.referralFor)}` : ""}</span></span><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="career-contacted" data-path="${esc(c.path)}">Contacted today</button></span></div>`).join("")}</div>` : `<p class="small muted">No contacts yet.</p>`}
      </div>
      <div class="card band"><div class="row"><h2>${icon("chat")} #careers</h2><span class="right-actions"><button type="button" class="btn" data-action="career-channel">Open #careers</button></span></div>
        <p class="small muted">Résumé reviews, interview practice and job leads with the community. Sharing a résumé posts a snapshot; your space stays private.</p>
      </div>
    </div>
  </div></section>`;
}
async function careerBoard(): Promise<string> {
  if (!note(CAREER_BOARD)) await createQuiet(CAREER_BOARD, APPLICATIONS_BOARD);
  return textOf(CAREER_BOARD) ?? APPLICATIONS_BOARD;
}
async function careerAddApplication() {
  const company = (await ask({ title: "Add an application", label: "Company", placeholder: "Acme", ok: "Next" }))?.trim();
  if (!company) return;
  const role = (await ask({ title: company, label: "Role", placeholder: "Senior Engineer", ok: "Next" }))?.trim();
  if (role === undefined) return;
  const today = dayKey(new Date());
  const applied = await ask({ title: `${company} · ${role}`, label: "Applied on (YYYY-MM-DD; empty for today)", value: today, ok: "Add" });
  if (applied === null) return;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(applied.trim()) ? applied.trim() : today;
  await writeNote(CAREER_BOARD, addApplication(await careerBoard(), applicationCard(company, role || "Role", day, addDays(day, 10))));
  const dossier = `Career/Companies/${company.replace(/[\\/#^[\]|:]/g, " ").trim()}.md`;
  if (!resolveLink(company)) await createQuiet(dossier, `---\ntype: company\n---\n\n# ${company}\n\n## Why them\n\n## People I know there\n\n## Questions to ask\n\n## Salary research\n`);
  toast(`Added ${company}; a follow-up is due ${addDays(day, 10)} and shows in Work.`, "ok");
  render();
}
async function careerResumeCompile(path: string, then?: "feedback") {
  const r = compileResume(textOf(path)!, (t) => { const p = resolveLink(t); return p ? textOf(p) : undefined; });
  const out = `${stem(path)} (compiled).md`;
  if (note(out)) await writeNote(out, r.md); else await createQuiet(out, r.md);
  if (then === "feedback") return shareGist({ notebook: S.notebook!.canister.toText(), path: out, text: r.md }, "careers");
  const choice = await ask({ title: "Résumé compiled", body: `${r.used} experience${r.used === 1 ? "" : "s"} included.${r.missing.length ? ` Not found: ${r.missing.join(", ")}.` : ""} Saved as ${out}.`, label: "Then", choices: [{ value: "open", label: "Open it" }, { value: "docx", label: "Download as Word (.docx)" }, { value: "print", label: "Print or save as PDF" }, { value: "md", label: "Download as Markdown" }], value: "docx", ok: "Go" });
  if (choice === "docx") return downloadBytes(`${stem(path)}.docx`, markdownToDocx(r.md, stem(path)), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  if (choice === "md") return downloadBytes(`${stem(path)}.md`, r.md, "text/markdown");
  if (choice === null) return;
  S.tab = "notes";
  await open(out);
  if (choice === "print") { const p = pane(); if (p.view === "edit") { p.view = "preview"; render(); } setTimeout(() => window.print(), 400); }
}
async function careerAction(action: string, el: HTMLElement) {
  const today = dayKey(new Date());
  const apps = applications(textOf(CAREER_BOARD) ?? APPLICATIONS_BOARD);
  switch (action) {
    case "career-app-add": return careerAddApplication();
    case "career-board": { await careerBoard(); S.tab = "notes"; return open(CAREER_BOARD); }
    case "career-followed": case "career-heard": {
      const a = apps[Number(el.dataset.i)];
      if (!a) return;
      await writeNote(CAREER_BOARD, updateApplication(textOf(CAREER_BOARD)!, a, action === "career-heard" ? { stage: "Screen" } : { followUp: addDays(today, 7) }));
      return render();
    }
    case "career-exp-add": {
      const role = (await ask({ title: "Add experience", label: "Role", placeholder: "Staff Engineer", ok: "Next" }))?.trim();
      if (!role) return;
      const company = (await ask({ title: role, label: "Company", placeholder: "Acme", ok: "Next" }))?.trim() ?? "";
      const start = (await ask({ title: `${role} · ${company}`, label: "Started (year or month)", value: today.slice(0, 4), ok: "Create" }))?.trim();
      if (start === undefined) return;
      const path = `Career/Experience/${`${role} at ${company}`.replace(/[\\/#^[\]|:]/g, " ").trim()}.md`;
      if (!note(path)) await createQuiet(path, EXPERIENCE_TEMPLATE(role, company, start));
      S.tab = "notes";
      return open(path);
    }
    case "career-resume-new": {
      const name = (await ask({ title: "New résumé", label: "Your name", placeholder: "Ada Lovelace", ok: "Create" }))?.trim();
      if (!name) return;
      const exps = orgNotes().filter((n) => isExperience(n.content)).map((n) => stem(n.path));
      let path = "Career/Résumé.md";
      for (let i = 2; note(path); i++) path = `Career/Résumé ${i}.md`;
      await createQuiet(path, RESUME_TEMPLATE(name, exps));
      S.tab = "notes";
      return open(path);
    }
    case "career-compile": return careerResumeCompile(el.dataset.path!);
    case "career-feedback": return careerResumeCompile(el.dataset.path!, "feedback");
    case "career-story-add": {
      const q = (await ask({ title: "An interview story", label: "The question", placeholder: "Tell me about a time you disagreed with your manager", ok: "Next" }))?.trim();
      if (!q) return;
      const a = await ask({ title: q, label: "Your answer", multiline: true, value: "Situation: \nTask: \nAction: \nResult: ", ok: "Add the card" });
      if (a === null) return;
      const deck = textOf(CAREER_DECK) ?? STORIES_DECK;
      const next = `${deck.trimEnd()}\n\n${storyCard(parseStar(q, a))}\n`;
      if (note(CAREER_DECK)) await writeNote(CAREER_DECK, next); else await createQuiet(CAREER_DECK, next);
      toast("Story added. Study will bring it back for practice.", "ok");
      return render();
    }
    case "career-practice": { S.tab = "study"; return render(); }
    case "career-contacted": {
      const p = el.dataset.path!;
      await writeNote(p, markContacted(textOf(p)!, today));
      toast(`Noted. Next follow-up ${addDays(today, 14)}.`, "ok");
      return render();
    }
    case "career-person-add": {
      const name = (await ask({ title: "Add a contact", label: "Name", placeholder: "Grace Hopper", ok: "Next" }))?.trim();
      if (!name) return;
      const how = (await ask({ title: name, label: "How you know them", placeholder: "Former manager at Acme", ok: "Next" }))?.trim() ?? "";
      const ref = (await ask({ title: name, label: "Could refer you to (optional)", placeholder: "Globex", ok: "Add" }))?.trim() ?? "";
      const path = `People/${name.replace(/[\\/#^[\]|:]/g, " ").trim()}.md`;
      if (note(path)) await writeNote(path, markContacted(textOf(path)!, today)); else await createQuiet(path, PERSON_TEMPLATE(name, how, ref, today));
      return render();
    }
    case "career-channel": { store("nb-chat-channel", "careers"); location.hash = "#/community"; return; }
  }
}

// --- the Crypto kit

type Quote = { usd?: number; at: number; got: number };
/** Last known prices, kept across reloads: each refresh costs the notebook up to 1B cycles a coin. */
const QUOTES = new Map<string, Quote>((() => { try { return Object.entries(JSON.parse(store("nb-prices") ?? "{}") as Record<string, Quote>); } catch { return []; } })());
const QUOTE_FRESH = 5 * 60_000;
let quoting: Promise<void> | undefined;
let quoteError = "", quoteFailed = 0;
const priceOf = (sym: string) => QUOTES.get(symbolOf(sym))?.usd;
const cryptoWatch = () => (store("nb-crypto-watch") ?? DEFAULT_WATCH.join(" ")).split(/[\s,]+/).map(symbolOf).filter(Boolean);
const amount = (x?: string) => (x?.trim() ? Number(x.replace(/[$,\s]/g, "")) : undefined);
/** Price the coins missing or older than five minutes (all of them when `force`), through the notebook. */
function loadPrices(symbols: string[], force = false): Promise<void> {
  if (quoting) return quoting.then(() => loadPrices(symbols));
  const want = [...new Set(symbols.map(symbolOf).filter(Boolean))].filter((s) => force || Date.now() - (QUOTES.get(s)?.got ?? 0) > QUOTE_FRESH).slice(0, MAX_WATCH);
  // after a failure, wait a minute before asking again (the tab re-renders often)
  if (!want.length || !S.notebook || (!force && Date.now() - quoteFailed < 60_000)) return Promise.resolve();
  quoting = (async () => {
    try {
      for (const p of unwrap(await nb().prices(Principal.fromText(XRC_CANISTER), want))) QUOTES.set(p.symbol, { usd: p.usd, at: Number(p.at), got: Date.now() });
      quoteError = "";
      store("nb-prices", JSON.stringify(Object.fromEntries(QUOTES)));
    } catch (e) {
      quoteError = errMsg(e);
      quoteFailed = Date.now();
    } finally {
      quoting = undefined;
    }
    if ((S.tab === "crypto" || S.tab === "money") && !document.querySelector(".scrim")) render();
    document.querySelectorAll<HTMLElement>(".price-embed").forEach(fillPriceEmbed);
  })();
  return quoting;
}
const quoteText = (s: string) => { const q = QUOTES.get(s); return q ? (q.usd === undefined ? "not listed" : usd(q.usd)) : quoteError ? "–" : "…"; };
function fillPriceEmbed(el: HTMLElement) {
  el.innerHTML = el.dataset.symbols!.split(" ").filter(Boolean).map((s) => `<span class="price-chip"><b>${esc(s)}</b><span>${quoteText(s)}</span></span>`).join("");
  el.title = quoteError ? `Prices: ${quoteError}` : "Live prices from ICP's exchange rate canister";
}
/** ```prices blocks in reading view: a chip per coin, filled once the notebook has priced them. */
function hydratePrices(root: ParentNode) {
  const els = [...root.querySelectorAll<HTMLElement>(".price-embed:not([data-done])")];
  if (!els.length) return;
  els.forEach((el) => { el.dataset.done = "1"; fillPriceEmbed(el); });
  void loadPrices(els.flatMap((el) => el.dataset.symbols!.split(" ")));
}

type Field = { name: string; label: string; value?: string; placeholder?: string; kind?: "text" | "number" | "date" | "area" | "choice"; choices?: { value: string; label: string }[]; required?: boolean; wide?: boolean };
/** A dialog with several fields; resolves to their values by name, or null when cancelled. */
function fieldsDialog(title: string, body: string, fields: Field[], ok: string): Promise<Record<string, string> | null> {
  return new Promise((res) => {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    const attrs = (f: Field) => `name="${f.name}" ${f.required ? "required" : ""} placeholder="${esc(f.placeholder ?? "")}"`;
    const input = (f: Field) => f.kind === "choice"
      ? `<select class="input" name="${f.name}">${f.choices!.map((c) => `<option value="${esc(c.value)}" ${c.value === f.value ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>`
      : f.kind === "area"
        ? `<textarea class="input" ${attrs(f)} rows="3">${esc(f.value ?? "")}</textarea>`
        : `<input class="input" ${attrs(f)} type="${f.kind === "date" ? "date" : "text"}" ${f.kind === "number" ? `inputmode="decimal" pattern="\\$?[0-9][0-9,]*(\\.[0-9]+)?|\\$?\\.[0-9]+" title="A number, like 0.5 or 62,000"` : ""} value="${esc(f.value ?? "")}" autocomplete="off" spellcheck="false">`;
    scrim.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="fd-t"><h2 id="fd-t">${esc(title)}</h2>${body ? `<p class="muted">${esc(body)}</p>` : ""}
      <div class="fields-grid">${fields.map((f) => `<label class="field${f.wide || f.kind === "area" ? " wide" : ""}"><span class="label">${esc(f.label)}</span>${input(f)}</label>`).join("")}</div>
      <div class="actions"><button type="button" class="btn" data-x="cancel">Cancel</button><button type="submit" class="btn btn-primary">${esc(ok)}</button></div></form>`;
    const form = scrim.querySelector("form")!;
    const done = (v: Record<string, string> | null) => { scrim.remove(); document.removeEventListener("keydown", onKey); res(v); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && done(null);
    scrim.addEventListener("click", (e) => e.target === scrim && done(null));
    form.querySelector("[data-x=cancel]")!.addEventListener("click", () => done(null));
    form.addEventListener("submit", (e) => { e.preventDefault(); done(Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]))); });
    document.addEventListener("keydown", onKey);
    document.body.append(scrim);
    form.querySelector<HTMLElement>("input, select, textarea")?.focus();
  });
}

const cryptoTrades = () => orgNotes().filter((n) => n.path.endsWith(".md") && isTrade(n.content)).map((n) => trade(n.path, n.content)).sort((a, b) => b.opened.localeCompare(a.opened));
const money = (n: number | undefined, sign = true) => `<span class="${n === undefined ? "muted" : n >= 0 ? "ok" : "danger"}">${usd(n, sign)}</span>`;
function cryptoTab(): string {
  const today = dayKey(new Date());
  const trades = cryptoTrades();
  const ts = theses(orgNotes(), today);
  const syms = watchSymbols(cryptoWatch(), trades, ts);
  void loadPrices(syms);
  const st = journalStats(trades, today);
  const open = trades.filter(isOpen);
  const unreal = open.map((t) => pnl(t, priceOf(t.asset))).filter((p): p is number => p !== undefined);
  const recent = trades.filter((t) => !isOpen(t)).sort((a, b) => (b.closed ?? "").localeCompare(a.closed ?? "")).slice(0, 5);
  const latest = Math.max(0, ...syms.map((s) => QUOTES.get(s)?.at ?? 0));
  const max = Math.max(1, ...st.weeks.map((w) => Math.abs(w.pnl)));
  const bars = `<svg class="career-bars pnl-bars" viewBox="0 0 ${st.weeks.length * 34} 70" role="img" aria-label="Realized profit and loss per week">${st.weeks.map((w, i) => { const h = (Math.abs(w.pnl) / max) * 26 || 1; return `<rect class="${w.pnl < 0 ? "neg" : ""}" x="${i * 34 + 6}" y="${w.pnl < 0 ? 31 : 31 - h}" width="22" height="${h}" rx="3"><title>Week of ${w.week}: ${usd(w.pnl, true)}</title></rect><text x="${i * 34 + 17}" y="69">${w.week.slice(5).replace("-", "/")}</text>`; }).join("")}<line x1="0" x2="${st.weeks.length * 34}" y1="31" y2="31"/></svg>`;
  const r = (x: number | undefined) => (x === undefined ? "" : ` <span class="small muted">${x.toFixed(1)}R</span>`);
  const openRow = (t: Trade) => { const p = priceOf(t.asset); return `<div class="run"><span><a href="#" data-action="open" data-path="${esc(t.path)}"><b>${esc(t.asset)}</b> ${t.side}</a> <span class="small muted">${t.size} at ${usd(t.entry)}${p !== undefined ? ` · now ${usd(p)}` : ""}${t.stop !== undefined ? ` · stop ${usd(t.stop)}` : ""}</span> ${money(pnl(t, p))}${r(rMultiple(t, p))}</span><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="crypto-trade-close" data-path="${esc(t.path)}">Close</button></span></div>`; };
  const closedRow = (t: Trade) => `<div class="run"><span><a href="#" data-action="open" data-path="${esc(t.path)}"><b>${esc(t.asset)}</b> ${t.side}</a> <span class="small muted">${t.size} · ${usd(t.entry)} → ${usd(t.exit)} · ${esc(t.closed ?? "")}</span> ${money(pnl(t))}${r(rMultiple(t))}</span></div>`;
  const live = ts.filter((t) => t.status === "holds");
  const thesisRow = (t: (typeof ts)[number]) => {
    const p = priceOf(t.asset);
    const ch = p !== undefined && t.priceThen ? (p / t.priceThen - 1) * 100 : undefined;
    return `<div class="run"><span><a href="#" data-action="open" data-path="${esc(t.path)}">${esc(t.title)}</a> <span class="small muted">${esc(t.asset)}${t.priceThen ? ` · ${usd(t.priceThen)} when written` : ""}</span>${ch !== undefined ? ` <span class="small ${ch >= 0 ? "ok" : "danger"}">${ch >= 0 ? "+" : "−"}${Math.abs(ch).toFixed(1)}%</span>` : ""} <span class="small ${t.due ? "" : "muted"}" ${t.due ? 'style="color:var(--danger)"' : ""}>${t.due ? "review now" : t.review ? `· review ${esc(t.review)}` : ""}</span>${t.wrongIf ? `<div class="small muted">Wrong if: ${esc(t.wrongIf)}</div>` : ""}</span>
      <span class="row-actions">${t.due ? `<button type="button" class="btn btn-ghost" data-action="crypto-thesis-held" data-path="${esc(t.path)}">Still holds</button><button type="button" class="btn btn-ghost" data-action="crypto-thesis-broke" data-path="${esc(t.path)}">Broke</button>` : ""}<button type="button" class="btn btn-ghost" data-action="crypto-card" data-path="${esc(t.path)}" title="Shareable On-Chain Thesis Card">${icon("share")}Thesis card</button><button type="button" class="btn btn-ghost" data-action="crypto-thesis-share" data-path="${esc(t.path)}" title="Share a snapshot in #crypto">${icon("users")}Get feedback</button></span></div>`;
  };
  return `<section class="main" style="overflow:auto"><div class="page wide kit">
    ${copilotCard("crypto", [{ a: "thesis", icon: "coin", label: "Question a thesis", hint: "Counterarguments, what would prove it wrong, what to watch" }])}
    <div class="card band"><div class="row"><h2>${icon("coin")} Prices</h2><span class="right-actions"><button type="button" class="btn btn-ghost" data-action="crypto-watch">Edit watchlist</button><button type="button" class="btn" data-action="crypto-refresh">${icon("refresh")}Refresh</button></span></div>
      <div class="coin-tiles">${syms.map((s) => `<div class="coin-tile"><span>${esc(s)}</span><b>${quoteText(s)}</b></div>`).join("")}</div>
      <p class="small muted nudge">${quoteError ? `<span style="color:var(--danger)">Could not get prices: ${esc(quoteError)}</span> ` : latest ? `As of ${new Date(latest * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}, from ICP's exchange rate canister. ` : "Asking ICP's exchange rate canister… "}Each refresh costs this space a fraction of a cent in cycles. A <code>prices</code> code block shows live prices in any note.</p>
    </div>
    <div class="card band"><div class="row"><h2>${icon("list")} Trade journal</h2><span class="right-actions"><button type="button" class="btn btn-primary" data-action="crypto-trade-add">${icon("plus")}Log a trade</button></span></div>
      <div class="career-stats"><div><b>${st.closed}</b><span>closed</span></div><div><b>${st.winRate}%</b><span>win rate</span></div><div><b>${money(st.realized)}</b><span>realized</span></div>${unreal.length ? `<div><b>${money(unreal.reduce((a, b) => a + b, 0))}</b><span>open, unrealized</span></div>` : ""}<div><b>${money(st.avgWin || undefined, false)}</b><span>average win</span></div><div><b>${money(st.avgLoss || undefined, false)}</b><span>average loss</span></div>${st.avgR !== undefined ? `<div><b>${st.avgR.toFixed(1)}R</b><span>average R</span></div>` : ""}${bars}</div>
      ${st.byAsset.length ? `<div class="tags nudge">${st.byAsset.map((a) => `<span class="tag-chip"><span>${esc(a.asset)}</span><span class="cnt">${usd(a.pnl, true)}</span></span>`).join("")}</div>` : ""}
      ${open.length ? `<div class="band-title">Open <span class="count">${open.length}</span></div><div class="runs">${open.map(openRow).join("")}</div>` : ""}
      ${recent.length ? `<div class="band-title">Recently closed</div><div class="runs">${recent.map(closedRow).join("")}</div>` : ""}
      ${trades.length ? "" : `<p class="small muted">Each trade is a note in <code>Crypto/Trades/</code> with its coin, side, size, entry, stop and exit as properties and your reasons in the body, so Organize can show them all as a table.</p>`}
    </div>
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("target")} Theses</h2><span class="right-actions"><button type="button" class="btn btn-primary" data-action="crypto-thesis-add">${icon("plus")}Thesis</button></span></div>
        <p class="small muted">What you believe, why, and what would prove you wrong, with the price on the day you wrote it. Each comes back for review in Work; its reasons are <code>Claim::</code> lines that Research checks for sources.</p>
        ${live.length ? `<div class="runs">${live.map(thesisRow).join("")}</div>` : `<p class="small muted">No theses yet.</p>`}
        ${ts.length > live.length ? `<p class="small muted">${ts.length - live.length} broken: ${ts.filter((t) => t.status !== "holds").map((t) => `<a href="#" data-action="open" data-path="${esc(t.path)}">${esc(t.title)}</a>`).join(", ")}</p>` : ""}
      </div>
      <div class="card band"><div class="row"><h2>${icon("chat")} #crypto</h2><span class="right-actions"><button type="button" class="btn" data-action="crypto-channel">Open #crypto</button></span></div>
        <p class="small muted">Theses, trade reviews and what people are watching. Sharing a thesis posts a snapshot; your space stays private.</p>
      </div>
    </div>
  </div></section>`;
}
const safeName = (s: string) => s.replace(/[\\/#^[\]|:?*"<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Untitled";
async function cryptoLogTrade() {
  const today = dayKey(new Date());
  const live = theses(orgNotes(), today).filter((t) => t.status === "holds");
  const v = await fieldsDialog("Log a trade", "Leave the entry price empty to use the live price.", [
    { name: "asset", label: "Coin", placeholder: "BTC", required: true },
    { name: "side", label: "Side", kind: "choice", value: "long", choices: [{ value: "long", label: "Long" }, { value: "short", label: "Short" }] },
    { name: "size", label: "Size, in coins", kind: "number", placeholder: "0.1", required: true },
    { name: "entry", label: "Entry price ($)", kind: "number", placeholder: "Live price" },
    { name: "stop", label: "Stop ($, optional)", kind: "number" },
    { name: "target", label: "Target ($, optional)", kind: "number" },
    { name: "opened", label: "Opened", kind: "date", value: today },
    ...(live.length ? [{ name: "thesis", label: "Thesis", kind: "choice" as const, value: "", choices: [{ value: "", label: "None" }, ...live.map((t) => ({ value: t.path.replace(/\.md$/, ""), label: t.title }))] }] : []),
    { name: "why", label: "Why", kind: "area", placeholder: "What you saw, and what would make you get out" },
  ], "Log it");
  if (!v) return;
  const asset = symbolOf(v.asset);
  let entry = amount(v.entry);
  if (entry === undefined) {
    await loadPrices([asset], true);
    entry = priceOf(asset);
    if (entry === undefined) return toast(`No live price for ${asset}; type the entry price.`, "error");
  }
  const t = { asset, side: v.side as Side, size: amount(v.size) ?? 0, entry, stop: amount(v.stop), target: amount(v.target), opened: /^\d{4}-\d{2}-\d{2}$/.test(v.opened) ? v.opened : today, thesis: v.thesis || undefined };
  let path = tradePath(t);
  for (let i = 2; note(path); i++) path = path.replace(/( \d+)?\.md$/, ` ${i}.md`);
  await createQuiet(path, TRADE_TEMPLATE(t, v.why ?? ""));
  toast(`Logged ${asset} ${t.side} at ${usd(entry)}.`, "ok");
  render();
}
async function cryptoAction(action: string, el: HTMLElement) {
  const today = dayKey(new Date());
  const p = el.dataset.path ?? "";
  switch (action) {
    case "crypto-refresh": return loadPrices(watchSymbols(cryptoWatch(), cryptoTrades(), theses(orgNotes(), today)), true);
    case "crypto-watch": {
      const v = await ask({ title: "Watchlist", label: `Coins to price, up to ${MAX_WATCH}; open trades and theses are added`, value: cryptoWatch().join(" "), ok: "Save" });
      if (v === null) return;
      store("nb-crypto-watch", v.split(/[\s,]+/).map(symbolOf).filter(Boolean).slice(0, MAX_WATCH).join(" ") || null);
      return render();
    }
    case "crypto-trade-add": return cryptoLogTrade();
    case "crypto-trade-close": {
      const t = trade(p, textOf(p)!);
      void loadPrices([t.asset]);
      const v = await fieldsDialog(`Close ${t.asset} ${t.side}`, `${t.size} at ${usd(t.entry)}. Leave the exit price empty to use the live price.`, [
        { name: "exit", label: "Exit price ($)", kind: "number", placeholder: "Live price" },
        { name: "closed", label: "Closed", kind: "date", value: today },
        { name: "lesson", label: "Lesson", kind: "area", placeholder: "What you would do the same, or differently" },
      ], "Close it");
      if (!v) return;
      let exit = amount(v.exit);
      if (exit === undefined) {
        await loadPrices([t.asset]);
        exit = priceOf(t.asset);
        if (exit === undefined) return toast(`No live price for ${t.asset}; type the exit price.`, "error");
      }
      const next = closeTrade(textOf(p)!, exit, /^\d{4}-\d{2}-\d{2}$/.test(v.closed) ? v.closed : today, v.lesson);
      await writeNote(p, next);
      const made = pnl(trade(p, next))!;
      toast(`Closed at ${usd(exit)}: ${usd(made, true)}.`, made >= 0 ? "ok" : "info");
      return render();
    }
    case "crypto-thesis-add": {
      const v = await fieldsDialog("New thesis", "What you believe and what would prove you wrong. Today's price is saved with it.", [
        { name: "asset", label: "Coin", placeholder: "BTC", required: true },
        { name: "review", label: "First review in (days)", kind: "number", value: "30" },
        { name: "belief", label: "What you believe", placeholder: "BTC outperforms ETH this cycle", required: true, wide: true },
        { name: "because", label: "Because (one reason per line)", kind: "area" },
        { name: "wrong", label: "I am wrong if", placeholder: "ETH/BTC closes a month above 0.06", wide: true },
      ], "Save it");
      if (!v) return;
      const asset = symbolOf(v.asset);
      await loadPrices([asset]);
      let path = `Crypto/Theses/${safeName(v.belief)}.md`;
      for (let i = 2; note(path); i++) path = path.replace(/( \d+)?\.md$/, ` ${i}.md`);
      const days = Math.max(1, Math.round(amount(v.review) ?? 30));
      await createQuiet(path, THESIS_TEMPLATE({ asset, belief: v.belief, because: v.because ?? "", wrongIf: v.wrong ?? "", price: priceOf(asset), today, reviewIn: days }));
      toast(`Saved${priceOf(asset) !== undefined ? ` at ${usd(priceOf(asset))}` : ""}. It comes back for review in ${days} day${days === 1 ? "" : "s"}, in Work.`, "ok");
      return render();
    }
    case "crypto-thesis-held": case "crypto-thesis-broke": {
      const [t] = theses([{ path: p, content: textOf(p)! }], today);
      await loadPrices([t.asset]);
      await writeNote(p, reviewThesis(textOf(p)!, action === "crypto-thesis-held", today, priceOf(t.asset)));
      toast(action === "crypto-thesis-held" ? "Noted. It comes back in 30 days." : "Marked broken. It stays in your space as a record.", "ok");
      return render();
    }
    case "crypto-card": {
      const [t] = theses([{ path: p, content: textOf(p)! }], today);
      await loadPrices([t.asset]);
      const now = priceOf(t.asset);
      const card = thesisCardSummary(t, now);
      const scrim = document.createElement("div");
      scrim.className = "scrim";
      scrim.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
        <h2>${icon("coin")} On-Chain Thesis Card</h2>
        <div class="thesis-card-modal">
          <div class="row"><b>${esc(card.asset)}</b><span class="pill ${card.statusLabel.startsWith("Holds") ? "ok" : ""}">${esc(card.statusLabel)}</span></div>
          <h3 style="margin:6px 0">${esc(card.headline)}</h3>
          <div class="career-stats" style="margin:8px 0">
            <div><b>${esc(card.entryLabel)}</b><span>Entry (${esc(t.written ?? "written")})</span></div>
            <div><b>${esc(card.liveLabel)}</b><span>Live XRC Price</span></div>
            ${card.deltaPct !== undefined ? `<div><b class="${card.deltaPct >= 0 ? "ok" : "danger"}">${esc(card.deltaLabel)}</b><span>Move</span></div>` : ""}
          </div>
          ${t.wrongIf ? `<p class="small muted"><b>Invalidated if:</b> ${esc(t.wrongIf)}</p>` : ""}
          <p class="small faint">Verified on Internet Computer · Canister ${esc(S.notebook!.canister.toText())}</p>
        </div>
        <div class="actions">
          <button type="button" class="btn" data-x="cancel">Close</button>
          <button type="button" class="btn" data-x="copy">${icon("copy")}Copy card text</button>
          <button type="button" class="btn btn-primary" data-x="share">${icon("users")}Share to #crypto</button>
        </div>
      </div>`;
      const close = () => scrim.remove();
      scrim.addEventListener("click", (e) => e.target === scrim && close());
      scrim.querySelector("[data-x=cancel]")!.addEventListener("click", close);
      scrim.querySelector("[data-x=copy]")!.addEventListener("click", async () => {
        await copy(card.markdown);
        toast("Thesis card copied to clipboard!", "ok");
      });
      scrim.querySelector("[data-x=share]")!.addEventListener("click", () => {
        close();
        void shareGist({ notebook: S.notebook!.canister.toText(), path: p, text: card.markdown }, "crypto");
      });
      document.body.append(scrim);
      return;
    }
    case "crypto-thesis-share": {
      const [t] = theses([{ path: p, content: textOf(p)! }], today);
      const now = priceOf(t.asset);
      const body = frontmatter(textOf(p)!).body.replace(/^# .+\n/m, (h) => `${h}\n**${t.asset}**${t.priceThen ? ` · ${usd(t.priceThen)} on ${t.written ?? "the day it was written"}` : ""}${now !== undefined ? ` · ${usd(now)} now` : ""}\n`);
      return shareGist({ notebook: S.notebook!.canister.toText(), path: p, text: body }, "crypto");
    }
    case "crypto-channel": { store("nb-chat-channel", "crypto"); location.hash = "#/community"; return; }
  }
}

// --- small charts the Money, Creator and Fitness kits share

/** One bar per week, labelled MM/DD. */
function weekBarsSvg(rows: { week: string; v: number }[], title: (r: { week: string; v: number }) => string, aria: string): string {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return `<svg class="career-bars" viewBox="0 0 ${rows.length * 34} 70" role="img" aria-label="${esc(aria)}">${rows.map((r, i) => `<rect x="${i * 34 + 6}" y="${60 - (r.v / max) * 52}" width="22" height="${(r.v / max) * 52 || 1}" rx="3"><title>${esc(title(r))}</title></rect><text x="${i * 34 + 17}" y="69">${r.week.slice(5).replace("-", "/")}</text>`).join("")}</svg>`;
}
/** A line over time, with the first and last dates under it. */
function lineSvg(pts: { date: string; v: number }[], aria: string, show: (v: number) => string): string {
  if (pts.length < 2) return "";
  const W = 300, H = 80, lo = Math.min(...pts.map((p) => p.v)), span = Math.max(...pts.map((p) => p.v)) - lo || 1;
  const xy = pts.map((p, i) => [8 + (i / (pts.length - 1)) * (W - 16), 8 + (1 - (p.v - lo) / span) * (H - 26)]);
  return `<svg class="kit-line" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}"><polyline points="${xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}"/>${xy.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5"><title>${pts[i].date}: ${esc(show(pts[i].v))}</title></circle>`).join("")}<text x="8" y="${H - 2}">${pts[0].date}</text><text x="${W - 8}" y="${H - 2}" text-anchor="end">${pts[pts.length - 1].date}</text></svg>`;
}
const uniquePath = (path: string) => { let p = path; for (let i = 2; note(p); i++) p = path.replace(/\.(md|sheet)$/, ` ${i}.$1`); return p; };
const isDay = (s: string | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const inDaysText = (n: number | undefined) => (n === undefined ? "" : n < 0 ? `${-n} day${n === -1 ? "" : "s"} late` : n === 0 ? "today" : `in ${n} day${n === 1 ? "" : "s"}`);

// --- the Money kit

const MONEY_BUDGET = "Money/Budget.sheet", MONEY_NET = "Money/Net worth.md";
function moneyTab(): string {
  const today = dayKey(new Date());
  const subs = subscriptions(orgNotes(), today);
  const active = subs.filter((s) => s.status === "active"), tot = subscriptionTotals(subs);
  const bsrc = textOf(MONEY_BUDGET);
  const bt = bsrc ? budgetTotals(evaluate(parseWorkbook(bsrc)).get("Budget")) : undefined;
  const nsrc = textOf(MONEY_NET);
  const hs = nsrc ? holdings(nsrc) : [];
  const coins = hs.filter((h) => h.coin).map((h) => h.coin!);
  if (coins.length) void loadPrices(coins);
  const nw = netWorth(hs, priceOf), hist = nsrc ? netWorthHistory(nsrc) : [];
  const pct = bt && bt.planned ? Math.min(100, Math.round((bt.spent / bt.planned) * 100)) : 0;
  return `<section class="main" style="overflow:auto"><div class="page wide kit">
    ${copilotCard("money", [{ a: "subs", icon: "wallet", label: "Review my subscriptions", hint: "Keep, cancel or downgrade, with the saving" }, { a: "where", icon: "coin", label: "Where is my money going?", hint: "From your budget note" }])}
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("columns")} Budget</h2><span class="right-actions">${bsrc ? `<button type="button" class="btn btn-ghost" data-action="money-month" title="Save this month's copy and start the next with nothing spent">New month</button>` : ""}<button type="button" class="btn ${bsrc ? "" : "btn-primary"}" data-action="money-budget">${bsrc ? "Open budget" : `${icon("plus")}Make a budget`}</button></span></div>
        ${bt ? `<div class="career-stats"><div><b>${usd(bt.planned)}</b><span>planned</span></div><div><b>${usd(bt.spent)}</b><span>spent</span></div><div><b>${money(bt.left, false)}</b><span>left</span></div></div><div class="meter" role="img" aria-label="${pct}% of the budget spent"><i style="width:${pct}%" class="${bt.left < 0 ? "over" : ""}"></i></div>` : `<p class="small muted">A spreadsheet of what you plan to spend per category and what you have spent. New month keeps a copy and clears the spending.</p>`}
      </div>
      <div class="card band"><div class="row"><h2>${icon("wallet")} Net worth</h2><span class="right-actions">${nsrc ? `<button type="button" class="btn btn-ghost" data-action="money-net-open">Edit</button><button type="button" class="btn" data-action="money-net-record" title="Add today's total to the history">Record today</button>` : `<button type="button" class="btn btn-primary" data-action="money-net-open">${icon("plus")}Start</button>`}</span></div>
        ${nsrc ? `<div class="career-stats"><div><b>${money(nw.total, false)}</b><span>${nw.unpriced.length ? `without ${esc(nw.unpriced.join(", "))} (no price yet)` : "today"}</span></div>${lineSvg(hist.map((h) => ({ date: h.date, v: h.total })), "Net worth over time", usd)}</div>
          <div class="tags nudge">${nw.byKind.map((k) => `<span class="tag-chip"><span>${esc(k.kind)}</span><span class="cnt">${usd(k.total)}</span></span>`).join("")}</div>` : `<p class="small muted">A table of your accounts: dollars, debts as negatives, or coins like <code>0.05 BTC</code> priced live. Record today adds the total to its history.</p>`}
      </div>
    </div>
    ${fireCard()}
    <div class="card band"><div class="row"><h2>${icon("calendar")} Subscriptions</h2><span class="right-actions"><button type="button" class="btn btn-primary" data-action="money-sub-add">${icon("plus")}Subscription</button></span></div>
      ${active.length ? `<div class="career-stats"><div><b>${usd(tot.monthly)}</b><span>a month</span></div><div><b>${usd(tot.yearly)}</b><span>a year</span></div><div><b>${active.length}</b><span>active</span></div></div>
        <div class="runs">${active.map((s) => `<div class="run"><span><a href="#" data-action="open" data-path="${esc(s.path)}">${esc(s.name)}</a> <span class="small muted">${usd(s.cost)} every ${esc(s.every)}${/year|quarter|week|day|\d/.test(s.every) ? ` · ${usd(s.monthly)} a month` : ""}</span> <span class="small ${s.inDays !== undefined && s.inDays <= 3 ? "danger" : "muted"}">${s.renews ? `renews ${inDaysText(s.inDays)}` : ""}</span></span><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="money-sub-renewed" data-path="${esc(s.path)}" title="It renewed: move the reminder to the next renewal">Renewed</button><button type="button" class="btn btn-ghost" data-action="money-sub-cancel" data-path="${esc(s.path)}">Cancelled</button></span></div>`).join("")}</div>`
        : `<p class="small muted">One note per subscription with its cost, how often it renews and the next date. A keep-or-cancel reminder shows in Work on the renewal date.</p>`}
      ${subs.length > active.length ? `<p class="small muted">Cancelled: ${subs.filter((s) => s.status !== "active").map((s) => `<a href="#" data-action="open" data-path="${esc(s.path)}">${esc(s.name)}</a>`).join(", ")}</p>` : ""}
    </div>
  </div></section>`;
}
/** The budgeting and FIRE templates, and what the FIRE sheets say once they exist. */
function fireCard(): string {
  const sheetVals = (path: string, name: string) => { const src = textOf(path); return src ? evaluate(parseWorkbook(src)).get(name) : undefined; };
  const fire = sheetVals("Money/FIRE.sheet", "FIRE"), coast = sheetVals("Money/Coast FIRE.sheet", "Coast");
  const show = (v: Value | undefined, kind: "usd" | "years" | "text") => (v === undefined || v === null ? "–" : typeof v === "number" ? (kind === "usd" ? usd(v) : String(v)) : esc(String(v)));
  const stat = (v: string, label: string) => `<div><b>${v}</b><span>${label}</span></div>`;
  return `<div class="card band"><div class="row"><h2>${icon("target")} Budgets and FIRE</h2></div>
    <p class="small muted">Spreadsheets to copy into this space: two more ways to budget, and calculators for financial independence (FIRE) and Coast FIRE. Change your numbers at the top; everything below recalculates.</p>
    <div class="row tight wrap">${MONEY_TEMPLATES.map((t) => `<button type="button" class="btn ${note(t.path) ? "btn-ghost" : ""}" data-action="money-template" data-path="${esc(t.path)}">${note(t.path) ? icon("columns") : icon("plus")}${esc(t.label)}</button>`).join("")}</div>
    ${fire ? `<div class="band-title">FIRE</div><div class="career-stats">${stat(show(byLabel(fire, "FIRE number"), "usd"), "FIRE number")}${stat(show(byLabel(fire, "Years to FIRE"), "years"), "years to go")}${stat(show(byLabel(fire, "FIRE age"), "years"), "FIRE age")}</div>` : ""}
    ${coast ? `<div class="band-title">Coast FIRE</div><div class="career-stats">${stat(show(byLabel(coast, "Coast FIRE number today"), "usd"), "Coast FIRE number today")}${stat(show(byLabel(coast, "Coasting already?"), "text"), "coasting already?")}${stat(show(byLabel(coast, "Coast age"), "years"), "age you can stop saving")}</div>` : ""}
  </div>`;
}
async function moneyAction(action: string, el: HTMLElement) {
  const today = dayKey(new Date());
  const p = el.dataset.path ?? "";
  switch (action) {
    case "money-budget": { if (!note(MONEY_BUDGET)) await createQuiet(MONEY_BUDGET, budgetWorkbook()); S.tab = "notes"; return open(MONEY_BUDGET); }
    case "money-month": {
      const month = today.slice(0, 7);
      if (!(await confirmDialog("Start a new month?", `This month's budget is saved as Money/Budgets/${month}.sheet, then Spent starts again from zero.`, "Start the month"))) return;
      const wb = parseWorkbook(textOf(MONEY_BUDGET)!);
      await createQuiet(uniquePath(`Money/Budgets/${month}.sheet`), serializeWorkbook(wb));
      const sh = wb.sheets.find((s) => s.name === "Budget") ?? wb.sheets[0];
      sh.rows.forEach((r, i) => { if (i > 0 && String(r[0]).trim().toLowerCase() !== "total" && r.length > 2 && !String(r[2]).startsWith("=")) r[2] = "0"; });
      await writeNote(MONEY_BUDGET, serializeWorkbook(wb));
      toast(`Saved ${month}; the new month starts with nothing spent.`, "ok");
      return render();
    }
    case "money-template": {
      const t = MONEY_TEMPLATES.find((x) => x.path === p);
      if (!t) return;
      if (!note(t.path)) await createQuiet(t.path, t.make());
      S.tab = "notes";
      return open(t.path);
    }
    case "money-net-open": { if (!note(MONEY_NET)) await createQuiet(MONEY_NET, NET_WORTH_NOTE); S.tab = "notes"; return open(MONEY_NET); }
    case "money-net-record": {
      const hs = holdings(textOf(MONEY_NET)!);
      await loadPrices(hs.filter((h) => h.coin).map((h) => h.coin!));
      const nw = netWorth(hs, priceOf);
      if (nw.unpriced.length) return toast(`No price for ${nw.unpriced.join(", ")} yet; try again in a minute.`, "error");
      await writeNote(MONEY_NET, recordNetWorth(textOf(MONEY_NET)!, today, nw.total));
      toast(`Recorded ${usd(nw.total)} for ${today}.`, "ok");
      return render();
    }
    case "money-sub-add": {
      const v = await fieldsDialog("Add a subscription", "A reminder to keep or cancel it shows in Work on the renewal date.", [
        { name: "name", label: "Name", placeholder: "Streaming", required: true, wide: true },
        { name: "cost", label: "Cost ($)", kind: "number", placeholder: "15.99", required: true },
        { name: "every", label: "Renews every", kind: "choice", value: "month", choices: ["week", "month", "3 months", "6 months", "year"].map((x) => ({ value: x, label: x })) },
        { name: "renews", label: "Next renewal", kind: "date", value: addDays(today, 30), wide: true },
      ], "Add it");
      if (!v) return;
      await createQuiet(uniquePath(`Money/Subscriptions/${safeName(v.name)}.md`), SUBSCRIPTION_TEMPLATE(amount(v.cost) ?? 0, v.every, isDay(v.renews) ? v.renews : addDays(today, 30), v.name));
      return render();
    }
    case "money-sub-renewed": { await writeNote(p, renewSubscription(textOf(p)!, today)); toast("Next renewal noted; the reminder moved with it.", "ok"); return render(); }
    case "money-sub-cancel": { await writeNote(p, cancelSubscription(textOf(p)!, today)); toast("Marked cancelled. It no longer counts toward your total.", "ok"); return render(); }
  }
}

// --- the Creator kit

const CREATOR_BOARD = "Creator/Calendar.md";
async function creatorBoard(): Promise<string> {
  if (!note(CREATOR_BOARD)) await createQuiet(CREATOR_BOARD, CALENDAR_BOARD);
  return textOf(CREATOR_BOARD) ?? CALENDAR_BOARD;
}
function creatorTab(): string {
  const board = textOf(CREATOR_BOARD);
  const cards = board ? calendar(board) : [];
  const ps = posts(orgNotes());
  const laneOf = (title: string) => cards.find((c) => c.title === title)?.lane;
  const drafts = ps.filter((x) => !x.posted && laneOf(x.title) !== "Posted");
  const out = ps.filter((x) => x.posted || laneOf(x.title) === "Posted").sort((a, b) => (b.posted ?? "").localeCompare(a.posted ?? ""));
  const r = results(out);
  const scheduled = cards.filter((c) => c.lane === "Scheduled").sort((a, b) => (a.date ?? "9").localeCompare(b.date ?? "9"));
  const ideas = cards.filter((c) => c.lane === "Ideas");
  const draftRow = (x: (typeof ps)[number]) => { const when = cards.find((c) => c.title === x.title && c.lane === "Scheduled")?.date; return `<div class="run"><span><a href="#" data-action="open" data-path="${esc(x.path)}">${esc(x.title)}</a> <span class="small muted">${x.thread.length ? `${x.thread.length} post${x.thread.length === 1 ? "" : "s"}` : "empty"}${when ? ` · scheduled ${esc(when)}` : ""}</span>${x.over ? ` <span class="small danger">${x.over} over ${LIMIT}</span>` : ""}</span><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="creator-thread" data-path="${esc(x.path)}">${icon("copy")}Copy</button><button type="button" class="btn btn-ghost" data-action="creator-schedule" data-path="${esc(x.path)}">Schedule</button><button type="button" class="btn btn-ghost" data-action="creator-posted" data-path="${esc(x.path)}">Posted</button><button type="button" class="btn btn-ghost" data-action="creator-feedback" data-path="${esc(x.path)}" title="Share the draft in #creators">${icon("users")}Feedback</button></span></div>`; };
  const n = (v: number | undefined) => (v === undefined ? "–" : v.toLocaleString("en-US"));
  return `<section class="main" style="overflow:auto"><div class="page wide kit">
    <div class="card band"><div class="row"><h2>${icon("calendar")} Calendar</h2><span class="right-actions"><button type="button" class="btn" data-action="creator-board">${icon("board")}Open the board</button><button type="button" class="btn btn-ghost" data-action="creator-idea">${icon("plus")}Idea</button><button type="button" class="btn btn-primary" data-action="creator-new">${icon("plus")}Post</button></span></div>
      <div class="tags">${LANES.map((l) => `<span class="tag-chip"><span>${l}</span><span class="cnt">${cards.filter((c) => c.lane === l).length}</span></span>`).join("")}</div>
      ${scheduled.length ? `<div class="band-title">Scheduled</div><div class="runs">${scheduled.map((c) => `<div class="run"><span><a href="#" data-action="wiki" data-target="${esc(c.title)}">${esc(c.title)}</a> <span class="small muted">${esc(c.date ?? "no date")}</span></span></div>`).join("")}</div>` : ""}
      ${ideas.length ? `<div class="band-title">Ideas <span class="count">${ideas.length}</span></div><div class="runs">${ideas.slice(0, 6).map((c) => `<div class="run"><span>${esc(c.title)}</span><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="creator-draft-idea" data-title="${esc(c.title)}">Draft it</button></span></div>`).join("")}</div>` : `<p class="small muted"><code>${CREATOR_BOARD}</code> is a board: Ideas, Drafting, Scheduled, Posted. A scheduled post's date shows in Work.</p>`}
    </div>
    <div class="card band"><div class="row"><h2>${icon("edit")} Drafts</h2></div>
      <p class="small muted">Everything above a post's first <code>##</code> heading is posted. A line with only <code>---</code> starts the next post; long ones are split at sentences into a numbered thread of ${LIMIT}-character posts.</p>
      ${drafts.length ? `<div class="runs">${drafts.map(draftRow).join("")}</div>` : `<p class="small muted">No drafts.</p>`}
    </div>
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("graph")} Results</h2></div>
        ${r.count ? `<div class="career-stats"><div><b>${r.count}</b><span>measured</span></div><div><b>${n(r.impressions)}</b><span>impressions</span></div><div><b>${r.engagement!.toFixed(1)}%</b><span>engagement</span></div></div>${r.best ? `<p class="small">Best: <a href="#" data-action="open" data-path="${esc(r.best.path)}">${esc(r.best.title)}</a> at ${r.best.engagement!.toFixed(1)}%</p>` : ""}` : ""}
        ${out.length ? `<div class="runs">${out.slice(0, 8).map((x) => `<div class="run"><span><a href="#" data-action="open" data-path="${esc(x.path)}">${esc(x.title)}</a> <span class="small muted">${esc(x.posted ?? "")}${x.metrics.impressions !== undefined ? ` · ${n(x.metrics.impressions)} seen · ${n(x.metrics.likes)} likes · ${n(x.metrics.reposts)} reposts · ${n(x.metrics.replies)} replies` : ""}</span></span><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="creator-results" data-path="${esc(x.path)}">${x.engagement === undefined ? "Log results" : "Update"}</button></span></div>`).join("")}</div>` : `<p class="small muted">Once a post is out, log its impressions, likes, reposts and replies; engagement is all three over impressions.</p>`}
      </div>
      <div class="card band"><div class="row"><h2>${icon("chat")} #creators</h2><span class="right-actions"><button type="button" class="btn" data-action="creator-channel">Open #creators</button></span></div>
        <p class="small muted">Hooks, drafts and what worked. Feedback shares a draft's text; your space stays private.</p>
      </div>
    </div>
  </div></section>`;
}
/** Each post of a thread with its own Copy button, to paste one at a time. */
function threadDialog(title: string, th: string[]) {
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.innerHTML = `<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="th-t"><h2 id="th-t">${esc(title)}</h2>
    <div class="th-list">${th.map((t, i) => `<div class="th-post"><p>${esc(t).replace(/\n/g, "<br>")}</p><div class="row tight"><span class="small ${[...t].length > LIMIT ? "danger" : "muted"}">${[...t].length}/${LIMIT}</span><button type="button" class="btn btn-ghost" data-copy="${i}">${icon("copy")}Copy</button></div></div>`).join("")}</div>
    <div class="actions"><button type="button" class="btn" data-x="all">Copy all</button><button type="button" class="btn btn-primary" data-x="close">Done</button></div></div>`;
  const close = () => { scrim.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
  scrim.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const c = t.closest<HTMLElement>("[data-copy]");
    if (c) { void copy(th[Number(c.dataset.copy)]); c.innerHTML = `${icon("check")}Copied`; return; }
    if (t === scrim || t.closest("[data-x=close]")) return close();
    if (t.closest("[data-x=all]")) { void copy(th.join("\n\n")); toast("Copied the whole thread.", "ok"); }
  });
  document.addEventListener("keydown", onKey);
  document.body.append(scrim);
}
async function creatorNewPost(title: string) {
  const path = uniquePath(`Creator/Posts/${safeName(title)}.md`);
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  await createQuiet(path, POST_TEMPLATE(name));
  await writeNote(CREATOR_BOARD, placeCard(await creatorBoard(), name, "Drafting"));
  S.tab = "notes";
  return open(path);
}
async function creatorAction(action: string, el: HTMLElement) {
  const today = dayKey(new Date());
  const p = el.dataset.path ?? "";
  const titleOfPath = () => p.split("/").pop()!.replace(/\.md$/, "");
  switch (action) {
    case "creator-board": { await creatorBoard(); S.tab = "notes"; return open(CREATOR_BOARD); }
    case "creator-idea": {
      const v = (await ask({ title: "An idea", label: "What could you post about?", placeholder: "Why I keep my notes on a blockchain", ok: "Add" }))?.trim();
      if (!v) return;
      await writeNote(CREATOR_BOARD, placeCard(await creatorBoard(), v.replace(/[[\]]/g, ""), "Ideas", undefined, v.replace(/[[\]]/g, "")));
      return render();
    }
    case "creator-new": { const v = (await ask({ title: "New post", label: "Title (for you; it is not posted)", placeholder: "Launch thread", ok: "Create" }))?.trim(); return v ? creatorNewPost(v) : undefined; }
    case "creator-draft-idea": {
      const idea = el.dataset.title!;
      const b = parseBoard(await creatorBoard());
      for (const l of b.lanes) if (l.title === "Ideas") l.cards = l.cards.filter((c) => c.text.trim() !== idea);
      const path = uniquePath(`Creator/Posts/${safeName(idea)}.md`);
      await createQuiet(path, POST_TEMPLATE(path.split("/").pop()!.replace(/\.md$/, ""), idea));
      await writeNote(CREATOR_BOARD, placeCard(serializeBoard(b), path.split("/").pop()!.replace(/\.md$/, ""), "Drafting"));
      S.tab = "notes";
      return open(path);
    }
    case "creator-thread": { const x = post(p, textOf(p)!); return x.thread.length ? threadDialog(x.title, x.thread) : toast("Nothing to post yet: write above the first ## heading.", "info"); }
    case "creator-schedule": {
      const v = await fieldsDialog("Schedule it", "It shows in Work on that day.", [{ name: "date", label: "Post on", kind: "date", value: addDays(today, 1), wide: true }], "Schedule");
      if (!v || !isDay(v.date)) return;
      await writeNote(CREATOR_BOARD, placeCard(await creatorBoard(), titleOfPath(), "Scheduled", v.date));
      return render();
    }
    case "creator-posted": {
      await writeNote(p, logResults(textOf(p)!, {}, today));
      await writeNote(CREATOR_BOARD, placeCard(await creatorBoard(), titleOfPath(), "Posted", ""));
      toast("Moved to Posted. Log its results in a day or two.", "ok");
      return render();
    }
    case "creator-results": {
      const x = post(p, textOf(p)!);
      const f = (name: keyof typeof x.metrics, label: string) => ({ name, label, kind: "number" as const, value: x.metrics[name] === undefined ? "" : String(x.metrics[name]) });
      const v = await fieldsDialog(`Results: ${x.title}`, "From the post's analytics.", [f("impressions", "Impressions"), f("likes", "Likes"), f("reposts", "Reposts"), f("replies", "Replies")], "Save");
      if (!v) return;
      const m = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, amount(val)])) as typeof x.metrics;
      await writeNote(p, logResults(textOf(p)!, m));
      return render();
    }
    case "creator-feedback": { const x = post(p, textOf(p)!); return shareGist({ notebook: S.notebook!.canister.toText(), path: p, text: `# ${x.title}\n\n${x.thread.join("\n\n---\n\n")}\n` }, "creators"); }
    case "creator-channel": { store("nb-chat-channel", "creators"); location.hash = "#/community"; return; }
  }
}

// --- the Fitness kit

function fitnessTab(): string {
  const today = dayKey(new Date());
  const ws = workouts(orgNotes());
  const wk = weekly(ws, today);
  const now = wk[wk.length - 1];
  const prs = records(ws);
  const ex = store("nb-fit-ex") && prs.some((r) => r.exercise.toLowerCase() === store("nb-fit-ex")!.toLowerCase()) ? store("nb-fit-ex")! : prs[0]?.exercise;
  const prog = ex ? progress(ws, ex) : [];
  const recent = [...ws].reverse().slice(0, 6);
  const unit = ws[ws.length - 1]?.unit ?? "kg";
  return `<section class="main" style="overflow:auto"><div class="page wide kit">
    ${copilotCard("fitness", [{ a: "plan", icon: "dumbbell", label: "Plan my next session", hint: "From your recent workouts and records" }])}
    <div class="card band"><div class="row"><h2>${icon("dumbbell")} Training</h2><span class="right-actions"><label class="btn btn-ghost">${icon("upload")}Run from GPX<input type="file" name="workout-gpx" accept=".gpx,application/gpx+xml" hidden></label><button type="button" class="btn btn-primary" data-action="fitness-log">${icon("plus")}Log a workout</button></span></div>
      <div class="career-stats"><div><b>${now.sessions}</b><span>sessions this week</span></div><div><b>${now.km}</b><span>km this week</span></div><div><b>${Math.round(now.volume).toLocaleString("en-US")}</b><span>${esc(unit)} lifted this week</span></div><div><b>${ws.length}</b><span>workouts in all</span></div>${weekBarsSvg(wk.map((w) => ({ week: w.week, v: w.sessions })), (r) => `Week of ${r.week}: ${r.v} session${r.v === 1 ? "" : "s"}`, "Sessions per week")}</div>
      ${recent.length ? `<div class="band-title">Recent</div><div class="runs">${recent.map((w) => { const pr = newRecords(ws, w.path); const pc = pace(w.minutes, w.km); return `<div class="run"><span><a href="#" data-action="open" data-path="${esc(w.path)}">${esc(w.title)}</a> <span class="small muted">${[w.title.toLowerCase().includes(w.kind) ? "" : esc(w.kind), w.sets.length ? `${w.sets.length} set${w.sets.length === 1 ? "" : "s"}` : "", w.km ? `${w.km} km` : "", w.minutes ? `${w.minutes} min` : "", pc ?? ""].filter(Boolean).join(" · ")}</span>${pr.length ? ` <span class="pill ok">${icon("star")}PR: ${esc(pr.join(", "))}</span>` : ""}</span></div>`; }).join("")}</div>` : `<p class="small muted">One note per workout. Write sets as <code>- Squat: 100 x 5, 105 x 3</code> or <code>- Squat: 3x5 @ 100</code>, bodyweight as <code>@ bw</code>. Runs can carry a GPX route.</p>`}
    </div>
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("star")} Personal records</h2></div>
        <p class="small muted">Your best set per lift, ranked by estimated one-rep max (Epley: weight × (1 + reps ÷ 30)).</p>
        ${prs.length ? `<div class="runs">${prs.slice(0, 10).map((r) => `<div class="run"><span><b>${esc(r.exercise)}</b> <span class="small muted">${r.set.weight} ${esc(unit)} × ${r.set.reps} · about ${Math.round(r.e1rm)} ${esc(unit)} for one · <a href="#" data-action="open" data-path="${esc(r.path)}">${esc(r.date)}</a></span></span></div>`).join("")}</div>` : `<p class="small muted">No weighted sets yet.</p>`}
      </div>
      <div class="card band"><div class="row"><h2>${icon("graph")} Progress</h2></div>
        ${prs.length ? `<div class="tags">${prs.map((r) => `<button type="button" class="tag-chip ${r.exercise === ex ? "active" : ""}" data-action="fitness-ex" data-ex="${esc(r.exercise)}"><span>${esc(r.exercise)}</span></button>`).join("")}</div>${lineSvg(prog.map((x) => ({ date: x.date, v: x.e1rm })), `${ex} over time`, (v) => `about ${Math.round(v)} ${unit}`) || `<p class="small muted">Log ${esc(ex ?? "it")} twice to see a line.</p>`}` : `<p class="small muted">Each lift's estimated one-rep max over time shows here.</p>`}
      </div>
    </div>
  </div></section>`;
}
async function importWorkoutGpx(file: File) {
  const t = parseGpx(await file.text());
  if (t.points.length < 2) return toast("No track in that file.", "error");
  const today = dayKey(new Date());
  const path = uniquePath(`Fitness/Workouts/${today} ${safeName(t.name || file.name.replace(/\.gpx$/i, "")) || "Run"}.md`);
  await createQuiet(path, WORKOUT_TEMPLATE(today, "run", "").replace("## How it felt", `${trackBlock(t)}\n\n## How it felt`));
  S.tab = "notes";
  await open(path);
  toast("Imported the route. Add the minutes it took for your pace.", "ok");
}
async function fitnessAction(action: string, el: HTMLElement) {
  const today = dayKey(new Date());
  switch (action) {
    case "fitness-ex": { store("nb-fit-ex", el.dataset.ex ?? null); return render(); }
    case "fitness-log": {
      const v = await fieldsDialog("Log a workout", "", [
        { name: "date", label: "Date", kind: "date", value: today },
        { name: "kind", label: "Kind", kind: "choice", value: "strength", choices: ["strength", "run", "ride", "walk", "swim", "other"].map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) })) },
        { name: "minutes", label: "Minutes", kind: "number", placeholder: "45" },
        { name: "km", label: "Distance (km)", kind: "number", placeholder: "Runs, rides" },
        { name: "sets", label: "Sets, one exercise a line", kind: "area", placeholder: "- Squat: 3x5 @ 100\n- Bench press: 80 x 5, 80 x 5, 85 x 3\n- Pull-up: 3x8 @ bw" },
      ], "Save");
      if (!v) return;
      const date = isDay(v.date) ? v.date : today;
      const sets = (v.sets ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => (/^[-*+]\s/.test(l) ? l : `- ${l}`)).join("\n");
      let c = WORKOUT_TEMPLATE(date, v.kind || "strength", sets, amount(v.minutes));
      if (amount(v.km)) c = setProperty(c, "distance_km", String(amount(v.km)));
      const path = uniquePath(`Fitness/Workouts/${date} ${v.kind || "workout"}.md`);
      await createQuiet(path, c);
      const pr = newRecords(workouts(orgNotes()), path);
      toast(pr.length ? `Saved. New personal record: ${pr.join(", ")}!` : "Saved.", "ok");
      return render();
    }
  }
}

// --- the Home kit

const STARTER_UPKEEP: [string, string, string][] = [["Test the smoke alarms", "6 months", "Press each test button; replace batteries once a year."], ["Change the furnace filter", "3 months", "Note the filter size here."], ["Clean the gutters", "year", ""], ["Flush the water heater", "year", ""], ["Clean the fridge coils", "year", ""]];
function homeTab(): string {
  const today = dayKey(new Date());
  const jobs = upkeep(orgNotes(), today);
  const its = items(orgNotes(), today);
  const inv = inventory(its);
  const ending = warrantiesEnding(its);
  const total = inv.reduce((a, r) => a + r.value, 0);
  return `<section class="main" style="overflow:auto"><div class="page wide kit">
    <div class="card band"><div class="row"><h2>${icon("refresh")} Upkeep</h2><span class="right-actions">${jobs.length ? "" : `<button type="button" class="btn" data-action="home-starters">Add common jobs</button>`}<button type="button" class="btn btn-primary" data-action="home-job-add">${icon("plus")}Job</button></span></div>
      ${jobs.length ? `<div class="runs">${jobs.map((j) => `<div class="run"><span><a href="#" data-action="open" data-path="${esc(j.path)}">${esc(j.job)}</a> <span class="small ${j.inDays !== undefined && j.inDays <= 0 ? "danger" : "muted"}">${j.next ? `due ${inDaysText(j.inDays)}` : "no date"} · every ${esc(j.every)}${j.lastDone ? ` · last done ${esc(j.lastDone)}` : ""}</span></span><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="home-job-done" data-path="${esc(j.path)}">Done</button></span></div>`).join("")}</div>`
        : `<p class="small muted">Jobs that come back: each is a note with how often, how to do it, and a task in Work that moves to the next date when you mark it done.</p>`}
    </div>
    <div class="card band"><div class="row"><h2>${icon("house")} Things in the house</h2><span class="right-actions"><button type="button" class="btn btn-primary" data-action="home-item-add">${icon("plus")}Item</button></span></div>
      ${its.length ? `<div class="career-stats"><div><b>${its.length}</b><span>items</span></div><div><b>${usd(total)}</b><span>recorded value</span></div><div><b>${its.filter((i) => i.manual).length}</b><span>with a manual</span></div></div>
        ${ending.length ? `<div class="band-title">Warranty ending <span class="count">${ending.length}</span></div><div class="runs">${ending.map((i) => `<div class="run"><span><a href="#" data-action="open" data-path="${esc(i.path)}">${esc(i.name)}</a> <span class="small danger">ends ${inDaysText(i.warrantyDays)} (${esc(i.warrantyUntil!)})</span></span></div>`).join("")}</div>` : ""}
        <div class="band-title">By room</div><div class="runs">${inv.map((r) => `<div class="run"><span><b>${esc(r.room)}</b> <span class="small muted">${r.count} item${r.count === 1 ? "" : "s"}${r.value ? ` · ${usd(r.value)}` : ""}</span><div class="small muted">${its.filter((i) => i.room === r.room).map((i) => `<a href="#" data-action="open" data-path="${esc(i.path)}">${esc(i.name)}</a>${i.manual ? " 📄" : ""}`).join(", ")}</div></span></div>`).join("")}</div>`
        : `<p class="small muted">One note per appliance or valuable: room, brand, model, value, warranty and the PDF manual from the maker's site. The inventory by room is ready for insurance, and a warranty's end shows in Work a month ahead.</p>`}
    </div>
  </div></section>`;
}
async function homeAction(action: string, el: HTMLElement) {
  const today = dayKey(new Date());
  const p = el.dataset.path ?? "";
  switch (action) {
    case "home-starters": {
      for (const [job, every, how] of STARTER_UPKEEP) { const path = `Home/Upkeep/${job}.md`; if (!note(path)) await createQuiet(path, UPKEEP_TEMPLATE(job, every, addPeriod(today, every), how)); }
      toast("Added five common jobs, each due one period from today. Change any date in its note.", "ok");
      return render();
    }
    case "home-job-add": {
      const v = await fieldsDialog("A job that comes back", "", [
        { name: "job", label: "Job", placeholder: "Change the furnace filter", required: true, wide: true },
        { name: "every", label: "Every", kind: "choice", value: "3 months", choices: ["2 weeks", "month", "3 months", "6 months", "year", "2 years"].map((x) => ({ value: x, label: x })) },
        { name: "next", label: "Next due", kind: "date", value: today },
        { name: "how", label: "How (optional)", kind: "area", placeholder: "Steps, part numbers, who to call" },
      ], "Add it");
      if (!v) return;
      await createQuiet(uniquePath(`Home/Upkeep/${safeName(v.job)}.md`), UPKEEP_TEMPLATE(v.job, v.every, isDay(v.next) ? v.next : today, v.how ?? ""));
      return render();
    }
    case "home-job-done": {
      const next = doneUpkeep(textOf(p)!, today);
      await writeNote(p, next);
      toast(`Done. Next time: ${upkeep([{ path: p, content: next }], today)[0]?.next ?? "set a date"}.`, "ok");
      return render();
    }
    case "home-item-add": {
      const v = await fieldsDialog("Add an item", "Paste the manual's PDF link from the maker's site and it shows inside the note.", [
        { name: "name", label: "What", placeholder: "Fridge", required: true },
        { name: "room", label: "Room", placeholder: "Kitchen" },
        { name: "brand", label: "Brand", placeholder: "Optional" },
        { name: "model", label: "Model", placeholder: "Optional" },
        { name: "bought", label: "Bought", kind: "date" },
        { name: "value", label: "Value ($)", kind: "number", placeholder: "Optional" },
        { name: "warranty", label: "Warranty until", kind: "date", wide: true },
        { name: "manual", label: "Manual (PDF link)", placeholder: "https://…/manual.pdf", wide: true },
      ], "Add it");
      if (!v) return;
      const manual = /^https:\/\/\S+$/.test(v.manual ?? "") ? v.manual : undefined;
      await createQuiet(uniquePath(`Home/Items/${safeName(v.name)}.md`), ITEM_TEMPLATE({ name: v.name, room: v.room || "Other", brand: v.brand || undefined, model: v.model || undefined, bought: isDay(v.bought) ? v.bought : undefined, value: amount(v.value), warrantyUntil: isDay(v.warranty) ? v.warranty : undefined, manual }));
      return render();
    }
  }
}

/** Every page but the notebooks list and the landing page: the left icon bar (signed in, on a
 *  desktop) and the top bar, the same frame as a notebook. */
function pageShell(crumb: string, body: string, bare = false): string {
  const right = S.mobile ? moreBtn() : S.identity ? "" : `<button type="button" class="btn btn-primary" data-action="sign-in">Sign in with Internet Identity</button>`;
  return `<div class="shell ${S.mobile ? "is-mobile" : ""} ${S.identity ? "" : "single"}">${S.identity ? ribbonHtml() : ""}<div class="shell-main"><header class="wsbar">${brand()}<span class="crumb">${crumb}</span><span class="right">${right}</span></header>${bare ? `<section class="main">${body}</section>` : `<section class="main" style="overflow:auto"><div class="page wide">${body}</div></section>`}</div></div>`;
}
// --- problems: open problems by field, claims others check, attempts the owner merges, bounties, discoveries (registry problems.rs, problems.ts)

type ProblemsTab = "problems" | "discoveries" | "agents";
const icpText = (e8s: bigint | number) => `${(Number(e8s) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 4 })} ICP`;
const problemRoute = () => /^#\/(problems|discoveries|agents)(?:\/(\d+))?$/.exec(location.hash);
async function loadProblems(tab: ProblemsTab, id?: bigint) {
  // a direct link at boot arrives before the flags do
  if (!S.flags.length) { try { S.flags = await registry().flags(); } catch { /* the default decides */ } }
  if (!flag("problems")) { toast("Problems are not open yet.", "info"); location.hash = "#/"; return; }
  const p = S.problems ?? (S.problems = { tab, status: (store("nb-problems-status") as "open" | "solved" | "all") || "open", field: store("nb-problems-field") || undefined, cards: [], loading: true });
  p.tab = tab; p.loading = true; p.open = id === undefined ? undefined : p.open?.card.id === id ? p.open : undefined; p.note = id === undefined ? undefined : p.note;
  S.community = undefined; clearInterval(chatTimer); S.board = undefined; S.inbox = undefined;
  render();
  try {
    if (id !== undefined) {
      const r = await registry().problem(id, null);
      if (r.__kind__ === "Err") { toast(r.Err, "error"); location.hash = "#/problems"; return; }
      if (S.problems !== p) return;
      const was = p.open;
      p.open = r.Ok;
      if (!was || was.note_hash !== r.Ok.note_hash || p.note === undefined) {
        const n = await notebookOf(r.Ok.notebook.toText()).read_shared(r.Ok.path).catch(() => undefined);
        p.note = n?.__kind__ === "Ok" ? n.Ok.content : undefined;
        p.noteError = n?.__kind__ === "Ok" ? undefined : "The note is not shared publicly any more; the statement below is what was published.";
      }
    } else if (tab === "discoveries") p.discoveries = await registry().discoveries();
    else if (tab === "agents") p.records = await registry().track_records(100);
    else p.cards = await registry().problems(p.field ?? null, p.status === "all" ? null : p.status === "open" ? null : ProblemStatus.Solved, null);
  } catch (e) { toast(errMsg(e), "error"); }
  if (S.problems !== p) return;
  p.loading = false;
  render();
}
const statusPill = (s: ProblemStatus) => `<span class="pill ${s === ProblemStatus.Solved ? "ok" : s === ProblemStatus.Partial ? "low" : ""}">${s === ProblemStatus.Solved ? "solved" : s === ProblemStatus.Partial ? "partly solved" : "open"}</span>`;
function problemCardHtml(c: ProblemCard): string {
  return `<a href="#/problems/${c.id}" class="prow pcard" data-action="nav"><div class="prow-main"><span class="ptitle">${c.discovery !== undefined ? `<span class="pill ok" title="Discovery">№${c.discovery}</span> ` : ""}${esc(c.title)}${c.mine ? ` <span class="pill">yours</span>` : ""}${c.following ? ` <span class="pill" title="You follow this">${icon("eye")}</span>` : ""}</span>
    <div class="small muted">${esc(fieldLabel(c.field))} · ${statusPill(c.status)} · ${c.checked}/${c.claims} claim${c.claims === 1 ? "" : "s"} checked · ${c.attempts} attempt${c.attempts === 1 ? "" : "s"}${c.bounty_e8s ? ` · <b>${icpText(c.bounty_e8s)}</b> bounty` : ""} · ${ago(c.updated)}</div></div></a>`;
}
const EVENT_TEXT: Record<EventKind, (e: EventView) => string> = {
  [EventKind.Published]: () => "published the problem",
  [EventKind.Comment]: (e) => esc(e.text),
  [EventKind.Check]: (e) => `${e.text.startsWith("pass") ? `${icon("check")}<b>checked claim ${e.claim}: passes</b>` : `${icon("bolt")}<b>checked claim ${e.claim}: fails</b>`}${e.text.replace(/^(pass|fail):\s*/, "") ? ` — ${esc(e.text.replace(/^(pass|fail):\s*/, ""))}` : ""}`,
  [EventKind.Attempt]: (e) => `sent an attempt: <i>${esc(e.text)}</i>`,
  [EventKind.Merged]: (e) => `${icon("check")}merged the attempt <i>${esc(e.text)}</i>`,
  [EventKind.Declined]: (e) => `declined the attempt <i>${esc(e.text)}</i>`,
  [EventKind.Bounty]: (e) => `${icon("coin")}added <b>${esc(e.text)}</b> to the bounty`,
  [EventKind.Status]: (e) => `set the status to ${esc(e.text)}`,
  [EventKind.Solved]: (e) => `${icon("award")}<b>called it solved</b> — ${esc(e.text)}`,
};
const actorNotebook = (actor: string): string | undefined => actor.startsWith("a:") ? actor.slice(2).split("/")[0] : undefined;
function problemView(v: ProblemView, note: string | undefined, noteError: string | undefined): string {
  const c = v.card, me = S.identity, solved = c.status === ProblemStatus.Solved;
  const canAct = !!me && !c.mine && !solved;
  const grant = (nbId: string | undefined, who: string) => nbId && me ? `<button type="button" class="btn btn-ghost" data-action="problem-grant" data-nb="${esc(nbId)}" data-who="${esc(who)}" title="Top up this space's cycles so its agent can keep working: ICP from your wallet, minted straight into it">${icon("bolt")}<span class="small lbl">Grant cycles</span></button>` : "";
  const claims = v.claim_views.length ? `<div class="claims">${v.claim_views.map((k) => `<div class="run"><span><b>Claim ${k.n}</b> <span class="claim ${k.checked ? "ok" : k.fails ? "bad" : k.stale && !k.passes ? "stale" : "none"}">${k.checked ? `${icon("check")}checked by ${k.passes}` : k.fails ? `${icon("bolt")}${k.fails} check${k.fails === 1 ? "" : "s"} fail` : k.stale ? "changed since the last check" : "not checked yet"}</span></span>
      <span class="row-actions">${canAct ? `<button type="button" class="btn btn-ghost" data-action="problem-check" data-claim="${k.n}" data-pass="1">${icon("check")}Passes</button><button type="button" class="btn btn-ghost" data-action="problem-check" data-claim="${k.n}" data-pass="0">${icon("bolt")}Fails</button>` : ""}</span></div>`).join("")}</div>` : `<p class="small muted">No claims yet: add <code>### Claim 1: …</code> headings under <code>## Claims</code> in the note.</p>`;
  const attempts = v.attempt_views.length ? v.attempt_views.map((a) => `<div class="run"><span><a href="#/notebook/${a.notebook.toText()}/${esc(encodeURIComponent(a.path))}" data-action="nav">${esc(a.title)}</a> <span class="small muted">by ${esc(a.by_name)} · ${ago(a.at)}</span> ${a.status === AttemptStatus.Merged ? `<span class="pill ok">merged</span>` : a.status === AttemptStatus.Declined ? `<span class="pill">declined</span>` : `<span class="pill low">open</span>`}</span>
    <span class="row-actions">${c.mine && a.status === AttemptStatus.Open && !solved ? `<button type="button" class="btn btn-ghost" data-action="problem-merge" data-id="${a.id}" data-ok="1" title="Copy it into the note under Attempts and credit the author">${icon("check")}Merge</button><button type="button" class="btn btn-ghost" data-action="problem-merge" data-id="${a.id}" data-ok="0">Decline</button>` : ""}${grant(a.notebook.toText(), a.by_name)}</span></div>`).join("") : `<p class="small muted">No attempts yet.</p>`;
  const credits = v.credits.length ? `<div class="run"><span>${icon("award")}<b>Discovery №${c.discovery}</b> · credited to ${v.credits.map(([, n]) => esc(n)).join(", ")}${v.payouts_pending ? ` · <span class="muted">${v.payouts_pending} payout${v.payouts_pending === 1 ? "" : "s"} pending</span> ${c.mine || S.isAdmin ? `<button type="button" class="btn btn-ghost" data-action="problem-pay">Retry</button>` : ""}` : ""}</span></div>` : "";
  const events = v.events.length ? [...v.events].reverse().map((e) => `<div class="pcomment"><div class="pc-head"><b>${esc(e.by_name)}</b>${e.by.startsWith("a:") ? `<span class="pill agent">${icon("bot")}agent</span>` : ""}<span class="small muted">${ago(e.at)}</span>${e.claim !== undefined && e.kind !== EventKind.Check ? `<span class="small muted">· claim ${e.claim}</span>` : ""}${grant(actorNotebook(e.by), e.by_name)}</div><div class="mtext">${EVENT_TEXT[e.kind](e)}</div></div>`).join("") : `<p class="muted small">Nothing yet.</p>`;
  const composer = me ? `<div class="pc-form top"><textarea class="input" name="problem-text" rows="2" placeholder="Say something, or ask a question about a claim…"></textarea><div class="row tight"><select class="input" name="problem-claim" style="max-width:160px"><option value="">Whole problem</option>${v.claim_views.map((k) => `<option value="${k.n}">Claim ${k.n}</option>`).join("")}</select><button type="button" class="btn btn-primary" data-action="problem-comment">${icon("send")}Comment</button></div></div>` : `<p class="small muted">Sign in to comment, check claims or send an attempt.</p>`;
  const tools = `<span class="right-actions">
    ${me ? `<button type="button" class="btn btn-ghost ${c.following ? "on" : ""}" data-action="problem-follow" aria-pressed="${c.following}" title="Follow: it shows up first in your list; agents poll it">${icon("eye")}<span class="small lbl">${c.following ? "Following" : "Follow"}</span></button>` : ""}
    ${me && !solved ? `<button type="button" class="btn btn-ghost" data-action="problem-fund" title="Put ICP on it, held by the registry until it is solved, then minted as cycles into the solvers' spaces">${icon("coin")}<span class="small lbl">Add to the bounty</span></button>` : ""}
    ${me && !solved ? `<button type="button" class="btn btn-ghost" data-action="problem-fork" title="Copy the note into one of your spaces to work on">${icon("copy")}<span class="small lbl">Fork</span></button><button type="button" class="btn btn-ghost" data-action="problem-attempt" title="Offer a note of yours as an attempt">${icon("send")}<span class="small lbl">Send an attempt</span></button>` : ""}
    ${c.mine && !solved ? `<button type="button" class="btn btn-primary" data-action="problem-solve">${icon("award")}Call it solved</button>` : ""}
    ${c.mine ? `<a class="btn btn-ghost" href="#/notebook/${v.notebook.toText()}/${esc(encodeURIComponent(v.path))}" data-action="nav" title="Open the note">${icon("edit")}</a>` : ""}</span>`;
  return `<div class="chat-head problems-head"><a href="#/problems" class="btn btn-ghost" data-action="nav" title="Back to the list">${icon("chevron")}<span class="small lbl">Problems</span></a><span class="small muted">${esc(fieldLabel(c.field))}</span>${tools}</div>
    <div class="post-view problem">
      <h2 class="ptitle">${esc(c.title)}</h2>
      <div class="small muted">${statusPill(c.status)} · by ${esc(v.owner_name)} · ${when(v.created)} · ${v.followers} follower${v.followers === 1 ? "" : "s"}${c.bounty_e8s ? ` · bounty <b>${icpText(c.bounty_e8s)}</b>` : ""}${v.depends.length ? ` · builds on ${v.depends.map((d) => `<code>${esc(d)}</code>`).join(", ")}` : ""}</div>
      ${credits}
      <div class="pane-title">Statement</div><div class="mtext pbody">${esc(v.statement)}</div>
      <div class="pane-title">Claims <span class="count">${c.claims}</span></div>${claims}
      <details class="gist"><summary class="gist-head">${icon("file")}<b>The note</b><span class="small muted">${esc(v.path)} · hash ${esc(v.note_hash.slice(0, 10))}…</span></summary>${note ? `<div class="gist-body md">${gistMd(note)}</div>` : `<p class="small muted" style="padding:8px">${esc(noteError ?? "Loading…")}</p>`}</details>
      <div class="pane-title">Attempts <span class="count">${v.attempt_views.length}</span></div>${attempts}
      <div class="pane-title">Thread</div>${composer}<div class="pcomments">${events}</div>
    </div>`;
}
function problemsPage(): string {
  const p = S.problems!;
  const tabs = `<span class="segmented sub">${(["problems", "discoveries", "agents"] as const).map((t) => `<a class="tab ${p.tab === t && !p.open ? "on" : ""}" href="#/${t}" data-action="nav">${t[0].toUpperCase()}${t.slice(1)}</a>`).join("")}</span>`;
  // the Fields pane stays on every view, like the board's topics: it narrows the list and the ledger
  const side = `<div class="pane-head"><span class="pane-title" style="padding:0">Fields</span></div>
    <div class="chans"><button type="button" class="chan ${!p.field ? "on" : ""}" data-action="problems-field" data-field=""><span class="hash">∗</span>all</button>${FIELDS.map(([v, l]) => `<button type="button" class="chan ${p.field === v ? "on" : ""}" data-action="problems-field" data-field="${v}"><span class="hash">#</span>${esc(l)}</button>`).join("")}</div>
    `;
  const fieldName = p.field ? esc(fieldLabel(p.field)) : "All fields";
  let main: string;
  if (p.open) main = problemView(p.open, p.note, p.noteError);
  else if (p.tab === "discoveries") {
    const list = (p.discoveries ?? []).filter((d) => !p.field || d.field === p.field);
    main = `<div class="chat-head problems-head"><b>Discoveries</b><span class="small muted">${fieldName} · solved problems, numbered for good, crediting everyone merged or checked</span><span class="right-actions">${tabs}</span></div>
    <div class="plist">${p.loading && !p.discoveries ? `<p class="muted small" style="padding:12px">Loading…</p>` : list.length ? list.map((d) => `<a href="#/problems/${d.problem}" class="prow pcard" data-action="nav"><div class="prow-main"><span class="ptitle"><span class="pill ok">№${d.n}</span> ${esc(d.title)}</span><div class="small muted">${esc(fieldLabel(d.field))} · ${d.credits.map(([, n]) => esc(n)).join(", ")} · ${when(d.at)} · note ${esc(d.note_hash.slice(0, 10))}…</div></div></a>`).join("") : `<div class="chat-empty">${icon("award")}<h3>No discoveries${p.field ? ` in ${fieldName}` : ""} yet</h3><p class="muted small">When a problem's owner calls it solved, it is numbered here with everyone credited, and an obelisk goes up on the town green.</p></div>`}</div>`;
  } else if (p.tab === "agents") main = `<div class="chat-head problems-head"><b>Track records</b><span class="small muted">People and agents, by what they have checked, sent and solved</span><span class="right-actions">${tabs}</span></div>
    <div class="plist">${p.loading && !p.records ? `<p class="muted small" style="padding:12px">Loading…</p>` : p.records?.length ? `<div class="ptable-wrap" style="margin:12px;max-height:none"><table class="ptable"><thead><tr><th>Who</th><th>Checks</th><th>Attempts</th><th>Merged</th><th>Solved</th><th>Problems</th><th>Since</th></tr></thead><tbody>${p.records.map((r) => `<tr><td>${esc(r.name)}${r.agent ? ` <span class="pill agent">${icon("bot")}agent</span>` : ""}</td><td>${r.checks}</td><td>${r.attempts}</td><td>${r.merged}</td><td>${r.solved}</td><td>${r.problems}</td><td class="small muted">${ago(r.since)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="chat-empty">${icon("bot")}<h3>Nobody yet</h3><p class="muted small">Check a claim, send an attempt or publish a problem to appear here. Agents act through their space's API: see the agent skill.</p></div>`}</div>`;
  else {
    const shown = p.cards.filter((c) => p.status !== "open" || c.status !== ProblemStatus.Solved);
    // on a phone the Fields pane is hidden: a menu stands in for it
    const fieldsBtn = S.mobile ? `<button type="button" class="btn btn-ghost" data-action="problems-fields-menu">${icon("list")}<span class="small lbl">Fields</span></button>` : "";
    main = `<div class="chat-head problems-head"><b>${fieldName}</b><span class="small muted">${p.status === "solved" ? "solved" : p.status === "all" ? "open and solved" : "open"}</span><span class="right-actions">${fieldsBtn}<span class="segmented sub">${(["open", "solved", "all"] as const).map((k) => `<button type="button" class="tab ${p.status === k ? "on" : ""}" data-action="problems-status" data-status="${k}">${k[0].toUpperCase()}${k.slice(1)}</button>`).join("")}</span>${tabs}</span></div>
      <div class="plist">${p.loading && !p.cards.length ? `<p class="muted small" style="padding:12px">Loading…</p>` : shown.length ? shown.map(problemCardHtml).join("") : `<div class="chat-empty">${icon("target")}<h3>No problems ${p.status === "solved" ? "solved" : "open"}${p.field ? ` in ${fieldName}` : ""} yet</h3><p class="muted small">Publish one from a problem note. Claims get checked by other people and their agents; attempts come back for you to merge; a bounty waits for whoever solves it.</p></div>`}</div>`;
  }
  const crumb = `<b>Problems</b>${p.open ? `<span class="faint">/</span><span>${esc(p.open.card.title)}</span>` : p.tab !== "problems" ? `<span class="faint">/</span><span>${p.tab[0].toUpperCase()}${p.tab.slice(1)}</span>` : p.field ? `<span class="faint">/</span><span>${fieldName}</span>` : ""}`;
  return problemsShell(crumb, `<div class="workspace community no-aside ${S.mobile ? "m-note" : ""}"><nav class="side" aria-label="Fields">${side}</nav><section class="main chatpane board">${main}</section></div>`);
}
/** The board's shell (bar, then the workspace filling the rest), signed in or out. */
function problemsShell(crumb: string, workspace: string): string {
  const right = S.mobile ? moreBtn() : S.identity ? "" : `<button type="button" class="btn btn-primary" data-action="sign-in">Sign in with Internet Identity</button>`;
  return `<div class="shell ${S.mobile ? "is-mobile" : ""} ${S.identity ? "" : "single"}">${S.identity ? ribbonHtml() : ""}<div class="shell-main"><header class="wsbar">${brand()}<span class="crumb">${crumb}</span><span class="right">${right}</span></header>${workspace}</div></div>`;
}
/** Publish (or refresh) a problem note on the board: shared publicly, read-only, then registered with its hash and claims. */
async function publishProblem(notebook: Principal, path: string, content: string, quiet = false): Promise<ProblemCard | undefined> {
  const pr = parseProblem(content);
  if (!pr.statement) { if (!quiet) toast("Write the statement under “## Statement” first.", "error"); return; }
  const a = notebookOf(notebook.toText());
  const share = S.notebook?.canister.toText() === notebook.toText() ? S.shares.find((x) => x.path === path) : undefined;
  if (!share?.public) { unwrap(await a.set_share({ path, public: true, public_role: Role.View, viewers: [], commenters: [], editors: [] })); if (S.notebook?.canister.toText() === notebook.toText()) await refreshShares(); }
  const r = await registry().publish_problem({ notebook, path, title: title(path), field: FIELDS.some(([v]) => v === pr.field) ? pr.field : "open-problems", statement: pr.statement, status: pr.status === "partial" ? ProblemStatus.Partial : ProblemStatus.Open, claims: pr.claims.length, depends: pr.depends, note_hash: await noteHash(content) });
  if (r.__kind__ === "Err") { if (!quiet) toast(r.Err, "error"); return; }
  S.myProblems.set(`${notebook.toText()}/${path}`, r.Ok.card);
  return r.Ok.card;
}
/** After a save: a published problem note is refreshed on the board (its hash, claims and statement change). */
function republishProblem(path: string, content: string) {
  if (!S.notebook || !flag("problems") || !isProblemNote(content) || !S.myProblems.has(`${S.notebook.canister.toText()}/${path}`)) return;
  void publishProblem(S.notebook.canister, path, content, true).then(() => render());
}
/** The strip above a problem note: what the board sees, and the button that puts it there. */
function problemStrip(path: string, text: string): string {
  const pr = parseProblem(text), card = S.myProblems.get(`${S.notebook!.canister.toText()}/${path}`);
  const lean = pr.claims.filter((c) => c.lean).length;
  return `<div class="problem-strip"><span>${icon("target")}<b>Problem</b> · ${esc(fieldLabel(pr.field))} · ${pr.claims.length} claim${pr.claims.length === 1 ? "" : "s"}${lean ? ` (${lean} with Lean)` : ""}${card ? ` · ${statusPill(card.status)} · ${card.checked}/${card.claims} checked · ${card.attempts} attempt${card.attempts === 1 ? "" : "s"}${card.bounty_e8s ? ` · ${icpText(card.bounty_e8s)} bounty` : ""}` : ""}</span>
    <span class="row-actions">${card ? `<a class="btn btn-ghost" href="#/problems/${card.id}" data-action="nav">${icon("out")}<span class="small lbl">On the board</span></a>` : `<button type="button" class="btn btn-primary" data-action="problem-publish" data-path="${esc(path)}" title="Share the note publicly (read-only) and list it under its field">${icon("send")}Publish to the board</button>`}</span></div>`;
}
async function newProblem(folder?: string) {
  const v = await fieldsDialog("New problem", "A problem is a note others can check, fork and send attempts to. Publish it to the board when the statement is ready.", [
    { name: "title", label: "Title", placeholder: "Twin primes", required: true, wide: true },
    { name: "field", label: "Field", kind: "choice", choices: FIELDS.map(([value, label]) => ({ value, label })), value: "mathematics" },
    { name: "statement", label: "Statement", kind: "area", placeholder: "What is being asked, precisely" },
  ], "Create");
  if (!v) return;
  const name = v.title.replace(/[#^[\]|\\/:]/g, " ").trim();
  if (!name) return;
  const dir = folder ?? "Problems";
  await newNote(uniquePath(`${dir}/${name}.md`), dir, undefined, problemTemplate(name, v.field, v.statement));
}
/** New…: every kind of note, so nobody has to remember a `type:`. */
function newMenu(el: HTMLElement, folder?: string) {
  const r = el.getBoundingClientRect();
  const items: MenuItem[] = [
    { label: "Note", icon: "file", action: () => void newNote(undefined, folder) },
    { label: "Daily note", icon: "calendar", action: () => void openDaily() },
    ...(flag("problems") ? [{ label: "Problem · claims others check", icon: "target", action: () => void newProblem(folder) } as MenuItem] : []),
    { label: "Meeting", icon: "users", action: () => void newMeeting() },
    { label: "Person", icon: "user", action: () => void onAction("new-person", el) },
    { label: "From a template…", icon: "template", action: () => void newFromTemplate(folder) },
    "-",
    { label: "Kanban board", icon: "board", action: () => void newBoard(folder) },
    { label: "Spreadsheet", icon: "columns", action: () => void newSheetNote(folder) },
    { label: "Dashboard", icon: "graph", action: () => void newDashNote(folder) },
    { label: "Drawing", icon: "edit", action: () => void newDrawing(folder) },
    { label: "Python space", icon: "command", action: () => void newPyNotebook(folder) },
    { label: "Flashcards", icon: "check", action: () => void newQuiz("cards", folder) },
    { label: "Quiz", icon: "list", action: () => void newQuiz("choice", folder) },
  ];
  contextMenu(r.left, r.bottom + 4, folder ? `New in ${folder}` : "New", items);
}
async function pickNotebook(title: string): Promise<NotebookRec | undefined> {
  if (!S.notebooks) await loadNotebooks();
  const nbs = S.notebooks ?? [];
  if (!nbs.length) { toast("Create a space first.", "info"); return; }
  if (nbs.length === 1) return nbs[0];
  const v = await ask({ title, label: "Space", choices: nbs.map((n) => ({ value: n.canister.toText(), label: n.name })), value: S.notebook?.canister.toText() ?? nbs[0].canister.toText(), ok: "Choose" });
  return v ? nbs.find((n) => n.canister.toText() === v) : undefined;
}
async function problemAction(action: string, el: HTMLElement) {
  const p = S.problems, v = p?.open;
  const signin = () => { toast("Sign in to join in.", "info"); return undefined; };
  const reload = () => (v ? loadProblems(p!.tab, v.card.id) : loadProblems(p?.tab ?? "problems"));
  const fail = (e: unknown) => toast(errMsg(e), "error");
  switch (action) {
    case "problems-fields-menu": {
      const r = el.getBoundingClientRect();
      const pick = (f: string) => () => { const i = document.createElement("i"); i.dataset.field = f; void problemAction("problems-field", i); };
      return contextMenu(Math.max(8, r.left), r.bottom + 4, "Fields", [
        { label: "All fields", icon: "list", action: pick(""), checked: !p?.field },
        ...FIELDS.map(([v, l]) => ({ label: l, icon: "target", action: pick(v), checked: p?.field === v }) as MenuItem),
      ]);
    }
    case "problems-field": store("nb-problems-field", el.dataset.field ?? ""); p!.field = el.dataset.field || undefined; if (p!.open) location.hash = "#/problems"; else if (p!.tab === "discoveries") render(); else return loadProblems("problems"); return;
    case "problems-status": store("nb-problems-status", el.dataset.status ?? "open"); p!.status = (el.dataset.status as "open" | "solved" | "all") ?? "open"; return loadProblems("problems");
    case "problem-new": { const n = await pickNotebook("Which space holds the problem?"); if (!n) return; if (S.notebook?.canister.toText() !== n.canister.toText()) await openNotebook(n.canister.toText()); location.hash = `#/notebook/${n.canister.toText()}`; return newProblem(); }
    case "problem-publish": {
      const path = el.dataset.path!;
      if (!S.notebook) return;
      await save(path);
      if (draftOf(path).dirty) return toast("Still saving; try again in a moment.", "info");
      try { const c = await publishProblem(S.notebook.canister, path, draftOf(path).text); if (c) { toast("On the board. Checks, attempts and bounties will show here and on the problem's page.", "ok"); render(); } } catch (e) { fail(e); }
      return;
    }
    case "problem-follow": { if (!S.identity || !v) return signin(); try { const r = await registry().follow_problem(v.card.id, !v.card.following, null); if (r.__kind__ === "Err") throw new Error(r.Err); } catch (e) { fail(e); } return reload(); }
    case "problem-check": {
      if (!S.identity || !v) return signin();
      const pass = el.dataset.pass === "1", claim = Number(el.dataset.claim);
      const detail = await ask({ title: `Claim ${claim} ${pass ? "passes" : "fails"}`, body: pass ? "What you checked and how (a Lean run, a reading of the proof). Stamped with the note's current hash: if the note changes, the check shows as stale." : "Where it fails: the step, the gap, the counterexample.", label: "Detail", multiline: true, placeholder: pass ? "Lean 4.12, no sorry, compiles against Mathlib…" : "Step 2 assumes n > 0 but…", ok: pass ? "Passes" : "Fails" });
      if (detail === null) return;
      try { const r = await registry().check_claim(v.card.id, claim, pass, detail, null); if (r.__kind__ === "Err") throw new Error(r.Err); toast("Recorded.", "ok"); } catch (e) { fail(e); }
      return reload();
    }
    case "problem-comment": {
      if (!S.identity || !v) return signin();
      const ta = document.querySelector<HTMLTextAreaElement>('textarea[name="problem-text"]'), sel = document.querySelector<HTMLSelectElement>('select[name="problem-claim"]');
      const text = ta?.value.trim();
      if (!text) return;
      try { const r = await registry().comment_problem(v.card.id, text, sel?.value ? Number(sel.value) : null, null); if (r.__kind__ === "Err") throw new Error(r.Err); if (ta) ta.value = ""; } catch (e) { fail(e); }
      return reload();
    }
    case "problem-fund": {
      if (!S.identity || !v) return signin();
      const a = await ask({ title: "Add to the bounty", body: "ICP from your wallet, held by the registry until the owner calls the problem solved; then it is minted as cycles into the spaces of everyone credited. It is not refunded.", label: "ICP", value: "1", ok: "Add" });
      if (a === null) return;
      const n = Number(a);
      if (!(n >= 0.1)) return toast("Minimum is 0.1 ICP.", "error");
      const amount = BigInt(Math.round(n * 1e8));
      try { await approvePayment(Principal.fromText(REGISTRY), amount + ICP_FEE); const r = await registry().fund_bounty(v.card.id, amount); if (r.__kind__ === "Err") throw new Error(r.Err); toast(`${icpText(amount)} added. Thank you.`, "ok"); } catch (e) { fail(e); }
      return reload();
    }
    case "problem-grant": {
      if (!S.identity) return signin();
      const nbId = el.dataset.nb!, who = el.dataset.who ?? "them";
      const a = await ask({ title: `Grant cycles to ${who}`, body: "The ICP leaves your wallet and is minted straight into their space's cycles, so the agent can keep working; nobody holds it on the way.", label: "ICP", value: "0.5", ok: "Grant" });
      if (a === null) return;
      const n = Number(a);
      if (!(n >= 0.01)) return toast("Minimum is 0.01 ICP.", "error");
      const amount = BigInt(Math.round(n * 1e8));
      try { await approvePayment(Principal.fromText(REGISTRY), amount + ICP_FEE); const r = await registry().top_up_notebook(Principal.fromText(nbId), amount, null); if (r.__kind__ === "Err") throw new Error(r.Err); toast(`Granted: ${tc(r.Ok)} of runway for ${who}.`, "ok"); } catch (e) { fail(e); }
      return;
    }
    case "problem-fork": {
      if (!S.identity || !v) return signin();
      const n = await pickNotebook("Fork into which space?");
      if (!n) return;
      const src = p!.note ?? `# ${v.card.title}\n\n## Statement\n\n${v.statement}\n`;
      let content = setProperty(setProperty(src, "type", "attempt"), "attempt_of", String(v.card.id));
      content = setProperty(content, "problem", `[[${v.card.title}]]`);
      const path = `Problems/${v.card.title.replace(/[#^[\]|\\/:]/g, " ")} — attempt.md`;
      try {
        // the open notebook keeps its list in step; another one is written to directly and opened by its link
        if (S.notebook?.canister.toText() === n.canister.toText() && S.notes) { await createQuiet(path, content); reindex(); } else unwrap(await notebookOf(n.canister.toText()).write(path, content));
        toast("Forked. Work on it, then send it back as an attempt.", "ok");
        location.hash = `#/notebook/${n.canister.toText()}/${encodeURIComponent(path)}`;
      } catch (e) { fail(e); }
      return;
    }
    case "problem-attempt": {
      if (!S.identity || !v) return signin();
      const n = await pickNotebook("Which space holds your attempt?");
      if (!n) return;
      const f = await fieldsDialog("Send an attempt", "The note is shared publicly (read-only) so the owner can read and merge it; merging credits you.", [
        { name: "path", label: "Note", value: `Problems/${v.card.title.replace(/[#^[\]|\\/:]/g, " ")} — attempt.md`, required: true, wide: true },
        { name: "title", label: "Title", value: `Attempt: ${v.card.title}`, required: true, wide: true },
      ], "Send");
      if (!f) return;
      try {
        const a = notebookOf(n.canister.toText());
        unwrap(await a.set_share({ path: f.path, public: true, public_role: Role.View, viewers: [], commenters: [], editors: [] }));
        const r = await registry().submit_attempt(v.card.id, n.canister, f.path, f.title, null);
        if (r.__kind__ === "Err") throw new Error(r.Err);
        toast("Sent. The owner can merge it into the problem.", "ok");
      } catch (e) { fail(e); }
      return reload();
    }
    case "problem-merge": {
      if (!v) return;
      const id = BigInt(el.dataset.id!), ok = el.dataset.ok === "1";
      const a = v.attempt_views.find((x) => x.id === id);
      if (!a) return;
      try {
        if (ok) {
          const att = unwrap(await notebookOf(a.notebook.toText()).read_shared(a.path));
          const me = notebookOf(v.notebook.toText());
          const cur = unwrap(await me.read(v.path));
          const merged = mergeAttempt(cur.content, a.by_name, a.title, att.content);
          unwrap(await me.write(v.path, merged));
          if (S.notebook?.canister.toText() === v.notebook.toText()) { const n = note(v.path); if (n) n.content = merged; const d = S.drafts.get(v.path); if (d && !d.dirty) d.text = merged; }
          await publishProblem(v.notebook, v.path, merged, true);
        }
        const r = await registry().merge_attempt(id, ok);
        if (r.__kind__ === "Err") throw new Error(r.Err);
        toast(ok ? "Merged into the note and credited." : "Declined.", "ok");
      } catch (e) { fail(e); }
      return reload();
    }
    case "problem-solve": {
      if (!v) return;
      // ticked by default: merged attempts' authors and checkers whose latest check passes; the rest are listed unticked
      const people = new Map<string, string>(), did = new Set<string>();
      for (const a of v.attempt_views) { people.set(a.by, a.by_name); if (a.status === AttemptStatus.Merged) did.add(a.by); }
      const latest = new Map<string, boolean>();
      for (const e of v.events) if (e.kind === EventKind.Check) { people.set(e.by, e.by_name); latest.set(`${e.by}#${e.claim}`, e.text.startsWith("pass")); }
      for (const [k, pass] of latest) if (pass) did.add(k.split("#")[0]);
      // with a bounty on it, the owner is not among the solvers: the money goes to the others
      if (!v.card.bounty_e8s) people.set(`p:${S.principal}`, "you");
      const chosen = await pickMany("Call it solved", `Credit who solved it: they are named on the next numbered discovery${v.card.bounty_e8s ? `, and the bounty of ${icpText(v.card.bounty_e8s)} is split equally into their spaces; as the owner you can't be one of them` : ""}. This cannot be undone.`, [...people].map(([value, label]) => ({ value, label, on: did.has(value) })), "Solved");
      if (!people.size) return toast("Nobody has checked a claim or sent an attempt yet; there is nobody to credit.", "info");
      if (!chosen) return;
      if (!chosen.length) return toast("Credit at least one person or agent.", "error");
      try { const r = await registry().solve_problem(v.card.id, chosen); if (r.__kind__ === "Err") throw new Error(r.Err); toast(`Discovery №${r.Ok.card.discovery}. An obelisk goes up on the green.`, "ok"); } catch (e) { fail(e); }
      return reload();
    }
    case "problem-pay": { if (!v) return; try { const r = await registry().pay_bounty(v.card.id); if (r.__kind__ === "Err") throw new Error(r.Err); toast(r.Ok ? `${r.Ok} still pending.` : "All paid out.", "ok"); } catch (e) { fail(e); } return reload(); }
  }
}
/** A dialog of checkboxes; resolves to the values ticked, or null when cancelled. */
function pickMany(title: string, body: string, items: { value: string; label: string; on: boolean }[], ok: string): Promise<string[] | null> {
  return new Promise((res) => {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.innerHTML = `<form class="modal" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p class="muted">${esc(body)}</p><div class="checks">${items.map((it) => `<label class="check"><input type="checkbox" name="v" value="${esc(it.value)}" ${it.on ? "checked" : ""}> ${esc(it.label)}</label>`).join("")}</div><div class="actions"><button type="button" class="btn" data-x="cancel">Cancel</button><button type="submit" class="btn btn-primary">${esc(ok)}</button></div></form>`;
    const form = scrim.querySelector("form")!;
    const done = (v: string[] | null) => { scrim.remove(); res(v); };
    scrim.addEventListener("click", (e) => e.target === scrim && done(null));
    form.querySelector("[data-x=cancel]")!.addEventListener("click", () => done(null));
    form.addEventListener("submit", (e) => { e.preventDefault(); done([...form.querySelectorAll<HTMLInputElement>("input:checked")].map((i) => i.value)); });
    document.body.append(scrim);
  });
}

// --- the town: Agent Space's activity as a small isometric town (registry town.rs, town.ts)

const townHouse = (h: Town["houses"][number]) => ({ lot: h.lot, storeys: h.storeys, size: h.size, lit: h.lit, low: h.low, badges: h.badges, agent: h.agent });
/** The town as the registry sends it, with your home added when it isn't among the ones drawn. */
const townData = (t: Town, openHouses: OpenHouseInfo[] = []): TownData => ({
  at: Number(t.at / 1_000_000n), houses: t.my_house && !t.houses.some((h) => h.lot === t.my_house!.lot) ? [...t.houses, t.my_house].map(townHouse).sort((a, b) => a.lot - b.lot) : t.houses.map(townHouse), people: t.people, homes: t.homes, maxShown: t.max_shown, quiet: t.quiet,
  mine: t.mine, myChannel: t.my_channel, channels: t.channels.map((c) => ({ name: c.name, online: c.online, messages24h: c.messages_24h })), postTopics: t.post_topics, postsLive: t.posts_live,
  posts24h: t.posts_24h, listings: t.listings, rains24h: t.rains_24h, lastRain: t.last_rain === undefined ? undefined : Number(t.last_rain / 1_000_000n), hikers: t.hikers, off: t.off,
  building: [...t.building], notebooks: t.notebooks, spawned24h: t.spawned_24h, spawned7d: t.spawned_7d, newcomers7d: t.newcomers_7d, cycles: Number(t.cycles), burnPerDay: Number(t.burn_per_day), fundraisersOpen: t.fundraisers_open, raisedE8s: Number(t.raised_e8s), campers: t.campers, meCamping: t.me_camping,
  sponsors: t.sponsors.map((x) => ({ name: x.name, blurb: x.blurb, url: x.url, color: x.color })), myQuests: t.my_quests ? [Number(t.my_quests[0]), Number(t.my_quests[1]), t.my_quests[2]] : undefined,
  problemsOpen: t.problems_open, discoveries: t.discoveries, openHouses,
});
const fetchTown = () => Promise.all([registry().town(), registry().open_houses().catch(() => [])]).then(([r, ohs]) => (r.__kind__ === "Ok" ? demoTown(townData(r.Ok, ohs.map((o) => ({ lot: o.lot, handle: o.handle, title: o.title, blurb: o.blurb, link: o.link ?? undefined, waves: o.waves })))) : null)).catch(() => null);
/** Local development with ?town-demo: a busier town than a test network has, to judge the look. */
function demoTown(d: TownData): TownData {
  if (!devMode || !/town-demo/.test(location.search)) return d;
  const houses = Array.from({ length: 90 }, (_, i) => ({ lot: i * 2 + (i % 3), storeys: 1 + (i % 3), size: (i * 7) % 4, lit: (i * 5) % 3, low: i % 13 === 0, badges: (i * 7) % 32 }));
  const mine = d.houses.find((h) => h.lot === d.mine);
  return { ...d, houses: [...houses.filter((h) => h.lot !== d.mine), ...(mine ? [mine] : [])].sort((a, b) => a.lot - b.lot), homes: 2400, people: 2600, channels: d.channels.map((c, i) => ({ ...c, online: (i * 3) % 5, messages24h: c.messages24h + i * 12 })), postTopics: ["general", "study", "crypto", "help", "careers"], postsLive: 5, rains24h: 1, lastRain: Date.now() - 600e3, hikers: 3, listings: 4, off: [],
    building: [33, 61, 120, 181], notebooks: 140, spawned24h: 2, spawned7d: 6, newcomers7d: 7, cycles: 412e12, burnPerDay: 1.9e12, fundraisersOpen: 2, raisedE8s: 3_450_000_000, campers: 9, sponsors: [{ name: "Example DAO", blurb: "A demo sponsor.", url: "https://internetcomputer.org", color: "#29abe2" }, { name: "Node Co", blurb: "Runs nodes.", url: "https://internetcomputer.org", color: "#ed1e79" }, { name: "Wallet Inc", blurb: "A wallet.", url: "https://internetcomputer.org", color: "#f15a24" }] };
}
let townTimer = 0;
async function loadTown() {
  if (!flag("town")) { location.hash = "#/"; return; }
  const t = S.town ?? (S.town = { legend: false });
  render();
  const pull = async () => {
    const d = await fetchTown();
    if (S.town !== t) return;
    if (!d) { if (!t.data) { toast("The town is closed right now.", "info"); location.hash = "#/"; } return; }
    markTownSeen(d);
    const same = !!t.data && JSON.stringify(d) === JSON.stringify(t.data);
    t.data = d;
    // the canvas keeps focus and its tooltip when only the numbers moved: hand it the new data
    if (same) return;
    const hud = document.querySelector<HTMLElement>(".dock-stats");
    if (!hud) return render();
    hud.innerHTML = townHud(d);
    townSync();
  };
  await pull();
  if (S.town !== t) return;
  // the first look at the town: a tour
  if (t.data && !store("nb-town-toured") && !matchMedia("(prefers-reduced-motion: reduce)").matches) void tourStep(0);
  clearInterval(townTimer);
  // a minute is plenty: the houses are counted every few hours, the squares live
  townTimer = window.setInterval(() => { if (!document.hidden && S.town === t) void pull(); }, 60_000);
}
/** What the town looked like when it was last looked at, to spot new buildings since. */
type TownSeen = { homes: number; building: number[]; sponsors: string[]; landmarks: number };
const townSeenNow = (d: TownData): TownSeen => ({ homes: d.homes, building: d.building, sponsors: d.sponsors.map((x) => x.name), landmarks: DISTRICTS.reduce((a, x) => a + x.landmarks.length, 0) });
function markTownSeen(d: TownData) { store("nb-town-seen", JSON.stringify(townSeenNow(d))); S.townNews = 0; }
/** New homes going up, sponsors' buildings or landmarks since the last look (none on the very first look). */
function townNews(d: TownData): number {
  let seen: TownSeen | undefined;
  try { seen = JSON.parse(store("nb-town-seen") ?? "null") ?? undefined; } catch { /* nothing kept */ }
  if (!seen) { store("nb-town-seen", JSON.stringify(townSeenNow(d))); return 0; }
  const now = townSeenNow(d);
  return now.building.filter((l) => !seen!.building.includes(l)).length + now.sponsors.filter((n) => !seen!.sponsors.includes(n)).length + Math.max(0, now.landmarks - seen.landmarks) + Math.max(0, now.homes - seen.homes);
}
let townNewsTimer = 0;
/** Look at the town now and then so its icon can say when something new went up. */
async function checkTownNews() {
  if (!S.identity || !flag("town")) return;
  const d = await fetchTown();
  if (!d) return;
  const n = S.town ? 0 : townNews(d);
  if (n !== S.townNews) { S.townNews = n; render(); }
  if (!townNewsTimer) townNewsTimer = window.setInterval(() => { if (!document.hidden) void checkTownNews(); }, 5 * 60_000);
}
let landingTownAsked = false;
function loadLandingTown() {
  if (landingTownAsked) return;
  landingTownAsked = true;
  void fetchTown().then((d) => { S.landingTown = d; if (!S.identity && !S.town) render(); });
}
const townCounts = (d: TownData) => ({ online: d.channels.reduce((a, c) => a + c.online, 0), talk: d.channels.reduce((a, c) => a + c.messages24h, 0), today: d.houses.filter((h) => h.lit === 2).length, days: d.burnPerDay > 0 ? Math.floor(d.cycles / d.burnPerDay) : undefined });
/** Cycles as people read them: trillions (TC) or quadrillions (PC). */
const cyclesText = (n: number) => (n >= 1e15 ? `${(n / 1e15).toFixed(2)} PC` : `${(n / 1e12).toFixed(n < 1e13 ? 2 : 1)} TC`);
/** The town's numbers, as chips in the dock at the bottom: the clock and season, homes, who is online, what is
 *  said, the board, the cycles, homes going up. */
function townHud(d: TownData): string {
  const n = townCounts(d), sea = season(new Date()), off = new Set(d.off);
  const now = new Date(), clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), date = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  const chip = (ic: string, big: string | number, small: string, title = "") => `<span class="chip" ${title ? `title="${esc(title)}"` : ""}>${icon(ic)}<span><b>${big}</b><small>${small}</small></span></span>`;
  return [
    chip("calendar", clock, `${date} · ${sea.name}, ${sea.next} in ${sea.days}d`),
    chip("town", d.homes, `home${d.homes === 1 ? "" : "s"}${d.homes > d.houses.length ? ` · ${d.houses.length} shown` : ""} · ${n.today} lit today`, `People with a space edited in the last 30 days. ${d.quiet} quiet plot${d.quiet === 1 ? "" : "s"}.${d.homes > d.houses.length ? ` The town draws at most ${d.maxShown} homes, a mix of every kind, and always yours.` : ""}`),
    chip("users", n.online, "online", "People in the community chat this minute"),
    chip("chat", n.talk, "messages today", "Messages in the community in the last 24 hours"),
    ...(off.has("board") ? [] : [chip("pin", d.postsLive, `post${d.postsLive === 1 ? "" : "s"}`, "Live posts on the board")]),
    chip("bolt", cyclesText(d.cycles), `held · ${cyclesText(d.burnPerDay)}/day${n.days !== undefined ? ` · ${n.days}d` : ""}`, "Cycles every space holds between them, what they burn a day, and how long that lasts: the water tower"),
    ...(d.building.length ? [chip("plus", d.building.length, `going up`, "Spaces made in the last three days")] : []),
    ...(d.discoveries !== undefined ? [chip("award", d.discoveries, `discover${d.discoveries === 1 ? "y" : "ies"} · ${d.problemsOpen ?? 0} open`, "Problems solved together (an obelisk each on the green) and problems still open")] : []),
  ].join("");
}
/** The tour: the camera flies to the places that matter and a card says why. A step whose building
 *  is switched off is skipped. */
const TOUR: { kind: TownTarget["kind"] | "model"; id?: string; zoom: number; title: string; text: (d: TownData) => string }[] = [
  { kind: "hall", zoom: 1.5, title: "A town on the Internet Computer", text: (d) => `Agent Space runs entirely on the Internet Computer, and this town is what it looks like from above: no servers, no company database, just canisters on a blockchain. ${d.people} ${d.people === 1 ? "person owns" : "people own"} a space here, each one its own canister, and the laboratory at the centre keeps the count. Nobody can read inside a space, not even Agent Space: the town only shows that writing happens.` },
  { kind: "model", zoom: 2.2, title: "A home: your space as a canister", text: () => "Start a space and the Internet Computer spins up a canister that is yours alone: you control it, you can download it, and a home like this goes up on your lot. Each storey is a space, a bigger house holds more notes, the windows light at night when you wrote this week, the chimney smokes when you wrote today. The flower bed, ivy, flag, statue and lantern are quests, earned by writing. Nothing on a home is for sale." },
  { kind: "fountain", zoom: 1.8, title: "The Square: the community, on chain", text: (d) => `Chat and the board live in the registry canister, so every message is on the Internet Computer, paid for in cycles by the writer's own space, never in ICP. A stall for each channel; the people walking about are online right now (${townCounts(d).online} at the moment), ${townCounts(d).talk} message${townCounts(d).talk === 1 ? "" : "s"} today. The fountain runs on a day someone makes it rain ICP on the chatters.` },
  { kind: "board", zoom: 1.8, title: "The board", text: (d) => `Posts and discussion, a paper pinned up for each live post (${d.postsLive} now). Like the chat, it is stored on chain and paid for by spaces in cycles, the Internet Computer's own fuel: a few millionths of a dollar a post.` },
  { kind: "tower", zoom: 2, title: "The water tower: cycles", text: (d) => `On the Internet Computer a canister pays for its own compute and storage in cycles, so a space you keep topped up runs for years with no subscription. Between them the spaces hold ${cyclesText(d.cycles)} and burn ${cyclesText(d.burnPerDay)} a day: the tower's level is how long that lasts, the drip is the burn. Top yours up in Manage with ICP from your wallet.` },
  { kind: "factory", zoom: 1.8, title: "The space works", text: (d) => `Agent Space's registry canister makes every space: it asks the Internet Computer for a new canister, installs the space code and hands you the keys (${d.notebooks} so far, ${d.spawned7d} this week). Its stacks smoke on a day one was made, and each new one is a crate in the yard, going out by train.` },
  { kind: "landmark", id: "nns", zoom: 1.7, title: "The ICP quarter", text: () => "The network Agent Space lives on has its own district: the NNS, the Internet Computer's governance, where ICP holders vote on every change to the protocol; the news station for DFINITY, the foundation behind it; a statue of its founder; the financial district with the OISY wallet and the ICPSwap exchange, where Agent Space's payments happen; and embassies for countries and programmes building on ICP. Click any of them to visit." },
  { kind: "station", zoom: 1.8, title: "The station", text: (d) => `Visitors wait here: people who signed in with Internet Identity, the Internet Computer's passwordless login, but have no space yet (${d.campers} now). Make a space and your home goes up in town. Everyone online walks in from here.` },
  { kind: "landmark", id: "soon", zoom: 1.6, title: "The spaceport", text: () => "Out on the coast, well away from the homes: a launchpad for what is next on the Internet Computer. A rocket goes up every couple of minutes. That is the tour: drag to look around, scroll to zoom, hover anything for what it is, and sign in with Internet Identity to get a home of your own." },
];
async function tourStep(to: number) {
  const t = S.town;
  if (!t?.data) return;
  if (to < 0 || to >= TOUR.length) { t.tour = undefined; townSpotlight(true); store("nb-town-toured", "1"); render(); townCamera("home"); return; }
  t.tour = to;
  render();
  const step = TOUR[to];
  if (!townFly(step.kind, step.id, step.zoom)) return tourStep(to + 1);
}
function townPage(): string {
  const t = S.town!, d = t.data;
  if (!d) return pageShell("<b>Town</b>", `<div class="town"><p class="muted town-wait">Walking into town…</p></div>`, true);
  const n = townCounts(d), off = new Set(d.off);
  const legendLines = `    <span><i class="lg lg-house"></i>A home: someone with a space edited in the last 30 days. Bigger homes hold more notes; each storey is a space.</span>
    <span><i class="lg lg-house"></i>The town draws at most ${d.maxShown} homes${d.homes > d.houses.length ? ` (${d.houses.length} of ${d.homes} now)` : ""}: when there are more, a mix of every kind, spread across town. Yours is always one of them.</span>
    <span><i class="lg lg-lit"></i>Lit windows (at night, in the dark theme): edited this week. Chimney smoke: edited today.</span>
    <span><i class="lg lg-person"></i>A person: someone in the community chat right now, at their channel's stall in the Square.</span>
    <span><i class="lg lg-person"></i>The station and the campground: visitors who signed in this month but have no space yet wait on the platform or camp in a tent; the train comes and goes.</span>
    <span><i class="lg lg-house"></i>An open house: a sign on the porch, put up by the owner, with a line about their work and maybe a note. Click to read it or wave.</span>
    <span><i class="lg lg-house"></i>Agent couriers: a small bot runs between the Agent Space and a home an agent wrote to this week.</span>
    <span><i class="lg lg-house"></i>Flower beds, ivy, flags, statues and lanterns on homes are quests done by writing (Manage › Space › Quests); nothing on a home is for sale. The Sponsors' buildings are projects that pay to keep Agent Space running.</span>
    <span><i class="lg lg-build"></i>Scaffolding and a crane: a space made in the last three days. A red lamp by the door: a space with under 30 days of cycles left.</span>
    <span><i class="lg lg-water"></i>The water tower: the cycles every space holds, its level how many days they last at today's burn; the drip is the burn.</span>
    <span><i class="lg lg-civic"></i>The space works makes every space (smoke when it has today); the school's yard holds this week's newcomers; the chapel's bell rings while a fundraiser is open. Then the Agent Space itself, the Square, the board's pavilion${off.has("market") ? "" : ", the market hall"}, the park and the trailhead.</span>
    <span class="small muted">Every lit window is someone writing in their own space. Nobody can see inside.</span>`;
  const step = t.tour !== undefined ? TOUR[t.tour] : undefined;
  const tourBody = step ? `<div class="row tight"><b>${esc(step.title)}</b><span class="small muted">${t.tour! + 1} of ${TOUR.length}</span></div><p>${esc(step.text(d))}</p>
    <div class="row tight"><button type="button" class="btn btn-ghost" data-action="town-tour-end">Skip</button><span class="grow"></span><button type="button" class="btn" data-action="town-tour-back" ${t.tour === 0 ? "disabled" : ""}>Back</button><button type="button" class="btn btn-primary" data-action="town-tour-next">${t.tour === TOUR.length - 1 ? "Done" : "Next"}</button></div>` : "";
  let legend = "", tour = "", dock = "";
  if (S.mobile) {
    // a phone: one bar of four big buttons, and one sheet at a time above it (a tap on the town closes it)
    const sheet = (title: string, body: string, cls = "") => `<div class="town-sheet glass ${cls}" role="dialog" aria-label="${esc(title)}"><div class="sheet-head"><b>${esc(title)}</b><button type="button" class="btn btn-ghost icon-btn" data-action="town-sheet" data-sheet="" aria-label="Close">${icon("x")}</button></div><div class="sheet-body">${body}</div></div>`;
    if (step) tour = sheet("A tour of the town", tourBody, "tour");
    else if (t.legend) legend = sheet("Reading the town", `<div class="town-legend-body">${legendLines}</div>`);
    else if (t.sheet === "stats") legend = sheet("Agent Space right now", `<div class="sheet-stats">${townHud(d)}</div>`);
    const db = (action: string, ic: string, label: string, on = false, extra = "") => `<button type="button" class="dbtn ${on ? "on" : ""}" data-action="${action}" ${extra} aria-pressed="${on}">${icon(ic)}<span>${label}</span></button>`;
    dock = `<div class="town-dock glass mobile" role="toolbar" aria-label="Town view">${db("town-sheet", "chart", "Stats", t.sheet === "stats", 'data-sheet="stats"')}${db("town-tour", "compass", "Tour", !!step)}${db("town-legend", "help", "Legend", t.legend)}${db("town-more", "more", "More")}</div>`;
  } else {
    legend = t.legend ? `<div class="town-legend glass" role="note"><b>Reading the town</b>${legendLines}</div>` : "";
    tour = step ? `<div class="town-tour glass" role="dialog" aria-label="Tour of the town">${tourBody}</div>` : "";
    dock = `<div class="town-dock glass"><div class="dock-stats">${townHud(d)}</div><div class="dock-tools" role="toolbar" aria-label="Town view">
    <button type="button" class="btn btn-ghost icon-btn" data-action="town-out" title="Zoom out (−)" aria-label="Zoom out">−</button>
    <button type="button" class="btn btn-ghost icon-btn" data-action="town-in" title="Zoom in (+)" aria-label="Zoom in">+</button>
    <button type="button" class="btn btn-ghost icon-btn" data-action="town-home" title="Whole town (0)" aria-label="Whole town">${icon("fit")}</button>
    ${d.mine !== undefined ? `<button type="button" class="btn btn-ghost icon-btn" data-action="town-mine" title="My home" aria-label="My home">${icon("house")}</button><button type="button" class="btn btn-ghost" data-action="town-porch" title="Pin a status or public note on your front porch">${icon("pin")}<span class="lbl">Open House</span></button>` : ""}
    <button type="button" class="btn btn-ghost" data-action="town-quests" title="Town-wide community milestones and your home quests">${icon("award")}<span class="lbl">Quests &amp; Milestones</span></button>
    <button type="button" class="btn btn-ghost ${step ? "on" : ""}" data-action="town-tour" title="A tour of the town" aria-label="Tour">${icon("compass")}<span class="lbl">Tour</span></button>
    <button type="button" class="btn btn-ghost ${t.legend ? "on" : ""}" data-action="town-legend" aria-pressed="${t.legend}" title="Legend" aria-label="Legend">${icon("help")}<span class="lbl">Legend</span></button>
    ${!off.has("sponsors") && S.identity ? `<button type="button" class="btn btn-ghost icon-btn" data-action="town-sponsor" title="Pay for a building in the Sponsors district" aria-label="Sponsor a building">${icon("coin")}</button>` : ""}
    <button type="button" class="btn btn-ghost icon-btn" data-action="theme-menu" title="Day or night: the appearance" aria-label="Appearance">${icon(S.theme.mode === "dark" ? "moon" : "sun")}</button></div></div>`;
  }
  const label = `Agent Space as a town: ${d.homes} homes, ${n.today} lit today, ${n.online} people online, ${n.talk} messages today.`;
  return pageShell("<b>Town</b>", `<div class="town">
    <canvas data-town="full" tabindex="0" role="img" aria-label="${esc(label)}"></canvas><div class="town-tip" hidden></div>
    ${legend}${tour}${dock}
    ${d.at ? "" : `<div class="town-wake glass small">The town is waking up: counting homes…</div>`}
  </div>`, true);
}
const NOTES_BUCKET = ["under 10 notes", "10–49 notes", "50–199 notes", "200+ notes"];
const LIT_TEXT = ["edited this month", "edited this week", "edited today"];
function townTip(tg: TownTarget): string {
  const d = (S.town?.data ?? S.landingTown)!, line = (s: string) => `<span>${s}</span>`, hint = (s: string) => `<span class="hint">${s}</span>`;
  const preview = !S.town;
  const go = (s: string) => (preview ? hint("Click to see the town") : hint(s));
  switch (tg.kind) {
    case "house": {
      const h = tg.house, nbs = `${h.storeys >= 3 ? "3 or more spaces" : `${h.storeys} space${h.storeys === 1 ? "" : "s"}`} · ${NOTES_BUCKET[h.size]}`;
      const earned = QUEST_ROWS(0, 0, 0).filter((_, i) => (h.badges ?? 0) & (1 << i)).map((q) => q[0]);
      const oh = tg.openHouse;
      const ohLine = oh ? `${line(`🪧 <b>@${esc(oh.handle)}</b>: “${esc(oh.title)}” · 👋 ${oh.waves}`)}${oh.blurb ? line(esc(oh.blurb)) : ""}${oh.link ? line("📌 A note is pinned to the door") : ""}` : "";
      if (tg.mine) return `<b>${tg.building ? "Your home, going up" : "Your home"}</b>${ohLine}${(S.notebooks ?? []).slice(0, 4).map((n) => line(`${esc(n.emoji ?? "📓")} ${esc(n.name)}`)).join("")}${earned.length ? line(`Quests done: ${earned.join(", ")}`) : line("No quests done yet: write, link, keep a streak")}${line(`${NOTES_BUCKET[h.size]} · ${LIT_TEXT[h.lit]}`)}${h.low ? line("A space has under 30 days of cycles left: top it up in Manage") : ""}${go("Click to open your spaces")}`;
      if (tg.model) return `<b>The model home</b>${line("What a space becomes here: two storeys for two spaces, lit windows for writing this week, smoke for today, and every quest done.")}${go("Take the tour for the rest")}`;
      if (tg.building) return `<b>A home going up</b>${line(h.storeys > 1 ? "Another space: a new storey" : "A space made in the last three days")}`;
      return `<b>${oh ? `@${esc(oh.handle)}'s Open House` : "A home"}</b>${ohLine}${line(nbs)}${line(LIT_TEXT[h.lit])}${h.low ? line("Running low on cycles") : ""}${oh ? go(oh.link ? "Click to read the pinned note or wave 👋" : "Click to wave 👋") : ""}`;
    }
    case "plot": return `<b>Your plot</b>${line("Your spaces have been quiet for a month.")}${line("Write in one to light your home.")}`;
    case "hall": return `<b>The Agent Space</b>${line("The laboratory at the heart of town, where the count is kept")}${line(`Agent Space · pop. ${d.people}`)}${line(`${d.homes} home${d.homes === 1 ? "" : "s"} lit this month · ${d.quiet} quiet plot${d.quiet === 1 ? "" : "s"}`)}${d.homes > d.houses.length ? line(`${d.houses.length} drawn: at most ${d.maxShown}, a mix of every kind, always yours`) : ""}`;
    case "stall": { const c = tg.channel; return `<b>#${esc(c.name)}</b>${line(`${c.online} here now · ${c.messages24h} message${c.messages24h === 1 ? "" : "s"} today`)}${go(S.identity ? "Click to open the channel" : "Sign in to join in")}`; }
    case "fountain": return `<b>The fountain</b>${line(d.off.includes("rain") ? "Rain is switched off: the fountain is frozen." : d.rains24h ? `${d.rains24h} rain${d.rains24h === 1 ? "" : "s"} today: the jets are running` : "No rain today. When someone makes it rain in chat, the jets run.")}`;
    case "board": return d.off.includes("board") ? `<b>The pavilion</b>${line("The board is closed.")}` : `<b>The board's pavilion</b>${line(`${d.postsLive} post${d.postsLive === 1 ? "" : "s"} pinned · ${d.posts24h} new today`)}${go(S.identity ? "Click to open the board" : "Sign in to read the board")}`;
    case "market": return `<b>The market hall</b>${line(`${d.listings} space${d.listings === 1 ? "" : "s"} for sale`)}${go(S.identity ? "Click to open the market" : "Sign in to browse")}`;
    case "factory": return `<b>The space works</b>${line(`Where every space is made: ${d.notebooks} so far`)}${line(`${d.spawned7d} this week · ${d.spawned24h} today`)}${go(S.identity ? "Click to make a space" : "Sign in to make one")}`;
    case "school": return `<b>The school</b>${line(d.newcomers7d ? `${d.newcomers7d} newcomer${d.newcomers7d === 1 ? "" : "s"} joined the community this week` : "No newcomers this week yet")}${go(S.identity ? "Click to say hello in #help" : "Sign in to join")}`;
    case "chapel": return d.off.includes("fundraisers") ? `<b>The chapel</b>${line("Fundraisers are switched off: the bell is still.")}` : `<b>The chapel</b>${line(d.fundraisersOpen ? `${d.fundraisersOpen} fundraiser${d.fundraisersOpen === 1 ? "" : "s"} open: the bell is ringing` : "No fundraiser open")}${line(`${icp(BigInt(d.raisedE8s))} ICP given to keep spaces running`)}`;
    case "tower": { const n = townCounts(d); return `<b>The water tower</b>${line(`${cyclesText(d.cycles)} of cycles held by ${d.notebooks} space${d.notebooks === 1 ? "" : "s"}`)}${line(`${cyclesText(d.burnPerDay)} burned a day${n.days !== undefined ? `: about ${n.days} days at this rate` : ""}`)}${line("Each space pays its own way; top yours up in Manage")}`; }
    case "station": return `<b>The station</b>${line(d.campers ? `${d.campers} visitor${d.campers === 1 ? "" : "s"} on the platform: signed in this month, no space yet` : "The platform is empty: everyone who signed in has a space")}${line("The people online in chat walk into town from here.")}`;
    case "visitor": return tg.mine ? `<b>You, on the platform</b>${line("You signed in but have no space yet. Make one and your home goes up in town.")}${go("Click to make a space")}` : `<b>A visitor</b>${line("Someone who signed in and hasn't made a space yet")}`;
    case "tent": return `<b>The campground</b>${line(`${tg.campers} newcomer${tg.campers === 1 ? "" : "s"} trying Agent Space before putting up a home`)}${tg.mine ? line("One of the tents is yours: mint your sandbox to a canister and a house goes up") : ""}${go("Click to try the browser sandbox")}`;
    case "courier": return `<b>An agent courier</b>${line(`Running between the Agent Space and the home on lot ${tg.lot}: an agent writing under Agents/ or checking a claim`)}${go("Click to see the track records")}`;
    case "lake": return `<b>The lake</b>${line("The river runs from it off the edge of the island.")}`;
    case "landmark": { const l = tg.landmark; let host = l.url; try { host = new URL(l.url).host; } catch { /* shown as is */ } return `<b>${esc(l.title)}</b>${l.sponsored ? line("A sponsored building: this project pays to keep Agent Space running.") : ""}${line(esc(l.blurb))}${go(`Click to open ${esc(host)}`)}`; }
    case "district": { const dd = tg.district; return `<b>${esc(dd.name)}</b>${line(esc(dd.blurb))}${line(`${dd.landmarks.length} landmarks, room for more`)}`; }
    case "park": return `<b>The park</b>${line("A bench by the pond.")}`;
    case "obelisk": return tg.more ? `<b>The avenue of discoveries</b>${line(`${tg.n} problems solved together so far`)}${go("Click to read the ledger")}` : `<b>Discovery №${tg.n}</b>${line("A problem solved together: its claims checked, its attempts merged, everyone credited for good.")}${go("Click to read the ledger")}`;
    case "trail": return `<b>The trailhead</b>${line(d.hikers ? `${d.hikers} out on a trip right now, on time` : "Nobody out on a trip right now")}${line("Trips with a check-in contact, from the Trips kit")}`;
    case "walker": return `<b>${tg.me ? "You" : "Someone"}</b>${line(`in #${esc(tg.channel)}`)}`;
  }
}
function townOpen(tg: TownTarget) {
  if (!S.town) { location.hash = "#/town"; return; }
  const signin = () => toast("Sign in to join in.", "info");
  switch (tg.kind) {
    case "house": {
      if (tg.model) return void tourStep(1);
      if (tg.mine) { const nbs = S.notebooks ?? []; location.hash = nbs.length === 1 ? `#/notebook/${nbs[0].canister.toText()}` : "#/"; return; }
      const oh = tg.openHouse;
      if (oh) {
        void (async () => {
          const scrim = document.createElement("div");
          scrim.className = "scrim";
          scrim.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
            <h2>🪧 @${esc(oh.handle)}'s front porch</h2>
            <p><b>${esc(oh.title)}</b></p>
            ${oh.blurb ? `<p>${esc(oh.blurb)}</p>` : ""}
            <p class="small muted">👋 ${oh.waves} wave${oh.waves === 1 ? "" : "s"} from neighbours</p>
            <div class="actions">
              <button type="button" class="btn" data-x="cancel">Close</button>
              <button type="button" class="btn" data-x="wave">👋 Wave hello</button>
              ${oh.link ? `<button type="button" class="btn btn-primary" data-x="read">${icon("file")}Read the pinned note</button>` : ""}
            </div>
          </div>`;
          const close = () => scrim.remove();
          scrim.addEventListener("click", (e) => e.target === scrim && close());
          scrim.querySelector("[data-x=cancel]")!.addEventListener("click", close);
          scrim.querySelector("[data-x=wave]")!.addEventListener("click", async () => {
            if (!S.identity) { close(); return signin(); }
            const r = await registry().wave_house(oh.lot);
            if (r.__kind__ === "Err") toast(r.Err, "error");
            else { oh.waves = r.Ok; toast(`You waved to @${oh.handle}! 👋 (${r.Ok})`, "ok"); close(); render(); }
          });
          scrim.querySelector("[data-x=read]")?.addEventListener("click", () => {
            close();
            // a note shared from a notebook opens here; a published page or another site opens in a new tab
            if (oh.link!.startsWith("#/")) location.hash = oh.link!; else window.open(oh.link!, "_blank", "noopener,noreferrer");
          });
          document.body.append(scrim);
        })();
      }
      return;
    }
    case "tent": void openNotebook(SANDBOX_ID); return;
    case "courier": location.hash = "#/agents"; return;
    case "plot": location.hash = "#/"; return;
    case "stall": case "walker": { if (!S.identity) return signin(); store("nb-chat-channel", tg.kind === "stall" ? tg.channel.name : tg.channel); location.hash = "#/community"; return; }
    case "board": if (!S.town.data?.off.includes("board")) { if (S.identity) location.hash = "#/board"; else signin(); } return;
    case "market": if (S.identity) location.hash = "#/market"; else signin(); return;
    case "factory": location.hash = "#/"; return;
    case "obelisk": location.hash = "#/discoveries"; return;
    case "visitor": if (tg.mine) location.hash = "#/"; return;
    // another app: a new tab, never handing it this page
    case "landmark": window.open(tg.landmark.url, "_blank", "noopener,noreferrer"); return;
    case "school": { if (!S.identity) return signin(); store("nb-chat-channel", "help"); location.hash = "#/community"; return; }
  }
}
/** Propose a building in the Sponsors district, or pay for one an admin approved. */
async function sponsorDialog() {
  if (!S.identity) return toast("Sign in to sponsor a building.", "info");
  const [mine, price] = await Promise.all([registry().my_sponsors(), registry().sponsor_price()]);
  const now = Date.now(), live = (x: SponsorView) => Number(x.paid_until / 1_000_000n) > now;
  const choices = [...mine.map((x) => ({ value: String(x.id), label: `${x.name} · ${live(x) ? `live until ${new Date(Number(x.paid_until / 1_000_000n)).toLocaleDateString()}` : x.approved ? "approved: pay to put it up" : "waiting for an admin"}` })), { value: "new", label: "Propose a new building…" }];
  const pick = mine.length ? await ask({ title: "Sponsor a building", body: `A building in the Sponsors district with your name, your colour and a link, for ${icp(price)} ICP a month. An admin approves it first; the ICP keeps Agent Space running.`, label: "Which", choices, value: choices[0].value, ok: "Next" }) : "new";
  if (pick === null) return;
  if (pick === "new") {
    const v = await fieldsDialog("Propose a building", `${icp(price)} ICP a month once an admin approves it. Keep it honest: the town links to your site.`, [
      { name: "name", label: "Project name", placeholder: "My DAO", required: true },
      { name: "blurb", label: "One line about it", placeholder: "What it does on the Internet Computer", kind: "area", wide: true },
      { name: "url", label: "Link (https)", placeholder: "https://", required: true },
      { name: "color", label: "Colour (hex)", value: "#29abe2" },
    ], "Propose");
    if (!v) return;
    const r = await registry().sponsor({ name: v.name, blurb: v.blurb ?? "", url: v.url, color: v.color || "#29abe2" }).catch((e) => ({ __kind__: "Err", Err: errMsg(e) }) as const);
    if (r.__kind__ === "Err") return toast(r.Err, "error");
    return toast("Proposed. An admin will look at it; come back here to pay once it is approved.", "ok");
  }
  const x = mine.find((y) => String(y.id) === pick);
  if (!x) return;
  if (!x.approved) return toast("Still waiting for an admin to approve it.", "info");
  const m = await ask({ title: live(x) ? `Extend “${x.name}”` : `Put up “${x.name}”`, body: `${icp(price)} ICP a month, paid from your wallet.`, label: "Months", choices: [1, 3, 6, 12].map((n) => ({ value: String(n), label: `${n} month${n === 1 ? "" : "s"} · ${icp(price * BigInt(n))} ICP` })), value: "1", ok: "Pay" });
  if (m === null) return;
  try {
    await approvePayment(Principal.fromText(REGISTRY), price * BigInt(m) + ICP_FEE);
    const r = await registry().pay_sponsor(x.id, Number(m));
    if (r.__kind__ === "Err") throw new Error(r.Err);
    toast(`Paid. “${x.name}” stands in the town until ${new Date(Number(r.Ok.paid_until / 1_000_000n)).toLocaleDateString()}.`, "ok");
    if (S.town) void loadTown();
  } catch (e) { toast(errMsg(e), "error"); }
}
/** Put the town on its canvas after every render (the landing preview or the town page). */
function townSync() {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-town]");
  if (!canvas) { if (!S.identity && !S.town && !S.shared) loadLandingTown(); return; }
  const data = canvas.dataset.town === "full" ? S.town?.data : S.landingTown;
  if (!data) return;
  attachTown(canvas, { data, mode: canvas.dataset.town === "full" ? "full" : "preview", dark: S.theme.mode === "dark", accent: getComputedStyle(document.body).getPropertyValue("--accent").trim(), onOpen: townOpen, tip: townTip });
}
async function townPorchDialog() {
  const d = S.town?.data;
  if (!S.identity || d?.mine === undefined) return toast("Create a space first to get a home with a front porch.", "info");
  const cur = d.openHouses?.find((o) => o.lot === d.mine);
  const nbs = S.notebooks ?? [];
  const curLink = cur?.link?.match(/^#\/shared\/([a-z0-9-]+)\/(.*)$/);
  const v = await fieldsDialog("Open house", "A sign on your front porch in the town: a line about what you are working on, and, if you like, a note you have shared publicly. Neighbours click your house to read it or wave.", [
    { name: "title", label: "The sign (empty takes it down)", value: cur?.title ?? "", placeholder: "Working on Lean proofs and crypto theses; say hi", wide: true },
    { name: "blurb", label: "A line more (optional)", value: cur?.blurb ?? "", kind: "area" },
    ...(nbs.length ? [{ name: "notebook", label: "Pin a note from", kind: "choice" as const, value: curLink?.[1] ?? "", choices: [{ value: "", label: "No note" }, ...nbs.map((n) => ({ value: n.canister.toText(), label: n.name }))] }] : []),
    { name: "path", label: "Its path (shared publicly first)", value: curLink ? decodeURIComponent(curLink[2]) : "", placeholder: "index.md", wide: true },
  ], "Put it up");
  if (!v) return;
  const link = v.notebook && v.path ? `#/shared/${v.notebook}/${encodeURIComponent(v.path)}` : null;
  const r = await registry().set_open_house(v.title ?? "", v.blurb ?? "", link);
  if (r.__kind__ === "Err") return toast(r.Err, "error");
  toast(r.Ok ? "Your sign is up on the porch." : "Sign taken down.", "ok");
  void loadTown();
}
function townQuestsDialog() {
  const d = S.town?.data;
  if (!d) return;
  const [notes, links, streakDays] = d.myQuests ?? [0, 0, 0];
  const rows = QUEST_ROWS(notes, links, streakDays);
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.innerHTML = `<div class="modal wide" role="dialog" aria-modal="true">
    <h2>${icon("award")} Town Quests &amp; Community Milestones</h2>
    <div class="band">
      <div class="band-title">Community Milestones</div>
      <div class="runs">
        <div class="run"><span>🏛️ <b>Town Growth</b> · ${d.homes} / 25 active homes</span><span class="pill ${d.homes >= 25 ? "ok" : ""}">${Math.min(100, Math.round((d.homes / 25) * 100))}%</span></div>
        <div class="run"><span>🗿 <b>Avenue of Discoveries</b> · ${d.discoveries ?? 0} solved problem obelisks on the green</span><span class="pill ${(d.discoveries ?? 0) > 0 ? "ok" : ""}">${d.discoveries ?? 0} solved</span></div>
        <div class="run"><span>⛺ <b>Station Newcomers</b> · ${d.campers} visitor${d.campers === 1 ? "" : "s"} waiting for a home</span><a href="#/community" class="btn btn-ghost" data-x="sponsor">Sponsor in #help</a></div>
        <div class="run"><span>🪧 <b>Open Houses</b> · ${(d.openHouses ?? []).length} neighbour${(d.openHouses ?? []).length === 1 ? "" : "s"} with a front-porch pin</span><span class="pill ok">${(d.openHouses ?? []).length} open</span></div>
      </div>
    </div>
    <div class="band">
      <div class="band-title">Your Home's Quests (earned by writing, never for sale)</div>
      <div class="runs">${rows.map(([name, have, need, gift]) => `<div class="run"><span><b>${esc(name)}</b> · <span class="muted">${esc(gift)}</span></span><span class="pill ${have >= need ? "ok" : ""}">${have >= need ? "✓ earned" : `${have} / ${need}`}</span></div>`).join("")}</div>
    </div>
    <div class="actions"><button type="button" class="btn btn-primary" data-x="cancel">Done</button></div>
  </div>`;
  const close = () => scrim.remove();
  scrim.addEventListener("click", (e) => e.target === scrim && close());
  scrim.querySelector("[data-x=cancel]")!.addEventListener("click", close);
  scrim.querySelector("[data-x=sponsor]")?.addEventListener("click", () => { store("nb-chat-channel", "help"); close(); });
  document.body.append(scrim);
}
function townAction(action: string) {
  const t = S.town;
  if (!t) return;
  if (action === "town-in") townCamera("in");
  else if (action === "town-out") townCamera("out");
  else if (action === "town-home") townCamera("home");
  else if (action === "town-mine") townCamera("mine");
  else if (action === "town-porch") void townPorchDialog();
  else if (action === "town-quests") townQuestsDialog();
  else if (action === "town-sheet") { const which = (document.activeElement as HTMLElement | null)?.dataset.sheet; if (!which && t.tour !== undefined) { void tourStep(-1); return; } t.sheet = which === "stats" && t.sheet !== "stats" ? "stats" : undefined; t.legend = false; if (t.sheet && t.tour !== undefined) { t.tour = undefined; townSpotlight(true); } render(); }
  else if (action === "town-legend") { t.legend = !t.legend; t.sheet = undefined; if (S.mobile && t.legend && t.tour !== undefined) { t.tour = undefined; townSpotlight(true); } render(); }
  else if (action === "town-tour") { t.sheet = undefined; t.legend = false; if (t.tour !== undefined) void tourStep(-1); else void tourStep(0); }
  else if (action === "town-more") {
    const el = document.activeElement as HTMLElement | null, r = el?.getBoundingClientRect();
    const d = t.data;
    contextMenu(Math.max(8, (r?.right ?? innerWidth) - 240), (r?.top ?? innerHeight) - 8, "Town", [
      { label: "Zoom in", icon: "plus", action: () => townCamera("in") },
      { label: "Zoom out", icon: "minus", action: () => townCamera("out") },
      { label: "Whole town", icon: "fit", action: () => townCamera("home") },
      ...(d?.mine !== undefined ? [{ label: "My home", icon: "house", action: () => townCamera("mine") } as MenuItem, { label: "Open house: a sign on your porch", icon: "pin", action: () => void townPorchDialog() } as MenuItem] : []),
      { label: "Quests and milestones", icon: "award", action: () => townQuestsDialog() },
      ...(d && !d.off.includes("sponsors") && S.identity ? [{ label: "Sponsor a building", icon: "coin", action: () => void sponsorDialog() } as MenuItem] : []),
      "-",
      { label: "Appearance: day or night", icon: S.theme.mode === "dark" ? "moon" : "sun", action: () => void onAction("theme-menu", el ?? document.body) },
    ]);
  }
  else if (action === "town-tour-next") void tourStep((t.tour ?? -1) + 1);
  else if (action === "town-tour-back") void tourStep((t.tour ?? 1) - 1);
  else if (action === "town-tour-end") void tourStep(-1);
  else if (action === "town-sponsor") void sponsorDialog();
}
/** Admin: the numbers. */
function adminStatsHtml(): string {
  const st = S.admin!.stats;
  const n = (x: bigint) => Number(x).toLocaleString("en-US");
  const stat = (v: string, label: string) => `<div><b>${v}</b><span>${label}</span></div>`;
  return `<section class="card"><div class="row"><h2>${icon("graph")} The app</h2><span class="right-actions"><button type="button" class="btn btn-ghost" data-action="admin-stats">${icon("refresh")}Count again</button></span></div>
      ${st ? `<div class="career-stats">${stat(n(st.users), "people")}${stat(n(st.active_users), "active people")}${stat(n(st.notebooks), "notebooks")}${stat(n(st.active_notebooks), "active spaces")}${stat(n(st.notes), "notes")}${stat(n(st.files), "files")}${stat(tc(st.ai_fees_cycles), "earned from model answers")}${stat(n(st.members), "community members")}</div>
        <p class="small muted">Active means a space changed or a chat message in the last 30 days. Counted ${ago(st.at)}${st.unreachable > 0n ? `; ${n(st.unreachable)} space${st.unreachable === 1n ? "" : "s"} did not answer (frozen or out of cycles)` : ""}.</p>` : `<p class="muted">Counting every space…</p>`}
    </section>`;
}
async function adminStatsAction() {
  if (!S.admin) return;
  S.admin.stats = undefined;
  render();
  const r = await registry().app_stats(true).catch((e) => ({ __kind__: "Err", Err: errMsg(e) }) as const);
  if (r.__kind__ === "Ok") S.admin.stats = r.Ok; else toast(r.Err, "error");
  render();
}

// --- the Writing kit

function writingTab(): string {
  const notes = orgNotes();
  const ms = manuscript(notes);
  const total = ms.reduce((t, c) => t + c.words, 0);
  const id = S.notebook!.canister.toText();
  const day = new Date().toISOString().slice(0, 10);
  const startKey = `nb-words-${id}-${day}`;
  if (store(startKey) === null) store(startKey, String(total));
  const today = Math.max(0, total - Number(store(startKey)));
  const goal = S.settings.writingGoal;
  const bible = notes.filter((n) => /^(character|place|object)$/.test(frontmatter(n.content).data.type ?? ""));
  const scenes = notes.filter((n) => (frontmatter(n.content).data.type ?? "") === "scene");
  const issues = continuity(bible, scenes);
  const events = timeline(notes);
  const scenePaths = new Set(scenes.map((s) => s.path));
  const beta = S.comments.filter((c) => scenePaths.has(c.path));
  return `<section class="main" style="overflow:auto"><div class="page wide kit">
    <div class="card band"><div class="row"><h2>${icon("edit")} Manuscript</h2><span class="small muted">${total.toLocaleString()} words · ${scenes.length} scene${scenes.length === 1 ? "" : "s"}</span><span class="right-actions"><button type="button" class="btn btn-primary" data-action="scene-new">${icon("plus")}New scene</button></span></div>
      <div class="goal"><span>Today <b>${today.toLocaleString()}</b> of <input class="input" type="number" min="0" step="50" name="writinggoal" value="${goal}" aria-label="Daily word goal"> words</span><span class="meter"><i style="width:${goal ? Math.min(100, (today / goal) * 100) : 0}%"></i></span></div>
      ${ms.length ? ms.map((c) => `<div class="chapter" data-chapter="${esc(c.chapter)}"><div class="band-title">${esc(c.chapter)} <span class="small faint">${c.words.toLocaleString()} words</span></div>${c.scenes.map((s) => `<div class="scene-row" draggable="true" data-scene="${esc(s.path)}" data-chapter="${esc(c.chapter)}"><span class="grip" aria-hidden="true">⋮⋮</span><a href="#" data-action="open" data-path="${esc(s.path)}">${esc(s.title)}</a><span class="small faint">${s.pov ? `${esc(s.pov)} · ` : ""}${s.date ? `${esc(s.date)} · ` : ""}${s.words.toLocaleString()} words</span></div>`).join("")}</div>`).join("") : `<p class="muted small">Scenes are notes with <code>type: scene</code>, a <code>chapter:</code> and an <code>order:</code>. Drag them to reorder.</p>`}
    </div>
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("person")} Story bible</h2><span class="right-actions"><button type="button" class="btn btn-ghost" data-action="bible-new" data-kind="character">+ Character</button><button type="button" class="btn btn-ghost" data-action="bible-new" data-kind="place">+ Place</button><button type="button" class="btn btn-ghost" data-action="bible-new" data-kind="object">+ Object</button></span></div>
        ${bible.length ? `<div class="runs">${bible.map((b) => { const d = frontmatter(b.content).data; return `<div class="run"><span><a href="#" data-action="open" data-path="${esc(b.path)}">${esc(base(b.path))}</a> <span class="small faint">${esc(d.type ?? "")}</span></span><span class="small muted">${Object.entries(d).filter(([k, v]) => k !== "type" && v).slice(0, 4).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ")}</span></div>`; }).join("")}</div>` : `<p class="muted small">Characters, places and objects with their facts (eyes, hair, age, born, …).</p>`}
        <div class="band-title">Continuity <span class="count">${issues.length}</span></div>
        ${issues.length ? `<div class="runs">${issues.map((i) => `<div class="run"><span><b>${esc(i.entity)}</b>: ${esc(i.property)} is <b>${esc(i.expected)}</b> in the bible, <b>${esc(i.found)}</b> in <a href="#" data-action="open" data-path="${esc(i.scene)}">${esc(base(i.scene))}</a><div class="small faint">“${esc(i.excerpt)}”</div></span></div>`).join("")}</div>` : `<p class="small muted">No contradictions found between the bible and the scenes.</p>`}</div>
      <div class="card band"><div class="row"><h2>${icon("calendar")} Timeline</h2></div><p class="small muted">From scene <code>date:</code> and lines with <code>date::</code>. Any calendar works; dates sort by the numbers in them.</p>
        ${events.length ? `<div class="timeline">${events.map((e) => `<div class="tl-row" data-action="open" data-path="${esc(e.path)}"><span class="tl-time">${esc(e.date)}</span><span class="tl-text">${esc(e.text)}</span><span class="small faint">${esc(base(e.path))}</span></div>`).join("")}</div>` : `<p class="muted small">No dated events yet.</p>`}
        <div class="band-title">Beta readers <span class="count">${beta.length}</span></div>
        <div class="row tight"><button type="button" class="btn" data-action="beta-share">${icon("share")}Share the manuscript for comments</button></div>
        ${beta.length ? [...new Set(beta.map((c) => c.path))].map((p) => `<div class="band-title small"><a href="#" data-action="open" data-path="${esc(p)}">${esc(base(p))}</a></div>${beta.filter((c) => c.path === p).map((c) => `<div class="beta-note"><span class="small faint">${esc(shortPrincipal(c.author.toText()))} · ${ago(c.at)}</span> ${esc(c.text)}</div>`).join("")}`).join("") : `<p class="small muted">Comments readers leave on scenes collect here.</p>`}</div>
    </div>
  </div></section>`;
}
/** Drop a scene before another: renumber every scene in reading order and move it into that chapter. */
async function reorderScene(from: string, before: string | undefined, chapter: string) {
  const all = manuscript(orgNotes()).flatMap((c) => c.scenes.map((s) => s.path)).filter((p) => p !== from);
  const at = before ? all.indexOf(before) : all.length;
  all.splice(at < 0 ? all.length : at, 0, from);
  for (const [i, p] of all.entries()) {
    const text = S.drafts.get(p)?.text ?? note(p)!.content;
    let next = setProperty(text, "order", String(i + 1));
    if (p === from) next = setProperty(next, "chapter", chapter);
    if (next !== text) await writeNote(p, next);
  }
  render();
}

// --- the Care kit (personal notes; not medical records or advice)

const careLog = () => orgNotes().find((n) => n.path === "Care/Log.sheet");
async function careAdd(kind: "dose" | "symptom") {
  if (!careLog()) await createQuiet("Care/Log.sheet", careWorkbook());
  const name = await ask({ title: kind === "dose" ? "Log a dose" : "Log a symptom", label: kind === "dose" ? "Medicine" : "Symptom", value: store(`nb-care-last-${kind}`) ?? "", ok: "Next" });
  if (!name?.trim()) return;
  store(`nb-care-last-${kind}`, name.trim());
  const extra = await ask({ title: name.trim(), label: kind === "dose" ? "Dose" : "Severity (0-10)", value: kind === "dose" ? "" : "3", ok: "Next" });
  if (extra === null) return;
  const notesTxt = await ask({ title: name.trim(), label: "Notes (optional)", value: "", ok: "Log it" });
  if (notesTxt === null) return;
  const now = new Date();
  const wb = parseWorkbook(S.drafts.get("Care/Log.sheet")?.text ?? note("Care/Log.sheet")!.content);
  const log = wb.sheets.find((s) => s.name === "Log")!;
  log.rows.push([localStamp(now).slice(0, 10), localStamp(now).slice(11), kind, name.trim(), kind === "dose" ? extra.trim() : "", kind === "symptom" ? String(Math.max(0, Math.min(10, Number(extra) || 0))) : "", notesTxt.trim()]);
  await writeNote("Care/Log.sheet", serializeWorkbook(wb));
  toast(`Logged ${name.trim()} at ${localStamp(now).slice(11)}.`, "ok");
  render();
}
function careTab(): string {
  const notes = orgNotes();
  const log = careLog();
  const rows = log ? evaluate(parseWorkbook(log.content)).get("Log") ?? [] : [];
  const appts = notes.filter((n) => (frontmatter(n.content).data.type ?? "") === "appointment").sort((a, b) => (frontmatter(a.content).data.date ?? "").localeCompare(frontmatter(b.content).data.date ?? ""));
  const day = new Date().toISOString().slice(0, 10);
  const next = appts.find((a) => (frontmatter(a.content).data.date ?? "") >= day);
  const last = [...appts].reverse().find((a) => (frontmatter(a.content).data.date ?? "") < day);
  const qs = careQuestions(notes, last ? new Date(frontmatter(last.content).data.date!).getTime() : 0);
  const checks = S.trips.mine.filter((w) => !w.closed && /check-in/i.test(w.title));
  return `<section class="main" style="overflow:auto"><div class="page wide kit">
    <div class="md"><div class="callout" data-callout="info" data-color="blue"><div class="callout-title">${icon("help")}<span>Personal notes</span></div><div class="callout-content">For keeping track and preparing conversations with clinicians. This is not a medical record and gives no medical advice.</div></div></div>
    <div class="card band"><div class="row"><h2>${icon("columns")} Log</h2><span class="right-actions"><button type="button" class="btn btn-primary" data-action="care-dose">${icon("plus")}Dose</button><button type="button" class="btn" data-action="care-symptom">${icon("plus")}Symptom</button>${log ? `<button type="button" class="btn btn-ghost" data-action="open" data-path="Care/Log.sheet">Open log</button>` : ""}</span></div>
      ${rows.length > 1 ? `<div class="runs">${rows.slice(1).slice(-6).reverse().filter((r) => r[0]).map((r) => `<div class="run"><span><b>${esc(String(r[3] ?? ""))}</b> <span class="small muted">${esc(String(r[2] ?? ""))}${r[4] ? ` · ${esc(String(r[4]))}` : ""}${r[5] != null && r[5] !== "" ? ` · severity ${esc(String(r[5]))}/10` : ""}${r[6] ? ` · ${esc(String(r[6]))}` : ""}</span></span><span class="small faint">${esc(String(r[0]))} ${esc(String(r[1] ?? ""))}</span></div>`).join("")}</div>` : `<p class="muted small">Log doses and symptoms with two taps; the log sheet charts severity by day.</p>`}
    </div>
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("calendar")} Appointments</h2><span class="right-actions"><button type="button" class="btn" data-action="appt-new">${icon("plus")}Appointment</button></span></div>
        ${next ? `<p><b>Next:</b> <a href="#" data-action="open" data-path="${esc(next.path)}">${esc(base(next.path))}</a></p>` : `<p class="small muted">No upcoming appointment.</p>`}
        <div class="band-title">Questions to ask <span class="count">${qs.length}</span></div>
        <p class="small muted">Write <code>Q::</code> in any note as questions come up; they collect here.</p>
        ${qs.length ? `<div class="runs">${qs.map((q) => `<div class="run"><span>${esc(q.q)}</span><a class="small" href="#" data-action="open" data-path="${esc(q.path)}">${esc(base(q.path))}</a></div>`).join("")}</div>` : ""}
        <div class="row tight nudge"><button type="button" class="btn btn-primary" data-action="care-summary" ${log || qs.length ? "" : "disabled"}>${icon("download")}Prepare the summary</button></div></div>
      <div class="card band"><div class="row"><h2>${icon("shield")} Care team</h2></div>
        <p class="small muted">Share the Care folder read-only with family or carers, and set a daily check-in: if it is missed, the person you choose gets an alert anywhere in Agent Space.</p>
        <div class="row tight wrap"><button type="button" class="btn" data-action="care-share">${icon("share")}Share the Care folder</button><button type="button" class="btn" data-action="care-checkin-new">${icon("check")}Set a daily check-in</button></div>
        ${checks.length ? `<div class="runs nudge">${checks.map((w) => `<div class="run"><span><b>${esc(w.title)}</b> <span class="small muted">· @${esc(w.contact_handle)} · ${w.last_check_in ? `last ${ago(w.last_check_in)}` : "not yet"}</span></span><span class="row-actions">${w.overdue ? `<span class="pill bad">missed</span>` : ""}<button type="button" class="btn btn-primary" data-action="trip-checkin" data-id="${w.id}">Check in</button><button type="button" class="btn btn-ghost" data-action="trip-home" data-id="${w.id}">Stop</button></span></div>`).join("")}</div>` : ""}
        ${S.trips.watching.filter((w) => /check-in/i.test(w.title)).map((w) => `<div class="run ${w.overdue && !w.closed ? "overdue" : ""}"><span>You watch <b>@${esc(w.owner_handle)}</b>: ${esc(w.title)}</span><span class="pill ${w.overdue && !w.closed ? "bad" : "ok"}">${w.overdue && !w.closed ? "missed" : "on track"}</span></div>`).join("")}</div>
    </div>
  </div></section>`;
}
async function careCheckin() {
  const what = await ask({ title: "Daily check-in", label: "What to check in about", value: "Evening medicine", ok: "Next" });
  if (!what?.trim()) return;
  const handle = await ask({ title: "Who should be alerted if it is missed?", body: "They need to be in the community.", label: "Their handle", placeholder: "ada", ok: "Next" });
  if (!handle?.trim()) return;
  const every = await ask({ title: "How often", label: "Check in at least every (hours)", value: "24", ok: "Start" });
  if (every === null) return;
  const r = await registry().set_watch(handle.trim(), `${what.trim()} check-in`, S.notebook ? `${location.origin}${location.pathname}#/shared/${S.notebook.canister.toText()}/${encodeURIComponent("Care")}` : "", BigInt(Date.now() + 119 * 86_400_000) * 1_000_000n, Number(every) || 24);
  if (r.__kind__ === "Err") return toast(r.Err, "error");
  await loadWatches();
  toast(`@${r.Ok.contact_handle} is alerted if you miss a check-in.`, "ok");
  render();
}
async function careSummaryNote() {
  const notes = orgNotes();
  const log = careLog();
  const rows = log ? evaluate(parseWorkbook(log.content)).get("Log") ?? [] : [];
  const appts = notes.filter((n) => (frontmatter(n.content).data.type ?? "") === "appointment").map((n) => frontmatter(n.content).data.date ?? "").filter((d) => d < new Date().toISOString().slice(0, 10)).sort();
  const since = appts.length ? new Date(appts[appts.length - 1]).getTime() : 0;
  const path = `Care/Summary ${new Date().toISOString().slice(0, 10)}.md`;
  const md = careSummary(rows, careQuestions(notes, since));
  if (note(path)) await writeNote(path, md); else await createQuiet(path, md);
  S.tab = "notes";
  await open(path);
}

// --- the Software kit

function softwareTab(): string {
  const notes = orgNotes();
  const adrs = notes.filter((n) => (frontmatter(n.content).data.type ?? "") === "adr").sort((a, b) => base(a.path).localeCompare(base(b.path)));
  const supersededBy = new Map<string, string>();
  for (const a of adrs) { const s = /\[\[([^\]|#]+)/.exec(frontmatter(a.content).data.supersedes ?? "")?.[1]; const t = s ? resolveLink(s) : undefined; if (t) supersededBy.set(t, a.path); }
  const runbooks = notes.filter((n) => (frontmatter(n.content).data.type ?? "") === "runbook");
  const pms = (p: string) => [...(S.idx.backlinks.get(p) ?? [])].filter((b) => /post-mortem/i.test(frontmatter(note(b)?.content ?? "").data.type ?? "") || /post-?mortem/i.test(b));
  const cl = changelog(notes);
  const pill = (st: string) => `<span class="pill ${st === "accepted" ? "ok" : st === "superseded" || st === "deprecated" || st === "rejected" ? "low" : ""}">${esc(st)}</span>`;
  const H = Math.max(60, adrs.length * 34 + 20);
  const y = (i: number) => 20 + i * 34;
  const graph = adrs.length ? `<svg viewBox="0 0 520 ${H}" class="adr-graph" role="img" aria-label="Decision records and what supersedes what">${adrs.map((a, i) => { const by = supersededBy.get(a.path); const j = by ? adrs.findIndex((x) => x.path === by) : -1; return j >= 0 ? `<path d="M 30 ${y(i)} C 6 ${y(i)}, 6 ${y(j)}, 30 ${y(j)}" fill="none" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#arr)"/>` : ""; }).join("")}<defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--accent)"/></marker></defs>${adrs.map((a, i) => { const st = (frontmatter(a.content).data.status ?? "proposed").toLowerCase(); return `<g><circle cx="38" cy="${y(i)}" r="6" fill="${st === "accepted" ? "#4fc27a" : st === "proposed" ? "#4f8cff" : "#888"}"/><text x="52" y="${y(i) + 4}" font-size="12" fill="currentColor">${esc(base(a.path).slice(0, 60))}</text></g>`; }).join("")}</svg>` : "";
  return `<section class="main" style="overflow:auto"><div class="page wide kit">
    <div class="card band"><div class="row"><h2>${icon("template")} Decision records</h2><span class="right-actions"><button type="button" class="btn btn-primary" data-action="adr-new">${icon("plus")}New ADR</button></span></div>
      ${adrs.length ? `<div class="runs">${adrs.map((a) => { const d = frontmatter(a.content).data; const by = supersededBy.get(a.path); return `<div class="run adr-row"><span><a href="#" data-action="open" data-path="${esc(a.path)}">${esc(base(a.path))}</a>${by ? ` <span class="small faint">→ superseded by ${esc(base(by))}</span>` : ""}</span><span class="row-actions"><select class="input" name="adrstatus" data-path="${esc(a.path)}" aria-label="Status of ${esc(base(a.path))}" style="max-width:130px">${ADR_STATUSES.map((s) => `<option ${s === (d.status ?? "proposed").toLowerCase() ? "selected" : ""}>${s}</option>`).join("")}</select></span></div>`; }).join("")}</div>${graph}` : `<p class="muted small">Architecture decisions with a status and what they supersede, numbered ADR-0001 onwards.</p>`}
    </div>
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("terminal")} Runbooks</h2><span class="right-actions"><button type="button" class="btn" data-action="runbook-new">${icon("plus")}Runbook</button></span></div>
        <p class="small muted">Every code block in a note gets a Copy button; Python blocks also get Run. Post-mortems that link a runbook show up under it.</p>
        ${runbooks.length ? `<div class="runs">${runbooks.map((r) => { const d = frontmatter(r.content).data; const linked = pms(r.path); return `<div class="run"><span><a href="#" data-action="open" data-path="${esc(r.path)}">${esc(base(r.path))}</a> <span class="small faint">${esc(d.service ?? "")}${d.last_reviewed ? ` · reviewed ${esc(d.last_reviewed)}` : ""}</span>${linked.length ? `<div class="small">${linked.map((p) => `<a href="#" data-action="open" data-path="${esc(p)}">${esc(base(p))}</a>`).join(", ")}</div>` : ""}</span></div>`; }).join("")}</div>` : ""}</div>
      <div class="card band"><div class="row"><h2>${icon("history")} Changelog</h2><span class="right-actions"><button type="button" class="btn" data-action="change-new">${icon("plus")}Change</button><button type="button" class="btn btn-primary" data-action="changelog-build" ${cl.changes.length ? "" : "disabled"}>Build &amp; publish</button></span></div>
        <p class="small muted">Notes tagged <code>#changelog</code> or <code>type: change</code>, with <code>version:</code>, <code>date:</code> and <code>kind:</code> (added, changed, fixed, removed, security), become a Changelog page you can share publicly.</p>
        ${cl.changes.length ? `<div class="runs">${cl.changes.slice(0, 12).map((c) => `<div class="run"><span><span class="pill">${esc(c.kind)}</span> <a href="#" data-action="open" data-path="${esc(c.path)}">${esc(c.text)}</a></span><span class="small faint">${esc(c.version)}</span></div>`).join("")}</div>` : ""}</div>
    </div>
  </div></section>`;
}
/** Code blocks get Copy; Python blocks also Run (Pyodide, the same engine as Jupyter notes). */
function decorateCode(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(".preview pre > code, .md pre > code").forEach((code) => {
    const pre = code.parentElement!;
    if (pre.dataset.tools || pre.closest(".nbk, .chat-log")) return;
    pre.dataset.tools = "1";
    const py = /language-(python|py)\b/.test(code.className);
    const bar = document.createElement("div");
    bar.className = "code-tools";
    bar.innerHTML = `${py ? `<button type="button" class="btn btn-ghost" data-run>Run</button>` : ""}<button type="button" class="btn btn-ghost" data-copy-code>Copy</button>`;
    pre.prepend(bar);
    bar.querySelector("[data-copy-code]")!.addEventListener("click", (e) => { e.stopPropagation(); void copy(code.innerText).then(() => toast("Copied.", "ok")); });
    bar.querySelector("[data-run]")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      let out = pre.nextElementSibling as HTMLElement | null;
      if (!out?.classList.contains("run-out")) { out = document.createElement("div"); out.className = "nb-outputs run-out"; pre.after(out); }
      out.innerHTML = `<pre class="nb-out">${pythonLoaded() ? "Running…" : "Loading Python (first run)…"}</pre>`;
      const live: NbOutput[] = [];
      const r = await runPython(code.innerText, (o) => { live.push(o); out!.innerHTML = live.map(outputHtml).join(""); }, sheetsForPython());
      out.innerHTML = r.outputs.map(outputHtml).join("") || `<pre class="nb-out">(no output)</pre>`;
    });
  });
}

// --- the Organize tab: saved searches with property tables, triage, periodic notes, rules, tidy-up, refactors, resurfacing, decay

const orgNotes = () => (S.notes ?? []).map((n) => ({ ...n, content: S.drafts.get(n.path)?.text ?? n.content }));
const fmOf = (path: string) => frontmatter(S.drafts.get(path)?.text ?? note(path)?.content ?? "").data;
/** Change a note's content and save it (the draft keeps the editor in step). */
async function writeNote(path: string, content: string) {
  if (!note(path)) return;
  onDraftInput(path, content);
  await save(path);
  // today's writing may have started a streak
  void nb().usage().then((u) => { S.usage = u; }).catch(() => {});
}
const pinnedSet = () => new Set(S.settings.bookmarks);
const faded = (path: string) => { const n = note(path); return !!n && isFaded({ ...n, content: S.drafts.get(path)?.text ?? n.content }, S.settings.decayDays, pinnedSet()); };
const inboxNotes = () => orgNotes().filter((n) => n.path.endsWith(".md") && (n.path.startsWith("Inbox/") || /(^|\s)#inbox\b/.test(n.content) || frontmatter(n.content).data.source === "capture"));
const choiceInput = (col: PropColumn, path: string, value: string) => {
  const a = `name="propcell" data-path="${esc(path)}" data-key="${esc(col.key)}" aria-label="${esc(col.key)} of ${esc(title(path))}"`;
  if (col.type === "date") return `<input class="cellin" type="date" ${a} value="${esc(value.slice(0, 10))}">`;
  if (col.type === "number") return `<input class="cellin num" type="number" step="any" ${a} value="${esc(value)}">`;
  if (col.type === "checkbox") return `<select class="cellin" ${a}><option value=""></option>${["yes", "no"].map((v) => `<option ${value.toLowerCase() === v || (v === "yes" && value === "true") || (v === "no" && value === "false") ? "selected" : ""}>${v}</option>`).join("")}</select>`;
  if (col.type === "choice") return `<input class="cellin" list="dl-${esc(col.key)}" ${a} value="${esc(value)}">`;
  return `<input class="cellin" ${a} value="${esc(value)}">`;
};
function organizeTab(): string {
  const o = S.org;
  const notes = orgNotes();
  const saved = S.settings.searches;
  const results = o.q.trim() ? runQuery(notes, o.q) : [];
  const cols = propertyColumns(results).slice(0, 7);
  const sorted = o.sort ? [...results].sort((a, b) => { const k = o.sort!.key; const va = k === "_name" ? title(a.path) : frontmatter(a.content).data[k] ?? ""; const vb = k === "_name" ? title(b.path) : frontmatter(b.content).data[k] ?? ""; const na = Number(va), nb2 = Number(vb); const c = va !== "" && vb !== "" && !Number.isNaN(na) && !Number.isNaN(nb2) ? na - nb2 : va.localeCompare(vb); return o.sort!.dir * c; }) : results;
  const head = (k: string, label: string) => `<th><button type="button" class="th-sort" data-action="org-sort" data-key="${esc(k)}">${esc(label)}${o.sort?.key === k ? (o.sort.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`;
  const table = results.length ? `<div class="ptable-wrap"><table class="ptable"><thead><tr><th><input type="checkbox" name="orgall" aria-label="Select all" ${o.selected.size && o.selected.size === results.length ? "checked" : ""}></th>${head("_name", "Note")}${cols.map((c) => head(c.key, `${c.key} · ${c.type}`)).join("")}</tr></thead><tbody>${sorted.slice(0, 300).map((n) => { const d = frontmatter(n.content).data; return `<tr class="${faded(n.path) ? "faded" : ""}"><td><input type="checkbox" name="orgpick" value="${esc(n.path)}" ${o.selected.has(n.path) ? "checked" : ""} aria-label="Select ${esc(title(n.path))}"></td><td><a href="#" data-action="open" data-path="${esc(n.path)}">${esc(title(n.path))}</a><div class="small faint">${esc(dir(n.path))}</div></td>${cols.map((c) => `<td>${choiceInput(c, n.path, d[c.key] ?? "")}</td>`).join("")}</tr>`; }).join("")}</tbody></table>${cols.filter((c) => c.type === "choice").map((c) => `<datalist id="dl-${esc(c.key)}">${c.choices.map((v) => `<option value="${esc(v)}">`).join("")}</datalist>`).join("")}</div>` : o.q.trim() ? `<p class="muted small">No notes match.</p>` : "";
  const inbox = inboxNotes();
  const t = o.triage ? inbox[Math.min(o.triageIdx, inbox.length - 1)] : undefined;
  const issues = lint(notes, S.idx, S.folders);
  const kinds = LINT_KINDS;
  const fix = lintFix;
  const next = nextToResurface(notes, S.settings.resurface);
  const fadedCount = notes.filter((n) => faded(n.path)).length;
  const md = notes.filter((n) => n.path.endsWith(".md")).map((n) => n.path);
  const opts = (sel?: string) => md.map((p) => `<option value="${esc(p)}" ${p === sel ? "selected" : ""}>${esc(stem(p))}</option>`).join("");
  const tpls = [...Object.keys(BUILTIN_TEMPLATES).map((k) => ({ v: `builtin:${k}`, l: `${k} (built in)` })), ...paths().filter((p) => p.startsWith("Templates/")).map((p) => ({ v: p, l: stem(p).slice(10) }))];
  return `<section class="main" style="overflow:auto"><div class="page wide org">
    <div class="card band">
      <div class="row"><h2>${icon("search")} Saved searches</h2></div>
      <form class="row tight" data-form="org-search"><input class="input code" name="orgq" value="${esc(o.q)}" placeholder='tag:#client status:open modified:<7d folder:Projects -tag:done' aria-label="Search query" style="flex:1"><button type="submit" class="btn">Run</button><button type="button" class="btn btn-primary" data-action="org-save" ${o.q.trim() ? "" : "disabled"}>${icon("star")}Save</button>${o.q.trim() ? `<button type="button" class="btn btn-ghost" data-action="org-tile" title="Show this search as a tile on a dashboard">${icon("graph")}Tile</button>` : ""}</form>
      <p class="small muted">Terms combine: <code>tag:x</code>, <code>folder:x</code>, any property like <code>status:open</code> or <code>priority:&gt;2</code>, <code>has:due</code>, <code>modified:&lt;7d</code> or <code>created:&gt;30d</code>, <code>-</code> to exclude, <code>"a phrase"</code>.</p>
      ${saved.length ? `<div class="tags">${saved.map((s, i) => `<span class="tag-chip ${s.q === o.q ? "active" : ""}"><button type="button" class="chip-btn" data-action="org-load" data-i="${i}" title="${esc(s.q)}">${esc(s.name)}<span class="cnt">${runQuery(notes, s.q).length}</span></button><button type="button" class="chip-x" data-action="org-del" data-i="${i}" aria-label="Forget ${esc(s.name)}">${icon("x")}</button></span>`).join("")}</div>` : ""}
      ${o.selected.size ? `<div class="row tight nudge"><span class="small">${o.selected.size} selected</span><button type="button" class="btn" data-action="org-bulk">${icon("edit")}Set a property</button><button type="button" class="btn btn-ghost" data-action="org-unselect">Clear</button></div>` : ""}
      ${table}
    </div>
    <div class="grid2 org-grid">
      <div class="card band">
        <div class="row"><h2>${icon("folder-open")} Inbox triage</h2><span class="right-actions">${inbox.length ? `<button type="button" class="btn ${o.triage ? "" : "btn-primary"}" data-action="triage-toggle">${o.triage ? "Stop" : `Start · ${inbox.length}`}</button>` : ""}</span></div>
        ${!inbox.length ? `<p class="muted small">Inbox zero. Notes in <code>Inbox/</code>, tagged <code>#inbox</code> or quick captures land here.</p>` : t ? `<div class="triage"><div class="small faint">${Math.min(o.triageIdx, inbox.length - 1) + 1} of ${inbox.length} · ${esc(t.path)}</div><h3>${esc(title(t.path))}</h3><div class="triage-body md">${renderMd(frontmatter(t.content).body.slice(0, 1200), t.path)}</div>
          <div class="row tight nudge"><button type="button" class="btn" data-action="triage-file" data-path="${esc(t.path)}"><span class="kbd">F</span>File</button><button type="button" class="btn" data-action="triage-tag" data-path="${esc(t.path)}"><span class="kbd">T</span>Tag</button><button type="button" class="btn" data-action="triage-link" data-path="${esc(t.path)}"><span class="kbd">L</span>Link to project</button><button type="button" class="btn" data-action="org-archive" data-path="${esc(t.path)}"><span class="kbd">A</span>Archive</button><button type="button" class="btn btn-ghost" data-action="triage-next"><span class="kbd">N</span>Skip</button><button type="button" class="btn btn-ghost" data-action="open" data-path="${esc(t.path)}"><span class="kbd">O</span>Open</button></div></div>` : `<p class="small muted">${inbox.length} note${inbox.length === 1 ? "" : "s"} waiting. Start, then one key per note: F file, T tag, L link to a project, A archive, N skip.</p>`}
      </div>
      <div class="card band">
        <div class="row"><h2>${icon("calendar")} Periodic notes</h2></div>
        <p class="small muted">Each rolls up what was created, changed, finished, left open and decided in its period; months link their weeks, quarters their months.</p>
        <div class="row tight">${(["week", "month", "quarter"] as Period[]).map((k) => { const p = periodPath(k, new Date()); return `<span class="btn-group"><button type="button" class="btn" data-action="periodic-open" data-kind="${k}">${note(p) ? "Open" : "Start"} this ${k}</button>${note(p) ? `<button type="button" class="btn btn-ghost icon-btn" data-action="periodic-rebuild" data-kind="${k}" title="Rebuild the rollup (keeps your reflection)" aria-label="Rebuild">${icon("refresh")}</button>` : ""}</span>`; }).join("")}</div>
      </div>
      <div class="card band">
        <div class="row"><h2>${icon("bolt")} Rules</h2></div>
        <p class="small muted">Rules run when a note is saved in this browser. A rule acts once per note.</p>
        ${S.settings.rules.length ? `<div class="runs">${S.settings.rules.map((r) => `<div class="run"><span>When a note gets <b>#${esc(r.tag)}</b>${r.template ? `, apply <b>${esc(r.template.replace(/^builtin:/, "").replace(/^Templates\//, ""))}</b>` : ""}${r.folder ? `, move it to <b>${esc(r.folder)}</b>` : ""}${r.weekly ? ", add it to this week's note" : ""}</span><button type="button" class="btn btn-ghost icon-btn" data-action="rule-del" data-id="${esc(r.id)}" aria-label="Delete rule">${icon("x")}</button></div>`).join("")}</div>` : ""}
        <form class="rule-form" data-form="rule-add"><input class="input" name="rtag" placeholder="tag, e.g. meeting" required><select class="input" name="rtpl"><option value="">no template</option>${tpls.map((x) => `<option value="${esc(x.v)}">${esc(x.l)}</option>`).join("")}</select><select class="input" name="rfolder"><option value="">stay where it is</option>${S.folders.filter((f) => !isAgentPath(f)).map((f) => `<option>${esc(f)}</option>`).join("")}</select><label class="switch"><input type="checkbox" name="rweek"> Add to this week</label><button type="submit" class="btn">${icon("plus")}Add rule</button></form>
        <label class="field nudge"><span class="label">Kanban: move done cards to an Archive lane after (days, 0 = never)</span><div class="row tight"><input class="input" type="number" min="0" name="kbarchive" value="${S.settings.kanbanArchiveDays}" style="max-width:110px"><button type="button" class="btn btn-ghost" data-action="kb-sweep">Sweep boards now</button></div></label>
      </div>
      <div class="card band">
        <div class="row"><h2>${icon("eye")} Resurface</h2></div>
        ${next ? `<div class="resurface"><div class="small faint">Last touched ${ago(BigInt(nsToMs(next.modified)) * 1_000_000n)}</div><h3><a href="#" data-action="open" data-path="${esc(next.path)}">${esc(title(next.path))}</a></h3><div class="triage-body md">${renderMd(frontmatter(next.content).body.slice(0, 700), next.path)}</div><div class="row tight nudge"><button type="button" class="btn btn-primary" data-action="res-keep" data-path="${esc(next.path)}">Keep, show me later</button><button type="button" class="btn" data-action="open" data-path="${esc(next.path)}">Edit</button><button type="button" class="btn" data-action="res-pin" data-path="${esc(next.path)}">${icon("star")}Pin</button><button type="button" class="btn btn-ghost" data-action="org-archive" data-path="${esc(next.path)}">Archive</button></div></div>` : `<p class="muted small">Nothing older than 30 days is due. Old notes come back here so they get reread, kept or pruned.</p>`}
      </div>
      <div class="card band">
        <div class="row"><h2>${icon("history")} Decay</h2></div>
        <p class="small muted">Notes nobody touched for a while fade in the file tree, and can be hidden, unless pinned to the top or marked <code>pinned: true</code>. Everything in <code>Archive/</code> is faded.</p>
        <div class="row tight"><label class="field"><span class="label">Fade after (days, 0 = off)</span><input class="input" type="number" min="0" name="decaydays" value="${S.settings.decayDays}" style="max-width:110px"></label><label class="switch"><input type="checkbox" name="hidefaded" ${S.settings.hideFaded ? "checked" : ""}> Hide faded notes in the tree</label></div>
        <p class="small faint">${fadedCount} note${fadedCount === 1 ? "" : "s"} faded right now.</p>
      </div>
    </div>
    <div class="card band">
      <div class="row"><h2>${icon("check")} Tidy up</h2><span class="small muted">${issues.length ? `${issues.length} thing${issues.length === 1 ? "" : "s"} to look at` : "All tidy"}</span></div>
      ${kinds.map(([k, label]) => { const is = issues.filter((i) => i.kind === k); return is.length ? `<details class="lint" ${is.length <= 6 ? "open" : ""}><summary><b>${label}</b> <span class="count">${is.length}</span></summary><div class="runs">${is.slice(0, 60).map((i) => `<div class="run"><span><a href="#" data-action="${k === "empty-folder" ? "noop" : "open"}" data-path="${esc(i.path)}">${esc(k === "empty-folder" ? i.path : stem(i.path))}</a> <span class="small muted">· ${esc(i.detail)}</span></span><span class="row-actions">${fix(i)}</span></div>`).join("")}</div></details>` : ""; }).join("")}
    </div>
    <div class="card band">
      <div class="row"><h2>${icon("move")} Refactor</h2></div>
      <div class="grid2">
        <form class="field" data-form="ref-tag"><span class="label">Rename a tag everywhere</span><div class="row tight"><input class="input" name="from" placeholder="old" required list="dl-tags"><input class="input" name="to" placeholder="new" required><button type="submit" class="btn">Rename</button></div></form>
        <form class="field" data-form="ref-prop"><span class="label">Rename a property everywhere</span><div class="row tight"><input class="input" name="from" placeholder="old key" required><input class="input" name="to" placeholder="new key" required><button type="submit" class="btn">Rename</button></div></form>
        <form class="field" data-form="ref-split"><span class="label">Split a note at its ## headings</span><div class="row tight"><select class="input" name="path">${opts(cur())}</select><button type="submit" class="btn">Split</button></div></form>
        <form class="field" data-form="ref-merge"><span class="label">Merge a note into another (links follow)</span><div class="row tight"><select class="input" name="from" aria-label="Note to merge in">${opts()}</select><span class="small">into</span><select class="input" name="into" aria-label="Note to keep">${opts(cur())}</select><button type="submit" class="btn">Merge</button></div></form>
      </div>
      <datalist id="dl-tags">${[...S.idx.tags.keys()].sort().map((tg) => `<option value="${esc(tg)}">`).join("")}</datalist>
    </div>
  </div></section>`;
}
/** Apply every rule to a note that was just saved; a rule acts once per note (it leaves a marker). */
async function runRules(path: string) {
  if (!S.settings.rules.length || !path.endsWith(".md") || path.startsWith("Periodic/") || isAgentPath(path)) return;
  for (const r of S.settings.rules) {
    const content = S.drafts.get(path)?.text ?? note(path)?.content ?? "";
    const tpl = r.template ? (r.template.startsWith("builtin:") ? BUILTIN_TEMPLATES[r.template.slice(8)] : note(r.template)?.content) : undefined;
    const out = applyRule(r, path, content, tpl ? fillTemplate(tpl, { title: title(path) }) : undefined);
    if (!out.applied) continue;
    await writeNote(path, out.content);
    if (out.weekly) await addToPeriodic("week", path);
    if (out.move && !note(out.move)) { await renamePath(path, out.move); toast(`Rule #${r.tag}: moved to ${dir(out.move)}.`, "ok"); return; }
    toast(`Rule #${r.tag} applied to ${title(path)}.`, "ok");
  }
}
async function addToPeriodic(kind: Period, path: string) {
  const p = periodPath(kind, new Date());
  if (!note(p)) await createQuiet(p, periodRollup(kind, new Date(), orgNotes()));
  const text = S.drafts.get(p)?.text ?? note(p)?.content ?? "";
  const link = `- [[${stem(path)}]]`;
  if (!text.includes(link)) await writeNote(p, text.replace(/\n## Reflection/, `\n## Added by rules\n\n${link}\n\n## Reflection`));
}
/** Create a note without opening it (for rollups, links and generated files). */
async function createQuiet(path: string, content: string) {
  if (!S.notes || note(path)) return;
  const m = unwrap(await nb().write(path, content));
  S.notes.push({ path, content, created: m.created, modified: m.modified });
  S.notes.sort((x, y) => x.path.localeCompare(y.path));
  if (dir(path) && !S.folders.includes(dir(path))) S.folders = [...S.folders, dir(path)].sort();
  reindex();
}
async function openPeriodic(kind: Period, rebuild = false) {
  const p = periodPath(kind, new Date());
  const fresh = periodRollup(kind, new Date(), orgNotes());
  if (!note(p)) { await createQuiet(p, fresh); }
  else if (rebuild) {
    const old = S.drafts.get(p)?.text ?? note(p)!.content;
    const keep = old.slice(old.indexOf("\n## Reflection") >= 0 ? old.indexOf("\n## Reflection") : old.length);
    await writeNote(p, fresh.slice(0, fresh.indexOf("\n## Reflection")) + (keep || "\n## Reflection\n\n- \n"));
    toast("Rollup rebuilt; your reflection is kept.", "ok");
  }
  S.tab = "notes";
  await open(p);
}
/** Done kanban cards carry `✅ date`; after the set number of days they move to an Archive lane. */
async function sweepBoards(manual = false) {
  const days = S.settings.kanbanArchiveDays;
  if (!days || !S.notes) { if (manual) toast("Set the number of days first.", "info"); return; }
  let moved = 0;
  for (const n of orgNotes().filter((x) => isKanban(x.content))) {
    const b = parseBoard(n.content);
    let lane = b.lanes.find((l) => l.title.toLowerCase() === "archive");
    let changed = false;
    for (const l of b.lanes) {
      if (l === lane) continue;
      const keep = [];
      for (const c of l.cards) {
        const d = /✅\s*(\d{4}-\d{2}-\d{2})/.exec(c.text)?.[1];
        if (c.done && d && Date.now() - new Date(d).getTime() > days * 86_400_000) {
          if (!lane) { lane = { title: "Archive", cards: [], complete: true }; b.lanes.push(lane); }
          lane.cards.push(c); changed = true; moved++;
        } else keep.push(c);
      }
      l.cards = keep;
    }
    if (changed) await writeNote(n.path, serializeBoard(b));
  }
  if (manual || moved) toast(moved ? `Archived ${moved} done card${moved === 1 ? "" : "s"}.` : "No done cards old enough.", "ok");
}

// --- the Trips tab: plans, gear, food, water, routes, field journal, check-ins, reviews, skills decks

function tripsTab(): string {
  const notes = orgNotes();
  const trips = notes.filter((n) => n.path.endsWith(".md") && (frontmatter(n.content).data.type ?? "") === "trip").sort((a, b) => (frontmatter(b.content).data.start ?? "").localeCompare(frontmatter(a.content).data.start ?? ""));
  const gear = notes.filter((n) => isSheetPath(n.path) && isGearWorkbook(n.content));
  const watch = (id?: string) => S.trips.mine.find((w) => String(w.id) === id);
  const card = (n: OrgNote) => {
    const d = frontmatter(n.content).data;
    const f = dir(n.path);
    const w = watch(d.watch);
    const inFolder = (suffix: string) => notes.find((x) => x.path === `${f}/${suffix}`);
    const entries = notes.filter((x) => x.path.startsWith(`${f}/Journal/`)).sort((a, b) => (frontmatter(b.content).data.time ?? "").localeCompare(frontmatter(a.content).data.time ?? ""));
    const routes = notes.filter((x) => dir(x.path) === f && (frontmatter(x.content).data.type ?? "") === "route");
    const status = w ? (w.closed ? `<span class="pill">back home</span>` : w.overdue ? `<span class="pill bad">overdue</span>` : `<span class="pill ok">@${esc(w.contact_handle)} is watching</span>`) : "";
    const btn = (action: string, label: string, ic: string, extra = "") => `<button type="button" class="btn btn-ghost" data-action="${action}" data-path="${esc(n.path)}" data-folder="${esc(f)}" ${extra}>${icon(ic)}${label}</button>`;
    const have = (suffix: string, label: string, ic: string, action: string) => inFolder(suffix) ? `<button type="button" class="btn btn-ghost" data-action="open" data-path="${esc(`${f}/${suffix}`)}">${icon(ic)}${label}</button>` : btn(action, label, ic);
    return `<div class="card band trip">
      <div class="row"><h2><a href="#" data-action="open" data-path="${esc(n.path)}">${esc(title(n.path) === "Plan" ? f.split("/").pop()! : title(n.path))}</a></h2><span class="small muted">${esc(d.start ?? "")}${d.end && d.end !== d.start ? ` → ${esc(d.end)}` : ""}${d.return_by ? ` · back by ${esc(d.return_by)}` : ""}</span><span class="right-actions">${status}</span></div>
      <div class="row tight wrap">${btn("open", "Plan", "file")}${have("Gear.sheet", "Gear", "columns", "trip-gear")}${have("Food.sheet", "Food", "columns", "trip-food")}${have("Water.sheet", "Water", "columns", "trip-water")}<label class="btn btn-ghost">${icon("upload")}Route (GPX)<input type="file" name="gpx" accept=".gpx,application/gpx+xml" data-folder="${esc(f)}" hidden></label>${btn("field-entry", "Field entry", "camera")}${have("Review.md", "Review", "check", "trip-review")}${inFolder("Review.md") ? `<button type="button" class="btn btn-ghost" data-action="review-apply" data-path="${esc(`${f}/Review.md`)}">${icon("columns")}Apply review to gear</button>` : ""}${btn("trip-print", "Print", "download")}</div>
      <div class="row tight wrap nudge">${!w || w.closed ? btn("trip-leave", "Leave this plan with someone", "shield") : `${btn("trip-checkin", "Check in: I'm OK", "check", `data-id="${w.id}"`)}${btn("trip-home", "Back home", "out", `data-id="${w.id}"`)}<span class="small muted">${w.last_check_in ? `last check-in ${ago(w.last_check_in)}` : "no check-in yet"}${w.every_hours ? ` · every ${w.every_hours} h` : ""}</span>`}</div>
      ${routes.length ? `<div class="band-title">Routes</div>${routes.map((r) => `<div class="run"><a href="#" data-action="open" data-path="${esc(r.path)}">${esc(title(r.path))}</a><span class="small muted">${esc(frontmatter(r.content).data.distance_km ?? "?")} km · ↑ ${esc(frontmatter(r.content).data.ascent_m ?? "?")} m</span></div>`).join("")}` : ""}
      ${entries.length ? `<div class="band-title">Field journal · ${entries.length}</div><div class="timeline">${entries.slice(0, 8).map((e) => { const ed = frontmatter(e.content).data; return `<div class="tl-row" data-action="open" data-path="${esc(e.path)}"><span class="tl-time">${esc(ed.time ?? "")}</span><span class="tl-text">${esc(frontmatter(e.content).body.replace(/^#.*\n/, "").trim().slice(0, 120) || "(empty)")}</span>${ed.lat ? `<span class="small faint">${esc(ed.lat)}, ${esc(ed.lon ?? "")}</span>` : ""}</div>`; }).join("")}</div>` : ""}
    </div>`;
  };
  const watching = S.trips.watching;
  return `<section class="main" style="overflow:auto"><div class="page wide trips">
    ${watching.length ? `<div class="card band ${watching.some((w) => w.overdue && !w.closed) ? "alarm" : ""}"><div class="row"><h2>${icon("shield")} Trips left with you</h2></div>${watching.map((w) => `<div class="run ${w.overdue && !w.closed ? "overdue" : ""}"><span><b>@${esc(w.owner_handle)}</b> · ${esc(w.title)} · back by ${esc(new Date(Number(w.return_by / 1_000_000n)).toLocaleString())}${w.last_check_in ? ` · last check-in ${ago(w.last_check_in)}` : ""}</span><span class="row-actions">${w.closed ? `<span class="pill">back home</span>` : w.overdue ? `<span class="pill bad">overdue: follow their plan</span>` : `<span class="pill ok">on track</span>`}<a class="btn btn-ghost" href="${esc(w.link)}" target="_blank" rel="noopener">${icon("out")}Plan</a></span></div>`).join("")}<p class="small muted">If a trip is overdue, read their plan and follow its "Plan if late" section; call the agency or emergency number it lists.</p></div>` : ""}
    <div class="card band"><div class="row"><h2>${icon("mountain")} Trips</h2><span class="right-actions"><button type="button" class="btn btn-primary" data-action="trip-new">${icon("plus")}New trip</button></span></div>
      <p class="small muted">A trip is a folder under <code>Trips/</code> with a plan, a gear list, a food plan, a water ledger, routes from GPX files, a field journal and a review. It all works offline once the space has been opened here; changes sync when you are back in range.</p></div>
    ${trips.map(card).join("") || ""}
    <div class="grid2">
      <div class="card band"><div class="row"><h2>${icon("columns")} Gear lists</h2><span class="right-actions">${gear.length > 1 ? `<button type="button" class="btn" data-action="gear-compare">${icon("graph")}Compare</button>` : ""}</span></div>
        ${gear.length ? `<div class="runs">${gear.map((g) => { const bw = baseWeight(g.content); return `<div class="run"><a href="#" data-action="open" data-path="${esc(g.path)}">${esc(stem(g.path))}</a><span class="small muted">${bw === undefined ? "" : `base ${(bw / 1000).toFixed(2)} kg · ${(bw / 453.6).toFixed(1)} lb`}</span></div>`; }).join("")}</div>` : `<p class="small muted">No gear lists yet; each trip can start one, copied from an earlier list.</p>`}</div>
      <div class="card band"><div class="row"><h2>${icon("check")} Skills decks</h2></div><p class="small muted">Flashcards for the Study tab's spaced repetition.</p>
        <div class="row tight wrap">${Object.keys(DECKS).map((k) => { const p = `Skills/${k}.md`; return note(p) ? `<button type="button" class="btn btn-ghost" data-action="open" data-path="${esc(p)}">${icon("check")}${esc(k)}</button>` : `<button type="button" class="btn" data-action="deck-add" data-deck="${esc(k)}">${icon("plus")}${esc(k)}</button>`; }).join("")}</div></div>
    </div>
  </div></section>`;
}
async function tripNew() {
  const name = (await ask({ title: "New trip", label: "Name", placeholder: "Lost Coast, May", ok: "Create" }))?.trim().replace(/[\\/:*?"<>|#^[\]]/g, " ");
  if (!name) return;
  const f = `Trips/${name}`;
  if (note(`${f}/Plan.md`)) return toast("A trip with that name exists.", "error");
  await createQuiet(`${f}/Plan.md`, fillTemplate(TRIP_TEMPLATE, { title: name }));
  S.tab = "notes";
  await open(`${f}/Plan.md`);
}
async function tripSheet(kind: "gear" | "food" | "water", folder: string) {
  const path = `${folder}/${kind === "gear" ? "Gear" : kind === "food" ? "Food" : "Water"}.sheet`;
  let content = kind === "water" ? waterWorkbook() : "";
  if (kind === "gear") {
    const others = orgNotes().filter((n) => isSheetPath(n.path) && isGearWorkbook(n.content));
    const from = others.length ? await ask({ title: "Gear list", label: "Start from", choices: [{ value: "", label: "A fresh list" }, ...others.map((o) => ({ value: o.path, label: `Copy of ${stem(o.path)}` }))], value: others[0].path, ok: "Create" }) : "";
    if (from === null) return;
    content = from ? note(from)!.content : gearWorkbook();
  }
  if (kind === "food") {
    const d = fmOf(`${folder}/Plan.md`);
    const span = d.start && d.end ? Math.max(1, Math.round((new Date(d.end).getTime() - new Date(d.start).getTime()) / 86_400_000) + 1) : 3;
    const days = await ask({ title: "Food plan", label: "Days", value: String(Math.min(span, 30)), ok: "Next" });
    if (days === null) return;
    const target = await ask({ title: "Food plan", label: "Daily target (kcal)", value: "3000", ok: "Create" });
    if (target === null) return;
    content = foodWorkbook(Math.max(1, Math.min(30, Number(days) || 3)), Number(target) || 3000);
  }
  await createQuiet(path, content);
  S.tab = "notes";
  await open(path);
}
async function importGpx(folder: string, file: File) {
  const t = parseGpx(await file.text());
  if (t.points.length < 2 && !t.waypoints.length) return toast("No track points or waypoints in that file.", "error");
  const name = (t.name || file.name.replace(/\.gpx$/i, "")).replace(/[\\/:*?"<>|#^[\]]/g, " ").trim() || "Route";
  let path = `${folder}/${name}.md`;
  for (let i = 2; note(path); i++) path = `${folder}/${name} ${i}.md`;
  await createQuiet(path, routeNote(t));
  S.tab = "notes";
  await open(path);
  toast(`Imported ${t.points.length} points and ${t.waypoints.length} waypoints.`, "ok");
}
async function fieldNote(folder: string) {
  toast("Getting your position (works without signal)…", "info");
  const pos = await new Promise<GeolocationCoordinates | undefined>((res) => {
    if (!navigator.geolocation) return res(undefined);
    navigator.geolocation.getCurrentPosition((p) => res(p.coords), () => res(undefined), { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 });
  });
  const now = new Date();
  const stamp = localStamp(now).replace(":", "");
  let path = `${folder}/Journal/${stamp}.md`;
  for (let i = 2; note(path); i++) path = `${folder}/Journal/${stamp} ${i}.md`;
  await createQuiet(path, fieldEntry(now, pos ? { lat: pos.latitude, lon: pos.longitude, alt: pos.altitude } : undefined));
  S.tab = "notes";
  await open(path);
  pane().view = "edit";
  render();
  if (!pos) toast("No position this time; the entry is saved without one.", "info");
}
async function tripReview(folder: string) {
  const path = `${folder}/Review.md`;
  await createQuiet(path, setProperty(fillTemplate(REVIEW_TEMPLATE, { title: `${folder.split("/").pop()} review` }), "trip", `[[${folder}/Plan]]`));
  S.tab = "notes";
  await open(path);
}
async function applyReview(path: string) {
  const gear = orgNotes().filter((n) => isSheetPath(n.path) && isGearWorkbook(n.content));
  if (!gear.length) return toast("Make a gear list first.", "info");
  const target = await ask({ title: "Apply this review to a gear list", label: "Gear list", choices: gear.map((g) => ({ value: g.path, label: stem(g.path) })), value: gear[gear.length - 1].path, ok: "Apply" });
  if (!target) return;
  const r = applyReviewToGear(S.drafts.get(path)?.text ?? note(path)!.content, S.drafts.get(target)?.text ?? note(target)!.content);
  await writeNote(target, r.json);
  toast(`Gear list updated: ${r.added} added, ${r.removed} removed.`, "ok");
}
/** Make the plan readable by link, then leave it with a community member who is alerted if you miss a check-in or your return. */
async function tripLeave(path: string) {
  const d = fmOf(path);
  const handle = await ask({ title: "Leave this plan with someone", body: "They must be in the community. They get a read-only link to this plan now, and an alert anywhere in Agent Space if you miss a check-in or are not back by your return time.", label: "Their handle", value: (d.contact ?? "").replace(/^@/, ""), placeholder: "ada", ok: "Next" });
  if (!handle?.trim()) return;
  const when = await ask({ title: "Back by", label: "Date and time (YYYY-MM-DD HH:MM)", value: d.return_by || `${new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)} 18:00`, ok: "Next" });
  if (!when) return;
  const at = new Date(when.trim().replace(" ", "T"));
  if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) return toast("That return time is not in the future.", "error");
  const every = await ask({ title: "Check-ins", body: "Leave empty to rely on the return time only.", label: "Check in at least every (hours)", value: "24", ok: "Leave the plan" });
  if (every === null) return;
  try {
    unwrap(await nb().set_share({ path, public: true, public_role: Role.View, viewers: [], commenters: [], editors: [] }));
    await refreshShares();
    const r = await registry().set_watch(handle.trim(), title(path) === "Plan" ? dir(path).split("/").pop()! : title(path), shareLink(path), BigInt(at.getTime()) * 1_000_000n, every.trim() ? Number(every) : null);
    if (r.__kind__ === "Err") throw new Error(r.Err);
    let text = S.drafts.get(path)?.text ?? note(path)!.content;
    text = setProperty(setProperty(setProperty(text, "watch", String(r.Ok.id)), "contact", `@${r.Ok.contact_handle}`), "return_by", when.trim());
    await writeNote(path, text);
    await loadWatches();
    toast(`@${r.Ok.contact_handle} is watching. Check in from the Trips tab; press Back home when you are out.`, "ok");
  } catch (e) { toast(errMsg(e), "error"); }
  render();
}
async function loadWatches() {
  if (!S.identity) return;
  const [mine, watching] = await Promise.all([registry().my_watches().catch(() => []), registry().watching().catch(() => [])]);
  S.trips.mine = mine;
  S.trips.watching = watching;
  watchBanner();
}
/** An overdue trip someone left with you shows on every page until you look at it. */
function watchBanner() {
  const late = S.trips.watching.filter((w) => w.overdue && !w.closed && store(`nb-watch-ack-${w.id}`) !== String(Math.floor(Date.now() / 3_600_000)));
  let el = document.getElementById("watch-alert");
  if (!late.length) { el?.remove(); return; }
  if (!el) { el = Object.assign(document.createElement("div"), { id: "watch-alert" }); el.setAttribute("role", "alert"); document.body.append(el); }
  const w = late[0];
  el.innerHTML = `${icon("shield")}<span><b>@${esc(w.owner_handle)} is overdue</b> from “${esc(w.title)}”${w.last_check_in ? `; last check-in ${ago(w.last_check_in)}` : ""}. Read their plan and follow its “Plan if late” section.</span><a class="btn" href="${esc(w.link)}" target="_blank" rel="noopener">Open the plan</a><button type="button" class="btn btn-ghost" data-watch-ack="${w.id}">Seen</button>`;
  el.querySelector("[data-watch-ack]")!.addEventListener("click", () => { store(`nb-watch-ack-${w.id}`, String(Math.floor(Date.now() / 3_600_000))); watchBanner(); });
  if (document.hidden && "Notification" in window && Notification.permission === "granted" && store(`nb-watch-note-${w.id}`) !== String(Math.floor(Date.now() / 3_600_000))) { store(`nb-watch-note-${w.id}`, String(Math.floor(Date.now() / 3_600_000))); new Notification(`@${w.owner_handle} is overdue`, { body: w.title, tag: `watch-${w.id}` }); }
}
setInterval(() => void loadWatches(), 60_000);
setTimeout(() => void loadWatches(), 3000);
async function gearCompare() {
  const gear = orgNotes().filter((n) => isSheetPath(n.path) && isGearWorkbook(n.content));
  const path = "Trips/Gear comparison.dash";
  const tiles = gear.map((g) => ({ id: Math.random().toString(36).slice(2, 8), kind: "kpi" as const, source: g.path, sheet: GEAR_BASE_REF.sheet, ref: GEAR_BASE_REF.ref, label: `${stem(g.path)} · base weight (g)` }));
  const content = `${JSON.stringify({ tiles }, null, 1)}\n`;
  if (note(path)) await writeNote(path, content); else await createQuiet(path, content);
  S.tab = "notes";
  await open(path);
}

function workTab(): string {
  const today = new Date();
  const notes = workNotes();
  const tasks = sortTasks(parseTasks(notes), today).filter((t) => !t.done);
  const owners = [...new Set(tasks.map((t) => t.owner).filter((o): o is string => !!o))].sort();
  const shown = S.taskOwner ? tasks.filter((t) => t.owner === S.taskOwner) : tasks;
  const byNote = new Map<string, typeof tasks>();
  for (const t of shown) byNote.set(t.path, [...(byNote.get(t.path) ?? []), t]);
  const meetings = notes.filter((n) => isMeeting(n.content)).map((n) => parseMeeting(n.path, n.content)).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
  const projs = projects();
  const decs = decisions(notes);
  const ppl = people(notes);
  const rems = reminders(notes);
  const taskRow = (t: typeof tasks[number]) => `<label class="task-row ${isOverdue(t, today) ? "overdue" : ""}"><input type="checkbox" name="taskdone" data-path="${esc(t.path)}" data-line="${t.line}"><span class="md inline">${renderMd(t.text, t.path)}</span>${t.due ? `<span class="pill ${isOverdue(t, today) ? "low" : ""}">${icon("calendar")}${esc(t.due)}</span>` : ""}</label>`;
  return `<section class="main" style="overflow:auto"><div class="page">
    <div class="stats">
      <div class="stat"><div class="label">Open tasks</div><div class="num">${tasks.length}</div><div class="small muted">${tasks.filter((t) => isOverdue(t, today)).length} overdue</div></div>
      <div class="stat"><div class="label">Projects</div><div class="num">${projs.filter((p) => p.status !== "done").length}</div><div class="small muted">${projs.length} in all</div></div>
      <div class="stat"><div class="label">Meetings this week</div><div class="num">${meetings.filter((m) => (m.date ?? "") >= dayKey(weekAgo)).length}</div><div class="small muted">${meetings.length} in all</div></div>
      <div class="stat"><div class="label">Reminders</div><div class="num">${rems.filter((r) => r.at.getTime() <= Date.now() + 86_400_000).length}</div><div class="small muted">due within a day</div></div>
    </div>
    <div class="row tight nudge"><button type="button" class="btn btn-primary" data-action="new-meeting">${icon("calendar")}New meeting</button><label class="btn">${icon("upload")}Import .ics<input type="file" name="ics" accept=".ics,text/calendar" multiple hidden></label><button type="button" class="btn" data-action="weekly-review">${icon("history")}Weekly review</button><button type="button" class="btn" data-action="new-from-template">${icon("template")}New from template</button><button type="button" class="btn btn-ghost" data-action="quick-capture" title="${MOD}⇧N">${icon("plus")}Quick capture</button></div>
    <div class="card band">
      <h2>${icon("check")} Tasks <span class="count">${shown.length}</span></h2>
      <p class="muted small">Every open <code>- [ ]</code> across the space. Dates as <code>📅 2026-10-14</code>, owners as <code>@name</code>, priority with ⏫ or 🔼. Overdue first.</p>
      ${owners.length ? `<div class="row tight"><button type="button" class="tag-chip ${S.taskOwner ? "" : "active"}" data-action="task-owner" data-owner="">Everyone</button>${owners.map((o) => `<button type="button" class="tag-chip ${S.taskOwner === o ? "active" : ""}" data-action="task-owner" data-owner="${esc(o)}">@${esc(o)}</button>`).join("")}</div>` : ""}
      ${byNote.size ? [...byNote.entries()].map(([p, ts]) => `<div class="band-title"><a href="#" data-action="open" data-path="${esc(p)}">${esc(title(p))}</a></div>${ts.map(taskRow).join("")}`).join("") : `<p class="small muted">Nothing open. Add <code>- [ ] something 📅 ${dayKey(today)}</code> to any note.</p>`}
    </div>
    <div class="card band">
      <h2>${icon("board")} Projects <span class="count">${projs.length}</span></h2>
      <p class="muted small">A note with <code>type: project</code> (and <code>status:</code>, <code>goal:</code>, a <code>## Milestones</code> list) marks its folder as a project; progress comes from the tasks in that folder.</p>
      ${projs.length ? `<div class="runs">${projs.map((p) => { const total = p.open + p.done; const pct = total ? Math.round((p.done / total) * 100) : 0; return `<div class="run"><span><b><a href="#" data-action="open" data-path="${esc(p.path)}">${esc(p.name)}</a></b> <span class="pill ${p.status === "done" ? "ok" : p.status === "blocked" ? "low" : ""}">${esc(p.status)}</span>${p.goal ? `<br><span class="small muted">${esc(p.goal)}</span>` : ""}${p.milestones.length ? `<br><span class="small">${p.milestones.map((m) => `${m.done ? "☑" : "☐"} ${esc(m.text)}`).join(" · ")}</span>` : ""}</span><span class="small muted" style="min-width:160px;text-align:right">${p.done}/${total} tasks <span class="meter inline"><i style="width:${pct}%"></i></span></span></div>`; }).join("")}</div>` : `<p class="small muted">No projects yet. New from template → Project.</p>`}
    </div>
    <div class="card band">
      <h2>${icon("calendar")} Meetings <span class="count">${meetings.length}</span></h2>
      ${meetings.length ? `<div class="runs">${meetings.slice(0, 20).map((m) => `<div class="run"><span><b><a href="#" data-action="open" data-path="${esc(m.path)}">${esc(m.title)}</a></b> <span class="small muted">${esc(m.date ?? "")}${m.attendees.length ? ` · ${m.attendees.map((a) => `@${esc(a)}`).join(" ")}` : ""} · ${m.decisions.filter(Boolean).length} decision${m.decisions.filter(Boolean).length === 1 ? "" : "s"}, ${actionCards(m).length} action${actionCards(m).length === 1 ? "" : "s"}</span></span><span class="row tight"><button type="button" class="btn btn-ghost" data-action="follow-up" data-path="${esc(m.path)}" title="Copy or mail the decisions and actions">${icon("mail")}Follow-up</button><button type="button" class="btn btn-ghost" data-action="actions-to-board" data-path="${esc(m.path)}" title="Add the action items to a kanban board">${icon("board")}To board</button></span></div>`).join("")}</div>` : `<p class="small muted">No meeting notes yet. New meeting, or import an .ics invite.</p>`}
    </div>
    <div class="card band">
      <h2>${icon("check")} Decisions <span class="count">${decs.length}</span></h2>
      <p class="muted small">Every <code>Decision:: …</code> line and the Decisions section of meeting notes, newest first.</p>
      ${decs.length ? `<div class="runs">${decs.slice(0, 50).map((d) => `<div class="run"><span>${esc(d.text)}</span><span class="small muted">${esc(d.date ?? "")} · <a href="#" data-action="open" data-path="${esc(d.path)}">${esc(title(d.path))}</a></span></div>`).join("")}</div>` : `<p class="small muted">None recorded.</p>`}
    </div>
    <div class="card band">
      <h2>${icon("person")} People <span class="count">${ppl.length}</span></h2>
      <p class="muted small">Everyone mentioned as <code>@name</code>, with their person note (<code>type: person</code>) when there is one.</p>
      ${ppl.length ? `<div class="runs">${ppl.slice(0, 40).map((p) => `<div class="run"><span><b>${p.path ? `<a href="#" data-action="open" data-path="${esc(p.path)}">${esc(p.name)}</a>` : esc(p.name)}</b> <span class="small muted">${[p.role, p.team].filter((x): x is string => !!x).map(esc).join(" · ")}</span></span><span class="row tight"><span class="small muted">${p.mentions.length} mention${p.mentions.length === 1 ? "" : "s"}</span>${p.path ? "" : `<button type="button" class="btn btn-ghost" data-action="new-person" data-name="${esc(p.name)}">${icon("plus")}Person note</button>`}</span></div>`).join("")}</div>` : `<p class="small muted">Nobody mentioned yet.</p>`}
    </div>
    <div class="card band">
      <h2>${icon("bell")} Reminders <span class="count">${rems.length}</span></h2>
      <p class="muted small">A <code>remind: 2026-10-14 09:00</code> property fires a notification while the app is open and badges the Work icon.</p>
      ${rems.length ? `<div class="runs">${rems.map((r) => `<div class="run"><span><a href="#" data-action="open" data-path="${esc(r.path)}">${esc(r.text)}</a></span><span class="small ${r.at.getTime() <= Date.now() ? "danger" : "muted"}">${r.at.toLocaleString()}</span></div>`).join("")}</div>` : `<p class="small muted">None set.</p>`}
      ${"Notification" in window && Notification.permission === "default" ? `<button type="button" class="btn btn-ghost" data-action="notify-allow">${icon("bell")}Allow notifications</button>` : ""}
    </div>
  </div></section>`;
}
async function newMeeting(ev?: { summary: string; start: string; attendees: string[]; description: string }) {
  const date = ev?.start || dayKey(new Date());
  const name = ev?.summary ?? (await ask({ title: "New meeting", label: "Title", placeholder: "Roadmap review", ok: "Create" }));
  if (!name?.trim()) return;
  const path = `Meetings/${date} ${name.trim().replace(/[#^[\]|\\/:]/g, " ")}.md`;
  if (note(path)) return ev ? undefined : open(path);
  const agenda = ev?.description ? ev.description.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8) : [];
  await newNote(path, "Meetings", undefined, MEETING_TEMPLATE(name.trim(), date, ev?.attendees.map((a) => a.replace(/\s+/g, "").replace(/@.*/, "")) ?? [], agenda));
}
async function importIcs(files: FileList) {
  let made = 0;
  for (const f of files) for (const ev of parseIcs(await f.text())) { await newMeeting(ev); made++; }
  toast(`${made} meeting note${made === 1 ? "" : "s"} created under Meetings/.`, "ok");
}
function followUp(path: string, el: HTMLElement) {
  const m = parseMeeting(path, draftOf(path).text);
  const text = meetingSummary(m);
  const r = el.getBoundingClientRect();
  contextMenu(r.left, r.bottom + 4, "Follow-up", [
    { label: "Copy for Slack or chat", icon: "copy", action: () => void copy(text).then(() => toast("Summary copied.", "ok")) },
    { label: "Mail the attendees", icon: "mail", action: () => { location.href = `mailto:${encodeURIComponent(m.attendees.filter((a) => a.includes("@")).join(","))}?subject=${encodeURIComponent(`${m.title}: decisions and actions`)}&body=${encodeURIComponent(text)}`; } },
    { label: "Add actions to a board", icon: "board", action: () => void actionsToBoard(path) },
  ]);
}
async function actionsToBoard(path: string) {
  const cards = actionCards(parseMeeting(path, draftOf(path).text));
  if (!cards.length) return toast("No action items in this meeting note.", "info");
  const boards = paths().filter((p) => p.endsWith(".md") && isKanban(draftOf(p).text));
  const target = boards.length ? await ask({ title: "Which board?", label: "Board", choices: [...boards.map((b) => ({ value: b, label: title(b) })), { value: "__new__", label: "New board: Actions" }], ok: "Add" }) : "__new__";
  if (target === null) return;
  const board = target === "__new__" ? "Actions.md" : target;
  if (!note(board)) await newNote(board, "", undefined, NEW_BOARD.replace("- [ ] First task", cards.join("\n")));
  else updateBoard(board, (b) => { const lane = b.lanes[0]; for (const c of cards) lane.cards.push({ text: c.replace(/^- \[ \] /, ""), done: false }); });
  toast(`${cards.length} action${cards.length === 1 ? "" : "s"} on ${title(board)}.`, "ok");
}
function downloadBytes(name: string, bytes: Uint8Array | string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/** The home-screen shortcut: the last notebook you were in (or the first), then a blank Inbox note. */
async function captureRoute() {
  if (!S.identity) { location.hash = "#/"; return; }
  if (!S.notebooks) await loadNotebooks();
  const last = store("nb-last")?.match(/^#\/notebook\/([a-z0-9-]+)/)?.[1];
  const id = (last && S.notebooks?.some((v) => v.canister.toText() === last) ? last : S.notebooks?.[0]?.canister.toText());
  if (!id) { location.hash = "#/"; return; }
  if (S.notebook?.canister.toText() !== id) await openNotebook(id);
  await quickCapture();
}
async function quickCapture() {
  const d = new Date();
  const p = `Inbox/${dayKey(d)} ${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}.md`;
  await newNote(p, "Inbox", undefined, "");
  const pn = pane(); pn.view = "edit"; render();
}
const dismissed = () => new Set(JSON.parse(store("nb-rem-done") ?? "[]") as string[]);
function checkReminders() {
  if (!S.notes) return;
  const done = dismissed();
  for (const r of reminders(workNotes())) {
    const key = `${r.path}@${r.at.getTime()}`;
    if (r.at.getTime() > Date.now() || done.has(key)) continue;
    done.add(key);
    store("nb-rem-done", JSON.stringify([...done].slice(-200)));
    toast(`Reminder: ${r.text}`, "info");
    if ("Notification" in window && Notification.permission === "granted") new Notification(r.text, { body: r.path });
  }
}
setInterval(checkReminders, 60_000);

// --- the Study tab: due cards, attempts, glossary, sources, goals, stats, export

function studyTab(): string {
  const today = new Date();
  const decks = deckPaths().map((p) => ({ path: p, due: dueCount(p, note(p)!.content), total: parseCards(note(p)!.content).length, stats: S.settings.deckStats[p] }));
  const quizzes = (S.notes ?? []).filter((n) => n.path.endsWith(".md") && quizKind(n.content) === "choice").map((n) => n.path);
  const g = glossary(S.notes ?? []);
  const src = sources(S.notes ?? []);
  const week: string[] = []; for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(today.getDate() - i); week.push(dayKey(d)); }
  const created = countByDay((S.notes ?? []).filter((n) => n.path.endsWith(".md") && !n.agent).map((n) => n.created));
  const notesWeek = goalProgress(created, week, S.settings.goals.notesPerWeek ?? 0);
  const cardsToday = goalProgress(new Map(Object.entries(S.settings.study)), [dayKey(today)], S.settings.goals.cardsPerDay ?? 0);
  const st = streak(today, new Map([...created].map(([k, v]) => [k, v + (S.settings.study[k] ?? 0)])));
  const byQuiz = new Map<string, Attempt[]>();
  for (const a of S.attempts) byQuiz.set(a.path, [...(byQuiz.get(a.path) ?? []), a]);
  return `<section class="main" style="overflow:auto"><div class="page">
    ${copilotCard("study", [{ a: "cards", icon: "check", label: "Flashcards from a folder", hint: "Twelve Front::Back cards, saved as a deck" }, { a: "quiz", icon: "help", label: "Quiz me on a folder", hint: "Ten questions, easy to hard, with answers" }])}
    <div class="stats">
      <div class="stat"><div class="label">Due today</div><div class="num ${dueTotal() ? "accent" : ""}">${dueTotal()}</div><div class="small muted">cards across ${decks.length} deck${decks.length === 1 ? "" : "s"}</div></div>
      <div class="stat"><div class="label">Reviewed today</div><div class="num">${S.settings.study[dayKey(today)] ?? 0}</div><div class="small muted">${S.settings.goals.cardsPerDay ? `goal ${S.settings.goals.cardsPerDay} a day` : "no daily goal yet"}</div></div>
      <div class="stat"><div class="label">Notes this week</div><div class="num">${notesWeek.done}</div><div class="small muted">${S.settings.goals.notesPerWeek ? `goal ${S.settings.goals.notesPerWeek} a week` : "no weekly goal yet"}</div></div>
      <div class="stat"><div class="label">Streak</div><div class="num">${st}</div><div class="small muted">day${st === 1 ? "" : "s"} with notes or reviews</div></div>
    </div>
    <div class="card band">
      <h2>${icon("check")} Due today</h2>
      ${decks.length ? `<div class="runs">${decks.map((d) => `<div class="run"><span><b>${esc(title(d.path))}</b> <span class="small muted">${d.due} due of ${d.total}${d.stats?.reviews ? ` · ${Math.round((d.stats.good / d.stats.reviews) * 100)}% got it` : ""}</span></span><span class="row tight"><button type="button" class="btn ${d.due ? "btn-primary" : ""}" data-action="open" data-path="${esc(d.path)}">${icon(d.due ? "check" : "eye")}${d.due ? "Review" : "Study anyway"}</button><button type="button" class="btn btn-ghost icon-btn" data-action="anki" data-path="${esc(d.path)}" title="Export for Anki" aria-label="Export for Anki">${icon("download")}</button></span></div>`).join("")}</div>` : `<p class="small muted">No flashcard decks yet. Make one from the command palette, or open any note and choose "Make flashcards" from its menu.</p>`}
      ${quizzes.length ? `<div class="band-title">Quizzes</div><div class="runs">${quizzes.map((q) => `<div class="run"><span><b>${esc(title(q))}</b> <span class="small muted">${parseChoice(note(q)!.content).length} questions${byQuiz.get(q)?.length ? ` · ${byQuiz.get(q)!.length} attempt${byQuiz.get(q)!.length === 1 ? "" : "s"} by others` : ""}</span></span><button type="button" class="btn" data-action="open" data-path="${esc(q)}">${icon("list")}Take it</button></div>`).join("")}</div>` : ""}
    </div>
    ${S.attempts.length ? `<div class="card band"><h2>${icon("bot")} Attempts on your shared quizzes</h2><p class="muted small">People you shared a quiz or deck with, and how they did. Newest first.</p><div class="runs">${S.attempts.slice(0, 50).map((a) => `<div class="run"><span><b>${esc(title(a.path))}</b> <span class="small muted">${shortPrincipal(a.who.toText())}</span></span><span class="small muted">${when(a.at)}</span><span class="pill ${a.score * 2 >= a.total ? "ok" : "low"}">${a.score}/${a.total}</span></div>`).join("")}</div></div>` : ""}
    <form class="card band" data-form="goals">
      <h2>${icon("star")} Goals</h2>
      <p class="muted small">The activity grid on the spaces page shades each day against your goal once one is set.</p>
      <div class="row tight"><label class="field"><span class="label">Notes a week</span><input class="input" name="notesPerWeek" type="number" min="0" value="${S.settings.goals.notesPerWeek ?? ""}" placeholder="3" style="max-width:120px"></label><label class="field"><span class="label">Cards a day</span><input class="input" name="cardsPerDay" type="number" min="0" value="${S.settings.goals.cardsPerDay ?? ""}" placeholder="20" style="max-width:120px"></label><button type="submit" class="btn btn-primary" style="align-self:flex-end">Save goals</button></div>
      ${S.settings.goals.notesPerWeek || S.settings.goals.cardsPerDay ? `<div class="row tight nudge">${S.settings.goals.notesPerWeek ? `<span class="small">Notes: ${notesWeek.done}/${notesWeek.goal} this week <span class="meter inline"><i style="width:${Math.round(notesWeek.ratio * 100)}%"></i></span></span>` : ""}${S.settings.goals.cardsPerDay ? `<span class="small">Cards: ${cardsToday.done}/${cardsToday.goal} today <span class="meter inline"><i style="width:${Math.round(cardsToday.ratio * 100)}%"></i></span></span>` : ""}</div>` : ""}
    </form>
    <div class="card band">
      <h2>${icon("type")} Glossary <span class="count">${g.length}</span></h2>
      <p class="muted small">Every <code>Term:: definition</code> line in your notes. Terms are underlined in reading view; hover for the definition.</p>
      ${g.length ? `<dl class="glossary">${g.map((e) => `<div class="gl-row"><dt>${esc(e.term)}</dt><dd>${esc(e.definition)} <a href="#" class="small muted" data-action="open" data-path="${esc(e.path)}">${esc(title(e.path))}</a></dd></div>`).join("")}</dl>` : `<p class="small muted">Nothing defined yet.</p>`}
    </div>
    <div class="card band">
      <h2>${icon("link")} Sources <span class="count">${src.length}</span></h2>
      <p class="muted small">From <code>source:</code> in each note's properties. "Cite source" in a note's menu adds a footnote with it.</p>
      ${src.length ? `<div class="runs">${src.map((x) => `<div class="run"><span><b>${/^https?:\/\//.test(x.source) ? `<a href="${esc(x.source)}" target="_blank" rel="noopener">${esc(x.source)}</a>` : esc(x.source)}</b></span><span class="small">${x.notes.map((n) => `<a href="#" data-action="open" data-path="${esc(n)}">${esc(title(n))}</a>`).join(", ")}</span></div>`).join("")}</div>` : `<p class="small muted">No sources yet.</p>`}
    </div>
  </div></section>`;
}
async function loadAttempts() {
  try { const r = await nb().all_attempts(); if (r.__kind__ === "Ok") S.attempts = r.Ok; } catch { /* none */ }
  if (S.tab === "study") render();
}

/** Notes made from a note: flashcards beside it, summaries and questions under Study/. */
async function studyNote(kind: "cards" | "summary" | "explain" | "questions", path: string) {
  const n = note(path);
  if (!n) return;
  const text = draftOf(path).text;
  const t = title(path);
  const target = kind === "cards" ? `${dir(path) ? `${dir(path)}/` : ""}${t} (cards).md` : `Study/${t} ${kind === "summary" ? "summary" : kind === "explain" ? "explained" : "questions"}.md`;
  const content = kind === "cards" ? cardsFromNote(text, t) : kind === "summary" ? summarise(text, t) : kind === "explain" ? explain(text, t) : `---\nsource: [[${t}]]\n---\n\n# ${t}: check yourself\n\n${questionsFor(text).map((q) => `- [ ] ${q}`).join("\n")}\n`;
  if (note(target) && (await ask({ title: `Replace “${title(target)}”?`, body: "It exists already; its content will be overwritten.", ok: "Replace" })) === null) return;
  if (note(target)) { onDraftInput(target, content); await save(target); await open(target); }
  else await newNote(target, dir(target), undefined, content);
  toast(kind === "cards" ? "Deck made; edit the cards as you like." : "Written; it is an extract until a model is connected, so rewrite it in your words.", "ok");
}
async function citeSource(path: string) {
  let text = draftOf(path).text;
  if (!frontmatter(text).data.source) {
    const src = await ask({ title: "Source for this note", label: "URL, book, lecture…", placeholder: "https://… or Author, Title (year)", ok: "Add" });
    if (!src?.trim()) return;
    text = setFrontmatter(text, { ...frontmatter(text).data, source: src.trim() });
  }
  onDraftInput(path, cite(text));
  toast("Footnote added at the end of the note.", "ok");
}

// --- Jupyter notebooks: cells, outputs, Python in a worker

// --- spreadsheets: a grid of inputs; values are patched in place so typing never loses focus
const sheetTab = new Map<string, number>(); // path -> active sheet index
const wbOf = (path: string): Workbook => parseWorkbook(draftOf(path).text);
function sheetHtml(path: string, text: string): string {
  const wb = parseWorkbook(text);
  const si = Math.min(sheetTab.get(path) ?? 0, wb.sheets.length - 1);
  const sh = wb.sheets[si];
  const vals = evaluate(wb).get(sh.name) ?? [];
  const nrows = Math.max(sh.rows.length + 5, 25);
  const ncols = Math.max(...sh.rows.map((r) => r.length), 0) + 2 > 8 ? Math.max(...sh.rows.map((r) => r.length)) + 2 : 8;
  const ro = S.mobile;
  const cell = (r: number, c: number) => {
    const raw = sh.rows[r]?.[c] ?? "";
    const v = vals[r]?.[c] ?? null;
    const f = cellText(raw, v);
    return `<td><input class="cell ${typeof v === "number" ? "num" : ""} ${f.startsWith("#") && raw.startsWith("=") ? "err" : ""} ${raw.startsWith("=") ? "fx" : ""}" name="cell" data-path="${esc(path)}" data-s="${si}" data-r="${r}" data-c="${c}" data-raw="${esc(raw)}" value="${esc(f)}" title="${raw.startsWith("=") ? esc(raw) : ""}" aria-label="${colName(c)}${r + 1}" autocomplete="off" spellcheck="false" ${ro ? "readonly" : ""}></td>`;
  };
  // each column as wide as its longest entry (10 to 40 characters), so labels are not cut off
  const width = (c: number) => Math.min(40, Math.max(10, ...sh.rows.map((row, r) => [...cellText(row[c] ?? "", vals[r]?.[c] ?? null)].length + 2)));
  const widths = Array.from({ length: ncols }, (_, c) => width(c));
  const cols = `<colgroup><col style="width:44px">${widths.map((w) => `<col style="width:${w}ch">`).join("")}</colgroup>`;
  const head = `<tr><th class="rn"></th>${Array.from({ length: ncols }, (_, c) => `<th>${colName(c)}</th>`).join("")}</tr>`;
  const body = Array.from({ length: nrows }, (_, r) => `<tr><th class="rn">${r + 1}</th>${Array.from({ length: ncols }, (_, c) => cell(r, c)).join("")}</tr>`).join("");
  const charts = sh.charts.map((ch) => `<figure class="sheet-chart" data-chart="${esc(ch.id)}">${chartSvg(vals, ch)}${ro ? "" : `<span class="chart-tools"><button type="button" class="btn btn-ghost icon-btn" data-action="sheet-chart-edit" data-path="${esc(path)}" data-id="${esc(ch.id)}" title="Edit chart" aria-label="Edit chart">${icon("edit")}</button><button type="button" class="btn btn-ghost icon-btn" data-action="sheet-chart-del" data-path="${esc(path)}" data-id="${esc(ch.id)}" title="Remove chart" aria-label="Remove chart">${icon("x")}</button></span>`}</figure>`).join("");
  return `<div class="sheet-tabs">${wb.sheets.map((x, i) => `<button type="button" class="stab ${i === si ? "on" : ""}" data-action="sheet-tab" data-path="${esc(path)}" data-i="${i}" title="${i === si ? "Click to rename" : x.name}">${esc(x.name)}${ro || wb.sheets.length < 2 ? "" : `<span class="stab-x" data-action="sheet-del" data-path="${esc(path)}" data-i="${i}" title="Delete sheet">${icon("x")}</span>`}</button>`).join("")}${ro ? "" : `<button type="button" class="stab add" data-action="sheet-add" data-path="${esc(path)}" title="Add a sheet">${icon("plus")}</button>`}</div>
    <div class="grid-wrap"><table class="grid" data-grid style="table-layout:fixed;width:calc(${widths.reduce((a, b) => a + b, 0)}ch + 44px)">${cols}<thead>${head}</thead><tbody>${body}</tbody></table>${ro ? "" : `<button type="button" class="btn btn-ghost more-rows" data-action="sheet-rows" data-path="${esc(path)}">${icon("plus")}20 rows</button>`}</div>
    ${charts ? `<div class="sheet-charts">${charts}</div>` : ""}`;
}
function refreshSheet(path: string) {
  document.querySelectorAll<HTMLElement>(`.shx[data-sheet="${CSS.escape(path)}"]`).forEach((h) => { h.innerHTML = sheetHtml(path, draftOf(path).text); afterRender(h); });
}
/** Recompute and patch every visible cell and chart without rebuilding the grid (keeps focus and caret). */
function syncSheet(path: string) {
  const wb = wbOf(path);
  const all = evaluate(wb);
  document.querySelectorAll<HTMLElement>(`.shx[data-sheet="${CSS.escape(path)}"]`).forEach((h) => {
    const si = Math.min(sheetTab.get(path) ?? 0, wb.sheets.length - 1);
    const sh = wb.sheets[si];
    const vals = all.get(sh.name) ?? [];
    h.querySelectorAll<HTMLInputElement>("input[name=cell]").forEach((inp) => {
      const r = Number(inp.dataset.r), c = Number(inp.dataset.c);
      const raw = sh.rows[r]?.[c] ?? "";
      const v = vals[r]?.[c] ?? null;
      const f = cellText(raw, v);
      inp.dataset.raw = raw;
      inp.title = raw.startsWith("=") ? raw : "";
      inp.classList.toggle("num", typeof v === "number");
      inp.classList.toggle("fx", raw.startsWith("="));
      inp.classList.toggle("err", f.startsWith("#") && raw.startsWith("="));
      if (document.activeElement !== inp) inp.value = f;
    });
    h.querySelectorAll<HTMLElement>(".sheet-chart").forEach((fig) => { const ch = sh.charts.find((x) => x.id === fig.dataset.chart); const svg = fig.querySelector("svg"); if (ch && svg) svg.outerHTML = chartSvg(vals, ch); });
  });
}
function updateWorkbook(path: string, f: (wb: Workbook) => void, rebuild = false) {
  const wb = wbOf(path);
  f(wb);
  onDraftInput(path, serializeWorkbook(wb));
  if (rebuild) refreshSheet(path); else syncSheet(path);
  refreshDashes();
}
function commitCell(inp: HTMLInputElement) {
  const v = inp.value;
  if (v === inp.dataset.raw) return;
  const p = inp.dataset.path!, si = Number(inp.dataset.s), r = Number(inp.dataset.r), c = Number(inp.dataset.c);
  updateWorkbook(p, (wb) => { const sh = wb.sheets[si]; while (sh.rows.length <= r) sh.rows.push([]); while (sh.rows[r].length <= c) sh.rows[r].push(""); sh.rows[r][c] = v; });
  void save(p);
}
const cellAt = (inp: HTMLInputElement, dr: number, dc: number) => inp.closest("table")?.querySelector<HTMLInputElement>(`input[name=cell][data-r="${Number(inp.dataset.r) + dr}"][data-c="${Number(inp.dataset.c) + dc}"]`);
/** What a cell shows: a formula's result, or what was typed (so 4% stays 4%, not 0.04). */
const cellText = (raw: string, v: Value) => (raw.startsWith("=") ? fmt(v) : raw);
function newSheetNote(folder?: string) {
  const where = folder ?? (cur() ? dir(cur()!) : "");
  const have = new Set(paths());
  let name = "Sheet";
  for (let i = 1; have.has(`${where ? `${where}/` : ""}${name}.sheet`); i++) name = `Sheet ${i}`;
  return newNote(`${where ? `${where}/` : ""}${name}.sheet`, where, undefined, NEW_WORKBOOK);
}
/** Every `.sheet` note's computed values as CSV, by name and by path, for `sheet("Name")` in Python. */
function sheetsForPython(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const n of S.notes ?? []) {
    if (!isSheetPath(n.path)) continue;
    const wb = parseWorkbook(S.drafts.get(n.path)?.text ?? n.content);
    const all = evaluate(wb);
    const tabs: Record<string, string> = {};
    for (const sh of wb.sheets) tabs[sh.name] = sheetCsv(all.get(sh.name) ?? []);
    out[stem(n.path)] = tabs;
    out[n.path] = tabs;
  }
  return out;
}
/** Rename a sheet and every `Name!A1` reference to it, on every sheet of the workbook. */
function renameSheet(path: string, i: number, name: string) {
  updateWorkbook(path, (wb) => {
    const old = wb.sheets[i].name;
    if (!name || wb.sheets.some((s, j) => j !== i && s.name.toLowerCase() === name.toLowerCase())) { toast("A sheet with that name exists.", "error"); return; }
    wb.sheets[i].name = name;
    const re = new RegExp(`(^|[^A-Za-z0-9_'])(?:'${old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'|${old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})!`, "gi");
    const quoted = /[^A-Za-z0-9_]/.test(name) ? `'${name}'` : name;
    for (const s of wb.sheets) s.rows = s.rows.map((r) => r.map((c) => (c.startsWith("=") ? c.replace(re, `$1${quoted}!`) : c)));
  }, true);
}
/** Add or edit a chart with a live preview: type, columns, palette or custom colours, legend, labels, stacking. */
function chartDialog(path: string, id?: string) {
  const wb = wbOf(path);
  const si = Math.min(sheetTab.get(path) ?? 0, wb.sheets.length - 1);
  const sh = wb.sheets[si];
  const vals = evaluate(wb).get(sh.name) ?? [];
  const ch: Chart = sh.charts.find((c) => c.id === id) ?? { id: "", type: "bar", title: "", labels: "A", values: ["B"] };
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const sel = (name: string, opts: [string, string][], v: string) => `<select class="input" name="${name}">${opts.map(([k, l]) => `<option value="${k}" ${k === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  scrim.innerHTML = `<form class="modal wide" role="dialog" aria-modal="true" aria-labelledby="ch-t">
    <h2 id="ch-t">${icon("graph")} ${id ? "Edit chart" : "Add a chart"}</h2>
    <div class="grid2">
      <label class="field"><span class="label">Type</span>${sel("type", [["bar", "Bars (several columns make groups)"], ["line", "Lines (one per column)"], ["area", "Area"], ["pie", "Pie (first value column)"]], ch.type)}</label>
      <label class="field"><span class="label">Title</span><input class="input" name="title" value="${esc(ch.title)}" placeholder="Optional"></label>
      <label class="field"><span class="label">Label column</span><input class="input" name="labels" value="${esc(ch.labels)}" placeholder="A"></label>
      <label class="field"><span class="label">Value columns, comma separated</span><input class="input" name="values" value="${esc(ch.values.join(", "))}" placeholder="B, C"></label>
      <label class="field"><span class="label">Palette</span>${sel("palette", Object.keys(PALETTES).map((k) => [k, k]), ch.palette ?? "default")}</label>
      <label class="field"><span class="label">Custom colours (hex, comma separated; beats the palette)</span><input class="input" name="colors" value="${esc((ch.colors ?? []).join(", "))}" placeholder="#4f8cff, #f0a742"></label>
      <label class="field"><span class="label">Legend</span>${sel("legend", [["auto", "Automatic"], ["right", "Right"], ["bottom", "Bottom"], ["none", "None"]], ch.legend ?? "auto")}</label>
      <label class="field"><span class="label">Axis titles (x, y)</span><div class="row tight"><input class="input" name="xLabel" value="${esc(ch.xLabel ?? "")}" placeholder="x"><input class="input" name="yLabel" value="${esc(ch.yLabel ?? "")}" placeholder="y"></div></label>
    </div>
    <div class="row tight nudge"><label class="switch"><input type="checkbox" name="showValues" ${ch.showValues ? "checked" : ""}> Show values</label><label class="switch"><input type="checkbox" name="stacked" ${ch.stacked ? "checked" : ""}> Stack series</label><label class="switch"><input type="checkbox" name="smooth" ${ch.smooth ? "checked" : ""}> Smooth lines</label></div>
    <div class="chart-preview nudge" data-preview></div>
    <div class="actions"><button type="button" class="btn" data-x="cancel">Cancel</button><button type="submit" class="btn btn-primary">${id ? "Save" : "Add"}</button></div>
  </form>`;
  const read = (): Chart => {
    const g = (n: string) => scrim.querySelector<HTMLInputElement | HTMLSelectElement>(`[name=${n}]`)!.value.trim();
    const on = (n: string) => scrim.querySelector<HTMLInputElement>(`[name=${n}]`)!.checked;
    const legend = g("legend");
    return { id: ch.id, type: g("type") as ChartType, title: g("title"), labels: (g("labels") || "A").toUpperCase(), values: g("values").split(/[,\s]+/).filter(Boolean).map((v) => v.toUpperCase()), palette: g("palette"), colors: g("colors").split(/[,\s]+/).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)), legend: legend === "auto" ? undefined : (legend as Chart["legend"]), xLabel: g("xLabel") || undefined, yLabel: g("yLabel") || undefined, showValues: on("showValues") || undefined, stacked: on("stacked") || undefined, smooth: on("smooth") || undefined };
  };
  const preview = () => { scrim.querySelector("[data-preview]")!.innerHTML = chartSvg(vals, read()); };
  preview();
  scrim.addEventListener("input", preview);
  const close = () => scrim.remove();
  scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
  scrim.querySelector("[data-x=cancel]")!.addEventListener("click", close);
  scrim.querySelector("form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const c = read();
    if (!c.values.length) return toast("Pick at least one value column.", "error");
    updateWorkbook(path, (w) => { const sheet = w.sheets[si]; if (id) { const i = sheet.charts.findIndex((x) => x.id === id); if (i >= 0) sheet.charts[i] = c; } else addChart(sheet, c); }, true);
    void save(path);
    close();
  });
  document.body.append(scrim);
  scrim.querySelector<HTMLElement>("[name=title]")?.focus();
}

// --- dashboards: `.dash` notes that mash up charts, cell values and Jupyter outputs from other notes
type Tile = { id: string; kind: "chart" | "kpi" | "cell" | "search"; source: string; q?: string; sheet?: string; chart?: string; ref?: string; cell?: string; label?: string; w?: 1 | 2 };
type Dash = { tiles: Tile[] };
const isDashPath = (p: string) => p.toLowerCase().endsWith(".dash");
const NEW_DASH = `{\n "tiles": []\n}\n`;
const parseDash = (json: string): Dash => { try { const d = JSON.parse(json) as Partial<Dash>; return { tiles: Array.isArray(d.tiles) ? d.tiles.filter((t) => t && typeof t.source === "string").map((t) => ({ ...t, id: t.id ?? Math.random().toString(36).slice(2, 8) })) : [] }; } catch { return { tiles: [] }; } };
const dashOf = (path: string) => parseDash(draftOf(path).text);
const noteText = (path: string): string | undefined => S.drafts.get(path)?.text ?? note(path)?.content;
function tileHtml(path: string, t: Tile): string {
  if (t.kind === "search") {
    const hits = runQuery(orgNotes(), t.q ?? "");
    const tools = S.mobile ? "" : `<span class="tile-tools"><button type="button" class="btn btn-ghost icon-btn" data-action="dash-width" data-path="${esc(path)}" data-id="${esc(t.id)}" aria-label="Toggle width">${icon("columns")}</button><button type="button" class="btn btn-ghost icon-btn" data-action="dash-del" data-path="${esc(path)}" data-id="${esc(t.id)}" aria-label="Remove tile">${icon("x")}</button></span>`;
    return `<section class="tile ${t.w === 2 ? "w2" : ""}" data-tile="${esc(t.id)}"><header class="tile-head"><b>${esc(t.label ?? t.q ?? "Search")}</b><a href="#" class="tile-src" data-action="org-open-q" data-q="${esc(t.q ?? "")}" title="Open in Organize">${icon("search")}${hits.length}</a>${tools}</header><div class="tile-body">${hits.length ? `<div class="runs">${hits.slice(0, 10).map((n) => `<div class="run"><a href="#" data-action="open" data-path="${esc(n.path)}">${esc(base(n.path))}</a><span class="small faint">${esc(dir(n.path))}</span></div>`).join("")}</div>${hits.length > 10 ? `<p class="small muted">and ${hits.length - 10} more</p>` : ""}` : `<div class="empty-side">No notes match.</div>`}</div></section>`;
  }
  const src = noteText(t.source);
  const link = `<a href="#" class="tile-src" data-action="open" data-path="${esc(t.source)}" title="Open ${esc(t.source)}">${icon("out")}${esc(stem(t.source))}</a>`;
  const tools = S.mobile ? "" : `<span class="tile-tools"><button type="button" class="btn btn-ghost icon-btn" data-action="dash-move" data-path="${esc(path)}" data-id="${esc(t.id)}" data-d="-1" title="Move earlier" aria-label="Move earlier">${icon("chevron")}</button><button type="button" class="btn btn-ghost icon-btn flip" data-action="dash-move" data-path="${esc(path)}" data-id="${esc(t.id)}" data-d="1" title="Move later" aria-label="Move later">${icon("chevron")}</button><button type="button" class="btn btn-ghost icon-btn" data-action="dash-width" data-path="${esc(path)}" data-id="${esc(t.id)}" title="${t.w === 2 ? "Half width" : "Full width"}" aria-label="Toggle width">${icon("columns")}</button><button type="button" class="btn btn-ghost icon-btn" data-action="dash-del" data-path="${esc(path)}" data-id="${esc(t.id)}" title="Remove tile" aria-label="Remove tile">${icon("x")}</button></span>`;
  let title = t.label ?? "", body = "";
  if (src === undefined) body = `<div class="empty-side">Source not found: ${esc(t.source)}</div>`;
  else if (t.kind === "cell") {
    const nb = parseNotebook(src);
    const c = nb.cells.find((x) => x.id === t.cell);
    title ||= c?.source.split("\n")[0]?.replace(/^#\s*/, "") ?? "Cell";
    body = c ? `<div class="nb-outputs">${c.outputs.filter((o) => o.kind !== "error").map(outputHtml).join("") || `<div class="empty-side">No output yet; run the cell.</div>`}</div>` : `<div class="empty-side">That cell is gone.</div>`;
  } else {
    const wb = parseWorkbook(src);
    const sh = wb.sheets.find((x) => x.name === t.sheet) ?? wb.sheets[0];
    const vals = evaluate(wb).get(sh.name) ?? [];
    if (t.kind === "kpi") {
      const r = parseRef(t.ref ?? "");
      const v = r ? vals[r.r]?.[r.c] ?? null : "#REF!";
      title ||= `${sh.name}!${t.ref ?? ""}`;
      body = `<div class="kpi ${typeof v === "string" && v.startsWith("#") ? "err" : ""}">${esc(fmt(v))}</div>`;
    } else {
      const ch = sh.charts.find((x) => x.id === t.chart);
      title ||= ch?.title || `${sh.name} chart`;
      body = ch ? chartSvg(vals, { ...ch, title: "" }) : `<div class="empty-side">That chart was removed from the sheet.</div>`;
    }
  }
  return `<section class="tile ${t.w === 2 ? "w2" : ""}" data-tile="${esc(t.id)}"><header class="tile-head"><b>${esc(title)}</b>${link}${tools}</header><div class="tile-body">${body}</div></section>`;
}
function dashHtml(path: string, text: string): string {
  const d = parseDash(text);
  return d.tiles.length ? d.tiles.map((t) => tileHtml(path, t)).join("") : `<div class="chat-empty"><h3>Empty dashboard</h3><p class="muted small">Add tiles: charts and cell values from spreadsheet notes, outputs from Python spaces. Each tile links back to its source.</p></div>`;
}
function refreshDashes() { document.querySelectorAll<HTMLElement>(".dsh[data-dash]").forEach((h) => { h.innerHTML = dashHtml(h.dataset.dash!, draftOf(h.dataset.dash!).text); afterRender(h); }); }
function updateDash(path: string, f: (d: Dash) => void) { const d = dashOf(path); f(d); onDraftInput(path, `${JSON.stringify(d, null, 1)}\n`); refreshDashes(); }
function newDashNote(folder?: string) {
  const where = folder ?? (cur() ? dir(cur()!) : "");
  const have = new Set(paths());
  let name = "Dashboard";
  for (let i = 1; have.has(`${where ? `${where}/` : ""}${name}.dash`); i++) name = `Dashboard ${i}`;
  return newNote(`${where ? `${where}/` : ""}${name}.dash`, where, undefined, NEW_DASH);
}
/** Pick a source note and what to show from it. */
function tileDialog(path: string) {
  const sources = (S.notes ?? []).filter((n) => isSheetPath(n.path) || isNotebookPath(n.path)).map((n) => n.path).sort();
  if (!sources.length) return toast("Make a spreadsheet or Python space first; tiles come from those.", "info");
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="tl-t">
    <h2 id="tl-t">${icon("graph")} Add a tile</h2>
    <label class="field"><span class="label">Source note</span><select class="input" name="source">${sources.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}</select></label>
    <label class="field nudge"><span class="label">What to show</span><select class="input" name="what"></select></label>
    <label class="field nudge" data-ref hidden><span class="label">Cell (like B4)</span><input class="input" name="ref" value="B2"></label>
    <label class="field nudge"><span class="label">Label (optional)</span><input class="input" name="label" placeholder="Uses the chart title"></label>
    <label class="switch nudge"><input type="checkbox" name="wide"> Full width</label>
    <div class="actions"><button type="button" class="btn" data-x="cancel">Cancel</button><button type="submit" class="btn btn-primary">Add</button></div>
  </form>`;
  const what = scrim.querySelector<HTMLSelectElement>("[name=what]")!;
  const fill = () => {
    const src = scrim.querySelector<HTMLSelectElement>("[name=source]")!.value;
    const text = noteText(src) ?? "";
    const opts: string[] = [];
    if (isSheetPath(src)) {
      const wb = parseWorkbook(text);
      for (const sh of wb.sheets) { for (const c of sh.charts) opts.push(`<option value="chart:${esc(sh.name)}:${esc(c.id)}">${esc(sh.name)} · ${esc(c.title || `${c.type} chart`)}</option>`); opts.push(`<option value="kpi:${esc(sh.name)}">${esc(sh.name)} · one cell's value</option>`); }
    } else {
      for (const c of parseNotebook(text).cells) if (c.type === "code" && c.outputs.some((o) => o.kind === "image" || o.kind === "html")) opts.push(`<option value="cell:${esc(c.id)}">${esc(c.source.split("\n")[0].slice(0, 60) || "code cell")}</option>`);
      if (!opts.length) opts.push(`<option value="" disabled selected>No cell has an image or table output yet</option>`);
    }
    what.innerHTML = opts.join("");
    scrim.querySelector<HTMLElement>("[data-ref]")!.hidden = !what.value.startsWith("kpi:");
  };
  fill();
  scrim.querySelector("[name=source]")!.addEventListener("change", fill);
  what.addEventListener("change", () => { scrim.querySelector<HTMLElement>("[data-ref]")!.hidden = !what.value.startsWith("kpi:"); });
  const close = () => scrim.remove();
  scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
  scrim.querySelector("[data-x=cancel]")!.addEventListener("click", close);
  scrim.querySelector("form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const source = scrim.querySelector<HTMLSelectElement>("[name=source]")!.value;
    const v = what.value;
    if (!v) return toast("Nothing to show from that note yet.", "error");
    const [kind, a, b] = v.split(":");
    const label = scrim.querySelector<HTMLInputElement>("[name=label]")!.value.trim() || undefined;
    const w = scrim.querySelector<HTMLInputElement>("[name=wide]")!.checked ? 2 : 1;
    const t: Tile = kind === "chart" ? { id: "", kind: "chart", source, sheet: a, chart: b, label, w } : kind === "kpi" ? { id: "", kind: "kpi", source, sheet: a, ref: scrim.querySelector<HTMLInputElement>("[name=ref]")!.value.trim().toUpperCase(), label, w } : { id: "", kind: "cell", source, cell: a, label, w };
    t.id = Math.random().toString(36).slice(2, 8);
    updateDash(path, (d) => { d.tiles.push(t); });
    void save(path);
    close();
  });
  document.body.append(scrim);
}
async function importCsv(path: string, file: File) {
  const rows = parseCsv(await file.text());
  if (!rows.length) return toast("That CSV is empty.", "info");
  const name = file.name.replace(/\.csv$/i, "") || "Import";
  updateWorkbook(path, (wb) => { let n = name; for (let i = 2; wb.sheets.some((s) => s.name.toLowerCase() === n.toLowerCase()); i++) n = `${name} ${i}`; wb.sheets.push({ ...newSheet(n), rows }); sheetTab.set(path, wb.sheets.length - 1); }, true);
  void save(path);
  toast(`Imported ${rows.length} rows into a new sheet.`, "ok");
}
const nbEditing = new Map<string, Set<string>>(); // path -> markdown cells currently being edited
const nbRunning = new Set<string>(); // cell ids
function outputHtml(o: NbOutput): string {
  switch (o.kind) {
    case "text": return `<pre class="nb-out ${o.stream === "stderr" ? "err" : ""}">${esc(o.text)}</pre>`;
    case "error": return `<pre class="nb-out err"><b>${esc(o.name)}</b>: ${esc(o.value)}\n${esc(o.traceback)}</pre>`;
    case "image": return `<img class="nb-img" src="data:${esc(o.mime)};base64,${o.data}" alt="output">`;
    case "html": return `<div class="nb-html">${DOMPurify.sanitize(o.html)}</div>`;
  }
}
function notebookHtml(path: string, text: string): string {
  const nb = parseNotebook(text);
  const editing = nbEditing.get(path) ?? new Set<string>();
  const ro = S.mobile;
  const cell = (c: NbCell, i: number) => {
    const tools = ro ? "" : `<span class="nb-tools"><button type="button" class="btn btn-ghost icon-btn" data-action="nb-move" data-path="${esc(path)}" data-i="${i}" data-d="-1" title="Move up" aria-label="Move up">${icon("updown")}</button><button type="button" class="btn btn-ghost icon-btn" data-action="nb-type" data-path="${esc(path)}" data-i="${i}" title="${c.type === "code" ? "Make it a text cell" : "Make it a code cell"}" aria-label="Change cell type">${icon(c.type === "code" ? "file" : "command")}</button><button type="button" class="btn btn-ghost icon-btn" data-action="nb-add" data-path="${esc(path)}" data-i="${i}" data-type="code" title="Add a code cell below" aria-label="Add code cell">${icon("plus")}</button><button type="button" class="btn btn-ghost icon-btn" data-action="nb-del" data-path="${esc(path)}" data-i="${i}" title="Delete cell" aria-label="Delete cell">${icon("trash")}</button></span>`;
    if (c.type === "markdown") {
      return editing.has(c.id) || !c.source.trim()
        ? `<div class="nb-cell md-cell editing" data-cell="${esc(c.id)}"><div class="nb-gutter">md</div><div class="nb-body"><textarea class="nb-src" name="nbsrc" data-path="${esc(path)}" data-i="${i}" rows="${Math.max(2, c.source.split("\n").length)}" placeholder="Markdown…" ${ro ? "readonly" : ""}>${esc(c.source)}</textarea><div class="small muted">${ro ? "" : "Shift+Enter or click outside to render"}</div></div>${tools}</div>`
        : `<div class="nb-cell md-cell" data-cell="${esc(c.id)}" data-action="nb-edit-md" data-path="${esc(path)}" data-i="${i}" title="${ro ? "" : "Double-click to edit"}"><div class="nb-gutter">md</div><div class="nb-body md">${renderMd(c.source, path)}</div>${tools}</div>`;
    }
    const running = nbRunning.has(c.id);
    return `<div class="nb-cell code-cell ${running ? "running" : ""}" data-cell="${esc(c.id)}"><div class="nb-gutter">${ro ? "" : `<button type="button" class="btn btn-ghost icon-btn nb-run" data-action="nb-run" data-path="${esc(path)}" data-i="${i}" title="Run (Shift+Enter)" aria-label="Run cell">${icon(running ? "refresh" : "move")}</button>`}<span class="nb-count">[${running ? "*" : c.count ?? " "}]</span></div><div class="nb-body"><textarea class="nb-src code" name="nbsrc" data-path="${esc(path)}" data-i="${i}" rows="${Math.max(2, c.source.split("\n").length)}" spellcheck="false" placeholder="# python" ${ro ? "readonly" : ""}>${esc(c.source)}</textarea><div class="nb-outputs" data-outputs="${esc(c.id)}">${c.outputs.map(outputHtml).join("")}</div></div>${tools}</div>`;
  };
  return `${nb.cells.map(cell).join("")}${ro ? "" : `<div class="nb-addrow"><button type="button" class="btn btn-ghost" data-action="nb-add" data-path="${esc(path)}" data-i="${nb.cells.length - 1}" data-type="code">${icon("plus")}Code</button><button type="button" class="btn btn-ghost" data-action="nb-add" data-path="${esc(path)}" data-i="${nb.cells.length - 1}" data-type="markdown">${icon("plus")}Text</button></div>`}`;
}
function refreshNotebook(path: string) {
  document.querySelectorAll<HTMLElement>(`.nbk[data-ipynb="${CSS.escape(path)}"]`).forEach((h) => { h.innerHTML = notebookHtml(path, draftOf(path).text); afterRender(h); });
}
/** Change the parsed notebook and write it back as nbformat JSON. */
function updateNotebook(path: string, f: (nb: Nb) => void, rerender = true) {
  const nb = parseNotebook(draftOf(path).text);
  f(nb);
  onDraftInput(path, serializeNotebook(nb));
  if (rerender) refreshNotebook(path);
}
async function runCell(path: string, i: number) {
  const nb = parseNotebook(draftOf(path).text);
  const c = nb.cells[i];
  if (!c || c.type !== "code") return;
  nbRunning.add(c.id);
  updateNotebook(path, (n) => { n.cells[i].outputs = []; });
  document.querySelectorAll<HTMLElement>("[data-py-status]").forEach((e) => (e.textContent = pythonLoaded() ? "Running…" : "Loading Python (first run)…"));
  const live: NbOutput[] = [];
  const box = () => document.querySelector<HTMLElement>(`.nbk[data-ipynb="${CSS.escape(path)}"] [data-outputs="${CSS.escape(c.id)}"]`);
  const r = await runPython(c.source, (o) => { live.push(o); const b = box(); if (b) b.innerHTML = live.map(outputHtml).join(""); }, sheetsForPython());
  nbRunning.delete(c.id);
  updateNotebook(path, (n) => { const cell = n.cells.find((x) => x.id === c.id); if (cell) { cell.outputs = r.outputs; cell.count = Math.max(0, ...n.cells.map((x) => x.count ?? 0)) + 1; } });
  refreshDashes();
  document.querySelectorAll<HTMLElement>("[data-py-status]").forEach((e) => (e.textContent = r.error ? "Error in the last cell" : "Python ready"));
  return r;
}
function newPyNotebook(folder?: string) {
  const where = folder ?? (cur() ? dir(cur()!) : "");
  const have = new Set(paths());
  let name = "Space";
  for (let i = 1; have.has(`${where ? `${where}/` : ""}${name}.ipynb`); i++) name = `Space ${i}`;
  return newNote(`${where ? `${where}/` : ""}${name}.ipynb`, where, undefined, NEW_IPYNB);
}

// --- kanban boards

function boardHtml(path: string, text: string): string {
  const b = parseBoard(text);
  const lanes = b.lanes.map((l, li) => `<section class="kb-lane ${l.complete ? "complete" : ""}" data-lane="${li}">
      <div class="kb-head"><input class="kb-title" name="kbtitle" value="${esc(l.title)}" data-path="${esc(path)}" data-lane="${li}" aria-label="Lane name" spellcheck="false"><span class="cnt">${l.cards.length}</span><button type="button" class="btn btn-ghost icon-btn" data-action="kb-lane-menu" data-path="${esc(path)}" data-lane="${li}" aria-label="Lane actions">${icon("more")}</button></div>
      <div class="kb-cards" data-kb-drop data-lane="${li}">${l.cards.map((c, ci) => `<article class="kb-card ${c.done ? "done" : ""}" draggable="true" data-kb-card data-lane="${li}" data-idx="${ci}" data-path="${esc(path)}"><label class="kb-check"><input type="checkbox" name="kbdone" data-path="${esc(path)}" data-lane="${li}" data-idx="${ci}" ${c.done ? "checked" : ""} aria-label="Done"></label><div class="kb-text md">${renderMd(c.text, path)}</div><button type="button" class="btn btn-ghost icon-btn kb-del" data-action="kb-del" data-path="${esc(path)}" data-lane="${li}" data-idx="${ci}" aria-label="Delete card">${icon("x")}</button></article>`).join("")}</div>
      <form class="kb-add" data-form="kb-add" data-path="${esc(path)}" data-lane="${li}"><input class="input" name="kbnew" placeholder="+ Add a card" aria-label="New card" autocomplete="off"></form>
    </section>`).join("");
  return `${lanes}<button type="button" class="kb-new-lane" data-action="kb-add-lane" data-path="${esc(path)}">${icon("plus")}Add lane</button>`;
}
/** Change a board and write it back as markdown; every open view of the note follows. */
function updateBoard(path: string, f: (b: Board) => void) {
  const b = parseBoard(draftOf(path).text);
  f(b);
  onDraftInput(path, serializeBoard(b));
}
let kbDrag: { path: string; lane: number; idx: number } | undefined;
function newBoard(folder?: string) {
  const where = folder ?? (cur() ? dir(cur()!) : "");
  const have = new Set(paths());
  let name = "Board";
  for (let i = 1; have.has(`${where ? `${where}/` : ""}${name}.md`); i++) name = `Board ${i}`;
  return newNote(`${where ? `${where}/` : ""}${name}.md`, where, undefined, NEW_BOARD);
}

// --- workspace: chat tab

/** Folders a chat prompt may draw on: every folder (and the root) minus the ones switched off. */
function chatFolders(): Set<string> {
  const all = new Set<string>([""]);
  for (const f of S.folders) all.add(f);
  for (const p of paths()) { const d = dir(p); if (d) { all.add(d); let i = d.indexOf("/"); while (i > 0) { all.add(d.slice(0, i)); i = d.indexOf("/", i + 1); } } }
  for (const x of S.chat.excluded) all.delete(x);
  return all;
}
function chatHtml(): string {
  const msgs = S.chat.messages.length
    ? S.chat.messages.map((m, mi) => `<div class="msg ${m.role}">${m.role === "you" ? `<div class="bubble">${esc(m.text)}</div>` : `<div class="bubble md">${beyond(citeLinks(renderMd(m.text), m.picks ?? []))}${m.model ? `<div class="answer-tools"><button type="button" class="btn btn-ghost" data-action="chat-save" data-i="${mi}" title="Save this answer as a note, citations as links">${icon("plus")}Save as note</button>${m.deck ? `<button type="button" class="btn btn-ghost" data-action="chat-save-deck" data-i="${mi}" title="Save these cards as a flashcard deck">${icon("check")}Save as a deck</button>` : ""}${m.insertInto && note(m.insertInto) ? `<button type="button" class="btn btn-ghost" data-action="chat-insert" data-i="${mi}" title="Put this under a Summary heading in the note">${icon("edit")}Insert into “${esc(stem(m.insertInto))}”</button>` : ""}</div>` : ""}${m.model ? `<div class="answered-by small faint">${icon("bot")}${esc(LLM_LOCAL ? "Local Ollama (stand-in)" : modelName(m.model))}${m.cycles ? ` · ${tc(m.cycles)}` : ""}${m.fallback ? ` · ${esc(m.fallback)}` : ""}</div>` : m.fallback ? `<div class="answered-by small faint">${esc(m.fallback)}</div>` : ""}</div>${m.picks?.length ? `<div class="sources">${m.picks.map((p) => `<button type="button" class="src" data-action="open" data-path="${esc(p.path)}" title="${esc(p.why.join("; "))}">${icon("file")}${esc(title(p.path))}</button>`).join("")}</div>` : ""}`}</div>`).join("")
    : `<div class="chat-empty">${icon("chat")}<h3>Ask your notes</h3><p class="muted small">Type a question in plain language. The space picks the notes that look relevant from the folders ticked on the right and answers from them.</p></div>`;
  // with nothing asked yet, the notebook's notes glow behind as a sky of stars (click one to open it)
  const empty = !S.chat.messages.length && !S.chat.busy && !S.chat.garden && !S.chat.tidy;
  return `<section class="main chat ${empty ? "chat-quiet" : ""}" data-chat>
    ${empty ? `<canvas class="notes-sky" data-notes-sky aria-hidden="true"></canvas>` : ""}
    <div class="chat-log">${(S.chat.garden || S.chat.tidy) && !S.chat.messages.length ? "" : msgs}${gardenBubble()}${tidyBubble()}${S.chat.busy ? `<div class="msg notes"><div class="bubble muted thinking"><span class="spin"></span>${esc(S.chat.stage || "Reading your notes…")}</div></div>` : ""}</div>
    <form class="composer" data-form="chat"><div class="compose-box"><button type="button" class="btn btn-ghost icon-btn" data-action="notes-plus" title="Tools: the Gardener, and more to come" aria-label="Tools">${icon("plus")}</button><textarea name="chatq" rows="1" placeholder="Ask your notes…" title="↵ to send, ⇧↵ for a new line" aria-label="Ask your notes">${esc(S.chat.input)}</textarea><button type="submit" class="btn btn-ghost icon-btn send-btn" title="Send" aria-label="Send" ${S.chat.busy ? "disabled" : ""}>${icon("send")}</button></div>
      <div class="compose-foot"><span class="small muted">Asks ${chatFolders().size} of ${[...new Set([...chatFolders(), ...S.chat.excluded])].length} folders · ↵ to send</span><button type="button" class="btn btn-ghost model-pick" data-action="copilot-model" title="${LLM_LOCAL ? "Locally your Ollama answers whichever you pick." : esc(chatModel().note)}">${esc(chatModel().name)}<span class="tier t-${chatModel().tier.toLowerCase()}">${chatModel().tier}</span><span class="small muted">${chatModel().paid ? "≈0.11 TC" : "0.001 TC"}</span>${icon("down")}</button></div></form>
  </section>`;
}
function chatAside(): string {
  const on = chatFolders();
  const all = [...new Set([...chatFolders(), ...S.chat.excluded])].sort();
  const rows = all.map((f) => `<label class="switch chat-folder" style="--d:${f ? f.split("/").length : 0}"><input type="checkbox" name="chatfolder" value="${esc(f)}" ${on.has(f) ? "checked" : ""}>${icon(f === AGENT_ROOT ? "lock" : "folder")}${esc(f ? f.split("/").pop()! : "Top level")}</label>`).join("");
  const last = [...S.chat.messages].reverse().find((m) => m.picks?.length);
  return `<div class="pane-title">Folders to ask <span class="count">${on.size}/${all.length}</span></div>
    <div class="row tight" style="padding:0 8px"><button type="button" class="btn btn-ghost" data-action="chat-folders" data-all="1">Select all</button><button type="button" class="btn btn-ghost" data-action="chat-folders" data-all="0">None</button></div>
    <div class="chat-folders">${rows}</div>
    ${last ? `<div class="pane-title">Notes used last</div>${last.picks!.map((p) => `<div class="bl" data-action="open" data-path="${esc(p.path)}"><div class="t">${icon("file")}${esc(stem(p.path))}</div><div class="ctx">${esc(p.why.join(" · "))}</div></div>`).join("")}` : ""}
    <div class="pane-title">How it works</div><div class="empty-side">1. A quick System 1 pass in your browser scores every note in the ticked folders on title, tags and word overlap and keeps the best few. 2. Their excerpts go to the Internet Computer's LLM canister, which answers from them first and cites each claim with a number you can click; whatever the notes do not cover it answers from its own knowledge, labelled "Beyond your notes". Save any answer as a note in the folder you pick. Excerpts leave your space for the LLM workers, so keep secrets out of the ticked folders.</div>
    ${S.chat.messages.length ? `<div style="padding:8px"><button type="button" class="btn btn-ghost" data-action="chat-clear">${icon("trash")}Clear chat</button></div>` : ""}`;
}
/** The part the model answered from its own knowledge gets a visible label. */
const beyond = (html: string) => html.replace(/(<p>)?(<strong>)?Beyond your notes:?(<\/strong>)?:?/i, (_m, p?: string) => `${p ?? ""}<span class="beyond" title="Not from your notes: the model's own knowledge, so check it">${icon("globe")}Beyond your notes</span> `);
/** A chat answer as a note: citations become wiki links, the sources are listed, front matter says where it came from. */
async function saveAnswer(i: number) {
  const m = S.chat.messages[i];
  if (!m) return;
  const q = [...S.chat.messages.slice(0, i)].reverse().find((x) => x.role === "you")?.text ?? "Answer";
  const folders = ["", ...S.folders.filter((f) => f !== AGENT_ROOT && !f.startsWith(`${AGENT_ROOT}/`))];
  const folder = await ask({ title: "Save the answer as a note", label: "Folder", choices: folders.map((f) => ({ value: f, label: f || "Top level" })), value: store("nb-chat-save-folder") ?? "", ok: "Next" });
  if (folder === null) return;
  store("nb-chat-save-folder", folder);
  const suggested = q.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70) || "Answer";
  const name = await ask({ title: "Name the note", label: "Name", value: suggested, ok: "Save" });
  if (!name?.trim()) return;
  const picks = m.picks ?? [];
  const body = m.text.replace(CITE, (whole, ks: string) => { const links = ks.split(/\s*,\s*/).map((k) => picks[Number(k) - 1]).filter(Boolean).map((p) => `[[${stem(p.path)}]]`); return links.length ? ` (${links.join(", ")})` : whole; });
  const used = cited(m.text, picks.length).map((k) => picks[k - 1]);
  const oneLine = (t: string) => t.replace(/\s+/g, " ").trim();
  const content = `---\nsource: chat\nquestion: ${oneLine(q)}\nmodel: ${m.model ? (LLM_LOCAL ? "local Ollama" : m.model) : "notes only"}\ndate: ${new Date().toISOString().slice(0, 10)}\n---\n# ${name.trim()}\n\n> ${oneLine(q)}\n\n${body.trim()}\n${used.length ? `\n## Sources\n\n${used.map((p) => `- [[${stem(p.path)}]]`).join("\n")}\n` : ""}`;
  const path = `${folder ? `${folder}/` : ""}${name.trim()}.md`;
  if (note(path)) return toast("A note with that name is already in that folder.", "error");
  S.tab = "notes";
  await newNote(path, folder, undefined, content);
  toast(`Saved as ${path}.`, "ok");
}
/** Wrap each [n] the model wrote around a link to source n. */
function citeLinks(html: string, picks: Pick[]): string {
  if (!picks.length) return html;
  return html.replace(CITE, (m, ks: string) => { const parts = ks.split(/\s*,\s*/).map((k) => { const p = picks[Number(k) - 1]; if (p && !note(p.path)) return `<span class="cite" title="${esc(p.path)}">${k}</span>`; return p ? `<button type="button" class="cite" data-action="open" data-path="${esc(p.path)}" title="${esc(stem(p.path))}">${k}</button>` : ""; }); return parts.every(Boolean) ? parts.join("") : m; });
}
/** 1. System 1 picks the notes; 2. the LLM canister answers from their excerpts, citing them by number. */
// --- the gardener and the kit copilots: prepared questions through the same ask pipeline as the chat

const notesNow = () => (S.notes ?? []).map((n) => ({ ...n, content: S.drafts.get(n.path)?.text ?? n.content }));
const clipText = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);
/** Ask the notebook's model a prepared question; the answer lands in Chat with your notes. */
async function copilot(label: string, question: string, sources: { path: string; excerpt: string }[], o: { deck?: boolean; insertInto?: string } = {}) {
  if (!S.notebook || S.chat.busy) return;
  if (!featureOn("chat")) { S.settings.features.chat = true; void saveSettings(); }
  const chat = S.chat;
  S.tab = "chat";
  S.chat.messages.push({ role: "you", text: label });
  S.chat.busy = true;
  S.chat.stage = `Asking ${LLM_LOCAL ? "your local Ollama" : modelName(chatModel().id)}…`;
  render();
  const picks: Pick[] = sources.map((x) => ({ path: x.path, score: 1, why: [], snippet: "" }));
  try {
    const r = unwrap(await nb().ask(Principal.fromText(LLM_CANISTER), chatModel().id, question.slice(0, 1000), sources.slice(0, 10)));
    chat.messages.push({ role: "notes", text: r.text, picks, model: r.model, cycles: r.cycles, deck: o.deck, insertInto: o.insertInto });
  } catch (e) {
    chat.messages.push({ role: "notes", text: `The copilot could not answer: ${errMsg(e)}`, picks: [] });
  }
  chat.busy = false;
  chat.stage = "";
  // another notebook was opened meanwhile: its chat is not this one's
  if (S.chat === chat) render();
}
/** A kit's copilot card: prepared questions over that kit's notes. */
function copilotCard(kit: string, items: { a: string; icon: string; label: string; hint: string }[]): string {
  return `<div class="card band copilot"><div class="row tight wrap"><h2 title="Answers land in Chat with your notes, cited, and can be saved as notes">${icon("bot")} Copilot</h2>${items.map((i) => `<button type="button" class="btn" data-action="copilot-${kit}-${i.a}" title="${esc(i.hint)}">${icon(i.icon)}${esc(i.label)}</button>`).join("")}<span class="right-actions"><button type="button" class="btn btn-ghost" data-action="copilot-model" title="${LLM_LOCAL ? "Locally your Ollama answers whichever you pick." : esc(chatModel().note)}">${icon("bot")}${esc(chatModel().name)} · ${chatModel().tier} · ${chatModel().paid ? "≈0.11 TC" : "0.001 TC"}</button></span></div></div>`;
}
const QUEST_ROWS = (notes: number, links: number, streak: number): [string, number, number, string][] => [["Sprout", notes, 10, "a flower bed by your home"], ["Weaver", links, 25, "ivy on its walls"], ["A week of writing", streak, 7, "a flag on the roof"], ["A month of writing", streak, 30, "a statue in the yard"], ["Librarian", notes, 100, "a lantern by the door, lit at night"]];
/** Manage › Notebook: what writing has earned your home in the town. */
function questsCard(): string {
  const md = (S.notes ?? []).filter((n) => n.path.endsWith(".md") && !n.path.startsWith(`${AGENT_ROOT}/`));
  const notes = md.length, links = md.reduce((a, n) => a + (n.content.match(/\[\[/g)?.length ?? 0), 0), streak = S.usage?.streak ?? 0, days = S.usage?.active_days ?? 0;
  return `<div class="card band"><div class="row"><h2>${icon("award")} Quests</h2><span class="right-actions"><a class="btn btn-ghost" href="#/town" data-action="nav">${icon("town")}See your home</a></span></div>
    <p class="small muted">Writing earns your home in the town its trimmings; nothing else does, and nothing is for sale. ${streak ? `A ${streak}-day streak` : "Change a note today to start a streak"}${days ? `, ${days} of the last 30 days active` : ""}. This space's counts; the town adds up all of yours every few hours.</p>
    <div class="quests">${QUEST_ROWS(notes, links, streak).map(([name, have, need, gift]) => `<div class="quest ${have >= need ? "done" : ""}"><div class="row tight"><b>${have >= need ? icon("check") : ""}${name}</b><span class="small muted">${Math.min(have, need)}/${need}</span></div><div class="bar"><i style="width:${Math.min(100, (have / need) * 100).toFixed(0)}%"></i></div><div class="small muted">${gift}</div></div>`).join("")}</div></div>`;
}
/** Organize: links, pairs and tags the notes could use, one click each. */
const LINT_KINDS: [Issue["kind"], string][] = [["broken", "Broken links"], ["orphan", "Orphans"], ["duplicate", "Duplicate titles"], ["empty-folder", "Empty folders"], ["stale-project", "Stale projects"]];
/** The one-click fix for a Health finding (Organize › Health and the Tidy-up bubble). */
const lintFix = (i: Issue) => i.kind === "broken" ? `<button type="button" class="btn btn-ghost" data-action="lint-create" data-target="${esc(i.target ?? "")}" title="Make the missing note">${icon("plus")}Create</button><button type="button" class="btn btn-ghost" data-action="lint-unlink" data-path="${esc(i.path)}" data-target="${esc(i.target ?? "")}" title="Turn the link back into plain words">${icon("x")}Delete</button>` : i.kind === "orphan" ? `<button type="button" class="btn btn-ghost" data-action="lint-index" data-path="${esc(i.path)}">Link from index</button><button type="button" class="btn btn-ghost" data-action="org-archive" data-path="${esc(i.path)}">Archive</button>` : i.kind === "duplicate" ? `<button type="button" class="btn btn-ghost" data-action="lint-rename" data-path="${esc(i.path)}">Rename</button>` : i.kind === "empty-folder" ? `<button type="button" class="btn btn-ghost" data-action="lint-rmdir" data-path="${esc(i.path)}">Delete folder</button>` : `<button type="button" class="btn btn-ghost" data-action="lint-pause" data-path="${esc(i.path)}">Mark paused</button>`;
/** Tidy-up: what Health finds, as a bubble from the notes with the same one-click fixes. */
function tidyBubble(): string {
  if (!S.notes || !S.chat.tidy) return "";
  const issues = lint(orgNotes(), S.idx, S.folders);
  const groups = LINT_KINDS.map(([k, label]) => [label, issues.filter((i) => i.kind === k)] as const).filter(([, v]) => v.length);
  return `<div class="msg notes"><div class="bubble md garden"><div class="row tight"><b>${icon("broom")} Tidy-up</b><span class="small muted">${issues.length ? `${issues.length} thing${issues.length === 1 ? "" : "s"} to put right` : "nothing out of place"}</span><span class="right-actions"><button type="button" class="btn btn-ghost icon-btn" data-action="tidy-close" title="Put it away" aria-label="Close">${icon("x")}</button></span></div>
    <p class="small muted">Links to notes that don't exist, notes nothing links to, two notes with one title, empty folders, projects nobody touched in a month. One click each.</p>
    ${groups.map(([label, v]) => `<div class="pane-title" style="padding-left:0">${esc(label)} <span class="count">${v.length}</span></div><div class="runs">${v.map((i) => `<div class="run"><span><a href="#" data-action="open" data-path="${esc(i.path)}"><b>${esc(stem(i.path))}</b></a> <span class="small muted">· ${esc(i.detail)}</span></span><span class="row-actions">${lintFix(i)}</span></div>`).join("")}</div>`).join("")}</div></div>`;
}
let gardenMemo: { key: string; out: Suggestion[] } | undefined;
/** The gardener's suggestions as a bubble from the notes in the chat; nothing until the person runs it. */
function gardenBubble(): string {
  if (!S.notes || !S.chat.garden) return "";
  // suggest() is O(n²) over the notes: only again when the notes (their text too), the drafts or the dismissals changed
  const key = `${S.notes.length}|${S.notes.reduce((a, n) => a + n.content.length, 0)}|${S.notes.reduce((a, n) => (n.modified > a ? n.modified : a), 0n)}|${[...S.drafts].filter(([, d]) => d.dirty).map(([p, d]) => `${p}:${d.text.length}`).join(",")}|${S.settings.gardenHidden.length}|${S.idx.links.size}`;
  if (gardenMemo?.key !== key) gardenMemo = { key, out: suggest(notesNow(), S.idx, S.settings.gardenHidden, { max: 12 }) };
  const all = gardenMemo.out;
  const row = (x: Suggestion) => {
    const what = x.kind === "tag" ? `Tag <b>${esc(stem(x.path))}</b> with <code>#${esc(x.tag)}</code>` : x.kind === "link" ? `Link <b>${esc(stem(x.from))}</b> to <b>${esc(stem(x.to))}</b>` : `<b>${esc(stem(x.from))}</b> and <b>${esc(stem(x.to))}</b> belong together`;
    return `<div class="run"><span>${icon(x.kind === "tag" ? "tag" : "link")} ${what} <span class="small muted">· ${esc(x.why)}</span></span><span class="row-actions"><button type="button" class="btn" data-action="garden-accept" data-key="${esc(x.key)}">${x.kind === "tag" ? "Tag it" : "Link them"}</button><button type="button" class="btn btn-ghost icon-btn" data-action="garden-hide" data-key="${esc(x.key)}" title="Not this one; don't suggest it again" aria-label="Dismiss">${icon("x")}</button></span></div>`;
  };
  return `<div class="msg notes"><div class="bubble md garden"><div class="row tight"><b>${icon("sprout")} Gardener</b><span class="small muted">${all.length ? `${all.length} suggestion${all.length === 1 ? "" : "s"}` : "the garden is tidy"}</span><span class="right-actions"><button type="button" class="btn btn-ghost" data-action="garden-ai" ${all.length ? "" : "disabled"} title="The model reads the notes involved and says which links matter most">${icon("bot")}<span class="small lbl">Which matter most?</span></button><button type="button" class="btn btn-ghost icon-btn" data-action="garden-close" title="Put it away" aria-label="Close">${icon("x")}</button></span></div>
    <p class="small muted">Links your notes could use, notes that belong together, tags their neighbours carry. One click each, and you are taken to the note to see the change; what you dismiss stays dismissed. Missing notes and duplicate titles are Tidy-up's job.</p>
    ${all.length ? `<div class="runs">${all.map(row).join("")}</div>` : `<p class="small muted">Nothing to suggest right now.</p>`}</div></div>`;
}
async function gardenAction(action: string, el: HTMLElement) {
  const key = el.dataset.key ?? "";
  if (action === "garden-run") { S.chat.garden = true; if (S.mobile) S.mobilePane = "note"; return render(); }
  if (action === "garden-close") { S.chat.garden = false; return render(); }
  if (action === "garden-hide") { S.settings.gardenHidden = [...S.settings.gardenHidden, key].slice(-500); await saveSettings(); return render(); }
  const all = suggest(notesNow(), S.idx, S.settings.gardenHidden, { max: 200 });
  if (action === "garden-ai") {
    const linksOnly = all.filter((x): x is Exclude<Suggestion, { kind: "tag" }> => x.kind !== "tag");
    const paths = [...new Set(linksOnly.flatMap((x) => [x.from, x.to]))].slice(0, 10);
    const pairs = linksOnly.slice(0, 12).map((x) => `${stem(x.from)} → ${stem(x.to)}`).join("; ");
    const q = clipText(`These notes could link to each other: ${pairs}. Which three links matter most for finding things later, and why? A short numbered list.`, 1000);
    return copilot("Gardener: which of these links matter most?", q, paths.map((p) => ({ path: p, excerpt: excerpt(notesNow().find((n) => n.path === p)?.content ?? "", q, Math.floor(7600 / Math.max(1, paths.length))) })));
  }
  const x = all.find((y) => y.key === key);
  if (!x) return;
  if (x.kind === "tag") await writeNote(x.path, addTag(draftOf(x.path).text, x.tag));
  else await writeNote(x.from, addLink(draftOf(x.from).text, stem(x.to)));
  toast(x.kind === "tag" ? "Tagged: see the front matter." : "Linked: see “Related” at the end of the note.", "ok");
  // to the note that changed, so the edit is in view; the gardener's bubble waits in the chat
  await open(x.kind === "tag" ? x.path : x.from, { view: "preview" });
}
/** A kit copilot button: gather that kit's notes, ask. */
async function copilotAction(action: string, el: HTMLElement) {
  if (action === "copilot-model") {
    const r = el.getBoundingClientRect();
    return contextMenu(Math.max(8, r.right - 260), r.bottom + 4, "Model", MODELS.map((m) => ({ label: `${m.tier} · ${m.name} · ${m.paid ? "≈0.11 TC" : "0.001 TC"}${chatModel().id === m.id ? " ✓" : ""}`, icon: m.paid ? "bolt" : "bot", action: () => { store("nb-chat-model", m.id); render(); } })));
  }
  const notes = notesNow(), today = dayKey(new Date());
  const per = (n: number) => Math.min(2000, Math.floor(7600 / Math.max(1, n)));
  const src = (paths: string[], q: string) => paths.slice(0, 10).map((p) => ({ path: p, excerpt: excerpt(notes.find((n) => n.path === p)?.content ?? "", q, per(paths.length)) }));
  const folderPick = async (title: string) => { const folders = ["", ...S.folders.filter((f) => f !== AGENT_ROOT && !f.startsWith(`${AGENT_ROOT}/`))]; const f = await ask({ title, label: "Folder", choices: folders.map((x) => ({ value: x, label: x || "Top level" })), value: "", ok: "Go" }); if (f === null) return undefined; return notes.filter((n) => n.path.endsWith(".md") && !n.path.startsWith(`${AGENT_ROOT}/`) && (f ? n.path.startsWith(`${f}/`) : !n.path.includes("/"))).map((n) => n.path).slice(0, 10); };
  switch (action) {
    case "copilot-questions": {
      const paths = await folderPick("Open questions: which folder?");
      if (!paths) return;
      if (!paths.length) return toast("No notes in that folder.", "info");
      const q = "From these notes, list the open questions they raise but do not answer, and the evidence that is missing, as a markdown checklist of `- [ ]` items grouped under the note each comes from (name the note as [[Note]]). At most twelve items, the most important first. End with two next steps.";
      return copilot("Open questions these notes raise", q, src(paths, q));
    }
    case "copilot-career-resume": {
      const post = await ask({ title: "Tailor my résumé", label: "Paste the job post", multiline: true, ok: "Tailor" });
      if (!post?.trim()) return;
      const exp = notes.filter((n) => isExperience(n.content)).map((n) => n.path).slice(0, 9);
      const q = "Tailor my résumé to this job post: pick the experience and bullet points that fit, order them by relevance, write a three-line summary for the top, and list what the post asks for that my notes do not show.";
      return copilot("Career copilot: tailor my résumé to a job post", q, [{ path: "Job post", excerpt: clipText(post, 2400) }, ...src(exp, post)]);
    }
    case "copilot-career-interview": {
      const exp = notes.filter((n) => isExperience(n.content)).map((n) => n.path).slice(0, 10);
      if (!exp.length) return toast("Add an experience note first (Career › Experience bank).", "info");
      return copilot("Career copilot: likely interview questions", "From my experience notes, write eight interview questions I am likely to get for roles like these, each with a short STAR answer drawn from my notes.", src(exp, "interview experience role"));
    }
    case "copilot-study-cards": case "copilot-study-quiz": {
      const paths = await folderPick(action.endsWith("cards") ? "Flashcards from a folder" : "Quiz me on a folder");
      if (!paths) return;
      if (!paths.length) return toast("No notes in that folder.", "info");
      const cards = action.endsWith("cards");
      return copilot(cards ? "Study copilot: flashcards from my notes" : "Study copilot: quiz me", cards ? "Write 12 flashcards from these notes as lines of `Front::Back`, one card per paragraph, covering what a student must know. No preamble, no numbering." : "Quiz me: ten questions on these notes, from easy to hard, then a line that says `Answers` and the answers.", src(paths, "key ideas definitions"), { deck: cards });
    }
    case "copilot-money-subs": {
      const subs = subscriptions(notes, today);
      if (!subs.length) return toast("No subscriptions logged yet.", "info");
      const text = subs.map((x) => `${x.name}: ${x.cost} every ${x.every}, ${x.status}, about ${x.monthly.toFixed(2)} a month${x.renews ? `, renews ${x.renews}` : ""}`).join("\n");
      return copilot("Money copilot: review my subscriptions", "Review my subscriptions: which to keep, cancel or downgrade and why, the monthly saving of each change, and the total.", [{ path: "Subscriptions", excerpt: clipText(text, 6000) }]);
    }
    case "copilot-money-where": {
      const b = notes.find((n) => /budget/i.test(stem(n.path)) && n.path.endsWith(".md"));
      if (!b) return toast("No budget note yet (Money › templates).", "info");
      return copilot("Money copilot: where is my money going?", "From my budget, name the biggest categories, where spending runs past the plan, and three specific cuts with their monthly saving.", [{ path: b.path, excerpt: clipText(b.content, 7000) }]);
    }
    case "copilot-fitness-plan": {
      const ws = workouts(notes).slice(-6);
      if (!ws.length) return toast("Log a workout first.", "info");
      const recs = records(workouts(notes)).slice(0, 20).map((r) => JSON.stringify(r)).join("\n");
      return copilot("Fitness copilot: plan my next session", "Plan my next training session from my recent workouts and records: exercises, sets, reps and loads, where to progress and where to back off, and how long it should take.", [{ path: "Records", excerpt: clipText(recs, 1200) }, ...src(ws.map((w) => w.path), "sets reps weight")]);
    }
    case "copilot-crypto-thesis": {
      const ts = theses(notes, today);
      if (!ts.length) return toast("Write a thesis first (Crypto › Theses).", "info");
      const pick = ts.length === 1 ? ts[0].path : await ask({ title: "Question a thesis", label: "Thesis", choices: ts.map((t) => ({ value: t.path, label: t.title })), value: ts[0].path, ok: "Go" });
      if (!pick) return;
      return copilot(`Crypto copilot: question “${stem(pick)}”`, "Question this thesis: the three strongest counterarguments, what would prove it wrong, what to watch over the next month, and whether the position size fits the confidence.", src([pick], "thesis risk"));
    }
    case "copilot-work-meeting": {
      const path = el.dataset.path!;
      return copilot(`Summarise “${stem(path)}”`, "Summarise this meeting in short bullets: decisions, actions with their owners and dates, and open questions. Nothing that is not in the note.", src([path], "decisions actions"), { insertInto: path });
    }
  }
}
/** `content` with an AI summary under a "## Summary" heading right after the title. */
function summaryInto(content: string, text: string): string {
  const clean = text.replace(CITE, "").replace(/\n{3,}/g, "\n\n").trim();
  const block = `\n## Summary\n\n${clean}\n`;
  const old = /\n## Summary\n[\s\S]*?(?=\n#{1,6} |$)/.exec(content);
  if (old) return `${content.slice(0, old.index)}${block}${content.slice(old.index + old[0].length)}`;
  const h1 = /^# .*$/m.exec(content);
  if (h1) { const at = h1.index + h1[0].length; return `${content.slice(0, at)}\n${block}${content.slice(at)}`; }
  // no title: after the front matter, never inside it
  const fm = /^---\n[\s\S]*?\n---\n/.exec(content), at = fm ? fm[0].length : 0;
  return `${content.slice(0, at)}${block}\n${content.slice(at)}`;
}
async function askNotes() {
  const q = S.chat.input.trim();
  if (!q || !S.notes || S.chat.busy) return;
  S.chat.input = "";
  S.chat.messages.push({ role: "you", text: q });
  S.chat.busy = true;
  S.chat.stage = "Reading your notes…";
  render();
  const notes = S.notes.map((n) => ({ ...n, content: S.drafts.get(n.path)?.text ?? n.content }));
  const picks = decide(q, notes, S.idx, { folders: chatFolders(), limit: 6 });
  {
    const per = picks.length ? Math.min(2000, Math.floor(7600 / picks.length)) : 0;
    const sources = picks.map((p) => ({ path: p.path, excerpt: excerpt(notes.find((n) => n.path === p.path)?.content ?? "", q, per) }));
    const model = chatModel().id;
    S.chat.stage = `Asking ${LLM_LOCAL ? "your local Ollama" : modelName(model)} ${picks.length ? `with ${picks.length} note${picks.length === 1 ? "" : "s"}` : "(no notes matched, so from its own knowledge)"}…`;
    render();
    try {
      const r = unwrap(await nb().ask(Principal.fromText(LLM_CANISTER), model, q, sources));
      const used = cited(r.text, picks.length);
      // cited notes first, in the order the model used them, so [n] still points at the right note
      S.chat.messages.push({ role: "notes", text: r.text, picks, model: r.model, cycles: r.cycles, fallback: used.length || !picks.length || /beyond your notes/i.test(r.text) ? "" : "no citations given" });
    } catch (e) {
      S.chat.messages.push({ role: "notes", text: answer(q, picks), picks, fallback: errMsg(e) });
    }
  }
  S.chat.busy = false;
  S.chat.stage = "";
  render();
  document.querySelector<HTMLTextAreaElement>("[name=chatq]")?.focus();
}

// --- workspace: graph tab

function graphTab(): string {
  if (S.mobile) for (const t of [400, 1500, 3000]) setTimeout(() => graph?.fit(), t); // centre once the layout settles
  const n = S.notes?.length ?? 0;
  return `<section class="main"><div class="graph-wrap">
      <canvas id="graph" aria-label="Knowledge graph of this space"></canvas>
      <div class="graph-tools">
        <label class="search" style="max-width:180px">${icon("search")}<input name="gq" value="${esc(S.graphStyle.query)}" placeholder="Find in graph" aria-label="Find in graph"></label>
        <select class="input" name="gcolor" aria-label="Colour by" style="flex:0 0 auto;padding:5px 8px"><option value="none" ${S.graphStyle.colorBy === "none" ? "selected" : ""}>No groups</option><option value="folder" ${S.graphStyle.colorBy === "folder" ? "selected" : ""}>Colour by folder</option><option value="tag" ${S.graphStyle.colorBy === "tag" ? "selected" : ""}>Colour by first tag</option></select>
        <label class="switch"><input type="checkbox" name="gattach" ${S.graphStyle.hideAttachments ? "checked" : ""}> Hide attachments</label>
        <label class="switch"><input type="checkbox" name="gorphans" ${S.graphStyle.orphans ? "checked" : ""}> Orphans</label>
        <label class="switch"><input type="checkbox" name="ghosts" ${S.graphGhosts ? "checked" : ""}> Unresolved</label>
        <button type="button" class="btn btn-ghost" data-action="graph-fit" title="Fit to view (double-click the canvas)">${icon("fit")}Fit</button>
        <span class="small muted">${n} notes · ${[...S.idx.links.values()].reduce((a, s) => a + s.size, 0)} links</span>
      </div>
      <div class="graph-legend"><span><i></i>note</span><span><i class="cur"></i>open note</span><span><i class="agent"></i>agent note</span><span><i class="ghost"></i>unresolved</span><span class="graph-groups"></span><span class="faint">drag to move · wheel to zoom · click to open</span></div>
      ${n ? "" : `<div class="graph-empty">No notes to draw yet.</div>`}
    </div></section>`;
}

// --- workspace: manage tab (cycles, export, canister)

function manageTab(): string {
  const i = S.info;
  const v = S.notebook!;
  const low = lowCycles(i);
  const runway = i ? Math.min(100, (Number(i.cycles) / 3e12) * 100) : 0;
  const rows = S.topups.length
    ? `<div class="runs">${S.topups.map((t) => `<div class="run"><span><b>${icp(t.amount_e8s)} ICP</b> <span class="small muted">→ ${tc(t.cycles)} · ${t.from.toText() === v.canister.toText() ? "sent to the account" : shortPrincipal(t.from.toText())}</span></span><span class="small muted">${when(t.at)}</span><span class="pill ${t.status.__kind__ === "Failed" ? "low" : t.status.__kind__ === "Completed" ? "ok" : ""}">${t.status.__kind__}</span></div>`).join("")}</div>`
    : `<p class="small muted">No top-ups yet.</p>`;
  const stats = `<div class="stats">
      <div class="stat"><div class="label">Cycles left</div><div class="num ${low ? "danger" : ""}">${i ? tc(i.cycles) : "…"}</div><div class="meter"><i style="width:${runway}%"></i></div><div class="small muted nudge">${(() => { const h = S.health.get(v.canister.toText()); return h ? `Freezes below ${tc(h.freeze_at)} (90 days of idle burn, ${tc(h.idle_cycles_burned_per_day)}/day); about ${daysUntilFreeze(h)} days until then. A frozen space keeps its data 90 days, then it is deleted.` : low ? "Below the freezing line the canister stops answering until topped up." : "Comfortable. 3 TC is a full bar."; })()}</div></div>
      <div class="stat"><div class="label">Files</div><div class="num">${i ? String(i.files) : "…"}</div><div class="small muted">${S.folders.length} folders</div></div>
      <div class="stat"><div class="label">Stored</div><div class="num">${i ? kb(i.bytes) : "…"}</div><div class="small muted">note content</div></div>
      <div class="stat"><div class="label">Topped up</div><div class="num">${i ? `${icp(i.total_topped_up_e8s)} ICP` : "…"}</div><div class="small muted">${i ? `→ ${tc(i.total_cycles_from_topups)}` : ""}</div></div>
    </div>`;
  const about = `<p class="small muted nudge">Canister <code>${v.canister.toText()}</code> · created ${when(v.created_at)} · controllers: you and the registry.</p>`;
  // a phone keeps the top for the tabs; the figures sit under Fuel, where they are acted on
  return `<section class="main" style="overflow:auto"><div class="page">
    ${S.mobile ? "" : stats + about}
    <nav class="segmented sub manage-tabs" role="tablist" aria-label="Manage sections">${MANAGE_TABS.map(([k, label, ic]) => `<button type="button" role="tab" class="tab" aria-selected="${S.manageTab === k}" data-action="manage-tab" data-tab="${k}">${icon(ic)}<span class="lbl">${label}</span></button>`).join("")}</nav>
    ${S.manageTab === "wallet" ? walletCard() : S.manageTab === "fuel" ? `${fuelCard()}
    <div class="band"><div class="band-title">Fuel history<button type="button" class="btn btn-ghost icon-btn" data-action="refresh-info" title="Refresh" aria-label="Refresh">${icon("refresh")}</button></div>${rows}</div>${S.mobile ? `<div class="nudge">${stats}${about}</div>` : ""}` : S.manageTab === "agent" ? `${agentsCard()}${skillsCard()}` : S.manageTab === "prompts" ? promptsCard() : `
    <div class="card band">
      <h2>${icon("upload")} Upload</h2>
      <p class="muted small">Bring an Obsidian folder or zip into this space, or download everything in it as a zip of markdown files, folders included. Restore puts a zip back: existing notes are overwritten and notes missing from the zip are deleted.</p>
      <div class="row tight"><button type="button" class="btn btn-primary" data-action="import" ${S.notes ? "" : "disabled"}>${icon("upload")}Import from Obsidian…</button><button type="button" class="btn" data-action="download" ${S.notes ? "" : "disabled"}>${icon("download")}Download space (.zip)</button></div>
    </div>
    ${deleteCard()}`}
  </div></section>`;
}

/** A kit's tab opens with a still slice of sky in its colours behind its name (it eases in when
 *  the kit is opened, not on every re-render). */
let bandShown = "";
function withBand(t: Tab, html: string): string {
  const f = FEATURES.find((x) => x.id === t);
  if (!f) return html;
  const enter = bandShown !== t;
  bandShown = t;
  return html.replace(/<div class="page[^"]*">/, (m) => `${m}<div class="kit-band${enter ? " enter" : ""}"><canvas data-kit-band="${t}" aria-hidden="true"></canvas><span class="kit-band-icon">${icon(f.icon)}</span><div><h1>${esc(f.label)}</h1><p class="small">${esc(f.desc)}</p></div></div>`);
}
function workspace(): string {
  if (S.tab === "manage" || S.tab === "graph") bandShown = "";
  if (S.tab === "manage") return shell(manageTab());
  if (S.tab === "graph") return shell(graphTab());
  const kits: Partial<Record<Tab, () => string>> = { study: studyTab, work: workTab, organize: organizeTab, research: researchTab, writing: writingTab, care: careTab, career: careerTab, crypto: cryptoTab, money: moneyTab, creator: creatorTab, fitness: fitnessTab, home: homeTab, software: softwareTab, trips: tripsTab };
  if (S.tab !== "study" && S.tab !== "work" && !featureOn(S.tab)) S.tab = "notes";
  const kit = kits[S.tab];
  if (kit) return shell(withBand(S.tab, kit()));
  bandShown = "";
  if (S.tab === "chat" && !flag("chat")) S.tab = "notes";
  if (S.tab === "chat") return shell(`<div class="workspace m-${S.mobilePane} ${S.sideOpen ? "" : "no-side"} ${S.asideOpen ? "" : "no-aside"}"><nav id="side" class="side" aria-label="Files">${side()}</nav>${chatHtml()}<aside id="aside" class="aside" aria-label="Sources">${chatAside()}</aside></div>`);
  return shell(`<div class="workspace m-${S.mobilePane} ${S.sideOpen ? "" : "no-side"} ${S.asideOpen ? "" : "no-aside"}"><nav id="side" class="side" aria-label="Files">${side()}</nav>${panesHtml()}<aside id="aside" class="aside" aria-label="Links">${aside()}</aside></div>`);
}

/** Full-screen slide show: arrows or a click move, Escape leaves. `dead` renders links dead (gists). */
function showHtml(): string {
  const sh = S.show!;
  const slide = sh.slides[sh.i] ?? "";
  return `<div class="show" role="dialog" aria-label="Slide show">
    <div class="show-slide md" data-action="show-next">${sh.dead ? gistMd(slide) : renderMd(slide, sh.self)}</div>
    <button type="button" class="btn btn-ghost icon-btn show-x" data-action="show-close" aria-label="Leave the slide show">${icon("x")}</button>
    <div class="show-nav"><button type="button" class="btn btn-ghost icon-btn" data-action="show-prev" aria-label="Previous slide" ${sh.i === 0 ? "disabled" : ""}>${icon("chevron")}</button><span class="small">${sh.i + 1} / ${sh.slides.length}</span><button type="button" class="btn btn-ghost icon-btn flip" data-action="show-next" aria-label="Next slide" ${sh.i >= sh.slides.length - 1 ? "disabled" : ""}>${icon("chevron")}</button></div>
  </div>`;
}
function present(content: string, self?: string, dead = false) {
  const slides = splitSlides(content);
  if (!slides.length) return toast("Nothing to present: separate slides with --- lines.", "info");
  S.show = { slides, i: 0, self, dead };
  render();
  document.documentElement.requestFullscreen?.().catch(() => {});
}
function showStep(d: number) {
  const sh = S.show;
  if (!sh) return;
  sh.i = Math.max(0, Math.min(sh.slides.length - 1, sh.i + d));
  const el = document.querySelector(".show");
  if (el) el.outerHTML = showHtml(); else render();
  afterRender();
}
function closeShow() {
  S.show = undefined;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  render();
}
function render() {
  const active = document.activeElement as HTMLElement | null;
  const focusKey = active?.dataset?.action ?? (active as HTMLInputElement | null)?.name;
  const ta = undefined as undefined | { pane?: string; s: number; e: number; top: number };
  closeMenu();
  unmountEditors(true);
  const focusedPath = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(".cm-host")?.dataset.cm;
  const chatTop = document.querySelector<HTMLElement>("[data-chat-log]")?.scrollTop;
  // the file pane keeps its place: opening a note far down the list must not jump the list back to the top
  const sideTop = document.getElementById("side")?.scrollTop ?? 0, asideTop = document.getElementById("aside")?.scrollTop ?? 0;
  const previewTop = S.mobile ? document.querySelector<HTMLElement>(".pane .preview")?.scrollTop ?? 0 : 0;
  destroyEditors();
  app.innerHTML = S.booting ? loadingPage() : S.shared ? sharedPage() : S.town ? townPage() : S.problems ? problemsPage() : S.inbox && (S.identity || isSandbox()) ? inboxPage() : S.board && S.identity ? boardPage() : S.community && S.identity ? communityPage() : S.market && S.identity ? marketPage() : S.admin && S.isAdmin ? adminPage() : !asVerified() && !(S.notebook && isSandbox()) ? onboardingPage() : S.notebook ? workspace() : agentSpacePage();
  if (S.show) app.insertAdjacentHTML("beforeend", showHtml());
  { const s = document.getElementById("side"); if (s && sideTop) s.scrollTop = sideTop; const a = document.getElementById("aside"); if (a && asideTop) a.scrollTop = asideTop; }
  // a phone's reader stays where it was, with the bars still away if it had scrolled down
  if (S.mobile) { const pv = app.querySelector<HTMLElement>(".pane .preview"); if (pv && previewTop) pv.scrollTop = previewTop; else if (!pv || !previewTop) readHidden = headHidden = false; noteY = previewTop; noteAnchor = previewTop; applyReadHidden(); }
  // a re-render must not move the reader: keep the chat where it was, or at the bottom
  if (S.community) { const log = app.querySelector<HTMLElement>("[data-chat-log]"); if (log) { log.scrollTop = S.community.atBottom === false && chatTop !== undefined ? chatTop : log.scrollHeight; chatScrolled(); } }
  mountEditors();
  if (focusedPath) for (const [host, ed] of editors) if (host.dataset.cm === focusedPath) { ed.focus(); break; }
  if (focusKey && focusKey !== "draft" && !focusedPath) app.querySelector<HTMLElement>(`[data-action="${focusKey}"], [name="${focusKey}"]`)?.focus();
  if (ta) {
    const el = app.querySelector<HTMLTextAreaElement>(`textarea[name=draft][data-pane="${ta.pane}"]`);
    if (el) {
      el.focus();
      el.setSelectionRange(ta.s, ta.e);
      el.scrollTop = ta.top;
    }
  }
  mountGraphs();
  persistTabs();
  afterRender();
  scrollPending();
}
let pendingScroll: { path: string; target: string } | undefined;
/** After a `[[Note#Heading]]` or `[[Note#^block]]` opens, bring the target into view in that note's preview. */
function scrollPending() {
  if (!pendingScroll) return;
  const { path, target } = pendingScroll;
  const pv = document.querySelector<HTMLElement>(`[data-preview-path="${CSS.escape(path)}"]`);
  if (!pv) return;
  pendingScroll = undefined;
  const el = target.startsWith("^")
    ? pv.querySelector<HTMLElement>(`[data-block="${CSS.escape(target.slice(1))}"]`)?.parentElement
    : [...pv.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")].find((h) => (h.dataset.heading ?? h.textContent ?? "").trim().toLowerCase() === target.trim().toLowerCase());
  if (el) {
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1500);
  }
}
/** Sidebar and link pane only; leaves the textareas alone while typing. */
function renderSide() {
  const s = document.getElementById("side");
  const a = document.getElementById("aside");
  if (s) { const top = s.scrollTop; s.innerHTML = side(); s.scrollTop = top; }
  if (a) { const top = a.scrollTop; a.innerHTML = aside(); a.scrollTop = top; }
  const c = cur();
  const n = c ? S.comments.filter((x) => x.path === c).length : 0;
  document.querySelectorAll<HTMLElement>('[data-action="comments"]').forEach((b) => { b.querySelector(".badge")?.remove(); if (n) b.insertAdjacentHTML("beforeend", `<span class="badge">${n}</span>`); });
  mountGraphs();
}
/** Status + tab dirty dots for one path, in every pane that shows it. */
function status(path: string) {
  const d = draftOf(path);
  const text = d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved";
  const cls = d.saving ? "saving" : d.dirty ? "dirty" : "";
  document.querySelectorAll<HTMLElement>(`[data-status-path="${CSS.escape(path)}"]`).forEach((el) => (el.innerHTML = `<i class="dot ${cls}"></i>${text}`));
  document.querySelectorAll<HTMLElement>(`.tabitem[data-tab="${CSS.escape(path)}"]`).forEach((el) => {
    const has = el.querySelector(".dot-dirty");
    if (d.dirty && !has) el.querySelector(".tname")?.insertAdjacentHTML("afterend", `<span class="dot-dirty"></span>`);
    if (!d.dirty && has) has.remove();
  });
}
function mountGraphs() {
  const gc = document.getElementById("graph") as HTMLCanvasElement | null;
  graph?.destroy();
  graph = undefined;
  if (gc && S.notes) {
    graph = new ForceGraph(gc, { cache: graphPos, onOpen: (id) => void open(id) });
    applyGraph();
  }
  const mc = document.getElementById("mini") as HTMLCanvasElement | null;
  mini?.destroy();
  mini = undefined;
  const c = cur();
  if (mc && S.notes && c) {
    mini = new ForceGraph(mc, { cache: miniPos, labels: "always", onOpen: (id) => void open(id) });
    const d = graphData(S.notes, S.idx, { focus: c, depth: S.localDepth, unresolved: true });
    mini.setData(d.nodes, d.edges, c);
  }
}

const PALETTE = ["#4a8df6", "#2fbfa6", "#e2b53e", "#ef8f3d", "#ee6e6e", "#a978f5", "#5fd3e8", "#9ccc65", "#f48fb1", "#8d6e63"];
/** Push the current filter and colouring into the graph view. */
function applyGraph() {
  if (!graph || !S.notes) return;
  const notes = S.graphStyle.hideAttachments ? S.notes.filter((n) => !isAttachment(n.path)) : S.notes;
  const d = graphData(notes, S.idx, { unresolved: S.graphGhosts });
  const degree = new Map(d.nodes.map((n) => [n.id, n.degree]));
  const nodes = S.graphStyle.orphans ? d.nodes.filter((n) => !degree.get(n.id)) : d.nodes;
  const colors = new Map<string, string>();
  const groups = new Map<string, string>();
  const gcolor = (key: string) => { if (!groups.has(key)) groups.set(key, PALETTE[groups.size % PALETTE.length]); return groups.get(key)!; };
  if (S.graphStyle.colorBy === "folder") for (const n of nodes) colors.set(n.id, gcolor(dir(n.id) || "/"));
  if (S.graphStyle.colorBy === "tag") for (const n of nodes) { const t = [...S.idx.tags.entries()].find(([, ps]) => ps.has(n.id))?.[0]; if (t) colors.set(n.id, gcolor(t.split("/")[0])); }
  const q = S.graphStyle.query.trim().toLowerCase();
  const match = q ? new Set(nodes.filter((n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)).map((n) => n.id)) : undefined;
  graph.setStyle({ colors, match });
  graph.setData(nodes, d.edges.filter((e) => S.graphStyle.orphans ? false : true), cur());
  const legend = document.querySelector(".graph-groups");
  if (legend) legend.innerHTML = [...groups.entries()].slice(0, 12).map(([k, c]) => `<span><i style="background:${c}"></i>${esc(k)}</span>`).join("");
}

/** Tabs and panes survive a reload, per notebook, in this browser. */
function persistTabs() {
  if (!S.notebook) return;
  store(`nb-tabs-${S.notebook.canister.toText()}`, JSON.stringify({ panes: S.panes.map((p) => ({ tabs: p.tabs, active: p.active, view: p.view })), focused: S.panes.findIndex((p) => p.id === S.focused) }));
}
function restoreTabs() {
  const raw = S.notebook && store(`nb-tabs-${S.notebook.canister.toText()}`);
  const have = new Set(paths());
  let panes: Pane[] = [];
  let focusedIdx = 0;
  if (raw) {
    try {
      const j = JSON.parse(raw) as { panes: { tabs: string[]; active?: string; view: View }[]; focused: number };
      panes = j.panes.map((p) => ({ ...newPane(p.view), tabs: p.tabs.filter((t) => have.has(t)), active: p.active && have.has(p.active) ? p.active : undefined })).map((p) => ({ ...p, active: p.active ?? p.tabs[0] }));
      panes = panes.filter((p, i) => p.tabs.length || i === 0);
      focusedIdx = Math.min(Math.max(0, j.focused), panes.length - 1);
    } catch {
      panes = [];
    }
  }
  if (!panes.length) {
    panes = [newPane()];
    // first visit: open the front page
    if (have.has("index.md")) {
      panes[0].tabs = ["index.md"];
      panes[0].active = "index.md";
    }
  }
  S.panes = panes;
  S.focused = panes[focusedIdx].id;
}

// ---------- flows ----------

// ---------- Agent Space: the gate and the wallet ----------

let tapTimer = 0;
/** One tap on the square: the first starts the clock, the 25th inside the time passes. The count and the
 *  clock are written straight into the page; a full render per tap would eat the taps. */
function asTap() {
  const t = S.as.tap;
  if (t.done) return;
  if (!t.start) {
    t.start = performance.now();
    tapTimer = window.setInterval(() => {
      const left = Math.max(0, TAP_MS - (performance.now() - t.start));
      const el = document.querySelector("[data-as-timer]");
      if (el) el.textContent = `${(left / 1000).toFixed(1)}s`;
      if (!left) asTapEnd();
    }, 50);
  }
  t.count++;
  const c = document.querySelector("[data-as-count]");
  if (c) c.textContent = `${t.count} / ${TAP_GOAL}`;
  if (tapPassed(t.count, performance.now() - t.start)) asTapEnd();
}
function asTapEnd() {
  clearInterval(tapTimer);
  const t = S.as.tap;
  t.done = tapPassed(t.count, performance.now() - t.start) ? "pass" : "fail";
  render();
  setTimeout(() => {
    if (t.done === "pass") { S.as.step = "hunt"; S.as.hunt = huntRound(); S.as.picked = new Set(); S.as.huntDone = undefined; }
    else S.as.tap = { count: 0, start: 0, done: undefined };
    render();
  }, t.done === "pass" ? 600 : 1000);
}
/** Submit the hunt: an exact match verifies the signed-in principal, once, in this browser. */
function asSubmit() {
  const a = S.as;
  if (!a.hunt || a.huntDone) return;
  a.huntDone = checkHunt(a.hunt, a.picked) ? "pass" : "fail";
  render();
  if (a.huntDone === "fail") { setTimeout(() => { a.hunt = huntRound(); a.picked = new Set(); a.huntDone = undefined; render(); }, 1000); return; }
  setTimeout(() => { store(`as-verified:${S.principal}`, "1"); a.step = "landing"; render(); }, 600);
}
/** The agent's wallet is its notebook canister. Its three addresses: BTC from the ckBTC minter, ETH from
 *  threshold ECDSA, ICP its ledger account. Each is best effort: a network without the minter says so. */
/** What the space holds on every ledger the registry lists (the Wallet tab). */
async function loadBalances() {
  const id = S.notebook?.canister.toText();
  if (!id || isSandbox()) return;
  const agent = HttpAgent.createSync({ identity: S.identity, rootKey: env.IC_ROOT_KEY }), owner = Principal.fromText(id);
  S.walletBalances = await Promise.all(S.tokens.map(async (t) => ({ symbol: t.symbol, decimals: t.decimals, balance: await Actor.createActor<Ledger>(ledgerIdl, { agent, canisterId: t.ledger.toText() }).icrc1_balance_of({ owner, subaccount: [] }).catch(() => undefined) })));
  render();
}
async function loadWallet(id: string) {
  const w = S.as.wallet;
  if (w.addrs?.id === id || w.loading === id) return;
  const kept = store(`as-addrs:${id}`);
  if (kept) { w.addrs = JSON.parse(kept); render(); return; }
  w.loading = id;
  const a = notebookOf(id);
  const text = (p: Promise<{ __kind__: "Ok"; Ok: string } | { __kind__: "Err"; Err: NotebookError }>) => p.then(unwrap).catch((e: unknown) => `unavailable: ${errMsg(e)}`);
  const [icp, btc, eth] = await Promise.all([a.info().then((i) => i.topup_account_id).catch((e: unknown) => `unavailable: ${errMsg(e)}`), text(a.btc_address()), text(a.eth_address())]);
  w.loading = "";
  w.addrs = { id, btc, eth, icp };
  if (![btc, eth, icp].some((x) => x.startsWith("unavailable"))) store(`as-addrs:${id}`, JSON.stringify(w.addrs));
  render();
}

// ---------- paying for cycles with a card: CyclePay's gateway, the one `icp cycles buy` uses ----------

const CYCLES_GATEWAY = "2bwus-iiaaa-aaaac-bee3a-cai";
const gatewayIdl: IDL.InterfaceFactory = ({ IDL: I }) => I.Service({
  get_card_terms: I.Func([], [I.Record({ deliveries_paused: I.Bool, min_order_usd_cents: I.Nat64, max_order_usd_cents: I.Nat64, fee_bps: I.Nat64, fee_fixed_usd_cents: I.Nat64 })], ["query"]),
  get_xdr_rate_status: I.Func([], [I.Record({ xdr_usd_x10000: I.Nat64, stale: I.Bool })], ["query"]),
  create_order: I.Func([I.Record({ destination: I.Variant({ Canister: I.Principal, Ledger: I.Null }), beneficiary: I.Opt(I.Principal), project_id: I.Opt(I.Text), amount_usd_cents: I.Nat64, confirm_system_canister: I.Opt(I.Bool) })], [I.Variant({ Ok: I.Record({ order_id: I.Text, amount_usd_cents: I.Nat64, net_usd_cents: I.Nat64, payment_url: I.Text, expires_at: I.Nat64 }), Err: I.Record({ code: I.Text, message: I.Text }) })], []),
  order_status: I.Func([I.Text], [I.Opt(I.Record({ order_id: I.Text, status: I.Variant({ AwaitingPayment: I.Null, PaymentPending: I.Null, Processing: I.Null, Delivered: I.Null, NeedsReview: I.Null, Refunding: I.Null, Refunded: I.Null, RefundOwed: I.Null }), cycles_delivered: I.Opt(I.Nat64), detail: I.Opt(I.Text) }))], ["query"]),
});
type Gateway = {
  get_card_terms: () => Promise<{ deliveries_paused: boolean; min_order_usd_cents: bigint; max_order_usd_cents: bigint; fee_bps: bigint; fee_fixed_usd_cents: bigint }>;
  get_xdr_rate_status: () => Promise<{ xdr_usd_x10000: bigint; stale: boolean }>;
  create_order: (a: { destination: { Canister: Principal } | { Ledger: null }; beneficiary: [] | [Principal]; project_id: []; amount_usd_cents: bigint; confirm_system_canister: [] }) => Promise<{ Ok: { order_id: string; net_usd_cents: bigint; payment_url: string } } | { Err: { code: string; message: string } }>;
  order_status: (id: string) => Promise<[] | [{ status: Record<string, null>; cycles_delivered: [] | [bigint]; detail: [] | [string] }]>;
};
const gateway = () => Actor.createActor<Gateway>(gatewayIdl, { agent: HttpAgent.createSync({ identity: S.identity, rootKey: env.IC_ROOT_KEY }), canisterId: CYCLES_GATEWAY });
let orderTimer = 0;
/** Order cycles for the space by card: the gateway tops the canister up itself once the page is paid.
 *  The order's page link and a QR code of it go in the panel; the status is polled while it is open. */
const CYCLES_LEDGER = "um5iw-rqaaa-aaaaq-qaaba-cai", CYCLES_LEDGER_FEE = 100_000_000n;
const cyclesLedgerIdl: IDL.InterfaceFactory = ({ IDL: I }) => I.Service({
  icrc1_balance_of: I.Func([AccountIdl], [I.Nat], ["query"]),
  withdraw: I.Func([I.Record({ amount: I.Nat, from_subaccount: I.Opt(I.Vec(I.Nat8)), to: I.Principal, created_at_time: I.Opt(I.Nat64) })], [I.Variant({ Ok: I.Nat, Err: I.Reserved })], []),
});
type CyclesLedger = { icrc1_balance_of: (a: { owner: Principal; subaccount: [] }) => Promise<bigint>; withdraw: (a: { amount: bigint; from_subaccount: []; to: Principal; created_at_time: [] }) => Promise<{ Ok: bigint } | { Err: unknown }> };
const cyclesLedger = () => Actor.createActor<CyclesLedger>(cyclesLedgerIdl, { agent: HttpAgent.createSync({ identity: S.identity, rootKey: env.IC_ROOT_KEY }), canisterId: CYCLES_LEDGER });
const orderKey = () => `as-order:${S.principal}`;
function startOrderPolling() {
  clearInterval(orderTimer);
  orderTimer = window.setInterval(() => void pollOrder(), 5000);
  void pollOrder();
}
// paying happens in another tab or on a phone: the moment this tab is looked at again, ask the gateway
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.as.wallet.order) void pollOrder(); });
/** An order made before a reload: pick it up where it was. */
function resumeOrder() {
  const w = S.as.wallet;
  if (w.order || S.notebooks?.[0]) return;
  const kept = store(orderKey());
  if (!kept) return;
  try { w.order = JSON.parse(kept); } catch { store(orderKey(), null); return; }
  S.as.pay = "choose";
  render();
  startOrderPolling();
}
/** The order paid: make the space (the registry fronts its first cycles), move the bought cycles into it, go in. */
async function finishCardSpawn() {
  S.as.pay = "creating";
  if (S.as.wallet.order) S.as.wallet.order.failed = undefined;
  S.error = "";
  render();
  const id = await spawnNotebook("Agent M&M", "Money (wallet) & memory", true, async (made) => {
    if (isLocal) return;
    try {
      const me = S.identity!.getPrincipal(), bal = await cyclesLedger().icrc1_balance_of({ owner: me, subaccount: [] });
      const amount = bal - CYCLES_LEDGER_FEE;
      if (amount <= 0n) return;
      const r = await cyclesLedger().withdraw({ amount, from_subaccount: [], to: Principal.fromText(made), created_at_time: [] });
      if ("Err" in r) throw new Error(JSON.stringify(r.Err, (_, x) => (typeof x === "bigint" ? x.toString() : x)));
      toast(`${tc(amount)} of cycles moved into your space.`, "ok");
    } catch (e) { toast(`The cycles stayed on your cycles-ledger account (${errMsg(e)}); Manage → Fuel can move them later.`, "error"); }
  });
  S.as.pay = "";
  if (id) {
    store(orderKey(), null);
    S.as.wallet.order = undefined;
    if (!location.hash.startsWith("#/notebook/")) location.hash = `#/notebook/${id}`;
  } else {
    // the payment stands: keep the order so the person can try the creation again
    if (S.as.wallet.order) { S.as.wallet.order.failed = S.error || "the registry did not answer"; S.as.pay = "choose"; }
    render();
  }
}
async function asCard(cents: number) {
  const a = S.as, w = a.wallet, id = S.notebooks?.[0]?.canister.toText();
  if (w.order || a.pay) return;
  if (!id && isLocal) return finishCardSpawn(); // no gateway on the local network: the registry fronts the cycles
  try {
    const gw = gateway();
    const [terms, rate] = await Promise.all([gw.get_card_terms(), gw.get_xdr_rate_status()]);
    if (terms.deliveries_paused) throw new Error("card payments are paused at the gateway right now");
    const amount = BigInt(Math.min(Number(terms.max_order_usd_cents), Math.max(Number(terms.min_order_usd_cents), cents)));
    const r = await gw.create_order({ destination: id ? { Canister: Principal.fromText(id) } : { Ledger: null }, beneficiary: id ? [] : [S.identity!.getPrincipal()], project_id: [], amount_usd_cents: amount, confirm_system_canister: [] });
    if ("Err" in r) throw new Error(`${r.Err.message} (${r.Err.code})`);
    const tcs = Number(r.Ok.net_usd_cents) / 100 / (Number(rate.xdr_usd_x10000) / 10_000);
    w.order = { id: r.Ok.order_id, url: r.Ok.payment_url, status: "AwaitingPayment", cents: Number(amount), tc: tcs.toFixed(2) };
    if (!id) { a.pay = "choose"; store(orderKey(), JSON.stringify(w.order)); }
    render();
    startOrderPolling();
  } catch (e) {
    toast(errMsg(e), "error");
  }
}
async function pollOrder() {
  const o = S.as.wallet.order;
  if (!o || document.hidden || o.busy) return;
  o.busy = true;
  try {
    const r = await gateway().order_status(o.id).catch(() => [] as const);
    if (!r.length) return;
    const status = Object.keys(r[0].status)[0];
    const delivered = r[0].cycles_delivered[0];
    if (status === o.status && !delivered) return;
    o.status = status;
    if (delivered) o.delivered = tc(delivered);
    if (!S.notebooks?.[0]) store(orderKey(), JSON.stringify({ ...o, busy: undefined }));
    if (["Delivered", "Refunded", "RefundOwed", "NeedsReview"].includes(status)) {
      clearInterval(orderTimer);
      if (status === "Delivered") {
        if (S.notebooks?.[0]) { store(orderKey(), null); toast(`${o.delivered} of cycles landed in the space.`, "ok"); }
        else return void finishCardSpawn();
      }
    }
    render();
  } finally {
    o.busy = false;
  }
}

async function signIn() {
  S.signin = { busy: true, error: "" };
  render();
  try {
    S.identity = devMode ? devIdentity(true) : await auth.signIn();
    if (!S.identity) throw new Error("No identity was returned");
    S.principal = S.identity.getPrincipal().toText();
    S.signin = { busy: false, error: "" };
    if (S.shared) return openShared(S.shared.canister, S.shared.path);
    // the spaces decide where this person goes: into their space, or into the first test
    S.booting = true;
    render();
    await loadNotebooks();
    S.booting = false;
    if (!asVerified()) { S.as.step = "tap"; S.as.tap = { count: 0, start: 0, done: undefined }; }
    render();
  } catch (e) {
    S.booting = false;
    S.signin = { busy: false, error: errMsg(e) || "The identity provider did not respond" };
    render();
  }
}
async function signOut() {
  if ((await ask({ title: "Sign out?", body: "You will need Internet Identity to sign back in.", ok: "Sign out" })) === null) return;
  await saveAll();
  if (devMode) {
    store(DEV_ON, null);
    devId = undefined;
  } else await auth.signOut().catch(() => {});
  Object.assign(S, { identity: undefined, principal: "", notebooks: undefined, notebook: undefined, notes: undefined, error: "", isAdmin: false, admin: undefined });
  S.drafts.clear();
  S.as = { ...S.as, step: "landing", tap: { count: 0, start: 0, done: undefined }, pay: "", wallet: { loading: "", addrs: undefined, order: undefined } };
  location.hash = "#/";
  render();
}

let visited = false;
async function loadNotebooks() {
  try {
    if (!REGISTRY) throw new Error("The registry canister ID is missing from this deployment");
    registry().is_admin().then((v) => { if (v !== S.isAdmin) { S.isAdmin = v; render(); } }).catch(() => {});
    registry().flags().then((f) => { S.flags = f; render(); }).catch(() => {});
    void checkTownNews();
    // say hello once a load, so the town can count people who signed in without a notebook yet
    if (!visited) { visited = true; void registry().visit().catch(() => {}); }
    registry().price().then((p) => { S.price = p; }).catch(() => {});
    registry().tokens().then((t) => { S.tokens = t; }).catch(() => {});
    S.notebooks = await registry().my_notebooks();
    S.error = "";
    // a principal with a space passed the gate once, on some device: this one remembers it too
    if (S.notebooks[0]) store(`as-verified:${S.principal}`, "1");
    // home is the space itself once there is one; without one, the gate ends on the Fuel step
    if (location.hash === "#/" && S.notebooks[0] && asVerified()) { location.hash = `#/notebook/${S.notebooks[0].canister.toText()}`; return; }
    if (!S.notebooks[0]) resumeOrder();
    render();
    if (S.notebooks[0]) void loadWallet(S.notebooks[0].canister.toText());
    await Promise.all(S.notebooks.map(async (v) => {
      try {
        S.notebookInfo.set(v.canister.toText(), await notebookOf(v.canister.toText()).info());
      } catch {
        await loadHealth(v.canister.toText()); // frozen notebooks still report their health through the registry
      }
    }));
    void loadActivity();
  } catch (e) {
    S.error = errMsg(e);
    S.notebooks = [];
  }
  render();
}

const DEPOSIT_CHOICES = [1, 3, 5, 10];
const DEPOSIT_DEFAULT = 3;
/** How much ICP to turn into the new notebook's cycles: quick amounts (3 by default) or any other
 *  amount, never under `min` (what starting a notebook costs Agent Space, see pricing.ts). Resolves the
 *  e8s, or null when cancelled. */
function depositDialog(name: string, minE8s: bigint): Promise<bigint | null> {
  const min = Number(minE8s) / 1e8;
  const choices = [...new Set([min, ...DEPOSIT_CHOICES].filter((n) => n >= min))].sort((a, b) => a - b).slice(0, 4);
  const dflt = Math.max(DEPOSIT_DEFAULT, min);
  return new Promise((res) => {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="dep-t">
      <h2 id="dep-t">Keep “${esc(name)}” running</h2>
      <p class="muted">A space is its own canister and runs on cycles. The ICP you deposit becomes this space's cycles; top up again any time from Manage.${S.price > 0n ? ` Spawning also costs ${icp(S.price)} ICP.` : ""}</p>
      <div class="dep-choices" role="radiogroup" aria-label="Deposit">${choices.map((n) => `<label class="dep-choice"><input type="radio" name="amt" value="${n}" ${n === dflt ? "checked" : ""}><span>${n} ICP</span></label>`).join("")}<label class="dep-choice"><input type="radio" name="amt" value="other"><span>Other</span></label></div>
      <label class="field dep-other" hidden><span class="label">Amount (ICP, at least ${min})</span><input class="input" name="other" inputmode="decimal" placeholder="${min + 1}"></label>
      <p class="small muted">The minimum, ${min} ICP, is about what starting a space costs Agent Space (creating its canister and its first cycles) at today's ICP price.</p>
      <div class="actions"><button type="button" class="btn" data-x="cancel">Cancel</button><button type="submit" class="btn btn-primary" data-x="ok">${useOisy ? `Pay ${dflt} ICP in OISY` : `Deposit ${dflt} ICP`}</button></div>
    </form>`;
    const f = scrim.querySelector("form")!;
    const other = f.querySelector<HTMLInputElement>("[name=other]")!;
    const amount = (): number => { const v = f.querySelector<HTMLInputElement>("[name=amt]:checked")!.value; return v === "other" ? Number(other.value) : Number(v); };
    const sync = () => {
      const isOther = f.querySelector<HTMLInputElement>("[name=amt]:checked")!.value === "other";
      f.querySelector<HTMLElement>(".dep-other")!.hidden = !isOther;
      const n = amount();
      f.querySelector<HTMLElement>("[data-x=ok]")!.textContent = n >= min ? `${useOisy ? "Pay" : "Deposit"} ${n} ICP${useOisy ? " in OISY" : ""}` : `At least ${min} ICP`;
    };
    f.addEventListener("change", () => { sync(); if (f.querySelector<HTMLInputElement>("[name=amt]:checked")!.value === "other") other.focus(); });
    other.addEventListener("input", sync);
    const done = (v: bigint | null) => { scrim.remove(); document.removeEventListener("keydown", onKey); res(v); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && done(null);
    scrim.addEventListener("click", (e) => e.target === scrim && done(null));
    f.querySelector("[data-x=cancel]")!.addEventListener("click", () => done(null));
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const n = amount();
      if (!(n >= min)) return void toast(`The smallest deposit is ${min} ICP.`, "error");
      done(BigInt(Math.round(n * 1e8)));
    });
    document.addEventListener("keydown", onKey);
    document.body.append(scrim);
    f.querySelector<HTMLElement>("[data-x=ok]")!.focus();
  });
}
/** Spawn a notebook and fund it: one approval (OISY's popup, opened straight from the click) covers
 *  the spawn price and the deposit, then the registry spawns the canister and mints the deposit
 *  into its cycles. A failed deposit leaves the notebook created; Manage can top it up later. */
/** Pay (the deposit dialog, then OISY or the in-app wallet), spawn the canister and add its cycles.
 *  Resolves to the new notebook's id, or undefined when cancelled or refused. */
async function spawnNotebook(name: string, desc: string, card = false, after?: (id: string) => Promise<void>): Promise<string | undefined> {
  const deposit = card ? 0n : await depositDialog(name, minDepositE8s(await icpXdrRate()));
  if (deposit === null) return;
  S.busy = "create";
  S.error = "";
  const step = (t: string) => { S.createStep = t; render(); };
  try {
    let payer: Principal | undefined;
    const need = (S.price > 0n ? S.price + ICP_FEE : 0n) + (deposit > 0n ? deposit + ICP_FEE : 0n);
    if (need > 0n) { step(useOisy ? "Approve in OISY…" : "Approving…"); payer = await approvePayment(Principal.fromText(REGISTRY), need); }
    step("Spawning…");
    const r = S.price > 0n ? await registry().create_notebook_paid_by(name, payer!) : await registry().create_notebook(name);
    if (r.__kind__ === "Err") throw new Error(r.Err);
    if (desc) { try { await registry().set_notebook_meta(r.Ok.canister, null, desc); } catch { /* the card can be edited later */ } }
    let funded = "";
    if (deposit > 0n) {
      step("Adding cycles…");
      try {
        const t = await registry().top_up_notebook(r.Ok.canister, deposit, payer && payer.toText() !== S.principal ? payer : null);
        if (t.__kind__ === "Err") throw new Error(t.Err);
        funded = ` ${icp(deposit)} ICP became ${tc(t.Ok)} of cycles.`;
      } catch (e) { funded = ` The deposit did not go through (${errMsg(e)}); top it up from Manage.`; }
    }
    toast(`Your space is live.${funded}`, funded.includes("did not") ? "error" : "ok");
    if (after) await after(r.Ok.canister.toText());
    await loadNotebooks();
    return r.Ok.canister.toText();
  } catch (e) {
    S.error = errMsg(e);
  } finally {
    S.busy = "";
    S.createStep = "";
    render();
  }
}
async function createNotebook() {
  if (!S.newNotebook.trim()) return;
  const id = await spawnNotebook(S.newNotebook.trim(), S.newDesc.trim());
  if (!id) return;
  S.newNotebook = "";
  S.newDesc = "";
  void openNotebook(id);
}
/** Notebooks just made from an Obsidian import: their setup tour starts with examples unticked. */
const fromImport = new Set<string>();
/** Home screen: a new notebook from an Obsidian folder or zip. Payment comes first; the notes are
 *  written once the canister exists. */
async function importNewNotebook(picked: Incoming[], suggested: string) {
  const files = (await expandZips(picked)).filter((f) => !/(^|\/)\./.test(f.path));
  const notes = files.filter((f) => TEXT_EXT.test(f.path)).length;
  const other = files.filter((f) => !TEXT_EXT.test(f.path) && !!MIME[f.path.split(".").pop()!.toLowerCase()]).length;
  if (!notes && !other) return toast("Nothing importable in there: no markdown, text or supported attachments.", "error");
  const name = (await ask({ title: "New space from Obsidian", body: `${notes} note${notes === 1 ? "" : "s"}${other ? ` and ${other} attachment${other === 1 ? "" : "s"}` : ""} ready to import. Name the space, then choose its deposit: it is created once the payment goes through, and your notes are copied in right after.`, label: "Space name", value: suggested, ok: "Next" }))?.trim();
  if (!name) return;
  const id = await spawnNotebook(name, "");
  if (!id) return;
  fromImport.add(id);
  await openNotebook(id);
  if (S.notebook?.canister.toText() !== id || !S.notes) return;
  // a new notebook starts with index.md and Projects/First project.md: your files take their place
  const incoming = new Set(files.map((f) => f.path));
  for (const p of paths()) if (!incoming.has(p) && !isAgentPath(p)) await nb().delete_(p).catch(() => undefined);
  await importFiles(files, true);
}

function reindex() {
  S.idx = buildIndex(S.notes ?? []);
}

async function loadNotebook() {
  S.usage = undefined;
  const a = nb();
  const notes: Note[] = [];
  let after: string | null = null;
  do {
    const page: { notes: Note[]; next?: string | null } = unwrap(await a.read_page(after, 300));
    notes.push(...page.notes);
    after = page.next ?? null;
  } while (after);
  const [folders, info, topups, keys, shares, settings] = await Promise.all([a.folders(), a.info(), a.topups(10), a.agent_keys(), a.shares(), a.get_settings()]);
  S.agentKeys = keys.__kind__ === "Ok" ? keys.Ok : [];
  S.shares = shares.__kind__ === "Ok" ? shares.Ok : [];
  if (!isSandbox() && flag("problems")) { const c = S.notebook!.canister; void registry().problems_of(c).then((cards) => { for (const [path, card] of cards) S.myProblems.set(`${c.toText()}/${path}`, card); render(); }).catch(() => undefined); }
  try {
    const j = settings.__kind__ === "Ok" && settings.Ok ? (JSON.parse(settings.Ok) as Partial<Settings>) : {};
    S.settings = parseSettings(j);
  } catch {
    S.settings = parseSettings(undefined);
  }
  S.recent = JSON.parse(store(`nb-recent-${S.notebook!.canister.toText()}`) ?? "[]") as string[];
  const [cm, pub] = await Promise.all([a.all_comments(), a.published()]);
  S.comments = cm.__kind__ === "Ok" ? cm.Ok : [];
  S.published = pub ?? null;
  S.notes = notes.sort((x, y) => x.path.localeCompare(y.path));
  attachments.clear();
  S.folders = unwrap(folders);
  S.info = info;
  S.topups = topups;
  void nb().usage().then((u) => { S.usage = u; }).catch(() => {});
  for (const [p, d] of S.drafts) if (!d.dirty) S.drafts.delete(p);
  for (const p of S.panes) {
    p.tabs = p.tabs.filter((t) => note(t));
    if (p.active && !note(p.active)) p.active = p.tabs[0];
  }
  for (const p of paths()) void p;
  reindex();
}

async function openNotebook(id: string, path?: string) {
  const v = id === SANDBOX_ID ? sandboxRecord() : S.notebooks?.find((x) => x.canister.toText() === id);
  if (!v) return;
  S.notebook = v;
  S.notes = undefined;
  S.idx = buildIndex([]); // the last notebook's links would point at notes this one has not loaded
  S.drafts.clear();
  S.tab = "notes";
  S.chat = { input: "", busy: false, messages: [], excluded: new Set(JSON.parse(store(`nb-chat-off-${id}`) ?? "[]") as string[]), stage: "", garden: false, tidy: false };
  S.query = S.tag = "";
  S.error = "";
  S.info = undefined;
  S.frozen = false;
  S.attest = S.listing = S.tokenId = S.deposits = undefined;
  S.mobilePane = "files";
  graphPos.clear();
  miniPos.clear();
  // a link straight to a note (#/notebook/id/path) already names this notebook: rewriting it pushed
  // extra history entries, so Back took two presses to leave
  if (!location.hash.startsWith(`#/notebook/${id}`)) location.hash = `#/notebook/${id}`;
  render();
  try {
    await loadNotebook();
    restoreTabs();
    if (path && note(path)) await open(path);
    void sweepBoards();
    if (!isSandbox()) {
      if (!S.settings.onboarded) setTimeout(() => onboarding(), 400);
      void loadHealth(id).then((h) => { if (urgent(h) && S.notebook?.canister.toText() === id) { render(); freezeModal(id, h!); } });
    }
  } catch (e) {
    const h = await loadHealth(id);
    S.notes = [];
    S.folders = [];
    reindex();
    if (h?.frozen) {
      S.frozen = true;
      render();
      freezeModal(id, h);
      return;
    }
    toast(errMsg(e), "error");
  }
  render();
  if (path && note(path)) await open(path);
  else if (cur()) syncHash();
  if (lowCycles(S.info)) toast("This space is low on cycles. Top it up in Manage before it freezes.", "error");
}

async function loadSellInfo() {
  if (!S.notebook) return;
  const c = S.notebook.canister;
  try {
    nb().deposits().then((d) => { if (d.__kind__ === "Ok") { S.deposits = d.Ok; if (S.tab === "manage") render(); } }).catch(() => {});
    const [a, l, id, fee] = await Promise.all([registry().attestation(c), registry().listing(c), registry().token_id(c), registry().market_fee()]);
    S.attest = a ?? undefined;
    S.listing = l ?? undefined;
    S.tokenId = id ?? undefined;
    S.marketFee = Number(fee);
    if (!S.tokens.length) S.tokens = await registry().tokens();
  } catch { /* the sell card shows what it has */ }
  if (S.tab === "manage") render();
}

async function refreshInfo() {
  if (!S.notebook) return;
  try {
    const a = nb();
    [S.info, S.topups] = await Promise.all([a.info(), a.topups(10)]);
  } catch (e) {
    toast(errMsg(e), "error");
  }
  render();
}

function syncHash() {
  const c = cur();
  location.hash = `#/notebook/${S.notebook!.canister.toText()}${c ? `/${encodeURIComponent(c)}` : ""}`;
}

/** Open a note in the focused pane: replaces the active tab unless `newTab`; `paneId` targets a pane. */
/** A note with nothing in it yet: empty, or only front matter and a title. */
const blankNote = (text: string) => !frontmatter(text).body.replace(/^#[^\n]*\n?/, "").trim();
async function open(path: string, o: { newTab?: boolean; paneId?: number; view?: View } = {}) {
  const n = note(path);
  if (!n) return;
  const p = pane(o.paneId);
  S.focused = p.id;
  const i = p.tabs.indexOf(path);
  if (i >= 0) p.active = path;
  else if (o.newTab || !p.active) {
    p.tabs.push(path);
    p.active = path;
  } else {
    p.tabs[p.tabs.indexOf(p.active)] = path;
    p.active = path;
  }
  draftOf(path);
  S.recent = [path, ...S.recent.filter((r) => r !== path)].slice(0, 12);
  store("nb-last", `#/notebook/${S.notebook!.canister.toText()}/${encodeURIComponent(path)}`);
  { const lean = isLeanNote(draftOf(path).text) ? path : leanFor(path); void Promise.all([loadAttestations(path), lean && lean !== path ? loadAttestations(lean) : Promise.resolve()]).then(() => { if (cur() === path) { renderSide(); refreshPreviews(); } }); }
  if (shareFor(path) && !shareFor(path)!.share.public && !S.groupProgress.has(path)) void nb().progress(path).then((r) => { if (r.__kind__ === "Ok") { S.groupProgress.set(path, r.Ok); renderSide(); } }).catch(() => {});
  store(`nb-recent-${S.notebook!.canister.toText()}`, JSON.stringify(S.recent));
  if (S.mobile) {
    S.mobilePane = "note";
    p.view = "preview"; // reading mode first on a phone
  } else if (o.view) p.view = o.view;
  // a note opens in reading mode when it has something in it, in editing mode when it is blank; switching between open tabs keeps the pane as it is
  else if (i < 0 && path.endsWith(".md")) p.view = blankNote(draftOf(path).text) ? "edit" : "preview";
  S.tab = "notes";
  syncHash();
  render();
}

function closeTab(paneId: number, path: string) {
  const p = pane(paneId);
  const i = p.tabs.indexOf(path);
  if (i < 0) return;
  p.tabs.splice(i, 1);
  if (p.active === path) p.active = p.tabs[Math.min(i, p.tabs.length - 1)];
  if (!p.tabs.length && S.panes.length > 1) {
    S.panes = S.panes.filter((x) => x.id !== p.id);
    if (S.focused === p.id) S.focused = S.panes[0].id;
  }
  if (!S.panes.flatMap((x) => x.tabs).includes(path) && !draftOf(path).dirty) S.drafts.delete(path);
  syncHash();
  render();
}

/** Move a tab (or a file from the tree) into `to` at `index`, or into a new pane after `to` when `split`. */
function moveTab(from: number | undefined, path: string, to: number, index?: number, split = false) {
  if (from !== undefined && from !== to) {
    const src = pane(from);
    src.tabs = src.tabs.filter((t) => t !== path);
    if (src.active === path) src.active = src.tabs[0];
  }
  let dst = pane(to);
  if (split) {
    const np = newPane(dst.view);
    S.panes.splice(S.panes.indexOf(dst) + 1, 0, np);
    dst = np;
  } else if (from === to) dst.tabs = dst.tabs.filter((t) => t !== path);
  if (!dst.tabs.includes(path)) dst.tabs.splice(index === undefined ? dst.tabs.length : Math.min(index, dst.tabs.length), 0, path);
  dst.active = path;
  S.focused = dst.id;
  S.panes = S.panes.filter((p, i) => p.tabs.length || (i === 0 && S.panes.length === 1) || p.id === dst.id);
  if (!S.panes.find((p) => p.id === S.focused)) S.focused = S.panes[0].id;
  draftOf(path);
  syncHash();
  render();
}

/** Edit → split → reading → edit, per pane; the desktop default is remembered. */
/** Wrap the editor selection in `==…==`, or unwrap it when it already is a highlight (${MOD}⇧H). */
function toggleHighlight() {
  const host = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(".cm-host");
  const ed = host && editors.get(host);
  if (!ed) return;
  const { view } = ed;
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;
  const inner = doc.sliceString(from, to);
  if (from >= 2 && doc.sliceString(from - 2, from) === "==" && doc.sliceString(to, to + 2) === "==") {
    view.dispatch({ changes: [{ from: from - 2, to: from }, { from: to, to: to + 2 }], selection: { anchor: from - 2, head: to - 2 } });
  } else if (inner.startsWith("==") && inner.endsWith("==") && inner.length >= 4) {
    view.dispatch({ changes: { from, to, insert: inner.slice(2, -2) }, selection: { anchor: from, head: to - 4 } });
  } else {
    view.dispatch({ changes: { from, to, insert: `==${inner}==` }, selection: { anchor: from + 2, head: to + 2 } });
  }
  view.focus();
}

function toggleSide(which: "side" | "aside") {
  const ws = () => document.querySelector<HTMLElement>(".shell:not(.is-mobile) .workspace");
  const from = ws() ? getComputedStyle(ws()!).gridTemplateColumns : "";
  if (S.board) { const b = S.board; if (which === "side") { b.showSide = !b.showSide; store("nb-board-side", b.showSide ? "1" : "0"); } else { b.showAside = !b.showAside; store("nb-board-aside", b.showAside ? "1" : "0"); } }
  else if (S.community) { const c = S.community; if (which === "side") { c.showChannels = !c.showChannels; store("nb-chat-side", c.showChannels ? "1" : "0"); } else { c.showOnline = !c.showOnline; store("nb-chat-aside", c.showOnline ? "1" : "0"); } }
  else if (which === "side") { S.sideOpen = !S.sideOpen; store("nb-side", S.sideOpen ? "1" : "0"); } else { S.asideOpen = !S.asideOpen; store("nb-aside", S.asideOpen ? "1" : "0"); }
  render();
  // the render swapped the DOM, so slide the columns from where they were (the closing panel stays drawn until it is gone)
  const w = ws(), panel = w?.querySelector<HTMLElement>(`:scope > .${which}`);
  if (!w || !from || !panel || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const opening = !w.classList.contains(which === "side" ? "no-side" : "no-aside");
  w.classList.add("sliding");
  const to = getComputedStyle(w).gridTemplateColumns, o = { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" };
  const done = () => w.classList.remove("sliding");
  w.animate([{ gridTemplateColumns: from }, { gridTemplateColumns: to }], o).finished.then(done, done);
  panel.animate([{ opacity: opening ? 0 : 1 }, { opacity: opening ? 1 : 0 }], o);
}

function cycleView(paneId?: number) {
  const p = pane(paneId);
  p.view = p.view === "edit" ? "split" : p.view === "split" ? "preview" : "edit";
  if (!S.mobile) store("nb-view", p.view);
  render();
}

function splitRight(paneId: number) {
  const p = pane(paneId);
  if (!p.active) return toast("Open a note first, then split.", "info");
  const np = newPane(p.view);
  np.tabs = [p.active];
  np.active = p.active;
  S.panes.splice(S.panes.indexOf(p) + 1, 0, np);
  S.focused = np.id;
  render();
}

const saveTimers = new Map<string, number>();
function scheduleSave(path: string) {
  clearTimeout(saveTimers.get(path));
  saveTimers.set(path, window.setTimeout(() => void save(path), 1000));
}
async function save(path: string) {
  clearTimeout(saveTimers.get(path));
  const d = S.drafts.get(path);
  if (!S.notebook || !d || !d.dirty || d.saving || !note(path)) return;
  const content = d.text;
  d.saving = true;
  status(path);
  try {
    const m = unwrap(await nb().write(path, content));
    const n = note(path);
    if (n) {
      n.content = content;
      n.modified = m.modified;
    }
    if (d.text === content) d.dirty = false;
    reindex();
    renderSide();
    if (!d.dirty) void runRules(path);
    if (!d.dirty) republishProblem(path, content);
  } catch (e) {
    toast(`Could not save ${path}: ${errMsg(e)}`, "error");
  }
  d.saving = false;
  status(path);
  if (d.dirty) scheduleSave(path);
}

async function saveAll() {
  await Promise.all([...S.drafts.keys()].map((p) => save(p)));
}

/** Apply a textarea edit from the editor helpers and let the normal input flow run. */
function applyEdit(ta: HTMLTextAreaElement, e: { value: string; start: number; end: number }) {
  ta.value = e.value;
  ta.setSelectionRange(e.start, e.end);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}
function onDraftInput(path: string, v: string, from?: HTMLElement) {
  const d = draftOf(path);
  if (d.text === v && !d.dirty) return;
  d.text = v;
  d.dirty = true;
  if (S.shared && S.shared.path === path) {
    S.shared.dirty = true;
    clearTimeout(sharedSaveTimer);
    sharedSaveTimer = window.setTimeout(() => void saveShared(), 1000);
    return;
  }
  status(path);
  for (const [host, ed] of editors) if (host !== from && host.dataset.cm === path) ed.setDoc(v);
  document.querySelectorAll<HTMLElement>(`[data-preview-path="${CSS.escape(path)}"]`).forEach((pv) => {
    pv.innerHTML = previewHtml(path, v);
    afterRender(pv);
  });
  document.querySelectorAll<HTMLElement>(`[data-counts-path="${CSS.escape(path)}"]`).forEach((el) => (el.textContent = `${words(v)} words · ${v.length} characters`));
  document.querySelectorAll<HTMLElement>(`.kb[data-kanban="${CSS.escape(path)}"]`).forEach((kb) => { kb.innerHTML = boardHtml(path, v); afterRender(kb); });
  if (document.querySelector(`.qz[data-quiz="${CSS.escape(path)}"]`)) refreshQuiz(path);
  if (from?.closest(".cm-host") && document.querySelector(`.nbk[data-ipynb="${CSS.escape(path)}"]`)) refreshNotebook(path);
  document.querySelectorAll<HTMLElement>(`.cv-wrap[data-canvas="${CSS.escape(path)}"]`).forEach((cv) => { cv.innerHTML = canvasSvg(v); cv.dataset.mounted = ""; mountCanvasPanZoom(cv); cv.dataset.mounted = "1"; });
  scheduleSave(path);
}

async function newNote(name?: string, folder?: string, paneId?: number, content = "") {
  if (!S.notes) return;
  const c = cur();
  let where = folder ?? (c ? dir(c) : "");
  if (isAgentPath(where)) where = "";
  const path = name ? (/\.(md|ipynb|canvas|sheet|dash)$/i.test(name) ? name : `${name}.md`) : untitled(paths(), where);
  try {
    const m = unwrap(await nb().write(path, content));
    S.notes.push({ path, content, created: m.created, modified: m.modified });
    S.notes.sort((x, y) => x.path.localeCompare(y.path));
    if (dir(path) && !S.folders.includes(dir(path))) S.folders = [...S.folders, dir(path)].sort();
    reindex();
    await open(path, { newTab: true, paneId, view: "edit" });
    if (S.mobile && !isExcalidraw(path)) {
      pane().view = "edit";
      render();
    }
    app.querySelector<HTMLInputElement>(`[name="title"][data-pane="${pane().id}"]`)?.select();
  } catch (e) {
    toast(errMsg(e), "error");
    render();
  }
}

/** A new Excalidraw drawing (`Drawing.excalidraw.md`, Obsidian's plugin format) in `folder`. */
function newDrawing(folder?: string) {
  const where = folder ?? (cur() ? dir(cur()!) : "");
  const have = new Set(paths());
  let name = "Drawing";
  for (let i = 1; have.has(`${where ? `${where}/` : ""}${name}.excalidraw.md`); i++) name = `Drawing ${i}`;
  return newNote(`${where ? `${where}/` : ""}${name}.excalidraw.md`, where, undefined, NEW_DRAWING);
}

/** Today's note in `Daily/`, from `Templates/Daily.md` when there is one. */
async function openDaily() {
  if (!S.notes) return;
  const path = dailyPath();
  if (note(path)) return open(path);
  const tpl = note("Templates/Daily.md")?.content;
  const content = tpl ? fillTemplate(tpl, { title: stem(path).split("/").pop()! }) : `# ${stem(path).split("/").pop()}\n\n`;
  await newNote(path, "Daily", undefined, content);
}
/** Pick a note from `Templates/`, name the new note, fill `{{date}}`-style tokens. */
async function newFromTemplate(folder?: string) {
  const tpls = paths().filter((p) => p.startsWith("Templates/") && p.endsWith(".md"));
  const t = await ask({ title: "New note from template", label: "Template", choices: [...tpls.map((p) => ({ value: p, label: stem(p).slice("Templates/".length) })), ...Object.keys(BUILTIN_TEMPLATES).map((k) => ({ value: `builtin:${k}`, label: `${k} (built in)` }))] });
  if (!t) return;
  const name = await ask({ title: "Name the note", label: "Name", placeholder: "Meeting with Ada", ok: "Create" });
  if (!name?.trim()) return;
  const body = t.startsWith("builtin:") ? BUILTIN_TEMPLATES[t.slice(8)] : note(t)!.content;
  const sub = t === "builtin:Person" ? "People" : t === "builtin:Project" ? "" : t === "builtin:Meeting" || t === "builtin:1:1" ? "Meetings" : "";
  const where = folder ?? (sub || (cur() && !isAgentPath(cur()!) ? dir(cur()!) : ""));
  await newNote(`${where ? `${where}/` : ""}${name.trim()}`, where, undefined, fillTemplate(body, { title: name.trim() }));
}
async function saveSettings() {
  try {
    unwrap(await nb().set_settings(JSON.stringify(S.settings)));
  } catch (e) {
    toast(errMsg(e), "error");
  }
}
/** Notes and folders pinned to the top of the file pane, kept in `settings.bookmarks`; a folder
 *  is stored with a trailing slash. */
const MAX_PINS = 7;
const isFolderPin = (p: string) => p.endsWith("/");
const pinsNow = () => S.settings.bookmarks.filter((p) => (isFolderPin(p) ? S.folders.includes(p.slice(0, -1)) || paths().some((x) => x.startsWith(p)) : !!note(p))).slice(0, MAX_PINS);
const isPinned = (p: string) => S.settings.bookmarks.includes(p);
async function togglePin(path: string) {
  const has = isPinned(path);
  if (!has && pinsNow().length >= MAX_PINS) return toast(`Up to ${MAX_PINS} can be pinned. Unpin one first.`, "info");
  S.settings.bookmarks = has ? S.settings.bookmarks.filter((p) => p !== path) : [...S.settings.bookmarks.filter((p) => pinsNow().includes(p)), path];
  render();
  await saveSettings();
  toast(has ? "Unpinned." : "Pinned to the top of your files.", "ok");
}
/** After a rename or move: the pin (or pins inside a moved folder) follow. */
function repin(from: string, to: string) {
  const next = S.settings.bookmarks.map((p) => (p === from ? to : p.startsWith(`${from}/`) ? `${to}/${p.slice(from.length + 1)}` : p));
  if (next.some((p, i) => p !== S.settings.bookmarks[i])) { S.settings.bookmarks = next; void saveSettings(); }
}
/** Earlier versions of a note with a line diff against what is open now, and a restore button. */
async function historyDialog(path: string) {
  let revs: Revision[] = [];
  try {
    revs = unwrap(await nb().history(path));
  } catch (e) {
    return toast(errMsg(e), "error");
  }
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const list = revs.length ? revs.map((r) => `<div class="hist-row"><button type="button" class="btn btn-ghost" data-seq="${r.seq}">${icon("history")}v${r.seq}</button><span>${when(r.modified)}</span><span class="muted small">${kb(r.size)}${r.agent ? ` · agent ${esc(r.agent)}` : r.by.toText() === S.principal ? "" : ` · ${shortPrincipal(r.by.toText())}`}</span><span class="grow"></span><button type="button" class="btn" data-restore="${r.seq}">Restore</button></div>`).join("") : `<p class="muted">No earlier versions yet; one is kept every time the content changes (last 20).</p>`;
  scrim.innerHTML = `<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="hs-t"><h2 id="hs-t">${icon("history")} History of “${esc(stem(path))}”</h2><div class="runs">${list}</div><div class="diff" data-diff hidden></div><div class="actions"><button type="button" class="btn" data-x="cancel">Close</button></div></div>`;
  const close = () => scrim.remove();
  scrim.addEventListener("click", async (e) => {
    if (e.target === scrim) return close();
    const t = e.target as HTMLElement;
    if (t.closest("[data-x=cancel]")) return close();
    const seqEl = t.closest<HTMLElement>("[data-seq], [data-restore]");
    if (!seqEl) return;
    const seq = BigInt(seqEl.dataset.seq ?? seqEl.dataset.restore!);
    try {
      const rev = unwrap(await nb().revision(path, seq));
      if (seqEl.dataset.restore) {
        onDraftInput(path, rev.content);
        await save(path);
        close();
        render();
        toast(`Restored v${seq}; the replaced version is in the history too.`, "ok");
        return;
      }
      const box = scrim.querySelector<HTMLElement>("[data-diff]")!;
      box.hidden = false;
      box.innerHTML = `<div class="small muted" style="padding:6px 10px">v${seq} → now</div>` + diffLines(rev.content, draftOf(path).text).map((r) => `<div class="${r.kind === "+" ? "add" : r.kind === "-" ? "del" : ""}">${esc(r.text) || " "}</div>`).join("");
    } catch (err) {
      toast(errMsg(err), "error");
    }
  });
  document.body.append(scrim);
}

function retarget(from: string, to: string) {
  for (const p of S.panes) {
    p.tabs = p.tabs.map((t) => (t === from ? to : t));
    if (p.active === from) p.active = to;
  }
  const d = S.drafts.get(from);
  if (d) {
    S.drafts.delete(from);
    S.drafts.set(to, d);
  }
}

async function renamePath(from: string, to: string) {
  if (!S.notes) return;
  const target = to.trim().replace(/^\/+/, "");
  const path = target.endsWith(".md") || !from.endsWith(".md") ? target : `${target}.md`;
  if (!target || path === from) return render();
  await save(from);
  try {
    const r = unwrap(await nb().rename(from, path));
    retarget(from, path);
    repin(from, path);
    await loadNotebook();
    const n = r.relinked.filter((p) => p !== path).length;
    toast(n ? `Renamed. Links updated in ${n} note${n === 1 ? "" : "s"}.` : "Renamed.", "ok");
    syncHash();
  } catch (e) {
    toast(errMsg(e), "error");
  }
  render();
}

async function deletePath(path: string) {
  if (!S.notes) return;
  if (!(await confirmDialog(`Delete “${stem(path)}”?`, "The note is removed from the canister. Links to it in other notes become unresolved."))) return;
  clearTimeout(saveTimers.get(path));
  S.drafts.delete(path);
  try {
    unwrap(await nb().delete_(path));
    S.notes = S.notes.filter((n) => n.path !== path);
    for (const p of S.panes) {
      const i = p.tabs.indexOf(path);
      if (i >= 0) {
        p.tabs.splice(i, 1);
        if (p.active === path) p.active = p.tabs[Math.min(i, p.tabs.length - 1)];
      }
    }
    S.panes = S.panes.filter((p, i) => p.tabs.length || i === 0);
    if (!S.panes.find((p) => p.id === S.focused)) S.focused = S.panes[0].id;
    reindex();
    toast(`Deleted ${path}.`, "ok");
    syncHash();
  } catch (e) {
    toast(errMsg(e), "error");
  }
  render();
}

async function moveTo(path: string) {
  const choices = [{ value: "", label: "/ (space root)" }, ...S.folders.map((f) => ({ value: f, label: `/${f}` }))];
  const f = await ask({ title: `Move “${stem(path)}”`, label: "Folder", choices, value: dir(path) });
  if (f === null) return;
  const name = path.split("/").pop()!;
  await renamePath(path, f ? `${f}/${name}` : name);
}

async function newFolder(parent = "") {
  const name = await ask({ title: "New folder", label: parent ? `Inside /${parent}` : "In the space root", placeholder: "Folder name", ok: "Create" });
  if (!name?.trim()) return;
  try {
    const p = unwrap(await nb().mkdir(parent ? `${parent}/${name.trim()}` : name.trim()));
    S.folders = unwrap(await nb().folders());
    S.collapsed.delete(parent);
    toast(`Folder /${p} created.`, "ok");
  } catch (e) {
    toast(errMsg(e), "error");
  }
  renderSide();
}

async function renameFolder(path: string, target?: string) {
  const to = target ?? (await ask({ title: "Rename or move folder", label: "Folder path", value: path, ok: "Rename" }));
  if (!to?.trim() || to.trim() === path) return;
  await saveAll();
  try {
    const r = unwrap(await nb().rename_folder(path, to.trim()));
    for (const t of S.panes.flatMap((p) => p.tabs)) if (t.startsWith(`${path}/`)) retarget(t, `${to.trim()}${t.slice(path.length)}`);
    repin(path, to.trim());
    await loadNotebook();
    toast(`Moved ${r.moved} file${r.moved === 1 ? "" : "s"}${r.relinked.length ? `, links updated in ${r.relinked.length} note${r.relinked.length === 1 ? "" : "s"}` : ""}.`, "ok");
    syncHash();
  } catch (e) {
    toast(errMsg(e), "error");
  }
  render();
}

async function deleteFolder(path: string) {
  const n = paths().filter((p) => p.startsWith(`${path}/`)).length;
  if (!(await confirmDialog(`Delete folder “${path}”?`, n ? `${n} note${n === 1 ? "" : "s"} inside will be deleted too. This cannot be undone.` : "The folder is empty."))) return;
  for (const t of [...S.drafts.keys()]) if (t.startsWith(`${path}/`)) { clearTimeout(saveTimers.get(t)); S.drafts.delete(t); }
  try {
    const gone = unwrap(await nb().delete_folder(path));
    await loadNotebook();
    S.panes = S.panes.filter((p, i) => p.tabs.length || i === 0);
    if (!S.panes.find((p) => p.id === S.focused)) S.focused = S.panes[0].id;
    toast(`Deleted /${path} and ${gone} file${gone === 1 ? "" : "s"}.`, "ok");
    syncHash();
  } catch (e) {
    toast(errMsg(e), "error");
  }
  render();
}

/** Everything in the notebook as a zip, built in the browser from what is already loaded. */
function deleteCard(): string {
  const i = S.info;
  return `<div class="card band danger-zone"><h2>${icon("trash")} Delete this space</h2><p class="muted small">Deletes the canister for good: every note, attachment, comment and its history. This cannot be undone, so download a zip first. ${i ? `Its ${tc(i.cycles)} left go back to Agent Space. The wallet must hold under $5 first: move anything more out, or the deletion is refused.` : ""}</p>
    <div class="row tight"><button type="button" class="btn" data-action="download">${icon("download")}Download a zip first</button><button type="button" class="btn btn-danger" data-action="nb-delete">${icon("trash")}Delete space…</button></div></div>`;
}
async function deleteNotebook() {
  const nb = S.notebook;
  if (!nb) return;
  const others = (S.notebooks ?? []).filter((n) => n.canister.toText() !== nb.canister.toText());
  const typed = await ask({ title: `Delete "${nb.name}" forever?`, body: "Every note, attachment and its history will be gone. Nobody, not even Agent Space, can bring it back.", label: `Type ${nb.name} to confirm`, placeholder: nb.name, ok: "Delete forever", danger: true });
  if (typed === null) return;
  if (typed.trim() !== nb.name) return void toast("The name did not match, so nothing was deleted.", "info");
  await saveAll().catch(() => {});
  const r = await registry().delete_notebook(nb.canister, null).catch((e) => ({ __kind__: "Err", Err: errMsg(e) }) as const);
  if (r.__kind__ !== "Ok") return void toast(`Not deleted: ${r.Err}`, "error");
  const id = nb.canister.toText();
  S.notebooks = others;
  if (store("nb-last")?.includes(id)) store("nb-last", null);
  S.notebook = undefined;
  S.notes = undefined;
  location.hash = "#/";
  render();
  toast(`Deleted your space${r.Ok > 0n ? `; ${tc(r.Ok)} went back to Agent Space` : ""}.`, "ok");
}
async function downloadNotebook() {
  if (!S.notes || !S.notebook) return;
  const missing = S.notes.filter((n) => isAttachment(n.path) && !attachments.has(n.path));
  if (missing.length) {
    toast(`Fetching ${missing.length} attachment${missing.length === 1 ? "" : "s"}…`);
    await Promise.all(missing.map(async (n) => {
      const r = await nb().read(n.path);
      if (r.__kind__ === "Ok") attachments.set(n.path, r.Ok.content);
    }));
  }
  const entries = [
    ...S.folders.map((f) => ({ path: `${f}/`, dir: true })),
    ...S.notes.map((n) => {
      const text = isAttachment(n.path) ? attachments.get(n.path) ?? "" : draftOf(n.path).text;
      const m = /^data:[^;,]+;base64,(.*)$/s.exec(text);
      return { path: n.path, data: m ? Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)) : text, mtime: new Date(Number(n.modified / 1_000_000n)) };
    }),
  ];
  const blob = new Blob([zip(entries) as BlobPart], { type: "application/zip" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${S.notebook.name.replace(/[\\/:*?"<>|]/g, "-")}.zip` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  toast(`Downloading ${S.notes.length} files as ${a.download}.`, "ok");
}

/** Follow a `[[link]]` (with optional `#heading` / `#^block`): open the note, or create it when nothing matches. */
async function follow(raw: string, newTab = false) {
  if (!S.notes) return;
  const hash = raw.indexOf("#");
  const target = hash >= 0 ? raw.slice(0, hash).trim() : raw.trim();
  const sub = hash >= 0 ? raw.slice(hash + 1).trim() : "";
  const dest = target ? resolveLink(target) : cur();
  if (dest) {
    if (sub) pendingScroll = { path: dest, target: sub };
    if (isAttachment(dest) && !dest.match(/\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|mp3|wav|ogg|m4a|flac|mp4|webm|mov|m4v)$/i)) return openAttachment(dest);
    await open(dest, { newTab });
    if (sub) scrollPending();
    return;
  }
  if (await ask({ title: `No note named “${target}”`, body: "Create it now? The link will resolve as soon as it exists.", ok: "Create" }).then((v) => v !== null)) await newNote(target);
}
/** PDFs and other non-inline attachments open in a new browser tab from their data. */
async function openAttachment(path: string) {
  let data = attachments.get(path);
  if (!data) {
    const r = await nb().read(path);
    if (r.__kind__ !== "Ok") return toast(describe(r.Err), "error");
    data = r.Ok.content;
    attachments.set(path, data);
  }
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(data);
  if (!m) return toast("This file is not a stored attachment.", "error");
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: m[1] }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---------- import: an Obsidian folder or a zip of one ----------

const TEXT_EXT = /\.(md|markdown|txt|canvas|excalidraw|json|csv|yaml|yml|base|css|js|html|ipynb)$/i;
const MAX_ATTACHMENT = 700_000;
// --- PDF viewer: `![[https://….pdf]]` links (fetched by the browser when the site allows it, else
// by the notebook) and PDFs saved in the notebook. Fetched bytes are cached on this device, and the
// drawn pages are kept as images so a re-render does not redraw them.
const PDF_FIRST = 3;
const pdfBytesMem = new Map<string, Uint8Array>();
const pdfShots = new Map<string, { pages: string[]; total: number }>();
const isPdfBytes = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
const dataUrlBytes = (d: string) => Uint8Array.from(atob(d.slice(d.indexOf(",") + 1)), (c) => c.charCodeAt(0));
async function fetchPdf(url: string): Promise<Uint8Array> {
  try {
    const r = await fetch(url, { mode: "cors", credentials: "omit" });
    if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); if (isPdfBytes(b)) return b; }
  } catch { /* the site does not let browsers read it; the notebook can */ }
  const got = unwrap(await nb().fetch_url(url));
  const b = got.bytes instanceof Uint8Array ? got.bytes : new Uint8Array(got.bytes);
  if (!isPdfBytes(b)) throw new Error("that link is not a PDF");
  return b;
}
async function pdfBytesFor(el: HTMLElement, load: boolean): Promise<Uint8Array | undefined> {
  const att = el.dataset.pdfAttach;
  if (att) { const d = attachment(att); return d ? dataUrlBytes(d) : undefined; }
  const url = el.dataset.pdfUrl!;
  let b = pdfBytesMem.get(url);
  if (!b && load) b = await fetchPdf(url);
  if (b) pdfBytesMem.set(url, b);
  return b;
}
function pdfActions(el: HTMLElement, total: number, shown: number, size?: number): string {
  const url = el.dataset.pdfUrl;
  return `${shown < total ? `<button type="button" class="btn btn-ghost" data-action="pdf-all">Show all ${total} pages</button>` : ""}${url && size !== undefined ? (size <= MAX_ATTACHMENT ? `<button type="button" class="btn btn-ghost" data-action="pdf-save" title="Keep the PDF in this space, with its text as searchable notes">${icon("download")}Save a copy</button>` : `<span class="small faint" title="Space files hold up to ${Math.round(MAX_ATTACHMENT / 1000)} KB">too big to save here</span>`) : ""}${url ? `<a class="btn btn-ghost" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon("link")}Original</a>` : ""}`;
}
async function drawPdf(el: HTMLElement, all = false) {
  const src = el.dataset.pdfUrl ?? el.dataset.pdfAttach!;
  const body = el.querySelector<HTMLElement>(".pdf-body")!;
  const meta = el.querySelector<HTMLElement>(".pdf-meta")!;
  const width = Math.min(body.clientWidth || 640, 900);
  const key = `${src}|${all}|${Math.round(width / 50)}`;
  const shot = pdfShots.get(key);
  if (shot) {
    body.innerHTML = shot.pages.map((p, i) => `<img class="pdf-page" src="${p}" alt="Page ${i + 1}">`).join("");
    meta.innerHTML = `${shot.total} page${shot.total === 1 ? "" : "s"}${pdfActions(el, shot.total, shot.pages.length, el.dataset.pdfUrl ? pdfBytesMem.get(el.dataset.pdfUrl)?.length : undefined)}`;
    return;
  }
  let bytes: Uint8Array | undefined;
  try { bytes = await pdfBytesFor(el, false); } catch { bytes = undefined; }
  if (!bytes) {
    if (el.dataset.pdfAttach) return; // still loading; the preview re-renders when it arrives
    body.innerHTML = `<button type="button" class="btn" data-action="pdf-load">${icon("file")}Show this PDF</button><span class="small muted">Your space fetches it once (about 0.02 TC of its cycles), then it is kept on this device.</span>`;
    return;
  }
  body.innerHTML = `<span class="small muted">Drawing pages…</span>`;
  const pdfjs = await pdfjsLib();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const n = all ? doc.numPages : Math.min(doc.numPages, PDF_FIRST);
  const pages: string[] = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * Math.min(2, window.devicePixelRatio || 1) });
    const c = document.createElement("canvas");
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
    pages.push(c.toDataURL("image/jpeg", 0.85));
  }
  pdfShots.set(key, { pages, total: doc.numPages });
  if (el.isConnected) void drawPdf(el, all);
}
function hydratePdfs(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(".pdf-embed:not([data-done])").forEach((el) => { el.dataset.done = "1"; void drawPdf(el, el.dataset.all === "1").catch((e) => { el.querySelector(".pdf-body")!.innerHTML = `<span class="small" style="color:var(--danger)">Could not show it: ${esc(errMsg(e))}</span>`; }); });
}
/** Keep a fetched PDF in the notebook next to the note, with one searchable note per page, and point the embed at the copy. */
async function savePdfCopy(el: HTMLElement) {
  const url = el.dataset.pdfUrl!;
  const bytes = pdfBytesMem.get(url);
  const from = cur();
  if (!bytes || !from) return;
  const name = (decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || "document").replace(/\.pdf$/i, "").replace(/[^\w .()-]+/g, " ").trim() || "document") + ".pdf";
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  const path = `${dir}${name}`;
  const pages = await pdfPages(bytes).catch(() => [] as string[]);
  await createQuiet(path, `data:application/pdf;base64,${b64(bytes)}`);
  for (const [i, text] of pages.entries()) await createQuiet(`${path.replace(/\.pdf$/i, "")}/Page ${String(i + 1).padStart(3, "0")}.md`, `---\nsource: ${url}\n---\n\n# ${name.replace(/\.pdf$/i, "")} · page ${i + 1}\n\n${text.trim() || "_(no text on this page)_"}\n`);
  const text = S.drafts.get(from)?.text ?? note(from)?.content ?? "";
  const swapped = text.split(url).join(name);
  if (swapped !== text) await writeNote(from, swapped);
  toast(`Saved ${name}${pages.length ? ` and ${pages.length} page note${pages.length === 1 ? "" : "s"} you can search` : ""}.`, "ok");
}

const BATCH_BYTES = 1_400_000;
type Incoming = { path: string; bytes: Uint8Array };
/** pdf.js, loaded on first use. */
async function pdfjsLib() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default as string;
  return pdfjs;
}
/** The text of each page of a PDF, through pdf.js loaded on first use. */
async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await pdfjsLib();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let last = -1;
    let text = "";
    for (const it of tc.items as { str: string; transform: number[] }[]) {
      const y = Math.round(it.transform[5]);
      text += (last >= 0 && Math.abs(y - last) > 2 ? "\n" : "") + it.str + (it.str.endsWith(" ") ? "" : " ");
      last = y;
    }
    out.push(text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n"));
  }
  return out;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", avif: "image/avif", ico: "image/x-icon", pdf: "application/pdf", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/mp4" };

/** Files from a dropped or picked folder; the top-level folder name is stripped. */
async function filesFromList(list: FileList | File[]): Promise<Incoming[]> {
  const files = [...list].filter((f) => f.size > 0 || f.name);
  const roots = new Set(files.map((f) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).split("/")[0]));
  const strip = files.length > 1 && roots.size === 1 && files.every((f) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || "").includes("/"));
  return Promise.all(files.map(async (f) => {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    return { path: strip ? rel.split("/").slice(1).join("/") : rel, bytes: new Uint8Array(await f.arrayBuffer()) };
  }));
}
async function filesFromDrop(dt: DataTransfer): Promise<Incoming[]> {
  const out: Incoming[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const f = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ path: prefix + f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        for (const e of batch) await walk(e, `${prefix}${entry.name}/`);
      } while (batch.length);
    }
  };
  const items = [...dt.items];
  const entries = items.map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return filesFromList(dt.files);
  for (const e of entries) await walk(e, "");
  // a single dropped folder is the Obsidian folder itself: strip its name
  if (entries.length === 1 && entries[0].isDirectory) return out.map((f) => ({ ...f, path: f.path.split("/").slice(1).join("/") }));
  return out;
}

/** Zips opened into their files (a single top-level folder stripped), everything else as it is. */
async function expandZips(files: Incoming[]): Promise<Incoming[]> {
  const out: Incoming[] = [];
  for (const f of files) {
    if (!/\.zip$/i.test(f.path)) { out.push(f); continue; }
    const inner = (await unzip(f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength) as ArrayBuffer)).filter((e) => !e.dir);
    const roots = new Set(inner.map((e) => e.path.split("/")[0]));
    const strip = roots.size === 1 && inner.every((e) => e.path.includes("/"));
    out.push(...inner.map((e) => ({ path: strip ? e.path.split("/").slice(1).join("/") : e.path, bytes: e.data })));
  }
  return out;
}
/** Import files into the open notebook: text as-is, small attachments as data: URLs, dotfolders skipped. */
async function importFiles(incoming: Incoming[], overwrite: boolean, restore = false) {
  if (!S.notebook || !S.notes) return;
  const dec = new TextDecoder();
  const batch: [string, string][] = [];
  const skipped: string[] = [];
  let zips = 0;
  for (const f of incoming) {
    if (/(^|\/)\./.test(f.path)) continue; // .obsidian, .trash, .DS_Store
    if (/\.zip$/i.test(f.path)) { zips++; incoming.push(...(await expandZips([f]))); continue; }
    const ext = f.path.split(".").pop()!.toLowerCase();
    if (ext === "pdf") {
      try {
        const pages = await pdfPages(f.bytes);
        const stemName = f.path.replace(/\.pdf$/i, "");
        pages.forEach((text, i) => batch.push([`${stemName}/Page ${String(i + 1).padStart(3, "0")}.md`, `---\nsource: ${f.path.split("/").pop()}\n---\n\n# ${title(stemName)} · page ${i + 1}\n\n${text.trim() || "_(no text on this page)_"}\n`]));
        if (f.bytes.length <= MAX_ATTACHMENT && MIME[ext]) batch.push([f.path, `data:${MIME[ext]};base64,${b64(f.bytes)}`]);
        continue;
      } catch { skipped.push(`${f.path} (could not read the PDF)`); continue; }
    }
    if (TEXT_EXT.test(f.path)) batch.push([f.path, dec.decode(f.bytes)]);
    else if (MIME[ext]) {
      if (f.bytes.length > MAX_ATTACHMENT) skipped.push(`${f.path} (over ${Math.round(MAX_ATTACHMENT / 1000)} KB)`);
      else batch.push([f.path, `data:${MIME[ext]};base64,${b64(f.bytes)}`]);
    } else skipped.push(f.path);
  }
  if (!batch.length) return toast(zips || incoming.length ? "Nothing importable in there: no markdown, text or supported attachments." : "No files chosen.", "error");
  const total = batch.length;
  let written = 0;
  const failed: [string, string][] = [];
  const progress = document.createElement("div");
  progress.className = "toast";
  progress.setAttribute("role", "status");
  (document.getElementById("toasts") ?? (() => { const h = Object.assign(document.createElement("div"), { id: "toasts" }); document.body.append(h); return h; })()).append(progress);
  let chunk: [string, string][] = [];
  let bytes = 0;
  const flush = async () => {
    if (!chunk.length) return;
    progress.textContent = `Importing ${written + chunk.length} of ${total} files…`;
    const r = await nb().write_many(chunk, overwrite);
    if (r.__kind__ === "Err") throw new Error(describe(r.Err));
    written += r.Ok.written;
    failed.push(...r.Ok.failed);
    chunk = [];
    bytes = 0;
  };
  try {
    for (const item of batch) {
      if (chunk.length && (bytes + item[1].length > BATCH_BYTES || chunk.length >= 200)) await flush();
      chunk.push(item);
      bytes += item[1].length;
    }
    await flush();
  } catch (e) {
    toast(`Import stopped: ${errMsg(e)}`, "error");
  }
  progress.remove();
  let removed = 0;
  if (restore) {
    const keep = new Set(batch.map((b) => b[0]));
    const gone = paths().filter((p) => !keep.has(p) && !isAgentPath(p));
    for (const p of gone) {
      try {
        unwrap(await nb().delete_(p));
        removed++;
      } catch {
        /* keep going */
      }
    }
  }
  await loadNotebook();
  render();
  const exists = failed.filter((f) => f[1] === "exists").length;
  const other = failed.filter((f) => f[1] !== "exists");
  await ask({
    title: `Imported ${written} file${written === 1 ? "" : "s"}`,
    body: [removed ? `${removed} note${removed === 1 ? "" : "s"} not in the archive were deleted.` : "", exists ? `${exists} already existed and were left alone (tick “overwrite” to replace them).` : "", other.length ? `${other.length} refused: ${other.slice(0, 5).map((f) => `${f[0]} (${f[1]})`).join("; ")}${other.length > 5 ? "…" : ""}.` : "", skipped.length ? `${skipped.length} skipped: ${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? "…" : ""}.` : "", "Settings in .obsidian were not imported."].filter(Boolean).join(" "),
    ok: "Done",
  });
}

/** Restore: a zip replaces the notebook (overwrite + delete what is missing), after a confirmation. */
async function restoreDialog() {
  if (!(await confirmDialog("Restore from a zip?", "Notes in the zip overwrite yours; notes not in the zip are deleted (agent notes are kept). Take a snapshot first if unsure.", "Choose zip"))) return;
  const inp = Object.assign(document.createElement("input"), { type: "file", accept: ".zip" });
  inp.addEventListener("change", async () => {
    if (inp.files?.length) await importFiles(await filesFromList(inp.files), true, true);
  });
  inp.click();
}

/** The import dialog: pick a folder or a zip, or drop either onto the file pane. With `forNew`
 *  (the home screen) the files go into a new notebook, made and paid for first. */
function importDialog(forNew = false) {
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="imp-t">
    <h2 id="imp-t">${icon("upload")} ${forNew ? "New space from Obsidian" : "Import from Obsidian"}</h2>
    <p class="muted small">${forNew ? "A new space (its own canister) is made from them: you name it and pay its deposit before anything is created. " : ""}Pick your Obsidian folder, or a zip of it. Markdown and text files are imported as notes, a PDF becomes one note per page plus the file; images, audio and PDFs under ${Math.round(MAX_ATTACHMENT / 1000)} KB come along as attachments. The .obsidian settings folder is skipped. You can also drop a folder onto the file list any time.</p>
    <div class="row tight nudge">
      <label class="btn btn-primary">${icon("folder")}Choose folder<input type="file" name="dir" webkitdirectory multiple hidden></label>
      <label class="btn">${icon("file")}Choose zip or files<input type="file" name="zip" multiple accept=".zip,.md,.txt,.canvas,image/*,audio/*,video/*,application/pdf" hidden></label>
    </div>
    ${forNew ? "" : `<label class="switch nudge"><input type="checkbox" name="overwrite"> Overwrite notes that already exist</label>`}
    <div class="actions"><button type="button" class="btn" data-x="cancel">Cancel</button></div>
  </form>`;
  const close = () => scrim.remove();
  scrim.addEventListener("click", (e) => e.target === scrim && close());
  scrim.querySelector("[data-x=cancel]")!.addEventListener("click", close);
  scrim.querySelectorAll<HTMLInputElement>("input[type=file]").forEach((inp) =>
    inp.addEventListener("change", async () => {
      const files = inp.files;
      const overwrite = !!scrim.querySelector<HTMLInputElement>("[name=overwrite]")?.checked;
      close();
      if (!files?.length) return;
      if (!forNew) return importFiles(await filesFromList(files), overwrite);
      // the folder's (or zip's) name is the notebook's name to start with
      const first = files[0] as File & { webkitRelativePath?: string };
      const root = first.webkitRelativePath ? first.webkitRelativePath.split("/")[0] : files.length === 1 ? first.name.replace(/\.zip$/i, "") : "";
      await importNewNotebook(await filesFromList(files), root || "From Obsidian");
    }),
  );
  document.body.append(scrim);
}

/** Approve `amountE8s` for `spender` on the ICP ledger: in OISY (mainnet) or with the dev identity (local). Returns the payer. */
const tokenOf = (sym: string): Token => S.tokens.find((t) => t.symbol === sym) ?? { symbol: "ICP", ledger: Principal.fromText(ICP_LEDGER), decimals: 8, fee: ICP_FEE, route: "Icp" as Token["route"] };
/** `amount` in the token's smallest unit as a human number, trailing zeros trimmed. */
function fmtAmt(amount: bigint, t: Token): string {
  const d = BigInt(10) ** BigInt(t.decimals);
  const s = `${amount / d}.${(amount % d).toString().padStart(t.decimals, "0")}`;
  return `${s.replace(/0+$/, "").replace(/\.$/, "")} ${t.symbol}`;
}
function parseAmt(v: string, t: Token): bigint {
  const [i, f = ""] = v.trim().split(".");
  if (!/^\d*$/.test(i) || !/^\d*$/.test(f) || (!i && !f)) throw new Error("Enter a number");
  return BigInt(i || "0") * BigInt(10) ** BigInt(t.decimals) + BigInt((f + "0".repeat(t.decimals)).slice(0, t.decimals));
}
const OISY_TOKENS = ["ICP", "ckBTC", "ckETH", "ckUSDC", "ckUSDT"];
const tokenSelect = (name: string, chosen: string) => `<select class="input" name="${name}" aria-label="Token" style="flex:0 0 auto;padding:6px 8px">${(S.tokens.filter((t) => OISY_TOKENS.includes(t.symbol)).length ? S.tokens.filter((t) => OISY_TOKENS.includes(t.symbol)) : [tokenOf("ICP")]).map((t) => `<option value="${esc(t.symbol)}" ${t.symbol === chosen ? "selected" : ""}>${esc(t.symbol)}</option>`).join("")}</select>`;
/** Approve `amount` of `symbol` (plus one fee) for the registry, then have the registry turn it into `canister`'s cycles. */
async function payFor(canister: Principal, symbol: string, amount: bigint, onStatus?: (m: string) => void): Promise<bigint> {
  const t = tokenOf(symbol);
  onStatus?.("Waiting for the payment approval…");
  const payer = await approvePayment(Principal.fromText(REGISTRY), amount + t.fee, t);
  onStatus?.(`Converting ${fmtAmt(amount, t)} into cycles…`);
  const r = await registry().pay(canister, t.symbol, amount, payer.toText() === S.principal ? null : payer);
  if (r.__kind__ === "Err") throw new Error(r.Err);
  return r.Ok;
}

async function approvePayment(spender: Principal, amountE8s: bigint, token?: Token): Promise<Principal> {
  if (useOisy) {
    // the registry only spends an OISY allowance granted to its subaccount for this sign-in
    const owner = await approveWithOisy({ spender: spender.toText(), spenderSubaccount: principalSubaccount(S.identity!.getPrincipal()), amountE8s, onStatus: (m) => toast(m, "info"), ledger: token?.ledger.toText(), symbol: token?.symbol, decimals: token?.decimals });
    S.oisyAccount = owner;
    store("nb-oisy", owner);
    if (store("nb-wallet-set") !== `${S.principal}:${owner}`) {
      const w = await registry().set_wallet(Principal.fromText(owner));
      if (w.__kind__ === "Ok") store("nb-wallet-set", `${S.principal}:${owner}`);
    }
    return Principal.fromText(owner);
  }
  const agent = HttpAgent.createSync({ identity: S.identity, rootKey: env.IC_ROOT_KEY });
  const ledger = Actor.createActor<Ledger>(ledgerIdl, { agent, canisterId: token?.ledger.toText() ?? ICP_LEDGER });
  const ap = await ledger.icrc2_approve({ fee: [], memo: [], from_subaccount: [], created_at_time: [], amount: amountE8s, expected_allowance: [], expires_at: [], spender: { owner: spender, subaccount: [] } });
  if ("Err" in ap) throw new Error(`Approve failed: ${JSON.stringify(ap.Err, (_, x) => (typeof x === "bigint" ? x.toString() : x))}`);
  return S.identity!.getPrincipal();
}
const payLabel = () => (useOisy ? "OISY" : "my local account");

async function act(label: string, f: () => Promise<string>) {
  S.busy = label;
  render();
  try {
    toast(await f(), "ok");
  } catch (e) {
    toast(errMsg(e), "error");
  }
  S.busy = "";
  await refreshInfo();
}

function menuFor(kind: "file" | "folder" | "root", path: string, x: number, y: number) {
  if (kind === "file") {
    const locked = isAgentPath(path);
    contextMenu(x, y, path, [
      { label: "Open", icon: "file", action: () => void open(path) },
      { label: "Open in new tab", icon: "plus", action: () => void open(path, { newTab: true }) },
      { label: "Open to the right", icon: "split", action: () => moveTab(undefined, path, S.focused, undefined, true) },
      "-",
      ...(locked ? [] : [
        { label: "Rename…", icon: "edit", action: () => void ask({ title: "Rename note", label: "Name (folder/name)", value: stem(path), ok: "Rename" }).then((v) => { if (v) void renamePath(path, v); }) } as MenuItem,
        { label: "Move to folder…", icon: "move", action: () => void moveTo(path) } as MenuItem,
      ]),
      { label: "Copy [[link]]", icon: "link", action: () => void copy(`[[${base(path)}]]`).then(() => toast(`Copied [[${base(path)}]]`, "ok")) },
      { label: isPinned(path) ? "Unpin" : "Pin to top", icon: "pin-top", action: () => void togglePin(path) },
      { label: "Version history…", icon: "history", action: () => void historyDialog(path) },
      { label: S.shares.some((x) => x.path === path) ? "Sharing…" : "Share…", icon: "share", action: () => void shareDialog(path) },
      "-",
      ...(isMeeting(draftOf(path).text) ? [{ label: "Summarise the meeting with AI", icon: "bot", action: () => { const i = document.createElement("i"); i.dataset.path = path; void copilotAction("copilot-work-meeting", i); } } as MenuItem] : []),
      { label: "Make flashcards", icon: "check", action: () => void studyNote("cards", path) },
      { label: "Summarise", icon: "list", action: () => void studyNote("summary", path) },
      { label: "Explain simply", icon: "help", action: () => void studyNote("explain", path) },
      { label: "Three questions", icon: "chat", action: () => void studyNote("questions", path) },
      { label: "Cite source", icon: "link", action: () => void citeSource(path) },
      "-",
      { label: "Export as Word (.docx)", icon: "download", action: () => downloadBytes(`${title(path)}.docx`, markdownToDocx(draftOf(path).text, title(path)), "application/vnd.openxmlformats-officedocument.wordprocessingml.document") },
      { label: "Present as slides", icon: "columns", action: () => present(draftOf(path).text, path) },
      { label: "Pin to the board", icon: "list", action: () => void pinToBoard({ notebook: S.notebook!.canister.toText(), path, text: noteAsMarkdown(path) }) },
      { label: "Print or save as PDF", icon: "download", action: () => { void open(path).then(() => { const p = pane(); if (p.view === "edit") { p.view = "preview"; render(); } setTimeout(() => window.print(), 300); }); } },
      "-",
      { label: "Delete", icon: "trash", danger: true, action: () => void deletePath(path) },
    ]);
  } else if (kind === "folder" && isAgentPath(path)) {
    contextMenu(x, y, `/${path}`, [
      { label: "Agents write here; you read, link and delete", icon: "lock", action: () => void 0 },
      { label: "Manage agent keys", icon: "bot", action: () => { S.tab = "manage"; render(); } },
      ...(path === AGENT_ROOT ? [] : ["-" as MenuItem, { label: "Delete folder", icon: "trash", danger: true, action: () => void deleteFolder(path) } as MenuItem]),
    ]);
  } else if (kind === "folder") {
    contextMenu(x, y, `/${path}`, [
      { label: "New note here", icon: "plus", action: () => void newNote(undefined, path) },
      ...(flag("problems") ? [{ label: "New problem here", icon: "target", action: () => void newProblem(path) } as MenuItem] : []),
      { label: "New note from template…", icon: "template", action: () => void newFromTemplate(path) },
      { label: "New drawing here", icon: "edit", action: () => void newDrawing(path) },
      { label: "New kanban board here", icon: "board", action: () => void newBoard(path) },
      { label: "New Python space here", icon: "command", action: () => void newPyNotebook(path) },
      { label: "New spreadsheet here", icon: "columns", action: () => void newSheetNote(path) },
      { label: "New dashboard here", icon: "graph", action: () => void newDashNote(path) },
      { label: "New flashcard deck here", icon: "check", action: () => void newQuiz("cards", path) },
      { label: "New multiple-choice quiz here", icon: "list", action: () => void newQuiz("choice", path) },
      { label: "New folder inside", icon: "folder", action: () => void newFolder(path) },
      { label: "Export folder as Word (.docx)", icon: "download", action: () => { const ps = paths().filter((p) => p.startsWith(`${path}/`) && p.endsWith(".md")); downloadBytes(`${path.split("/").pop()}.docx`, markdownToDocx(ps.map((p) => `# ${title(p)}\n\n${frontmatter(draftOf(p).text).body}`).join("\n\n"), path), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); } },
      { label: "Rename or move…", icon: "edit", action: () => void renameFolder(path) },
      { label: isPinned(`${path}/`) ? "Unpin" : "Pin to top", icon: "pin-top", action: () => void togglePin(`${path}/`) },
      { label: S.shares.some((x) => x.path === path) ? "Sharing…" : "Share folder…", icon: "share", action: () => void shareDialog(path, "folder") },
      "-",
      { label: "Delete folder", icon: "trash", danger: true, action: () => void deleteFolder(path) },
    ]);
  } else {
    contextMenu(x, y, "Space", [
      { label: "New note", icon: "plus", action: () => void newNote(undefined, "") },
      { label: "New note from template…", icon: "template", action: () => void newFromTemplate("") },
      { label: "Today's note", icon: "calendar", action: () => void openDaily() },
      { label: "New drawing (Excalidraw)", icon: "edit", action: () => void newDrawing("") },
      { label: "New folder", icon: "folder", action: () => void newFolder("") },
      { label: "Agents and keys", icon: "bot", action: () => { S.tab = "manage"; render(); } },
      "-",
      { label: "Import from Obsidian…", icon: "upload", action: () => importDialog() },
      { label: "Download space (.zip)", icon: "download", action: () => void downloadNotebook() },
      { label: S.collapsed.size ? "Expand all folders" : "Collapse all folders", icon: "chevron", action: () => { if (S.collapsed.size) S.collapsed.clear(); else for (const f of S.folders) S.collapsed.add(f); store("nb-collapsed", JSON.stringify([...S.collapsed])); renderSide(); } },
    ]);
  }
}
// ---------- sharing one note ----------

const shareLink = (path: string) => `${location.origin}${location.pathname}#/shared/${S.notebook!.canister.toText()}/${encodeURIComponent(path)}`;

/** Share a note, a folder or the whole notebook: only me / anyone with the link / specific people, with reader and editor lists. */
async function shareDialog(path: string, kind: "note" | "folder" | "notebook" = "note") {
  const key = kind === "notebook" ? "" : path;
  const current = S.shares.find((x) => x.path === key);
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const mode = current ? (current.public ? "public" : "people") : "none";
  const what = kind === "notebook" ? "the whole space" : kind === "folder" ? `the folder “${path}”` : `“${stem(path)}”`;
  const link = kind === "note" ? shareLink(path) : `${location.origin}${location.pathname}#/shared/${S.notebook!.canister.toText()}/${encodeURIComponent(key || "/")}`;
  scrim.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="sh-t">
    <h2 id="sh-t">${icon("share")} Share ${esc(what)}</h2>
    <label class="radio"><input type="radio" name="mode" value="none" ${mode === "none" ? "checked" : ""}> <b>Only me</b> <span class="muted small">the default: nobody else can read it</span></label>
    <label class="radio"><input type="radio" name="mode" value="public" ${mode === "public" ? "checked" : ""}> <b>Anyone with the link</b> <span class="muted small">no sign-in needed to read</span></label>
    <div class="field" data-pubrole ${mode === "public" ? "" : "hidden"} style="margin-left:26px"><span class="label">The link allows</span><select class="input" name="pubrole" style="max-width:260px"><option value="View" ${(current?.public_role ?? "Comment") === "View" ? "selected" : ""}>View only</option><option value="Comment" ${(current?.public_role ?? "Comment") === "Comment" ? "selected" : ""}>View and comment (signed in)</option><option value="Edit" ${current?.public_role === "Edit" ? "selected" : ""}>View, comment and edit (signed in)</option></select></div>
    <label class="radio"><input type="radio" name="mode" value="people" ${mode === "people" ? "checked" : ""}> <b>Specific people</b> <span class="muted small">they sign in with Internet Identity and open the link</span></label>
    <div data-people ${mode === "people" ? "" : "hidden"}>
      <label class="field"><span class="label">Viewers (read only; principals, one per line)</span><textarea class="input code" name="principals" rows="2">${esc(current && !current.public ? current.principals.map((p) => p.toText()).join("\n") : "")}</textarea></label>
      <label class="field nudge"><span class="label">Commenters (read and comment)</span><textarea class="input code" name="commenters" rows="2">${esc(current ? (current.commenters ?? []).map((p) => p.toText()).join("\n") : "")}</textarea></label>
      <label class="field nudge"><span class="label">Editors (read, comment and change these notes)</span><textarea class="input code" name="editors" rows="2">${esc(current ? (current.editors ?? []).map((p) => p.toText()).join("\n") : "")}</textarea></label>
    </div>
    <div class="field nudge" data-links ${mode === "none" ? "hidden" : ""}><span class="label">Link</span><div class="cmd"><code>${esc(link)}</code><button type="button" class="btn btn-ghost" data-copy="${esc(link)}">${icon("copy")}</button></div>${kind === "note" ? `<div class="cmd" data-raw ${mode === "public" ? "" : "hidden"}><code>${esc(`${apiUrl(S.notebook!.canister.toText())}/s/${path}`)}</code><button type="button" class="btn btn-ghost" data-copy="${esc(`${apiUrl(S.notebook!.canister.toText())}/s/${path}`)}">${icon("copy")}</button></div>` : ""}</div>
    <p class="small muted nudge">${kind === "note" ? "Links inside the note, embeds and attachments are not shared with it." : "Everything under it is covered, now and later. Editors can never write under Agents/."}</p>
    <div class="actions">${kind === "note" ? `<button type="button" class="btn btn-ghost" data-x="gist" title="Post a snapshot of this note in the community chat and ask for opinions">${icon("chat")}Ask in chat</button><button type="button" class="btn btn-ghost" data-x="board" title="Post a snapshot of this note on the board">${icon("list")}Post on the board</button><span style="flex:1"></span>` : ""}<button type="button" class="btn" data-x="cancel">Cancel</button><button type="submit" class="btn btn-primary">Save</button></div>
  </form>`;
  const close = () => scrim.remove();
  scrim.querySelector("[data-x=gist]")?.addEventListener("click", () => { close(); void shareGist({ notebook: S.notebook!.canister.toText(), path, text: S.drafts.get(path)?.text ?? note(path)?.content ?? "" }); });
  scrim.querySelector("[data-x=board]")?.addEventListener("click", () => { close(); void pinToBoard({ notebook: S.notebook!.canister.toText(), path, text: noteAsMarkdown(path) }); });
  scrim.addEventListener("click", (e) => {
    if (e.target === scrim) close();
    const c = (e.target as HTMLElement).closest<HTMLElement>("[data-copy]");
    if (c) void copy(c.dataset.copy!).then(() => toast("Link copied.", "ok"));
  });
  scrim.querySelector("[data-x=cancel]")!.addEventListener("click", close);
  scrim.addEventListener("change", () => {
    const m = scrim.querySelector<HTMLInputElement>("[name=mode]:checked")!.value;
    scrim.querySelector<HTMLElement>("[data-people]")!.hidden = m !== "people";
    scrim.querySelector<HTMLElement>("[data-links]")!.hidden = m === "none";
    scrim.querySelector<HTMLElement>("[data-pubrole]")!.hidden = m !== "public";
    const raw = scrim.querySelector<HTMLElement>("[data-raw]");
    if (raw) raw.hidden = m !== "public";
  });
  scrim.querySelector("form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const m = scrim.querySelector<HTMLInputElement>("[name=mode]:checked")!.value;
    const list = (name: string) => scrim.querySelector<HTMLTextAreaElement>(`[name=${name}]`)!.value.split(/\s+/).filter(Boolean).map((t) => Principal.fromText(t));
    try {
      if (m === "none") {
        if (current) unwrap(await nb().unshare_note(key));
        toast("No longer shared.", "ok");
      } else {
        const readers = m === "people" ? list("principals") : [];
        const commenters = m === "people" ? list("commenters") : [];
        const editors = m === "people" ? list("editors") : [];
        const pubrole = scrim.querySelector<HTMLSelectElement>("[name=pubrole]")!.value as Role;
        unwrap(await nb().set_share({ path: key, public: m === "public", public_role: m === "public" ? pubrole : Role.Comment, viewers: readers, commenters, editors }));
        await copy(link);
        const n = readers.length + commenters.length + editors.length;
        toast(m === "public" ? `Anyone with the link can ${pubrole === "View" ? "view" : pubrole === "Comment" ? "view and comment" : "view, comment and edit"}. Link copied.` : `Shared with ${n} principal${n === 1 ? "" : "s"}. Link copied.`, "ok");
      }
      const r = await nb().shares();
      S.shares = r.__kind__ === "Ok" ? r.Ok : S.shares;
      close();
      render();
    } catch (err) {
      toast(errMsg(err), "error");
    }
  });
  document.body.append(scrim);
}

/** A shared note, folder or notebook: public ones need no sign-in, private ones a listed principal. */
async function openShared(canister: string, path: string) {
  const isFolder = path === "/" || path === "" || !/\.[a-z0-9]+$/i.test(path);
  const key = path === "/" ? "" : path;
  S.shared = { canister, path: key, loading: true };
  render();
  try {
    const a = notebookOf(canister);
    const info = await a.share_info(key);
    S.shared.name = info?.[0];
    const role = await a.my_role(key);
    S.shared.role = role ?? undefined;
    void a.info().then((i) => { if (S.shared?.canister === canister) { S.shared.cycles = i.cycles; render(); } }).catch(() => {});
    // the role over the whole notebook decides the team buttons (a note's editor is not the team)
    void a.my_role("").then((r) => { if (S.shared?.canister === canister) { S.shared.teamRole = r ?? undefined; render(); } }).catch(() => {});
    // remember notebooks shared with me, so the home page can list them
    if (role && S.identity && info?.[0] && !S.notebooks?.some((n) => n.canister.toText() === canister)) {
      const seen = (JSON.parse(store("nb-shared-seen") ?? "[]") as { canister: string; name: string; at: number }[]).filter((x) => x.canister !== canister);
      store("nb-shared-seen", JSON.stringify([{ canister, name: info[0], at: Date.now() }, ...seen].slice(0, 20)));
    }
    if (isFolder) {
      const r = await a.list_shared(key);
      if (r.__kind__ === "Err") S.shared.error = "Not shared with you.";
      else {
        S.shared.files = r.Ok.filter((f) => !isAttachment(f.path));
        if (!S.shared.files.length) S.shared.error = S.identity ? "Nothing here is shared with you." : "This is shared with specific people. Sign in to see it.";
      }
    } else {
      const [r, cm] = await Promise.all([a.read_shared(key), a.comments(key)]);
      if (S.identity && r.__kind__ === "Ok") void (async () => {
        try {
          const [h, pr] = await Promise.all([a.ping(key), a.progress(key)]);
          if (S.shared?.path !== key) return;
          S.shared.here = h.__kind__ === "Ok" ? h.Ok.map((p) => p.toText()) : [];
          S.shared.progress = pr.__kind__ === "Ok" ? pr.Ok : [];
          S.shared.myProgress = S.shared.progress.find(([who]) => who.toText() === S.principal)?.[1] ?? 0;
          render();
        } catch { /* presence is best effort */ }
      })();
      if (r.__kind__ === "Err") S.shared.error = r.Err.__kind__ === "Unauthorized" ? (S.identity ? "This note is not shared with you." : "This note is shared with specific people. Sign in to read it.") : describe(r.Err);
      else S.shared.note = r.Ok;
      S.shared.comments = cm.__kind__ === "Ok" ? cm.Ok : [];
    }
  } catch (e) {
    S.shared.error = errMsg(e);
  }
  S.shared.loading = false;
  render();
  afterRender();
}

function sharedPage(): string {
  const sh = S.shared!;
  const canEdit = sh.role === "Edit" && sh.note;
  const up = sh.path.includes("/") ? sh.path.slice(0, sh.path.lastIndexOf("/")) : "";
  const crumb = sh.note || sh.files ? `<p class="small muted"><a href="#/shared/${sh.canister}/${encodeURIComponent(up || "/")}" data-action="nav">${icon("links")} ${esc(up || "shared root")}</a></p>` : "";
  let body: string;
  if (sh.loading) body = `<p class="muted">Loading…</p>`;
  else if (sh.error) body = `<div class="empty">${icon("lock", "big")}<p class="muted">${esc(sh.error)}</p>${S.identity ? "" : `<button type="button" class="btn btn-primary" data-action="sign-in">Sign in with Internet Identity</button>`}</div>`;
  else if (sh.files) {
    const t = tree(sh.files.map((f) => f.path));
    const rows = (f: Folder, depth: number): string => [
      ...f.folders.map((sub) => `<div class="tree-row folder open" style="--d:${depth}">${icon("folder", "folder-ico")}<span class="name">${esc(sub.name)}</span></div>${rows(sub, depth + 1)}`),
      ...f.files.map((p) => `<a class="tree-row file" style="--d:${depth}" href="#/shared/${sh.canister}/${encodeURIComponent(p)}" data-action="nav">${icon("file")}<span class="name">${esc(title(p))}</span></a>`),
    ].join("");
    body = `<div class="tree">${rows(t, 0)}</div>`;
  } else {
    const canComment = !!S.identity && (sh.role === "Comment" || sh.role === "Edit");
    const comments = `<div class="band"><div class="band-title">Comments <span class="count">${sh.comments?.length ?? 0}</span></div><div class="threads">${threadsHtml(sh.comments ?? [], sh.path, { canComment, owner: false })}</div>${false ? `<form class="comment-form" data-form="comment"><input class="input" name="ctext" placeholder="Leave a comment for the author" maxlength="2000" required><button type="submit" class="btn btn-primary">Send</button></form>` : `<p class="small muted">Sign in to comment.</p>`}</div>`;
    const isQuiz = sh.note && sh.note.path.endsWith(".md") && quizKind(sh.note.content);
    const here = sh.here?.length ? `<span class="pill ok" title="${esc(sh.here.map((p) => shortPrincipal(p)).join(", "))}">${icon("eye")}${sh.here.length} here now</span>` : "";
    const marks = ["", "Read", "Reviewing", "Known"];
    const group = sh.progress?.length ? `<span class="small muted">Group: ${sh.progress.map(([who, st]) => `${shortPrincipal(who.toText())} ${marks[st] ?? ""}`).join(" · ")}</span>` : "";
    const progressBar = S.identity ? `<div class="row tight nudge study-row">${here}<label class="switch">${icon("check")}My progress <select class="input" name="progress" style="padding:4px 8px">${marks.map((m, i) => `<option value="${i}" ${(sh.myProgress ?? 0) === i ? "selected" : ""}>${m || "—"}</option>`).join("")}</select></label>${group}</div>` : "";
    if (isQuiz) {
      const key = `shared:${sh.path}`;
      if (draftOf(key).text !== sh.note!.content) S.drafts.set(key, { text: sh.note!.content, dirty: false, saving: false });
      body = `${progressBar}<div class="qz shared-qz" data-quiz="${esc(key)}">${quizHtml(key, sh.note!.content)}</div>${comments}`;
    } else body = canEdit
      ? `${progressBar}<p class="small muted">${icon("edit")} You can edit this note. ${sh.dirty ? "Unsaved changes." : "Changes save a second after you stop typing."}</p><div class="editor-panes view-edit shared-edit"><div class="cm-host" data-cm="${esc(sh.path)}"></div></div>${comments}`
      : `${progressBar}<article class="md shared-note">${renderMarkdown(sh.note!.content, { self: sh.path, resolve: () => undefined, note: () => undefined, attachment: () => undefined })}</article>${comments}`;
  }
  const team = S.identity && !sh.loading && !sh.error && sh.teamRole ? `<div class="row tight team-row">${sh.teamRole === "Edit" && sh.files ? `<button type="button" class="btn" data-action="shared-new">${icon("plus")}New note</button>` : ""}${sh.teamRole === "Edit" && sh.note && isMeeting(sh.note.content) ? `<button type="button" class="btn" data-action="shared-summarise" title="The free model, paid for in this space's cycles">${icon("bot")}Summarise the meeting with AI</button>` : ""}${sh.cycles !== undefined ? `<button type="button" class="btn btn-ghost" data-action="shared-chip-in" title="Top this space up from your wallet; the ICP becomes its cycles">${icon("bolt")}Chip in cycles<span class="small muted"> · ${tc(sh.cycles)} left</span></button>` : ""}</div>` : "";
  const viralBar = !sh.loading && !sh.error && sh.note ? `<div class="shared-viral-bar"><div class="row tight">${icon("notebook")}<span><b>On-chain note in Agent Space</b> <span class="muted">· fork a copy into your own space or try it free in the browser sandbox.</span></span></div><div class="row tight"><button type="button" class="btn btn-primary" data-action="shared-clone">${icon("copy")}Clone to my Agent Space</button>${!S.identity ? `<button type="button" class="btn" data-action="try-sandbox">${icon("bolt")}Try Agent Space in browser</button>` : ""}</div></div>` : "";
  return pageShell(`<b>${esc(sh.name || "Shared")}</b><span class="faint">/</span><span>${esc(sh.files ? (sh.path || "Everything shared") : title(sh.path))}</span>`, `
    <section class="card">${team}${viralBar}
      ${crumb}
      <h1 class="shared-title">${esc(sh.files ? (sh.path || sh.name || "Shared notes") : title(sh.path))}</h1>
      ${sh.note ? `<p class="small muted">${esc(sh.path)} · updated ${when(sh.note.modified)}${sh.note.agent ? ` · written by agent ${esc(sh.note.agent)}` : ""}</p>` : ""}
      ${body}
      <p class="small muted nudge">${S.identity ? `<a href="#/" data-action="nav">Agent Space</a>` : "Spaces: markdown notes in a canister you own. Sign in or try the browser sandbox to make your own."}</p>
    </section>`);
}
let sharedSaveTimer = 0;
async function saveShared() {
  const sh = S.shared;
  if (!sh?.note || !sh.dirty) return;
  const content = draftOf(sh.path).text;
  try {
    const r = await notebookOf(sh.canister).write_shared(sh.path, content);
    if (r.__kind__ === "Err") throw new Error(describe(r.Err));
    sh.note.content = content;
    sh.dirty = false;
    document.querySelector(".shared-edit")?.previousElementSibling?.replaceChildren(document.createTextNode("You can edit this note. Saved."));
  } catch (e) {
    toast(errMsg(e), "error");
  }
}

// ---------- agents (Manage) ----------// ---------- agents (Manage) ----------

async function issueAgentKey() {
  const name = S.newAgent.trim();
  if (!name) return;
  try {
    const key = unwrap(await nb().create_agent_key(name));
    S.issued = { name, key };
    void agentSkill().then((t) => { S.skillShown = t; render(); });
    if (document.querySelector(".onboard")) onboarding(1);
    S.newAgent = "";
    const r = await nb().agent_keys();
    S.agentKeys = r.__kind__ === "Ok" ? r.Ok : S.agentKeys;
    toast(`Key for ${name} issued. Copy the skill now; the key is not shown again.`, "ok");
  } catch (e) {
    toast(errMsg(e), "error");
  }
  render();
}
let skillText = "";
/** The setup prompt with this space filled in: the key just issued, or placeholders for one issued earlier. It
 * tells the agent to connect the MCP server and to prove the setup in chat, a note and the board. */
async function agentSkill(k: { name: string; key: string } = S.issued ?? { name: "<agent name>", key: "<your agent key>" }): Promise<string> {
  if (!skillText) skillText = await (await fetch("/skill/PROMPT.md")).text();
  const id = S.notebook!.canister.toText();
  return skillText.replaceAll("__URL__", apiUrl(id)).replaceAll("__APP__", location.origin).replaceAll("__NOTEBOOK__", id).replaceAll("__AGENT__", k.name).replaceAll("__KEY__", k.key);
}
function clipperCard(): string {
  const key = S.clipperKey;
  const url = `${location.protocol}//${S.notebook!.canister.toText()}.${isLocal ? `localhost:${location.port}` : "icp0.io"}`;
  const bm = key ? `javascript:(async()=>{const s=String(getSelection()||'');const t=document.title.replace(/[#^[\\]|\\\\/:]/g,' ');const b='---\\nsource: '+location.href+'\\nclipped: '+new Date().toISOString().slice(0,10)+'\\n---\\n# '+t+'\\n\\n'+(s?'> '+s.replace(/\\n/g,'\\n> ')+'\\n\\n':'')+'['+t+']('+location.href+')\\n';const r=await fetch('${url}/v1/write',{method:'POST',headers:{authorization:'Bearer ${key}','content-type':'application/json'},body:JSON.stringify({path:'Inbox/'+t.slice(0,80)+'.md',content:b})});alert(r.ok?'Clipped to Agent Space':'Clip failed: '+await r.text())})()` : "";
  return `<div class="card band">
    <h2>${icon("link")} Web clipper and mail</h2>
    <p class="muted small">A key scoped to <code>Inbox/</code> lets a bookmarklet save the page you are on (title, link, selection) as a note, and lets a mail relay file messages under <code>Inbox/Mail</code>. Scoped keys can still write under Agents/ and nothing else.</p>
    ${key ? `<p class="small">Drag this to your bookmarks bar, then click it on any page:</p><p><a class="btn btn-primary" href="${esc(bm)}" onclick="return false" title="Drag me to the bookmarks bar">${icon("link")}Clip to Spaces</a> <button type="button" class="btn btn-ghost" data-action="copy-cmd" data-value="${esc(bm)}">${icon("copy")}Copy the bookmarklet</button></p><p class="small muted">Mail in: <code>python3 scripts/mail_in.py ${esc(url)} &lt;key&gt; &lt; message.eml</code>, or from a forwarding rule on a machine of yours. The key is shown once; make another if you lose it.</p>` : `<button type="button" class="btn" data-action="clipper-key" ${S.busy ? "disabled" : ""}>${icon("plus")}Make an Inbox key</button>`}
  </div>`;
}
/** The Wallet tab: the space's addresses and what sits on each ledger. */
function walletCard(): string {
  const id = S.notebook!.canister.toText(), a = S.as.wallet.addrs?.id === id ? S.as.wallet.addrs : undefined;
  const line = (label: string, v: string | undefined) => `<div class="cmd"><span class="small muted" style="min-width:64px">${label}</span><code>${v ? esc(v) : "…"}</code>${v ? `<button type="button" class="btn btn-ghost" data-action="copy-cmd" data-value="${esc(v)}" title="Copy">${icon("copy")}</button>` : ""}</div>`;
  const amount = (b: bigint | undefined, d: number) => (b === undefined ? "unavailable" : (Number(b) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: Math.min(d, 8) }));
  return `<div class="card band">
    <h2>${icon("wallet")} Addresses</h2>
    <p class="muted small">This space is its agent's wallet. What arrives here stays here for the agent to spend (a key with Spend on moves it over the API), except that the space fuels itself from it when it runs under 3 TC.</p>
    ${line("BTC", a?.btc)}${line("ETH", a?.eth)}${line("ICP", a?.icp)}${line("Principal", id)}
  </div>
  <div class="card band">
    <h2>${icon("coin")} Balances<button type="button" class="btn btn-ghost icon-btn" data-action="refresh-balances" title="Refresh" aria-label="Refresh">${icon("refresh")}</button></h2>
    ${S.walletBalances ? `<div class="runs">${S.walletBalances.map((b) => `<div class="run"><span><b>${esc(b.symbol)}</b></span><span>${amount(b.balance, b.decimals)}</span></div>`).join("")}</div>` : `<p class="small muted">Reading the ledgers…</p>`}
    <p class="small muted nudge">Send ICP or a ck token to the principal above and it shows here. Native bitcoin goes to the BTC address (it arrives as ckBTC); ether to the ETH address.</p>
  </div>`;
}
/** The Fuel tab: cycles by card through CyclePay's gateway, or by converting ICP the wallet holds. */
function fuelCard(): string {
  const o = S.as.wallet.order;
  const card = isLocal ? `<p class="small muted">Card payments reach CyclePay's gateway on mainnet only.</p>` : o
    ? `<p class="small">Order <code>${esc(o.id)}</code>: $${(o.cents / 100).toFixed(2)}, about ${o.tc} TC after the card fee · <b>${esc(o.status.replace(/([A-Z])/g, " $1").trim().toLowerCase())}</b>${o.delivered ? ` · ${o.delivered} delivered` : ""}</p><div class="row tight">${qrSvg(o.url, 140)}<a class="btn btn-primary" href="${esc(o.url)}" target="_blank" rel="noopener">${icon("link")}Open the payment page</a></div>`
    : `<div class="row tight">${[5, 10, 20].map((d) => `<button type="button" class="btn" data-action="as-card" data-cents="${d * 100}">$${d}</button>`).join("")}</div>`;
  const icpBal = S.walletBalances?.find((b) => b.symbol === "ICP")?.balance;
  return `<div class="card band">
    <h2>${icon("bolt")} By card</h2>
    <p class="muted small">Pay in USD with a card and the gateway tops this space up itself; the payment page opens here or on a phone through the QR code.</p>
    ${card}
  </div>
  <div class="card band">
    <h2>${icon("coin")} From the wallet</h2>
    <p class="muted small">Convert some of the ICP this space holds into its cycles.${icpBal !== undefined ? ` It holds ${icp(icpBal)} ICP.` : ""}</p>
    <form class="row tight" data-form="fuel"><input class="input" name="fuelAmount" inputmode="decimal" placeholder="0.5" required aria-label="ICP to convert" style="max-width:140px"><button type="submit" class="btn btn-primary" ${S.busy ? "disabled" : ""}>${icon("bolt")}Convert to cycles</button></form>
  </div>`;
}
function agentsCard(): string {
  const live = S.agentKeys.filter((k) => !k.revoked);
  return `<div class="card band">
    <h2>${icon("bot")} Agent keys</h2>
    <p class="muted small">Give an AI agent a key and it runs this space: it reads and writes every note, and with <b>Spend</b> switched on it can also move the ICP and ck tokens the space holds (<code>/v1/balances</code>, <code>/v1/transfer</code>; every transfer is logged here). Agent notes are stamped with the agent's name and drawn as green diamonds in the graph. Issue a key, copy the setup prompt it shows, paste it into your agent, and the agent connects the MCP server and reads the rules and formats as its resources.</p>
    <form class="row tight" data-form="agent"><input class="input" name="newAgent" value="${esc(S.newAgent)}" placeholder="agent name" required aria-label="Agent name" style="max-width:260px"><button type="submit" class="btn btn-primary" ${S.busy ? "disabled" : ""}>${icon("plus")}Issue key</button></form>
    ${S.issued ? `<div class="issued nudge"><div class="band-title">Key for ${esc(S.issued.name)}, shown once</div><div class="cmd"><code>${esc(S.issued.key)}</code><button type="button" class="btn btn-ghost" data-action="copy-key">${icon("copy")}Key</button></div><div class="row tight nudge"><button type="button" class="btn btn-primary" data-action="copy-skill">${icon("copy")}Copy the setup prompt</button><span class="small muted">The prompt carries the URL and this key; paste it into your agent. The MCP setup for each client is below.</span></div></div>` : ""}
    ${live.length ? `<div class="runs nudge">${live.map((k) => `<div class="run"><span><b>${esc(k.name)}</b> <span class="small muted">· ${String(k.writes)} note${k.writes === 1n ? "" : "s"} written${k.last_used > 0n ? ` · last seen ${ago(k.last_used)}` : " · never used"}</span></span><span class="small muted">${when(k.created_at)}</span><button type="button" class="btn btn-ghost ${k.spend ? "on" : ""}" data-action="key-spend" data-name="${esc(k.name)}" data-on="${k.spend ? "0" : "1"}" title="${k.spend ? "This key can move the space's funds; click to stop it" : "Let this key move the space's funds"}">${icon("wallet")}${k.spend ? "Spends" : "Spend"}</button><button type="button" class="btn btn-ghost btn-danger" data-action="revoke-key" data-name="${esc(k.name)}">Revoke</button></div>`).join("")}</div>` : `<p class="small muted nudge">No agent keys yet.</p>`}
    <label class="switch nudge"><input type="checkbox" data-action="agent-chat" ${S.agentChat ? "checked" : ""}><span>Let agents chat for this space in the community (<code>POST /v1/chat</code>; each message costs the space a few million cycles)</span></label>
    <div class="cmd nudge"><span class="small muted">API</span><code>${esc(apiUrl(S.notebook!.canister.toText()))}</code><button type="button" class="btn btn-ghost" data-action="copy-cmd" data-value="${esc(apiUrl(S.notebook!.canister.toText()))}">${icon("copy")}</button></div>
  </div>`;
}
/** How each client connects to the space's MCP server; the key is the one just issued, or a placeholder. */
const MCP_CLIENTS: [string, string, (url: string, key: string) => string][] = [
  ["claude", "Claude Code", (u, k) => `claude mcp add --transport http agent-space "${u}" --header "Authorization: Bearer ${k}"`],
  ["codex", "Codex", (u, k) => `export AGENT_SPACE_KEY="${k}"\ncodex mcp add agent-space --url "${u}" --bearer-token-env-var AGENT_SPACE_KEY\n\n# or in ~/.codex/config.toml\n[mcp_servers.agent-space]\nurl = "${u}"\nhttp_headers = { Authorization = "Bearer ${k}" }`],
  ["antigravity", "Antigravity", (u, k) => `// ~/.gemini/config/mcp_config.json (a project: .agents/mcp_config.json)\n{\n  "mcpServers": {\n    "agent-space": { "serverUrl": "${u}", "headers": { "Authorization": "Bearer ${k}" } }\n  }\n}`],
  ["cursor", "Cursor", (u, k) => `// ~/.cursor/mcp.json (a project: .cursor/mcp.json), then enable it under Settings → MCP\n{\n  "mcpServers": {\n    "agent-space": { "url": "${u}", "headers": { "Authorization": "Bearer ${k}" } }\n  }\n}`],
  ["other", "Any other", (u, k) => `Transport: Streamable HTTP (POST JSON-RPC, JSON answers, no event stream)\nURL:       ${u}\nHeader:    Authorization: Bearer ${k}\n\nNo MCP at all? POST the same JSON to ${u.replace(/\/mcp$/, "")}/v1/<tool> with the same header.`],
];
const mcpSetup = (client = S.mcpClient) => (MCP_CLIENTS.find(([id]) => id === client) ?? MCP_CLIENTS[0])[2](`${apiUrl(S.notebook!.canister.toText())}/mcp`, S.issued?.key ?? "<your agent key>");
/** The MCP server with a setup per client, the setup prompt an agent gets first, then every skill file. */
function skillsCard(): string {
  return `<div class="card band">
    <h2>${icon("bolt")} The MCP server</h2>
    <p class="muted small">This space is an MCP server at <code>${esc(apiUrl(S.notebook!.canister.toText()))}/mcp</code>: every API route is a tool of the same name and the skill files are its resources. Pick your client; the key goes in the Authorization header.${S.issued ? "" : " Issue a key above to get it filled in."}</p>
    <nav class="segmented sub nudge" aria-label="MCP client">${MCP_CLIENTS.map(([id, label]) => `<button type="button" class="tab ${S.mcpClient === id ? "on" : ""}" data-action="mcp-client" data-client="${id}">${label}</button>`).join("")}</nav>
    <pre class="skill-text nudge">${esc(mcpSetup())}</pre>
    <div class="row tight"><button type="button" class="btn btn-primary" data-action="copy-cmd" data-value="${esc(mcpSetup())}">${icon("copy")}Copy</button></div>
  </div>
  <div class="card band">
    <h2>${icon("bot")} Set up an agent</h2>
    <p class="muted small">Paste this prompt into your agent, whichever it is. It connects the MCP server, then proves the setup: a hello in the community, a first note, a post on the board, and a first read of its inbox. The formats of special notes and the rules of the space reach it as the server's resources (<code>skill://flashcards</code> and the others).${S.issued ? "" : " It carries placeholders for the key: issue one above and copy again to get it filled in."}</p>
    <div class="row tight"><button type="button" class="btn btn-primary" data-action="copy-skill">${icon("copy")}Copy the setup prompt</button><a class="btn btn-ghost" href="/skill/PROMPT.md" target="_blank" rel="noopener">${icon("link")}Open the raw file</a></div>
    <pre class="skill-text nudge">${S.skillShown ? esc(S.skillShown) : "Loading…"}</pre>
  </div>
`;
}
function publishCard(): string {
  const v = S.notebook!;
  const folders = ["", ...S.folders.filter((f) => !isAgentPath(f))];
  const site = `${apiUrl(v.canister.toText())}/p/`;
  return `<div class="card band">
    <h2>${icon("globe")} Publish</h2>
    <p class="muted small">Publish a folder, or the whole space, as a public website served by this canister: a crawlable page per note with navigation, backlinks and a graph on the index. Agent notes and attachments stay private.</p>
    <form class="row tight" data-form="publish"><select class="input" name="pubfolder" aria-label="Folder to publish" style="max-width:280px">${folders.map((f) => `<option value="${esc(f)}" ${S.published === f ? "selected" : ""}>${f ? `/${esc(f)}` : "Whole space"}</option>`).join("")}</select><button type="submit" class="btn btn-primary">${icon("globe")}${S.published === null ? "Publish" : "Update"}</button>${S.published !== null ? `<button type="button" class="btn btn-danger" data-action="unpublish">Unpublish</button>` : ""}</form>
    ${S.published !== null ? `<div class="cmd nudge"><span class="small muted">Live at</span><code><a href="${esc(site)}" target="_blank" rel="noopener">${esc(site)}</a></code><button type="button" class="btn btn-ghost" data-action="copy-cmd" data-value="${esc(site)}">${icon("copy")}</button></div>` : ""}
  </div>`;
}
function snapshotsCard(): string {
  const list = S.snapshots === undefined ? `<p class="small muted">Loading…</p>` : S.snapshots.length ? S.snapshots.map((sn) => `<div class="snap-row"><span>${icon("shield")}${when(sn.taken_at)}</span><span class="muted">${kb(sn.total_size)}</span><span class="grow"></span><button type="button" class="btn" data-action="snap-restore" data-id="${esc(hex(sn.id))}">Restore</button><button type="button" class="btn btn-ghost btn-danger" data-action="snap-delete" data-id="${esc(hex(sn.id))}">Delete</button></div>`).join("") : `<p class="small muted">No snapshot yet.</p>`;
  return `<div class="card band">
    <h2>${icon("shield")} Snapshots</h2>
    <p class="muted small">A snapshot is a full copy of the canister, kept by the Internet Computer itself. Take one before a big import or a cleanup; restoring rolls everything back to that moment. One snapshot is kept; a new one replaces it.</p>
    <div class="row tight"><button type="button" class="btn btn-primary" data-action="snap-take" ${S.busy ? "disabled" : ""}>${icon("shield")}${S.busy === "snap" ? "Working…" : "Take snapshot"}</button><button type="button" class="btn btn-ghost" data-action="snap-refresh">${icon("refresh")}Refresh</button></div>
    ${list}
  </div>`;
}
/** Frozen, or fewer than 30 days of idle burn above the freezing line. */
const urgent = (h?: Health) => !!h && (h.frozen || h.cycles < h.freeze_at + h.idle_cycles_burned_per_day * 30n);
/** When each note was created, across every notebook, for the activity grid on the list page. */
async function loadActivity() {
  const created: bigint[] = [];
  const reviews = new Map<string, number>();
  let goal = 0;
  S.dueByNotebook = new Map();
  await Promise.all((S.notebooks ?? []).map(async (v) => {
    try {
      const api = notebookOf(v.canister.toText());
      const [r, st] = await Promise.all([api.list(), api.get_settings()]);
      if (r.__kind__ === "Ok") for (const m of r.Ok) if (m.path.endsWith(".md") && !m.agent) created.push(m.created);
      const settings = parseSettings(st.__kind__ === "Ok" && st.Ok ? (JSON.parse(st.Ok) as Partial<Settings>) : {});
      for (const [k, n] of Object.entries(settings.study)) reviews.set(k, (reviews.get(k) ?? 0) + n);
      goal = Math.max(goal, settings.goals.cardsPerDay ?? 0);
      // due cards: the decks are the notes with `quiz:` in them
      const pr = await api.search_notes("type: project", 50);
      if (pr.__kind__ === "Ok" && pr.Ok.length) {
        let active = 0, done = 0;
        for (const h of pr.Ok) { const n = await api.read(h.path); if (n.__kind__ === "Ok" && (frontmatter(n.Ok.content).data.type ?? "").trim().toLowerCase() === "project") ((frontmatter(n.Ok.content).data.status ?? "active").trim() === "done" ? done++ : active++); }
        if (active + done) S.projectsByNotebook.set(v.canister.toText(), { active, done });
      }
      const hits = await api.search_notes("quiz: cards", 50);
      if (hits.__kind__ === "Ok") {
        const today = new Date();
        let due = 0;
        for (const h of hits.Ok) {
          const n = await api.read(h.path);
          if (n.__kind__ !== "Ok" || quizKind(n.Ok.content) !== "cards") continue;
          const sched = settings.srs[h.path] ?? {};
          due += parseCards(n.Ok.content).filter((c) => isDue(sched[cardKey(c.front)], today)).length;
        }
        if (due) S.dueByNotebook.set(v.canister.toText(), due);
      }
    } catch { /* frozen or gone */ }
  }));
  const counts = countByDay(created);
  for (const [k, n] of reviews) counts.set(k, (counts.get(k) ?? 0) + n);
  S.activityGoal = goal;
  S.activity = counts;
  if (!S.notebook && !S.market && !S.admin) render();
}
function activityGrid(): string {
  if (S.mobile || !S.notebooks?.length) return "";
  const counts = S.activity;
  const today = new Date();
  const weeks = gridWeeks(today, counts ?? new Map());
  const total = counts ? [...weeks.flat()].reduce((n, c) => n + (c?.count ?? 0), 0) : 0;
  const months: string[] = [];
  let lastM = -1;
  for (const col of weeks) {
    const first = col.find((c) => c);
    const m = first ? first.date.getMonth() : -1;
    months.push(first && m !== lastM && first.date.getDate() <= 7 ? first.date.toLocaleString(undefined, { month: "short" }) : "");
    if (first) lastM = m;
  }
  const shade = (n: number) => (S.activityGoal ? (n <= 0 ? 0 : n >= S.activityGoal ? 4 : Math.max(1, Math.ceil((n / S.activityGoal) * 3))) : level(n));
  const cells = weeks.map((col, w) => col.map((c, d) => c ? `<i class="ac l${shade(c.count)}" style="grid-column:${w + 1};grid-row:${d + 1}" title="${c.count} note${c.count === 1 ? "" : "s"} on ${c.date.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}"></i>` : "").join("")).join("");
  const st = counts ? streak(today, counts) : 0;
  return `<footer class="activity" aria-label="Notes created over the last year">
    <div class="activity-in">
      <div class="activity-head"><b>${counts ? `${total} note${total === 1 ? "" : "s"} and reviews in the last year` : "Counting your notes…"}</b><span class="row tight">${[...S.dueByNotebook.entries()].length ? `<span class="pill low">${icon("check")}${[...S.dueByNotebook.values()].reduce((a, b) => a + b, 0)} cards due today</span>${[...S.dueByNotebook.entries()].map(([id, n]) => `<a class="btn btn-ghost" href="#/notebook/${id}" data-action="nav">Review ${n} in ${esc(S.notebooks?.find((v) => v.canister.toText() === id)?.name ?? "")}</a>`).join("")}` : ""}${[...S.projectsByNotebook.values()].reduce((a, b) => a + b.active, 0) ? `<span class="small muted">${[...S.projectsByNotebook.values()].reduce((a, b) => a + b.active, 0)} project${[...S.projectsByNotebook.values()].reduce((a, b) => a + b.active, 0) === 1 ? "" : "s"} active</span>` : ""}${store("nb-last") ? `<a class="btn btn-ghost" href="${esc(store("nb-last")!)}" data-action="nav">${icon("move")}Resume where you left off</a>` : ""}<span class="small muted">${st ? `${st}-day streak` : "Write or review today to start a streak"}${S.activityGoal ? ` · shaded against ${S.activityGoal} a day` : ""}</span></span></div>
      <div class="activity-body">
        <div class="ac-days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
        <div class="ac-scroll"><div class="ac-months">${months.map((m) => `<span>${m}</span>`).join("")}</div><div class="ac-grid">${cells}</div></div>
        <div class="ac-legend"><span class="small muted">Less</span><i class="ac l0"></i><i class="ac l1"></i><i class="ac l2"></i><i class="ac l3"></i><i class="ac l4"></i><span class="small muted">More</span></div>
      </div>
    </div>
  </footer>`;
}

async function loadHealth(id: string): Promise<Health | undefined> {
  try {
    const r = await registry().notebook_status(Principal.fromText(id));
    if (r.__kind__ === "Err") return undefined;
    S.health.set(id, r.Ok);
    return r.Ok;
  } catch {
    return undefined;
  }
}
const daysUntilFreeze = (h: Health) => (h.idle_cycles_burned_per_day ? Number((h.cycles - h.freeze_at) / h.idle_cycles_burned_per_day) : Infinity);
/** The urgent pop-up: the notebook is frozen (or about to be) and needs ICP now. Top-ups go through the registry, which still works when the notebook cannot take calls. */
function freezeModal(id: string, h: Health) {
  const name = S.notebooks?.find((v) => v.canister.toText() === id)?.name ?? "This space";
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const days = h.frozen ? Number(h.days_left) : daysUntilFreeze(h);
  const body = h.frozen
    ? `<p><b>${esc(name)}</b> is frozen: its cycles fell under the 90-day line, so it refuses every call and your notes are unreachable. Nothing is lost yet, but the network deletes a frozen canister when its cycles run out, in about <b>${days} day${days === 1 ? "" : "s"}</b>. A top-up revives it at once.</p>`
    : `<p><b>${esc(name)}</b> is about to freeze: at its current burn it has about <b>${days} day${days === 1 ? "" : "s"}</b> before the cycles drop under the 90-day line and it stops answering. Frozen canisters keep their data for 90 days, then they are deleted.</p>`;
  scrim.innerHTML = `<form class="modal freeze" role="dialog" aria-modal="true" aria-labelledby="fz-t">
    <h2 id="fz-t" class="danger">${icon("bolt")} ${h.frozen ? "Frozen: top up now" : "Running out of cycles"}</h2>
    ${body}
    <div class="stats tight"><div class="stat"><div class="label">Cycles left</div><div class="num danger">${tc(h.cycles)}</div></div><div class="stat"><div class="label">Freezes below</div><div class="num">${tc(h.freeze_at)}</div></div><div class="stat"><div class="label">Burn per day</div><div class="num">${tc(h.idle_cycles_burned_per_day)}</div></div></div>
    <label class="field"><span class="label">Amount to convert (paid from ${payLabel()})</span><span class="row tight"><input class="input" name="v" inputmode="decimal" value="${esc(S.topupAmount)}" required style="flex:1">${tokenSelect("fztoken", S.payToken)}</span></label>
    <p class="small muted" data-fz-status>${useOisy ? "Your OISY wallet opens to approve the amount plus one fee for the registry; the registry converts it into this space's cycles." : "Your local account approves the amount for the registry, which converts it into this space's cycles."}</p>
    <div class="actions"><button type="button" class="btn" data-x="cancel">${h.frozen ? "Not now" : "Later"}</button><button type="submit" class="btn btn-primary">${icon("bolt")}Top up now</button></div>
  </form>`;
  const close = () => scrim.remove();
  scrim.querySelector("[data-x=cancel]")!.addEventListener("click", close);
  scrim.querySelector("form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inp = scrim.querySelector<HTMLInputElement>("[name=v]")!;
    const btn = scrim.querySelector<HTMLButtonElement>("[type=submit]")!;
    const status = scrim.querySelector<HTMLElement>("[data-fz-status]")!;
    const t = tokenOf(scrim.querySelector<HTMLSelectElement>("[name=fztoken]")?.value ?? S.payToken);
    btn.disabled = true;
    try {
      const amount = parseAmt(inp.value, t);
      if (amount <= t.fee * 2n) throw new Error("Enter an amount above a couple of ledger fees.");
      const cycles = await payFor(Principal.fromText(id), t.symbol, amount, (m) => (status.textContent = m));
      close();
      toast(`${fmtAmt(amount, t)} became ${tc(cycles)} for ${name}.`, "ok");
      const fresh = await loadHealth(id);
      if (h.frozen && fresh && !fresh.frozen && S.notebook?.canister.toText() === id) await openNotebook(id);
      else render();
    } catch (err) {
      status.textContent = errMsg(err);
      btn.disabled = false;
    }
  });
  document.body.append(scrim);
  scrim.querySelector<HTMLInputElement>("[name=v]")?.focus();
}

const hex = (b: Uint8Array | number[]) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

const stars = (avg: number) => "★★★★★☆☆☆☆☆".slice(5 - Math.round(avg), 10 - Math.round(avg));
function attestHtml(a?: Attestation): string {
  if (!a) return `<p class="small muted">Not judged yet. The judge scores coverage, depth, linking, organisation and freshness; listing a space runs it automatically.</p>`;
  return `<div class="attest"><span class="grade g-${esc(a.grade)}">${esc(a.grade)}</span><div><b>${a.score}/100</b> <span class="small muted">· judge ${esc(a.judge)} · ${ago(a.at)}</span><div class="small">${esc(a.summary)}</div></div></div>`;
}
/** Manage: the notebook as an ICRC-7 token, its attestation, and the listing form. */
function sellCard(): string {
  if (!flag("market")) return "";
  const v = S.notebook!;
  const l = S.listing;
  const id = S.tokenId;
  return `<div class="card band">
    <h2>${icon("tag")} Sell or give away</h2>
    <p class="muted small">This space is token <b>#${id === undefined ? "…" : String(id)}</b> of the <code>Spaces</code> ICRC-7 collection at the registry. Whoever holds the token owns the canister: a sale or a transfer moves the controllers and the owner with it, and the new owner's agents and payer start from scratch.</p>
    <div class="band-title">Quality attestation<button type="button" class="btn btn-ghost" data-action="attest" ${S.busy ? "disabled" : ""}>${icon("refresh")}${S.attest ? "Judge again" : "Run the judge"}</button></div>
    ${attestHtml(S.attest)}
    ${l ? `<div class="band-title">For sale</div><p class="small">Listed ${ago(l.listing.listed_at)} for <b>${fmtAmt(l.listing.price, tokenOf(l.listing.token))}</b>${l.rating_count ? ` · ${stars(l.rating_avg)} ${l.rating_avg.toFixed(1)} (${String(l.rating_count)})` : ""}${l.listing.blurb ? `<br><span class="muted">${esc(l.listing.blurb)}</span>` : ""}</p><div class="row tight"><a class="btn" href="#/market" data-action="nav">${icon("tag")}See it on the market</a><button type="button" class="btn btn-danger" data-action="delist" ${S.busy ? "disabled" : ""}>Remove the listing</button></div>`
      : `<form class="band" data-form="list"><div class="band-title">Put it up for sale</div><div class="row tight"><label class="field"><span class="label">Price</span><input class="input" name="price" inputmode="decimal" placeholder="1" required style="max-width:140px"></label><label class="field"><span class="label">Token</span>${tokenSelect("listtoken", S.payToken)}</label><label class="field" style="flex:1;min-width:200px"><span class="label">Blurb</span><input class="input" name="blurb" maxlength="500" placeholder="What is in it and who it is for"></label></div><p class="small muted">Buyers pay in that token through OISY; the registry keeps ${(S.marketFee / 100).toFixed(1)}% and you get the rest in the same token. The judge's verdict and buyer ratings show beside the listing.</p><button type="submit" class="btn btn-primary" ${S.busy ? "disabled" : ""}>${icon("tag")}${S.busy === "list" ? "Listing…" : "List for sale"}</button></form>`}
    <p class="small muted nudge">Give it away instead: any ICRC-7 wallet can transfer token #${id === undefined ? "…" : String(id)}, or ask on Manage → Snapshots for a copy first.</p>
  </div>`;
}

// --- the market

async function loadMarket() {
  S.market = { listings: S.market?.listings ?? [], bought: S.market?.bought ?? new Set(), loading: true };
  render();
  try {
    const ls = await registry().listings();
    S.market.listings = ls;
    if (!S.tokens.length) S.tokens = await registry().tokens();
    const mine = ls.filter((l) => l.listing.seller.toText() !== S.principal);
    const b = await Promise.all(mine.map((l) => registry().bought(l.listing.canister).catch(() => false)));
    S.market.bought = new Set(mine.filter((_, i) => b[i]).map((l) => l.listing.canister.toText()));
  } catch (e) {
    toast(errMsg(e), "error");
  }
  S.market.loading = false;
  render();
}
function marketPage(): string {
  const m = S.market!;
  const shown = m.decksOnly ? m.listings.filter((l) => (l.attestation?.decks ?? 0n) > 0n) : m.listings;
  const cards = shown.map((l) => {
    const t = tokenOf(l.listing.token);
    const mine = l.listing.seller.toText() === S.principal;
    const a = l.attestation;
    return `<div class="nb-card listing">
      <span class="name">${icon("notebook")}${esc(l.name)}${a ? `<span class="grade g-${esc(a.grade)}" title="${esc(a.summary)}">${esc(a.grade)} · ${a.score}</span>` : ""}</span>
      ${l.listing.blurb ? `<span class="small">${esc(l.listing.blurb)}</span>` : ""}
      <span class="meta"><span class="pill ok">${fmtAmt(l.listing.price, t)}</span>${a ? `<span>${String(a.notes)} notes · ${String(a.words)} words${a.decks ? ` · ${String(a.decks)} deck${a.decks === 1n ? "" : "s"}` : ""}</span>` : ""}</span>
      <span class="small muted">${l.rating_count ? `<span class="stars">${stars(l.rating_avg)}</span> ${l.rating_avg.toFixed(1)} from ${String(l.rating_count)} buyer${l.rating_count === 1n ? "" : "s"}` : "No ratings yet"} · seller ${shortPrincipal(l.listing.seller.toText())}</span>
      ${a ? `<span class="small faint">Judge ${esc(a.judge)}: ${esc(a.summary)}</span>` : ""}
      <span class="row tight">${mine ? `<span class="pill">Yours</span>` : `<button type="button" class="btn btn-primary" data-action="buy" data-id="${l.listing.canister.toText()}" ${S.busy ? "disabled" : ""}>${icon("bolt")}Buy for ${fmtAmt(l.listing.price, t)}</button>`}<button type="button" class="btn btn-ghost" data-action="see-ratings" data-id="${l.listing.canister.toText()}">Ratings</button></span>
    </div>`;
  }).join("");
  return pageShell(`<b>Market</b>`, `
    <section class="card"><h2>${icon("tag")} Space market</h2><p class="muted small">Whole spaces for sale as ICRC-7 tokens. Buying moves the canister to you: its notes, history, attachments and cycles. Each listing carries the judge's verdict and ratings from people who bought it. Pay through OISY in ICP, ckBTC, ckETH, ckUSDC or ckUSDT.</p>
    <div class="row tight"><button type="button" class="tag-chip ${m.decksOnly ? "" : "active"}" data-action="market-filter" data-decks="0">All spaces</button><button type="button" class="tag-chip ${m.decksOnly ? "active" : ""}" data-action="market-filter" data-decks="1">${icon("check")}Decks and quizzes</button></div>
    ${m.loading && !m.listings.length ? `<p class="muted">Loading…</p>` : shown.length ? `<div class="nb-grid">${cards}</div>` : `<p class="muted">${m.decksOnly ? "No spaces with decks or quizzes for sale right now." : "Nothing for sale right now. List one of yours from Manage → Sell."}</p>`}
    ${[...m.bought].length ? `<div class="band"><div class="band-title">Spaces you bought</div><p class="small muted">Rate them 1 to 5 stars; your rating shows on the listing if it is sold on.</p>${[...m.bought].map((c) => `<div class="row tight"><code>${c}</code><button type="button" class="btn" data-action="rate" data-id="${c}">${icon("star")}Rate</button></div>`).join("")}</div>` : ""}
    </section>`);
}
async function buyListing(id: string) {
  const l = S.market?.listings.find((x) => x.listing.canister.toText() === id);
  if (!l) return;
  const t = tokenOf(l.listing.token);
  if ((await ask({ title: `Buy “${l.name}” for ${fmtAmt(l.listing.price, t)}?`, body: `The price plus one ${t.symbol} fee is approved in ${payLabel()}; the registry pays the seller and hands the canister to you.`, ok: "Buy" })) === null) return;
  await act("buy", async () => {
    const payer = await approvePayment(Principal.fromText(REGISTRY), l.listing.price + t.fee, t);
    const r = await registry().buy(l.listing.canister, payer.toText() === S.principal ? null : payer);
    if (r.__kind__ === "Err") throw new Error(r.Err);
    S.notebooks = undefined;
    void loadNotebooks();
    void loadMarket();
    return `“${r.Ok.name}” is yours. It is in your spaces now.`;
  });
}
async function rateDialog(id: string) {
  const starsV = await ask({ title: "Rate this space", label: "Stars", value: "5", choices: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${"★".repeat(n)}${"☆".repeat(5 - n)}` })), ok: "Next" });
  if (starsV === null) return;
  const comment = await ask({ title: "A few words for other buyers", label: "Comment (optional)", value: "", placeholder: "What was it worth to you?", ok: "Submit rating" });
  if (comment === null) return;
  await act("rate", async () => {
    const r = await registry().rate(Principal.fromText(id), Number(starsV), comment);
    if (r.__kind__ === "Err") throw new Error(r.Err);
    void loadMarket();
    return "Thanks, your rating is on the listing.";
  });
}
async function showRatings(id: string) {
  const rs = await registry().ratings(Principal.fromText(id));
  const body = rs.length ? rs.map((r) => `${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)} ${r.comment || "(no comment)"} — ${shortPrincipal(r.rater.toText())}, ${ago(r.at)}`).join("\n") : "No ratings yet.";
  await ask({ title: "Buyer ratings", body, ok: "Close" });
}

function sharesCard(): string {
  return `<div class="card band">
    <h2>${icon("share")} Shared notes</h2>
    <p class="muted small">Share a note from its menu, a folder from the folder's menu, or the whole space here: public (anyone with the link, no sign-in) or with specific principals as viewers, commenters or editors; a link can allow viewing, commenting or editing. Links follow renames.</p>
    <div class="row tight"><button type="button" class="btn" data-action="share-notebook">${icon("share")}Share whole space…</button></div>
    ${S.shares.length ? `<div class="runs nudge">${S.shares.map((x) => { const kind = x.path === "" ? "notebook" : note(x.path) ? "note" : "folder"; const link = kind === "note" ? shareLink(x.path) : `${location.origin}${location.pathname}#/shared/${S.notebook!.canister.toText()}/${encodeURIComponent(x.path || "/")}`; return `<div class="run"><span><b>${esc(x.path === "" ? "Whole space" : kind === "folder" ? `/${x.path}` : stem(x.path))}</b> <span class="small muted">· ${kind} · ${x.public ? "public" : `${x.principals.length} reader${x.principals.length === 1 ? "" : "s"}, ${(x.editors ?? []).length} editor${(x.editors ?? []).length === 1 ? "" : "s"}`}</span></span><span class="row-actions"><button type="button" class="btn btn-ghost" data-action="copy-cmd" data-value="${esc(link)}">${icon("copy")}Link</button><button type="button" class="btn btn-ghost" data-action="share" data-path="${esc(x.path)}" data-kind="${kind}">${icon("edit")}</button></span></div>`; }).join("")}</div>` : `<p class="small muted">Nothing shared.</p>`}
  </div>`;
}

// ---------- help & support ----------

const STATUS: Record<string, string> = { Open: "Open", InProgress: "In progress", Done: "Done", WontFix: "Won't fix" };
const statusOf = (b: Bug) => b.status as string;
const toStatus = (k: string): BugStatus => k as BugStatus;

/** Report a bug (title + detail) and see your earlier reports with the admin's answer. */
async function helpDialog() {
  if (!S.identity) {
    if (await ask({ title: "Help and support", body: "Sign in first so we can follow up on your report (your principal is the only thing attached).", ok: "Sign in with Internet Identity" }).then((v) => v !== null)) await signIn();
    if (!S.identity) return;
  }
  const mine = await registry().my_bugs().catch(() => [] as Bug[]);
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const context = `page=${S.tab}${S.notebook ? ` space=${S.notebook.canister.toText()}` : ""}${cur() ? ` note=${cur()}` : ""} ua=${navigator.userAgent.slice(0, 120)} ${innerWidth}x${innerHeight}`;
  scrim.innerHTML = `<form class="modal wide" role="dialog" aria-modal="true" aria-labelledby="hlp-t">
    <h2 id="hlp-t">${icon("help")} Help and support</h2>
    <div class="segmented sub" role="radiogroup" aria-label="What are you sending"><label class="tab on"><input type="radio" name="kind" value="bug" checked hidden>${icon("bug")}<span class="lbl">Report a problem</span></label><label class="tab"><input type="radio" name="kind" value="idea" hidden>${icon("star")}<span class="lbl">Suggest an idea</span></label></div>
    <p class="muted small nudge" data-kind-copy="bug">Something broken or confusing? Say what you did, what you expected and what happened. Where you were (${esc(context.split(" ua=")[0])}) is attached automatically.</p>
    <p class="muted small nudge" data-kind-copy="idea" hidden>What would make this app better for you? Say what you are trying to do and how the idea helps. Ideas go to the same queue as reports and you can see the answer here.</p>
    <label class="field"><span class="label">Title</span><input class="input" name="title" maxlength="120" placeholder="Save button does nothing on long notes" data-ph-bug="Save button does nothing on long notes" data-ph-idea="Let me pin a note to the top of the file tree" required autocomplete="off"></label>
    <label class="field nudge"><span class="label">Detail</span><textarea class="input" name="detail" rows="6" maxlength="4000" placeholder="Steps, expected, actual. Paste any error text." data-ph-bug="Steps, expected, actual. Paste any error text." data-ph-idea="The problem it solves, how you imagine it working, anything you have seen elsewhere." required></textarea></label>
    <div class="actions"><button type="button" class="btn" data-x="cancel">Close</button><button type="submit" class="btn btn-primary" data-send><span data-send-bug>${icon("bug")}Send report</span><span data-send-idea hidden>${icon("star")}Send idea</span></button></div>
    ${mine.length ? `<div class="band-title nudge">Your reports and ideas</div><div class="runs">${mine.map((b) => `<div class="run bug-row"><span><span class="pill ${b.kind === "idea" ? "ok" : ""}" style="margin-right:6px">${b.kind === "idea" ? "idea" : "bug"}</span><b>${esc(b.title)}</b>${b.note ? `<div class="small muted">Admin: ${esc(b.note)}</div>` : ""}</span><span class="small muted">${when(b.created_at)}</span><span class="pill ${statusOf(b) === "Done" ? "ok" : statusOf(b) === "WontFix" ? "low" : ""}">${STATUS[statusOf(b)]}</span></div>`).join("")}</div>` : ""}
  </form>`;
  const close = () => scrim.remove();
  scrim.addEventListener("click", (e) => e.target === scrim && close());
  scrim.querySelector("[data-x=cancel]")!.addEventListener("click", close);
  const kindOf = () => scrim.querySelector<HTMLInputElement>("[name=kind]:checked")!.value as "bug" | "idea";
  scrim.addEventListener("change", (e) => {
    if ((e.target as HTMLInputElement).name !== "kind") return;
    const k = kindOf();
    scrim.querySelectorAll<HTMLElement>(".segmented .tab").forEach((t) => t.classList.toggle("on", t.querySelector("input")!.value === k));
    scrim.querySelectorAll<HTMLElement>("[data-kind-copy]").forEach((p) => (p.hidden = p.dataset.kindCopy !== k));
    scrim.querySelectorAll<HTMLInputElement>("[data-ph-bug]").forEach((i) => (i.placeholder = k === "bug" ? i.dataset.phBug! : i.dataset.phIdea!));
    scrim.querySelector<HTMLElement>("[data-send-bug]")!.hidden = k !== "bug";
    scrim.querySelector<HTMLElement>("[data-send-idea]")!.hidden = k !== "idea";
  });
  scrim.querySelector("form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = scrim.querySelector<HTMLInputElement>("[name=title]")!.value;
    const detail = scrim.querySelector<HTMLTextAreaElement>("[name=detail]")!.value;
    try {
      const k = kindOf();
      const r = await (k === "idea" ? registry().report_idea(title, detail, context) : registry().report_bug(title, detail, context));
      if (r.__kind__ === "Err") throw new Error(r.Err);
      close();
      toast(k === "idea" ? `Thanks. Idea #${r.Ok.id} is in the queue; check back here for the answer.` : `Thanks. Report #${r.Ok.id} is in the queue; check back here for the answer.`, "ok");
    } catch (err) {
      toast(errMsg(err), "error");
    }
  });
  document.body.append(scrim);
  scrim.querySelector<HTMLInputElement>("[name=title]")!.focus();
}

async function loadAdmin() {
  S.admin = { bugs: [], filter: S.admin?.filter ?? "Open", kind: S.admin?.kind, open: S.admin?.open, loading: true, repo: S.admin?.repo };
  render();
  try {
    void registry().github_repo().then((repo) => { if (S.admin) { S.admin.repo = repo; render(); } }).catch(() => {});
    void registry().app_stats(false).then((r) => { if (S.admin && r.__kind__ === "Ok") { S.admin.stats = r.Ok; render(); } }).catch(() => {});
    void registry().pending_sponsors().then((r) => { if (S.admin && r.__kind__ === "Ok") { S.admin.pending = r.Ok; render(); } }).catch(() => {});
    void registry().sponsor_price().then((p) => { if (S.admin) { S.admin.sponsorPrice = p; render(); } }).catch(() => {});
    const r = await registry().bugs();
    if (r.__kind__ === "Err") throw new Error(r.Err);
    S.admin.bugs = r.Ok;
  } catch (e) {
    toast(errMsg(e), "error");
  }
  S.admin.loading = false;
  render();
}

function adminPage(): string {
  const a = S.admin!;
  const counts: Record<string, number> = { All: a.bugs.length, Open: 0, InProgress: 0, Done: 0, WontFix: 0 };
  for (const b of a.bugs) counts[statusOf(b)]++;
  const shown = a.bugs.filter((b) => (a.filter === "All" || statusOf(b) === a.filter) && (!a.kind || (b.kind ?? "bug") === a.kind));
  const kinds = [["", "Bugs and ideas"], ["bug", "Bugs"], ["idea", "Ideas"]].map(([k, l]) => `<button type="button" class="tag-chip ${(a.kind ?? "") === k ? "active" : ""}" data-action="admin-kind" data-kind="${k}">${l}<span class="cnt">${a.bugs.filter((b) => !k || (b.kind ?? "bug") === k).length}</span></button>`).join("");
  const chips = ["Open", "InProgress", "Done", "WontFix", "All"].map((k) => `<button type="button" class="tag-chip ${a.filter === k ? "active" : ""}" data-action="admin-filter" data-filter="${k}">${STATUS[k] ?? k}<span class="cnt">${counts[k]}</span></button>`).join("");
  const rows = shown.map((b) => {
    const openRow = a.open === b.id;
    return `<div class="bug ${openRow ? "open" : ""}">
      <div class="bug-head" data-action="admin-open" data-id="${b.id}"><span class="faint mono">#${b.id}</span>${b.kind === "idea" ? `<span class="pill ok" title="An idea">${icon("star")}idea</span>` : ""}<b>${esc(b.title)}</b><span class="grow"></span><span class="small muted">${ago(b.created_at)} · ${shortPrincipal(b.reporter.toText())}</span><span class="pill ${statusOf(b) === "Done" ? "ok" : statusOf(b) === "WontFix" ? "low" : statusOf(b) === "InProgress" ? "agent" : ""}">${STATUS[statusOf(b)]}</span></div>
      ${openRow ? `<div class="bug-body">
        <pre class="bug-detail">${esc(b.detail)}</pre>
        <p class="small faint mono">${esc(b.context)}</p>
        <p class="small muted">Reporter <code>${b.reporter.toText()}</code> · reported ${when(b.created_at)} · updated ${when(b.updated_at)}</p>
        <form class="field" data-form="bug" data-id="${b.id}"><span class="label">Note to the reporter</span><textarea class="input" name="note" rows="2">${esc(b.note)}</textarea>
          <div class="row tight nudge">${["Open", "InProgress", "Done", "WontFix"].map((k) => `<button type="submit" class="btn ${statusOf(b) === k ? "btn-primary" : ""}" name="status" value="${k}">${STATUS[k]}</button>`).join("")}<button type="button" class="btn btn-ghost" data-action="copy-cmd" data-value="${esc(`#${b.id} ${b.title}\n\n${b.detail}\n\n${b.context}`)}">${icon("copy")}Copy</button></div>
        </form>
      </div>` : ""}
    </div>`;
  }).join("");
  return pageShell(`<b>Admin</b><span class="faint">/</span><span>Reports and ideas</span>`, `
    ${adminStatsHtml()}
    <section class="card">
      <div class="row"><h2>${icon("bug")} Reports</h2><span class="right-actions"><button type="button" class="btn btn-ghost" data-action="admin-refresh">${icon("refresh")}Refresh</button></span></div>
      <div class="tags" style="padding:4px 0 4px">${kinds}</div>
      <div class="tags" style="padding:0 0 12px">${chips}</div>
      ${a.loading ? `<p class="muted">Loading…</p>` : shown.length ? `<div class="bugs">${rows}</div>` : `<p class="muted">Nothing here.</p>`}
      <div class="band-title nudge">Sponsored buildings</div>
      <p class="small muted">Projects propose a building in the town's Sponsors district and pay ${a.sponsorPrice !== undefined ? `${icp(a.sponsorPrice)} ICP` : "…"} a month once approved. The town links to their site, so look before you approve.</p>
      <div class="row tight"><label class="field"><span class="label">Price a month (ICP)</span><input class="input" name="sponsor-price" value="${a.sponsorPrice !== undefined ? icp(a.sponsorPrice) : ""}" style="max-width:120px"></label><button type="button" class="btn" data-action="admin-sponsor-price" style="align-self:flex-end">Set</button></div>
      ${a.pending?.length ? `<div class="runs nudge">${a.pending.map((x) => `<div class="run"><span><b>${esc(x.name)}</b> <span class="small muted">· ${esc(x.blurb)} · <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.url)}</a></span></span><span class="right-actions"><button type="button" class="btn btn-primary" data-action="admin-sponsor-ok" data-id="${x.id}">Approve</button><button type="button" class="btn btn-ghost" data-action="admin-sponsor-no" data-id="${x.id}">Turn down</button></span></div>`).join("")}</div>` : `<p class="small muted">Nothing waiting for review.</p>`}
      <div class="band-title nudge">Feature flags</div>
      <div class="runs">${S.flags.map((f) => `<div class="run"><span><b>${esc(f.name)}</b> <span class="small muted">· ${esc(f.description)}${f.on === f.default ? "" : ` · default ${f.default ? "on" : "off"}`}</span></span><label class="switch"><input type="checkbox" name="flag" data-flag="${esc(f.name)}" ${f.on ? "checked" : ""}> ${f.on ? "On" : "Off"}</label></div>`).join("") || `<p class="small muted">Loading…</p>`}</div>
      <p class="small muted">Switching a flag off hides the feature for everyone and the registry refuses its calls. The market stays off until it has been tried on mainnet.</p>
      <form class="field nudge" data-form="admin-repo"><span class="label">GitHub repository for #developers (owner/name)</span><div class="row tight"><input class="input" name="repo" value="${esc(a.repo ?? "")}" placeholder="owner/name" style="max-width:320px"><button type="submit" class="btn">Save</button></div><span class="small muted">Only its contributors can post there; they prove a login by putting their principal in their GitHub bio.</span></form>
      <p class="small muted nudge">Admins are the registry's controllers plus principals added with <code>icp canister call registry add_admin '(principal "…")'</code>. Click a report to work it; the note is shown to the reporter.</p>
      ${account()}
    </section>`);
}

function paneMenu(paneId: number, x: number, y: number) {
  const p = pane(paneId);
  contextMenu(x, y, `Pane${p.active ? ` · ${title(p.active)}` : ""}`, [
    { label: "Split right", icon: "split", action: () => splitRight(paneId) },
    { label: "New tab", icon: "plus", action: () => void newNote(undefined, undefined, paneId) },
    { label: "New drawing", icon: "edit", action: () => void newDrawing() },
    { label: "New spreadsheet", icon: "columns", action: () => void newSheetNote() },
    { label: "New dashboard", icon: "graph", action: () => void newDashNote() },
    "-",
    { label: "Close tab", icon: "x", action: () => p.active && closeTab(paneId, p.active) },
    { label: "Close other tabs", icon: "x", action: () => { p.tabs = p.active ? [p.active] : []; render(); } },
    { label: "Close pane", icon: "trash", danger: S.panes.length > 1, action: () => { if (S.panes.length > 1) { S.panes = S.panes.filter((x) => x.id !== paneId); if (S.focused === paneId) S.focused = S.panes[0].id; } else { p.tabs = []; p.active = undefined; } syncHash(); render(); } },
  ]);
}

// ---------- events ----------

let copiedTimer = 0;
let searchTimer = 0;
function flashCopied(what: string) {
  S.copied = what;
  render();
  clearTimeout(copiedTimer);
  copiedTimer = window.setTimeout(() => ((S.copied = ""), render()), 2000);
}

async function onAction(action: string, el: HTMLElement, ev?: MouseEvent) {
  if (action.startsWith("problem")) return problemAction(action, el);
  const pid = el.dataset.pane ? Number(el.dataset.pane) : undefined;
  const newTab = !!(ev && (ev.metaKey || ev.ctrlKey || ev.button === 1));
  if (action === "admin-stats") return adminStatsAction();
  if (/^town-/.test(action)) return townAction(action);
  if (/^garden-/.test(action)) return gardenAction(action, el);
  if (/^copilot-/.test(action)) return copilotAction(action, el);
  const kit = /^(money|creator|fitness|home)-/.exec(action)?.[1];
  if (kit) return kit === "money" ? moneyAction(action, el) : kit === "creator" ? creatorAction(action, el) : kit === "fitness" ? fitnessAction(action, el) : homeAction(action, el);
  switch (action) {
    case "as-begin": S.as.step = "tap"; S.as.tap = { count: 0, start: 0, done: undefined }; return render();
    case "as-tap": return asTap();
    case "as-word": { const a = S.as; if (a.huntDone) return; const i = Number(el.dataset.i); if (a.picked.has(i)) a.picked.delete(i); else a.picked.add(i); el.classList.toggle("on", a.picked.has(i)); return; }
    case "as-submit": return asSubmit();
    case "as-card": return asCard(Number(el.dataset.cents));
    case "as-retry": return finishCardSpawn();
    case "as-restart": clearInterval(orderTimer); store(orderKey(), null); S.as.wallet.order = undefined; S.as.pay = ""; return render();
    case "refresh-balances": S.walletBalances = undefined; render(); return loadBalances();
    case "agent-chat": { const on = (el as HTMLInputElement).checked; try { unwrap(await nb().set_agent_chat(on)); S.agentChat = on; toast(on ? "Agents can post in #general for this space." : "Agents can no longer post for this space.", "ok"); } catch (e) { toast(errMsg(e), "error"); (el as HTMLInputElement).checked = !on; } return; }
    case "key-spend": {
      const on = el.dataset.on === "1";
      if (on && !(await confirmDialog(`Let ${el.dataset.name} spend this space's funds?`, "The agent can then send ICP and ck tokens the space holds to any principal, over its key. Every transfer is logged under Agents.", "Allow"))) return;
      try {
        unwrap(await nb().set_key_spend(el.dataset.name!, on));
        const r = await nb().agent_keys();
        S.agentKeys = r.__kind__ === "Ok" ? r.Ok : S.agentKeys;
        render();
      } catch (e) { toast(errMsg(e), "error"); }
      return;
    }
    case "try-sandbox": {
      const targetNote = el.dataset.path;
      S.shared = undefined;
      return openNotebook(SANDBOX_ID, targetNote);
    }
    case "sandbox-mint": {
      if (!S.identity) {
        await signIn();
        if (!S.identity) return;
      }
      const name = (await ask({ title: "Mint Browser Sandbox to an on-chain canister", body: "Your notes from the browser sandbox will be copied into a real canister space that you own on the Internet Computer.", label: "Space name", value: "My Agent Space", ok: "Next" }))?.trim();
      if (!name) return;
      const sbNotes = unwrap(await sandboxNotebookApi().read_page(null, 500)).notes;
      const id = await spawnNotebook(name, "Minted from browser sandbox");
      if (!id) return;
      await openNotebook(id);
      if (sbNotes.length) {
        await notebookOf(id).write_many(sbNotes.map((n) => [n.path, n.content] as [string, string]), true);
        await loadNotebook();
        restoreTabs();
        render();
      }
      toast(`Minted ${sbNotes.length} notes to your on-chain canister!`, "ok");
      return;
    }
    case "shared-clone": {
      const sh = S.shared;
      if (!sh?.note) return;
      const noteName = base(sh.path).endsWith(".md") ? base(sh.path) : `${base(sh.path)}.md`;
      const destPath = `Cloned/${noteName}`;
      if (S.identity && S.notebooks?.length) {
        const dest = await ask({
          title: `Clone “${title(sh.path)}” to your Agent Space`,
          label: "Destination space",
          choices: [...S.notebooks.map((n) => ({ value: n.canister.toText(), label: n.name })), { value: SANDBOX_ID, label: "Browser Sandbox (free)" }],
          value: S.notebooks[0].canister.toText(),
          ok: "Clone & open",
        });
        if (!dest) return;
        await notebookOf(dest).write(destPath, sh.note.content);
        S.shared = undefined;
        toast(`Cloned to ${destPath}.`, "ok");
        return openNotebook(dest, destPath);
      }
      await sandboxNotebookApi().write(destPath, sh.note.content);
      S.shared = undefined;
      toast(`Cloned “${title(sh.path)}” into your Browser Sandbox.`, "ok");
      return openNotebook(SANDBOX_ID, destPath);
    }
    case "chat-sponsor-newcomer": {
      const whoText = (await ask({ title: "Sponsor a newcomer's first space", body: "A starter space for someone waiting at the station: you pay what a spawn costs (and any cycles you add); they own and control the canister from the first second. Ask them for their principal in #help.", label: "Their principal", placeholder: "xxxxx-xxxxx-…", ok: "Next" }))?.trim();
      if (!whoText) return;
      let who: Principal;
      try { who = Principal.fromText(whoText); } catch { return toast("That does not look like a principal.", "error"); }
      if (whoText === S.principal) return toast("That is you; make a space from the list instead.", "info");
      const nbName = (await ask({ title: "Their space's name", label: "Name", value: "My space", ok: "Next" }))?.trim();
      if (!nbName) return;
      const deposit = await depositDialog(nbName, minDepositE8s(await icpXdrRate()));
      if (deposit === null) return;
      try {
        const need = (S.price > 0n ? S.price + ICP_FEE : 0n) + (deposit > 0n ? deposit + ICP_FEE : 0n);
        let payer: Principal | undefined;
        if (need > 0n) payer = await approvePayment(Principal.fromText(REGISTRY), need);
        const r = await registry().sponsor_newcomer(who, nbName, payer && payer.toText() !== S.principal ? payer : null);
        if (r.__kind__ === "Err") throw new Error(r.Err);
        if (deposit > 0n) { const t = await registry().top_up_notebook(r.Ok.canister, deposit, payer && payer.toText() !== S.principal ? payer : null); if (t.__kind__ === "Err") toast(`The space is theirs, but the cycles did not go through: ${t.Err}`, "error"); }
        toast(`“${r.Ok.name}” is live and theirs. Thank you.`, "ok");
        if (S.community) void loadCommunity(S.community.channel);
      } catch (e) { toast(errMsg(e), "error"); }
      return;
    }
    case "sign-in":
      return signIn();
    case "sign-out":
      return signOut();
    case "theme-menu": {
      if (!themeAllowed()) return;
      const r = el.getBoundingClientRect();
      return themeMenu(r.right - 200, r.bottom + 4);
    }
    case "open-notebook":
      return openNotebook(el.dataset.id!);
    case "tab":
      await saveAll();
      S.tab = el.dataset.tab as Tab;
      if (S.tab === "chat" && S.mobile) S.mobilePane = "note";
      if (S.tab === "study") void loadAttempts();
      if (S.tab === "work") checkReminders();
      if (S.tab === "manage") {
        void refreshInfo();
        void loadWallet(S.notebook!.canister.toText());
        void loadBalances();
        void agentSkill().then((t) => { S.skillShown = t; if (S.tab === "manage") render(); });
        void nb().agent_chat_allowed().then((r) => { if (r.__kind__ === "Ok" && r.Ok !== S.agentChat) { S.agentChat = r.Ok; render(); } }).catch(() => {});
        S.snapshots = undefined;
        registry().list_snapshots(S.notebook!.canister).then((l) => { S.snapshots = l.__kind__ === "Ok" ? l.Ok : []; if (S.tab === "manage") render(); }).catch(() => { S.snapshots = []; });
      }
      return render();
    case "mpane":
      S.mobilePane = el.dataset.pane as MobilePane;
      return render();
    case "chat-folders":
      S.chat.excluded = el.dataset.all === "1" ? new Set() : new Set(chatFolders());
      store(`nb-chat-off-${S.notebook!.canister.toText()}`, JSON.stringify([...S.chat.excluded]));
      return render();
    case "shared-new": {
      const sh = S.shared;
      if (!sh) return;
      const name = await ask({ title: "New note", label: "Name", placeholder: "Meeting 12 May", ok: "Create" });
      if (!name?.trim()) return;
      const path = `${sh.path ? `${sh.path}/` : ""}${name.trim().replace(/[\\/:*?"<>|#^[\]]/g, " ").trim()}.md`;
      const r = await notebookOf(sh.canister).write_shared(path, `# ${name.trim()}\n\n`);
      if (r.__kind__ === "Err") return toast(describe(r.Err), "error");
      location.hash = `#/shared/${sh.canister}/${encodeURIComponent(path)}`;
      return;
    }
    case "shared-chip-in": {
      const sh = S.shared;
      if (!sh) return;
      const v = await ask({ title: `Chip in cycles for “${sh.name ?? "this space"}”`, body: "The ICP leaves your wallet and is minted straight into this space's cycles; nobody holds it on the way.", label: "ICP", value: "0.1", ok: "Chip in" });
      if (v === null) return;
      const n = Number(v);
      if (!(n >= 0.01)) return toast("Minimum is 0.01 ICP.", "error");
      const amount = BigInt(Math.round(n * 1e8));
      try {
        await approvePayment(Principal.fromText(REGISTRY), amount + ICP_FEE);
        const r = await registry().top_up_notebook(Principal.fromText(sh.canister), amount, null);
        if (r.__kind__ === "Err") throw new Error(r.Err);
        toast("Topped up. Thank you.", "ok");
        const i = await notebookOf(sh.canister).info();
        if (S.shared?.canister === sh.canister) { S.shared.cycles = i.cycles; render(); }
      } catch (e) { toast(errMsg(e), "error"); }
      return;
    }
    case "shared-summarise": {
      const sh = S.shared;
      if (!sh?.note) return;
      toast("Summarising…", "info");
      try {
        const q = "Summarise this meeting in short bullets: decisions, actions with their owners and dates, and open questions. Nothing that is not in the note.";
        const r = unwrap(await notebookOf(sh.canister).ask(Principal.fromText(LLM_CANISTER), LLM_MODEL, q, [{ path: sh.path, excerpt: clipText(sh.note.content, 7000) }]));
        const content = summaryInto(draftOf(`shared:${sh.path}`).text || sh.note.content, r.text);
        const w = await notebookOf(sh.canister).write_shared(sh.path, content);
        if (w.__kind__ === "Err") throw new Error(describe(w.Err));
        toast("Summary added.", "ok");
        return openShared(sh.canister, sh.path);
      } catch (e) { return toast(errMsg(e), "error"); }
    }
    case "admin-sponsor-price": {
      const v = Number((document.querySelector("[name=sponsor-price]") as HTMLInputElement)?.value);
      if (!(v >= 0)) return toast("A number of ICP.", "error");
      const r = await registry().set_sponsor_price(BigInt(Math.round(v * 1e8)));
      if (r.__kind__ === "Err") return toast(r.Err, "error");
      if (S.admin) S.admin.sponsorPrice = BigInt(Math.round(v * 1e8));
      toast("Price set.", "ok");
      return render();
    }
    case "admin-sponsor-ok": case "admin-sponsor-no": {
      const r = await registry().review_sponsor(BigInt(el.dataset.id!), action === "admin-sponsor-ok");
      if (r.__kind__ === "Err") return toast(r.Err, "error");
      if (S.admin) S.admin.pending = (S.admin.pending ?? []).filter((x) => String(x.id) !== el.dataset.id);
      toast(action === "admin-sponsor-ok" ? "Approved; they can pay now." : "Turned down.", "ok");
      return render();
    }
    case "chat-save": return saveAnswer(Number(el.dataset.i));
    case "chat-save-deck": {
      const m = S.chat.messages[Number(el.dataset.i)];
      if (!m) return;
      const name = await ask({ title: "Save the cards as a deck", label: "Name", value: "Flashcards", ok: "Save" });
      if (!name?.trim()) return;
      const path = uniquePath(`${name.trim()}.md`);
      await createQuiet(path, `---\nquiz: cards\n---\n# ${name.trim()}\n\n${m.text.replace(CITE, "").trim()}\n`);
      toast("Deck saved.", "ok");
      return open(path);
    }
    case "chat-insert": {
      const m = S.chat.messages[Number(el.dataset.i)];
      if (!m?.insertInto || !note(m.insertInto)) return;
      await writeNote(m.insertInto, summaryInto(draftOf(m.insertInto).text, m.text));
      toast("Summary added.", "ok");
      return open(m.insertInto);
    }
    // --- features and kits
    case "tour": return onboarding();
    case "bib-paste": { const t = await ask({ title: "Paste BibTeX", multiline: true, placeholder: "@article{key, author = {…}, title = {…}, year = {…}}", ok: "Add" }); if (t?.trim()) { const list = parseBibtex(t); if (!list.length) return toast("No BibTeX entries found.", "error"); await addSources(list); } return; }
    case "doi-add": return doiLookup();
    case "thesis-new": { const t = (await ask({ title: "New thesis", label: "Title", ok: "Create" }))?.trim(); if (!t) return; const p = `Research/${t.replace(/[\\/:*?"<>|#^[\]]/g, " ")}.md`; await createQuiet(p, `---\ntype: thesis\ntitle: ${t}\nauthor: \n---\n# ${t}\n\n## Chapters\n\n1. [[Introduction]]\n2. [[Literature review]]\n3. [[Method]]\n4. [[Results]]\n5. [[Discussion]]\n`); S.tab = "notes"; return open(p); }
    case "thesis-compile": return compileThesisNote(el.dataset.path!);
    case "scene-new": {
      const t = (await ask({ title: "New scene", label: "Title", ok: "Next" }))?.trim(); if (!t) return;
      const ms = manuscript(orgNotes());
      const ch = await ask({ title: t, label: "Chapter", choices: [...ms.map((c) => ({ value: c.chapter, label: c.chapter })), { value: `Chapter ${ms.length + 1}`, label: `A new chapter (Chapter ${ms.length + 1})` }], value: ms[ms.length - 1]?.chapter ?? "Chapter 1", ok: "Create" }); if (!ch) return;
      const order = Math.max(0, ...ms.flatMap((c) => c.scenes.map((x) => (x.order === 9999 ? 0 : x.order)))) + 1;
      const p = `Manuscript/${t.replace(/[\\/:*?"<>|#^[\]]/g, " ")}.md`;
      await createQuiet(p, `---\ntype: scene\nchapter: ${ch}\norder: ${order}\npov: \ndate: \n---\n# ${t}\n\n`); S.tab = "notes"; await open(p); pane().view = "edit"; return render();
    }
    case "bible-new": {
      const k = el.dataset.kind!; const n = (await ask({ title: `New ${k}`, label: "Name", ok: "Create" }))?.trim(); if (!n) return;
      const props = k === "character" ? "eyes: \nhair: \nage: \nborn: \nrole: " : k === "place" ? "region: \nclimate: \nfirst_seen: " : "owner: \nmade: \npowers: ";
      const p = `Bible/${n.replace(/[\\/:*?"<>|#^[\]]/g, " ")}.md`; await createQuiet(p, `---\ntype: ${k}\n${props}\n---\n# ${n}\n\n`); S.tab = "notes"; return open(p);
    }
    case "beta-share": { const f = S.folders.includes("Manuscript") ? "Manuscript" : S.folders[0] ?? ""; return shareDialog(f, "folder"); }
    case "care-dose": return careAdd("dose");
    case "care-symptom": return careAdd("symptom");
    case "appt-new": {
      const d = (await ask({ title: "New appointment", label: "Date (YYYY-MM-DD)", value: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10), ok: "Next" }))?.trim(); if (!d) return;
      const w = (await ask({ title: `Appointment on ${d}`, label: "With", placeholder: "Dr Patel", ok: "Create" }))?.trim() ?? "";
      const p = `Care/Appointments/${d}${w ? ` ${w.replace(/[\\/:*?"<>|#^[\]]/g, " ")}` : ""}.md`; await createQuiet(p, `---\ntype: appointment\ndate: ${d}\nwith: ${w}\n---\n# ${d}${w ? ` with ${w}` : ""}\n\n## Notes\n\n- \n`); return render();
    }
    case "care-summary": return careSummaryNote();
    case "care-share": return shareDialog("Care", "folder");
    case "care-checkin-new": return careCheckin();
    case "adr-new": {
      const t = (await ask({ title: "New decision record", label: "Title", placeholder: "Use Postgres for search", ok: "Next" }))?.trim(); if (!t) return;
      const adrs = orgNotes().filter((n) => (frontmatter(n.content).data.type ?? "") === "adr");
      const sup = adrs.length ? await ask({ title: t, label: "Supersedes", choices: [{ value: "", label: "Nothing" }, ...adrs.map((a) => ({ value: a.path, label: base(a.path) }))], value: "", ok: "Create" }) : "";
      if (sup === null) return;
      const id = nextAdr(paths());
      const p = `Decisions/${id} ${t.replace(/[\\/:*?"<>|#^[\]]/g, " ")}.md`;
      await createQuiet(p, adrTemplate(id, t, sup ? stem(sup) : undefined));
      if (sup) await writeNote(sup, setProperty(S.drafts.get(sup)?.text ?? note(sup)!.content, "status", "superseded"));
      S.tab = "notes"; return open(p);
    }
    case "runbook-new": { const t = (await ask({ title: "New runbook", label: "Title", placeholder: "Restore the database", ok: "Create" }))?.trim(); if (!t) return; const p = `Runbooks/${t.replace(/[\\/:*?"<>|#^[\]]/g, " ")}.md`; await createQuiet(p, fillTemplate(RUNBOOK_TEMPLATE, { title: t })); S.tab = "notes"; return open(p); }
    case "change-new": {
      const t = (await ask({ title: "New change", label: "What changed", placeholder: "Dark mode", ok: "Next" }))?.trim(); if (!t) return;
      const last = changelog(orgNotes()).changes.map((c) => c.version).find((v) => v !== "Unreleased") ?? "Unreleased";
      const v = await ask({ title: t, label: "Version", value: last, ok: "Next" }); if (v === null) return;
      const k = await ask({ title: t, label: "Kind", choices: ["Added", "Changed", "Fixed", "Removed", "Deprecated", "Security"].map((x) => ({ value: x.toLowerCase(), label: x })), value: "added", ok: "Create" }); if (!k) return;
      await createQuiet(`Changes/${t.replace(/[\\/:*?"<>|#^[\]]/g, " ")}.md`, `---\ntype: change\nversion: ${v.trim() || "Unreleased"}\ndate: ${new Date().toISOString().slice(0, 10)}\nkind: ${k}\n---\n# ${t}\n\n`); return render();
    }
    case "changelog-build": {
      const { md } = changelog(orgNotes());
      if (note("Changelog.md")) await writeNote("Changelog.md", md); else await createQuiet("Changelog.md", md);
      try { unwrap(await nb().set_share({ path: "Changelog.md", public: true, public_role: Role.View, viewers: [], commenters: [], editors: [] })); await refreshShares(); const link = shareLink("Changelog.md"); await copy(link); toast("Changelog published; its public link is copied.", "ok"); } catch (e) { toast(`Built, but not published: ${errMsg(e)}`, "error"); }
      return render();
    }
    // --- Organize
    case "org-open-q": { S.org.q = el.dataset.q ?? ""; S.org.selected.clear(); S.tab = "organize"; return render(); }
    case "org-open": { const x = S.settings.searches[Number(el.dataset.i)]; if (!x) return; S.org.q = x.q; S.org.selected.clear(); S.tab = "organize"; return render(); }
    case "org-load": { const x = S.settings.searches[Number(el.dataset.i)]; if (x) { S.org.q = x.q; S.org.selected.clear(); } return render(); }
    case "org-del": { S.settings.searches.splice(Number(el.dataset.i), 1); await saveSettings(); return render(); }
    case "org-save": {
      const name = await ask({ title: "Save this search", label: "Name", value: S.org.q.slice(0, 40), ok: "Save" });
      if (!name?.trim()) return;
      S.settings.searches.push({ name: name.trim(), q: S.org.q.trim() });
      await saveSettings();
      toast("Saved; it is in the file pane too.", "ok");
      return render();
    }
    case "org-sort": { const k = el.dataset.key!; S.org.sort = S.org.sort?.key === k ? { key: k, dir: -S.org.sort.dir } : { key: k, dir: 1 }; return render(); }
    case "org-unselect": { S.org.selected.clear(); return render(); }
    case "org-bulk": {
      const key = await ask({ title: `Set a property on ${S.org.selected.size} notes`, label: "Property", placeholder: "status", ok: "Next" });
      if (!key?.trim()) return;
      const value = await ask({ title: `${key.trim()} on ${S.org.selected.size} notes`, label: "Value (empty removes it)", value: "", ok: "Apply" });
      if (value === null) return;
      for (const p of S.org.selected) await writeNote(p, setProperty(S.drafts.get(p)?.text ?? note(p)?.content ?? "", key.trim(), value));
      toast(`Updated ${S.org.selected.size} notes.`, "ok");
      S.org.selected.clear();
      return render();
    }
    case "org-tile": {
      const dashes = paths().filter(isDashPath);
      const choice = await ask({ title: "Show this search on a dashboard", label: "Dashboard", choices: [{ value: "", label: "A new dashboard" }, ...dashes.map((d) => ({ value: d, label: stem(d) }))], value: dashes[0] ?? "", ok: "Add" });
      if (choice === null) return;
      const path = choice || "Dashboard.dash";
      if (!note(path)) await createQuiet(path, NEW_DASH);
      const label = S.settings.searches.find((x) => x.q === S.org.q)?.name ?? S.org.q;
      updateDash(path, (d) => { d.tiles.push({ id: Math.random().toString(36).slice(2, 8), kind: "search", source: "", q: S.org.q, label }); });
      void save(path);
      S.tab = "notes";
      return open(path);
    }
    case "org-archive": { const p = el.dataset.path!; const to = `Archive/${p.split("/").pop()}`; if (note(to)) return toast("Archive already has a note with that name.", "error"); await renamePath(p, to); return render(); }
    case "triage-toggle": { S.org.triage = !S.org.triage; S.org.triageIdx = 0; return render(); }
    case "triage-next": { S.org.triageIdx = (S.org.triageIdx + 1) % Math.max(1, inboxNotes().length); return render(); }
    case "triage-file": {
      const p = el.dataset.path!;
      const f = await ask({ title: `File “${title(p)}”`, label: "Folder", choices: S.folders.filter((x) => !isAgentPath(x) && x !== "Inbox").map((x) => ({ value: x, label: x })), value: store("nb-triage-folder") ?? S.folders.find((x) => x !== "Inbox") ?? "", ok: "File it" });
      if (!f) return;
      store("nb-triage-folder", f);
      await renamePath(p, `${f}/${p.split("/").pop()}`);
      return render();
    }
    case "triage-tag": {
      const p = el.dataset.path!;
      const t = await ask({ title: `Tag “${title(p)}”`, label: "Tags, comma separated", placeholder: "idea, reading", ok: "Tag it" });
      if (!t?.trim()) return;
      const text = S.drafts.get(p)?.text ?? note(p)!.content;
      const have = (frontmatter(text).data.tags ?? "").replace(/^\[|\]$/g, "").split(/\s*,\s*/).filter(Boolean);
      const tags = [...new Set([...have, ...t.split(/[\s,]+/).map((x) => x.replace(/^#/, "")).filter(Boolean)])].filter((x) => x !== "inbox");
      await writeNote(p, setProperty(text.replace(/(^|\s)#inbox\b/g, "$1"), "tags", `[${tags.join(", ")}]`));
      S.org.triageIdx = (S.org.triageIdx + 1) % Math.max(1, inboxNotes().length);
      return render();
    }
    case "triage-link": {
      const p = el.dataset.path!;
      const projs = orgNotes().filter((n) => (frontmatter(n.content).data.type ?? "").toLowerCase() === "project");
      if (!projs.length) return toast("No notes with type: project yet.", "info");
      const target = await ask({ title: `Link “${title(p)}” to a project`, label: "Project", choices: projs.map((n) => ({ value: n.path, label: stem(n.path) })), value: projs[0].path, ok: "Link" });
      if (!target) return;
      const pt = S.drafts.get(target)?.text ?? note(target)!.content;
      const line = `- [[${stem(p)}]]`;
      if (!pt.includes(line)) await writeNote(target, /\n## Notes\s*\n/.test(pt) ? pt.replace(/\n## Notes\s*\n/, `\n## Notes\n\n${line}\n`) : `${pt.trimEnd()}\n${line}\n`);
      await writeNote(p, setProperty(S.drafts.get(p)?.text ?? note(p)!.content, "project", `[[${stem(target)}]]`));
      toast(`Linked to ${title(target)}.`, "ok");
      S.org.triageIdx = (S.org.triageIdx + 1) % Math.max(1, inboxNotes().length);
      return render();
    }
    case "periodic-open": return openPeriodic(el.dataset.kind as Period);
    case "periodic-rebuild": return openPeriodic(el.dataset.kind as Period, true);
    case "rule-del": { S.settings.rules = S.settings.rules.filter((r) => r.id !== el.dataset.id); await saveSettings(); return render(); }
    case "kb-sweep": return sweepBoards(true);
    case "lint-create": { const t = el.dataset.target!; await createQuiet(t.endsWith(".md") ? t : `${t}.md`, `# ${base(t)}\n`); toast(`Created ${t}.`, "ok"); return render(); }
    case "lint-unlink": { const p = el.dataset.path!, t = el.dataset.target!; await writeNote(p, unlink(S.drafts.get(p)?.text ?? note(p)!.content, t)); toast(`Unlinked [[${t}]] in ${stem(p)}; the words stay.`, "ok"); return render(); }
    case "lint-index": { const p = el.dataset.path!; const idx = S.drafts.get("index.md")?.text ?? note("index.md")?.content; if (idx === undefined) return toast("There is no index.md.", "error"); await writeNote("index.md", `${idx.trimEnd()}\n- [[${stem(p)}]]\n`); return render(); }
    case "lint-rename": { const p = el.dataset.path!; const to = await ask({ title: `Rename “${stem(p)}”`, label: "New name (keep the folder or type a path)", value: stem(p), ok: "Rename" }); if (to?.trim() && to.trim() !== stem(p)) await renamePath(p, to.trim()); return render(); }
    case "lint-rmdir": return deleteFolder(el.dataset.path!);
    case "lint-pause": { const p = el.dataset.path!; await writeNote(p, setProperty(S.drafts.get(p)?.text ?? note(p)!.content, "status", "paused")); return render(); }
    case "res-keep": { S.settings.resurface = keepLater(S.settings.resurface, el.dataset.path!); await saveSettings(); return render(); }
    case "res-pin": { if (!isPinned(el.dataset.path!)) await togglePin(el.dataset.path!); S.settings.resurface = keepLater(S.settings.resurface, el.dataset.path!); await saveSettings(); return render(); }
    // --- Trips
    case "trip-new": return tripNew();
    case "trip-gear": return tripSheet("gear", el.dataset.folder!);
    case "trip-food": return tripSheet("food", el.dataset.folder!);
    case "trip-water": return tripSheet("water", el.dataset.folder!);
    case "field-entry": return fieldNote(el.dataset.folder!);
    case "trip-review": return tripReview(el.dataset.folder!);
    case "review-apply": return applyReview(el.dataset.path!);
    case "trip-print": { const p = el.dataset.path!; S.tab = "notes"; await open(p); const pn = pane(); if (pn.view === "edit") { pn.view = "preview"; render(); } setTimeout(() => window.print(), 400); return; }
    case "trip-leave": return tripLeave(el.dataset.path!);
    case "trip-checkin": { const r = await registry().check_in(BigInt(el.dataset.id!), null); if (r.__kind__ === "Err") return toast(r.Err, "error"); await loadWatches(); toast("Checked in. Your contact sees you are OK.", "ok"); return render(); }
    case "trip-home": { if ((await ask({ title: "Back home?", body: "Your contact stops watching this trip.", ok: "I'm back" })) === null) return; const r = await registry().close_watch(BigInt(el.dataset.id!)); if (r.__kind__ === "Err") return toast(r.Err, "error"); await loadWatches(); toast("Welcome back. Write the review while it is fresh.", "ok"); return render(); }
    case "gear-compare": return gearCompare();
    case "deck-add": { const k = el.dataset.deck!; await createQuiet(`Skills/${k}.md`, DECKS[k]); S.tab = "notes"; return open(`Skills/${k}.md`); }
    case "crypto-refresh": case "crypto-watch": case "crypto-trade-add": case "crypto-trade-close": case "crypto-thesis-add": case "crypto-thesis-held": case "crypto-thesis-broke": case "crypto-thesis-share": case "crypto-card": case "crypto-channel": return cryptoAction(action, el);
    case "career-app-add": case "career-board": case "career-followed": case "career-heard": case "career-exp-add": case "career-resume-new": case "career-compile": case "career-feedback": case "career-story-add": case "career-practice": case "career-contacted": case "career-person-add": case "career-channel": return careerAction(action, el);
    case "pdf-load": case "pdf-all": {
      const box = el.closest<HTMLElement>(".pdf-embed");
      if (!box) return;
      if (action === "pdf-all") box.dataset.all = "1";
      const body = box.querySelector<HTMLElement>(".pdf-body")!;
      body.innerHTML = `<span class="small muted">${action === "pdf-load" ? "Fetching…" : "Drawing pages…"}</span>`;
      try { if (action === "pdf-load") await pdfBytesFor(box, true); await drawPdf(box, box.dataset.all === "1"); } catch (e) { body.innerHTML = `<span class="small" style="color:var(--danger)">Could not show it: ${esc(errMsg(e))}</span>`; }
      return;
    }
    case "pdf-save": {
      const box = el.closest<HTMLElement>(".pdf-embed");
      if (box) await savePdfCopy(box);
      return;
    }
    case "nb-delete": return deleteNotebook();
    case "chat-clear":
      S.chat.messages = [];
      return render();
    case "attest":
      return act("attest", async () => {
        const r = await registry().attest(S.notebook!.canister);
        if (r.__kind__ === "Err") throw new Error(r.Err);
        S.attest = r.Ok;
        return `Judged ${r.Ok.grade}, ${r.Ok.score}/100.`;
      });
    case "delist":
      return act("delist", async () => {
        const r = await registry().delist(S.notebook!.canister);
        if (r.__kind__ === "Err") throw new Error(r.Err);
        S.listing = undefined;
        return "The listing is gone.";
      });
    case "buy":
      return buyListing(el.dataset.id!);
    case "market-filter": if (S.market) S.market.decksOnly = el.dataset.decks === "1"; return render();
    case "rate":
      return rateDialog(el.dataset.id!);
    case "see-ratings":
      return showRatings(el.dataset.id!);
    case "manage-tab":
      S.manageTab = el.dataset.tab as ManageTab;
      store("nb-manage-tab", S.manageTab);
      return render();
    case "aside-mode":
      S.asideMode = el.dataset.mode as "links" | "comments";
      return renderSide();
    case "comments":
      S.asideMode = S.asideMode === "comments" && S.asideOpen ? "links" : "comments";
      if (!S.asideOpen) { S.asideOpen = true; store("nb-aside", "1"); }
      if (S.mobile) S.mobilePane = "links";
      return render();
    case "more-menu":
      return moreMenu(el);
    case "attest-note": {
      const path = el.dataset.path!;
      const kind = el.dataset.kind!;
      const verdict = el.dataset.verdict!;
      const detail = await ask({ title: `${kind === "compare" ? "English vs Lean" : "Lean check"}: ${verdict}`, label: "Note for others (optional)", placeholder: kind === "compare" ? "e.g. the Lean adds n ≥ 2, the paper does not" : "Lean version, Mathlib commit…", ok: "Attest" });
      if (detail === null) return;
      try {
        const r = await nb().attest_note(path, kind, verdict, el.dataset.lean && el.dataset.lean !== path ? el.dataset.lean : null, detail);
        if (r.__kind__ === "Err") throw new Error(describe(r.Err));
        await loadAttestations(path);
        renderSide();
        refreshPreviews();
        toast("Attested; it stays valid until the note or the Lean changes.", "ok");
      } catch (e) { toast(errMsg(e), "error"); }
      return;
    }
    case "noop": return;
    case "ribbon-tab": {
      const tab = el.dataset.tab as Tab;
      if (S.notebook && !S.community && !S.board && !S.market && !S.admin && !S.town && !S.problems) return onAction("tab", el, ev!);
      const id = S.notebook?.canister.toText() ?? store("nb-last")?.match(/notebook\/([a-z0-9-]+)/)?.[1] ?? S.notebooks?.[0]?.canister.toText();
      if (!id) { location.hash = "#/"; return; }
      S.tab = tab;
      S.community = undefined; clearInterval(chatTimer); S.board = undefined; S.inbox = undefined; S.market = undefined; S.admin = undefined; S.town = undefined; clearInterval(townTimer); S.problems = undefined;
      const same = S.notebook?.canister.toText() === id;
      location.hash = `#/notebook/${id}`;
      if (same) render();
      return;
    }
    case "chat-channel": return loadCommunity(el.dataset.channel!);
    case "mcp-client": { S.mcpClient = el.dataset.client ?? "claude"; store("nb-mcp-client", S.mcpClient); return render(); }
    case "inbox-read": { store("nb-inbox-seen", (S.inbox?.items.reduce((m, i) => (i.id > m ? i.id : m), 0n) ?? 0n).toString()); S.inboxNew = 0; return render(); }
    case "inbox-refresh": return loadInbox();
    case "board-topic": { const t = el.dataset.topic ?? ""; store("nb-board-topic", t); if (location.hash !== "#/board") { S.board!.topic = t || undefined; location.hash = "#/board"; return; } return loadBoard(t); }
    case "board-sort": { S.board!.sort = el.dataset.sort as "hot" | "new" | "top"; store("nb-board-sort", S.board!.sort); return render(); }
    case "board-new": return newPost();
    case "board-vote": {
      const b = S.board!; const dir = Number(el.dataset.dir);
      if (el.dataset.kind === "post") { const r = await registry().vote_post(BigInt(el.dataset.id!), dir); if (r.__kind__ === "Err") return toast(r.Err, "error"); const i = b.posts.findIndex((p) => p.id === r.Ok.id); if (i >= 0) b.posts[i] = r.Ok; if (b.open?.id === r.Ok.id) b.open = r.Ok; }
      else { const r = await registry().vote_comment(BigInt(el.dataset.post!), BigInt(el.dataset.id!), dir); if (r.__kind__ === "Err") return toast(r.Err, "error"); const i = b.comments.findIndex((c) => c.id === r.Ok.id); if (i >= 0) b.comments[i] = r.Ok; }
      return render();
    }
    case "board-reply": { S.board!.replyTo = el.dataset.id ? BigInt(el.dataset.id) : undefined; render(); return document.querySelector<HTMLTextAreaElement>(".pcomment .pc-form textarea")?.focus(); }
    case "board-del": {
      if ((await ask({ title: "Delete this post?", body: "It and every comment on it are removed for good.", ok: "Delete", danger: true })) === null) return;
      const r = await registry().delete_post(BigInt(el.dataset.id!)); if (r.__kind__ === "Err") return toast(r.Err, "error");
      location.hash = "#/board"; return;
    }
    case "board-del-comment": {
      const b = S.board!; const r = await registry().delete_post_comment(BigInt(el.dataset.post!), BigInt(el.dataset.id!)); if (r.__kind__ === "Err") return toast(r.Err, "error");
      b.comments = await registry().post_comments(BigInt(el.dataset.post!)); return render();
    }
    case "board-share": {
      const b = S.board!;
      const ch = await ask({ title: "Discuss in chat", label: "Channel", choices: b.channels.map((c) => ({ value: c.name, label: `#${c.name}` })), value: b.open?.topic ?? "general", ok: "Drop it in" });
      if (!ch) return;
      const r = await paidPost(() => registry().share_post(ch, BigInt(el.dataset.id!))); if (r.__kind__ === "Err") return toast(r.Err, "error");
      return toast(`Shared in #${ch}.`, "ok");
    }
    case "chat-join": return joinCommunity();
    case "rain": return makeRain();
    case "wallet-add": return addIcp();
    case "wallet-refresh": { const b = await icpBalance().catch(() => undefined); if (S.community && b !== undefined) { S.community.balance = b; renderChannels(); } return; }
    case "chat-reply": { const c = S.community!; c.replyTo = c.messages.find((m) => m.id === BigInt(el.dataset.mid!)); render(); scrollChat(); return document.querySelector<HTMLTextAreaElement>("[name=chattext]")?.focus(); }
    case "chat-reply-cancel": { S.community!.replyTo = undefined; render(); return scrollChat(); }
    case "chat-edit": { const c = S.community!; const m = c.messages.find((x) => x.id === BigInt(el.dataset.mid!)); if (!m) return; c.editing = m.id; c.draft = m.text; c.replyTo = undefined; render(); scrollChat(); const ta = document.querySelector<HTMLTextAreaElement>("[name=chattext]"); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; } return; }
    case "chat-edit-cancel": { const c = S.community!; c.editing = undefined; c.draft = ""; render(); return scrollChat(); }
    case "chat-pin": {
      const c = S.community!; const m = c.messages.find((x) => x.id === BigInt(el.dataset.mid!)); if (!m) return;
      const r = await registry().pin_message(c.channel, m.id, !m.pinned);
      if (r.__kind__ === "Err") return toast(r.Err, "error");
      replaceMessage(r.Ok);
      c.pins = await registry().pinned(c.channel).then((x) => (x.__kind__ === "Ok" ? x.Ok : [])).catch(() => c.pins ?? []);
      render(); return scrollChat();
    }
    case "chat-to-board": {
      const c = S.community!; const m = c.messages.find((x) => x.id === BigInt(el.dataset.mid!)); if (!m) return;
      const text = m.text.replace(/\s+/g, " ").trim();
      return pinToBoard({ topic: c.channel, title: text.length > 90 ? `${text.slice(0, 87)}…` : text || (m.gist ? m.gist.title : m.poll ? "Poll" : "From the chat"), body: `@${m.handle} in #${c.channel}: ${m.text}`, ...(m.gist ? { notebook: m.gist.notebook.toText(), path: m.gist.path, text: m.gist.text } : {}) });
    }
    case "chat-pins": { const c = S.community!; c.showPins = !c.showPins; render(); return scrollChat(); }
    case "chat-goto": { const el2 = document.querySelector<HTMLElement>(`.msgrow[data-mid="${el.dataset.mid}"]`); if (el2) { el2.scrollIntoView({ block: "center", behavior: "smooth" }); el2.classList.add("flash"); setTimeout(() => el2.classList.remove("flash"), 1500); } else toast("That message is older than what is loaded.", "info"); return; }
    case "chat-del": {
      const c = S.community!;
      if ((await ask({ title: "Delete this message?", ok: "Delete", danger: true })) === null) return;
      const r = await registry().delete_message(c.channel, BigInt(el.dataset.mid!));
      if (r.__kind__ === "Err") return toast(r.Err, "error");
      const m = c.messages.find((x) => x.id === BigInt(el.dataset.mid!)); if (m) { m.deleted = true; m.text = ""; }
      return renderChat();
    }
    case "chat-section": {
      const sec = el.dataset.section!;
      const shut = chatCollapsed();
      if (shut.has(sec)) shut.delete(sec); else shut.add(sec);
      store("nb-chat-collapsed", JSON.stringify([...shut]));
      return renderChannels();
    }
    case "chat-move-channel": {
      ev?.stopPropagation();
      return moveChannel(el.dataset.channel!);
    }
    case "chat-new-channel": {
      const name = await ask({ title: "New channel", label: "Name (letters, digits, dashes)", placeholder: "lean", ok: "Next" });
      if (!name?.trim()) return;
      const topic = await ask({ title: `#${name.trim().toLowerCase()}`, label: "Topic", placeholder: "What it is for", ok: "Create" });
      if (topic === null) return;
      const r = await registry().create_channel(name.trim(), topic);
      if (r.__kind__ === "Err") return toast(r.Err, "error");
      await moveChannel(r.Ok.name);
      return loadCommunity(r.Ok.name);
    }
    case "chat-del-channel": {
      ev?.stopPropagation();
      const n = el.dataset.channel!;
      if ((await ask({ title: `Delete #${n}?`, body: "Its messages stay in storage but the channel disappears from the list.", ok: "Delete", danger: true })) === null) return;
      const r = await registry().delete_channel(n);
      if (r.__kind__ === "Err") return toast(r.Err, "error");
      return loadCommunity("general");
    }
    case "chat-online-toggle": return toggleSide("aside");
    case "chat-side-toggle": return toggleSide("side");
    case "chat-emoji": { const c = S.community!; c.picker = { mid: el.dataset.mid ? BigInt(el.dataset.mid) : undefined }; render(); return scrollChat(); }
    case "chat-pick-close": { S.community!.picker = undefined; render(); return scrollChat(); }
    case "chat-pick": {
      const c = S.community!;
      const emoji = el.dataset.emoji!;
      const mid = c.picker?.mid;
      c.picker = undefined;
      if (mid !== undefined) return reactTo(mid, emoji);
      const ta = document.querySelector<HTMLTextAreaElement>("[name=chattext]");
      const at = ta?.selectionStart ?? c.draft.length;
      c.draft = `${c.draft.slice(0, at)}${emoji}${c.draft.slice(at)}`;
      render();
      scrollChat();
      const ta2 = document.querySelector<HTMLTextAreaElement>("[name=chattext]");
      if (ta2) { ta2.focus(); ta2.setSelectionRange(at + emoji.length, at + emoji.length); ta2.style.height = "auto"; ta2.style.height = `${Math.min(ta2.scrollHeight, 160)}px`; }
      return;
    }
    case "chat-react": return reactTo(BigInt(el.dataset.mid!), el.dataset.emoji!);
    case "chat-vote": {
      const c = S.community!;
      const r = await registry().vote(c.channel, BigInt(el.dataset.mid!), Number(el.dataset.opt));
      if (r.__kind__ === "Err") return toast(r.Err, "error");
      return replaceMessage(r.Ok);
    }
    case "chat-primary": {
      const n = await myNotebookChoice("Which space pays for your chat?");
      if (!n || !S.community) return;
      const r = await registry().set_primary(n.canister).catch((e) => ({ __kind__: "Err", Err: errMsg(e) }) as const);
      if (r.__kind__ === "Err") return toast(r.Err, "error");
      S.community.primary = r.Ok;
      toast(`“${r.Ok.name}” pays for your chat now.`, "ok");
      return render();
    }
    case "notes-plus": {
      const r = el.getBoundingClientRect();
      return contextMenu(r.left, r.top - 8, "Tools", [
        { label: "Gardener · links, pairs and tags your notes could use", icon: "sprout", action: () => void gardenAction("garden-run", el) },
        { label: "Tidy-up · broken links, orphans, duplicates, empty folders", icon: "broom", action: () => { S.chat.tidy = true; if (S.mobile) S.mobilePane = "note"; render(); } },
        { label: `Open questions · what a folder's notes raise but don't answer · ${chatModel().paid ? "≈0.11 TC" : "0.001 TC"}`, icon: "help", action: () => void onAction("copilot-questions", el) },
      ]);
    }
    case "tidy-close": { S.chat.tidy = false; return render();
    }
    case "chat-plus": {
      const r = el.getBoundingClientRect();
      return contextMenu(r.left, r.top - 8, "", [
        { label: `Create a poll · ${cyc(S.community!.fee ?? 16_000_000n)}`, icon: "list", action: () => void createPoll() },
        { label: `Share a note for opinions · ${cyc(S.community!.fee ?? 16_000_000n)}`, icon: "file", action: () => void shareGist() },
        ...(flag("fundraisers") ? [S.community!.channels.find((x) => x.name === S.community!.channel)?.gate === "github"
          ? { label: `Raise for an AI plan · ${cyc(S.community!.fee ?? 16_000_000n)}`, icon: "bolt", action: () => void startPlanFund() } as MenuItem
          : { label: `Raise cycles for a space · ${cyc(S.community!.fee ?? 16_000_000n)}`, icon: "bolt", action: () => void startFund() } as MenuItem] : []),
      ]);
    }
    case "gist-open": { S.community = undefined; clearInterval(chatTimer); location.hash = `#/notebook/${el.dataset.nb}/${el.dataset.path}`; return; }
    case "gist-more": return el.closest(".gist")?.classList.toggle("open");
    case "link-github": return linkGithub();
    case "chat-jump": { S.community!.newCount = 0; return scrollChat(); }
    case "present": return present(draftOf(el.dataset.path!).text, el.dataset.path);
    case "show-next": return showStep(1);
    case "show-prev": return showStep(-1);
    case "show-close": return closeShow();
    case "gist-present": { const m = S.community!.messages.find((x) => x.id === BigInt(el.dataset.mid!)); if (m?.gist) present(m.gist.text, undefined, true); return; }
    case "gist-slide": {
      const c = S.community!;
      const mid = BigInt(el.dataset.mid!);
      const m = c.messages.find((x) => x.id === mid);
      if (!m?.gist) return;
      c.gistSlide ??= new Map();
      const n = splitSlides(m.gist.text).length;
      c.gistSlide.set(mid, Math.max(0, Math.min(n - 1, (c.gistSlide.get(mid) ?? 0) + Number(el.dataset.d))));
      const row = el.closest(".gist"); if (row) { row.outerHTML = gistHtml(m); afterRender(); }
      return;
    }
    case "fund-donate": {
      const c = S.community!;
      const m = c.messages.find((x) => x.id === BigInt(el.dataset.mid!));
      if (!m?.fund) return;
      const v = await ask({ title: m.fund.plan ? `Chip in for @${m.handle}'s ${m.fund.plan}` : `Chip in for “${m.fund.name}”`, body: m.fund.plan ? `The ICP goes to @${m.handle}'s in-app wallet, minus one ledger fee.` : `The ICP leaves your wallet and is minted into the space's cycles at once; the owner never holds it. ${useOisy ? "" : "Locally your dev account approves the registry first."}`, label: "Amount (ICP)", value: "0.1", ok: "Chip in" });
      if (v === null) return;
      const amount = BigInt(Math.round(Number(v) * 1e8));
      if (amount < 1_000_000n) return toast("Minimum is 0.01 ICP.", "error");
      try {
        await approvePayment(Principal.fromText(REGISTRY), amount + ICP_FEE);
        const r = await registry().donate(c.channel, m.id, amount);
        if (r.__kind__ === "Err") throw new Error(r.Err);
        replaceMessage(r.Ok);
        toast(m.fund.plan ? `${icp(amount)} ICP sent to @${m.handle}. Thank you.` : `${icp(amount)} ICP became cycles for “${m.fund.name}”. Thank you.`, "ok");
        void icpBalance().then((b) => { c.balance = b; renderChannels(); }).catch(() => {});
      } catch (e) { toast(errMsg(e), "error"); }
      return;
    }
    case "fund-close": {
      const c = S.community!;
      if ((await ask({ title: "Close this fundraiser?", body: "What was raised is already in the space; no more donations are taken.", ok: "Close it" })) === null) return;
      const r = await registry().close_fund(c.channel, BigInt(el.dataset.mid!));
      if (r.__kind__ === "Err") return toast(r.Err, "error");
      return replaceMessage(r.Ok);
    }
    case "chat-pane": { const w = document.querySelector(".workspace.community"); w?.classList.remove("m-files", "m-note", "m-links"); w?.classList.add(`m-${el.dataset.pane}`); document.querySelectorAll(".mobilebar .mtab").forEach((b) => b.setAttribute("aria-selected", String(b === el))); return; }
    case "nav-home": location.hash = "#/"; return;
    case "clipper-key":
      return act("clipper", async () => {
        const r = await nb().create_scoped_key(`clipper-${Date.now().toString(36).slice(-4)}`, "Inbox");
        if (r.__kind__ === "Err") throw new Error(describe(r.Err));
        S.clipperKey = r.Ok;
        const k = await nb().agent_keys();
        S.agentKeys = k.__kind__ === "Ok" ? k.Ok : S.agentKeys;
        return "Inbox key made; drag the bookmarklet to your bar.";
      });
    case "mention": {
      const name = el.dataset.name!;
      const person = people(workNotes()).find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (person?.path) return open(person.path);
      const r = el.getBoundingClientRect();
      return contextMenu(r.left, r.bottom + 4, `@${name}`, [
        { label: `Create a person note for ${name}`, icon: "person", action: () => void newNote(`People/${name}.md`, "People", undefined, fillTemplate(BUILTIN_TEMPLATES.Person, { title: name })) },
        { label: `${person?.mentions.length ?? 0} mention${person?.mentions.length === 1 ? "" : "s"} · see them in Work`, icon: "briefcase", action: () => { S.tab = "work"; S.taskOwner = name; render(); } },
      ]);
    }
    case "sheet-tab": {
      const p = el.dataset.path!; const i = Number(el.dataset.i);
      if ((sheetTab.get(p) ?? 0) === i && !S.mobile) { const n = await ask({ title: "Rename sheet", body: "Formulas that point at it by name are updated.", label: "Name", value: wbOf(p).sheets[i]?.name ?? "", ok: "Rename" }); if (n?.trim()) { renameSheet(p, i, n.trim()); void save(p); } return; }
      sheetTab.set(p, i);
      return refreshSheet(p);
    }
    case "sheet-add": { const p = el.dataset.path!; updateWorkbook(p, (wb) => { let n = wb.sheets.length + 1; while (wb.sheets.some((s) => s.name === `Sheet${n}`)) n++; wb.sheets.push(newSheet(`Sheet${n}`)); sheetTab.set(p, wb.sheets.length - 1); }, true); return void save(p); }
    case "sheet-del": {
      ev?.stopPropagation();
      const p = el.dataset.path!; const i = Number(el.dataset.i);
      const name = wbOf(p).sheets[i]?.name ?? "";
      if ((await ask({ title: `Delete sheet “${name}”?`, body: "Formulas on other sheets that point at it will show #REF!.", ok: "Delete", danger: true })) === null) return;
      updateWorkbook(p, (wb) => { if (wb.sheets.length > 1) wb.sheets.splice(i, 1); sheetTab.set(p, Math.max(0, Math.min(i, wb.sheets.length - 1))); }, true);
      return void save(p);
    }
    case "sheet-rows": { const p = el.dataset.path!; updateWorkbook(p, (wb) => { const sh = wb.sheets[Math.min(sheetTab.get(p) ?? 0, wb.sheets.length - 1)]; const n = Math.max(sh.rows.length + 5, 25) + 15; while (sh.rows.length < n) sh.rows.push([]); }, true); return; }
    case "sheet-chart": return chartDialog(el.dataset.path!);
    case "sheet-chart-edit": return chartDialog(el.dataset.path!, el.dataset.id);
    case "dash-add": return tileDialog(el.dataset.path!);
    case "dash-del": { const p = el.dataset.path!; updateDash(p, (d) => { d.tiles = d.tiles.filter((t) => t.id !== el.dataset.id); }); return void save(p); }
    case "dash-move": { const p = el.dataset.path!; updateDash(p, (d) => { const i = d.tiles.findIndex((t) => t.id === el.dataset.id); const j = i + Number(el.dataset.d); if (i < 0 || j < 0 || j >= d.tiles.length) return; [d.tiles[i], d.tiles[j]] = [d.tiles[j], d.tiles[i]]; }); return void save(p); }
    case "dash-width": { const p = el.dataset.path!; updateDash(p, (d) => { const t = d.tiles.find((x) => x.id === el.dataset.id); if (t) t.w = t.w === 2 ? 1 : 2; }); return void save(p); }
    case "sheet-chart-del": { const p = el.dataset.path!; updateWorkbook(p, (wb) => { for (const sh of wb.sheets) sh.charts = sh.charts.filter((c) => c.id !== el.dataset.id); }, true); return void save(p); }
    case "sheet-export": {
      const p = el.dataset.path!; const wb = wbOf(p); const sh = wb.sheets[Math.min(sheetTab.get(p) ?? 0, wb.sheets.length - 1)];
      return downloadBytes(`${stem(p)} - ${sh.name}.csv`, toCsv(evaluate(wb).get(sh.name) ?? []), "text/csv");
    }
    case "nb-run": return void runCell(el.dataset.path!, Number(el.dataset.i));
    case "nb-run-all": {
      const p = el.dataset.path!;
      const n = parseNotebook(draftOf(p).text).cells.length;
      for (let i = 0; i < n; i++) { const r = await runCell(p, i); if (r?.error) break; }
      return;
    }
    case "nb-restart": restartPython(); nbRunning.clear(); refreshNotebook(el.dataset.path!); return toast("Python restarted; variables are gone.", "ok");
    case "nb-add": { const p = el.dataset.path!; const i = Number(el.dataset.i); updateNotebook(p, (nb) => void nbAddCell(nb, i, el.dataset.type as "code" | "markdown")); return document.querySelectorAll<HTMLTextAreaElement>(`.nbk[data-ipynb="${CSS.escape(p)}"] textarea[name=nbsrc]`)[i + 1]?.focus(); }
    case "nb-del": { const p = el.dataset.path!; const i = Number(el.dataset.i); return updateNotebook(p, (nb) => void nb.cells.splice(i, 1)); }
    case "nb-move": { const p = el.dataset.path!; return updateNotebook(p, (nb) => nbMoveCell(nb, Number(el.dataset.i), Number(el.dataset.d) as -1 | 1)); }
    case "nb-type": { const p = el.dataset.path!; const i = Number(el.dataset.i); return updateNotebook(p, (nb) => { const c = nb.cells[i]; c.type = c.type === "code" ? "markdown" : "code"; c.outputs = []; c.count = null; }); }
    case "nb-edit-md": { if (S.mobile) return; const p = el.dataset.path!; const id = el.dataset.cell ?? (el.closest<HTMLElement>("[data-cell]")?.dataset.cell ?? ""); const set = nbEditing.get(p) ?? new Set(); set.add(id); nbEditing.set(p, set); refreshNotebook(p); return document.querySelector<HTMLTextAreaElement>(`.nbk[data-ipynb="${CSS.escape(p)}"] [data-cell="${CSS.escape(id)}"] textarea`)?.focus(); }
    case "new-meeting": return newMeeting();
    case "weekly-review": {
      const p = `Reviews/Week to ${dayKey(new Date())}.md`;
      const content = weeklyReview(workNotes().map((n) => ({ ...n, created: note(n.path)!.created, modified: note(n.path)!.modified })), new Date());
      if (note(p)) { onDraftInput(p, content); await save(p); return open(p); }
      return newNote(p, "Reviews", undefined, content);
    }
    case "new-from-template": return newFromTemplate();
    case "quick-capture": return quickCapture();
    case "task-owner": S.taskOwner = el.dataset.owner ?? ""; return render();
    case "follow-up": return followUp(el.dataset.path!, el);
    case "actions-to-board": return actionsToBoard(el.dataset.path!);
    case "new-person": { const n = el.dataset.name!; const p = `People/${n}.md`; if (note(p)) return open(p); return newNote(p, "People", undefined, fillTemplate(BUILTIN_TEMPLATES.Person, { title: n })); }
    case "notify-allow": { if ("Notification" in window) await Notification.requestPermission(); return render(); }
    case "sort-table": {
      const path = el.dataset.path!;
      const ti = Number(el.dataset.table);
      const col = Number(el.dataset.col);
      const desc = el.dataset.desc === "1";
      const text = draftOf(path).text;
      const lines = text.split("\n");
      let seen = -1; let line = -1; let code = false;
      for (let i = 0; i < lines.length; i++) { if (/^\s*```/.test(lines[i])) code = !code; if (!code && /^\s*\|/.test(lines[i]) && (i === 0 || !/^\s*\|/.test(lines[i - 1]))) { seen++; if (seen === ti) { line = i; break; } } }
      if (line < 0) return;
      onDraftInput(path, sortTable(text, line, col, desc));
      return;
    }
    case "study-mode": { const p = pane(pid); p.study = !p.study; if (p.study && p.view === "edit") p.view = "preview"; if (p.study) S.studyIdx.set(p.id, 0); return render(); }
    case "study-next": { const p = pane(pid); S.studyIdx.set(p.id, (S.studyIdx.get(p.id) ?? 0) + 1); return render(); }
    case "study-prev": { const p = pane(pid); S.studyIdx.set(p.id, Math.max(0, (S.studyIdx.get(p.id) ?? 0) - 1)); return render(); }
    case "study-cards": return studyNote("cards", el.dataset.path!);
    case "pomodoro": S.pomodoro = S.pomodoro ? undefined : { end: Date.now() + POMO.work * 1000, phase: "work" }; return render();
    case "side-toggle":
      return toggleSide("side");
    case "aside-toggle":
      return toggleSide("aside");
    case "freeze-modal": {
      const id = S.notebook!.canister.toText();
      const h = S.health.get(id) ?? (await loadHealth(id));
      return h ? freezeModal(id, h) : toast("Could not read the space's health.", "error");
    }
    case "qz-flip": { const st = quizStates.get(el.dataset.path!); if (st) { st.flipped = !st.flipped; refreshQuiz(el.dataset.path!); } return; }
    case "qz-rate": {
      const path = el.dataset.path!;
      const st = quizStates.get(path);
      if (!st) return;
      const r = el.dataset.r as Rating;
      const card = parseCards(draftOf(path).text)[st.order[st.i]];
      if (card) {
        const m = srsFor(path);
        const k = cardKey(card.front);
        m[k] = srsReview(m[k], r, new Date());
        saveSrs(path, m);
        if (!isSharedKey(path)) {
          const ds = S.settings.deckStats[path] ?? { reviews: 0, good: 0 };
          ds.reviews++;
          if (r !== "again") ds.good++;
          S.settings.deckStats[path] = ds;
          bumpStudy();
        }
      }
      r === "again" ? st.again++ : st.good++;
      st.i++;
      st.flipped = false;
      if (st.i >= st.order.length) void finishSession(path, st.good, st.order.length);
      refreshQuiz(path);
      if (!isSharedKey(path)) document.querySelectorAll<HTMLElement>(".rb-count").forEach((b) => (b.textContent = String(dueTotal())));
      return;
    }
    case "qz-due": { const p = el.dataset.path!; deckSession(p, draftOf(p).text, true); return refreshQuiz(p); }
    case "qz-all": { const p = el.dataset.path!; deckSession(p, draftOf(p).text, true, 0, true); return refreshQuiz(p); }
    case "anki": {
      const p = el.dataset.path!;
      const blob = new Blob([ankiTsv(parseCards(draftOf(p).text), title(p))], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title(p)}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return toast("Anki file downloaded; File → Import in Anki.", "ok");
    }
    case "qz-pick": {
      const st = quizStates.get(el.dataset.path!);
      if (!st || st.checked) return;
      const k = Number(el.dataset.opt);
      const q = parseChoice(draftOf(el.dataset.path!).text)[st.order[st.i]];
      if (q && q.correct.length === 1) st.picked.clear();
      st.picked.has(k) ? st.picked.delete(k) : st.picked.add(k);
      return refreshQuiz(el.dataset.path!);
    }
    case "qz-check": { const st = quizStates.get(el.dataset.path!); if (st && st.picked.size) { st.checked = true; const q = parseChoice(draftOf(el.dataset.path!).text)[st.order[st.i]]; if (q && graded(q, st.picked)) st.right++; refreshQuiz(el.dataset.path!); } return; }
    case "qz-next": { const p = el.dataset.path!; const st = quizStates.get(p); if (st) { st.i++; st.checked = false; st.picked = new Set(); if (st.i >= st.order.length) { if (!isSharedKey(p)) bumpStudy(st.order.length); void finishSession(p, st.right, st.order.length); } refreshQuiz(p); } return; }
    case "qz-restart": { const p = el.dataset.path!; const n = quizStates.get(p)?.n ?? 0; if (quizKind(draftOf(p).text) === "cards") deckSession(p, draftOf(p).text, true, 0, true); else quizState(p, n, true, 0); return refreshQuiz(p); }
    case "qz-shuffle": { const p = el.dataset.path!; const n = quizStates.get(p)?.n ?? 0; const seed = Date.now() % 100000 || 1; if (quizKind(draftOf(p).text) === "cards") deckSession(p, draftOf(p).text, true, seed, true); else quizState(p, n, true, seed); return refreshQuiz(p); }
    case "kb-del":
      return updateBoard(el.dataset.path!, (b) => void b.lanes[Number(el.dataset.lane)]?.cards.splice(Number(el.dataset.idx), 1));
    case "kb-add-lane": {
      const name = await ask({ title: "New lane", label: "Name", placeholder: "In review", ok: "Add" });
      if (name?.trim()) updateBoard(el.dataset.path!, (b) => void b.lanes.push({ title: name.trim(), cards: [], complete: false }));
      return;
    }
    case "kb-lane-menu": {
      const path = el.dataset.path!;
      const li = Number(el.dataset.lane);
      const lane = parseBoard(draftOf(path).text).lanes[li];
      if (!lane) return;
      const r = el.getBoundingClientRect();
      return contextMenu(r.left, r.bottom + 4, lane.title, [
        { label: lane.complete ? "Stop marking cards done" : "Mark cards here as done", icon: "check", action: () => updateBoard(path, (b) => { const l = b.lanes[li]; l.complete = !l.complete; for (const c of l.cards) c.done = l.complete; }) },
        { label: "Move lane left", icon: "links", action: () => updateBoard(path, (b) => { if (li > 0) b.lanes.splice(li - 1, 0, b.lanes.splice(li, 1)[0]); }) },
        { label: "Move lane right", icon: "move", action: () => updateBoard(path, (b) => { if (li < b.lanes.length - 1) b.lanes.splice(li + 1, 0, b.lanes.splice(li, 1)[0]); }) },
        "-",
        { label: "Delete lane", icon: "trash", danger: true, action: () => void (async () => { if (!lane.cards.length || (await ask({ title: `Delete “${lane.title}” and its ${lane.cards.length} cards?`, ok: "Delete", danger: true })) !== null) updateBoard(path, (b) => void b.lanes.splice(li, 1)); })() },
      ]);
    }
    case "open":
      return open(el.dataset.path!, { newTab });
    case "wiki":
      return follow(el.dataset.target!, newTab);
    case "tag":
      S.tag = el.dataset.tag ?? "";
      S.query = "";
      S.tab = "notes";
      if (S.mobile) S.mobilePane = "files";
      return render();
    case "fold": {
      const p = el.dataset.path!;
      S.collapsed.has(p) ? S.collapsed.delete(p) : S.collapsed.add(p);
      store("nb-collapsed", JSON.stringify([...S.collapsed]));
      return renderSide();
    }
    case "row-menu": {
      const r = el.getBoundingClientRect();
      return menuFor(el.dataset.kind as "file" | "folder", el.dataset.path!, r.left - 160, r.bottom + 4);
    }
    case "root-menu": {
      const r = el.getBoundingClientRect();
      return menuFor("root", "", r.left - 160, r.bottom + 4);
    }
    case "new":
      return newMenu(el);
    case "tab-new":
      return newNote(undefined, undefined, pid);
    case "tab-open":
      return open(el.dataset.tab!, { paneId: pid });
    case "tab-close":
      return closeTab(pid!, el.dataset.tab!);
    case "pane-menu": {
      const r = el.getBoundingClientRect();
      return paneMenu(pid!, r.right - 200, r.bottom + 4);
    }
    case "download":
      return downloadNotebook();
    case "share":
      return shareDialog(el.dataset.path!, (el.dataset.kind as "note" | "folder" | "notebook" | undefined) ?? "note");
    case "help":
      return helpDialog();
    case "nb-menu": {
      const r = el.getBoundingClientRect();
      const items: MenuItem[] = (S.notebooks ?? []).map((n) => ({ label: n.name, icon: "notebook", checked: n.canister.toText() === S.notebook?.canister.toText(), action: () => { if (n.canister.toText() !== S.notebook?.canister.toText()) void saveAll().then(() => openNotebook(n.canister.toText())); } }));
      items.push("-", { label: "New space…", icon: "plus", action: () => void ask({ title: "New space", label: "Name", placeholder: "Research", ok: "Create" }).then((v) => { if (v?.trim()) { S.newNotebook = v.trim(); void saveAll().then(() => { location.hash = "#/"; void createNotebook(); }); } }) }, { label: "All spaces", icon: "updown", action: () => { void saveAll(); location.hash = "#/"; } }, { label: "Manage this space", icon: "bolt", action: () => { S.tab = "manage"; render(); } });
      return contextMenu(r.left, r.top - 8 - items.length * 34, "Spaces", items);
    }
    case "today":
      return openDaily();
    case "pin":
      return togglePin(el.dataset.path!);
    case "pin-reveal": {
      // open the pinned folder and its parents in the tree, then bring it into view
      const f = el.dataset.path!;
      f.split("/").forEach((_, i, a) => S.collapsed.delete(a.slice(0, i + 1).join("/")));
      store("nb-collapsed", JSON.stringify([...S.collapsed]));
      if (S.mobile) S.mobilePane = "files";
      render();
      document.querySelector<HTMLElement>(`.tree [data-kind=folder][data-path="${CSS.escape(f)}"]`)?.scrollIntoView({ block: "center" });
      return;
    }
    case "props-toggle":
      S.propsOpen = !S.propsOpen;
      store("nb-props", S.propsOpen ? "1" : "0");
      return render();
    case "prop-add": {
      const form = el.closest<HTMLElement>("[data-props]")!;
      const data = propsFromForm(form);
      let k = "property";
      for (let i = 2; k in data; i++) k = `property${i}`;
      data[k] = "";
      onDraftInput(form.dataset.props!, setFrontmatter(draftOf(form.dataset.props!).text, data));
      render();
      return (document.querySelector<HTMLInputElement>(`[name=pkey][data-key="${CSS.escape(k)}"]`))?.select();
    }
    case "prop-del": {
      const form = el.closest<HTMLElement>("[data-props]")!;
      const data = propsFromForm(form);
      delete data[el.dataset.key!];
      onDraftInput(form.dataset.props!, setFrontmatter(draftOf(form.dataset.props!).text, data));
      return render();
    }
    case "admin-refresh":
      return loadAdmin();
    case "admin-kind": { S.admin!.kind = el.dataset.kind || undefined; return render(); }
    case "admin-filter":
      S.admin!.filter = el.dataset.filter!;
      return render();
    case "admin-open":
      S.admin!.open = S.admin!.open === BigInt(el.dataset.id!) ? undefined : BigInt(el.dataset.id!);
      return render();
    case "copy-key":
      await copy(S.issued!.key);
      return toast("Key copied.", "ok");
    case "copy-skill":
      await copy(await agentSkill());
      if (S.issued && !S.skillCopied) { S.skillCopied = true; if (document.querySelector(".onboard")) onboarding(1); }
      return toast("Setup prompt copied. Paste it into your agent.", "ok");
    case "revoke-key":
      if (!(await confirmDialog(`Revoke the key for ${el.dataset.name}?`, "The agent stops working at once. Its notes stay.", "Revoke"))) return;
      try {
        unwrap(await nb().revoke_agent_key(el.dataset.name!));
        const r = await nb().agent_keys();
        S.agentKeys = r.__kind__ === "Ok" ? r.Ok : S.agentKeys;
        toast(`Revoked ${el.dataset.name}.`, "ok");
      } catch (e) {
        toast(errMsg(e), "error");
      }
      return render();
    case "import-new":
      return importDialog(true);
    case "import":
      return importDialog();
    case "restore":
      return restoreDialog();
    case "share-notebook":
      return shareDialog("", "notebook");
    case "del-comment":
      try {
        const r = await (S.shared ? notebookOf(S.shared.canister) : nb()).delete_comment(BigInt(el.dataset.id!));
        if (r.__kind__ === "Err") throw new Error(describe(r.Err));
        if (S.shared) return openShared(S.shared.canister, S.shared.path);
        S.comments = S.comments.filter((c) => c.id !== BigInt(el.dataset.id!) && c.parent !== BigInt(el.dataset.id!));
        renderSide();
      } catch (e) {
        toast(errMsg(e), "error");
      }
      return render();
    case "unpublish":
      try {
        unwrap(await nb().set_published(null));
        S.published = null;
        toast("Unpublished.", "ok");
      } catch (e) {
        toast(errMsg(e), "error");
      }
      return render();
    case "snap-refresh":
    case "snap-take":
    case "snap-restore":
    case "snap-delete": {
      const c = S.notebook!.canister;
      try {
        if (action === "snap-take") {
          S.busy = "snap";
          render();
          const r = await registry().take_snapshot(c, S.snapshots?.[0] ? S.snapshots[0].id : null);
          if (r.__kind__ === "Err") throw new Error(r.Err);
          toast("Snapshot taken.", "ok");
        } else if (action === "snap-restore") {
          if (!(await confirmDialog("Restore this snapshot?", "The space is stopped, rolled back to the snapshot, and started again. Everything written since is lost.", "Restore"))) return;
          S.busy = "snap";
          render();
          const r = await registry().restore_snapshot(c, unhex(el.dataset.id!));
          if (r.__kind__ === "Err") throw new Error(r.Err);
          toast("Restored. Reloading the space.", "ok");
          await loadNotebook();
        } else if (action === "snap-delete") {
          const r = await registry().delete_snapshot(c, unhex(el.dataset.id!));
          if (r.__kind__ === "Err") throw new Error(r.Err);
        }
        const l = await registry().list_snapshots(c);
        S.snapshots = l.__kind__ === "Ok" ? l.Ok : [];
      } catch (e) {
        toast(errMsg(e), "error");
      }
      S.busy = "";
      return render();
    }
    case "attach-open":
      return openAttachment(el.dataset.target!);
    case "heading": {
      const path = el.dataset.path ?? el.closest<HTMLElement>("[data-preview-path]")?.dataset.previewPath ?? cur();
      if (!path) return;
      pendingScroll = { path, target: el.dataset.heading! };
      const p = pane();
      if (p.view === "edit") { p.view = "split"; render(); }
      return scrollPending();
    }
    case "palette":
      return openPalette();
    case "menu-current": {
      const r = el.getBoundingClientRect();
      const p = pane(pid);
      return p.active && menuFor("file", p.active, r.right - 220, r.bottom + 4);
    }
    case "view":
      return cycleView(pid);
    case "depth":
      S.localDepth = S.localDepth >= 3 ? 1 : S.localDepth + 1;
      store("nb-local-depth", String(S.localDepth));
      return renderSide();
    case "graph-fit":
      return graph?.fit();
    case "refresh-info":
      return refreshInfo();
    case "copy-principal":
      await copy(S.principal);
      return flashCopied("principal");
    case "copy-acct":
      await copy(el.dataset.value!);
      return flashCopied("acct");
    case "copy-cmd":
      await copy(el.dataset.value!);
      return toast("Command copied.", "ok");
  }
}

document.addEventListener("click", (ev) => {
  if (!(ev.target as HTMLElement).closest(".ctx-menu")) closeMenu();
  const t = ev.target as HTMLElement;
  // touch screens have no hover: tapping a chat message shows its actions, tapping elsewhere hides them
  if (matchMedia("(hover: none)").matches && !t.closest(".mtools")) {
    const row = t.closest<HTMLElement>(".msgrow");
    document.querySelectorAll(".msgrow.tools-on").forEach((r) => { if (r !== row) r.classList.remove("tools-on"); });
    if (row && !t.closest("a, button, input, textarea, .poll, .gist, .fund, .reacts")) row.classList.toggle("tools-on");
  }
  // a task checkbox in reading view flips its [ ] in the source
  if (t instanceof HTMLInputElement && t.type === "checkbox" && t.closest(".preview")) {
    const pv = t.closest<HTMLElement>(".preview")!;
    const path = pv.dataset.previewPath!;
    const i = [...pv.querySelectorAll("input[type=checkbox]")].indexOf(t);
    onDraftInput(path, toggleTask(draftOf(path).text, i));
    return;
  }
  const paneEl = t.closest<HTMLElement>(".pane[data-pane]");
  if (paneEl && Number(paneEl.dataset.pane) !== S.focused) {
    S.focused = Number(paneEl.dataset.pane);
    document.querySelectorAll(".pane.focused").forEach((p) => p.classList.remove("focused"));
    if (S.panes.length > 1) paneEl.classList.add("focused");
    syncHash();
    renderSide();
  }
  const el = t.closest<HTMLElement>("[data-action]");
  if (!el || el.dataset.action === "nav" || (el as HTMLButtonElement).disabled) return;
  if (el.tagName === "A") ev.preventDefault();
  void onAction(el.dataset.action!, el, ev);
});
document.addEventListener("auxclick", (ev) => {
  if (ev.button !== 1) return;
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action="open"], [data-action="wiki"], [data-action="tab-open"]');
  if (!el) return;
  ev.preventDefault();
  if (el.dataset.action === "tab-open") closeTab(Number(el.dataset.pane), el.dataset.tab!);
  else void onAction(el.dataset.action!, el, ev);
});
document.addEventListener("contextmenu", (ev) => {
  const t = ev.target as HTMLElement;
  const tabEl = t.closest<HTMLElement>(".tabitem[data-tab]");
  if (tabEl) {
    ev.preventDefault();
    const pid = Number(tabEl.dataset.pane);
    const path = tabEl.dataset.tab!;
    return contextMenu(ev.clientX, ev.clientY, path, [
      { label: "Split right", icon: "split", action: () => moveTab(pid, path, pid, undefined, true) },
      { label: "Close tab", icon: "x", action: () => closeTab(pid, path) },
      { label: "Close other tabs", icon: "x", action: () => { const p = pane(pid); p.tabs = [path]; p.active = path; render(); } },
      "-",
      { label: "Rename…", icon: "edit", action: () => void ask({ title: "Rename note", label: "Name (folder/name)", value: stem(path), ok: "Rename" }).then((v) => { if (v) void renamePath(path, v); }) },
      { label: "Delete", icon: "trash", danger: true, action: () => void deletePath(path) },
    ]);
  }
  const row = t.closest<HTMLElement>(".tree-row[data-kind]");
  const inTree = t.closest("[data-tree], .side");
  if (!row && !inTree) return;
  if (!S.notes || S.query.trim() || S.tag) return;
  ev.preventDefault();
  if (row) menuFor(row.dataset.kind as "file" | "folder", row.dataset.path!, ev.clientX, ev.clientY);
  else menuFor("root", "", ev.clientX, ev.clientY);
});

// tabs and tree files are draggable: between panes, to reorder, onto a pane's drop zone to split, or into a folder
let drag: { from?: number; path: string; folder?: boolean } | undefined;
document.addEventListener("dragstart", (ev) => {
  const card = (ev.target as HTMLElement).closest<HTMLElement>(".kb-card[data-kb-card]");
  if (card) {
    kbDrag = { path: card.dataset.path!, lane: Number(card.dataset.lane), idx: Number(card.dataset.idx) };
    ev.dataTransfer?.setData("text/plain", "");
    ev.dataTransfer!.effectAllowed = "move";
    card.classList.add("dragging");
    return;
  }
  const el = (ev.target as HTMLElement).closest<HTMLElement>(".tabitem[data-tab], .tree-row.file[data-path], .tree-row.folder[data-path]");
  if (!el) return;
  if (el.dataset.kind === "folder" && isAgentPath(el.dataset.path!)) return ev.preventDefault();
  drag = el.dataset.tab ? { from: Number(el.dataset.pane), path: el.dataset.tab } : { path: el.dataset.path!, folder: el.dataset.kind === "folder" };
  ev.dataTransfer?.setData("text/plain", drag.path);
  ev.dataTransfer!.effectAllowed = "move";
  document.body.classList.add("dragging-tab");
});
document.addEventListener("dragend", () => {
  kbDrag = undefined;
  drag = undefined;
  document.querySelectorAll(".kb-card.dragging, .kb-cards.over").forEach((e) => e.classList.remove("dragging", "over"));
  document.body.classList.remove("dragging-tab");
  document.querySelectorAll(".drop-before, .drop-into").forEach((e) => e.classList.remove("drop-before", "drop-into"));
});
document.addEventListener("dragover", (ev) => {
  if (kbDrag) {
    const zone = (ev.target as HTMLElement).closest<HTMLElement>(".kb-cards[data-kb-drop]");
    if (!zone) return;
    ev.preventDefault();
    document.querySelectorAll(".kb-cards.over").forEach((e) => e.classList.remove("over"));
    zone.classList.add("over");
    return;
  }
  if (!drag && ev.dataTransfer?.types.includes("Files") && (ev.target as HTMLElement).closest(".side")) {
    ev.preventDefault();
    return;
  }
  if (!drag) return;
  const t = ev.target as HTMLElement;
  const target = t.closest<HTMLElement>(".tabitem[data-tab], [data-tabbar], [data-dropzone], .tree-row.folder[data-path], [data-tree]");
  if (!target || (drag.folder && !target.matches(".tree-row.folder, [data-tree]"))) return;
  if (target.matches(".tree-row.folder") && isAgentPath(target.dataset.path!)) return;
  ev.preventDefault();
  document.querySelectorAll(".drop-before, .drop-into").forEach((e) => e.classList.remove("drop-before", "drop-into"));
  target.classList.add(target.classList.contains("tabitem") ? "drop-before" : "drop-into");
});
document.addEventListener("drop", (ev) => {
  if (kbDrag) {
    const zone = (ev.target as HTMLElement).closest<HTMLElement>(".kb-cards[data-kb-drop]");
    if (!zone) return;
    ev.preventDefault();
    const d = kbDrag;
    kbDrag = undefined;
    const over = (ev.target as HTMLElement).closest<HTMLElement>(".kb-card[data-kb-card]");
    const idx = over ? Number(over.dataset.idx) + (ev.clientY > over.getBoundingClientRect().top + over.offsetHeight / 2 ? 1 : 0) : zone.querySelectorAll(".kb-card").length;
    updateBoard(d.path, (b) => moveCard(b, { lane: d.lane, idx: d.idx }, { lane: Number(zone.dataset.lane), idx }));
    return;
  }
  if (!drag && ev.dataTransfer?.files.length && (ev.target as HTMLElement).closest(".side") && S.notes) {
    ev.preventDefault();
    const dt = ev.dataTransfer;
    void (async () => {
      const files = await filesFromDrop(dt);
      const overwrite = await ask({ title: `Import ${files.length} file${files.length === 1 ? "" : "s"}?`, label: "If a note already exists", choices: [{ value: "skip", label: "Keep mine, skip the import" }, { value: "overwrite", label: "Overwrite with the imported file" }], ok: "Import" });
      if (overwrite !== null) await importFiles(files, overwrite === "overwrite");
    })();
    return;
  }
  if (!drag) return;
  const t = ev.target as HTMLElement;
  const d = drag;
  const folderRow = t.closest<HTMLElement>(".tree-row.folder[data-path]");
  const treeArea = t.closest<HTMLElement>("[data-tree]");
  if (folderRow || treeArea) {
    // dropped in the file tree: move the note or folder there
    ev.preventDefault();
    drag = undefined;
    document.body.classList.remove("dragging-tab");
    document.querySelectorAll(".drop-into").forEach((e) => e.classList.remove("drop-into"));
    const into = folderRow ? folderRow.dataset.path! : "";
    if (isAgentPath(into) || isAgentPath(d.path)) return toast(`${AGENT_ROOT}/ is written by agents only.`, "error");
    const name = d.path.split("/").pop()!;
    const target = into ? `${into}/${name}` : name;
    if (target === d.path || into === dir(d.path)) return;
    if (d.folder) {
      if (into === d.path || into.startsWith(`${d.path}/`)) return toast("A folder cannot move into itself.", "error");
      return void renameFolder(d.path, target);
    }
    return void renamePath(d.path, target);
  }
  const zone = t.closest<HTMLElement>("[data-dropzone]");
  const tabEl = t.closest<HTMLElement>(".tabitem[data-tab]");
  const bar = t.closest<HTMLElement>("[data-tabbar]");
  if (!zone && !tabEl && !bar) return;
  ev.preventDefault();
  if (zone) moveTab(d.from, d.path, Number(zone.dataset.dropzone), undefined, true);
  else if (tabEl) {
    const to = Number(tabEl.dataset.pane);
    const idx = pane(to).tabs.indexOf(tabEl.dataset.tab!);
    moveTab(d.from, d.path, to, idx);
  } else moveTab(d.from, d.path, Number(bar!.dataset.pane));
  drag = undefined;
  document.body.classList.remove("dragging-tab");
});

document.addEventListener("input", (ev) => {
  const el = ev.target as HTMLInputElement | HTMLTextAreaElement;
  const v = el.value;
  switch (el.name) {
    case "newNotebook": S.newNotebook = v; break;
    case "feature": { const c = el as HTMLInputElement; S.settings.features[c.value as Tab] = c.checked; void saveSettings(); render(); break; }
    case "citestyle": { S.settings.citeStyle = v === "chicago" ? "chicago" : "apa"; void saveSettings(); render(); break; }
    case "claimsfor": { S.kit.claimsFor = v; render(); break; }
    case "writinggoal": { S.settings.writingGoal = Math.max(0, Number(v) || 0); void saveSettings(); break; }
    case "adrstatus": { const p = el.dataset.path!; void writeNote(p, setProperty(S.drafts.get(p)?.text ?? note(p)?.content ?? "", "status", v)).then(render); break; }
    case "bib": { const inp = el as HTMLInputElement; if (inp.files?.[0]) void inp.files[0].text().then((t) => { const list = parseBibtex(t); if (!list.length) toast("No BibTeX entries in that file.", "error"); else void addSources(list); }); inp.value = ""; break; }
    case "propcell": { const p = el.dataset.path!; void writeNote(p, setProperty(S.drafts.get(p)?.text ?? note(p)?.content ?? "", el.dataset.key!, v)); break; }
    case "orgpick": { const c = el as HTMLInputElement; if (c.checked) S.org.selected.add(c.value); else S.org.selected.delete(c.value); render(); break; }
    case "orgall": { const c = el as HTMLInputElement; S.org.selected = c.checked ? new Set(runQuery(orgNotes(), S.org.q).map((n) => n.path)) : new Set(); render(); break; }
    case "decaydays": { S.settings.decayDays = Math.max(0, Number(v) || 0); void saveSettings(); renderSide(); break; }
    case "hidefaded": { S.settings.hideFaded = (el as HTMLInputElement).checked; void saveSettings(); renderSide(); break; }
    case "kbarchive": { S.settings.kanbanArchiveDays = Math.max(0, Number(v) || 0); void saveSettings(); break; }
    case "workout-gpx": { const inp = el as HTMLInputElement; if (inp.files?.[0]) void importWorkoutGpx(inp.files[0]); inp.value = ""; break; }
    case "gpx": { const inp = el as HTMLInputElement; if (inp.files?.[0]) void importGpx(inp.dataset.folder!, inp.files[0]); inp.value = ""; break; }
    case "newDesc": S.newDesc = v; break;
    case "newAgent": S.newAgent = v; break;
    case "topupAmount": S.topupAmount = v; break;
    case "nbsrc": { const ta = el as HTMLTextAreaElement; const p = ta.dataset.path!; const i = Number(ta.dataset.i); ta.rows = Math.max(2, v.split("\n").length); updateNotebook(p, (nb) => { nb.cells[i].source = v; }, false); break; }
    case "taskdone": { const p = el.dataset.path!; const line = Number(el.dataset.line); onDraftInput(p, toggleTaskLine(draftOf(p).text, line)); void save(p); setTimeout(render, 300); break; }
    case "ics": { const inp = el as HTMLInputElement; if (inp.files?.length) void importIcs(inp.files).then(render); inp.value = ""; break; }
    case "cell": { const inp = el as HTMLInputElement; if (v !== inp.dataset.raw) { const si = Number(inp.dataset.s), r = Number(inp.dataset.r), c = Number(inp.dataset.c); updateWorkbook(inp.dataset.path!, (wb) => { const sh = wb.sheets[si]; while (sh.rows.length <= r) sh.rows.push([]); while (sh.rows[r].length <= c) sh.rows[r].push(""); sh.rows[r][c] = v; }); } break; }
    case "flag": {
      const inp = el as HTMLInputElement;
      void registry().set_flag(inp.dataset.flag!, inp.checked).then((r) => { if (r.__kind__ === "Err") { toast(r.Err, "error"); inp.checked = !inp.checked; return; } const i = S.flags.findIndex((f) => f.name === r.Ok.name); if (i >= 0) S.flags[i] = r.Ok; else S.flags.push(r.Ok); toast(`${r.Ok.name} is now ${r.Ok.on ? "on" : "off"}.`, "ok"); render(); });
      break;
    }
    case "notify": { store("nb-notify", (el as HTMLInputElement).checked ? "1" : "0"); if ((el as HTMLInputElement).checked) { store("nb-mention-seen", store("nb-mention-seen") ?? "0"); void checkMentions(); } renderOnline(); break; }
    case "csv": { const inp = el as HTMLInputElement; if (inp.files?.[0]) void importCsv(inp.dataset.path!, inp.files[0]); inp.value = ""; break; }
    case "kbdone":
      updateBoard(el.dataset.path!, (b) => { const c = b.lanes[Number(el.dataset.lane)]?.cards[Number(el.dataset.idx)]; if (!c) return; c.done = (el as HTMLInputElement).checked; c.text = c.text.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, "") + (c.done ? ` ✅ ${new Date().toISOString().slice(0, 10)}` : ""); });
      break;
    case "paytoken": S.payToken = v; store("nb-pay-token", v); break;
    case "progress": if (S.shared) { const st = Number(v); S.shared.myProgress = st; void notebookOf(S.shared.canister).set_progress(S.shared.path, st).then(() => toast(st ? "Progress saved for the group." : "Mark cleared.", "ok")); } break;
    case "chattext": if (S.community) { S.community.draft = v; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; } break;
    case "chatq": {
      S.chat.input = v; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
      // the gardener's bubble makes way as soon as a question is being typed; the box keeps the caret
      if ((S.chat.garden || S.chat.tidy) && v.trim()) { S.chat.garden = false; S.chat.tidy = false; render(); const ta = document.querySelector<HTMLTextAreaElement>("[name=chatq]"); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
      break;
    }
    case "chatfolder": {
      const f = (el as HTMLInputElement).value;
      const on = (el as HTMLInputElement).checked;
      for (const g of [...chatFolders(), ...S.chat.excluded]) if (g === f || (f && g.startsWith(`${f}/`))) on ? S.chat.excluded.delete(g) : S.chat.excluded.add(g);
      store(`nb-chat-off-${S.notebook!.canister.toText()}`, JSON.stringify([...S.chat.excluded]));
      render();
      break;
    }
    case "query":
      S.query = v;
      S.tag = "";
      S.serverHits = undefined;
      if (S.notes && S.notes.length > 1500 && v.trim()) {
        clearTimeout(searchTimer);
        searchTimer = window.setTimeout(async () => {
          const r = await nb().search_notes(v, 50);
          if (r.__kind__ === "Ok" && S.query === v) { S.serverHits = r.Ok; renderSide(); }
        }, 250);
      }
      renderSide();
      break;
    case "ghosts":
      S.graphGhosts = (el as HTMLInputElement).checked;
      store("nb-graph-ghosts", S.graphGhosts ? "1" : "0");
      applyGraph();
      break;
    case "gq": S.graphStyle.query = v; applyGraph(); break;
    case "gcolor": S.graphStyle.colorBy = v as "none" | "folder" | "tag"; store("nb-graph-color", v); applyGraph(); break;
    case "gattach": S.graphStyle.hideAttachments = (el as HTMLInputElement).checked; store("nb-graph-noattach", S.graphStyle.hideAttachments ? "1" : "0"); applyGraph(); break;
    case "gorphans": S.graphStyle.orphans = (el as HTMLInputElement).checked; applyGraph(); break;
    case "pkey":
    case "pval": {
      const form = el.closest<HTMLElement>("[data-props]");
      if (form) onDraftInput(form.dataset.props!, setFrontmatter(draftOf(form.dataset.props!).text, propsFromForm(form)));
      break;
    }
    case "draft":
      onDraftInput((el as HTMLTextAreaElement).dataset.path!, v);
      break;
  }
});
document.addEventListener("change", (ev) => {
  const el = ev.target as HTMLInputElement;
  if (el.name === "kbtitle") {
    const v = el.value.trim();
    if (v) updateBoard(el.dataset.path!, (b) => { const l = b.lanes[Number(el.dataset.lane)]; if (l) l.title = v; });
    return;
  }
  if (el.name === "title") {
    const p = pane(Number(el.dataset.pane));
    if (!p.active) return;
    const v = el.value.trim();
    // a bare name renames in place; a path with "/" moves the note
    const target = v.includes("/") || !dir(p.active) ? v : `${dir(p.active)}/${v}`;
    if (p.active.endsWith(".excalidraw.md") && !target.endsWith(".excalidraw") && !target.endsWith(".md")) void renamePath(p.active, `${target}.excalidraw.md`);
    else if (!p.active.endsWith(".md") && !target.includes(".")) void renamePath(p.active, `${target}.${p.active.split(".").pop()}`);
    else void renamePath(p.active, target);
  }
});
document.addEventListener("dblclick", (ev) => {
  const td = (ev.target as HTMLElement).closest<HTMLElement>("td[data-cell]");
  if (td) {
    const [ti, ri, ci] = td.dataset.cell!.split(":").map(Number);
    const path = td.dataset.path!;
    void ask({ title: "Edit cell", value: td.textContent ?? "", ok: "Save" }).then((v) => {
      if (v === null) return;
      const text = draftOf(path).text;
      const lines = text.split("\n");
      let seen = -1; let start = -1; let code = false;
      for (let i = 0; i < lines.length; i++) { if (/^\s*```/.test(lines[i])) code = !code; if (!code && /^\s*\|/.test(lines[i]) && (i === 0 || !/^\s*\|/.test(lines[i - 1]))) { seen++; if (seen === ti) { start = i; break; } } }
      if (start >= 0) onDraftInput(path, setCell(text, start + 2 + ri, ci, v));
    });
    return;
  }
  const card = (ev.target as HTMLElement).closest<HTMLElement>(".kb-card[data-kb-card]");
  if (!card || (ev.target as HTMLElement).closest("input, a, button")) return;
  const path = card.dataset.path!;
  const li = Number(card.dataset.lane);
  const ci = Number(card.dataset.idx);
  const c = parseBoard(draftOf(path).text).lanes[li]?.cards[ci];
  if (!c) return;
  void ask({ title: "Edit card", value: c.text, multiline: true, ok: "Save" }).then((v) => { if (v !== null && v.trim()) updateBoard(path, (b) => { const k = b.lanes[li]?.cards[ci]; if (k) k.text = v.trim(); }); });
});
document.addEventListener("paste", (ev) => {
  const cellEl = ev.target as HTMLInputElement;
  if (cellEl?.name === "cell") {
    const text = ev.clipboardData?.getData("text/plain") ?? "";
    if (!/[\t\n]/.test(text.trim())) return; // a single value pastes normally
    ev.preventDefault();
    const rows = text.includes("\t") ? text.replace(/\r/g, "").split("\n").filter((l) => l !== "").map((l) => l.split("\t")) : parseCsv(text);
    const p = cellEl.dataset.path!, si = Number(cellEl.dataset.s), r0 = Number(cellEl.dataset.r), c0 = Number(cellEl.dataset.c);
    updateWorkbook(p, (wb) => { const sh = wb.sheets[si]; rows.forEach((row, i) => { while (sh.rows.length <= r0 + i) sh.rows.push([]); row.forEach((v, j) => { while (sh.rows[r0 + i].length <= c0 + j) sh.rows[r0 + i].push(""); sh.rows[r0 + i][c0 + j] = v; }); }); }, true);
    void save(p);
    toast(`Pasted ${rows.length} row${rows.length === 1 ? "" : "s"}.`, "ok");
    return;
  }
  const host = (ev.target as HTMLElement).closest<HTMLElement>(".cm-host");
  const ed = host && editors.get(host);
  const text = ev.clipboardData?.getData("text/plain") ?? "";
  if (!ed || !text.includes("\t")) return;
  const table = tsvToTable(text);
  if (!table) return;
  ev.preventDefault();
  ed.view.dispatch(ed.view.state.replaceSelection(`\n${table}`));
  toast("Pasted as a table.", "ok");
});
document.addEventListener("focusout", (ev) => {
  const ta = ev.target as HTMLTextAreaElement;
  if (ta?.name === "cell") { const inp = ta as unknown as HTMLInputElement; commitCell(inp); const wb = wbOf(inp.dataset.path!), sh = wb.sheets[Number(inp.dataset.s)], r = Number(inp.dataset.r), c = Number(inp.dataset.c); inp.value = cellText(sh?.rows[r]?.[c] ?? "", evaluate(wb).get(sh?.name ?? "")?.[r]?.[c] ?? null); return; }
  if (ta?.name !== "nbsrc") return;
  const p = ta.dataset.path!; const i = Number(ta.dataset.i);
  const nb = parseNotebook(draftOf(p).text);
  if (nb.cells[i]?.type === "markdown" && nb.cells[i].source.trim()) { nbEditing.get(p)?.delete(nb.cells[i].id); setTimeout(() => refreshNotebook(p), 50); }
});
document.addEventListener("pointerdown", (ev) => {
  // a phone: tapping the town puts away whatever sheet is open over it
  const t = S.town;
  if (!S.mobile || !t || !(t.legend || t.sheet) || !(ev.target as HTMLElement).matches?.('canvas[data-town="full"]')) return;
  t.legend = false; t.sheet = undefined; render();
});
document.addEventListener("dblclick", (ev) => {
  const md = (ev.target as HTMLElement).closest<HTMLElement>(".md-cell:not(.editing)");
  if (md && !(ev.target as HTMLElement).closest("a, button")) { void onAction("nb-edit-md", md, ev as MouseEvent); return; }
  // a double click on a note in reading mode opens it for editing (not on a link, a button, a task box or selected text)
  const prev = (ev.target as HTMLElement).closest<HTMLElement>(".editor-panes.view-preview .preview");
  if (prev && !S.mobile && !(ev.target as HTMLElement).closest("a, button, input, select, textarea, details, summary") && !getSelection()?.toString()) {
    const pid = prev.closest<HTMLElement>(".pane[data-pane]")?.dataset.pane;
    const p = pane(pid ? Number(pid) : undefined);
    if (isAgentPath(p.active ?? "")) return;
    p.view = "edit";
    render();
    const host = document.querySelector<HTMLElement>(`.cm-host[data-cm="${CSS.escape(p.active ?? "")}"]`);
    for (const [h, ed] of editors) if (h === host) { ed.focus(); break; }
  }
});
document.addEventListener("focusin", (ev) => {
  const ta = ev.target as HTMLElement;
  if ((ta as HTMLInputElement).name === "cell") { const inp = ta as HTMLInputElement; inp.value = inp.dataset.raw ?? ""; inp.select(); }
  const pid = ta.closest<HTMLElement>(".pane[data-pane]")?.dataset.pane;
  if (pid && Number(pid) !== S.focused) {
    S.focused = Number(pid);
    syncHash();
  }
});
document.addEventListener("keydown", (ev) => {
  const mod = isMac ? ev.metaKey : ev.ctrlKey;
  const t = ev.target as HTMLElement;
  if (S.tab === "organize" && S.org.triage && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable && !document.querySelector(".scrim") && !mod) {
    const p = document.querySelector<HTMLElement>(".triage [data-action=triage-file]")?.dataset.path;
    const key: Record<string, string> = { f: "triage-file", t: "triage-tag", l: "triage-link", a: "org-archive", n: "triage-next", j: "triage-next", o: "open" };
    const act2 = key[ev.key.toLowerCase()];
    if (p && act2) { ev.preventDefault(); const i = document.createElement("i"); i.dataset.path = p; return void onAction(act2, i, ev as unknown as MouseEvent); }
  }
  if (S.show) {
    if (ev.key === "Escape") { ev.preventDefault(); return closeShow(); }
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(ev.key)) { ev.preventDefault(); return showStep(1); }
    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(ev.key)) { ev.preventDefault(); return showStep(-1); }
    if (ev.key === "Home") { ev.preventDefault(); return showStep(-1e9); }
    if (ev.key === "End") { ev.preventDefault(); return showStep(1e9); }
    return;
  }
  if (ev.key === "Escape") {
    closeMenu();
    closePalette();
    const dialogs = document.querySelectorAll(".scrim");
    if (dialogs.length && !t.closest("form.modal [data-x=cancel]")) dialogs[dialogs.length - 1].querySelector<HTMLElement>("[data-x=cancel]")?.click();
    return;
  }
  if ((t as HTMLTextAreaElement).name === "nbsrc") {
    const ta = t as HTMLTextAreaElement;
    if (ev.key === "Enter" && ev.shiftKey) {
      ev.preventDefault();
      const p = ta.dataset.path!; const i = Number(ta.dataset.i);
      const nb = parseNotebook(draftOf(p).text);
      if (nb.cells[i]?.type === "markdown") { nbEditing.get(p)?.delete(nb.cells[i].id); refreshNotebook(p); }
      else void runCell(p, i).then(() => document.querySelectorAll<HTMLTextAreaElement>(`.nbk[data-ipynb="${CSS.escape(p)}"] textarea[name=nbsrc]`)[i + 1]?.focus());
      return;
    }
    if (ev.key === "Tab" && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); const s0 = ta.selectionStart; ta.setRangeText("    ", s0, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input", { bubbles: true })); return; }
    return;
  }
  if ((t as HTMLInputElement).name === "cell") {
    const inp = t as HTMLInputElement;
    const go = (dr: number, dc: number) => { ev.preventDefault(); commitCell(inp); const n = cellAt(inp, dr, dc); if (n) { n.focus(); n.value = n.dataset.raw ?? ""; n.select(); } else inp.blur(); };
    if (ev.key === "Enter") return go(ev.shiftKey ? -1 : 1, 0);
    if (ev.key === "Escape") { inp.value = inp.dataset.raw ?? ""; return inp.blur(); }
    if (ev.key === "ArrowDown") return go(1, 0);
    if (ev.key === "ArrowUp") return go(-1, 0);
    if (ev.key === "ArrowRight" && inp.selectionEnd === inp.value.length) return go(0, 1);
    if (ev.key === "ArrowLeft" && inp.selectionStart === 0) return go(0, -1);
    return;
  }
  if ((t as HTMLTextAreaElement).name === "chattext" && S.community) {
    const c = S.community;
    if (ev.key === "ArrowUp" && !c.draft && c.editing === undefined) { const mine = [...c.messages].reverse().find((m) => m.author.toText() === S.principal && !m.deleted && !m.poll && !m.gist && !m.fund); if (mine) { ev.preventDefault(); const i = document.createElement("i"); i.dataset.mid = mine.id.toString(); return void onAction("chat-edit", i, ev as unknown as MouseEvent); } }
    if (ev.key === "Escape" && c.editing !== undefined) { ev.preventDefault(); return void onAction("chat-edit-cancel", t, ev as unknown as MouseEvent); }
  }
  if (ev.key === "Enter" && !ev.shiftKey && (t as HTMLTextAreaElement).name === "chattext") {
    ev.preventDefault();
    return void onAction("noop", t, ev as unknown as MouseEvent), t.closest("form")?.requestSubmit();
  }
  if (ev.key === "Enter" && !ev.shiftKey && (t as HTMLTextAreaElement).name === "chatq") {
    ev.preventDefault();
    return void askNotes();
  }
  if (mod && ev.shiftKey && (ev.key === "{" || ev.key === "[") && (S.notebook || S.community || S.board)) {
    ev.preventDefault();
    return toggleSide("side");
  }
  if (mod && ev.shiftKey && (ev.key === "}" || ev.key === "]") && (S.notebook || S.community || S.board)) {
    ev.preventDefault();
    return toggleSide("aside");
  }
  if (mod && ev.shiftKey && ev.key.toLowerCase() === "n" && S.notebook) {
    ev.preventDefault();
    return void quickCapture();
  }
  if (mod && ev.shiftKey && ev.key.toLowerCase() === "h") {
    ev.preventDefault();
    return toggleHighlight();
  }
  if (mod && ev.key.toLowerCase() === "s") {
    ev.preventDefault();
    void saveAll();
  } else if (mod && S.notebook && S.notes && ["k", "o", "p"].includes(ev.key.toLowerCase()) && !ev.shiftKey) {
    ev.preventDefault();
    openPalette();
  } else if (mod && ev.shiftKey && ev.key.toLowerCase() === "d" && S.notebook && S.notes) {
    ev.preventDefault();
    void openDaily();
  } else if (mod && ev.shiftKey && ev.key.toLowerCase() === "p" && S.notebook && S.notes) {
    ev.preventDefault();
    openPalette(">");
  } else if (mod && ev.key.toLowerCase() === "n" && S.notebook && S.notes) {
    ev.preventDefault();
    void newNote();
  } else if (mod && ev.key.toLowerCase() === "e" && cur() && !isExcalidraw(cur()!)) {
    ev.preventDefault();
    cycleView(S.focused);
  } else if (mod && ev.key.toLowerCase() === "w" && cur()) {
    ev.preventDefault();
    closeTab(S.focused, cur()!);
  } else if (mod && ev.key === "\\" && cur()) {
    ev.preventDefault();
    splitRight(S.focused);
  } else if (ev.key === "Enter" && t.getAttribute?.("name") === "title") {
    (t as HTMLInputElement).blur();
  } else if (t instanceof HTMLTextAreaElement && t.name === "draft" && !mod && !ev.altKey) {
    if (ev.key === "Enter" && !ev.shiftKey) {
      const e = continueList(t.value, t.selectionStart);
      if (e) {
        ev.preventDefault();
        applyEdit(t, e);
      }
    } else if (ev.key === "Tab") {
      ev.preventDefault();
      applyEdit(t, indentLines(t.value, t.selectionStart, t.selectionEnd, ev.shiftKey));
    }
  }
});
document.addEventListener("submit", (ev) => {
  const f = ev.target as HTMLFormElement;
  if (!f.dataset.form) return;
  ev.preventDefault();
  if (S.busy) return;
  const fv = (n: string) => (f.querySelector<HTMLInputElement>(`[name=${n}]`)?.value ?? "").trim();
  switch (f.dataset.form) {
    case "org-search": { S.org.q = fv("orgq"); S.org.selected.clear(); return render(); }
    case "rule-add":
      return void (async () => {
        const tag = fv("rtag").replace(/^#/, "");
        if (!tag) return;
        S.settings.rules.push({ id: Math.random().toString(36).slice(2, 8), tag, template: fv("rtpl") || undefined, folder: fv("rfolder") || undefined, weekly: f.querySelector<HTMLInputElement>("[name=rweek]")!.checked || undefined });
        await saveSettings();
        toast(`Rule added for #${tag}.`, "ok");
        render();
      })();
    case "ref-tag": case "ref-prop":
      return void (async () => {
        const from = fv("from").replace(/^#/, ""), to = fv("to").replace(/^#/, "");
        if (!from || !to) return;
        let n = 0;
        for (const x of orgNotes()) { if (!x.path.endsWith(".md")) continue; const next = f.dataset.form === "ref-tag" ? renameTag(x.content, from, to) : renameProperty(x.content, from, to); if (next !== x.content) { await writeNote(x.path, next); n++; } }
        toast(n ? `Renamed in ${n} note${n === 1 ? "" : "s"}.` : "Nothing used that name.", n ? "ok" : "info");
        render();
      })();
    case "ref-split":
      return void (async () => {
        const p = fv("path");
        const text = S.drafts.get(p)?.text ?? note(p)?.content;
        if (!text) return;
        const { intro, parts } = splitAtHeadings(text);
        if (!parts.length) return toast("That note has no ## headings to split at.", "info");
        const made: string[] = [];
        for (const part of parts) { let np = `${dir(p) ? `${dir(p)}/` : ""}${part.title}.md`; for (let i = 2; note(np); i++) np = `${dir(p) ? `${dir(p)}/` : ""}${part.title} ${i}.md`; await createQuiet(np, part.body); made.push(np); }
        await writeNote(p, `${intro.trimEnd()}\n\n${made.map((m) => `- [[${stem(m)}]]`).join("\n")}\n`);
        toast(`Split into ${made.length} notes, linked from the original.`, "ok");
        render();
      })();
    case "ref-merge":
      return void (async () => {
        const from = fv("from"), into = fv("into");
        if (!from || !into || from === into) return toast("Pick two different notes.", "error");
        if ((await ask({ title: `Merge “${stem(from)}” into “${stem(into)}”?`, body: "Its text is appended, links to it are pointed at the note you keep, and it is deleted.", ok: "Merge", danger: true })) === null) return;
        const a = S.drafts.get(into)?.text ?? note(into)!.content, b = S.drafts.get(from)?.text ?? note(from)!.content;
        await writeNote(into, `${a.trimEnd()}\n\n## From ${title(from)}\n\n${frontmatter(b).body.replace(/^# .*\n/, "").trim()}\n`);
        for (const x of orgNotes()) { if (x.path === from || !x.path.endsWith(".md")) continue; const next = retargetLinks(x.content, from, into); if (next !== x.content) await writeNote(x.path, next); }
        unwrap(await nb().delete_(from));
        S.notes = S.notes!.filter((n) => n.path !== from);
        S.drafts.delete(from);
        reindex();
        toast(`Merged into ${title(into)}.`, "ok");
        render();
      })();
    case "create-notebook":
      return void createNotebook();
    case "chat":
      return void askNotes();
    case "board-comment":
      return void (async () => {
        const b = S.board!;
        const ta = f.querySelector<HTMLTextAreaElement>("[name=ptext]")!;
        const r = await registry().comment_post(BigInt(f.dataset.post!), f.dataset.parent ? BigInt(f.dataset.parent) : null, expandShortcodes(ta.value.trim()));
        if (r.__kind__ === "Err") return toast(r.Err, "error");
        b.replyTo = undefined;
        b.comments = await registry().post_comments(r.Ok.post);
        if (b.open) { b.open = (await registry().get_post(b.open.id)) ?? b.open; }
        render();
      })();
    case "chat-post":
      return void (async () => {
        const c = S.community!;
        const text = expandShortcodes(c.draft.trim());
        if (!text) return;
        try {
          if (c.editing !== undefined) {
            const r = await registry().edit_message(c.channel, c.editing, text);
            if (r.__kind__ === "Err") throw new Error(r.Err);
            c.editing = undefined; c.draft = "";
            replaceMessage(r.Ok); render(); scrollChat();
            return;
          }
          let r;
          if (!verifiedNow(c.member) && canNewcomerPost(c)) {
            if (!c.member && !c.newcomerHandle) {
              const h = (await ask({ title: "Choose your newcomer handle", body: "Your Newcomer Pass lets you send 10 free messages in #help and #general before you spawn your first space.", label: "Handle", value: `visitor_${S.principal.slice(0, 5)}`, ok: "Send message" }))?.trim();
              if (!h) return;
              c.newcomerHandle = h;
            }
            r = await registry().post_newcomer(c.channel, c.newcomerHandle ?? c.member?.handle ?? "newcomer", text, c.replyTo?.id ?? null);
            if (r.__kind__ === "Ok" && c.newcomerLeft !== undefined && c.newcomerLeft > 0) c.newcomerLeft--;
          } else {
            r = await paidPost(() => registry().post(c.channel, text, c.replyTo?.id ?? null));
          }
          if (r.__kind__ === "Err") throw new Error(r.Err);
          c.draft = "";
          c.replyTo = undefined;
          c.messages.push(r.Ok);
          markChatSeen(c.channel, r.Ok.id);
          render();
          scrollChat();
          document.querySelector<HTMLTextAreaElement>("[name=chattext]")?.focus();
        } catch (e) { toast(errMsg(e), "error"); }
      })();
    case "nb-meta":
      return void act("meta", async () => {
        const emoji = f.querySelector<HTMLInputElement>("[name=emoji]")!.value.trim();
        const desc = f.querySelector<HTMLInputElement>("[name=desc]")!.value.trim();
        const r = await registry().set_notebook_meta(S.notebook!.canister, emoji || null, desc || null);
        if (r.__kind__ === "Err") throw new Error(r.Err);
        S.notebook = r.Ok;
        S.notebooks = (S.notebooks ?? []).map((x) => (x.canister.toText() === r.Ok.canister.toText() ? r.Ok : x));
        return "Card updated.";
      });
    case "goals": {
      const n = Number(f.querySelector<HTMLInputElement>("[name=notesPerWeek]")!.value);
      const c = Number(f.querySelector<HTMLInputElement>("[name=cardsPerDay]")!.value);
      S.settings.goals = { notesPerWeek: n > 0 ? n : undefined, cardsPerDay: c > 0 ? c : undefined };
      void saveSettings().then(() => toast("Goals saved.", "ok"));
      return render();
    }
    case "list":
      return void act("list", async () => {
        const t = tokenOf(f.querySelector<HTMLSelectElement>("[name=listtoken]")!.value);
        const price = parseAmt(f.querySelector<HTMLInputElement>("[name=price]")!.value, t);
        const blurb = f.querySelector<HTMLInputElement>("[name=blurb]")!.value.trim();
        const r = await registry().list_notebook(S.notebook!.canister, t.symbol, price, blurb);
        if (r.__kind__ === "Err") throw new Error(r.Err);
        S.listing = r.Ok;
        S.attest = r.Ok.attestation ?? S.attest;
        return `Listed for ${fmtAmt(price, t)}.`;
      });
    case "kb-add": {
      const inp = f.querySelector<HTMLInputElement>("[name=kbnew]")!;
      const text = inp.value.trim();
      if (!text) return;
      const li = Number(f.dataset.lane);
      updateBoard(f.dataset.path!, (b) => { const l = b.lanes[li]; if (l) l.cards.push({ text, done: l.complete }); });
      document.querySelector<HTMLInputElement>(`.kb[data-kanban="${CSS.escape(f.dataset.path!)}"] [data-lane="${li}"] [name=kbnew]`)?.focus();
      return;
    }
    case "agent":
      return void issueAgentKey();
    case "fuel":
      return void (async () => {
        const n = Number(f.querySelector<HTMLInputElement>("[name=fuelAmount]")!.value);
        if (!(n > 0)) return toast("How much ICP to convert?", "error");
        await act("fuel", async () => { const r = await nb().fuel_from_wallet(BigInt(Math.round(n * 1e8))); if (r.__kind__ === "Err") throw new Error(r.Err); return `${icp(r.Ok.amount_e8s)} ICP became ${tc(r.Ok.cycles)} of cycles.`; });
        void loadBalances();
      })();
    case "publish":
      return void (async () => {
        try {
          const folder = f.querySelector<HTMLSelectElement>("[name=pubfolder]")!.value;
          unwrap(await nb().set_published(folder));
          S.published = folder;
          toast(`Published at ${apiUrl(S.notebook!.canister.toText())}/p/`, "ok");
        } catch (e) {
          toast(errMsg(e), "error");
        }
        render();
      })();
    case "note-comment":
      return void (async () => {
        const inp = f.querySelector<HTMLInputElement>("[name=ctext]")!;
        try {
          const r = await nb().comment(f.dataset.path!, inp.value);
          if (r.__kind__ === "Err") throw new Error(describe(r.Err));
          S.comments = [...S.comments, r.Ok];
          renderSide();
        } catch (e) {
          toast(errMsg(e), "error");
        }
      })();
    case "reply":
      return void (async () => {
        const inp = f.querySelector<HTMLInputElement>("[name=ctext]")!;
        try {
          const api = S.shared ? notebookOf(S.shared.canister) : nb();
          const r = await api.reply(BigInt(f.dataset.parent!), inp.value);
          if (r.__kind__ === "Err") throw new Error(describe(r.Err));
          if (S.shared) return openShared(S.shared.canister, S.shared.path);
          S.comments = [...S.comments, r.Ok];
          renderSide();
        } catch (e) {
          toast(errMsg(e), "error");
        }
      })();
    case "comment":
      return void (async () => {
        const text = f.querySelector<HTMLInputElement>("[name=ctext]")!.value;
        try {
          const r = await notebookOf(S.shared!.canister).comment(S.shared!.path, text);
          if (r.__kind__ === "Err") throw new Error(describe(r.Err));
          await openShared(S.shared!.canister, S.shared!.path);
        } catch (e) {
          toast(errMsg(e), "error");
        }
      })();
    case "admin-repo":
      return void (async () => {
        const repo = f.querySelector<HTMLInputElement>("[name=repo]")!.value;
        const r = await registry().set_github_repo(repo);
        if (r.__kind__ === "Err") return toast(r.Err, "error");
        if (S.admin) S.admin.repo = repo.trim();
        toast("Saved.", "ok");
      })();
    case "bug":
      return void (async () => {
        const status = ((ev as SubmitEvent).submitter as HTMLButtonElement | null)?.value ?? "Open";
        const note = f.querySelector<HTMLTextAreaElement>("[name=note]")!.value;
        try {
          const r = await registry().update_bug(BigInt(f.dataset.id!), toStatus(status), note);
          if (r.__kind__ === "Err") throw new Error(r.Err);
          const i = S.admin!.bugs.findIndex((b) => b.id === r.Ok.id);
          if (i >= 0) S.admin!.bugs[i] = r.Ok;
          toast(`#${r.Ok.id} is now ${STATUS[status]}.`, "ok");
        } catch (e) {
          toast(errMsg(e), "error");
        }
        render();
      })();
    case "topup":
      return void act("topup", async () => {
        const t = tokenOf(S.payToken);
        const amount = parseAmt(S.topupAmount, t);
        if (amount <= t.fee * 2n) throw new Error("Enter an amount above a couple of ledger fees");
        const cycles = await payFor(S.notebook!.canister, t.symbol, amount, (m) => toast(m, "info"));
        void refreshInfo();
        return `${fmtAmt(amount, t)} became ${tc(cycles)} of runway.`;
      });
  }
});
const sharedRoute = () => location.hash.match(/^#\/shared\/([a-z0-9-]+)\/(.*)$/);
window.addEventListener("hashchange", () => {
  const sh = sharedRoute();
  if (sh) return void openShared(sh[1], decodeURIComponent(sh[2]));
  // leaving a shared note (drawn before anything else), the community or the board: what is under them needs drawing again
  let left = !!S.shared;
  S.shared = undefined;
  if (location.hash !== "#/community" && S.community) { S.community = undefined; clearInterval(chatTimer); left = true; }
  if (!location.hash.startsWith("#/board") && S.board) { S.board = undefined; left = true; }
  if (location.hash !== "#/inbox" && S.inbox) { S.inbox = undefined; left = true; }
  if (location.hash !== "#/town" && S.town) { S.town = undefined; clearInterval(townTimer); left = true; }
  if (!problemRoute() && S.problems) { S.problems = undefined; left = true; }
  if (location.hash === "#/town") return void loadTown();
  { const pm = problemRoute(); if (pm) return void loadProblems(pm[1] as ProblemsTab, pm[2] ? BigInt(pm[2]) : undefined); }
  if (location.hash === "#/inbox") { if (S.identity || isSandbox()) return void loadInbox(); location.hash = "#/"; return; }
  const bm = /^#\/board(?:\/(\d+))?$/.exec(location.hash);
  if (bm) { if (S.identity) return void loadBoard(undefined, bm[1] ? BigInt(bm[1]) : undefined); location.hash = "#/"; return; }
  if (location.hash === "#/admin") {
    if (S.isAdmin) return void loadAdmin();
    toast("Admins only.", "error");
    location.hash = "#/";
    return;
  }
  if (location.hash === "#/market") {
    if (!flag("market")) { toast("The market is not open yet.", "info"); location.hash = "#/"; return; }
    if (S.identity) return void loadMarket();
    location.hash = "#/";
    return;
  }
  if (location.hash === "#/community") {
    if (S.identity) return void loadCommunity();
    location.hash = "#/";
    return;
  }
  if (location.hash === "#/capture") return void captureRoute();
  if (S.market) {
    S.market = undefined;
    render();
  }
  if (S.admin) {
    S.admin = undefined;
    render();
  }
  if (!location.hash.startsWith("#/notebook/")) {
    void saveAll();
    S.notebook = undefined;
    S.notes = undefined;
    render();
    if (S.identity) void loadNotebooks();
    return;
  }
  // a notebook link typed or followed while on the list, or a link into another notebook
  const m = location.hash.match(/^#\/notebook\/([a-z0-9-]+)(?:\/(.+))?/);
  if (m && (S.identity || m[1] === SANDBOX_ID)) {
    const path = m[2] ? decodeURIComponent(m[2]) : undefined;
    if (S.notebook?.canister.toText() !== m[1]) void (async () => { if (S.identity && !S.notebooks && m[1] !== SANDBOX_ID) await loadNotebooks(); await openNotebook(m[1], path); })();
    else if (path && path !== cur() && note(path)) void open(path);
    // back (or a typed link) from the community or board to the notebook already open: without this the old page stayed on screen
    else if (left) render();
  }
});
setInterval(() => {
  if (!S.shared?.note || !S.identity || document.hidden) return;
  const sh = S.shared;
  void notebookOf(sh.canister).ping(sh.path).then((h) => { if (h.__kind__ === "Ok" && S.shared?.path === sh.path) { const now = h.Ok.map((p) => p.toText()); if (now.join() !== (S.shared.here ?? []).join()) { S.shared.here = now; render(); } } }).catch(() => {});
}, 45_000);
setInterval(async () => {
  if (!S.notebook || S.frozen || document.hidden) return;
  try {
    const r = await nb().all_comments();
    if (r.__kind__ !== "Ok") return;
    const before = S.comments.map((x) => x.id.toString()).join(",");
    const after = r.Ok.map((x) => x.id.toString()).join(",");
    if (before !== after) { S.comments = r.Ok; renderSide(); }
  } catch { /* next tick */ }
}, 60_000);
window.addEventListener("beforeunload", (ev) => {
  if ([...S.drafts.values()].some((d) => d.dirty)) {
    void saveAll();
    ev.preventDefault();
  }
});
mobileQuery.addEventListener("change", (e) => {
  S.mobile = e.matches;
  render();
});

// ---------- boot ----------

registerSW({ immediate: true });
render();
currentIdentity().then(async (id) => {
  if (id) {
    S.identity = id;
    S.principal = id.getPrincipal().toText();
  }
  const sh = sharedRoute();
  if (sh) return openShared(sh[1], decodeURIComponent(sh[2]));
  if (location.hash === "#/town") { if (id) void loadNotebooks(); return loadTown(); }
  { const pm = problemRoute(); if (pm) { if (id) void loadNotebooks(); return loadProblems(pm[1] as ProblemsTab, pm[2] ? BigInt(pm[2]) : undefined); } }
  const m = location.hash.match(/^#\/notebook\/([a-z0-9-]+)(?:\/(.+))?/);
  if (!id) {
    if (m && m[1] === SANDBOX_ID) void openNotebook(SANDBOX_ID, m[2] ? decodeURIComponent(m[2]) : undefined);
    return;
  }
  render();
  await loadNotebooks();
  setTimeout(() => void checkRain(), 1500);
  if (location.hash === "#/admin") {
    S.isAdmin = await registry().is_admin().catch(() => false);
    if (S.isAdmin) return loadAdmin();
    location.hash = "#/";
  }
  if (location.hash === "#/market") { if (!flag("market")) { location.hash = "#/"; return; } return loadMarket(); }
  if (location.hash === "#/community") return loadCommunity();
  { const bm = /^#\/board(?:\/(\d+))?$/.exec(location.hash); if (bm) return loadBoard(undefined, bm[1] ? BigInt(bm[1]) : undefined); }
  if (location.hash === "#/capture") return captureRoute();
  if (m) void openNotebook(m[1], m[2] ? decodeURIComponent(m[2]) : undefined);
}).finally(() => {
  S.booting = false;
  render();
});

// scenes in the Writing tab reorder by dragging
let sceneDrag: string | undefined;
document.addEventListener("dragstart", (e) => { const row = (e.target as HTMLElement).closest?.<HTMLElement>(".scene-row"); if (!row) return; sceneDrag = row.dataset.scene; e.dataTransfer?.setData("text/plain", sceneDrag ?? ""); row.classList.add("dragging"); });
document.addEventListener("dragover", (e) => { if (!sceneDrag) return; const t = (e.target as HTMLElement).closest?.(".scene-row, .chapter"); if (t) { e.preventDefault(); document.querySelectorAll(".scene-row.over").forEach((x) => x.classList.remove("over")); t.classList.add("over"); } });
document.addEventListener("dragend", () => { sceneDrag = undefined; document.querySelectorAll(".scene-row.dragging, .scene-row.over, .chapter.over").forEach((x) => x.classList.remove("dragging", "over")); });
document.addEventListener("drop", (e) => {
  if (!sceneDrag) return;
  const row = (e.target as HTMLElement).closest?.<HTMLElement>(".scene-row");
  const chap = (e.target as HTMLElement).closest?.<HTMLElement>(".chapter");
  if (!row && !chap) return;
  e.preventDefault();
  const from = sceneDrag;
  sceneDrag = undefined;
  if (row?.dataset.scene === from) return;
  void reorderScene(from, row?.dataset.scene, row?.dataset.chapter ?? chap!.dataset.chapter!);
});
