import { test } from "node:test";
import assert from "node:assert/strict";
import { NEW_BOARD, isKanban, moveCard, parseBoard, serializeBoard } from "./kanban.ts";

test("the new board round-trips and is recognised", () => {
  assert.ok(isKanban(NEW_BOARD));
  assert.ok(!isKanban("# plain\n\n- [ ] task"));
  const b = parseBoard(NEW_BOARD);
  assert.deepEqual(b.lanes.map((l) => [l.title, l.cards.length, l.complete]), [["Todo", 1, false], ["Doing", 0, false], ["Done", 0, true]]);
  assert.match(b.tail, /^%% kanban:settings/);
  assert.deepEqual(parseBoard(serializeBoard(b)), b);
  assert.match(serializeBoard(b), /^---\n\nkanban-plugin: board/);
});

test("cards keep their text, done state and continuation lines", () => {
  const b = parseBoard("---\nkanban-plugin: basic\n---\n\n## A\n\n- [x] done [[Note]] #tag\n- [ ] two\n  lines\n* plain\n\n## B\n");
  assert.deepEqual(b.lanes[0].cards, [{ text: "done [[Note]] #tag", done: true }, { text: "two\nlines", done: false }, { text: "plain", done: false }]);
  assert.equal(b.lanes[1].cards.length, 0);
  assert.match(serializeBoard(b), /- \[ \] two\n  lines/);
});

test("nothing is lost: loose lines become cards and text before the first lane is kept", () => {
  const b = parseBoard("---\nkanban-plugin: board\n---\n\nIntro paragraph.\n\n## A\n\n==- [ ] wrapped==\nplain line\n");
  assert.equal(b.pre, "Intro paragraph.");
  assert.deepEqual(b.lanes[0].cards.map((c) => c.text), ["==- [ ] wrapped==", "plain line"]);
  const out = serializeBoard(b);
  assert.match(out, /Intro paragraph\.\n\n## A/);
  assert.deepEqual(parseBoard(out), b);
});

test("moveCard reorders within a lane, crosses lanes and ticks on a complete lane", () => {
  const b = parseBoard("---\nkanban-plugin: board\n---\n## A\n- [ ] a1\n- [ ] a2\n- [ ] a3\n## Done\n**Complete**\n");
  moveCard(b, { lane: 0, idx: 0 }, { lane: 0, idx: 3 });
  assert.deepEqual(b.lanes[0].cards.map((c) => c.text), ["a2", "a3", "a1"]);
  moveCard(b, { lane: 0, idx: 1 }, { lane: 1, idx: 0 });
  assert.deepEqual(b.lanes[1].cards, [{ text: "a3", done: true }]);
  moveCard(b, { lane: 1, idx: 0 }, { lane: 0, idx: 99 });
  assert.deepEqual(b.lanes[0].cards.map((c) => [c.text, c.done]), [["a2", false], ["a1", false], ["a3", false]]);
  moveCard(b, { lane: 5, idx: 0 }, { lane: 0, idx: 0 });
  assert.equal(b.lanes[0].cards.length, 3);
});
