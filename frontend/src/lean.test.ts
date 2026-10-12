import { test } from "node:test";
import assert from "node:assert/strict";
import { align, isLeanNote, leanCode, parseBinders, parseLean, proseSteps, statementCard, unmentionedHyps } from "./lean.ts";

const NOTE = `# Squares

\`\`\`lean
import Mathlib

/-- Every integer n ≥ 2 has a prime factor. -/
-- step: ^exists-prime
theorem has_prime_factor (n : ℕ) (hn : 2 ≤ n) : ∃ p, p.Prime ∧ p ∣ n := by
  exact Nat.exists_prime_and_dvd (by omega)

/-- The sum is even when both parts are. -/
lemma even_sum {a b : ℤ} (ha : Even a) (hb : Even b) (hbig : 100 < b) : Even (a + b) := by
  sorry

theorem unused (x : ℕ) : x = x := rfl

axiom magic : False
\`\`\`
`;

test("declarations, docstrings, binders, flags and step tags", () => {
  assert.ok(isLeanNote(NOTE));
  const ds = parseLean(leanCode(NOTE));
  assert.deepEqual(ds.map((d) => d.name), ["has_prime_factor", "even_sum", "unused", "magic"]);
  assert.equal(ds[0].doc, "Every integer n ≥ 2 has a prime factor.");
  assert.deepEqual(ds[0].steps, ["exists-prime"]);
  assert.deepEqual(ds[0].hyps, [{ name: "n", type: "ℕ", implicit: false }, { name: "hn", type: "2 ≤ n", implicit: false }]);
  assert.equal(ds[0].statement, "∃ p, p.Prime ∧ p ∣ n");
  assert.deepEqual(ds[1].flags, ["sorry"]);
  assert.deepEqual(ds[3].flags, ["axiom"]);
  assert.equal(ds[2].doc, "");
  assert.deepEqual(parseBinders("{a b : ℤ} (ha : Even a) [inst : Fintype α]"), [{ name: "a", type: "ℤ", implicit: true }, { name: "b", type: "ℤ", implicit: true }, { name: "ha", type: "Even a", implicit: false }, { name: "inst", type: "Fintype α", implicit: true }]);
  assert.match(statementCard(ds[0]).lean, /^theorem has_prime_factor \(n : ℕ\) \(hn : 2 ≤ n\) : ∃ p/);
  assert.match(statementCard(ds[2]).english, /no docstring/);
});

test("alignment: backed steps, informal-only steps, formal-only lemmas", () => {
  const prose = "Take n ≥ 2. ^exists-prime\nThen the sum of two evens is even. ^even-sum\nHence done. ^done\n";
  const a = align(prose, parseLean(leanCode(NOTE)));
  assert.deepEqual(a.backed.map((b) => [b.id, b.lemmas]), [["exists-prime", ["has_prime_factor"]]]);
  assert.deepEqual(a.informalOnly.map((s) => s.id), ["even-sum", "done"]);
  assert.deepEqual(a.formalOnly.map((d) => d.name), ["even_sum", "unused"]);
  assert.ok(Math.abs(a.coverage - 1 / 3) < 1e-9);
  assert.deepEqual(proseSteps("no ids here"), []);
});

test("hypotheses the prose never mentions", () => {
  const ds = parseLean(leanCode(NOTE));
  const prose = "Let a and b be even integers. Then a + b is even.";
  assert.deepEqual(unmentionedHyps(ds[1], prose).map((h) => h.name), ["hbig"]);
  assert.deepEqual(unmentionedHyps(ds[0], "Take an integer n with 2 ≤ n.").map((h) => h.name), []);
  assert.deepEqual(unmentionedHyps(ds[0], "Take an integer.").map((h) => h.name), ["hn"]);
});
