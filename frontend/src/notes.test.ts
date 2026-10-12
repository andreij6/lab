import { test } from "node:test";
import assert from "node:assert/strict";
import { backlinkContext, buildIndex, frontmatter, fuzzy, graphData, headings, outsideCode, parseAliases, parseLinks, parseTags, resolve, search, section, setFrontmatter, tree, untitled } from "./notes.ts";

test("links: alias, heading, embed, no nesting", () => {
  const l = parseLinks("a [[Note]] b [[Dir/Note|shown]] c [[Note#Heading]] d ![[img.png]] e [[ [[x]] ]] f [[]]");
  assert.deepEqual(
    l.map(({ target, alias, heading, embed }) => [target, alias, heading, embed]),
    [["Note", "", "", false], ["Dir/Note", "shown", "", false], ["Note", "", "Heading", false], ["img.png", "", "", true], ["x", "", "", false]],
  );
});

test("code spans and fences hide links and tags", () => {
  const c = "[[A]] `[[B]]` #t1 `#t2`\n```\n[[C]] #t3\n```\n[[D]]";
  assert.deepEqual(parseLinks(c).map((l) => l.target), ["A", "D"]);
  assert.deepEqual(parseTags(c), ["t1"]);
  assert.equal(outsideCode(c, (x) => x.toUpperCase()), "[[A]] `[[B]]` #T1 `#t2`\n```\n[[C]] #t3\n```\n[[D]]");
  assert.equal(outsideCode("open ```fence", (x) => x.toUpperCase()), "OPEN ```fence");
});

test("tags: body and front matter, numeric excluded", () => {
  assert.deepEqual(parseTags("#one two#notatag #two/sub #123 #a1\n#three"), ["one", "two/sub", "a1", "three"]);
  assert.deepEqual(parseTags("---\ntitle: x\ntags: [alpha, beta]\n---\n#gamma"), ["gamma", "alpha", "beta"]);
  assert.deepEqual(frontmatter("---\nk: v\n---\nbody").body, "body");
  assert.deepEqual(frontmatter("no fm").data, {});
});

test("resolve: paths exact, names case-insensitive and shortest", () => {
  const paths = ["Deep/Dir/Note.md", "Note.md", "Other/note.md", "img.png"];
  assert.equal(resolve("note", paths), "Note.md");
  assert.equal(resolve("Deep/Dir/Note", paths), "Deep/Dir/Note.md");
  assert.equal(resolve("Deep/Dir/Note.md", paths), "Deep/Dir/Note.md");
  assert.equal(resolve("img.png", paths), "img.png");
  assert.equal(resolve("missing", paths), undefined);
});

test("index: links, backlinks, unresolved, tags", () => {
  const idx = buildIndex([
    { path: "A.md", content: "to [[B]] and [[Nope]] #t1" },
    { path: "d/B.md", content: "back to [[A]] and [[#local]] #t1 #t2" },
  ]);
  assert.deepEqual([...idx.links.get("A.md")!], ["d/B.md"]);
  assert.deepEqual([...idx.unresolved.get("A.md")!], ["Nope"]);
  assert.deepEqual([...idx.backlinks.get("A.md")!], ["d/B.md"]);
  assert.deepEqual([...idx.backlinks.get("d/B.md")!], ["A.md", "d/B.md"]);
  assert.deepEqual([...idx.tags.get("t1")!], ["A.md", "d/B.md"]);
});

test("search, tree, untitled", () => {
  const notes = [{ path: "Recipes/Pie.md", content: "apple pie" }, { path: "Todo.md", content: "buy apples" }];
  assert.deepEqual(search(notes, "pie").map((h) => h.path), ["Recipes/Pie.md"]);
  assert.deepEqual(search(notes, "APPLE").map((h) => h.path), ["Recipes/Pie.md", "Todo.md"]);
  assert.equal(search(notes, "  ").length, 0);
  const t = tree(["b/x.md", "a.md", "b/c/y.md"], ["empty", "b/c", "b/a-empty"]);
  assert.deepEqual(t.files, ["a.md"]);
  assert.deepEqual(t.folders.map((f) => f.path), ["b", "empty"]);
  assert.deepEqual(t.folders[0].folders.map((f) => f.path), ["b/a-empty", "b/c"]);
  assert.deepEqual(t.folders[0].folders[1].files, ["b/c/y.md"]);
  assert.equal(untitled(["Untitled.md"]), "Untitled 1.md");
  assert.equal(untitled([], "f"), "f/Untitled.md");
});

test("fuzzy switcher, backlink context, graph data", () => {
  const paths = ["Projects/Big Ideas.md", "Daily/2026-10-10.md", "Ideas.md", "Bibliography.md"];
  assert.deepEqual(fuzzy("ideas", paths), ["Ideas.md", "Projects/Big Ideas.md"]);
  assert.deepEqual(fuzzy("bi", paths).slice(0, 2), ["Bibliography.md", "Projects/Big Ideas.md"]);
  assert.deepEqual(fuzzy("zzz", paths), []);
  assert.deepEqual(fuzzy("", paths).length, 4);
  const notes = [
    { path: "A.md", content: "intro\nsee [[B]] here\n[[C]]" },
    { path: "B.md", content: "[[A|back]]" },
    { path: "C.md", content: "lonely [[Ghost]]" },
  ];
  assert.equal(backlinkContext(notes[0], "B.md", notes.map((n) => n.path)), "see [[B]] here");
  assert.equal(backlinkContext(notes[0], "C.md", notes.map((n) => n.path)), "[[C]]");
  assert.equal(backlinkContext(notes[1], "C.md", notes.map((n) => n.path)), "");
  const idx = buildIndex(notes);
  const g = graphData(notes, idx);
  assert.deepEqual(g.nodes.map((n) => [n.id, n.degree]), [["A.md", 2], ["B.md", 1], ["C.md", 1]]);
  assert.equal(g.edges.length, 2, "A<->B counted once");
  const withAgent = graphData([...notes, { path: "Agents/claude/Summary.md", content: "sums up [[A]]", agent: "claude" }], buildIndex([...notes, { path: "Agents/claude/Summary.md", content: "sums up [[A]]", agent: "claude" }]));
  assert.equal(withAgent.nodes.find((n) => n.id === "Agents/claude/Summary.md")?.agent, "claude");
  assert.equal(withAgent.nodes.find((n) => n.id === "A.md")?.agent, undefined);
  const ghosts = graphData(notes, idx, { unresolved: true });
  assert.ok(ghosts.nodes.some((n) => n.unresolved && n.label === "Ghost"));
  const local = graphData(notes, idx, { focus: "B.md", depth: 1 });
  assert.deepEqual(local.nodes.map((n) => n.id).sort(), ["A.md", "B.md"]);
  const local2 = graphData(notes, idx, { focus: "B.md", depth: 2 });
  assert.deepEqual(local2.nodes.map((n) => n.id).sort(), ["A.md", "B.md", "C.md"]);
});

test("aliases resolve links; headings, sections and search operators", () => {
  const notes = [
    { path: "People/Ada Lovelace.md", content: "---\naliases: [Ada, \"Countess\"]\ntags: [person]\n---\n# Ada\n\n## Work\nnotes on the engine\n\n### Detail\nmore\n\n## Life\nlater [[Babbage]]" },
    { path: "Babbage.md", content: "built the engine #person/victorian" },
  ];
  assert.deepEqual(parseAliases(notes[0].content), ["Ada", "Countess"]);
  const idx = buildIndex(notes);
  assert.equal(idx.aliases.get("countess"), "People/Ada Lovelace.md");
  assert.equal(resolve("ada", notes.map((n) => n.path), idx.aliases), "People/Ada Lovelace.md");
  assert.equal(resolve("Babbage", notes.map((n) => n.path), idx.aliases), "Babbage.md");
  assert.deepEqual(headings(notes[0].content).map((h) => [h.level, h.text]), [[1, "Ada"], [2, "Work"], [3, "Detail"], [2, "Life"]]);
  assert.equal(section(notes[0].content, "work"), "## Work\nnotes on the engine\n\n### Detail\nmore\n");
  assert.equal(section(notes[0].content, "Nope"), undefined);
  assert.deepEqual(search(notes, "tag:person").map((h) => h.path), ["People/Ada Lovelace.md", "Babbage.md"]);
  assert.deepEqual(search(notes, "tag:person/victorian").map((h) => h.path), ["Babbage.md"]);
  assert.deepEqual(search(notes, "path:people engine").map((h) => h.path), ["People/Ada Lovelace.md"]);
  assert.deepEqual(search(notes, "engine -later").map((h) => h.path), ["Babbage.md"]);
  assert.deepEqual(search(notes, '"the engine"').length, 2);
  assert.deepEqual(search(notes, "file:bab").map((h) => h.path), ["Babbage.md"]);
});

test("front matter can be rewritten from a form", () => {
  assert.equal(setFrontmatter("body", { tags: "[a, b]", status: "draft" }), "---\ntags: [a, b]\nstatus: draft\n---\nbody");
  assert.equal(setFrontmatter("---\nold: 1\n---\nbody", {}), "body");
  assert.equal(setFrontmatter("---\nold: 1\n---\nbody", { old: "2" }), "---\nold: 2\n---\nbody");
});
