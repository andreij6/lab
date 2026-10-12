import { test } from "node:test";
import assert from "node:assert/strict";
import { diffLines } from "./diff.ts";

test("line diff marks additions, removals and kept lines", () => {
  const d = diffLines("a\nb\nc", "a\nx\nc\nd");
  assert.deepEqual(d.map((r) => r.kind + r.text), [" a", "-b", "+x", " c", "+d"]);
  assert.deepEqual(diffLines("same", "same"), [{ kind: " ", text: "same" }]);
  assert.deepEqual(diffLines("", "new").map((r) => r.kind), ["-", "+"]);
});
