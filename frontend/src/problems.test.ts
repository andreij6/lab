import { test } from "node:test";
import assert from "node:assert/strict";
import { isProblemNote, mergeAttempt, noteHash, parseProblem, problemTemplate } from "./problems.ts";

test("the template parses back into a problem with one lean claim", async () => {
  const t = problemTemplate("Twin primes", "mathematics", "Are there infinitely many?");
  assert.ok(isProblemNote(t));
  const p = parseProblem(t);
  assert.equal(p.field, "mathematics");
  assert.equal(p.status, "open");
  assert.equal(p.statement, "Are there infinitely many?");
  assert.deepEqual(p.claims, [{ n: 1, title: "Twin primes", lean: true }]);
  assert.match(await noteHash(t), /^[0-9a-f]{64}$/);
});

test("claims are the ### headings under ## Claims only; depends come from front matter", () => {
  const p = parseProblem(`---
type: problem
field: Physics
status: partial
depends: [[Lemmas]], [[Units]]
---
# X

## Statement

a < b  and
c > d

## Claims

### Claim 1: bound
prose only
### Claim 2 - the hard one

\`\`\`lean
theorem t : 1 = 1 := rfl
\`\`\`

## Notes

### not a claim
`);
  assert.equal(p.status, "partial");
  assert.equal(p.statement, "a < b and c > d");
  assert.deepEqual(p.claims.map((c) => [c.n, c.title, c.lean]), [[1, "bound", false], [2, "the hard one", true]]);
  assert.deepEqual(p.depends, ["Lemmas", "Units"]);
});

test("merging an attempt appends under ## Attempts, before the next section", () => {
  const out = mergeAttempt("# P\n\n## Attempts\n\n## Related\n\n- x\n", "@ann", "Try 1", "---\nattempt_of: 3\n---\n# Try 1\n\nbody here\n");
  assert.ok(out.includes("## Attempts\n\n### Try 1 — by @ann\n\nbody here\n\n## Related"));
  assert.ok(mergeAttempt("# P\n", "@b", "T", "x").endsWith("## Attempts\n\n### T — by @b\n\nx\n"));
});
