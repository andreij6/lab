import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCards } from "./quiz.ts";
import { parseTasks } from "./work.ts";
import { APPLICATIONS_BOARD, STORIES_DECK, addApplication, applicationCard, applications, compileResume, contacts, markContacted, parseStar, searchStats, storyCard, updateApplication, waiting } from "./career.ts";
import { frontmatter } from "./notes.ts";

test("the application board: add, read, wait, follow up, move", () => {
  let b = addApplication(APPLICATIONS_BOARD, applicationCard("Acme", "Senior Engineer", "2026-09-28", "2026-10-08"));
  b = addApplication(b, applicationCard("Globex", "Staff Engineer", "2026-10-10", "2026-10-20"));
  b = addApplication(b, "[[Initech]] · Designer", "Saved");
  const apps = applications(b);
  assert.deepEqual(apps.map((a) => [a.company, a.role, a.stage, a.applied]), [["Initech", "Designer", "Saved", undefined], ["Acme", "Senior Engineer", "Applied", "2026-09-28"], ["Globex", "Staff Engineer", "Applied", "2026-10-10"]]);
  assert.deepEqual(waiting(apps, "2026-10-12").map((a) => a.company), ["Acme"]);
  // its 📅 follow-up date makes the card a task in Work
  assert.equal(parseTasks([{ path: "Career/Applications.md", content: b }]).find((t) => t.text.includes("Acme"))?.due, "2026-10-08");
  const later = updateApplication(b, apps[1], { followUp: "2026-10-19" });
  assert.deepEqual(waiting(applications(later), "2026-10-12"), []);
  const moved = updateApplication(later, applications(later)[1], { stage: "Interview" });
  assert.equal(applications(moved).find((a) => a.company === "Acme")?.stage, "Interview");
  const closed = updateApplication(moved, applications(moved).find((a) => a.company === "Acme")!, { stage: "Closed" });
  assert.match(closed, /- \[x\] \[\[Acme\]\]/);
});

test("weekly numbers: sent per week, response and interview rates, offers", () => {
  let b = APPLICATIONS_BOARD;
  for (const [c, d] of [["A", "2026-09-29"], ["B", "2026-10-01"], ["C", "2026-10-06"], ["D", "2026-10-12"]]) b = addApplication(b, applicationCard(c, "Role", d, d));
  let apps = applications(b);
  b = updateApplication(b, apps.find((a) => a.company === "A")!, { stage: "Interview" });
  apps = applications(b);
  b = updateApplication(b, apps.find((a) => a.company === "B")!, { stage: "Closed" });
  const s = searchStats(applications(b), "2026-10-12", 3);
  assert.deepEqual(s.weeks, [{ week: "2026-09-28", sent: 2 }, { week: "2026-10-05", sent: 1 }, { week: "2026-10-12", sent: 1 }]);
  assert.deepEqual([s.total, s.thisWeek, s.responseRate, s.interviewRate, s.offers], [4, 1, 50, 25, 0]);
});

test("a résumé compiles from experience notes, skills gathered, missing ones reported", () => {
  const notes: Record<string, string> = {
    "Platform migration": "---\ntype: experience\nrole: Staff Engineer\ncompany: Acme\nstart: 2023\nend: present\nskills: [Rust, Kubernetes]\n---\n\n# x\n\n- Moved 40 services to Kubernetes, cutting costs 30%\n- Led a team of 5\n",
    "On-call": "---\ntype: experience\nrole: Engineer\ncompany: Globex\nstart: 2020\nend: 2023\nskills: [Go, Kubernetes]\n---\n- Halved pages per week\n",
  };
  const r = compileResume("---\ntype: resume\nname: Ada Lovelace\nheadline: Staff engineer, platforms\ncontact: ada@example.com\n---\n\n# Résumé\n\n## Experience\n\n- [[Platform migration]]\n- [[On-call]]\n- [[Gone]]\n", (t) => notes[t]);
  assert.equal(r.used, 2);
  assert.deepEqual(r.missing, ["Gone"]);
  assert.match(r.md, /^# Ada Lovelace\nStaff engineer, platforms\nada@example\.com\n\n## Experience\n\n### Staff Engineer · Acme \(2023 – present\)\n\n- Moved 40 services/);
  assert.match(r.md, /## Skills\n\nRust · Kubernetes · Go\n$/);
});

test("interview stories are flashcards with a STAR back", () => {
  const star = parseStar("Tell me about a conflict", "Situation: Two teams wanted the same release slot.\nTask: Pick one without losing either.\nAction: I split the release.\nResult: Both shipped a week early.");
  assert.equal(star.task, "Pick one without losing either.");
  const deck = `${STORIES_DECK}\n${storyCard(star)}\n`;
  const [c] = parseCards(deck);
  assert.equal(c.front, "Tell me about a conflict");
  assert.match(c.back, /\*\*Situation:\*\* Two teams[\s\S]*\*\*Result:\*\* Both shipped/);
});

test("networking follow-ups come due, and contacting someone pushes the next one out", () => {
  const notes = [
    { path: "People/Grace.md", content: "---\ntype: person\nlast_contacted: 2026-08-01\n---\n# Grace\n" },
    { path: "People/Linus.md", content: "---\ntype: person\nnext_follow_up: 2026-10-20\nreferral_for: Acme\n---\n" },
    { path: "People/Bob.md", content: "---\ntype: person\nrole: PM\n---\n" },
  ];
  const cs = contacts(notes, "2026-10-12");
  assert.deepEqual(cs.map((c) => [c.name, c.due]), [["Grace", true], ["Linus", false]]);
  const after = markContacted(notes[0].content, "2026-10-12");
  assert.equal(frontmatter(after).data.last_contacted, "2026-10-12");
  assert.equal(frontmatter(after).data.next_follow_up, "2026-10-26");
  assert.equal(contacts([{ path: "People/Grace.md", content: after }], "2026-10-12")[0].due, false);
});
