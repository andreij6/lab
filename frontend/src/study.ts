// Study helpers, all pure: flashcards generated from a note, cloze cards, the notebook glossary,
// a quick summary and questions for a note, sources, goals and the Anki export.
// ponytail: summaries and questions are extractive; the LLM replaces `summarise` and `questionsFor`.
import { frontmatter, headings, outsideCode, section, type NoteLike } from "./notes.ts";

/** `Claim::`, `Q::` and friends are fields the kits read, not glossary terms. */
const FIELD = /^(claim|q|ask|due|date|status|priority|source|owner)$|\sdate$/i;
const termLine = (line: string) => { const m = /^([^:`\n]{1,80}?)::\s*(.+)$/.exec(line.trim()); return m && !FIELD.test(m[1].trim().replace(/^[-*]\s+/, "")) ? m : null; };

/** `Term:: definition` lines outside quiz notes make the glossary. */
export type Entry = { term: string; definition: string; path: string };
export function glossary(notes: NoteLike[]): Entry[] {
  const out: Entry[] = [];
  for (const n of notes) {
    if (!n.path.endsWith(".md")) continue;
    const fm = frontmatter(n.content);
    if (fm.data.quiz) continue;
    for (const line of outsideCode(fm.body, (x) => x).split("\n")) {
      const m = termLine(line);
      if (m) out.push({ term: m[1].trim(), definition: m[2].trim(), path: n.path });
    }
  }
  return out.sort((a, b) => a.term.localeCompare(b.term));
}

/**
 * Cards from a note: every `==highlight==` becomes a cloze of its sentence, every `Term:: def`
 * a plain card, and every heading with text under it a "what is" card. Returned as deck markdown.
 */
export function cardsFromNote(content: string, title: string): string {
  const fm = frontmatter(content);
  const cards: string[] = [];
  const seen = new Set<string>();
  const add = (c: string) => { if (!seen.has(c)) { seen.add(c); cards.push(c); } };
  const body = outsideCode(fm.body, (x) => x);
  for (const sentence of body.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/)) {
    if (!/==[^=\n]+==/.test(sentence)) continue;
    const s = sentence.trim().replace(/^[-*>#\s]+/, "");
    if (s.length > 400) continue;
    add(s.replace(/==([^=\n]+)==/g, "{{$1}}"));
  }
  for (const line of body.split("\n")) {
    const m = termLine(line);
    if (m) add(`${m[1].trim()}::${m[2].trim()}`);
  }
  for (const h of headings(content)) {
    const text = (section(content, h.text) ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))[0];
    if (text && text.length < 300 && !/::|==/.test(text)) add(`What is "${h.text}"?\n?\n${text.replace(/^[-*>\s]+/, "")}`);
  }
  return `---\nquiz: cards\nsource: [[${title}]]\n---\n\n# ${title} (cards)\n\nMade from [[${title}]]; edit freely.\n\n${cards.join("\n\n")}\n`;
}

/** A short extractive summary: the first sentence under each heading, or the first few of a flat note. */
export function summarise(content: string, title: string): string {
  const hs = headings(content);
  const body = frontmatter(content).body;
  const first = (text: string) => text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("|") && !l.startsWith("```"))[0]?.split(/(?<=[.!?])\s+/)[0] ?? "";
  const lines = hs.length
    ? hs.map((h) => { const f = first(section(content, h.text) ?? ""); return f ? `- **${h.text}**: ${f}` : `- **${h.text}**`; })
    : body.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 4).map((s) => `- ${s}`);
  return `---\nsource: [[${title}]]\n---\n\n# ${title}: summary\n\n> [!abstract] In short\n> A quick extract of [[${title}]]; replace with your own words.\n\n${lines.join("\n")}\n`;
}

/** Plain-language version: the summary plus every term defined in the note. */
export function explain(content: string, title: string): string {
  const defs = glossary([{ path: "x.md", content }]).map((e) => `- **${e.term}** means ${e.definition}`);
  return `${summarise(content, title).replace(": summary", ": explained simply")}${defs.length ? `\n## Words used\n\n${defs.join("\n")}\n` : ""}\n## Check yourself\n\n${questionsFor(content).map((q) => `- ${q}`).join("\n")}\n`;
}

/** Three questions a reader should be able to answer after the note. */
export function questionsFor(content: string): string[] {
  const hs = headings(content).filter((h) => h.level > 1 || headings(content).length === 1);
  const qs = hs.slice(0, 3).map((h) => `What does "${h.text}" cover, and why does it matter?`);
  const terms = glossary([{ path: "x.md", content }]);
  for (const t of terms) if (qs.length < 3) qs.push(`How would you define "${t.term}" in your own words?`);
  while (qs.length < 3) qs.push(["What is the main claim here, in one sentence?", "What would you need to check to be sure it is right?", "Where could you apply this?"][qs.length]);
  return qs;
}

/** `source:` front matter across notes: one row per source with the notes citing it. */
export type Source = { source: string; notes: string[] };
export function sources(notes: NoteLike[]): Source[] {
  const m = new Map<string, string[]>();
  for (const n of notes) {
    const src = frontmatter(n.content).data.source?.trim();
    if (!src || !n.path.endsWith(".md")) continue;
    for (const s of src.split(/\s*[;|]\s*/).filter(Boolean)) m.set(s, [...(m.get(s) ?? []), n.path]);
  }
  return [...m.entries()].map(([source, notes]) => ({ source, notes })).sort((a, b) => b.notes.length - a.notes.length || a.source.localeCompare(b.source));
}

/** A `[^src]` footnote for the note's source, appended to the end. */
export function cite(content: string): string {
  const src = frontmatter(content).data.source?.trim();
  if (!src) return content;
  const id = "src";
  const def = `[^${id}]: ${src}`;
  return content.includes(def) ? content : `${content.trimEnd()}\n\n${def}\n`;
}

/** Progress against a goal this period: 0..1 and the counts. */
export function goalProgress(counts: Map<string, number>, days: string[], goal: number): { done: number; goal: number; ratio: number } {
  const done = days.reduce((n, k) => n + (counts.get(k) ?? 0), 0);
  return { done, goal, ratio: goal > 0 ? Math.min(1, done / goal) : 0 };
}

/** Anki imports tab-separated front/back lines; `#separator` headers tell it so. */
export function ankiTsv(cards: { front: string; back: string }[], deck: string): string {
  const cell = (s: string) => s.replace(/\t/g, " ").replace(/\n/g, "<br>");
  return `#separator:tab\n#html:true\n#deck:${cell(deck)}\n${cards.map((c) => `${cell(c.front)}\t${cell(c.back)}`).join("\n")}\n`;
}
