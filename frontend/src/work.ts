// Work helpers, pure: tasks across notes (Obsidian Tasks style dates and @owners), meeting notes,
// decision and people indexes, calendar import, the weekly review, a follow-up summary, DOCX
// export, spreadsheet paste, table sorting and reminders.
import { frontmatter, headings, section, type NoteLike } from "./notes.ts";
import { dayKey } from "./activity.ts";
import { zip } from "./zip.ts";

// ---- tasks

export type Task = { path: string; line: number; text: string; done: boolean; due?: string; owner?: string; priority: number };
const DUE_RE = /(?:📅|⏳|due::?)\s*(\d{4}-\d{2}-\d{2})/;
const OWNER_RE = /(?:^|\s)@([A-Za-z][\w.-]*)/;
/** Every `- [ ]` / `- [x]` line outside code blocks, with its date, owner and priority (⏫ 2, 🔼 1). */
export function parseTasks(notes: NoteLike[]): Task[] {
  const out: Task[] = [];
  for (const n of notes) {
    if (!n.path.endsWith(".md")) continue;
    let code = false;
    n.content.split("\n").forEach((raw, i) => {
      if (/^\s*```/.test(raw)) { code = !code; return; }
      if (code) return;
      const m = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(raw);
      if (!m) return;
      const text = m[2].trim();
      out.push({ path: n.path, line: i, text, done: m[1].toLowerCase() === "x", due: DUE_RE.exec(text)?.[1], owner: OWNER_RE.exec(text)?.[1], priority: /⏫/.test(text) ? 2 : /🔼/.test(text) ? 1 : 0 });
    });
  }
  return out;
}
/** `date` moved on by a period like "month", "3 months", "2 weeks", "1 year" or "90 days". */
export function addPeriod(date: string, every: string): string {
  const m = /^\s*(\d+)?\s*(day|week|month|quarter|year)s?\s*$/i.exec(every.replace(/^every\s+/i, ""));
  const n = Number(m?.[1] ?? 1), unit = (m?.[2] ?? "month").toLowerCase();
  const d = new Date(`${date}T00:00:00Z`);
  if (unit === "day") d.setUTCDate(d.getUTCDate() + n);
  else if (unit === "week") d.setUTCDate(d.getUTCDate() + 7 * n);
  else {
    // months clamp to the month's last day (Jan 31 + 1 month is Feb 28)
    const months = unit === "year" ? 12 * n : unit === "quarter" ? 3 * n : n, day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
    d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  }
  return d.toISOString().slice(0, 10);
}
/** Give the first open task (starting with `label`, when given) a new 📅 date, so a recurring
 *  reminder in Work moves on instead of piling up. Adds the task at the end when there is none. */
export function setDue(content: string, date: string, label = ""): string {
  const re = new RegExp(`^(\\s*[-*+]\\s+\\[ \\]\\s+${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*?)(?:[ \\t]*📅[ \\t]*\\d{4}-\\d{2}-\\d{2})?[ \\t]*$`, "m");
  return re.test(content) ? content.replace(re, `$1 📅 ${date}`) : `${content.trimEnd()}\n\n- [ ] ${label || "Due"} 📅 ${date}\n`;
}
export const isOverdue = (t: Task, today: Date): boolean => !t.done && !!t.due && t.due < dayKey(today);
/** Open tasks: overdue first, then by date, then priority. */
export function sortTasks(ts: Task[], today: Date): Task[] {
  const k = dayKey(today);
  return [...ts].sort((a, b) => Number(isOverdue(b, today)) - Number(isOverdue(a, today)) || (a.due ?? "9999").localeCompare(b.due ?? "9999") || b.priority - a.priority || a.path.localeCompare(b.path) || a.line - b.line).filter((t) => !t.done || t.due === k);
}
/** Flip the checkbox on `line` of `content`. */
export function toggleTaskLine(content: string, line: number): string {
  const lines = content.split("\n");
  lines[line] = lines[line].replace(/^(\s*[-*+]\s+\[)([ xX])(\])/, (_, a, c, b) => `${a}${c === " " ? "x" : " "}${b}`);
  return lines.join("\n");
}

// ---- meetings

export type Meeting = { path: string; title: string; date?: string; attendees: string[]; agenda: string[]; decisions: string[]; actions: string[] };
export const isMeeting = (content: string): boolean => (frontmatter(content).data.type ?? "").trim().toLowerCase() === "meeting";
const items = (sec: string | undefined): string[] => (sec ?? "").split("\n").map((l) => l.trim()).filter((l) => /^[-*+]\s+/.test(l)).map((l) => l.replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, "").trim()).filter(Boolean);
export function parseMeeting(path: string, content: string): Meeting {
  const fm = frontmatter(content);
  const title = headings(content)[0]?.text ?? path.replace(/\.md$/, "").split("/").pop()!;
  return {
    path, title, date: fm.data.date,
    attendees: (fm.data.attendees ?? "").replace(/^\[|\]$/g, "").split(",").map((a) => a.trim().replace(/^@/, "")).filter(Boolean),
    agenda: items(section(content, "Agenda")), decisions: items(section(content, "Decisions")), actions: items(section(content, "Actions") ?? section(content, "Action items")),
  };
}
export const MEETING_TEMPLATE = (title: string, date: string, attendees: string[] = [], agenda: string[] = []) =>
  `---\ntype: meeting\ndate: ${date}\nattendees: [${attendees.join(", ")}]\n---\n# ${title}\n\n## Agenda\n\n${agenda.length ? agenda.map((a) => `- ${a}`).join("\n") : "- "}\n\n## Notes\n\n\n\n## Decisions\n\n- \n\n## Actions\n\n- [ ] @owner task 📅 ${date}\n`;
/** The follow-up: decisions and actions, as plain text for mail or chat. */
export function meetingSummary(m: Meeting): string {
  const acts = m.actions.filter((a) => !/^@owner task/.test(a));
  const decs = m.decisions.filter(Boolean);
  return `${m.title}${m.date ? ` (${m.date})` : ""}${m.attendees.length ? `\nWith: ${m.attendees.join(", ")}` : ""}\n\nDecisions\n${decs.length ? decs.map((d) => `• ${d}`).join("\n") : "• none recorded"}\n\nActions\n${acts.length ? acts.map((a) => `• ${a}`).join("\n") : "• none"}\n`;
}
/** Action items as kanban card lines: `- [ ] text` (already in that shape). */
export const actionCards = (m: Meeting): string[] => m.actions.filter((a) => !/^@owner task/.test(a)).map((a) => `- [ ] ${a}${/\[\[/.test(a) ? "" : ` (from [[${m.title}]])`}`);

// ---- calendar (.ics)

export type Event = { summary: string; start: string; attendees: string[]; description: string };
/** VEVENTs of an iCalendar file: summary, start day, attendee names or mails, description. */
export function parseIcs(ics: string): Event[] {
  const text = ics.replace(/\r?\n[ \t]/g, ""); // unfold
  const out: Event[] = [];
  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const get = (k: string) => new RegExp(`^${k}[^:\\n]*:(.*)$`, "m").exec(body)?.[1]?.trim() ?? "";
    const dt = get("DTSTART").replace(/^(\d{4})(\d{2})(\d{2}).*$/, "$1-$2-$3");
    const attendees = [...body.matchAll(/^ATTENDEE([^:\n]*):(.*)$/gm)].map((m) => /CN=([^;:]+)/.exec(m[1])?.[1]?.replace(/^"|"$/g, "") ?? m[2].replace(/^mailto:/i, ""));
    out.push({ summary: get("SUMMARY").replace(/\\,/g, ",") || "Meeting", start: dt, attendees, description: get("DESCRIPTION").replace(/\\n/g, "\n").replace(/\\,/g, ",") });
  }
  return out;
}

// ---- decisions and people

export type Decision = { text: string; path: string; date?: string };
/** `Decision:: text` lines anywhere plus the Decisions section of meeting notes. */
export function decisions(notes: NoteLike[]): Decision[] {
  const out: Decision[] = [];
  for (const n of notes) {
    if (!n.path.endsWith(".md")) continue;
    const fm = frontmatter(n.content);
    for (const line of fm.body.split("\n")) {
      const m = /^(?:[-*+]\s+)?Decision::\s*(.+)$/i.exec(line.trim());
      if (m) out.push({ text: m[1].trim(), path: n.path, date: fm.data.date });
    }
    if (isMeeting(n.content)) for (const d of parseMeeting(n.path, n.content).decisions) if (d && !/^Decision::/i.test(d)) out.push({ text: d, path: n.path, date: fm.data.date });
  }
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
export type Person = { name: string; path?: string; role?: string; team?: string; mentions: { path: string; line: string }[] };
/** Person notes (`type: person`) and every `@name` mention, merged by name. */
export function people(notes: NoteLike[]): Person[] {
  const by = new Map<string, Person>();
  const get = (name: string) => { const k = name.toLowerCase(); if (!by.has(k)) by.set(k, { name, mentions: [] }); return by.get(k)!; };
  for (const n of notes) {
    if (!n.path.endsWith(".md")) continue;
    const fm = frontmatter(n.content);
    if ((fm.data.type ?? "").trim().toLowerCase() === "person") {
      const p = get(headings(n.content)[0]?.text ?? n.path.replace(/\.md$/, "").split("/").pop()!);
      p.path = n.path; p.role = fm.data.role; p.team = fm.data.team;
    }
    for (const line of fm.body.split("\n")) for (const m of line.matchAll(/(?:^|\s)@([A-Za-z][\w.-]*)/g)) if (m[1] !== "owner") get(m[1]).mentions.push({ path: n.path, line: line.trim() });
  }
  return [...by.values()].sort((a, b) => b.mentions.length - a.mentions.length || a.name.localeCompare(b.name));
}

// ---- weekly review

export function weeklyReview(notes: (NoteLike & { created: bigint; modified: bigint })[], today: Date): string {
  const since = new Date(today); since.setDate(today.getDate() - 7);
  const ns = (d: Date) => BigInt(d.getTime()) * 1_000_000n;
  const made = notes.filter((n) => n.path.endsWith(".md") && n.created >= ns(since)).map((n) => n.path);
  const touched = notes.filter((n) => n.path.endsWith(".md") && n.modified >= ns(since) && n.created < ns(since)).map((n) => n.path);
  const tasks = parseTasks(notes);
  const open = sortTasks(tasks.filter((t) => !t.done), today);
  const overdue = open.filter((t) => isOverdue(t, today));
  const doneTasks = tasks.filter((t) => t.done).length;
  const decs = decisions(notes).filter((d) => d.date && d.date >= dayKey(since));
  const link = (p: string) => `[[${p.replace(/\.md$/, "")}]]`;
  return `---\ntype: review\ndate: ${dayKey(today)}\n---\n# Week to ${dayKey(today)}\n\n## Written\n\n${made.length ? made.map((p) => `- ${link(p)}`).join("\n") : "- nothing new"}\n\n## Touched\n\n${touched.length ? touched.map((p) => `- ${link(p)}`).join("\n") : "- nothing"}\n\n## Decided\n\n${decs.length ? decs.map((d) => `- ${d.text} (${link(d.path)})`).join("\n") : "- no decisions recorded"}\n\n## Open actions (${open.length}, ${overdue.length} overdue; ${doneTasks} done overall)\n\n${open.slice(0, 30).map((t) => `- ${t.text} — ${link(t.path)}`).join("\n") || "- none"}\n`;
}

// ---- export: a minimal DOCX from markdown

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function runs(text: string): string {
  const out: string[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|==([^=]+)==)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(`<w:r><w:t xml:space="preserve">${xmlEsc(text.slice(last, m.index))}</w:t></w:r>`);
    const [, , b, i1, i2, code, link, alias, hl] = m;
    const t = b ?? i1 ?? i2 ?? code ?? alias ?? link ?? hl ?? "";
    const pr = b ? "<w:b/>" : i1 || i2 ? "<w:i/>" : code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : hl ? '<w:highlight w:val="yellow"/>' : "<w:u w:val=\"single\"/>";
    out.push(`<w:r><w:rPr>${pr}</w:rPr><w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r>`);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(`<w:r><w:t xml:space="preserve">${xmlEsc(text.slice(last))}</w:t></w:r>`);
  return out.join("");
}
/** Headings, paragraphs, bullet and numbered lists, tasks, quotes, code and tables; enough for a one-pager. */
export function markdownToDocx(markdown: string, title: string): Uint8Array {
  const body: string[] = [];
  const para = (text: string, style?: string, extra = "") => body.push(`<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extra}</w:pPr>` : ""}${runs(text)}</w:p>`);
  const lines = frontmatter(markdown).body.split("\n");
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*```/.test(l)) { let j = i + 1; const buf: string[] = []; while (j < lines.length && !/^\s*```/.test(lines[j])) buf.push(lines[j++]); for (const c of buf) body.push(`<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr><w:t xml:space="preserve">${xmlEsc(c)}</w:t></w:r></w:p>`); i = j + 1; continue; }
    if (/^\s*\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()); if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells); i++; }
      body.push(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join("")}</w:tblBorders></w:tblPr>${rows.map((r, ri) => `<w:tr>${r.map((c) => `<w:tc><w:p>${ri === 0 ? `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEsc(c)}</w:t></w:r>` : runs(c)}</w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl><w:p/>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) para(h[2], `Heading${h[1].length}`);
    else if (/^\s*[-*+]\s+\[([ xX])\]\s+/.test(l)) para(`${/\[[xX]\]/.test(l) ? "☑" : "☐"} ${l.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "")}`, undefined, '<w:ind w:left="360"/>');
    else if (/^\s*[-*+]\s+/.test(l)) para(`• ${l.replace(/^\s*[-*+]\s+/, "")}`, undefined, '<w:ind w:left="360"/>');
    else if (/^\s*\d+[.)]\s+/.test(l)) para(l.trim(), undefined, '<w:ind w:left="360"/>');
    else if (/^\s*>\s?/.test(l)) para(l.replace(/^\s*>\s?/, ""), "Quote");
    else if (l.trim()) para(l.trim());
    i++;
  }
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults>${[1, 2, 3, 4, 5, 6].map((n) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="${[32, 28, 26, 24, 22, 22][n - 1]}"/></w:rPr></w:style>`).join("")}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEsc(title)}</dc:title></cp:coreProperties>`;
  return zip([{ path: "[Content_Types].xml", data: types }, { path: "_rels/.rels", data: rels }, { path: "word/_rels/document.xml.rels", data: docRels }, { path: "word/document.xml", data: doc }, { path: "word/styles.xml", data: styles }, { path: "docProps/core.xml", data: core }]);
}

// ---- tables

/** Tab-separated text (a spreadsheet selection) as a markdown table; null when it is not tabular. */
export function tsvToTable(text: string): string | null {
  const rows = text.replace(/\r/g, "").split("\n").filter((r) => r.trim()).map((r) => r.split("\t"));
  if (rows.length < 2 || rows[0].length < 2 || !rows.every((r) => r.length === rows[0].length)) return null;
  const cell = (c: string) => c.trim().replace(/\|/g, "\\|") || " ";
  return `| ${rows[0].map(cell).join(" | ")} |\n| ${rows[0].map(() => "---").join(" | ")} |\n${rows.slice(1).map((r) => `| ${r.map(cell).join(" | ")} |`).join("\n")}\n`;
}
/** The markdown table containing `line` sorted by column `col`; numbers numerically. */
export function sortTable(content: string, line: number, col: number, desc = false): string {
  const lines = content.split("\n");
  let s = line; while (s > 0 && /^\s*\|/.test(lines[s - 1])) s--;
  let e = line; while (e + 1 < lines.length && /^\s*\|/.test(lines[e + 1])) e++;
  const rows = lines.slice(s, e + 1);
  if (rows.length < 3) return content;
  const cells = (r: string) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const body = rows.slice(2);
  const val = (r: string) => cells(r)[col] ?? "";
  body.sort((a, b) => { const x = val(a), y = val(b); const nx = Number(x.replace(/[,%$]/g, "")), ny = Number(y.replace(/[,%$]/g, "")); const c = !isNaN(nx) && !isNaN(ny) && x !== "" && y !== "" ? nx - ny : x.localeCompare(y); return desc ? -c : c; });
  lines.splice(s, rows.length, rows[0], rows[1], ...body);
  return lines.join("\n");
}
/** Replace one cell of the table that contains `line`. */
export function setCell(content: string, line: number, col: number, value: string): string {
  const lines = content.split("\n");
  const cells = lines[line].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  if (col >= cells.length) return content;
  cells[col] = value.replace(/\|/g, "\\|");
  lines[line] = `| ${cells.join(" | ")} |`;
  return lines.join("\n");
}

// ---- reminders

export type Reminder = { path: string; at: Date; text: string };
/** `remind: 2026-10-14 09:00` in a note's properties. */
export function reminders(notes: NoteLike[]): Reminder[] {
  const out: Reminder[] = [];
  for (const n of notes) {
    const r = frontmatter(n.content).data.remind;
    if (!r) continue;
    const d = new Date(r.replace(" ", "T"));
    if (!isNaN(d.getTime())) out.push({ path: n.path, at: d, text: headings(n.content)[0]?.text ?? n.path });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
