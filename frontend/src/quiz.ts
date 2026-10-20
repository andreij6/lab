// Quiz notes stored as plain markdown. `quiz: cards` in the front matter makes a flashcard deck in
// the Obsidian Spaced Repetition plugin's syntax (`Front::Back` on one line, or front, a `?` line,
// back; cards separated by blank lines). `quiz: choice` makes a multiple-choice quiz: a `###`
// heading per question, task items as options with `[x]` marking the right ones, and an optional
// `>` quote as the explanation. Both read fine as ordinary notes elsewhere.
import { frontmatter } from "./notes.ts";

export type Card = { front: string; back: string };
export type Question = { text: string; options: string[]; correct: number[]; explanation: string };

export type Blank = { text: string; answers: string[][]; explanation: string };

export function quizKind(content: string): "cards" | "choice" | "blanks" | undefined {
  const q = (frontmatter(content).data.quiz ?? "").trim().toLowerCase();
  return q === "cards" || q === "flashcards" ? "cards" : q === "choice" || q === "multiple-choice" ? "choice" : q === "blanks" || q === "fill" || q === "fill-in-the-blank" || q === "cloze" ? "blanks" : undefined;
}

export const NEW_CARDS = `---\nquiz: cards\n---\n\n# Flashcards\n\nOne card per paragraph: \`Front::Back\` on one line, or the front, a line with \`?\`, then the back.\n\nWhat keeps a canister alive?::Cycles\n\nWhich call turns ICP into cycles?\n?\nnotify_top_up on the cycles minting canister\n`;
export const NEW_BLANKS = `---\nquiz: blanks\n---\n\n# Fill in the blanks\n\nOne item per paragraph: a sentence with the answer in double curly braces, alternatives separated by a vertical bar, and a quote line after it as the explanation.\n\nA canister pays for its own compute and storage in {{cycles}}.\n> Cycles are the Internet Computer's fuel; one XDR buys a trillion of them.\n\nThe {{registry}} canister spawns every space, and each space is its own {{canister|notebook canister}}.\n`;
export const NEW_CHOICE = `---\nquiz: choice\n---\n\n# Quiz\n\n### What happens when a canister runs out of cycles?\n- [ ] It is deleted at once\n- [x] It freezes, then is deleted when the remaining cycles run out\n- [ ] Nothing, calls are free\n> A frozen canister keeps its data until its balance hits zero.\n\n### Which of these are ICRC standards? (pick all)\n- [x] ICRC-1\n- [x] ICRC-2\n- [ ] ERC-20\n`;

/** Flashcards: blocks separated by blank lines; headings and prose without a `::` or `?` are skipped. */
export function parseCards(content: string): Card[] {
  const body = frontmatter(content).body;
  const out: Card[] = [];
  for (const block of body.split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length || lines.every((l) => l.startsWith("#"))) continue;
    // cloze: `{{answer}}` in a sentence; the front blanks every cloze, the back is the full text
    const joined = lines.join("\n");
    if (/\{\{[^{}\n]+\}\}/.test(joined) && !joined.includes("::")) {
      const answers = [...joined.matchAll(/\{\{([^{}\n]+)\}\}/g)].map((m) => m[1].trim());
      out.push({ front: joined.replace(/\{\{[^{}\n]+\}\}/g, "［…］"), back: joined.replace(/\{\{([^{}\n]+)\}\}/g, "**$1**") + (answers.length > 1 ? `\n\n${answers.join(" · ")}` : "") });
      continue;
    }
    const q = lines.indexOf("?");
    if (q > 0) {
      out.push({ front: lines.slice(0, q).join("\n"), back: lines.slice(q + 1).join("\n") });
      continue;
    }
    // `::` inside a code span is prose, not a card
    const bare = (l: string) => l.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));
    const one = lines.find((l) => bare(l).includes("::"));
    if (one) {
      const i = bare(one).indexOf("::");
      out.push({ front: one.slice(0, i).trim(), back: one.slice(i + 2).trim() });
    }
  }
  return out.filter((c) => c.front && c.back);
}

/** Multiple choice: a `###` (or any heading) starts a question; task items are its options. */
export function parseChoice(content: string): Question[] {
  const body = frontmatter(content).body;
  const out: Question[] = [];
  let q: Question | undefined;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      if (q && q.options.length) out.push(q);
      q = { text: h[1], options: [], correct: [], explanation: "" };
      continue;
    }
    if (!q) continue;
    const o = /^[-*+]\s+\[([ xX])\]\s*(.*)$/.exec(line);
    if (o) {
      if (o[1].toLowerCase() === "x") q.correct.push(q.options.length);
      q.options.push(o[2]);
    } else if (line.startsWith(">")) q.explanation += `${q.explanation ? " " : ""}${line.replace(/^>\s?/, "")}`;
  }
  if (q && q.options.length) out.push(q);
  return out.filter((x) => x.correct.length);
}

const BLANK = /\{\{([^{}\n]+)\}\}/g;
/** Fill in the blanks: a paragraph with `{{answer}}` blanks (`{{a|b}}` accepts either); `>` lines explain. */
export function parseBlanks(content: string): Blank[] {
  const body = frontmatter(content).body;
  const out: Blank[] = [];
  for (const block of body.split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const text = lines.filter((l) => !l.startsWith(">") && !l.startsWith("#")).join(" ");
    const answers = [...text.matchAll(BLANK)].map((m) => m[1].split("|").map((a) => a.trim()).filter(Boolean)).filter((a) => a.length);
    if (!answers.length) continue;
    out.push({ text, answers, explanation: lines.filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, "")).join(" ") });
  }
  return out;
}
/** A typed answer matches when it equals an accepted one, case, spacing and ending punctuation aside. */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?'"’]+$/, "").trim();
export const gradeBlanks = (q: Blank, typed: string[]): boolean[] => q.answers.map((alts, i) => alts.some((a) => norm(a) === norm(typed[i] ?? "")));

/** True when exactly the right options are picked. */
export const graded = (q: Question, picked: Iterable<number>): boolean => {
  const p = [...new Set(picked)].sort((a, b) => a - b);
  return p.length === q.correct.length && p.every((v, i) => v === q.correct[i]);
};

/** A shuffled index order; deterministic for a seed so a session is stable across renders. */
export function shuffled(n: number, seed: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  let s = seed || 1;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
