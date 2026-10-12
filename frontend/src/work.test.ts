import { test } from "node:test";
import assert from "node:assert/strict";
import { MEETING_TEMPLATE, actionCards, decisions, isOverdue, markdownToDocx, meetingSummary, parseIcs, parseMeeting, parseTasks, people, reminders, setCell, sortTable, sortTasks, toggleTaskLine, tsvToTable, weeklyReview } from "./work.ts";
import { unzip } from "./unzip.ts";

const today = new Date(2026, 9, 11);

test("tasks: dates, owners, priority, ordering, toggling", () => {
  const notes = [{ path: "A.md", content: "- [ ] ship it @ada 📅 2026-10-09 ⏫\n- [x] done 📅 2026-10-11\n- [ ] later 📅 2026-12-01\n```\n- [ ] not a task\n```\n- [ ] no date 🔼" }];
  const ts = parseTasks(notes);
  assert.equal(ts.length, 4);
  assert.deepEqual([ts[0].owner, ts[0].due, ts[0].priority], ["ada", "2026-10-09", 2]);
  assert.ok(isOverdue(ts[0], today));
  assert.deepEqual(sortTasks(ts, today).map((t) => t.text.split(" ")[0]), ["ship", "done", "later", "no"]);
  assert.match(toggleTaskLine(notes[0].content, 0), /^- \[x\] ship it/);
  assert.match(toggleTaskLine(notes[0].content, 1), /\n- \[ \] done/);
});

test("meetings: parse, summary, action cards; decisions and people", () => {
  const md = MEETING_TEMPLATE("Kickoff", "2026-10-11", ["ada", "bob"], ["Scope"]).replace("- [ ] @owner task 📅 2026-10-11", "- [ ] @ada write the brief 📅 2026-10-14").replace("## Decisions\n\n- ", "## Decisions\n\n- Go with option B");
  const m = parseMeeting("Meetings/Kickoff.md", md);
  assert.deepEqual([m.title, m.date, m.attendees, m.agenda, m.decisions, m.actions], ["Kickoff", "2026-10-11", ["ada", "bob"], ["Scope"], ["Go with option B"], ["@ada write the brief 📅 2026-10-14"]]);
  assert.match(meetingSummary(m), /Decisions\n• Go with option B\n\nActions\n• @ada write the brief/);
  assert.deepEqual(actionCards(m), ["- [ ] @ada write the brief 📅 2026-10-14 (from [[Kickoff]])"]);
  const notes = [{ path: "Meetings/Kickoff.md", content: md }, { path: "N.md", content: "Decision:: keep Rust\n@bob owns it, @ada reviews" }, { path: "People/Ada.md", content: "---\ntype: person\nrole: PM\n---\n# Ada\n" }];
  assert.deepEqual(decisions(notes).map((d) => d.text), ["Go with option B", "keep Rust"]);
  const ps = people(notes);
  assert.deepEqual(ps.map((p) => [p.name, p.mentions.length, p.role ?? null]), [["ada", 2, "PM"], ["bob", 1, null]]);
});

test("ics import and the weekly review", () => {
  const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Roadmap\\, Q4\r\nDTSTART;TZID=Europe/Paris:20261014T090000\r\nATTENDEE;CN=\"Ada L\";ROLE=REQ:mailto:ada@x.io\r\nATTENDEE:mailto:bob@x.io\r\nDESCRIPTION:Agenda\\nscope\r\n folded\r\nEND:VEVENT\r\nEND:VCALENDAR";
  const [e] = parseIcs(ics);
  assert.deepEqual([e.summary, e.start, e.attendees], ["Roadmap, Q4", "2026-10-14", ["Ada L", "bob@x.io"]]);
  assert.match(e.description, /scopefolded/); // a folded line continues without a break (RFC 5545)
  const ns = (d: Date) => BigInt(d.getTime()) * 1_000_000n;
  const notes = [{ path: "New.md", content: "- [ ] late 📅 2026-10-01", created: ns(new Date(2026, 9, 9)), modified: ns(new Date(2026, 9, 9)) }, { path: "Old.md", content: "x", created: ns(new Date(2026, 1, 1)), modified: ns(new Date(2026, 9, 10)) }];
  const r = weeklyReview(notes, today);
  assert.match(r, /## Written\n\n- \[\[New\]\]/);
  assert.match(r, /## Touched\n\n- \[\[Old\]\]/);
  assert.match(r, /1 overdue/);
});

test("docx is a zip with a document and styles; tables and reminders", async () => {
  const bytes = markdownToDocx("# T\n\nHello **bold** and [[Note]].\n\n- [ ] task\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n", "T");
  const entries = await unzip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const names = entries.map((e) => e.path);
  assert.ok(names.includes("word/document.xml") && names.includes("word/styles.xml") && names.includes("[Content_Types].xml"));
  const doc = new TextDecoder().decode(entries.find((e) => e.path === "word/document.xml")!.data);
  assert.match(doc, /Heading1/);
  assert.match(doc, /<w:b\/>.*bold/);
  assert.match(doc, /<w:tbl>/);
  assert.equal(tsvToTable("a\tb\n1\t2\n"), "| a | b |\n| --- | --- |\n| 1 | 2 |\n");
  assert.equal(tsvToTable("just text"), null);
  const t = "x\n| n | v |\n| --- | --- |\n| b | 10 |\n| a | 9 |\n| c | 100 |\ny";
  assert.equal(sortTable(t, 3, 1).split("\n")[3], "| a | 9 |");
  assert.equal(sortTable(t, 3, 0, true).split("\n")[3], "| c | 100 |");
  assert.equal(setCell(t, 3, 1, "11").split("\n")[3], "| b | 11 |");
  const rs = reminders([{ path: "R.md", content: "---\nremind: 2026-10-14 09:00\n---\n# Call Ada" }, { path: "N.md", content: "no" }]);
  assert.deepEqual([rs.length, rs[0].text, rs[0].at.getHours()], [1, "Call Ada", 9]);
});
