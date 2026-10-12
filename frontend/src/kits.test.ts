import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, parseWorkbook } from "./sheet.ts";
import { bibliography, careQuestions, careSummary, careWorkbook, changelog, citeIn, citedKeys, claims, compileThesis, continuity, fromCrossref, manuscript, nextAdr, parseBibtex, reference, sourceFromNote, sourceNote, timeline, words } from "./kits.ts";

const BIB = `@article{smith2020sleep,
  author = {Smith, Jane Ann and Lee, Bo},
  title = {{Sleep} and memory in students},
  journal = "Journal of Sleep",
  year = 2020, volume = {12}, number = {3}, pages = {45--67},
  doi = {10.1000/js.2020.3}
}
@book{ng2018, author = {Andrew Ng and Kim, Ji and Park, Su}, title = {Learning Machines}, publisher = {Acme Press}, year = {2018}}
@comment{ignore me}`;

test("BibTeX, Crossref, source notes and citation styles", () => {
  const [a, b] = parseBibtex(BIB);
  assert.equal(a.key, "smith2020sleep");
  assert.deepEqual(a.authors, [{ family: "Smith", given: "Jane Ann" }, { family: "Lee", given: "Bo" }]);
  assert.equal(a.title, "Sleep and memory in students");
  assert.equal(a.pages, "45–67");
  assert.equal(b.authors[0].family, "Ng");
  assert.equal(citeIn(a, "apa"), "(Smith & Lee, 2020)");
  assert.equal(citeIn(b, "apa", "p. 4"), "(Ng et al., 2018, p. 4)");
  assert.equal(citeIn(a, "chicago"), "(Smith and Lee 2020)");
  assert.equal(reference(a, "apa"), "Smith, J. A., & Lee, B. (2020). Sleep and memory in students. *Journal of Sleep*, *12*(3), 45–67. https://doi.org/10.1000/js.2020.3");
  assert.equal(reference(b, "chicago"), "Ng, Andrew, Ji Kim, and Su Park. 2018. *Learning Machines*. Acme Press.");
  const back = sourceFromNote(sourceNote(a))!;
  assert.deepEqual([back.key, back.title, back.authors.length, back.journal, back.doi], ["smith2020sleep", "Sleep and memory in students", 2, "Journal of Sleep", "10.1000/js.2020.3"]);
  const cr = fromCrossref({ title: ["Deep sleep"], author: [{ family: "Wu", given: "Li" }], issued: { "date-parts": [[2021, 5]] }, "container-title": ["Nature"], DOI: "10.1/x", page: "1-9", type: "journal-article" });
  assert.equal(cr.key, "wu2021deep");
  assert.equal(cr.pages, "1–9");
  const draft = "As shown [@smith2020sleep, p. 50] and [@ng2018]; also [@nobody].";
  assert.deepEqual(citedKeys(draft), ["smith2020sleep", "ng2018", "nobody"]);
  const bib = bibliography(draft, [a, b], "apa");
  assert.ok(bib.md.indexOf("Ng, A.") < bib.md.indexOf("Smith, J. A."));
  assert.deepEqual(bib.missing, ["nobody"]);
});

test("claims and the thesis compiler", () => {
  const [a] = parseBibtex(BIB);
  const draft = "Claim:: Sleep helps memory [@smith2020sleep]\n- Claim:: Naps beat coffee\nClaim:: See [[Pilot study]]\nClaim:: Weak one [@smith2020sleep]";
  const cs = claims(draft, [a], () => "weak");
  assert.deepEqual(cs.map((c) => c.status), ["weak", "missing", "supported", "weak"]);
  assert.equal(claims(draft, [a], () => "strong")[0].status, "supported");
  const chapters: Record<string, string> = { "Ch 1": "---\nx: 1\n---\n# Intro\nText [@smith2020sleep].\n![A chart](c.png)", "Ch 2": "# Method\n![Setup](s.png)" };
  const r = compileThesis("---\ntitle: My Thesis\n---\n# My Thesis\n1. [[Ch 1]]\n2. [[Ch 2]]\n3. [[Ch 3]]", (t) => chapters[t], [a], "apa");
  assert.equal(r.figures, 2);
  assert.match(r.md, /^# My Thesis/);
  assert.match(r.md, /Text \(Smith & Lee, 2020\)\./);
  assert.match(r.md, /\*Figure 2\. Setup\*/);
  assert.match(r.md, /## References\n\nSmith, J\. A\./);
  assert.deepEqual(r.missing, ["Ch 3"]);
});

test("manuscript, continuity and timeline", () => {
  const scenes = [
    { path: "Book/Arrival.md", content: "---\ntype: scene\nchapter: Chapter 1\norder: 2\n---\nMara looked up, her green eyes wide." },
    { path: "Book/Dawn.md", content: "---\ntype: scene\nchapter: Chapter 1\norder: 1\ndate: Year 1203, day 4\n---\nThe sun rose over the hills." },
    { path: "Book/War.md", content: "---\ntype: scene\nchapter: Chapter 2\norder: 3\n---\nThe 40-year-old Mara Vell rode north. Tom's hair was grey." },
  ];
  const m = manuscript(scenes);
  assert.deepEqual(m.map((c) => c.chapter), ["Chapter 1", "Chapter 2"]);
  assert.deepEqual(m[0].scenes.map((s) => s.title), ["Dawn", "Arrival"]);
  assert.equal(words("---\na: 1\n---\nOne two, three."), 3);
  const bible = [{ path: "Bible/Mara Vell.md", content: "---\ntype: character\neyes: brown\nage: 34\n---\n" }];
  const issues = continuity(bible, scenes);
  assert.deepEqual(issues.map((i) => `${i.property}:${i.found}`), ["eyes:green", "age:40"]);
  const tl = timeline([...scenes, { path: "Lore.md", content: "- The great flood date:: Year 1100, day 2\n- Founding date:: Year 1203, day 1" }]);
  assert.deepEqual(tl.map((e) => e.text), ["The great flood", "Founding", "Dawn"]);
});

test("care log, questions and the appointment summary", () => {
  const wb = parseWorkbook(careWorkbook());
  assert.equal(wb.sheets.map((s) => s.name).join(","), "Log,Days");
  const days = evaluate(wb).get("Days")!;
  assert.equal(days[14][1], 3);
  const qs = careQuestions([{ path: "Care/Diary.md", content: "Felt dizzy\nQ:: Is the dizziness from the new dose?\n- Ask:: Can I take it with food?", modified: 5 }, { path: "Old.md", content: "Q:: old", modified: 1 }], 3);
  assert.deepEqual(qs.map((q) => q.q), ["Is the dizziness from the new dose?", "Can I take it with food?"]);
  const sum = careSummary(evaluate(wb).get("Log")!, qs);
  assert.match(sum, /Example medicine: 1 dose logged/);
  assert.match(sum, /Headache: 1 time, average severity 3\.0\/10/);
  assert.match(sum, /- \[ \] Can I take it with food\? \(\[\[Care\/Diary\]\]\)/);
  assert.match(sum, /not a medical record/);
});

test("ADR numbering and the changelog", () => {
  assert.equal(nextAdr(["Decisions/ADR-0001 Use Rust.md", "Decisions/ADR-0012 Cache.md", "x.md"]), "ADR-0013");
  assert.equal(nextAdr([]), "ADR-0001");
  const { md, changes } = changelog([
    { path: "c1.md", content: "---\nversion: 1.2.0\ndate: 2026-10-01\nkind: added\n---\n# Dark mode #changelog" },
    { path: "c2.md", content: "---\ntype: change\nversion: 1.10.0\nkind: fixed\n---\n# Crash on save" },
    { path: "c3.md", content: "---\ntype: change\nkind: security\n---\n# Pin deps" },
    { path: "x.md", content: "# nothing" },
  ]);
  assert.equal(changes.length, 3);
  assert.ok(md.indexOf("## Unreleased") < md.indexOf("## 1.10.0") && md.indexOf("## 1.10.0") < md.indexOf("## 1.2.0 – 2026-10-01"));
  assert.match(md, /### Added\n\n- Dark mode\n/);
  assert.equal(evaluate(parseWorkbook(careWorkbook())).get("Days")![14][2], 2);
});
