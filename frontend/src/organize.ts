// Tools for people with a system: saved searches as live views, typed properties and a table of
// them, periodic rollups, structure lint, bulk refactors, resurfacing and decay. Pure; the UI lives
// in main.ts (the Organize tab).
import { base, dir, frontmatter, parseTags, setFrontmatter, stem, type Index, type NoteLike } from "./notes.ts";

export type OrgNote = NoteLike & { modified?: bigint | number; created?: bigint | number };
const DAY = 86_400_000;
/** Notebook times are nanoseconds (bigint); tests pass milliseconds. */
export const ms = (t: bigint | number | undefined): number => (t === undefined ? 0 : typeof t === "bigint" ? Number(t / 1_000_000n) : t);

// ------------------------------------------------------------ saved searches

/** One condition of a query. Terms are ANDed; a leading `-` negates. */
export type Cond =
  | { k: "text"; v: string; not: boolean }
  | { k: "tag"; v: string; not: boolean }
  | { k: "folder"; v: string; not: boolean }
  | { k: "has"; v: string; not: boolean }
  | { k: "prop"; key: string; op: "=" | "<" | ">" | "<=" | ">="; v: string; not: boolean }
  | { k: "age"; field: "modified" | "created"; op: "<" | ">"; days: number; not: boolean };

/** `tag:#client status:open modified:<7d folder:Projects -tag:done has:due priority:>2 "a phrase" word` */
export function parseQuery(q: string): Cond[] {
  const out: Cond[] = [];
  for (const m of q.matchAll(/(-?)(?:([A-Za-z_][\w-]*):("[^"]*"|\S+)|"([^"]*)"|(\S+))/g)) {
    const not = m[1] === "-";
    if (m[2]) {
      const key = m[2].toLowerCase();
      const raw = m[3].replace(/^"|"$/g, "");
      if (key === "tag") out.push({ k: "tag", v: raw.replace(/^#/, "").toLowerCase(), not });
      else if (key === "folder" || key === "path") out.push({ k: "folder", v: raw.replace(/^\/|\/$/g, "").toLowerCase(), not });
      else if (key === "has") out.push({ k: "has", v: raw.toLowerCase(), not });
      else if ((key === "modified" || key === "created") && /^[<>]\d+d$/.test(raw)) out.push({ k: "age", field: key, op: raw[0] as "<" | ">", days: Number(raw.slice(1, -1)), not });
      else {
        const om = /^(<=|>=|<|>|=)?(.*)$/.exec(raw)!;
        out.push({ k: "prop", key, op: (om[1] ?? "=") as "=" | "<" | ">" | "<=" | ">=", v: om[2].toLowerCase(), not });
      }
    } else out.push({ k: "text", v: (m[4] ?? m[5]).toLowerCase(), not });
  }
  return out;
}
function cmpVal(a: string, op: string, b: string): boolean {
  const na = Number(a), nb = Number(b);
  const [x, y] = !Number.isNaN(na) && !Number.isNaN(nb) && a !== "" && b !== "" ? [na, nb] : [a, b];
  return op === "<" ? x < y : op === ">" ? x > y : op === "<=" ? x <= y : op === ">=" ? x >= y : a === b;
}
export function matches(n: OrgNote, conds: Cond[], now = Date.now()): boolean {
  if (!n.path.endsWith(".md")) return false;
  const { data } = frontmatter(n.content);
  const props = Object.fromEntries(Object.entries(data).map(([k, v]) => [k.toLowerCase(), v.replace(/^\[|\]$/g, "").trim().toLowerCase()]));
  const tags = parseTags(n.content).map((t) => t.toLowerCase());
  const hay = `${stem(n.path)}\n${n.content}`.toLowerCase();
  return conds.every((c) => {
    let hit: boolean;
    switch (c.k) {
      case "text": hit = hay.includes(c.v); break;
      case "tag": hit = tags.some((t) => t === c.v || t.startsWith(`${c.v}/`)); break;
      case "folder": hit = n.path.toLowerCase().startsWith(`${c.v}/`) || dir(n.path).toLowerCase() === c.v; break;
      case "has": hit = c.v in props; break;
      case "prop": hit = c.key in props && (c.op === "=" ? props[c.key].split(/\s*,\s*/).includes(c.v) || props[c.key] === c.v : cmpVal(props[c.key], c.op, c.v)); break;
      case "age": { const t = ms(c.field === "modified" ? n.modified : n.created); const age = (now - t) / DAY; hit = t > 0 && (c.op === "<" ? age < c.days : age > c.days); break; }
    }
    return c.not ? !hit : hit;
  });
}
export const runQuery = (notes: OrgNote[], q: string, now = Date.now()): OrgNote[] => { const c = parseQuery(q); return notes.filter((n) => matches(n, c, now)).sort((a, b) => ms(b.modified) - ms(a.modified)); };

// ------------------------------------------------------------ typed properties

export type PropType = "date" | "number" | "checkbox" | "people" | "choice" | "list" | "text";
/** What a property holds, judged from every value it has across the notes. */
export function inferType(values: string[]): PropType {
  const v = values.map((x) => x.trim()).filter(Boolean);
  if (!v.length) return "text";
  if (v.every((x) => /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?$/.test(x))) return "date";
  if (v.every((x) => /^-?\d+(\.\d+)?$/.test(x))) return "number";
  if (v.every((x) => /^(true|false|yes|no)$/i.test(x))) return "checkbox";
  if (v.every((x) => /^\[?\s*@[\w.-]+(\s*,\s*@[\w.-]+)*\s*\]?$/.test(x))) return "people";
  if (v.every((x) => /^\[.*\]$/.test(x))) return "list";
  const distinct = new Set(v.map((x) => x.toLowerCase()));
  if (v.length >= 3 && distinct.size <= Math.max(2, Math.ceil(v.length / 2)) && [...distinct].every((x) => x.length <= 24)) return "choice";
  return "text";
}
export type PropColumn = { key: string; type: PropType; choices: string[] };
/** The columns of a property table: every front matter key the notes use, with its type. */
export function propertyColumns(notes: OrgNote[]): PropColumn[] {
  const vals = new Map<string, string[]>();
  for (const n of notes) for (const [k, v] of Object.entries(frontmatter(n.content).data)) vals.set(k, [...(vals.get(k) ?? []), v]);
  return [...vals.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([key, v]) => {
    const type = inferType(v);
    return { key, type, choices: type === "choice" ? [...new Set(v.map((x) => x.trim()).filter(Boolean))].sort() : [] };
  });
}
/** Set (or with an empty value, remove) one front matter property, keeping the rest in order. */
export function setProperty(content: string, key: string, value: string): string {
  const { data } = frontmatter(content);
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) if (k !== key) next[k] = v; else if (value.trim()) next[k] = value.trim();
  if (!(key in data) && value.trim()) next[key] = value.trim();
  return Object.keys(next).length ? setFrontmatter(content, next) : frontmatter(content).body;
}

// ------------------------------------------------------------ periodic notes

export type Period = "week" | "month" | "quarter";
/** ISO week number and its year (weeks start on Monday; week 1 holds the first Thursday). */
export function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil(((t.getTime() - y0.getTime()) / DAY + 1) / 7) };
}
const pad = (n: number) => String(n).padStart(2, "0");
export function periodName(kind: Period, d: Date): string {
  if (kind === "week") { const w = isoWeek(d); return `${w.year}-W${pad(w.week)}`; }
  if (kind === "month") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}
export const periodPath = (kind: Period, d: Date) => `Periodic/${periodName(kind, d)}.md`;
/** [start, end) of the period holding `d`, local time. */
export function periodRange(kind: Period, d: Date): [Date, Date] {
  if (kind === "week") { const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); return [s, new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7)]; }
  if (kind === "month") return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1)];
  const q = Math.floor(d.getMonth() / 3) * 3;
  return [new Date(d.getFullYear(), q, 1), new Date(d.getFullYear(), q + 3, 1)];
}
/** The rollup of a period: notes made and changed, tasks done and still open, decisions, and the periods below it. */
export function periodRollup(kind: Period, d: Date, notes: OrgNote[]): string {
  const [s, e] = periodRange(kind, d);
  const inP = (t: number) => t >= s.getTime() && t < e.getTime();
  const own = (p: string) => p.startsWith("Periodic/") || p.startsWith("Agents/");
  const md = notes.filter((n) => n.path.endsWith(".md") && !own(n.path));
  const created = md.filter((n) => inP(ms(n.created)));
  const changed = md.filter((n) => inP(ms(n.modified)) && !created.includes(n));
  const link = (n: OrgNote) => `- [[${stem(n.path)}]]`;
  const tasks: { done: boolean; text: string; path: string }[] = [];
  const decisions: { text: string; path: string }[] = [];
  for (const n of [...created, ...changed]) for (const line of n.content.split("\n")) {
    const t = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (t) tasks.push({ done: t[1] !== " ", text: t[2].trim(), path: n.path });
    const dm = /^(?:\s*[-*+]\s+)?Decision::\s*(.+)$/i.exec(line);
    if (dm) decisions.push({ text: dm[1].trim(), path: n.path });
  }
  const kids = kind === "quarter" ? [0, 1, 2].map((i) => `- [[Periodic/${periodName("month", new Date(s.getFullYear(), s.getMonth() + i, 1))}]]`) : kind === "month" ? (() => { const out: string[] = []; for (let t = new Date(s); t < e; t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 7)) { const nm = `- [[Periodic/${periodName("week", t)}]]`; if (!out.includes(nm)) out.push(nm); } return out; })() : [];
  const sec = (h: string, lines: string[], empty: string) => `## ${h}\n\n${lines.length ? lines.join("\n") : `_${empty}_`}\n`;
  const label = kind === "week" ? `Week ${periodName(kind, d)}` : kind === "month" ? s.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : periodName(kind, d).replace("-", " ");
  return [`---\ntype: periodic\nperiod: ${kind}\nstart: ${s.toISOString().slice(0, 10)}\n---\n# ${label}\n`,
    ...(kids.length ? [sec(kind === "quarter" ? "Months" : "Weeks", kids, "")] : []),
    sec("Created", created.map(link), "No new notes."),
    sec("Updated", changed.map(link), "Nothing else changed."),
    sec("Done", tasks.filter((t) => t.done).map((t) => `- [x] ${t.text} ([[${stem(t.path)}]])`), "No tasks finished."),
    sec("Still open", tasks.filter((t) => !t.done).map((t) => `- [ ] ${t.text} ([[${stem(t.path)}]])`), "Nothing open."),
    sec("Decisions", decisions.map((x) => `- ${x.text} ([[${stem(x.path)}]])`), "No decisions recorded."),
    "## Reflection\n\n- \n"].join("\n");
}

// ------------------------------------------------------------ structure lint

export type Issue = { kind: "orphan" | "broken" | "duplicate" | "empty-folder" | "stale-project"; path: string; detail: string; target?: string };
/** What is untidy: orphans, broken links, duplicate titles, empty folders, active projects nobody touched in 30 days. */
export function lint(notes: OrgNote[], idx: Index, folders: string[], now = Date.now()): Issue[] {
  const out: Issue[] = [];
  const md = notes.filter((n) => n.path.endsWith(".md"));
  const skip = (p: string) => p === "index.md" || p.startsWith("Periodic/") || p.startsWith("Agents/") || p.startsWith("Templates/") || p.startsWith("Archive/");
  for (const n of md) {
    if (skip(n.path)) continue;
    if (!(idx.links.get(n.path)?.size) && !(idx.backlinks.get(n.path)?.size)) out.push({ kind: "orphan", path: n.path, detail: "nothing links here and it links nowhere" });
  }
  for (const n of md) for (const t of idx.unresolved.get(n.path) ?? []) out.push({ kind: "broken", path: n.path, detail: `links to [[${t}]], which does not exist`, target: t });
  const byName = new Map<string, string[]>();
  for (const n of md) byName.set(base(n.path).toLowerCase(), [...(byName.get(base(n.path).toLowerCase()) ?? []), n.path]);
  for (const ps of byName.values()) if (ps.length > 1) for (const p of ps) out.push({ kind: "duplicate", path: p, detail: `same title as ${ps.filter((x) => x !== p).join(", ")}` });
  const used = new Set(notes.flatMap((n) => { const parts = n.path.split("/"); return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/")); }));
  for (const f of folders) if (!used.has(f) && f !== "Agents" && !f.startsWith("Agents/")) out.push({ kind: "empty-folder", path: f, detail: "no notes inside" });
  for (const n of md) {
    const { data } = frontmatter(n.content);
    if ((data.type ?? "").toLowerCase() === "project" && (data.status ?? "active").toLowerCase() === "active" && ms(n.modified) && now - ms(n.modified) > 30 * DAY) out.push({ kind: "stale-project", path: n.path, detail: `active but untouched for ${Math.floor((now - ms(n.modified)) / DAY)} days` });
  }
  return out;
}

// ------------------------------------------------------------ bulk refactors

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
/** Rename a tag in the body (`#old`, `#old/child`) and in front matter `tags:`. */
export function renameTag(content: string, from: string, to: string): string {
  const f = from.replace(/^#/, ""), t = to.replace(/^#/, "");
  const { data, body } = frontmatter(content);
  const nb = body.replace(new RegExp(`(^|[\\s(])#${reEsc(f)}(?=$|[\\s/.,;:!?)])`, "gm"), `$1#${t}`);
  const key = "tags" in data ? "tags" : "tag" in data ? "tag" : undefined;
  if (!key) return content.slice(0, content.length - body.length) + nb;
  const v = data[key].replace(new RegExp(`(^|[\\[,\\s#])${reEsc(f)}(?=$|[\\],\\s/])`, "g"), `$1${t}`);
  return setFrontmatter(nb === body ? content : content.slice(0, content.length - body.length) + nb, { ...data, [key]: v });
}
/** Rename a front matter key, keeping its value and position. */
export function renameProperty(content: string, from: string, to: string): string {
  const { data } = frontmatter(content);
  if (!(from in data) || !to.trim()) return content;
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) next[k === from ? to.trim() : k] = v;
  return setFrontmatter(content, next);
}
/** Split a note at its `## ` headings: the intro stays, each section becomes its own note. */
export function splitAtHeadings(content: string): { intro: string; parts: { title: string; body: string }[] } {
  const { body } = frontmatter(content);
  const fmText = content.slice(0, content.length - body.length);
  const chunks = body.split(/^(?=## )/m);
  const intro = chunks[0].startsWith("## ") ? "" : chunks.shift()!;
  const parts = chunks.map((c) => { const nl = c.indexOf("\n"); const title = (nl < 0 ? c : c.slice(0, nl)).replace(/^##\s+/, "").replace(/[\\/:*?"<>|#^[\]]/g, " ").trim(); return { title, body: `# ${title}\n${nl < 0 ? "" : c.slice(nl + 1)}`.trimEnd() + "\n" }; }).filter((p) => p.title);
  return { intro: fmText + intro.trimEnd() + "\n", parts };
}
/** Point every `[[from]]` / `[[from|alias]]` / `[[from#h]]` link at `to` instead. */
export function retarget(content: string, from: string, to: string): string {
  const names = [stem(from), base(from)].filter((v, i, a) => a.indexOf(v) === i).map(reEsc).join("|");
  return content.replace(new RegExp(`(!?\\[\\[)(?:${names})(?=[#|\\]])`, "gi"), `$1${stem(to)}`);
}

// ------------------------------------------------------------ resurfacing and decay

export type Resurface = Record<string, { due: number; interval: number }>;
/** The next old note worth rereading: scheduled ones when due, otherwise the longest untouched. */
export function nextToResurface(notes: OrgNote[], sched: Resurface, now = Date.now(), minAgeDays = 30): OrgNote | undefined {
  const own = (p: string) => p.startsWith("Periodic/") || p.startsWith("Agents/") || p.startsWith("Templates/") || p === "index.md";
  const pool = notes.filter((n) => n.path.endsWith(".md") && !own(n.path) && now - ms(n.modified) > minAgeDays * DAY && (sched[n.path]?.due ?? 0) <= now);
  return pool.sort((a, b) => (sched[a.path]?.due ?? 0) - (sched[b.path]?.due ?? 0) || ms(a.modified) - ms(b.modified))[0];
}
/** "Keep": see it again later, twice as late each time (a week at first). */
export const keepLater = (s: Resurface, path: string, now = Date.now()): Resurface => { const iv = Math.max(7, (s[path]?.interval ?? 3.5) * 2); return { ...s, [path]: { due: now + iv * DAY, interval: iv } }; };
/** A note fades when nobody touched it for `days` (0 turns decay off), unless pinned; anything in Archive/ is faded. */
export function isFaded(n: OrgNote, days: number, pinned: Set<string>, now = Date.now()): boolean {
  if (pinned.has(n.path) || /^(true|yes)$/i.test(frontmatter(n.content).data.pinned ?? "")) return false;
  if (n.path.startsWith("Archive/")) return true;
  if (!days || n.path === "index.md" || n.path.startsWith("Periodic/")) return false;
  const t = ms(n.modified);
  return t > 0 && now - t > days * DAY;
}

// ------------------------------------------------------------ rules (run in the browser when a note is saved)

export type Rule = { id: string; tag: string; template?: string; folder?: string; weekly?: boolean };
/** What a rule does to a note that just got its tag: the template under the front matter (once), a move, a link from the week. */
export function applyRule(rule: Rule, path: string, content: string, templateText?: string): { content: string; move?: string; weekly?: boolean; applied: boolean } {
  const tags = parseTags(content).map((t) => t.toLowerCase());
  const marker = `rule-${rule.id}`;
  const { data, body } = frontmatter(content);
  if (!tags.includes(rule.tag.replace(/^#/, "").toLowerCase()) || data[marker]) return { content, applied: false };
  let next = content;
  if (templateText) {
    const t = frontmatter(templateText);
    const merged = { ...t.data, ...data };
    next = setFrontmatter(`${body.trimEnd()}\n\n${t.body.trim()}\n`, merged);
  }
  next = setProperty(next, marker, new Date().toISOString().slice(0, 10));
  const move = rule.folder && dir(path) !== rule.folder.replace(/\/$/, "") ? `${rule.folder.replace(/\/$/, "")}/${path.split("/").pop()}` : undefined;
  return { content: next, move, weekly: rule.weekly, applied: true };
}
