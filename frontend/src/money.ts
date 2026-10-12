// The Money kit, all pure: subscriptions that come back for a keep-or-cancel decision before they
// renew, a monthly budget sheet, and a net-worth note whose coin lines are priced live.
import { frontmatter, type NoteLike } from "./notes.ts";
import { setProperty } from "./organize.ts";
import { serializeWorkbook, type Value } from "./sheet.ts";
import { addPeriod, setDue } from "./work.ts";

const num = (v: string | undefined): number | undefined => {
  if (v === undefined || !v.trim()) return undefined;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const typeOf = (content: string) => (frontmatter(content).data.type ?? "").trim().toLowerCase();
const stem = (path: string) => path.split("/").pop()!.replace(/\.md$/, "");
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// ---- subscriptions

export const RENEW_TASK = "Renews: keep or cancel?";
export type Subscription = { path: string; name: string; cost: number; every: string; renews?: string; status: string; monthly: number; inDays?: number };
/** What `cost` every `every` comes to per month: 12 a year is 1 a month, 3 a week is 13. */
export function perMonth(cost: number, every: string): number {
  const m = /^\s*(\d+)?\s*(day|week|month|quarter|year)s?\s*$/i.exec(every.replace(/^every\s+/i, ""));
  const n = Number(m?.[1] ?? 1), unit = (m?.[2] ?? "month").toLowerCase();
  const months = { day: 12 / 365, week: 12 / 52, month: 1, quarter: 3, year: 12 }[unit] ?? 1;
  return cost / (n * months);
}
export const isSubscription = (content: string) => typeOf(content) === "subscription";
export function subscriptions(notes: NoteLike[], today: string): Subscription[] {
  return notes.filter((n) => n.path.endsWith(".md") && isSubscription(n.content)).map((n) => {
    const d = frontmatter(n.content).data;
    const cost = num(d.cost) ?? 0, every = (d.every ?? "month").trim() || "month", renews = (d.renews ?? "").trim() || undefined;
    return { path: n.path, name: stem(n.path), cost, every, renews, status: (d.status ?? "active").trim().toLowerCase() || "active", monthly: perMonth(cost, every), inDays: renews ? days(today, renews) : undefined };
  }).sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active") || (a.renews ?? "9").localeCompare(b.renews ?? "9"));
}
export const subscriptionTotals = (subs: Subscription[]) => { const m = subs.filter((s) => s.status === "active").reduce((a, s) => a + s.monthly, 0); return { monthly: m, yearly: m * 12 }; };
export function SUBSCRIPTION_TEMPLATE(cost: number, every: string, renews: string, name: string): string {
  return `---\ntype: subscription\ncost: ${cost}\nevery: ${every}\nrenews: ${renews}\nstatus: active\n---\n\n# ${name}\n\n- [ ] ${RENEW_TASK} 📅 ${renews}\n\n## Why I have it\n\n`;
}
/** It renewed: the next renewal one period on, and the reminder in Work moves with it. */
export function renewSubscription(content: string, today: string): string {
  const d = frontmatter(content).data;
  let next = (d.renews ?? "").trim() || today;
  do next = addPeriod(next, d.every ?? "month"); while (next <= today);
  return setDue(setProperty(content, "renews", next), next, RENEW_TASK);
}
export function cancelSubscription(content: string, today: string): string {
  return setProperty(content, "status", "cancelled").replace(new RegExp(`^- \\[ \\] (${RENEW_TASK.replace("?", "\\?")}[^\\n]*)$`, "m"), `- [x] $1 ✅ ${today} · cancelled`);
}

// ---- budget

export const BUDGET_CATEGORIES = ["Rent or mortgage", "Groceries", "Eating out", "Transport", "Utilities", "Subscriptions", "Fun", "Saving"];
/** A Budget sheet: planned and spent per category, what is left, and a Total row the tab reads. */
export function budgetWorkbook(planned: number[] = [1500, 400, 150, 120, 150, 50, 150, 500]): string {
  const n = BUDGET_CATEGORIES.length;
  const rows = [["Category", "Planned", "Spent", "Left"], ...BUDGET_CATEGORIES.map((c, i) => [c, String(planned[i] ?? 0), "0", `=B${i + 2}-C${i + 2}`]), ["Total", `=SUM(B2:B${n + 1})`, `=SUM(C2:C${n + 1})`, `=B${n + 2}-C${n + 2}`]];
  return serializeWorkbook({ sheets: [{ name: "Budget", rows, charts: [{ id: "budget", type: "bar", title: "Planned and spent", labels: `A2:A${n + 1}`, values: [`B2:B${n + 1}`, `C2:C${n + 1}`], legend: "bottom" }] }] });
}
/** The Total row of an evaluated Budget sheet. */
export function budgetTotals(vals: Value[][] | undefined): { planned: number; spent: number; left: number } | undefined {
  const r = vals?.find((row) => String(row[0] ?? "").trim().toLowerCase() === "total");
  if (!r) return undefined;
  const planned = Number(r[1]) || 0, spent = Number(r[2]) || 0;
  return { planned, spent, left: planned - spent };
}

// ---- net worth

export type Holding = { account: string; kind: string; amount: number; coin?: string };
/** Rows of the first table with an Amount column. An amount is dollars ("2,500", "-1200" for a
 *  debt) or a quantity of a coin ("0.05 BTC"), priced live. */
export function holdings(md: string): Holding[] {
  const lines = md.split("\n");
  const head = lines.findIndex((l) => /^\s*\|.*\bamount\b.*\|\s*$/i.test(l));
  if (head < 0) return [];
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const cols = cells(lines[head]).map((c) => c.toLowerCase());
  const at = (name: string) => cols.findIndex((c) => c.includes(name));
  const out: Holding[] = [];
  for (const l of lines.slice(head + 2)) {
    if (!/^\s*\|/.test(l)) break;
    const c = cells(l);
    const raw = c[at("amount")] ?? "";
    const coin = /^(-?[\d,.]+)\s*([A-Za-z][A-Za-z0-9]{1,9})$/.exec(raw.replace(/\$/g, "").trim());
    const amount = coin ? Number(coin[1].replace(/,/g, "")) : num(raw);
    if (amount === undefined || !Number.isFinite(amount)) continue;
    out.push({ account: c[Math.max(0, at("account"))] ?? "", kind: (c[at("kind")] ?? "").toLowerCase() || "other", amount, coin: coin?.[2].toUpperCase() });
  }
  return out;
}
export function netWorth(hs: Holding[], priceOf: (coin: string) => number | undefined): { total: number; byKind: { kind: string; total: number }[]; unpriced: string[] } {
  const by = new Map<string, number>();
  const unpriced: string[] = [];
  let total = 0;
  for (const h of hs) {
    const p = h.coin ? priceOf(h.coin) : 1;
    if (p === undefined) { unpriced.push(h.coin!); continue; }
    total += h.amount * p;
    by.set(h.kind, (by.get(h.kind) ?? 0) + h.amount * p);
  }
  return { total, byKind: [...by].map(([kind, t]) => ({ kind, total: t })).sort((a, b) => b.total - a.total), unpriced: [...new Set(unpriced)] };
}
const HISTORY_RE = /^- (\d{4}-\d{2}-\d{2}):\s*\$?(-?[\d,.]+)\s*$/;
export function netWorthHistory(md: string): { date: string; total: number }[] {
  return md.split("\n").map((l) => HISTORY_RE.exec(l.trim())).filter((m): m is RegExpExecArray => !!m).map((m) => ({ date: m[1], total: Number(m[2].replace(/,/g, "")) })).sort((a, b) => a.date.localeCompare(b.date));
}
/** Record today's total under ## History (replacing today's line if there is one). */
export function recordNetWorth(md: string, date: string, total: number): string {
  const line = `- ${date}: $${Math.round(total).toLocaleString("en-US")}`;
  const lines = md.split("\n");
  const same = lines.findIndex((l) => HISTORY_RE.exec(l.trim())?.[1] === date);
  if (same >= 0) { lines[same] = line; return lines.join("\n"); }
  if (!/^## History\s*$/m.test(md)) return `${md.trimEnd()}\n\n## History\n\n${line}\n`;
  const h = lines.findIndex((l) => /^## History\s*$/.test(l));
  let end = h + 1;
  while (end < lines.length && !/^#{1,2}\s/.test(lines[end])) end++;
  while (end > h + 1 && !lines[end - 1].trim()) end--;
  lines.splice(end, 0, ...(end === h + 1 ? ["", line] : [line]));
  return lines.join("\n");
}
export const NET_WORTH_NOTE = `# Net worth\n\nOne row per account. Amounts are dollars (a debt is negative) or a coin quantity like \`0.05 BTC\`, priced live.\n\n| Account | Kind | Amount |\n| --- | --- | --- |\n| Checking | cash | 2,500 |\n| Savings | cash | 8,000 |\n| Retirement | investments | 20,000 |\n| Bitcoin | crypto | 0.05 BTC |\n| Credit card | debt | -600 |\n\n## History\n\n`;

// ---- templates: two more ways to budget, and FIRE and Coast FIRE calculators

const sheet = (name: string, rows: string[][], charts: Parameters<typeof serializeWorkbook>[0]["sheets"][number]["charts"] = []) => ({ name, rows, charts });
/** 50/30/20: needs half of take-home pay, wants 30%, savings 20%. Each line is tagged Need, Want or Save. */
export function fiftyThirtyTwentyWorkbook(): string {
  const lines = [["Rent or mortgage", "Need", "1500"], ["Groceries", "Need", "400"], ["Utilities", "Need", "150"], ["Transport", "Need", "200"], ["Eating out", "Want", "200"], ["Fun", "Want", "250"], ["Subscriptions", "Want", "60"], ["Emergency fund", "Save", "500"], ["Retirement", "Save", "500"]];
  const first = 4, last = first + lines.length - 1;
  const kind = (label: string, tag: string, pct: string, r: number) => [label, pct, `=$B$1*B${r}`, `=SUMIF($B$${first}:$B$${last}, "${tag}", $C$${first}:$C$${last})`, `=C${r}-D${r}`];
  const s = last + 3;
  return serializeWorkbook({ sheets: [sheet("50-30-20", [
    ["Take-home pay a month", "5000", "Tag each line Need, Want or Save"], ["", "", ""], ["Line", "Kind", "Amount"], ...lines, ["", "", ""],
    ["Kind", "Target %", "Target", "Planned", "Room left"], kind("Needs", "Need", "50%", s), kind("Wants", "Want", "30%", s + 1), kind("Savings", "Save", "20%", s + 2),
    ["Total", `=SUM(B${s}:B${s + 2})`, `=SUM(C${s}:C${s + 2})`, `=SUM(D${s}:D${s + 2})`, `=C${s + 3}-D${s + 3}`],
  ], [{ id: "fifty", type: "bar", title: "Target and planned", labels: `A${s}:A${s + 2}`, values: [`C${s}:C${s + 2}`, `D${s}:D${s + 2}`], legend: "bottom" }])] });
}
/** Zero-based: every dollar of income gets a job until Left to assign is 0. */
export function zeroBasedWorkbook(): string {
  const jobs = [["Rent or mortgage", "1500"], ["Groceries", "450"], ["Utilities", "150"], ["Transport", "200"], ["Debt payments", "300"], ["Emergency fund", "500"], ["Retirement", "600"], ["Fun", "200"], ["Gifts", "100"]];
  const first = 7, last = first + jobs.length - 1;
  return serializeWorkbook({ sheets: [sheet("Zero-based", [
    ["Income this month", "Amount"], ["Paycheck", "4500"], ["Side income", "500"], ["Total income", "=SUM(B2:B3)"], ["", ""],
    ["Job for the money", "Assigned", "Spent", "Left"], ...jobs.map(([j, a], i) => [j, a, "0", `=B${first + i}-C${first + i}`]),
    ["Total", `=SUM(B${first}:B${last})`, `=SUM(C${first}:C${last})`, `=SUM(D${first}:D${last})`], ["", ""],
    ["Left to assign (make it 0)", `=B4-B${last + 1}`],
  ])] });
}
const YEARS = 50;
/** FIRE: the nest egg that pays for a year of spending at a safe withdrawal rate, and how long saving takes to reach it. */
export function fireWorkbook(): string {
  const proj = Array.from({ length: YEARS }, (_, i) => { const r = i + 2; return [String(i + 1), `=FIRE!$B$2+A${r}`, i ? `=F${r - 1}` : "=FIRE!$B$3", "=FIRE!$B$4", `=C${r}*FIRE!$B$6`, `=C${r}+D${r}+E${r}`, "=FIRE!$B$10"]; });
  return serializeWorkbook({ sheets: [
    sheet("FIRE", [
      ["Your numbers", "Value", "Notes"], ["Current age", "30", ""], ["Invested now", "50000", "Everything invested for retirement"], ["Saving each year", "20000", "Added at the end of each year"],
      ["Spending each year in retirement", "40000", "In today's dollars"], ["Expected return after inflation", "5%", "Stocks have returned about 5-7% a year after inflation"], ["Safe withdrawal rate", "4%", "The 4% rule; 3.5% is more cautious"],
      ["", "", ""], ["Results", "", ""], ["FIRE number", "=ROUND(B5/B7, 0)", "Spending ÷ withdrawal rate"],
      ["Years to FIRE", "=IF(B3>=B10, 0, ROUND(NPER(B6, -B4, -B3, B10), 1))", ""], ["FIRE age", "=ROUND(B2+B11, 1)", ""],
      ["Saving a year to get there in 10 years", "=ROUND(-PMT(B6, 10, -B3, B10), 0)", ""],
    ]),
    sheet("Projection", [["Year", "Age", "Start", "Saved", "Growth", "End", "FIRE number"], ...proj], [{ id: "fire", type: "line", title: "Invested and the FIRE number", labels: `B2:B${YEARS + 1}`, values: [`F2:F${YEARS + 1}`, `G2:G${YEARS + 1}`], legend: "bottom" }]),
  ] });
}
/** Coast FIRE: invested enough today that growth alone reaches the FIRE number by retirement age, so saving can stop. */
export function coastFireWorkbook(): string {
  const proj = Array.from({ length: YEARS }, (_, i) => {
    const r = i + 2;
    // once coasting, saving stops and growth does the rest
    return [String(i), `=Coast!$B$2+A${r}`, i ? `=IF(E${r - 1}=1, C${r - 1}*(1+Coast!$B$6), C${r - 1}*(1+Coast!$B$6)+Coast!$B$8)` : "=Coast!$B$4", `=Coast!$B$11/(1+Coast!$B$6)^MAX(0, Coast!$B$3-B${r})`, `=IF(C${r}>=D${r}, 1, 0)`];
  });
  return serializeWorkbook({ sheets: [
    sheet("Coast", [
      ["Your numbers", "Value", "Notes"], ["Current age", "30", ""], ["Retirement age", "60", ""], ["Invested now", "50000", ""],
      ["Spending each year in retirement", "40000", "In today's dollars"], ["Expected return after inflation", "5%", ""], ["Safe withdrawal rate", "4%", ""],
      ["Saving each year until you coast", "15000", "Stops once you reach your Coast FIRE number"], ["", "", ""], ["Results", "", ""],
      ["FIRE number", "=ROUND(B5/B7, 0)", "Needed at retirement"], ["Coast FIRE number today", "=ROUND(B11/(1+B6)^(B3-B2), 0)", "Grows to the FIRE number by retirement with no more saving"],
      ["Invested now grows to", "=ROUND(B4*(1+B6)^(B3-B2), 0)", "By retirement, saving nothing more"], ["Coasting already?", `=IF(B4>=B12, "Yes", "Not yet")`, ""],
      ["Still needed today", "=MAX(0, B12-B4)", ""], ["Coast age", `=IFERROR(IF(INDEX(Projection!B2:B${YEARS + 1}, MATCH(1, Projection!E2:E${YEARS + 1}))>B3, "Not before retirement", INDEX(Projection!B2:B${YEARS + 1}, MATCH(1, Projection!E2:E${YEARS + 1}))), "Not before retirement")`, "When you can stop saving"],
    ]),
    sheet("Projection", [["Year", "Age", "Invested", "Coast number at this age", "Coasting"], ...proj], [{ id: "coast", type: "line", title: "Invested and the Coast FIRE number", labels: `B2:B${YEARS + 1}`, values: [`C2:C${YEARS + 1}`, `D2:D${YEARS + 1}`], legend: "bottom" }]),
  ] });
}
/** A value from an evaluated sheet by its label in column A. */
export const byLabel = (vals: Value[][] | undefined, label: string): Value | undefined => vals?.find((r) => String(r[0] ?? "").trim().toLowerCase() === label.toLowerCase())?.[1];
export const MONEY_TEMPLATES: { path: string; label: string; make: () => string }[] = [
  { path: "Money/50-30-20 budget.sheet", label: "50/30/20 budget", make: fiftyThirtyTwentyWorkbook },
  { path: "Money/Zero-based budget.sheet", label: "Zero-based budget", make: zeroBasedWorkbook },
  { path: "Money/FIRE.sheet", label: "FIRE calculator", make: fireWorkbook },
  { path: "Money/Coast FIRE.sheet", label: "Coast FIRE calculator", make: coastFireWorkbook },
];
