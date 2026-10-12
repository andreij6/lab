// The Creator kit, all pure: a content calendar (an Obsidian Kanban board), post drafts split into
// a thread of 280-character posts, and the results of each post once it is out.
import { frontmatter, type NoteLike } from "./notes.ts";
import { parseBoard, serializeBoard } from "./kanban.ts";
import { setProperty } from "./organize.ts";

export const LANES = ["Ideas", "Drafting", "Scheduled", "Posted"] as const;
export type Lane = (typeof LANES)[number];
export const CALENDAR_BOARD = `---\n\nkanban-plugin: board\n\n---\n\n${LANES.map((l) => `## ${l}\n\n${l === "Posted" ? "**Complete**\n\n" : ""}`).join("\n")}\n\n%% kanban:settings\n\`\`\`\n{"kanban-plugin":"board"}\n\`\`\`\n%%`;
/** X's limit. ponytail: counts code points; X weighs links as 23 and some emoji as 2. */
export const LIMIT = 280;
const len = (s: string) => [...s].length;

export type Card = { text: string; title: string; lane: string; date?: string };
const titleOf = (text: string) => /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/.exec(text)?.[1].split("/").pop()!.trim() ?? text.replace(/📅\s*\S+/, "").trim();
export function calendar(board: string): Card[] {
  return parseBoard(board).lanes.flatMap((l) => l.cards.map((c) => ({ text: c.text, title: titleOf(c.text), lane: l.title, date: /📅\s*(\d{4}-\d{2}-\d{2})/.exec(c.text)?.[1] })));
}
/** Put a card in a lane, or move the card for `title` there, with an optional 📅 date (the date makes it a task in Work). */
export function placeCard(board: string, title: string, lane: Lane, date?: string, text?: string): string {
  const b = parseBoard(board);
  let card: { text: string; done: boolean } | undefined;
  for (const l of b.lanes) {
    const i = l.cards.findIndex((c) => titleOf(c.text) === title);
    if (i >= 0) { [card] = l.cards.splice(i, 1); break; }
  }
  card ??= { text: text ?? `[[${title}]]`, done: false };
  if (date !== undefined) card.text = `${card.text.replace(/\s*📅\s*\S+/, "")}${date ? ` 📅 ${date}` : ""}`;
  let to = b.lanes.find((l) => l.title === lane);
  if (!to) { to = { title: lane, cards: [], complete: lane === "Posted" }; b.lanes.push(to); }
  card.done = to.complete;
  to.cards.push(card);
  return serializeBoard(b);
}

// ---- posts

export type Metrics = { impressions?: number; likes?: number; reposts?: number; replies?: number };
export type Post = { path: string; title: string; platform: string; posted?: string; metrics: Metrics; thread: string[]; over: number; engagement?: number };
export const isPost = (content: string) => (frontmatter(content).data.type ?? "").trim().toLowerCase() === "post";
const int = (v: string | undefined) => (v && /^\s*[\d,]+\s*$/.test(v) ? Number(v.replace(/[,\s]/g, "")) : undefined);
/** The text that gets posted: the body before the first `## ` heading, without the title, quotes
 *  (the how-to box) or comments. A line with only `---` starts the next post in the thread. */
export function draftText(content: string): string {
  const body = frontmatter(content).body;
  const cut = body.search(/^##\s/m);
  return (cut < 0 ? body : body.slice(0, cut)).replace(/<!--[\s\S]*?-->/g, "").split("\n").filter((l) => !/^#\s/.test(l) && !/^>/.test(l)).join("\n").trim();
}
/** Split a draft into posts of at most `limit` characters: at `---` lines first, then long parts at
 *  paragraph and sentence ends, then words. Threads get " 1/3" counters, which count too. */
export function thread(text: string, limit = LIMIT): string[] {
  const parts = text.split(/^\s*---\s*$/m).map((p) => p.trim()).filter(Boolean);
  const split = (room: number) => parts.flatMap((p) => {
    const out: string[] = [];
    let cur = "";
    const pieces = p.split(/\n\s*\n/).flatMap((para) => para.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [para]).map((s) => s.trim()).filter(Boolean);
    for (const piece of pieces.flatMap((s) => (len(s) <= room ? [s] : s.split(/\s+/)))) {
      const next = cur ? `${cur}${/\n$/.test(cur) ? "" : " "}${piece}` : piece;
      if (len(next) <= room) cur = next;
      else { if (cur) out.push(cur); cur = len(piece) <= room ? piece : [...piece].slice(0, room).join(""); }
    }
    if (cur) out.push(cur);
    return out;
  });
  let posts = split(limit);
  if (posts.length > 1) { posts = split(limit - ` ${posts.length}/${posts.length}`.length - 1); posts = posts.map((p, i) => `${p} ${i + 1}/${posts.length}`); }
  return posts;
}
export function post(path: string, content: string): Post {
  const d = frontmatter(content).data;
  const metrics: Metrics = { impressions: int(d.impressions), likes: int(d.likes), reposts: int(d.reposts), replies: int(d.replies) };
  const th = thread(draftText(content));
  const acts = (metrics.likes ?? 0) + (metrics.reposts ?? 0) + (metrics.replies ?? 0);
  return { path, title: path.split("/").pop()!.replace(/\.md$/, ""), platform: (d.platform ?? "x").trim() || "x", posted: (d.posted ?? "").trim() || undefined, metrics, thread: th, over: th.filter((p) => len(p) > LIMIT).length, engagement: metrics.impressions ? (acts / metrics.impressions) * 100 : undefined };
}
export const posts = (notes: NoteLike[]) => notes.filter((n) => n.path.endsWith(".md") && isPost(n.content)).map((n) => post(n.path, n.content));
export function logResults(content: string, m: Metrics, posted?: string): string {
  let c = content;
  for (const k of ["impressions", "likes", "reposts", "replies"] as const) if (m[k] !== undefined) c = setProperty(c, k, String(m[k]));
  return posted ? setProperty(c, "posted", posted) : c;
}
/** Posts with results: how many, their reach, the average engagement rate, and the best one. */
export function results(ps: Post[]): { count: number; impressions: number; engagement?: number; best?: Post } {
  const measured = ps.filter((p) => p.engagement !== undefined);
  return { count: measured.length, impressions: measured.reduce((a, p) => a + (p.metrics.impressions ?? 0), 0), engagement: measured.length ? measured.reduce((a, p) => a + p.engagement!, 0) / measured.length : undefined, best: [...measured].sort((a, b) => b.engagement! - a.engagement!)[0] };
}
export const POST_TEMPLATE = (title: string, idea = "") => `---\ntype: post\nplatform: x\nposted: \nimpressions: \nlikes: \nreposts: \nreplies: \n---\n\n# ${title}\n\n${idea.trim() || "Write the post here."}\n\n## Notes\n\nWhat this is for, links, what to try next time. Nothing under a ## heading is posted.\n`;
