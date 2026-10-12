// Chat with your notes: no DOM, no model. `decide` is the fast "System 1" pass that picks which notes
// are worth reading for a prompt (cheap lexical cues, no deep analysis); `answer` composes a grounded
// reply from what it picked. ponytail: `answer` is a stub that quotes the notes; swap it for the
// Gemini call and keep `decide` as the retrieval step that feeds the prompt.

import { base, dir, frontmatter, parseTags, type Index, type NoteLike } from "./notes.ts";

export type Pick = { path: string; score: number; why: string[]; snippet: string };
export type ChatNote = NoteLike & { modified?: bigint | number };

const STOP = new Set("a an and are as at be by for from how i in is it of on or that the this to was what when where which who why with you your me my do does can could should would about tell show find list give explain summarize summarise".split(" "));

/** Prompt words that carry meaning: lower-cased, stop words and one-letter tokens dropped. */
export function terms(prompt: string): string[] {
  return [...new Set(prompt.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [])].filter((t) => t.length > 1 && !STOP.has(t));
}

/** Is `path` inside one of the chosen folders? Root notes count as the "" folder. */
export const inFolders = (path: string, folders: Set<string>): boolean => {
  const d = dir(path);
  if (folders.has(d)) return true;
  for (const f of folders) if (f && d.startsWith(`${f}/`)) return true;
  return false;
};

/**
 * System 1: a quick gut call on which notes matter for the prompt. Title and tag hits weigh most,
 * then how often the prompt's words appear in the body, with a small nudge for well-linked and
 * recently edited notes. Nothing semantic; good enough to narrow the set before a model reads it.
 */
export function decide(prompt: string, notes: ChatNote[], idx: Index, opts: { folders?: Set<string>; limit?: number } = {}): Pick[] {
  const ts = terms(prompt);
  if (!ts.length) return [];
  const limit = opts.limit ?? 6;
  const phrase = prompt.trim().toLowerCase();
  const newest = notes.reduce((m, n) => Math.max(m, Number(n.modified ?? 0)), 0);
  const picks: Pick[] = [];
  for (const n of notes) {
    if (!n.path.endsWith(".md")) continue;
    if (opts.folders && !inFolders(n.path, opts.folders)) continue;
    const name = base(n.path).toLowerCase();
    const body = frontmatter(n.content).body;
    const low = body.toLowerCase();
    const tags = parseTags(n.content).map((t) => t.toLowerCase());
    let score = 0;
    const why: string[] = [];
    let first = -1;
    const titleHits = ts.filter((t) => name.includes(t));
    if (titleHits.length) { score += 4 * titleHits.length; why.push(`title mentions ${titleHits.join(", ")}`); }
    const tagHits = ts.filter((t) => tags.some((g) => g === t || g.startsWith(`${t}/`)));
    if (tagHits.length) { score += 3 * tagHits.length; why.push(`tagged #${tagHits.join(", #")}`); }
    let bodyHits = 0;
    for (const t of ts) {
      let i = low.indexOf(t);
      if (i < 0) continue;
      if (first < 0 || i < first) first = i;
      let c = 0;
      while (i >= 0 && c < 20) { c++; i = low.indexOf(t, i + t.length); }
      bodyHits++;
      score += 1 + Math.log2(c);
    }
    if (bodyHits) why.push(`${bodyHits} of ${ts.length} words in the text`);
    if (phrase.length > 3 && low.includes(phrase)) { score += 5; why.push("exact phrase"); first = low.indexOf(phrase); }
    if (!score) continue;
    score *= bodyHits / ts.length || 0.5; // notes that cover more of the question win
    const links = (idx.backlinks.get(n.path)?.size ?? 0) + (idx.links.get(n.path)?.size ?? 0);
    if (links) score += Math.min(1, links / 10);
    if (newest && n.modified) score += 0.5 * (Number(n.modified) / newest);
    picks.push({ path: n.path, score, why, snippet: snippetAt(body, first < 0 ? 0 : first) });
  }
  return picks.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
}

/** The sentence or line around `at`, trimmed of markdown noise. */
function snippetAt(body: string, at: number): string {
  const start = Math.max(body.lastIndexOf("\n", at - 1) + 1, body.lastIndexOf(". ", at - 1) + 2, 0);
  let end = body.indexOf("\n", at);
  if (end < 0) end = body.length;
  const dot = body.indexOf(". ", at);
  if (dot >= 0 && dot < end) end = dot + 1;
  return body.slice(start, end).replace(/^#+\s*|^[-*]\s+(\[[ x]\]\s*)?|^>\s*(\[![^\]]*\]\s*)?/g, "").replace(/\s+/g, " ").trim().slice(0, 240);
}

/** The passage of a note worth sending to the model: front matter dropped, the window around the
 *  first matching term, at most `max` characters. */
export function excerpt(content: string, prompt: string, max = 1400): string {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
  if (body.length <= max) return body;
  const lower = body.toLowerCase();
  let at = -1;
  for (const t of terms(prompt)) { const i = lower.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
  const start = at < 0 ? 0 : Math.max(0, at - Math.floor(max / 3));
  return `${start > 0 ? "…" : ""}${body.slice(start, start + max).trim()}${start + max < body.length ? "…" : ""}`;
}
/** A citation the model wrote: [1], [2][3] or [1, 2]. */
export const CITE = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;
/** Citation numbers the model used, in order of first use, limited to real sources. */
export function cited(text: string, n: number): number[] {
  const seen: number[] = [];
  for (const m of text.matchAll(CITE)) for (const k of m[1].split(/\s*,\s*/).map(Number)) if (k >= 1 && k <= n && !seen.includes(k)) seen.push(k);
  return seen;
}
/** A grounded reply built from the picked notes alone: the fallback when the language model is unavailable. */
export function answer(prompt: string, picks: Pick[]): string {
  if (!picks.length) return `I did not find anything in the selected folders about “${prompt.trim()}”. Try other words, widen the folders in the panel on the right, or write a note about it first.`;
  const lines = picks.map((p) => `- **[[${base(p.path)}]]**${p.snippet ? `: ${p.snippet}` : ""}`);
  const s = picks.length === 1 ? "" : "s";
  return `Here is what your note${s} say about that (${picks.length} note${s} looked relevant):\n\n${lines.join("\n")}\n\n_The language model was not reachable, so this lists what the notes say instead._`;
}
