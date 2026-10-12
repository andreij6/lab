// Kits for particular kinds of work: research (sources, citations, claims, a thesis), writing
// (manuscript, story bible, continuity, timeline), care (a symptom and medication log, questions
// for appointments) and software (ADRs, runbooks, changelogs). Pure; the UI lives in main.ts.
import { base, frontmatter, stem, type NoteLike } from "./notes.ts";
import { serializeWorkbook } from "./sheet.ts";

// ------------------------------------------------------------ research: sources and citations

export type Person = { family: string; given: string };
export type Source = { key: string; type: string; title: string; authors: Person[]; year: string; journal?: string; booktitle?: string; publisher?: string; volume?: string; number?: string; pages?: string; doi?: string; url?: string };

function person(s: string): Person {
  const t = s.replace(/[{}]/g, "").trim();
  if (t.includes(",")) { const [family, given] = t.split(/\s*,\s*/, 2); return { family, given: given ?? "" }; }
  const parts = t.split(/\s+/);
  return { family: parts.pop() ?? t, given: parts.join(" ") };
}
const clean = (s?: string) => s?.replace(/[{}]/g, "").replace(/\s+/g, " ").trim() || undefined;
/** Entries of a BibTeX file. Handles `{…}` and `"…"` values, nested braces and `and`-separated authors. */
export function parseBibtex(text: string): Source[] {
  const out: Source[] = [];
  const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (/^(comment|string|preamble)$/i.test(m[1])) continue;
    let i = re.lastIndex, depth = 1;
    const start = i;
    for (; i < text.length && depth > 0; i++) { if (text[i] === "{") depth++; else if (text[i] === "}") depth--; }
    const body = text.slice(start, i - 1);
    const fields: Record<string, string> = {};
    const fre = /(\w+)\s*=\s*/g;
    let f: RegExpExecArray | null;
    while ((f = fre.exec(body))) {
      let j = fre.lastIndex, v = "";
      if (body[j] === "{") { let d = 0; const s = j; for (; j < body.length; j++) { if (body[j] === "{") d++; else if (body[j] === "}") { d--; if (d === 0) break; } } v = body.slice(s + 1, j); j++; }
      else if (body[j] === '"') { const e = body.indexOf('"', j + 1); v = body.slice(j + 1, e); j = e + 1; }
      else { const e = body.slice(j).search(/[,\n}]/); v = body.slice(j, e < 0 ? undefined : j + e).trim(); j += e < 0 ? body.length : e; }
      fields[f[1].toLowerCase()] = v;
      fre.lastIndex = j;
    }
    out.push({ key: m[2], type: m[1].toLowerCase(), title: clean(fields.title) ?? m[2], authors: (fields.author ?? fields.editor ?? "").split(/\s+and\s+/i).map((a) => a.trim()).filter(Boolean).map(person), year: clean(fields.year) ?? (clean(fields.date)?.slice(0, 4) ?? "n.d."), journal: clean(fields.journal ?? fields.journaltitle), booktitle: clean(fields.booktitle), publisher: clean(fields.publisher), volume: clean(fields.volume), number: clean(fields.number ?? fields.issue), pages: clean(fields.pages)?.replace(/--/g, "–"), doi: clean(fields.doi), url: clean(fields.url) });
  }
  return out;
}
/** A Crossref `message` (https://api.crossref.org/works/{doi}) as a source. */
export function fromCrossref(m: Record<string, unknown>): Source {
  const a = (m.author as { family?: string; given?: string }[] | undefined) ?? [];
  const yr = ((m.issued as { "date-parts"?: number[][] } | undefined)?.["date-parts"]?.[0]?.[0] ?? "n.d.").toString();
  const first = a[0]?.family ?? "anon";
  const t = (m.title as string[] | undefined)?.[0] ?? "Untitled";
  return { key: `${first.toLowerCase().replace(/[^a-z]/g, "")}${yr}${t.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "")}`, type: m.type === "book" ? "book" : "article", title: t, authors: a.map((p) => ({ family: p.family ?? "", given: p.given ?? "" })), year: yr, journal: (m["container-title"] as string[] | undefined)?.[0], publisher: m.publisher as string | undefined, volume: m.volume as string | undefined, number: m.issue as string | undefined, pages: (m.page as string | undefined)?.replace(/-/g, "–"), doi: m.DOI as string | undefined };
}
/** A source note: citation data in front matter, plus the literature-matrix fields to fill in. */
export function sourceNote(s: Source): string {
  const q = (v?: string) => (v === undefined ? "" : /[:#\[\]]/.test(v) ? JSON.stringify(v) : v);
  const lines = [`type: source`, `citekey: ${s.key}`, `title: ${q(s.title)}`, `authors: ${q(s.authors.map((a) => `${a.family}, ${a.given}`.replace(/, $/, "")).join("; "))}`, `year: ${s.year}`, s.journal ? `journal: ${q(s.journal)}` : "", s.booktitle ? `booktitle: ${q(s.booktitle)}` : "", s.publisher ? `publisher: ${q(s.publisher)}` : "", s.volume ? `volume: ${s.volume}` : "", s.number ? `number: ${s.number}` : "", s.pages ? `pages: ${s.pages}` : "", s.doi ? `doi: ${s.doi}` : "", `kind: ${s.type}`, "method: ", "sample: ", "finding: ", "limitation: ", "strength: "].filter(Boolean);
  return `---\n${lines.join("\n")}\n---\n# ${s.title}\n\n${citeIn(s, "apa")} · cite as \`[@${s.key}]\`\n\n## Summary\n\n\n## Quotes\n\n> \n\n## Notes\n\n`;
}
/** A source read back from a source note's front matter. */
export function sourceFromNote(content: string): Source | undefined {
  const d = frontmatter(content).data;
  if ((d.type ?? "") !== "source" || !d.citekey) return undefined;
  const un = (v?: string) => v?.replace(/^"(.*)"$/, "$1");
  return { key: d.citekey, type: d.kind ?? "article", title: un(d.title) ?? d.citekey, authors: (un(d.authors) ?? "").split(/\s*;\s*/).filter(Boolean).map(person), year: d.year ?? "n.d.", journal: un(d.journal), booktitle: un(d.booktitle), publisher: un(d.publisher), volume: d.volume, number: d.number, pages: d.pages, doi: d.doi };
}
export type Style = "apa" | "chicago";
const initials = (g: string) => g.split(/[\s-]+/).filter(Boolean).map((p) => `${p[0].toUpperCase()}.`).join(" ");
/** In-text citation: (Smith & Lee, 2020) / (Smith et al., 2020); Chicago: (Smith and Lee 2020). */
export function citeIn(s: Source, style: Style, loc?: string): string {
  const fam = s.authors.map((a) => a.family);
  const names = fam.length === 0 ? s.title.split(" ").slice(0, 3).join(" ") : fam.length === 1 ? fam[0] : fam.length === 2 ? `${fam[0]} ${style === "apa" ? "&" : "and"} ${fam[1]}` : `${fam[0]} et al.`;
  return style === "apa" ? `(${names}, ${s.year}${loc ? `, ${loc}` : ""})` : `(${names} ${s.year}${loc ? `, ${loc}` : ""})`;
}
/** Reference-list entry, in Markdown (italics with `*`). */
export function reference(s: Source, style: Style): string {
  const doi = s.doi ? ` https://doi.org/${s.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}` : s.url ? ` ${s.url}` : "";
  const container = s.journal ?? s.booktitle;
  if (style === "apa") {
    const au = s.authors.map((a) => `${a.family}${a.given ? `, ${initials(a.given)}` : ""}`);
    const who = au.length <= 1 ? au.join("") : au.length <= 20 ? `${au.slice(0, -1).join(", ")}, & ${au[au.length - 1]}` : `${au.slice(0, 19).join(", ")}, … ${au[au.length - 1]}`;
    if (container) return `${who} (${s.year}). ${s.title}. *${container}*${s.volume ? `, *${s.volume}*` : ""}${s.number ? `(${s.number})` : ""}${s.pages ? `, ${s.pages}` : ""}.${doi}`;
    return `${who} (${s.year}). *${s.title}*.${s.publisher ? ` ${s.publisher}.` : ""}${doi}`;
  }
  const au = s.authors.map((a, i) => (i === 0 ? `${a.family}${a.given ? `, ${a.given}` : ""}` : `${a.given ? `${a.given} ` : ""}${a.family}`));
  const who = au.length <= 1 ? au.join("") : `${au.slice(0, -1).join(", ")}, and ${au[au.length - 1]}`;
  if (container) return `${who}. ${s.year}. “${s.title}.” *${container}*${s.volume ? ` ${s.volume}` : ""}${s.number ? ` (${s.number})` : ""}${s.pages ? `: ${s.pages}` : ""}.${doi}`;
  return `${who}. ${s.year}. *${s.title}*.${s.publisher ? ` ${s.publisher}.` : ""}${doi}`;
}
export const CITE_KEY = /\[@([\w:.-]+)(?:,\s*([^\]]+))?\]/g;
/** The cited keys of some text, in first-use order. */
export const citedKeys = (text: string): string[] => [...new Set([...text.matchAll(CITE_KEY)].map((m) => m[1]))];
/** A reference list for the cited keys (alphabetical by first author), with the keys no source has. */
export function bibliography(text: string, sources: Source[], style: Style): { md: string; missing: string[] } {
  const byKey = new Map(sources.map((s) => [s.key, s]));
  const keys = citedKeys(text);
  const found = keys.map((k) => byKey.get(k)).filter((s): s is Source => !!s);
  found.sort((a, b) => (a.authors[0]?.family ?? a.title).localeCompare(b.authors[0]?.family ?? b.title) || a.year.localeCompare(b.year));
  return { md: found.map((s) => reference(s, style)).join("\n\n"), missing: keys.filter((k) => !byKey.has(k)) };
}

// ------------------------------------------------------------ research: claims and the thesis

export type Claim = { line: number; text: string; status: "supported" | "weak" | "missing"; evidence: string[] };
/** Lines marked `Claim::` and how well they are backed: by a source citation or a linked note; weak when every source is marked `strength: weak`. */
export function claims(content: string, sources: Source[], strengthOf: (key: string) => string | undefined): Claim[] {
  const keys = new Set(sources.map((s) => s.key));
  const out: Claim[] = [];
  content.split("\n").forEach((raw, i) => {
    const m = /^(?:\s*[-*+]\s+)?Claim::\s*(.+)$/i.exec(raw);
    if (!m) return;
    const cites = citedKeys(m[1]);
    const links = [...m[1].matchAll(/\[\[([^\]|#]+)/g)].map((x) => x[1].trim());
    const real = cites.filter((k) => keys.has(k));
    const evidence = [...real.map((k) => `@${k}`), ...links];
    const status = !evidence.length ? "missing" : real.length && real.every((k) => /^weak$/i.test(strengthOf(k) ?? "")) && !links.length ? "weak" : "supported";
    out.push({ line: i, text: m[1].trim(), status, evidence });
  });
  return out;
}
/** A thesis note lists its chapters as `1. [[Chapter]]`; compiling joins them, numbers figures and appends the references. */
export function compileThesis(thesis: string, chapter: (target: string) => string | undefined, sources: Source[], style: Style): { md: string; missing: string[]; figures: number } {
  const { data, body } = frontmatter(thesis);
  const targets = [...body.matchAll(/^\s*\d+\.\s+\[\[([^\]|#]+)/gm)].map((m) => m[1].trim());
  const missing: string[] = [];
  let fig = 0;
  const byKey = new Map(sources.map((s) => [s.key, s]));
  const parts = targets.map((t) => {
    const c = chapter(t);
    if (c === undefined) { missing.push(t); return ""; }
    return frontmatter(c).body.replace(/!\[([^\]]+)\]\(([^)]+)\)/g, (_m, alt: string, src: string) => `![${alt}](${src})\n\n*Figure ${++fig}. ${alt}*`).replace(CITE_KEY, (m, k: string, loc?: string) => { const s = byKey.get(k); return s ? citeIn(s, style, loc) : m; }).trim();
  }).filter(Boolean);
  const all = parts.join("\n\n");
  const refs = bibliography(targets.map((t) => chapter(t) ?? "").join("\n"), sources, style);
  const title = data.title ?? (/^#\s+(.+)$/m.exec(body)?.[1] ?? "Thesis");
  return { md: `# ${title}\n\n${data.author ? `${data.author}\n\n` : ""}${all}\n\n## References\n\n${refs.md}\n`, missing: [...missing, ...refs.missing.map((k) => `@${k}`)], figures: fig };
}

// ------------------------------------------------------------ writing

export const words = (text: string): number => (frontmatter(text).body.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`[\]()-]/g, " ").match(/\b[\p{L}\p{N}']+\b/gu) ?? []).length;
export type Scene = { path: string; title: string; chapter: string; order: number; words: number; pov?: string; date?: string };
/** Scenes (`type: scene`) grouped by `chapter:` in `order:`. */
export function manuscript(notes: NoteLike[]): { chapter: string; scenes: Scene[]; words: number }[] {
  const scenes: Scene[] = notes.filter((n) => n.path.endsWith(".md") && (frontmatter(n.content).data.type ?? "") === "scene").map((n) => { const d = frontmatter(n.content).data; return { path: n.path, title: base(n.path), chapter: d.chapter || "Unsorted", order: Number(d.order) || 9999, words: words(n.content), pov: d.pov, date: d.date }; });
  const chapters = new Map<string, Scene[]>();
  for (const s of scenes) chapters.set(s.chapter, [...(chapters.get(s.chapter) ?? []), s]);
  const num = (c: string) => Number(/\d+/.exec(c)?.[0] ?? 1e9);
  return [...chapters.entries()].sort((a, b) => Math.min(...a[1].map((s) => s.order)) - Math.min(...b[1].map((s) => s.order)) || num(a[0]) - num(b[0]) || a[0].localeCompare(b[0])).map(([chapter, ss]) => ({ chapter, scenes: ss.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)), words: ss.reduce((t, s) => t + s.words, 0) }));
}
const COLORS = ["black", "blue", "brown", "green", "grey", "gray", "hazel", "amber", "red", "auburn", "blonde", "blond", "white", "silver", "violet"];
export type Continuity = { scene: string; entity: string; property: string; expected: string; found: string; excerpt: string };
/** Story-bible facts (`eyes`, `hair`, `age`) checked against how scenes describe the character. */
export function continuity(bible: NoteLike[], scenes: NoteLike[]): Continuity[] {
  const out: Continuity[] = [];
  for (const b of bible) {
    const d = frontmatter(b.content).data;
    const name = base(b.path);
    const first = name.split(/\s+/)[0];
    const names = [...new Set([name, first])].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    for (const s of scenes) {
      const text = frontmatter(s.content).body;
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        if (!new RegExp(`\\b(${names})\\b`).test(sentence)) continue;
        for (const prop of ["eyes", "hair"] as const) {
          const want = (d[prop] ?? d[`${prop === "eyes" ? "eye" : "hair"}_color`] ?? "").toLowerCase();
          if (!want) continue;
          const m = new RegExp(`\\b(${COLORS.join("|")})\\b[\\s,-]*(?:\\w+\\s+)?${prop === "eyes" ? "eyes?" : "hair"}\\b`, "i").exec(sentence);
          if (m && !want.includes(m[1].toLowerCase()) && !(m[1].toLowerCase() === "gray" && want.includes("grey")) && !(m[1].toLowerCase() === "grey" && want.includes("gray"))) out.push({ scene: s.path, entity: name, property: prop, expected: want, found: m[1].toLowerCase(), excerpt: sentence.trim().slice(0, 160) });
        }
        if (d.age) {
          const m = new RegExp(`\\b(?:(\\d{1,3})-year-old\\s+(?:${names})|(?:${names}),?\\s+(?:aged\\s+)?(\\d{1,3})\\b(?!\\s*(?:km|miles|years ago|%)))`).exec(sentence);
          const found = m?.[1] ?? m?.[2];
          if (found && found !== d.age.trim() && !frontmatter(s.content).data.date) out.push({ scene: s.path, entity: name, property: "age", expected: d.age.trim(), found, excerpt: sentence.trim().slice(0, 160) });
        }
      }
    }
  }
  return out;
}
export type TimelineEvent = { path: string; date: string; text: string; sort: number[] };
/** Events from `date:` front matter and inline `date:: …` lines; any calendar sorts by the numbers in it ("Year 1203, day 45"). */
export function timeline(notes: NoteLike[]): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  const key = (d: string) => (d.match(/-?\d+/g) ?? []).map(Number);
  for (const n of notes) {
    if (!n.path.endsWith(".md")) continue;
    const { data, body } = frontmatter(n.content);
    if (data.date && /scene|event|chapter/i.test(data.type ?? "")) out.push({ path: n.path, date: data.date, text: base(n.path), sort: key(data.date) });
    for (const line of body.split("\n")) {
      const m = /^(?:\s*[-*+]\s+)?(.*?)\s*\bdate::\s*([^|]+?)\s*$/i.exec(line);
      if (m && m[2]) out.push({ path: n.path, date: m[2], text: m[1].replace(/[-*+]\s*$/, "").trim() || base(n.path), sort: key(m[2]) });
    }
  }
  const cmp = (a: number[], b: number[]) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? -Infinity) - (b[i] ?? -Infinity); if (d) return d; } return 0; };
  return out.sort((a, b) => cmp(a.sort, b.sort) || a.date.localeCompare(b.date));
}

// ------------------------------------------------------------ care (personal notes, not records or advice)

/** A log of doses and symptoms with daily averages and a chart. */
export function careWorkbook(): string {
  const today = new Date().toISOString().slice(0, 10);
  const log = [["Date", "Time", "Kind", "Name", "Dose", "Severity (0-10)", "Notes"], [today, "08:00", "dose", "Example medicine", "1 tablet", "", ""], [today, "14:00", "symptom", "Headache", "", "3", "after lunch"]];
  const days = [["Date", "Average severity", "Entries"], ...Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10); const r = i + 2; return [d, `=IFERROR(AVERAGEIF(Log!$A$2:$A$2000, A${r}, Log!$F$2:$F$2000), "")`, `=COUNTIF(Log!$A$2:$A$2000, A${r})`]; })];
  return serializeWorkbook({ sheets: [{ name: "Log", rows: log, charts: [] }, { name: "Days", rows: days, charts: [{ id: "sev", type: "line", title: "Average severity", labels: "A", values: ["B"], palette: "warm", legend: "none" }] }] });
}
/** Questions noted as `Q::` or `Ask::` lines since a date, with where they came from. */
export function careQuestions(notes: (NoteLike & { modified?: bigint | number })[], sinceMs = 0): { q: string; path: string }[] {
  const ms = (t?: bigint | number) => (t === undefined ? 0 : typeof t === "bigint" ? Number(t / 1_000_000n) : t);
  const out: { q: string; path: string }[] = [];
  for (const n of notes) {
    if (!n.path.endsWith(".md") || ms(n.modified) < sinceMs) continue;
    for (const line of n.content.split("\n")) { const m = /^(?:\s*[-*+]\s+(?:\[[ xX]\]\s+)?)?(?:Q|Ask)::\s*(.+)$/i.exec(line); if (m) out.push({ q: m[1].trim(), path: n.path }); }
  }
  return out;
}
/** A one-page summary for an appointment: recent log rows grouped by name, plus the questions. */
export function careSummary(rows: (string | number | boolean | null)[][], questions: { q: string; path: string }[], days = 30, now = Date.now()): string {
  const since = new Date(now - days * 86_400_000).toISOString().slice(0, 10);
  const recent = rows.slice(1).filter((r) => typeof r[0] === "string" && (r[0] as string) >= since);
  const doses = new Map<string, number>(), sym = new Map<string, number[]>();
  for (const r of recent) {
    const name = String(r[3] ?? "").trim();
    if (!name) continue;
    if (String(r[2]).toLowerCase() === "dose") doses.set(name, (doses.get(name) ?? 0) + 1);
    else { const v = Number(r[5]); if (!Number.isNaN(v) && r[5] !== "" && r[5] !== null) sym.set(name, [...(sym.get(name) ?? []), v]); }
  }
  const avg = (v: number[]) => (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1);
  return `---\ntype: care-summary\ndate: ${new Date(now).toISOString().slice(0, 10)}\n---\n# Summary for the appointment\n\n> Personal notes for a conversation with a clinician; not a medical record and not advice.\n\nLast ${days} days, from ${since}.\n\n## Medicines taken\n\n${[...doses].map(([n, c]) => `- ${n}: ${c} dose${c === 1 ? "" : "s"} logged`).join("\n") || "- none logged"}\n\n## Symptoms\n\n${[...sym].map(([n, v]) => `- ${n}: ${v.length} time${v.length === 1 ? "" : "s"}, average severity ${avg(v)}/10, worst ${Math.max(...v)}/10`).join("\n") || "- none logged"}\n\n## Questions to ask\n\n${questions.map((x) => `- [ ] ${x.q} ([[${stem(x.path)}]])`).join("\n") || "- "}\n\n## Answers and next steps\n\n- \n`;
}

// ------------------------------------------------------------ software

export const ADR_STATUSES = ["proposed", "accepted", "superseded", "deprecated", "rejected"];
/** The next `ADR-0007` number among existing ADR notes. */
export function nextAdr(paths: string[]): string {
  const n = Math.max(0, ...paths.map((p) => Number(/ADR-(\d+)/i.exec(base(p))?.[1] ?? 0)));
  return `ADR-${String(n + 1).padStart(4, "0")}`;
}
export const adrTemplate = (id: string, title: string, supersedes?: string) => `---\ntype: adr\nstatus: proposed\ndate: ${new Date().toISOString().slice(0, 10)}${supersedes ? `\nsupersedes: [[${supersedes}]]` : ""}\n---\n# ${id} ${title}\n\n## Context\n\nWhat forces are at play.\n\n## Decision\n\nDecision:: \n\n## Consequences\n\n- \n\n## Alternatives considered\n\n- \n`;
export const RUNBOOK_TEMPLATE = "---\ntype: runbook\nservice: \nowner: \nlast_reviewed: {{date}}\n---\n# {{title}}\n\n## When to use this\n\n\n## Check\n\n```bash\n# see what is wrong\n```\n\n## Fix\n\n```bash\n# make it right\n```\n\n## Verify\n\n```bash\n# prove it is right\n```\n\n## Escalate\n\n- \n";
export type Change = { version: string; date: string; kind: string; text: string; path: string };
/** Notes tagged `#changelog` (or `type: change`) with `version:`, `date:` and `kind:` front matter, as a Keep a Changelog page. */
export function changelog(notes: NoteLike[]): { md: string; changes: Change[] } {
  const changes: Change[] = [];
  for (const n of notes) {
    if (!n.path.endsWith(".md")) continue;
    const { data, body } = frontmatter(n.content);
    if (!(/(^|\s)#changelog\b/.test(n.content) || (data.type ?? "") === "change")) continue;
    const text = (/^#\s+(.+)$/m.exec(body)?.[1] ?? base(n.path)).replace(/\s*#changelog\b/g, "").trim();
    changes.push({ version: data.version || "Unreleased", date: data.date ?? "", kind: (data.kind || "Changed").replace(/^\w/, (c) => c.toUpperCase()), text, path: n.path });
  }
  const vkey = (v: string) => (v === "Unreleased" ? [Infinity] : v.replace(/^v/, "").split(/[.-]/).map((x) => Number(x) || 0));
  const vs = [...new Set(changes.map((c) => c.version))].sort((a, b) => { const x = vkey(a), y = vkey(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (y[i] ?? 0) - (x[i] ?? 0); if (d) return d; } return 0; });
  const order = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"];
  const md = `# Changelog\n\nAll notable changes, newest first.\n\n${vs.map((v) => { const cs = changes.filter((c) => c.version === v); const date = cs.map((c) => c.date).filter(Boolean).sort().pop(); const kinds = [...new Set(cs.map((c) => c.kind))].sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99); return `## ${v}${date ? ` – ${date}` : ""}\n\n${kinds.map((k) => `### ${k}\n\n${cs.filter((c) => c.kind === k).map((c) => `- ${c.text}`).join("\n")}`).join("\n\n")}`; }).join("\n\n")}\n`;
  return { md, changes };
}
