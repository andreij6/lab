import { test } from "node:test";
import assert from "node:assert/strict";
import { cardKey, isDue, review } from "./srs.ts";
import { ankiTsv, cardsFromNote, cite, explain, glossary, goalProgress, questionsFor, sources, summarise } from "./study.ts";
import { parseCards } from "./quiz.ts";

const today = new Date(2026, 9, 11);

test("SM-2: again resets, good grows, easy grows faster, hard shrinks ease", () => {
  const g1 = review(undefined, "good", today);
  assert.deepEqual([g1.i, g1.r, g1.d], [1, 1, "2026-10-12"]);
  const g2 = review(g1, "good", today);
  assert.equal(g2.i, 6);
  const g3 = review(g2, "good", today);
  assert.equal(g3.i, 15);
  const a = review(g3, "again", today);
  assert.deepEqual([a.i, a.r, a.d], [0, 0, "2026-10-11"]);
  assert.ok(review(g3, "easy", today).i > g3.i * 2);
  assert.ok(review(g3, "hard", today).e < g3.e);
  assert.ok(isDue(undefined, today));
  assert.ok(isDue(a, today));
  assert.ok(!isDue(g1, today));
  assert.equal(cardKey("What?"), cardKey(" What? "));
  assert.notEqual(cardKey("a"), cardKey("b"));
});

test("cloze cards blank every answer", () => {
  const [c] = parseCards("---\nquiz: cards\n---\n\nThe {{ledger}} records {{transfers}}.");
  assert.equal(c.front, "The ［…］ records ［…］.");
  assert.match(c.back, /\*\*ledger\*\*/);
  assert.match(c.back, /ledger · transfers/);
});

test("cards from a note: highlights, definitions, headings", () => {
  const note = "# Cycles\n\nCycles are ==the fuel== of a canister. Nothing else.\n\nFreeze:: the state when cycles run low\n\n## Top-ups\n\nSend ICP and it is minted into cycles.\n";
  const deck = cardsFromNote(note, "Cycles");
  assert.match(deck, /quiz: cards/);
  assert.match(deck, /\{\{the fuel\}\}/);
  assert.match(deck, /Freeze::the state/);
  assert.match(deck, /What is "Top-ups"\?\n\?\nSend ICP/);
  const cards = parseCards(deck);
  assert.equal(cards.length, 3);
});

test("glossary, sources, cite, summary and questions", () => {
  const notes = [
    { path: "A.md", content: "---\nsource: Book X\n---\nCanister:: a program on ICP\n" },
    { path: "B.md", content: "---\nsource: Book X; https://y\n---\n# B\n\n## Part\n\nFirst sentence here. Second one.\n" },
    { path: "D.md", content: "---\nquiz: cards\n---\nIgnored:: in decks\n" },
  ];
  assert.deepEqual(glossary(notes).map((e) => e.term), ["Canister"]);
  const src = sources(notes);
  assert.deepEqual(src.map((s) => [s.source, s.notes.length]), [["Book X", 2], ["https://y", 1]]);
  assert.match(cite(notes[0].content), /\[\^src\]: Book X/);
  assert.equal(cite(cite(notes[0].content)), cite(notes[0].content));
  assert.equal(cite("no source"), "no source");
  assert.match(summarise(notes[1].content, "B"), /\*\*Part\*\*: First sentence here\./);
  assert.equal(questionsFor(notes[1].content).length, 3);
  assert.match(explain(notes[0].content, "A"), /\*\*Canister\*\* means a program on ICP/);
});

test("goals and the Anki export", () => {
  const p = goalProgress(new Map([["d1", 2], ["d2", 1]]), ["d1", "d2", "d3"], 5);
  assert.deepEqual(p, { done: 3, goal: 5, ratio: 0.6 });
  assert.equal(ankiTsv([{ front: "a\tb", back: "c\nd" }], "Deck"), "#separator:tab\n#html:true\n#deck:Deck\na b\tc<br>d\n");
});

test("kit fields are not glossary terms", () => {
  const g = glossary([{ path: "a.md", content: "Claim:: x\nQ:: y\n- Flood date:: Year 1\nOsmosis:: water moves" }]);
  assert.deepEqual(g.map((e) => e.term), ["Osmosis"]);
});
