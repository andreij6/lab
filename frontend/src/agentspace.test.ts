import assert from "node:assert/strict";
import { test } from "node:test";
import { checkHunt, distractors, huntRound, tapPassed, TAP_GOAL, TAP_MS } from "./agentspace.ts";

// a small deterministic generator so rounds are reproducible
const seeded = (seed: number) => () => { seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff; return seed / 0x80000000; };
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test("rapid tap passes on the 25th tap inside 5 seconds and not otherwise", () => {
  assert.equal(tapPassed(TAP_GOAL, TAP_MS), true);
  assert.equal(tapPassed(TAP_GOAL - 1, 100), false);
  assert.equal(tapPassed(TAP_GOAL, TAP_MS + 1), false);
});

test("distractors sit one or two values off the target on one channel", () => {
  const d = distractors("#9184D9");
  assert.equal(d.length, 12);
  assert.ok(d.includes("#9184DA") && d.includes("#9184D7") && d.includes("#9186D9") && d.includes("#8F84D9"));
  for (const c of d) {
    const diff = channels(c).map((v, i) => Math.abs(v - channels("#9184D9")[i]));
    assert.deepEqual(diff.filter((x) => x).length, 1);
    assert.ok(Math.max(...diff) <= 2);
  }
});

test("a round has 5 to 10 targets and every distractor is within two values of the target", () => {
  for (let s = 1; s < 50; s++) {
    const h = huntRound(seeded(s));
    const targets = h.words.filter((w) => w.target);
    assert.ok(targets.length >= 5 && targets.length <= 10, `${targets.length} targets`);
    assert.ok(targets.every((w) => w.color === h.target));
    for (const w of h.words.filter((w) => !w.target)) {
      assert.notEqual(w.color, h.target);
      assert.ok(channels(w.color).every((v, i) => Math.abs(v - channels(h.target)[i]) <= 2), `${w.color} is close to ${h.target}`);
    }
  }
});

test("the hunt passes only on an exact selection", () => {
  const h = huntRound(seeded(7));
  const exact = new Set(h.words.flatMap((w, i) => (w.target ? [i] : [])));
  assert.equal(checkHunt(h, exact), true);
  const missed = new Set(exact); missed.delete([...exact][0]);
  assert.equal(checkHunt(h, missed), false);
  const extra = new Set(exact); extra.add(h.words.findIndex((w) => !w.target));
  assert.equal(checkHunt(h, extra), false);
});
