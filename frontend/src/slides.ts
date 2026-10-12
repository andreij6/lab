// Slide shows: a note whose body is split into slides by `---` lines. Pure helpers; the overlay
// lives in main.ts.
import { frontmatter } from "./notes.ts";

export const isSlides = (content: string): boolean => (frontmatter(content).data.type ?? "").trim().toLowerCase() === "slides";

/** The slides of a note: the body split on `---` separator lines, blank slides dropped. */
export function splitSlides(content: string): string[] {
  const { body } = frontmatter(content);
  const out: string[] = [];
  let cur: string[] = [];
  let fence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && /^\s*-{3,}\s*$/.test(line)) { out.push(cur.join("\n")); cur = []; continue; }
    cur.push(line);
  }
  out.push(cur.join("\n"));
  return out.map((s) => s.trim()).filter(Boolean);
}

export const SLIDES_TEMPLATE = "---\ntype: slides\n---\n# {{title}}\n\nA subtitle, your name, the date\n\n---\n\n## The problem\n\n- One line\n- Another\n\n---\n\n## The idea\n\n> A quote or a diagram goes here\n\n---\n\n## Thanks\n\nQuestions?\n";
