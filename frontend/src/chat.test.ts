import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "./notes.ts";
import { answer, cited, decide, excerpt, inFolders, terms } from "./chat.ts";

const notes = [
  { path: "Projects/Rust on ICP.md", content: "# Rust on ICP\n\nCanisters compile to wasm. Cycles keep a canister alive.\n#icp", modified: 3 },
  { path: "Daily/2026-10-10.md", content: "Met Sam. Talked about cycles pricing and the ledger.", modified: 2 },
  { path: "Cooking/Pasta.md", content: "Boil water, add salt. #food", modified: 1 },
  { path: "img.png", content: "cycles cycles cycles", modified: 9 },
  { path: "Agents/Note.md", content: "Agent thoughts on canisters.", modified: 1, agent: "bot" },
];
const idx = buildIndex(notes);

test("terms drop stop words and dedupe", () => {
  assert.deepEqual(terms("How do I keep a canister alive with cycles? cycles!"), ["keep", "canister", "alive", "cycles"]);
  assert.deepEqual(terms("the a an"), []);
});

test("decide ranks title and tag hits above body hits, skips attachments", () => {
  const picks = decide("how do cycles keep a canister alive on ICP", notes, idx);
  assert.equal(picks[0].path, "Projects/Rust on ICP.md");
  assert.ok(picks[0].why.some((w) => w.startsWith("title")));
  assert.ok(picks.every((p) => p.path !== "img.png"));
  assert.ok(picks.every((p) => p.path !== "Cooking/Pasta.md"));
  assert.ok(picks[0].snippet.length > 0);
});

test("folders narrow the choice; root is the empty folder", () => {
  assert.ok(inFolders("a.md", new Set([""])));
  assert.ok(inFolders("A/B/c.md", new Set(["A"])));
  assert.ok(!inFolders("AB/c.md", new Set(["A"])));
  const only = decide("canister cycles", notes, idx, { folders: new Set(["Daily"]) });
  assert.deepEqual(only.map((p) => p.path), ["Daily/2026-10-10.md"]);
  assert.deepEqual(decide("canister", notes, idx, { folders: new Set() }), []);
});

test("answer quotes the picks and says when there are none", () => {
  const a = answer("cycles", decide("cycles", notes, idx));
  assert.match(a, /\[\[Rust on ICP\]\]/);
  assert.match(answer("zzz", []), /did not find/);
});

test("excerpts centre on the question and citations are read back", () => {
  const body = `---\ntags: x\n---\n${"filler ".repeat(400)}The canister owns the notebook. ${"tail ".repeat(400)}`;
  const e = excerpt(body, "who owns the canister?", 300);
  assert.ok(e.length <= 302 && e.includes("canister owns") && e.startsWith("…") && !e.includes("tags:"));
  assert.equal(excerpt("short note", "x"), "short note");
  assert.deepEqual(cited("A [2] and B [1][2], not [9] or [0].", 3), [2, 1]);
  assert.deepEqual(cited("Both [1, 3] say so.", 3), [1, 3]);
});
