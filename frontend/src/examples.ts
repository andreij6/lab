// Example notes a new notebook gets for the tools picked in onboarding: one working example of
// every note type, each opening with a "How to make one" box, plus the files each tool's tab reads
// (Career/, Trips/, Sources/, ...). Pure: the app writes whatever this returns that is not there yet.
import { APPLICATIONS_BOARD, EXPERIENCE_TEMPLATE, PERSON_TEMPLATE, RESUME_TEMPLATE, STORIES_DECK, addApplication, addDays, applicationCard, storyCard } from "./career.ts";
import { NEW_DRAWING } from "./excalidraw.ts";
import { NEW_IPYNB } from "./ipynb.ts";
import { parseBibtex, sourceNote, careWorkbook, adrTemplate, RUNBOOK_TEMPLATE } from "./kits.ts";
import { NEW_BOARD } from "./kanban.ts";
import { TRIP_TEMPLATE, gearWorkbook } from "./outdoor.ts";
import { NEW_CHOICE } from "./quiz.ts";
import { serializeWorkbook } from "./sheet.ts";
import { SLIDES_TEMPLATE } from "./slides.ts";
import { MEETING_TEMPLATE } from "./work.ts";

export type ExampleFile = [path: string, content: string];
const how = (text: string) => `> [!tip] How to make one\n> ${text.replace(/\n/g, "\n> ")}\n\n`;
const fill = (t: string, title: string, date: string) => t.replace(/\{\{title\}\}/g, title).replace(/\{\{date\}\}/g, date);

/** The examples for a set of tools (the ids from onboarding: chat, graph, study, work, organize,
 *  research, writing, care, software, career, trips). Everyone gets the core note types. */
export function examples(tools: Set<string>, today: string): ExampleFile[] {
  const out: ExampleFile[] = [];
  const add = (path: string, content: string) => out.push([path, content]);
  const has = (t: string) => tools.has(t);

  // ---- every notebook: the note types
  const kinds: [string, string, string][] = [
    ["Examples/Writing notes", "Writing notes", "⌘N, or + New note. Markdown, [[links]], #tags, tasks, callouts."],
    ["Examples/Slides", "Slides", "A note with `type: slides` in its front matter; `---` on its own line starts the next slide. ⋯ → Present as slides."],
    ["Examples/Board", "Kanban board", "⋯ → New kanban board. Each `##` heading is a lane, each task a card; drag cards between lanes."],
    ["Examples/Budget.sheet", "Spreadsheet", "⋯ → New spreadsheet. Formulas like `=SUM(B2:B4)`, several sheets, charts, CSV import."],
    ["Examples/Dashboard.dash", "Dashboard", "⋯ → New dashboard. Tiles show a chart, a number or a search from other notes; click one to open its source."],
    ["Examples/Map.canvas", "Canvas", "An infinite board of cards and notes, joined by arrows (Obsidian's .canvas format)."],
    ["Examples/Sketch.excalidraw", "Drawing", "⋯ → New drawing (Excalidraw). Embed it in a note with `![[Sketch.excalidraw]]`."],
    ["Examples/Python.ipynb", "Python notebook", "⋯ → New Python notebook (Jupyter). Runs in your browser; `sheet(\"Budget\")` loads a spreadsheet as a DataFrame."],
  ];
  if (has("study")) kinds.push(["Examples/Study/Flashcards", "Flashcard deck", "⋯ → New flashcard deck."], ["Examples/Study/Quiz", "Multiple-choice quiz", "⋯ → New multiple-choice quiz."]);
  if (has("work")) kinds.push(["Examples/Work/Weekly sync", "Meeting note", "Work → New meeting, or import an .ics invite."]);
  add("Examples/Start here.md", `# Start here\n\nOne example of each kind of note. Open any of them, change it, delete it when you are done; nothing else depends on them.\n\n${kinds.map(([p, k, h]) => `- **[[${p}|${k}]]**: ${h}`).join("\n")}\n\nEverything is a file in this notebook's canister: folders on the left, \`⌘K\` to find anything.\n`);
  add("Examples/Writing notes.md", `---\ntags: [example]\n---\n# Writing notes\n\n${how("⌘N, or + New note. Type `[[` to link another note; it shows up in that note's Backlinks and on the Graph.")}Link to [[Examples/Slides|the slides example]] or a note that does not exist yet, like [[An idea for later]]; clicking it creates it.\n\nTag a note with #example, highlight ==the part that matters==, and add tasks:\n\n- [ ] A task with a date 📅 ${addDays(today, 3)}\n- [x] A finished one\n\n> [!note] Callouts\n> Start a quote with \`[!note]\`, \`[!tip]\` or \`[!warning]\`.\n\nEmbed part of another note with \`![[Examples/Slides#The idea]]\`, or a PDF from the web with \`![[https://…/paper.pdf]]\`.\n`);
  add("Examples/Slides.md", fill(SLIDES_TEMPLATE, "Slides", today).replace("A subtitle, your name, the date", "An example deck: ⋯ → Present as slides"));
  add("Examples/Board.md", NEW_BOARD.replace("- [ ] First task", "- [ ] Drag me to Doing\n- [ ] Cards are just tasks 📅 " + addDays(today, 7)));
  add("Examples/Budget.sheet", serializeWorkbook({ sheets: [{ name: "Budget", rows: [["Item", "Planned", "Spent"], ["Rent", "1200", "1200"], ["Food", "400", "455"], ["Travel", "150", "90"], ["Total", "=SUM(B2:B4)", "=SUM(C2:C4)"]], charts: [{ id: "spend", type: "bar", title: "Planned and spent", labels: "A2:A4", values: ["B2:B4", "C2:C4"], legend: "bottom" }] }] }));
  add("Examples/Dashboard.dash", `${JSON.stringify({ tiles: [{ id: "t1", kind: "chart", source: "Examples/Budget.sheet", sheet: "Budget", chart: "spend", w: 2 }, { id: "t2", kind: "kpi", source: "Examples/Budget.sheet", sheet: "Budget", ref: "C5", label: "Spent so far" }, { id: "t3", kind: "search", source: "", q: "#example", label: "Notes tagged #example" }] }, null, 1)}\n`);
  add("Examples/Map.canvas", `${JSON.stringify({ nodes: [{ id: "a", type: "text", text: "An idea: cards hold text…", x: 0, y: 0, width: 260, height: 120 }, { id: "b", type: "file", file: "Examples/Writing notes.md", x: 360, y: -20, width: 300, height: 160 }, { id: "c", type: "text", text: "…or point at notes, and arrows join them", x: 120, y: 220, width: 300, height: 90, color: "4" }], edges: [{ id: "e1", fromNode: "a", toNode: "b" }, { id: "e2", fromNode: "a", toNode: "c" }] }, null, 1)}\n`);
  add("Examples/Sketch.excalidraw", NEW_DRAWING);
  add("Examples/Python.ipynb", NEW_IPYNB);

  if (has("chat")) add("Examples/Ask your notes.md", `# Ask your notes\n\n${how("Open Chat with your notes (the speech bubble on the left) and ask in plain language.")}Try:\n\n- *What does my budget say about food?*\n- *Summarise my meeting notes from this week.*\n\nThe answer cites the notes it used as [1] [2]; click one to open it. Anything it adds from general knowledge comes after **Beyond your notes**, and **Save as note** keeps an answer in a folder you pick.\n`);
  if (has("study")) {
    add("Examples/Study/Flashcards.md", `---\nquiz: cards\n---\n# Flashcards\n\n${how("⋯ → New flashcard deck, or ⋯ on any note → Make flashcards. Study brings each card back just before you would forget it.")}What does a canister run on?::Cycles\n\nThe front of a card\n?\nThe back of a card, on the lines after a single ?\n`);
    add("Examples/Study/Quiz.md", NEW_CHOICE);
    add("Examples/Study/Glossary.md", `# Glossary\n\n${how("Write `Term:: definition` on its own line in any note. Terms are underlined in reading view and listed in Study.")}Spaced repetition:: reviewing just before you would forget.\n\nCloze:: a card made by hiding part of a sentence: ==highlight== a phrase and Make flashcards turns it into one.\n`);
  }
  if (has("work")) {
    add("Examples/Work/Weekly sync.md", MEETING_TEMPLATE("Weekly sync", today, ["sam"], ["What shipped", "What is blocked"]).replace("# Weekly sync\n", `# Weekly sync\n\n${how("Work → New meeting, or import an .ics invite. Decisions and @owner tasks are collected in Work; ⋯ → Follow-up drafts the recap.")}`).replace(/- \[ \] @owner task.*/, `- [ ] @sam send the notes 📅 ${addDays(today, 1)}`));
    add("Examples/Work/Launch.md", `---\ntype: project\nstatus: active\ngoal: Ship the first version\n---\n# Launch\n\n${how("Any note with `type: project` makes a project in Work; its `## Milestones` tasks show its progress.")}## Milestones\n\n- [x] Write the plan\n- [ ] First version 📅 ${addDays(today, 14)}\n- [ ] Tell people\n`);
    add("People/Sam.md", `---\ntype: person\nrole: Designer\nteam: Product\n---\n# Sam\n\n${how("A note with `type: person`. Every @sam in a task or meeting shows up here and in Work → People.")}`);
  }
  if (has("organize")) {
    add("Inbox/Welcome.md", `# Welcome\n\n${how("New notes land in Inbox/ when you capture them quickly. Triage them from Organize: file, tag, link or archive.")}created: ${today}\n`);
    add("Examples/Organize/Properties.md", `---\nstatus: open\npriority: 2\ndue: ${addDays(today, 5)}\ntags: [example]\n---\n# Properties\n\n${how("Put fields between --- lines at the top of a note. Organize turns them into a table you can sort and edit, and searches like `status:open priority:>1` find them.")}`);
  }
  if (has("research")) {
    const [s] = parseBibtex("@article{doe2024example, author = {Doe, Jane}, title = {An example source}, journal = {Journal of Examples}, year = {2024}}");
    add(`Sources/${s.key}.md`, sourceNote(s));
    add("Research/Draft.md", `# Draft\n\n${how("Cite a source note as `[@key]`; Research lists sources and checks every `Claim::` line has evidence.")}Claim:: Examples help people learn [@doe2024example]\n\nClaim:: This one has no evidence yet\n`);
    add("Research/Thesis.md", `---\ntype: thesis\ntitle: Example thesis\n---\n# Example thesis\n\n${how("A note with `type: thesis` listing chapters as `1. [[Chapter]]`. Research → Compile joins them, numbers figures and adds the references.")}1. [[Research/Draft]]\n`);
  }
  if (has("writing")) {
    add("Manuscript/Opening.md", `---\ntype: scene\nchapter: Chapter 1\norder: 1\npov: \ndate: Day 1\n---\n# Opening\n\n${how("Writing → New scene. Scenes are notes with `type: scene`, a chapter and an order; drag them to reorder.")}Write the first scene here.\n`);
    add("Bible/Main character.md", `---\ntype: character\neyes: brown\nhair: \nage: \n---\n# Main character\n\n${how("Writing → + Character. The continuity check flags scenes that contradict these facts.")}`);
  }
  if (has("care")) {
    add("Care/Log.sheet", careWorkbook());
    add("Care/Diary.md", `# Diary\n\n${how("Care → Dose or Symptom logs to Care/Log.sheet. Lines starting `Q::` become questions for your next appointment.")}Q:: A question for the next appointment\n`);
  }
  if (has("software")) {
    add("Decisions/ADR-0001 Record decisions.md", adrTemplate("ADR-0001", "Record decisions"));
    add("Runbooks/Restore the database.md", fill(RUNBOOK_TEMPLATE, "Restore the database", today));
    add("Changes/First release.md", `---\ntype: change\nversion: 0.1.0\ndate: ${today}\nkind: added\n---\n# The first release\n\n${how("A note with `type: change`, a version and a kind (added, changed, fixed, …). Software → Build & publish turns them into a changelog page.")}`);
  }
  if (has("trips")) {
    add("Trips/First trip/Plan.md", fill(TRIP_TEMPLATE, "First trip", today));
    add("Trips/First trip/Gear.sheet", gearWorkbook());
  }
  if (has("career")) {
    add("Career/Applications.md", addApplication(addApplication(APPLICATIONS_BOARD, "[[Example company]] · The role you want", "Saved"), applicationCard("Example company", "An application you sent", today, addDays(today, 10))));
    add("Career/Experience/Your current role.md", EXPERIENCE_TEMPLATE("Your current role", "Company", today.slice(0, 4)).replace("- \n", "- An accomplishment with a number in it, like cutting costs 20%\n"));
    add("Career/Résumé.md", RESUME_TEMPLATE("Your name", ["Career/Experience/Your current role"]));
    add("Career/Interview stories.md", `${STORIES_DECK}\n${storyCard({ question: "Tell me about a time you disagreed with someone", situation: "What was going on.", task: "What you had to do.", action: "What you did.", result: "What happened, with a number if you have one." })}\n`);
    add("People/A recruiter.md", PERSON_TEMPLATE("A recruiter", "Met at a meetup", "Example company", today));
  }
  return out;
}
