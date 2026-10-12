import { test } from "node:test";
import assert from "node:assert/strict";
import { continueList, indentLines, toggleTask } from "./editor.ts";

test("enter continues bullets, numbers and tasks; ends on empty items", () => {
  let r = continueList("- one", 5)!;
  assert.equal(r.value, "- one\n- ");
  assert.equal(r.start, 8);
  r = continueList("  3. three", 10)!;
  assert.equal(r.value, "  3. three\n  4. ");
  r = continueList("- [x] done", 10)!;
  assert.equal(r.value, "- [x] done\n- [ ] ");
  r = continueList("* a\n* ", 6)!;
  assert.equal(r.value, "* a\n", "empty item ends the list");
  assert.equal(r.start, 4);
  assert.equal(continueList("plain text", 5), null);
  r = continueList("- one two", 5)!;
  assert.equal(r.value, "- one\n-  two", "splitting mid-item keeps the tail on the new item");
});

test("tab indents and shift-tab outdents the selected lines", () => {
  let r = indentLines("- a\n- b\n- c", 4, 9);
  assert.equal(r.value, "- a\n\t- b\n\t- c");
  assert.equal(r.start, 5);
  assert.equal(r.end, 11);
  r = indentLines("- a\n- b\n- c", 4, 8);
  assert.equal(r.value, "- a\n\t- b\n- c", "a selection ending at a line start leaves that line alone");
  r = indentLines("\t- a\n    - b\n  - c", 0, 18, true);
  assert.equal(r.value, "- a\n- b\n- c");
  r = indentLines("x", 1, 1);
  assert.equal(r.value, "\tx");
  assert.equal(r.start, 2);
});

test("toggling the n-th task flips only that box", () => {
  const src = "- [ ] a\n- [x] b\n  - [ ] c\n1. [ ] d\n- plain";
  assert.equal(toggleTask(src, 0), "- [x] a\n- [x] b\n  - [ ] c\n1. [ ] d\n- plain");
  assert.equal(toggleTask(src, 1), "- [ ] a\n- [ ] b\n  - [ ] c\n1. [ ] d\n- plain");
  assert.equal(toggleTask(src, 3), "- [ ] a\n- [x] b\n  - [ ] c\n1. [x] d\n- plain");
  assert.equal(toggleTask(src, 9), src);
});
