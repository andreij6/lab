// Spreadsheet notes (`.sheet`): a workbook of sheets, each a grid of raw strings where a leading
// `=` is a formula. Pure: parsing, evaluation, CSV and chart SVG; the grid UI lives in main.ts.

export type ChartType = "bar" | "line" | "pie" | "area";
export type Chart = {
  id: string; type: ChartType; title: string; labels: string; values: string[];
  /** styling, all optional: a named palette or explicit colours, legend placement, value labels, stacking, axis titles */
  palette?: string; colors?: string[]; legend?: "right" | "bottom" | "none"; showValues?: boolean; stacked?: boolean; xLabel?: string; yLabel?: string; smooth?: boolean;
};
export const PALETTES: Record<string, string[]> = {
  default: ["#4f8cff", "#f0a742", "#4fc27a", "#e35d6a", "#a675f0", "#3bbfd1"],
  warm: ["#e35d6a", "#f0a742", "#f6d55c", "#d9793f", "#b4533c", "#f2a3a0"],
  cool: ["#3b82f6", "#06b6d4", "#6366f1", "#14b8a6", "#0ea5e9", "#8b5cf6"],
  mono: ["#4f8cff", "#7fa9ff", "#a9c4ff", "#2f6be0", "#1d4fb3", "#cfdcff"],
  earth: ["#8c6d46", "#c2a26a", "#6b8e4e", "#a65d3a", "#5b6b3a", "#d9c7a0"],
};
export type Sheet = { name: string; rows: string[][]; charts: Chart[] };
export type Workbook = { sheets: Sheet[] };
export type Value = number | string | boolean | null;

const newId = () => Math.random().toString(36).slice(2, 8);
export const isSheetPath = (p: string): boolean => p.toLowerCase().endsWith(".sheet");
export const newSheet = (name: string): Sheet => ({ name, rows: [], charts: [] });
export const NEW_WORKBOOK = serializeWorkbook({ sheets: [{ name: "Sheet1", rows: [["Item", "Amount"], ["Rent", "1200"], ["Food", "400"], ["Total", "=SUM(B2:B3)"]], charts: [] }] });

export function parseWorkbook(json: string): Workbook {
  try {
    const raw = JSON.parse(json) as Partial<Workbook>;
    const sheets = (Array.isArray(raw.sheets) ? raw.sheets : []).map((s, i) => ({
      name: typeof s?.name === "string" && s.name ? s.name : `Sheet${i + 1}`,
      rows: (Array.isArray(s?.rows) ? s.rows : []).map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? "" : String(c))) : [])),
      charts: (Array.isArray(s?.charts) ? s.charts : []).map((c): Chart => ({ ...c, id: c?.id ?? newId(), type: c?.type === "line" || c?.type === "pie" || c?.type === "area" ? c.type : "bar", title: String(c?.title ?? ""), labels: String(c?.labels ?? "A"), values: Array.isArray(c?.values) ? c.values.map(String) : ["B"] })),
    }));
    return { sheets: sheets.length ? sheets : [newSheet("Sheet1")] };
  } catch {
    return { sheets: [newSheet("Sheet1")] };
  }
}
export function serializeWorkbook(wb: Workbook): string {
  const trim = (rows: string[][]) => {
    const out = rows.map((r) => { let n = r.length; while (n > 0 && r[n - 1] === "") n--; return r.slice(0, n); });
    while (out.length && !out[out.length - 1].length) out.pop();
    return out;
  };
  return `${JSON.stringify({ sheets: wb.sheets.map((s) => ({ name: s.name, rows: trim(s.rows), charts: s.charts })) }, null, 1)}\n`;
}
export const addChart = (s: Sheet, c: Omit<Chart, "id">): Chart => { const ch = { id: newId(), ...c }; s.charts.push(ch); return ch; };

// --- A1 references
export function colName(i: number): string { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; }
export function colIndex(name: string): number { let n = 0; for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
export function parseRef(ref: string): { r: number; c: number } | undefined {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref.trim());
  return m ? { r: Number(m[2]) - 1, c: colIndex(m[1]) } : undefined;
}

// --- CSV
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ""));
}
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (rows: (string | Value)[][]): string => rows.map((r) => r.map((v) => csvCell(v == null ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v))).join(",")).join("\n");

// --- formulas
type Tok = { t: "num" | "str" | "id" | "op" | "ref" | "range"; v: string };
function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:("(?:[^"]|"")*")|((?:'[^']+'|[A-Za-z_][\w ]*?)!\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}\$?\d+:\$?[A-Za-z]{1,3}\$?\d+|\$?[A-Za-z]{1,3}\$?\d+(?![\w(]))|(\d+(?:\.\d+)?(?:[eE][-+]?\d+)?%?)|([A-Za-z_][A-Za-z_0-9.]*)|(<=|>=|<>|[-+*/^&=<>(),:;]))/y;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m || m[0] === "") { if (/^\s*$/.test(src.slice(i))) break; throw new Error("#ERROR!"); }
    i = re.lastIndex;
    if (m[1] !== undefined) out.push({ t: "str", v: m[1].slice(1, -1).replace(/""/g, '"') });
    else if (m[2] !== undefined) out.push({ t: m[2].includes(":") ? "range" : "ref", v: m[2].replace(/\$/g, "") });
    else if (m[3] !== undefined) out.push({ t: "num", v: m[3] });
    else if (m[4] !== undefined) out.push({ t: "id", v: m[4].toUpperCase() });
    else out.push({ t: "op", v: m[5] });
  }
  return out;
}

type Ctx = { get: (sheet: string | undefined, r: number, c: number) => Value; range: (sheet: string | undefined, a: string, b: string) => Value[] };
/** Ranges keep their width so VLOOKUP and friends can see rows. */
type Range = Value[] & { width?: number };
const num = (v: Value): number => (typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : v === null || v === "" ? 0 : (() => { const n = Number(v); if (Number.isNaN(n)) throw new Error("#VALUE!"); return n; })());
const str = (v: Value): string => (v === null ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v));
const truthy = (v: Value): boolean => (typeof v === "boolean" ? v : typeof v === "number" ? v !== 0 : typeof v === "string" ? v !== "" && v.toUpperCase() !== "FALSE" : false);
const nums = (args: (Value | Value[])[]): number[] => args.flatMap((a) => (Array.isArray(a) ? a.filter((v) => typeof v === "number") : [num(a)])) as number[];

const flat = (a: Value | Value[] | undefined): Value[] => (Array.isArray(a) ? a : [a ?? null]);
/** A COUNTIF-style criterion: a number or text to equal, or ">=10", "<>x", "a*" with wildcards. */
function crit(c: Value): (v: Value) => boolean {
  if (typeof c === "string") {
    const m = /^(<=|>=|<>|=|<|>)(.*)$/.exec(c);
    if (m) {
      const rhs = m[2].trim();
      const n = Number(rhs);
      const cmpNum = rhs !== "" && !Number.isNaN(n);
      return (v) => {
        if (m[1] === "<>") return cmpNum ? v !== n : str(v).toLowerCase() !== rhs.toLowerCase();
        if (m[1] === "=") return cmpNum ? v === n : str(v).toLowerCase() === rhs.toLowerCase();
        if (typeof v !== "number" || !cmpNum) return false;
        return m[1] === "<" ? v < n : m[1] === ">" ? v > n : m[1] === "<=" ? v <= n : v >= n;
      };
    }
    if (/[*?]/.test(c)) { const re = new RegExp(`^${c.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i"); return (v) => re.test(str(v)); }
    return (v) => str(v).toLowerCase() === c.toLowerCase();
  }
  return (v) => v === c;
}
/** The first `n` arguments as numbers, missing optional ones as 0. */
const tvm = (a: (Value | Value[])[], n: number): number[] => Array.from({ length: n }, (_, i) => (a[i] === undefined ? 0 : num(a[i] as Value)));
const FUNCS: Record<string, (args: (Value | Value[])[]) => Value> = {
  SUM: (a) => nums(a).reduce((x, y) => x + y, 0),
  AVERAGE: (a) => { const n = nums(a); if (!n.length) throw new Error("#DIV/0!"); return n.reduce((x, y) => x + y, 0) / n.length; },
  MIN: (a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
  MAX: (a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
  COUNT: (a) => nums(a).length,
  COUNTA: (a) => a.flatMap((x) => (Array.isArray(x) ? x : [x])).filter((v) => v !== null && v !== "").length,
  IF: (a) => (truthy(a[0] as Value) ? (a[1] as Value) ?? true : (a[2] as Value) ?? false),
  AND: (a) => a.flatMap((x) => (Array.isArray(x) ? x : [x])).every(truthy),
  OR: (a) => a.flatMap((x) => (Array.isArray(x) ? x : [x])).some(truthy),
  NOT: (a) => !truthy(a[0] as Value),
  ABS: (a) => Math.abs(num(a[0] as Value)),
  ROUND: (a) => { const d = a[1] === undefined ? 0 : num(a[1] as Value); const f = 10 ** d; return Math.round(num(a[0] as Value) * f) / f; },
  FLOOR: (a) => Math.floor(num(a[0] as Value)),
  CEILING: (a) => Math.ceil(num(a[0] as Value)),
  SQRT: (a) => { const n = num(a[0] as Value); if (n < 0) throw new Error("#NUM!"); return Math.sqrt(n); },
  MOD: (a) => { const d = num(a[1] as Value); if (!d) throw new Error("#DIV/0!"); return num(a[0] as Value) % d; },
  POWER: (a) => num(a[0] as Value) ** num(a[1] as Value),
  LEN: (a) => str(a[0] as Value).length,
  UPPER: (a) => str(a[0] as Value).toUpperCase(),
  LOWER: (a) => str(a[0] as Value).toLowerCase(),
  TRIM: (a) => str(a[0] as Value).trim(),
  CONCAT: (a) => a.flatMap((x) => (Array.isArray(x) ? x : [x])).map(str).join(""),
  CONCATENATE: (a) => a.flatMap((x) => (Array.isArray(x) ? x : [x])).map(str).join(""),
  MEDIAN: (a) => { const n = nums(a).sort((x, y) => x - y); if (!n.length) throw new Error("#DIV/0!"); const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; },
  STDEV: (a) => { const n = nums(a); if (n.length < 2) throw new Error("#DIV/0!"); const mean = n.reduce((x, y) => x + y, 0) / n.length; return Math.sqrt(n.reduce((x, y) => x + (y - mean) ** 2, 0) / (n.length - 1)); },
  COUNTIF: (a) => flat(a[0]).filter(crit(a[1] as Value)).length,
  SUMIF: (a) => { const r = flat(a[0]), c = crit(a[1] as Value), v = a[2] === undefined ? r : flat(a[2]); return r.reduce((acc: number, x, i) => (c(x) && typeof v[i] === "number" ? acc + (v[i] as number) : acc), 0); },
  AVERAGEIF: (a) => { const r = flat(a[0]), c = crit(a[1] as Value), v = a[2] === undefined ? r : flat(a[2]); const hit = r.map((x, i) => (c(x) && typeof v[i] === "number" ? (v[i] as number) : null)).filter((x): x is number => x !== null); if (!hit.length) throw new Error("#DIV/0!"); return hit.reduce((x, y) => x + y, 0) / hit.length; },
  VLOOKUP: (a) => { const key = a[0] as Value; const r = a[1] as Range; const w = r.width ?? 1; const col = num(a[2] as Value) - 1; if (col < 0 || col >= w) throw new Error("#REF!"); for (let i = 0; i + w <= r.length; i += w) { const k = r[i]; if (k === key || (typeof k === "string" && typeof key === "string" && k.toLowerCase() === key.toLowerCase())) return r[i + col]; } throw new Error("#N/A"); },
  INDEX: (a) => { const r = a[0] as Range; const w = r.width ?? 1; const row = num(a[1] as Value) - 1; const col = a[2] === undefined ? 0 : num(a[2] as Value) - 1; const v = r[row * w + col]; if (v === undefined) throw new Error("#REF!"); return v; },
  MATCH: (a) => { const key = a[0] as Value; const r = flat(a[1]); const i = r.findIndex((v) => v === key || (typeof v === "string" && typeof key === "string" && v.toLowerCase() === key.toLowerCase())); if (i < 0) throw new Error("#N/A"); return i + 1; },
  IFERROR: (a) => { const v = a[0] as Value; return typeof v === "string" && v.startsWith("#") ? (a[1] as Value) ?? "" : v; },
  LN: (a) => { const n = num(a[0] as Value); if (n <= 0) throw new Error("#NUM!"); return Math.log(n); },
  LOG: (a) => { const n = num(a[0] as Value), b = a[1] === undefined ? 10 : num(a[1] as Value); if (n <= 0 || b <= 0 || b === 1) throw new Error("#NUM!"); return b === 10 ? Math.log10(n) : Math.log(n) / Math.log(b); },
  EXP: (a) => Math.exp(num(a[0] as Value)),
  // the time-value-of-money functions, with Excel's signs: money paid out is negative
  FV: (a) => { const [r, n, pmt, pv, t] = tvm(a, 5); const g = (1 + r) ** n; return r ? -(pv * g + pmt * (1 + r * t) * ((g - 1) / r)) : -(pv + pmt * n); },
  PV: (a) => { const [r, n, pmt, fv, t] = tvm(a, 5); const g = (1 + r) ** n; return r ? -(fv + pmt * (1 + r * t) * ((g - 1) / r)) / g : -(fv + pmt * n); },
  PMT: (a) => { const [r, n, pv, fv, t] = tvm(a, 5); if (!n) throw new Error("#NUM!"); const g = (1 + r) ** n; return r ? -(r * (fv + pv * g)) / ((1 + r * t) * (g - 1)) : -(pv + fv) / n; },
  NPER: (a) => {
    const [r, pmt, pv, fv, t] = tvm(a, 5);
    if (!r) { if (!pmt) throw new Error("#NUM!"); return -(pv + fv) / pmt; }
    const x = (pmt * (1 + r * t) - fv * r) / (pmt * (1 + r * t) + pv * r);
    if (!(x > 0)) throw new Error("#NUM!");
    return Math.log(x) / Math.log(1 + r);
  },
  PI: () => Math.PI,
  TODAY: () => new Date().toISOString().slice(0, 10),
};

function parseFormula(src: string, ctx: Ctx): Value {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const take = (v?: string) => { const t = toks[i++]; if (!t || (v !== undefined && t.v !== v)) throw new Error("#ERROR!"); return t; };
  const splitRef = (v: string): { sheet?: string; a: string; b?: string } => {
    const bang = v.lastIndexOf("!");
    const sheet = bang >= 0 ? v.slice(0, bang).replace(/^'|'$/g, "") : undefined;
    const [a, b] = v.slice(bang + 1).split(":");
    return { sheet, a, b };
  };
  const cell = (v: string): Value => { const { sheet, a } = splitRef(v); const p = parseRef(a)!; return ctx.get(sheet, p.r, p.c); };
  const cmp = (): Value => {
    let l = add();
    while (peek()?.t === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(peek().v)) {
      const op = take().v; const r = add();
      const both = typeof l === "number" && typeof r === "number" ? [l, r] : [str(l).toLowerCase(), str(r).toLowerCase()];
      l = op === "=" ? both[0] === both[1] : op === "<>" ? both[0] !== both[1] : op === "<" ? both[0] < both[1] : op === ">" ? both[0] > both[1] : op === "<=" ? both[0] <= both[1] : both[0] >= both[1];
    }
    return l;
  };
  const add = (): Value => {
    let l = mul();
    while (peek()?.t === "op" && ["+", "-", "&"].includes(peek().v)) { const op = take().v; const r = mul(); l = op === "&" ? str(l) + str(r) : op === "+" ? num(l) + num(r) : num(l) - num(r); }
    return l;
  };
  const mul = (): Value => {
    let l = unary();
    while (peek()?.t === "op" && ["*", "/"].includes(peek().v)) { const op = take().v; const r = unary(); if (op === "/") { const d = num(r); if (d === 0) throw new Error("#DIV/0!"); l = num(l) / d; } else l = num(l) * num(r); }
    return l;
  };
  const unary = (): Value => { if (peek()?.t === "op" && peek().v === "-") { take(); return -num(unary()); } if (peek()?.t === "op" && peek().v === "+") { take(); return unary(); } return pow(); };
  const pow = (): Value => { const b = atom(); if (peek()?.t === "op" && peek().v === "^") { take(); return num(b) ** num(unary()); } return b; };
  const argument = (): Value | Value[] => { const t = peek(); if (t?.t === "range") { take(); const { sheet, a, b } = splitRef(t.v); return ctx.range(sheet, a, b!); } return cmp(); };
  const atom = (): Value => {
    const t = take();
    if (t.t === "num") return t.v.endsWith("%") ? Number(t.v.slice(0, -1)) / 100 : Number(t.v);
    if (t.t === "str") return t.v;
    if (t.t === "ref") return cell(t.v);
    if (t.t === "range") { const { sheet, a, b } = splitRef(t.v); const vs = ctx.range(sheet, a, b!); return vs.length === 1 ? vs[0] : (() => { throw new Error("#VALUE!"); })(); }
    if (t.t === "op" && t.v === "(") { const v = cmp(); take(")"); return v; }
    if (t.t === "id") {
      if (t.v === "TRUE") return true;
      if (t.v === "FALSE") return false;
      if (t.v === "IFERROR") {
        // errors are thrown while parsing, so the first argument is tried and skipped on failure
        take("(");
        const start = i;
        let v: Value;
        try { v = argument() as Value; if (typeof v === "string" && v.startsWith("#")) throw new Error(v); } catch {
          i = start;
          for (let depth = 0; i < toks.length; i++) { const k = toks[i]; if (k.t === "op" && k.v === "(") depth++; else if (k.t === "op" && k.v === ")") { if (depth === 0) break; depth--; } else if (k.t === "op" && (k.v === "," || k.v === ";") && depth === 0) break; }
          v = null;
          let alt: Value = "";
          if (peek()?.t === "op" && (peek().v === "," || peek().v === ";")) { take(); alt = argument() as Value; }
          take(")");
          return alt;
        }
        if (peek()?.t === "op" && (peek().v === "," || peek().v === ";")) { take(); argument(); }
        take(")");
        return v;
      }
      const f = FUNCS[t.v];
      if (!f) throw new Error("#NAME?");
      take("(");
      const args: (Value | Value[])[] = [];
      if (!(peek()?.t === "op" && peek().v === ")")) { args.push(argument()); while (peek()?.t === "op" && (peek().v === "," || peek().v === ";")) { take(); args.push(argument()); } }
      take(")");
      return f(args);
    }
    throw new Error("#ERROR!");
  };
  const v = cmp();
  if (i < toks.length) throw new Error("#ERROR!");
  return v;
}

/** Every cell of every sheet computed: numbers stay numbers, formulas evaluate, errors are "#…" strings. */
export function evaluate(wb: Workbook): Map<string, Value[][]> {
  const memo = new Map<string, Value>();
  const stack = new Set<string>();
  const sheetOf = (name: string | undefined, fallback: Sheet): Sheet | undefined => (name === undefined ? fallback : wb.sheets.find((s) => s.name.toLowerCase() === name.toLowerCase()));
  const get = (cur: Sheet, name: string | undefined, r: number, c: number): Value => {
    const s = sheetOf(name, cur);
    if (!s) return "#REF!";
    const raw = s.rows[r]?.[c] ?? "";
    if (!raw.startsWith("=")) return literal(raw);
    const key = `${s.name}!${r},${c}`;
    if (memo.has(key)) return memo.get(key)!;
    if (stack.has(key)) return "#CYCLE!";
    stack.add(key);
    let v: Value;
    try {
      v = parseFormula(raw.slice(1), { get: (sh, rr, cc) => get(s, sh, rr, cc), range: (sh, a, b) => range(s, sh, a, b) });
      if (typeof v === "number" && !Number.isFinite(v)) v = "#NUM!";
    } catch (e) { v = (e as Error).message.startsWith("#") ? (e as Error).message : "#ERROR!"; }
    stack.delete(key);
    memo.set(key, v);
    return v;
  };
  const range = (cur: Sheet, name: string | undefined, a: string, b: string): Value[] => {
    const p = parseRef(a), q = parseRef(b);
    if (!p || !q) return ["#REF!"];
    const out: Range = [];
    for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++) for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) out.push(get(cur, name, r, c));
    out.width = Math.abs(q.c - p.c) + 1;
    return out;
  };
  const out = new Map<string, Value[][]>();
  for (const s of wb.sheets) out.set(s.name, s.rows.map((row, r) => row.map((_, c) => get(s, undefined, r, c))));
  return out;
}
function literal(raw: string): Value {
  if (raw === "") return null;
  const t = raw.trim();
  // 4% is 0.04; $1,200 and 1,200 are 1200
  if (/^-?\d+(\.\d+)?%$/.test(t)) return Number(t.slice(0, -1)) / 100;
  if (/^-?\$?\d+(\.\d+)?$/.test(t)) return Number(t.replace("$", ""));
  if (/^-?\$?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/[$,]/g, ""));
  if (/^(true|false)$/i.test(raw.trim())) return raw.trim().toLowerCase() === "true";
  return raw;
}
export function fmt(v: Value): string {
  if (v === null) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(10)));
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return v;
}

/** Computed values as CSV (what Python sees). */
export const sheetCsv = (vals: Value[][]): string => toCsv(vals);

// --- charts: small inline SVGs; series are columns, row 1 is the header, labels stop at the first blank
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
export const chartColors = (ch: Chart): string[] => (ch.colors?.length ? ch.colors : PALETTES[ch.palette ?? "default"] ?? PALETTES.default);
/** The series of a chart: labels from the label column, one number array per value column, header names. */
/** A chart's column: a letter ("A", read from row 2 down to the first blank) or a range ("A2:A9"). */
function chartSpan(ref: string): { c: number; from: number; to?: number } {
  const m = /^\$?([A-Za-z]{1,3})(?:\$?(\d+)(?::\$?[A-Za-z]{1,3}\$?(\d+))?)?$/.exec(ref.trim());
  return m ? { c: colIndex(m[1]), from: m[2] ? Number(m[2]) - 1 : 1, to: m[3] ? Number(m[3]) - 1 : undefined } : { c: -1, from: 1 };
}
export function chartData(vals: Value[][], ch: Chart): { labels: string[]; data: number[][]; names: string[] } {
  const L = chartSpan(ch.labels);
  const labels: string[] = [], rows: number[] = [];
  for (let r = L.from; r < vals.length && (L.to === undefined || r <= L.to); r++) {
    const l = vals[r]?.[L.c];
    if (l === null || l === undefined || l === "") { if (L.to === undefined) break; continue; }
    labels.push(fmt(l)); rows.push(r);
  }
  const series = ch.values.map(chartSpan);
  const data = series.map((x) => rows.map((r) => { const v = vals[r]?.[x.c]; return typeof v === "number" ? v : 0; }));
  // series names from the row above the labels
  const names = series.map((x) => fmt(vals[Math.max(0, L.from - 1)]?.[x.c] ?? colName(x.c)));
  return { labels, data, names };
}
export function chartSvg(vals: Value[][], ch: Chart): string {
  const { labels, data, names } = chartData(vals, ch);
  const col = chartColors(ch);
  const legend = ch.legend ?? (ch.type === "pie" || names.length > 1 ? "right" : "none");
  const W = 480, H = 240, T = ch.title ? 28 : 12, R = legend === "right" ? 130 : 12, L = ch.yLabel ? 58 : 44, B = (ch.xLabel ? 50 : 36) + (legend === "bottom" ? 16 : 0);
  const title = ch.title ? `<text x="${W / 2}" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">${esc(ch.title)}</text>` : "";
  if (!labels.length) return `<svg viewBox="0 0 ${W} ${H}" class="chart"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="12" fill="currentColor" opacity=".6">No data: column ${esc(ch.labels)} needs labels from row 2</text></svg>`;
  const keyItems = ch.type === "pie" ? labels.map((l, i) => ({ l: `${l} · ${fmt(data[0]?.[i] ?? 0)}`, c: col[i % col.length] })) : names.map((n, i) => ({ l: n, c: col[i % col.length] }));
  const key = legend === "none" ? "" : legend === "right"
    ? keyItems.slice(0, 11).map((k, i) => `<g transform="translate(${W - R + 8},${T + 6 + i * 18})"><rect width="12" height="12" rx="2" fill="${k.c}"/><text x="18" y="10" font-size="11" fill="currentColor">${esc(k.l.length > 16 ? `${k.l.slice(0, 15)}…` : k.l)}</text></g>`).join("")
    : keyItems.slice(0, 5).map((k, i) => `<g transform="translate(${L + i * 92},${H - 12})"><rect width="10" height="10" rx="2" fill="${k.c}"/><text x="14" y="9" font-size="10" fill="currentColor">${esc(k.l.length > 12 ? `${k.l.slice(0, 11)}…` : k.l)}</text></g>`).join("");
  if (ch.type === "pie") {
    const d = data[0] ?? [];
    const total = d.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    let a0 = -Math.PI / 2;
    const cx = legend === "right" ? (W - R) / 2 : W / 2, cy = T + (H - T - (legend === "bottom" ? 24 : 12)) / 2, rad = Math.min(cx - 20, (H - T - (legend === "bottom" ? 36 : 24)) / 2);
    const slices = d.map((v, i) => {
      const a1 = a0 + (Math.max(0, v) / total) * 2 * Math.PI;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const mid = (a0 + a1) / 2;
      const p = `M${cx},${cy} L${cx + rad * Math.cos(a0)},${cy + rad * Math.sin(a0)} A${rad},${rad} 0 ${big} 1 ${cx + rad * Math.cos(a1)},${cy + rad * Math.sin(a1)} Z`;
      const lbl = ch.showValues && v / total > 0.04 ? `<text x="${cx + rad * 0.62 * Math.cos(mid)}" y="${cy + rad * 0.62 * Math.sin(mid) + 4}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">${Math.round((100 * v) / total)}%</text>` : "";
      a0 = a1;
      return `<path d="${p}" fill="${col[i % col.length]}" stroke="var(--bg-2, #fff)" stroke-width="1.5"><title>${esc(labels[i])}: ${fmt(v)}</title></path>${lbl}`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="chart">${title}${slices}${key}</svg>`;
  }
  const stacked = !!ch.stacked && ch.type !== "line";
  const tops = stacked ? labels.map((_, i) => data.reduce((a, d) => a + Math.max(0, d[i]), 0)) : data.flat();
  const max = Math.max(1e-9, ...tops);
  const min = Math.min(0, ...data.flat());
  const span = max - min || 1;
  const y = (v: number) => T + ((max - v) / span) * (H - T - B);
  const x0 = L, plotW = W - L - R;
  const ticks = [0, 0.5, 1].map((f) => min + f * span);
  const axes = `${ticks.map((t) => `<line x1="${x0}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="currentColor" opacity=".12"/><text x="${x0 - 6}" y="${y(t) + 4}" text-anchor="end" font-size="10" fill="currentColor" opacity=".7">${fmt(Number(t.toPrecision(3)))}</text>`).join("")}`;
  const xl = labels.map((l, i) => `<text x="${x0 + ((i + 0.5) / labels.length) * plotW}" y="${H - B + 16}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".8">${esc(l.length > 10 ? `${l.slice(0, 9)}…` : l)}</text>`).join("");
  const axisTitles = `${ch.xLabel ? `<text x="${x0 + plotW / 2}" y="${H - B + 32}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".7">${esc(ch.xLabel)}</text>` : ""}${ch.yLabel ? `<text transform="translate(12,${T + (H - T - B) / 2}) rotate(-90)" text-anchor="middle" font-size="10" fill="currentColor" opacity=".7">${esc(ch.yLabel)}</text>` : ""}`;
  const px = (i: number) => x0 + ((i + 0.5) / labels.length) * plotW;
  let body = "";
  if (ch.type === "bar") {
    const gw = plotW / labels.length;
    if (stacked) {
      const bw = gw * 0.6;
      const acc = labels.map(() => 0);
      body = data.map((d, s) => d.map((v, i) => { const v0 = acc[i]; const v1 = v0 + Math.max(0, v); acc[i] = v1; return `<rect x="${x0 + i * gw + gw * 0.2}" y="${y(v1)}" width="${bw}" height="${Math.max(0, y(v0) - y(v1))}" fill="${col[s % col.length]}"><title>${esc(names[s])} · ${esc(labels[i])}: ${fmt(v)}</title></rect>${ch.showValues && v ? `<text x="${x0 + i * gw + gw / 2}" y="${(y(v0) + y(v1)) / 2 + 4}" text-anchor="middle" font-size="10" fill="#fff">${fmt(v)}</text>` : ""}`; }).join("")).join("");
    } else {
      const bw = (gw * 0.7) / data.length;
      body = data.map((d, s) => d.map((v, i) => { const bx = x0 + i * gw + gw * 0.15 + s * bw; return `<rect x="${bx}" y="${Math.min(y(v), y(0))}" width="${bw}" height="${Math.abs(y(v) - y(0))}" fill="${col[s % col.length]}" rx="2"><title>${esc(names[s])} · ${esc(labels[i])}: ${fmt(v)}</title></rect>${ch.showValues ? `<text x="${bx + bw / 2}" y="${y(Math.max(0, v)) - 3}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".8">${fmt(v)}</text>` : ""}`; }).join("")).join("");
    }
  } else {
    // line and area: a path per series; area stacks when asked
    const acc = labels.map(() => 0);
    body = data.map((d, s) => {
      const base = acc.slice();
      const ys = d.map((v, i) => { const t = stacked ? base[i] + Math.max(0, v) : v; if (stacked) acc[i] = t; return t; });
      const pts = ys.map((v, i) => [px(i), y(v)] as const);
      const line = ch.smooth && pts.length > 2 ? pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `C${(pts[i - 1][0] + p[0]) / 2},${pts[i - 1][1]} ${(pts[i - 1][0] + p[0]) / 2},${p[1]} ${p[0]},${p[1]}`)).join(" ") : pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
      const bottom = stacked ? base.map((b, i) => `L${px(i)},${y(b)}`).reverse().join(" ") : `L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)}`;
      const area = ch.type === "area" ? `<path d="${line} ${bottom} Z" fill="${col[s % col.length]}" opacity=".25"/>` : "";
      return `${area}<path d="${line}" fill="none" stroke="${col[s % col.length]}" stroke-width="2"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${col[s % col.length]}"><title>${esc(names[s])} · ${esc(labels[i])}: ${fmt(d[i])}</title></circle>${ch.showValues ? `<text x="${p[0]}" y="${p[1] - 7}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".8">${fmt(d[i])}</text>` : ""}`).join("")}`;
    }).join("");
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${title}${axes}${body}${xl}${axisTitles}${key}</svg>`;
}
