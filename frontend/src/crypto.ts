// The Crypto kit, all pure: a trade journal (one note per trade), its numbers (win rate, profit and
// loss by week and by coin, R multiples), theses that remember the price they were written at and
// come back for review, and the watchlist the tab prices.
import { frontmatter, type NoteLike } from "./notes.ts";
import { setProperty } from "./organize.ts";

export const DEFAULT_WATCH = ["BTC", "ETH", "SOL", "HYPE"];
/** What the notebook's `prices` call takes at once. */
export const MAX_WATCH = 8;
export const symbolOf = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
const typeOf = (content: string) => (frontmatter(content).data.type ?? "").trim().toLowerCase();
const num = (v: string | undefined): number | undefined => {
  if (v === undefined || !v.trim()) return undefined;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const stem = (path: string) => path.split("/").pop()!.replace(/\.md$/, "");

/** Dollars at a sensible precision: $98,123 · $3.41 · $0.0123 */
export function usd(n: number | undefined, sign = false): string {
  if (n === undefined || !Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  const s = a >= 1000 ? Math.round(a).toLocaleString("en-US") : a >= 1 ? a.toFixed(2) : a === 0 ? "0" : a.toPrecision(3);
  return `${n < 0 ? "−" : sign ? "+" : ""}$${s}`;
}

// ---- trades

export type Side = "long" | "short";
export type Trade = { path: string; title: string; asset: string; side: Side; size: number; entry: number; stop?: number; target?: number; exit?: number; fees: number; opened: string; closed?: string; thesis?: string };
export const isTrade = (content: string) => typeOf(content) === "trade";
export function trade(path: string, content: string): Trade {
  const d = frontmatter(content).data;
  return {
    path, title: stem(path), asset: symbolOf(d.asset ?? ""), side: /^s/i.test(d.side ?? "") ? "short" : "long",
    size: num(d.size) ?? 0, entry: num(d.entry) ?? 0, stop: num(d.stop), target: num(d.target), exit: num(d.exit), fees: num(d.fees) ?? 0,
    opened: (d.opened ?? "").trim(), closed: (d.closed ?? "").trim() || undefined, thesis: (d.thesis ?? "").replace(/^"|"$/g, "").replace(/^\[\[|\]\]$/g, "").trim() || undefined,
  };
}
export const isOpen = (t: Trade) => t.exit === undefined;
/** Realized when closed; unrealized at `price` while open (undefined without one). Fees come off both. */
export function pnl(t: Trade, price?: number): number | undefined {
  const at = t.exit ?? price;
  if (at === undefined) return undefined;
  return (at - t.entry) * t.size * (t.side === "long" ? 1 : -1) - t.fees;
}
/** Profit as a multiple of what the stop risked; undefined without a stop. */
export function rMultiple(t: Trade, price?: number): number | undefined {
  const p = pnl(t, price);
  const risk = t.stop === undefined ? 0 : Math.abs(t.entry - t.stop) * t.size;
  return p === undefined || !risk ? undefined : p / risk;
}

export type JournalStats = { open: number; closed: number; winRate: number; realized: number; avgWin: number; avgLoss: number; avgR?: number; best?: Trade; worst?: Trade; weeks: { week: string; pnl: number }[]; byAsset: { asset: string; pnl: number; trades: number }[] };
const monday = (d: string) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
/** Closed trades' numbers, with realized profit per week for the last `n` weeks (by close date). */
export function journalStats(trades: Trade[], today: string, n = 8): JournalStats {
  const closed = trades.filter((t) => !isOpen(t));
  const result = closed.map((t) => ({ t, p: pnl(t)! }));
  const wins = result.filter((r) => r.p > 0), losses = result.filter((r) => r.p <= 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const rs = closed.map((t) => rMultiple(t)).filter((r): r is number => r !== undefined);
  const sorted = [...result].sort((a, b) => b.p - a.p);
  const weeks: { week: string; pnl: number }[] = [];
  const m = monday(today);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(`${m}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 7 * i);
    const w = d.toISOString().slice(0, 10);
    weeks.push({ week: w, pnl: result.filter((r) => r.t.closed && monday(r.t.closed) === w).reduce((a, r) => a + r.p, 0) });
  }
  const byAsset = new Map<string, { asset: string; pnl: number; trades: number }>();
  for (const r of result) { const a = byAsset.get(r.t.asset) ?? { asset: r.t.asset, pnl: 0, trades: 0 }; a.pnl += r.p; a.trades++; byAsset.set(r.t.asset, a); }
  return {
    open: trades.length - closed.length, closed: closed.length, winRate: closed.length ? Math.round((wins.length / closed.length) * 100) : 0,
    realized: result.reduce((a, r) => a + r.p, 0), avgWin: avg(wins.map((r) => r.p)), avgLoss: avg(losses.map((r) => r.p)), avgR: rs.length ? avg(rs) : undefined,
    best: sorted[0]?.p > 0 ? sorted[0].t : undefined, worst: sorted.length && sorted[sorted.length - 1].p < 0 ? sorted[sorted.length - 1].t : undefined,
    weeks, byAsset: [...byAsset.values()].sort((a, b) => b.pnl - a.pnl),
  };
}

export type NewTrade = { asset: string; side: Side; size: number; entry: number; stop?: number; target?: number; opened: string; thesis?: string };
export const tradePath = (t: NewTrade) => `Crypto/Trades/${t.opened} ${t.asset} ${t.side}.md`;
export function TRADE_TEMPLATE(t: NewTrade, why: string): string {
  const props = [["type", "trade"], ["asset", t.asset], ["side", t.side], ["size", String(t.size)], ["entry", String(t.entry)], ["stop", t.stop === undefined ? "" : String(t.stop)], ["target", t.target === undefined ? "" : String(t.target)], ["opened", t.opened], ["exit", ""], ["closed", ""], ["fees", "0"], ["thesis", t.thesis ? `"[[${t.thesis}]]"` : ""]];
  return `---\n${props.map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n# ${t.asset} ${t.side} · ${t.opened}\n\n## Why\n\n${why.trim() || "What you saw, and what would make you get out."}\n\n## What happened\n\n\n\n## Lesson\n\n`;
}
export function closeTrade(content: string, exit: number, day: string, lesson = ""): string {
  const c = setProperty(setProperty(content, "exit", String(exit)), "closed", day);
  return lesson.trim() ? c.replace(/## Lesson\n+/, `## Lesson\n\n${lesson.trim()}\n\n`) : c;
}

// ---- theses

export type Thesis = { path: string; title: string; asset: string; priceThen?: number; written?: string; wrongIf?: string; status: string; review?: string; due: boolean };
/** Not `type: thesis`: the Research kit's academic theses use that. */
export const THESIS_TYPE = "crypto-thesis";
export const isThesis = (content: string) => typeOf(content) === THESIS_TYPE;
const REVIEW_RE = /^- \[ \] Review[^\n]*📅\s*(\d{4}-\d{2}-\d{2})/m;
export function theses(notes: NoteLike[], today: string): Thesis[] {
  return notes.filter((n) => n.path.endsWith(".md") && isThesis(n.content)).map((n) => {
    const fm = frontmatter(n.content);
    const d = fm.data;
    const status = (d.status ?? "holds").trim().toLowerCase() || "holds";
    const review = REVIEW_RE.exec(fm.body)?.[1];
    return { path: n.path, title: /^#\s+(.+)$/m.exec(fm.body)?.[1].trim() ?? stem(n.path), asset: symbolOf(d.asset ?? ""), priceThen: num(d.price_then), written: (d.written ?? "").trim() || undefined, wrongIf: (d.wrong_if ?? "").trim() || undefined, status, review, due: status === "holds" && !!review && review <= today };
  }).sort((a, b) => Number(b.due) - Number(a.due) || (a.review ?? "9").localeCompare(b.review ?? "9"));
}
export const addDays = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export type NewThesis = { asset: string; belief: string; because: string; wrongIf: string; price?: number; today: string; reviewIn?: number };
export function THESIS_TEMPLATE(t: NewThesis): string {
  const because = t.because.split("\n").map((l) => l.trim()).filter(Boolean);
  return `---\ntype: ${THESIS_TYPE}\nasset: ${t.asset}\nprice_then: ${t.price ?? ""}\nwritten: ${t.today}\nwrong_if: ${t.wrongIf.replace(/\n+/g, " ").trim()}\nstatus: holds\n---\n\n# ${t.belief.trim()}\n\n## Because\n\n${because.length ? because.map((l) => `Claim:: ${l.replace(/^Claim::\s*/, "")}`).join("\n\n") : "Claim:: One reason per line; cite a source note with [@key] when you have one."}\n\n## I am wrong if\n\n${t.wrongIf.trim() || "What would change your mind."}\n\n## Reviews\n\n- [ ] Review: does this still hold? 📅 ${addDays(t.today, t.reviewIn ?? 30)}\n`;
}
/** Close the open review: it held (another review in `every` days) or it broke (status: broken). */
export function reviewThesis(content: string, holds: boolean, today: string, price?: number, every = 30): string {
  const at = price === undefined ? "" : ` at ${usd(price)}`;
  const c = content.replace(REVIEW_RE, (line) => `${line.replace("- [ ]", "- [x]")} ✅ ${today} · ${holds ? "still held" : "broke"}${at}`);
  if (!holds) return setProperty(c, "status", "broken");
  return `${c.trimEnd()}\n- [ ] Review: does this still hold? 📅 ${addDays(today, every)}\n`;
}

/** Coins to price: the watchlist, then any open trade's or live thesis's coin, at most MAX_WATCH. */
export function watchSymbols(watch: string[], trades: Trade[], ts: Thesis[]): string[] {
  return [...new Set([...watch, ...trades.filter(isOpen).map((t) => t.asset), ...ts.filter((t) => t.status === "holds").map((t) => t.asset)].map(symbolOf).filter(Boolean))].slice(0, MAX_WATCH);
}
