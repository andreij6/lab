// The gardener, pure: what a notebook's notes could do with. A note that names another note's title
// without linking it; two notes that overlap a lot without a link between them; tags that similar
// notes carry and this one lacks. Each suggestion is one click to accept (see main.ts), and the
// ones the person waves away are remembered by key. Missing notes and duplicate titles are the
// Health card's job (organize.ts lint), not repeated here.

import { frontmatter, type NoteLike } from "./notes.ts";
import { setProperty } from "./organize.ts";

export type Suggestion =
  | { kind: "link"; key: string; from: string; to: string; why: string }
  | { kind: "pair"; key: string; from: string; to: string; why: string; score: number }
  | { kind: "tag"; key: string; path: string; tag: string; why: string };

type Idx = { links: Map<string, Set<string>>; tags: Map<string, Set<string>> };
const STOP = new Set("the a an and or of to in on for with is are was were be been it its this that these those as at by from not but if then than so we you i they he she our your their into over under about after before more most some any all each other such only also can could would should may might will just how what when where which who why".split(" "));
const stem = (p: string) => p.replace(/\.md$/, "").split("/").pop()!;
/** The content words of a note, lower-cased, without stop words and short bits. */
export function words(content: string): Set<string> {
  const body = content.replace(/^---[\s\S]*?---\s*/, "").toLowerCase();
  const out = new Set<string>();
  for (const w of body.match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu) ?? []) if (!STOP.has(w)) out.add(w);
  return out;
}
const jaccard = (a: Set<string>, b: Set<string>) => { let n = 0; for (const w of a) if (b.has(w)) n++; const u = a.size + b.size - n; return u ? n / u : 0; };
const linked = (idx: Idx, a: string, b: string) => !!(idx.links.get(a)?.has(b) || idx.links.get(b)?.has(a));
const tagsOf = (content: string): string[] => { const raw = frontmatter(content).data.tags ?? ""; return raw.replace(/^\[|\]$/g, "").split(/[,\s]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean); };

/** Everything the gardener would suggest, most useful first, minus the keys in `hidden`. */
export function suggest(notes: NoteLike[], idx: Idx, hidden: Iterable<string> = [], opts: { max?: number; pairs?: number } = {}): Suggestion[] {
  const hide = new Set(hidden), out: Suggestion[] = [];
  const md = notes.filter((n) => n.path.endsWith(".md") && !n.path.startsWith("Agents/"));
  const byStem = new Map(md.map((n) => [stem(n.path).toLowerCase(), n.path]));
  // 1. a title named in the text, not linked
  for (const n of md) {
    const body = n.content.replace(/\[\[[^\]]*\]\]/g, " ").toLowerCase();
    for (const [title, to] of byStem) {
      if (to === n.path || title.length < 4 || linked(idx, n.path, to)) continue;
      const at = body.indexOf(title);
      if (at < 0 || /[\p{L}\p{N}]/u.test(body[at - 1] ?? " ") || /[\p{L}\p{N}]/u.test(body[at + title.length] ?? " ")) continue;
      out.push({ kind: "link", key: `link:${n.path}>${to}`, from: n.path, to, why: `“${stem(n.path)}” mentions “${stem(to)}” but doesn't link it` });
    }
  }
  // 2. notes that overlap a lot without a link (ponytail: every pair; past 400 notes only the first 400 by path)
  const pool = md.slice(0, 400).map((n) => ({ path: n.path, w: words(n.content) })).filter((n) => n.w.size >= 12);
  const pairs: Suggestion[] = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    if (linked(idx, pool[i].path, pool[j].path)) continue;
    const score = jaccard(pool[i].w, pool[j].w);
    if (score >= 0.18) pairs.push({ kind: "pair", key: `pair:${pool[i].path}|${pool[j].path}`, from: pool[i].path, to: pool[j].path, score, why: `${Math.round(score * 100)}% of their words in common` });
  }
  pairs.sort((a, b) => (b as { score: number }).score - (a as { score: number }).score);
  out.push(...pairs.slice(0, opts.pairs ?? 12));
  // 3. tags that this note's neighbours (linked, or overlapping) carry and it lacks
  const tagsByPath = new Map(md.map((n) => [n.path, new Set(tagsOf(n.content))]));
  for (const n of md) {
    const mine = tagsByPath.get(n.path)!;
    const near = new Set<string>([...(idx.links.get(n.path) ?? []), ...[...idx.links].filter(([, s]) => s.has(n.path)).map(([p]) => p)]);
    for (const p of pairs.filter((x) => x.kind === "pair" && (x.from === n.path || x.to === n.path))) near.add((p as { from: string }).from === n.path ? (p as { to: string }).to : (p as { from: string }).from);
    const count = new Map<string, number>();
    for (const p of near) for (const t of tagsByPath.get(p) ?? []) if (!mine.has(t)) count.set(t, (count.get(t) ?? 0) + 1);
    for (const [tag, c] of count) if (c >= 2) out.push({ kind: "tag", key: `tag:${n.path}#${tag}`, path: n.path, tag, why: `${c} notes near it are tagged #${tag}` });
  }
  const seen = new Set<string>();
  return out.filter((s) => !hide.has(s.key) && !seen.has(s.key) && seen.add(s.key)).slice(0, opts.max ?? 30);
}

/** `content` with `[[title]]` added under a "## Related" heading (made at the end if there is none). */
export function addLink(content: string, title: string): string {
  const link = `[[${title}]]`;
  if (content.includes(link)) return content;
  const m = /^## Related[ \t]*$/m.exec(content);
  if (m) {
    const at = m.index + m[0].length;
    const rest = content.slice(at), next = rest.search(/\n#{1,6} /);
    const end = next < 0 ? content.length : at + next;
    const section = content.slice(at, end).replace(/\s+$/, "");
    return `${content.slice(0, at)}${section}\n- ${link}\n${content.slice(end).replace(/^\n*/, next < 0 ? "" : "\n")}`;
  }
  return `${content.replace(/\s+$/, "")}\n\n## Related\n\n- ${link}\n`;
}
/** `content` with `tag` in its front matter tags. */
export function addTag(content: string, tag: string): string {
  const have = tagsOf(content);
  if (have.includes(tag)) return content;
  return setProperty(content, "tags", `[${[...have, tag].join(", ")}]`);
}
