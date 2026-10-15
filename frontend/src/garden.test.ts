import { test } from "node:test";
import assert from "node:assert/strict";
import { addLink, addTag, suggest, words } from "./garden.ts";
import { buildIndex } from "./notes.ts";

const notes = [
  { path: "Rust.md", content: "---\ntags: [lang, systems]\n---\n# Rust\nOwnership and borrowing make Rust memory safe. See [[Ownership]]. Canisters on the Internet Computer are often written in Rust." },
  { path: "Ownership.md", content: "---\ntags: [lang]\n---\n# Ownership\nEvery value has one owner; borrowing lends it. Memory safe without a garbage collector, which Rust relies on." },
  { path: "Canisters.md", content: "# Canisters\nA canister is a smart contract on the Internet Computer, often written in Rust, with memory and cycles. Ownership of a canister is a controller." },
  { path: "Cycles.md", content: "# Cycles\nCycles pay for a canister's compute and memory on the Internet Computer. A canister that runs out of cycles is frozen. Smart contract fuel, in short, for compute and memory." },
  { path: "Agents/log.md", content: "# Log\nRust Rust Rust canisters canisters" },
];
const idx = buildIndex(notes);

test("garden: a title named but not linked, overlapping pairs, tags from neighbours", () => {
  const s = suggest(notes, idx);
  const link = s.filter((x) => x.kind === "link");
  assert.ok(link.some((x) => x.kind === "link" && x.from === "Canisters.md" && x.to === "Rust.md"), "Canisters mentions Rust");
  assert.ok(!link.some((x) => x.kind === "link" && x.from === "Rust.md" && x.to === "Ownership.md"), "already linked");
  assert.ok(!s.some((x) => (x as { from?: string }).from?.startsWith("Agents/")), "agents' notes stay out");
  assert.ok(s.some((x) => x.kind === "pair" && [x.from, x.to].includes("Cycles.md") && [x.from, x.to].includes("Canisters.md")), "cycles and canisters overlap");
  const hidden = s.map((x) => x.key);
  assert.equal(suggest(notes, idx, hidden).length, 0, "hidden keys are gone");
  assert.deepEqual(suggest(notes, idx), s, "deterministic");
});

test("garden: words drop stop words and front matter", () => {
  const w = words("---\ntags: [x]\n---\nThe quick brown fox and the lazy dog");
  assert.ok(w.has("quick") && w.has("fox") && !w.has("the") && !w.has("and") && !w.has("tags"));
});

test("garden: accepting adds a link under Related and a tag to the front matter", () => {
  const a = addLink("# A\nText.\n", "B");
  assert.equal(a, "# A\nText.\n\n## Related\n\n- [[B]]\n");
  const b = addLink(a, "C");
  assert.ok(b.includes("- [[B]]\n- [[C]]\n") && b.split("## Related").length === 2);
  assert.equal(addLink(b, "C"), b, "no duplicates");
  const mid = addLink("# A\n\n## Related\n\n- [[X]]\n\n## Notes\n\nmore\n", "Y");
  assert.ok(mid.includes("- [[X]]\n- [[Y]]\n\n## Notes"), mid);
  const t = addTag("---\ntags: [lang]\n---\n# R\n", "systems");
  assert.ok(t.startsWith("---\ntags: [lang, systems]\n"), t);
  assert.equal(addTag(t, "systems"), t);
  assert.ok(addTag("# Plain\n", "new").includes("tags: [new]"));
});
