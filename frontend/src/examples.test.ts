import { test } from "node:test";
import assert from "node:assert/strict";
import { examples } from "./examples.ts";
import { evaluate, parseWorkbook } from "./sheet.ts";
import { parseBoard } from "./kanban.ts";
import { parseCards, quizKind } from "./quiz.ts";
import { parseNotebook } from "./ipynb.ts";
import { parseCanvas } from "./canvasview.ts";
import { isSlides, splitSlides } from "./slides.ts";
import { applications } from "./career.ts";
import { isOpen, journalStats, theses, trade } from "./crypto.ts";
import { holdings, subscriptions } from "./money.ts";
import { calendar, posts } from "./creator.ts";
import { records, workouts } from "./fitness.ts";
import { items, upkeep } from "./home.ts";
import { frontmatter } from "./notes.ts";

const ALL = new Set(["chat", "graph", "study", "work", "organize", "research", "writing", "care", "software", "career", "crypto", "money", "creator", "fitness", "home", "trips"]);

test("every notebook gets one working example of each core note type", () => {
  const files = new Map(examples(new Set(), "2026-10-12"));
  const sheet = parseWorkbook(files.get("Examples/Budget.sheet")!);
  assert.equal(evaluate(sheet).get("Budget")![4][2], 1745);
  assert.equal(sheet.sheets[0].charts[0].id, "spend");
  const dash = JSON.parse(files.get("Examples/Dashboard.dash")!) as { tiles: { source: string; chart?: string; ref?: string }[] };
  assert.ok(dash.tiles.every((t) => !t.source || files.has(t.source)));
  assert.ok(parseBoard(files.get("Examples/Board.md")!).lanes.length >= 3);
  assert.ok(isSlides(files.get("Examples/Slides.md")!) && splitSlides(files.get("Examples/Slides.md")!).length >= 3);
  const canvas = parseCanvas(files.get("Examples/Map.canvas")!);
  assert.equal(canvas.edges.length, 2);
  assert.ok(canvas.nodes.filter((n) => n.file).every((n) => files.has(n.file!)));
  assert.ok(parseNotebook(files.get("Examples/Python.ipynb")!).cells.length >= 1);
  // the index links every example that exists
  const index = files.get("Examples/Start here.md")!;
  assert.equal([...index.matchAll(/\[\[([^\]|]+)\|/g)].length, 8);
  for (const [, target] of index.matchAll(/\[\[([^\]|]+)\|/g)) assert.ok(files.has(target) || files.has(`${target}.md`), target);
  assert.ok(!files.has("Examples/Study/Flashcards.md") && !files.has("Career/Applications.md"));
});

test("each tool adds examples its tab can read", () => {
  const files = new Map(examples(ALL, "2026-10-12"));
  assert.equal(quizKind(files.get("Examples/Study/Flashcards.md")!), "cards");
  assert.equal(parseCards(files.get("Examples/Study/Flashcards.md")!).length, 2);
  assert.equal(quizKind(files.get("Examples/Study/Quiz.md")!), "choice");
  assert.equal(frontmatter(files.get("Examples/Work/Launch.md")!).data.type, "project");
  assert.equal(frontmatter(files.get("Examples/Work/Weekly sync.md")!).data.type, "meeting");
  assert.equal(frontmatter(files.get("Research/Thesis.md")!).data.type, "thesis");
  assert.equal(frontmatter(files.get("Changes/First release.md")!).data.type, "change");
  assert.deepEqual(applications(files.get("Career/Applications.md")!).map((a) => a.stage), ["Saved", "Applied"]);
  assert.equal(parseCards(files.get("Career/Interview stories.md")!).length, 1);
  assert.ok(parseWorkbook(files.get("Trips/First trip/Gear.sheet")!).sheets.length >= 1);
  const trades = [...files].filter(([p]) => p.startsWith("Crypto/Trades/")).map(([p, c]) => trade(p, c));
  assert.deepEqual([trades.length, trades.filter(isOpen).length, journalStats(trades, "2026-10-12").realized], [2, 1, 30]);
  assert.equal(theses([...files].map(([path, content]) => ({ path, content })), "2026-10-12")[0].asset, "BTC");
  assert.equal(trades.find((t) => !isOpen(t))?.thesis, "Crypto/Theses/BTC holds up better than the rest");
  const all = [...files].map(([path, content]) => ({ path, content }));
  assert.equal(holdings(files.get("Money/Net worth.md")!).length, 5);
  assert.equal(subscriptions(all, "2026-10-12")[0].inDays, 5);
  assert.deepEqual(calendar(files.get("Creator/Calendar.md")!).map((c) => c.lane), ["Ideas", "Drafting"]);
  assert.equal(posts(all)[0].thread.length, 3);
  assert.deepEqual(records(workouts(all)).map((r) => [r.exercise, r.set.weight]), [["Squat", 62.5]]);
  assert.equal(upkeep(all, "2026-10-12")[0].inDays, 3);
  assert.equal(items(all, "2026-10-12")[0].warrantyDays, 65);
  // every markdown example explains how to make one; nothing is listed twice
  const md = [...files].filter(([p, c]) => p.endsWith(".md") && !/quiz: choice|kanban-plugin|type: slides|type: runbook|type: adr|^---\ntype: (trip|experience|resume|person)/m.test(c) && !p.startsWith("Sources/") && !p.startsWith("Decisions/") && p !== "Examples/Start here.md" && p !== "Career/Interview stories.md" && p !== "Trips/First trip/Plan.md" && p !== "Examples/Slides.md");
  for (const [p, c] of md) assert.match(c, /\[!tip\] How to make one/, p);
  assert.equal(new Set(examples(ALL, "2026-10-12").map(([p]) => p)).size, files.size);
});
