import { test } from "node:test";
import assert from "node:assert/strict";
import { NEW_CARDS, NEW_CHOICE, graded, parseCards, parseChoice, quizKind, shuffled } from "./quiz.ts";

test("the front matter picks the quiz kind", () => {
  assert.equal(quizKind(NEW_CARDS), "cards");
  assert.equal(quizKind(NEW_CHOICE), "choice");
  assert.equal(quizKind("---\nquiz: flashcards\n---\n"), "cards");
  assert.equal(quizKind("# plain"), undefined);
});

test("flashcards: one-line and multi-line forms, prose skipped", () => {
  const cards = parseCards(NEW_CARDS);
  assert.deepEqual(cards, [
    { front: "What keeps a canister alive?", back: "Cycles" },
    { front: "Which call turns ICP into cycles?", back: "notify_top_up on the cycles minting canister" },
  ]);
  assert.deepEqual(parseCards("a::\n\n::b\n\nfront\n?\n"), []);
});

test("multiple choice: options, several correct answers, explanation", () => {
  const qs = parseChoice(NEW_CHOICE);
  assert.equal(qs.length, 2);
  assert.deepEqual(qs[0].correct, [1]);
  assert.match(qs[0].explanation, /keeps its data/);
  assert.deepEqual(qs[1].correct, [0, 1]);
  assert.ok(graded(qs[0], [1]));
  assert.ok(!graded(qs[0], [0]));
  assert.ok(graded(qs[1], [1, 0]));
  assert.ok(!graded(qs[1], [0]));
  assert.deepEqual(parseChoice("### no right answer\n- [ ] a\n- [ ] b"), []);
});

test("shuffle is a permutation and stable for a seed", () => {
  const a = shuffled(10, 7);
  assert.deepEqual([...a].sort((x, y) => x - y), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(a, shuffled(10, 7));
  assert.notDeepEqual(a, shuffled(10, 8));
});
