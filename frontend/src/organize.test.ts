import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "./notes.ts";
import { applyRule, inferType, isFaded, isoWeek, keepLater, lint, nextToResurface, parseQuery, periodName, periodRollup, propertyColumns, renameProperty, renameTag, retarget, runQuery, setProperty, splitAtHeadings } from "./organize.ts";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 12, 12);
const N = (path: string, content: string, ageDays = 1, createdDays = ageDays) => ({ path, content, modified: now - ageDays * DAY, created: now - createdDays * DAY });

test("saved searches: tags, properties, ages, folders, negation, phrases", () => {
  const notes = [
    N("Clients/Acme.md", "---\nstatus: open\npriority: 3\ntags: [client]\n---\n# Acme\nRenewal call", 2),
    N("Clients/Beta.md", "---\nstatus: closed\npriority: 1\n---\n#client done deal", 3),
    N("Inbox/Idea.md", "# Idea\n#client maybe someday", 40),
  ];
  const names = (q: string) => runQuery(notes, q, now).map((n) => n.path);
  assert.deepEqual(names("tag:#client status:open modified:<7d"), ["Clients/Acme.md"]);
  assert.deepEqual(names("tag:client -folder:Clients"), ["Inbox/Idea.md"]);
  assert.deepEqual(names("priority:>2"), ["Clients/Acme.md"]);
  assert.deepEqual(names('"renewal call"'), ["Clients/Acme.md"]);
  assert.deepEqual(names("has:status modified:>2d"), ["Clients/Beta.md"]);
  assert.equal(parseQuery("-tag:x").length, 1);
});

test("property types and editing", () => {
  assert.equal(inferType(["2026-10-01", "2026-10-02"]), "date");
  assert.equal(inferType(["3", "4.5"]), "number");
  assert.equal(inferType(["yes", "no"]), "checkbox");
  assert.equal(inferType(["@ada", "[@bob, @cy]"]), "people");
  assert.equal(inferType(["open", "closed", "open", "open"]), "choice");
  const cols = propertyColumns([N("a.md", "---\nstatus: open\ndue: 2026-10-01\n---\n"), N("b.md", "---\nstatus: closed\n---\n"), N("c.md", "---\nstatus: open\n---\n")]);
  assert.deepEqual(cols.map((c) => [c.key, c.type]), [["status", "choice"], ["due", "date"]]);
  assert.equal(setProperty("---\na: 1\n---\nbody", "b", "2"), "---\na: 1\nb: 2\n---\nbody");
  assert.equal(setProperty("---\na: 1\n---\nbody", "a", ""), "body");
});

test("periodic notes: names, ranges and the rollup", () => {
  assert.deepEqual(isoWeek(new Date(2026, 0, 1)), { year: 2026, week: 1 });
  assert.equal(periodName("week", new Date(2026, 9, 12)), "2026-W42");
  assert.equal(periodName("month", new Date(2026, 9, 12)), "2026-10");
  assert.equal(periodName("quarter", new Date(2026, 9, 12)), "2026-Q4");
  const d = new Date(2026, 9, 12);
  const notes = [N("Plan.md", "- [x] Book permit\n- [ ] Buy fuel\nDecision:: go north", 0, 0), N("Old.md", "x", 90, 90), N("Periodic/2026-W42.md", "- [ ] skip me", 0, 0)];
  const r = periodRollup("week", d, notes);
  assert.match(r, /## Created\n\n- \[\[Plan\]\]/);
  assert.match(r, /- \[x\] Book permit \(\[\[Plan\]\]\)/);
  assert.match(r, /- \[ \] Buy fuel/);
  assert.match(r, /- go north \(\[\[Plan\]\]\)/);
  assert.ok(!r.includes("skip me") && !r.includes("[[Old]]"));
  assert.match(periodRollup("quarter", d, []), /\[\[Periodic\/2026-10\]\][\s\S]*\[\[Periodic\/2026-12\]\]/);
});

test("lint finds orphans, broken links, duplicates, empty folders and stale projects", () => {
  const notes = [N("index.md", "[[A]] [[Missing]]"), N("A.md", "# A"), N("Lonely.md", "alone"), N("x/A.md", "dup"), N("P.md", "---\ntype: project\nstatus: active\n---\n[[A]]", 45)];
  const kinds = lint(notes, buildIndex(notes), ["x", "Empty"], now).map((i) => `${i.kind}:${i.path}`);
  assert.ok(kinds.includes("orphan:Lonely.md") && !kinds.includes("orphan:index.md"));
  assert.ok(kinds.includes("broken:index.md"));
  assert.ok(kinds.includes("duplicate:A.md") && kinds.includes("duplicate:x/A.md"));
  assert.ok(kinds.includes("empty-folder:Empty") && !kinds.includes("empty-folder:x"));
  assert.ok(kinds.includes("stale-project:P.md"));
});

test("refactors: tags, properties, splitting and retargeting links", () => {
  assert.equal(renameTag("---\ntags: [old, keep]\n---\nSee #old and #old/sub, not #older", "old", "new"), "---\ntags: [new, keep]\n---\nSee #new and #new/sub, not #older");
  assert.equal(renameProperty("---\nstate: open\nx: 1\n---\nb", "state", "status"), "---\nstatus: open\nx: 1\n---\nb");
  const s = splitAtHeadings("---\na: 1\n---\nIntro\n## One\nfirst\n## Two/Three\nsecond\n");
  assert.equal(s.intro, "---\na: 1\n---\nIntro\n");
  assert.deepEqual(s.parts.map((p) => p.title), ["One", "Two Three"]);
  assert.equal(s.parts[0].body, "# One\nfirst\n");
  assert.equal(retarget("[[B]] [[Notes/B|bee]] [[B#h]] ![[B]] [[Bee]]", "Notes/B.md", "Notes/A.md"), "[[Notes/A]] [[Notes/A|bee]] [[Notes/A#h]] ![[Notes/A]] [[Bee]]");
});

test("resurfacing, decay and rules", () => {
  const notes = [N("new.md", "x", 1), N("old.md", "x", 200), N("older.md", "x", 400)];
  assert.equal(nextToResurface(notes, {}, now)?.path, "older.md");
  const s = keepLater({}, "older.md", now);
  assert.equal(nextToResurface(notes, s, now)?.path, "old.md");
  assert.equal(keepLater(s, "older.md", now)["older.md"].interval, 14);
  assert.ok(isFaded(notes[1], 180, new Set(), now) && !isFaded(notes[1], 180, new Set(["old.md"]), now) && !isFaded(notes[1], 0, new Set(), now));
  assert.ok(isFaded(N("Archive/x.md", "x", 1), 0, new Set(), now));
  const r = applyRule({ id: "m1", tag: "meeting", folder: "Meetings", weekly: true }, "Inbox/Sync.md", "# Sync\n#meeting", "---\ntype: meeting\n---\n## Notes\n");
  assert.ok(r.applied && r.move === "Meetings/Sync.md" && r.weekly);
  assert.match(r.content, /type: meeting[\s\S]*rule-m1: \d{4}[\s\S]*## Notes/);
  assert.equal(applyRule({ id: "m1", tag: "meeting" }, "Meetings/Sync.md", r.content).applied, false);
});
