// The Career kit, all pure: a job-application board (Obsidian Kanban format), applications waiting
// too long for a reply, weekly search numbers, an experience bank compiled into résumés, interview
// stories as flashcards, and networking follow-ups on person notes.
import { frontmatter, type NoteLike } from "./notes.ts";
import { parseBoard, serializeBoard } from "./kanban.ts";
import { setProperty } from "./organize.ts";

// ---- applications

export const STAGES = ["Saved", "Applied", "Screen", "Interview", "Offer", "Closed"] as const;
export type Stage = (typeof STAGES)[number];
/** The board every application lives on: one lane per stage, Closed marks cards done. */
export const APPLICATIONS_BOARD = `---\n\nkanban-plugin: board\n\n---\n\n${STAGES.map((s) => `## ${s}\n\n${s === "Closed" ? "**Complete**\n\n" : ""}`).join("\n")}\n\n%% kanban:settings\n\`\`\`\n{"kanban-plugin":"board"}\n\`\`\`\n%%`;

export type Application = { company: string; role: string; stage: string; applied?: string; followUp?: string; text: string; lane: number; card: number };
const DATE = /\d{4}-\d{2}-\d{2}/.source;
/** A card reads `[[Company]] · Role applied:: 2026-10-01 📅 2026-10-11`; the 📅 date makes it a task in Work. */
export function applicationCard(company: string, role: string, applied: string, followUp: string): string {
  return `[[${company}]] · ${role} applied:: ${applied} 📅 ${followUp}`;
}
export function applications(board: string): Application[] {
  return parseBoard(board).lanes.flatMap((l, lane) => l.cards.map((c, card) => {
    const company = /\[\[([^\]|#]+)/.exec(c.text)?.[1].trim() ?? c.text.split("·")[0].trim();
    const role = (/·\s*(.+?)(?:\s+applied::|\s+📅|$)/.exec(c.text)?.[1] ?? "").trim();
    return { company, role, stage: l.title, applied: new RegExp(`applied::\\s*(${DATE})`).exec(c.text)?.[1], followUp: new RegExp(`📅\\s*(${DATE})`).exec(c.text)?.[1], text: c.text, lane, card };
  }));
}
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
/** Applied with no reply for `after` days and no follow-up planned later than today. */
export function waiting(apps: Application[], today: string, after = 10): Application[] {
  return apps.filter((a) => a.stage === "Applied" && a.applied && days(a.applied, today) >= after && (!a.followUp || a.followUp <= today));
}
/** Move a card to another lane, or (with `followUp`) give it a new follow-up date. */
export function updateApplication(board: string, a: Application, change: { stage?: Stage; followUp?: string }): string {
  const b = parseBoard(board);
  const lane = b.lanes[a.lane];
  const [card] = lane.cards.splice(a.card, 1);
  if (change.followUp) card.text = /📅\s*\S+/.test(card.text) ? card.text.replace(/📅\s*\S+/, `📅 ${change.followUp}`) : `${card.text} 📅 ${change.followUp}`;
  const to = change.stage ? b.lanes.find((l) => l.title === change.stage) ?? lane : lane;
  card.done = to.complete;
  if (to === lane) lane.cards.splice(a.card, 0, card); else to.cards.push(card);
  return serializeBoard(b);
}
export function addApplication(board: string, card: string, stage: Stage = "Applied"): string {
  const b = parseBoard(board);
  let lane = b.lanes.find((l) => l.title === stage);
  if (!lane) { lane = { title: stage, cards: [], complete: false }; b.lanes.push(lane); }
  lane.cards.push({ text: card, done: false });
  return serializeBoard(b);
}

// ---- the weekly search review

export type Week = { week: string; sent: number };
export type SearchStats = { total: number; thisWeek: number; responseRate: number; interviewRate: number; offers: number; weeks: Week[] };
const monday = (d: string) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
/** Sent per week (the last `n` weeks), how many heard back (anything past Applied, including a
 *  rejection), how many reached an interview, and offers. */
export function searchStats(apps: Application[], today: string, n = 8): SearchStats {
  const sent = apps.filter((a) => a.applied);
  const heard = sent.filter((a) => a.stage !== "Applied" && a.stage !== "Saved");
  const interviewed = sent.filter((a) => a.stage === "Interview" || a.stage === "Offer" || (a.stage === "Closed" && /interview/i.test(a.text)));
  const weeks: Week[] = [];
  const m = monday(today);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(`${m}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 7 * i);
    const w = d.toISOString().slice(0, 10);
    weeks.push({ week: w, sent: sent.filter((a) => monday(a.applied!) === w).length });
  }
  const rate = (x: number) => (sent.length ? Math.round((x / sent.length) * 100) : 0);
  return { total: sent.length, thisWeek: weeks[weeks.length - 1].sent, responseRate: rate(heard.length), interviewRate: rate(interviewed.length), offers: apps.filter((a) => a.stage === "Offer").length, weeks };
}

// ---- experience bank and résumés

export type Experience = { path: string; title: string; role: string; company: string; start: string; end: string; skills: string[]; bullets: string[] };
const list = (v: string | undefined) => (v ?? "").replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
export const isExperience = (content: string) => (frontmatter(content).data.type ?? "").trim() === "experience";
export function experience(path: string, content: string): Experience {
  const fm = frontmatter(content);
  const d = fm.data;
  return { path, title: path.split("/").pop()!.replace(/\.md$/, ""), role: d.role ?? "", company: d.company ?? "", start: d.start ?? "", end: d.end ?? "", skills: list(d.skills), bullets: fm.body.split("\n").filter((l) => /^\s*[-*]\s+\S/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim()) };
}
export const EXPERIENCE_TEMPLATE = (role: string, company: string, start: string) => `---\ntype: experience\nrole: ${role}\ncompany: ${company}\nstart: ${start}\nend: present\nskills: []\n---\n\n# ${role} · ${company}\n\nOne bullet per accomplishment, with a number when you have one.\n\n- \n`;
export const RESUME_TEMPLATE = (name: string, links: string[]) => `---\ntype: resume\nname: ${name}\nheadline: \ncontact: \n---\n\n# Résumé\n\nList the experience notes to include, most recent first. Compile from the Career tab.\n\n## Experience\n\n${links.map((l) => `- [[${l}]]`).join("\n") || "- [[An experience note]]"}\n`;
/** A résumé note lists experience notes as `- [[links]]` under its headings; compiling expands each
 *  into role, company, dates and bullets, and adds a Skills line from the experiences included. */
export function compileResume(content: string, get: (title: string) => string | undefined): { md: string; missing: string[]; used: number } {
  const fm = frontmatter(content);
  const d = fm.data;
  const missing: string[] = [];
  const skills = new Set<string>();
  let used = 0;
  const out: string[] = [`# ${d.name || "Your name"}`];
  if (d.headline) out.push(d.headline);
  if (d.contact) out.push(d.contact);
  for (const line of fm.body.split("\n")) {
    if (/^#\s/.test(line) || /^List the experience notes/.test(line)) continue;
    const link = /^\s*[-*]\s+\[\[([^\]|#]+)/.exec(line);
    if (!link) { if (/^##\s/.test(line) || line.trim()) out.push("", line); continue; }
    const body = get(link[1].trim());
    if (body === undefined || !isExperience(body)) { missing.push(link[1].trim()); continue; }
    const e = experience(link[1], body);
    e.skills.forEach((s) => skills.add(s));
    used++;
    out.push("", `### ${e.role}${e.company ? ` · ${e.company}` : ""}${e.start ? ` (${e.start}${e.end ? ` – ${e.end}` : ""})` : ""}`, "", ...e.bullets.map((b) => `- ${b}`));
  }
  if (skills.size) out.push("", "## Skills", "", [...skills].join(" · "));
  return { md: `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`, missing, used };
}

// ---- interview stories (a flashcard deck)

export const STORIES_DECK = `---\nquiz: cards\n---\n\n# Interview stories\n\nEach card: the question on the front, your STAR answer (situation, task, action, result) on the back.\n`;
export type Star = { question: string; situation: string; task: string; action: string; result: string };
/** One card: front, a `?` line, then the four parts on separate lines (no blank lines inside a card). */
export function storyCard(s: Star): string {
  const parts = ([["Situation", s.situation], ["Task", s.task], ["Action", s.action], ["Result", s.result]] as const).filter(([, v]) => v.trim()).map(([k, v]) => `**${k}:** ${v.trim().replace(/\n+/g, " ")}`);
  return `${s.question.trim().replace(/\n+/g, " ")}\n?\n${parts.join("\n")}`;
}
/** Read a filled-in "Situation: … Task: …" answer back into its parts. */
export function parseStar(question: string, text: string): Star {
  const get = (k: string) => new RegExp(`${k}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:Situation|Task|Action|Result)\\s*:|$)`, "i").exec(text)?.[1].trim() ?? "";
  return { question, situation: get("Situation"), task: get("Task"), action: get("Action"), result: get("Result") };
}

// ---- networking

export type Contact = { path: string; name: string; lastContacted?: string; nextFollowUp?: string; referralFor?: string; due: boolean };
/** Person notes with networking fields; due when the follow-up date has come, or when there is
 *  none and the last contact was `quiet` days ago or more. */
export function contacts(notes: NoteLike[], today: string, quiet = 30): Contact[] {
  return notes.filter((n) => n.path.endsWith(".md") && (frontmatter(n.content).data.type ?? "").trim().toLowerCase() === "person").map((n) => {
    const d = frontmatter(n.content).data;
    const last = d.last_contacted || undefined, next = d.next_follow_up || undefined;
    const due = next ? next <= today : !!last && days(last, today) >= quiet;
    return { path: n.path, name: n.path.split("/").pop()!.replace(/\.md$/, ""), lastContacted: last, nextFollowUp: next, referralFor: d.referral_for || undefined, due };
  }).filter((c) => c.lastContacted || c.nextFollowUp || c.referralFor).sort((a, b) => Number(b.due) - Number(a.due) || (a.nextFollowUp ?? "9").localeCompare(b.nextFollowUp ?? "9"));
}
const addDays = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export function markContacted(content: string, today: string, nextIn = 14): string {
  return setProperty(setProperty(content, "last_contacted", today), "next_follow_up", addDays(today, nextIn));
}
export const PERSON_TEMPLATE = (name: string, how: string, referral: string, today: string) => `---\ntype: person\nhow_we_met: ${how}\nlast_contacted: ${today}\nnext_follow_up: ${addDays(today, 14)}\nreferral_for: ${referral}\n---\n\n# ${name}\n\n`;
export { addDays };
