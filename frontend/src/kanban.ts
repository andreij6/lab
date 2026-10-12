// Kanban boards stored as plain markdown in the Obsidian Kanban plugin's format, so the same note
// opens there too: `kanban-plugin: board` in the front matter, one `## Heading` per lane, `- [ ]`
// task items as cards, `**Complete**` under a lane that marks cards done, and a `%% kanban:settings`
// block at the end that is kept verbatim.
import { frontmatter } from "./notes.ts";

export type Card = { text: string; done: boolean };
export type Lane = { title: string; cards: Card[]; complete: boolean };
export type Board = { head: string; pre: string; lanes: Lane[]; tail: string };

export const isKanban = (content: string): boolean => "kanban-plugin" in frontmatter(content).data;

export const NEW_BOARD = `---\n\nkanban-plugin: board\n\n---\n\n## Todo\n\n- [ ] First task\n\n## Doing\n\n\n\n## Done\n\n**Complete**\n\n\n\n\n%% kanban:settings\n\`\`\`\n{"kanban-plugin":"board"}\n\`\`\`\n%%`;

export function parseBoard(content: string): Board {
  const { body } = frontmatter(content);
  const head = content.slice(0, content.length - body.length);
  const cut = body.search(/^%% kanban:settings/m);
  const main = cut < 0 ? body : body.slice(0, cut);
  const tail = cut < 0 ? "" : body.slice(cut);
  const lanes: Lane[] = [];
  const pre: string[] = [];
  let lane: Lane | undefined;
  for (const line of main.split(/\r?\n/)) {
    const h = /^##\s+(.*?)\s*$/.exec(line);
    if (h) { lane = { title: h[1], cards: [], complete: false }; lanes.push(lane); continue; }
    if (!lane) { pre.push(line); continue; }
    if (/^\*\*Complete\*\*\s*$/.test(line)) { lane.complete = true; continue; }
    const c = /^[-*+]\s+(?:\[([ xX])\]\s*)?(.*)$/.exec(line);
    if (c) lane.cards.push({ text: c[2], done: c[1]?.toLowerCase() === "x" });
    else if (/^\s+\S/.test(line) && lane.cards.length) lane.cards[lane.cards.length - 1].text += `\n${line.trim()}`;
    else if (line.trim()) lane.cards.push({ text: line.trim(), done: false }); // a loose line is still a card; nothing is dropped
  }
  return { head, pre: pre.join("\n").trim(), lanes, tail };
}

export function serializeBoard(b: Board): string {
  const lanes = b.lanes.map((l) => `## ${l.title}\n\n${l.complete ? "**Complete**\n" : ""}${l.cards.map((c) => `- [${c.done ? "x" : " "}] ${c.text.replace(/\n/g, "\n  ")}`).join("\n")}\n\n`);
  return `${b.head}${b.pre ? `${b.pre}\n\n` : ""}${lanes.join("\n")}\n${b.tail}`;
}

/** Move a card to `toLane` at `toIdx` (append when past the end); cards dropped on a complete lane are ticked. */
export function moveCard(b: Board, from: { lane: number; idx: number }, to: { lane: number; idx: number }): void {
  const src = b.lanes[from.lane];
  const dst = b.lanes[to.lane];
  if (!src || !dst) return;
  const [card] = src.cards.splice(from.idx, 1);
  if (!card) return;
  let at = to.idx;
  if (src === dst && from.idx < at) at--;
  if (dst.complete !== src.complete) card.done = dst.complete;
  dst.cards.splice(Math.min(Math.max(at, 0), dst.cards.length), 0, card);
}
