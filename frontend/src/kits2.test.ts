import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTasks, addPeriod, setDue } from "./work.ts";
import { evaluate, parseWorkbook } from "./sheet.ts";
import { frontmatter } from "./notes.ts";
import { NET_WORTH_NOTE, SUBSCRIPTION_TEMPLATE, budgetTotals, budgetWorkbook, cancelSubscription, holdings, netWorth, netWorthHistory, perMonth, recordNetWorth, renewSubscription, subscriptionTotals, subscriptions } from "./money.ts";
import { CALENDAR_BOARD, LIMIT, POST_TEMPLATE, calendar, draftText, logResults, placeCard, post, results, thread } from "./creator.ts";
import { WORKOUT_TEMPLATE, e1rm, newRecords, pace, parseSets, progress, records, weekly, workout, workouts } from "./fitness.ts";
import { ITEM_TEMPLATE, UPKEEP_TEMPLATE, doneUpkeep, inventory, items, upkeep, warrantiesEnding } from "./home.ts";

test("recurring dates: periods clamp to month ends, the open task moves on", () => {
  assert.deepEqual([addPeriod("2026-01-31", "month"), addPeriod("2026-10-12", "3 months"), addPeriod("2026-10-12", "2 weeks"), addPeriod("2026-10-12", "every 90 days")], ["2026-02-28", "2027-01-12", "2026-10-26", "2027-01-10"]);
  assert.equal(setDue("- [x] Pay 📅 2026-01-01\n- [ ] Pay rent 📅 2026-10-01\n", "2026-11-01", "Pay"), "- [x] Pay 📅 2026-01-01\n- [ ] Pay rent 📅 2026-11-01\n");
  assert.equal(setDue("# x\n", "2026-11-01", "Check"), "# x\n\n- [ ] Check 📅 2026-11-01\n");
});

test("money: subscriptions come due, renew or cancel; the budget's totals; net worth with coins priced live", () => {
  assert.deepEqual([perMonth(120, "year"), perMonth(10, "month"), Math.round(perMonth(3, "week") * 100) / 100], [10, 10, 13]);
  const s = SUBSCRIPTION_TEMPLATE(15.99, "month", "2026-10-20", "Streaming");
  const notes = [{ path: "Money/Subscriptions/Streaming.md", content: s }, { path: "Money/Subscriptions/Cloud.md", content: SUBSCRIPTION_TEMPLATE(120, "year", "2027-03-01", "Cloud") }];
  const subs = subscriptions(notes, "2026-10-12");
  assert.deepEqual(subs.map((x) => [x.name, x.inDays]), [["Streaming", 8], ["Cloud", 140]]);
  assert.equal(Math.round(subscriptionTotals(subs).monthly * 100), 2599);
  assert.equal(parseTasks(notes).find((t) => t.path.includes("Streaming"))?.due, "2026-10-20");
  const renewed = renewSubscription(s, "2026-10-21");
  assert.equal(frontmatter(renewed).data.renews, "2026-11-20");
  assert.equal(parseTasks([{ path: "a.md", content: renewed }])[0].due, "2026-11-20");
  const gone = cancelSubscription(s, "2026-10-12");
  assert.equal(subscriptions([{ path: "a.md", content: gone }], "2026-10-12")[0].status, "cancelled");
  assert.ok(parseTasks([{ path: "a.md", content: gone }]).every((t) => t.done));
  const wb = parseWorkbook(budgetWorkbook());
  wb.sheets[0].rows[2][2] = "455";
  assert.deepEqual(budgetTotals(evaluate(wb).get("Budget")), { planned: 3020, spent: 455, left: 2565 });
  const hs = holdings(NET_WORTH_NOTE);
  assert.deepEqual(hs.map((h) => [h.kind, h.amount, h.coin]).slice(3), [["crypto", 0.05, "BTC"], ["debt", -600, undefined]]);
  const nw = netWorth(hs, (c) => (c === "BTC" ? 100000 : undefined));
  assert.equal(nw.total, 2500 + 8000 + 20000 + 5000 - 600);
  assert.deepEqual(netWorth(hs, () => undefined).unpriced, ["BTC"]);
  let md = recordNetWorth(NET_WORTH_NOTE, "2026-10-01", 30000);
  md = recordNetWorth(md, "2026-10-12", 34900.4);
  md = recordNetWorth(md, "2026-10-12", 35000);
  assert.deepEqual(netWorthHistory(md), [{ date: "2026-10-01", total: 30000 }, { date: "2026-10-12", total: 35000 }]);
  assert.match(md, /## History\n\n- 2026-10-01: \$30,000\n- 2026-10-12: \$35,000\n+$/);
});

test("creator: a calendar board, drafts split into a thread, results", () => {
  let b = placeCard(CALENDAR_BOARD, "Launch thread", "Ideas");
  b = placeCard(b, "Launch thread", "Scheduled", "2026-10-15");
  assert.deepEqual(calendar(b).map((c) => [c.title, c.lane, c.date]), [["Launch thread", "Scheduled", "2026-10-15"]]);
  assert.equal(parseTasks([{ path: "Creator/Calendar.md", content: b }])[0].due, "2026-10-15");
  b = placeCard(b, "Launch thread", "Posted", "");
  assert.match(b, /## Posted\n\n\*\*Complete\*\*\n+- \[x\] \[\[Launch thread\]\]\n/);
  const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i + 1} is here.`).join(" ");
  const c = POST_TEMPLATE("Launch thread", `First post.\n\n---\n\n${long}`).replace("# Launch thread\n", "# Launch thread\n\n> [!tip] a how-to box\n");
  assert.equal(draftText(c).startsWith("First post."), true);
  const th = thread(draftText(c));
  assert.ok(th.length >= 3 && th.every((p) => [...p].length <= LIMIT), th.join("\n"));
  assert.match(th[0], /^First post\. 1\/\d$/);
  assert.ok(th[1].startsWith("Sentence number 1 is here."));
  assert.deepEqual(thread("Short one."), ["Short one."]);
  const done = logResults(c, { impressions: 2000, likes: 50, reposts: 10, replies: 40 }, "2026-10-15");
  const p = post("Creator/Posts/Launch thread.md", done);
  assert.deepEqual([p.posted, p.engagement, p.over], ["2026-10-15", 5, 0]);
  assert.deepEqual(results([p, post("b.md", POST_TEMPLATE("b"))]).count, 1);
});

test("fitness: sets in three spellings, records, progress, weekly totals, pace", () => {
  assert.deepEqual(parseSets("- Squat: 100 x 5, 105kg x 3"), [{ exercise: "Squat", weight: 100, reps: 5 }, { exercise: "Squat", weight: 105, reps: 3 }]);
  assert.equal(parseSets("- Bench press: 3x5 @ 80").length, 3);
  assert.deepEqual(parseSets("- Pull-up: 3x8 @ bw")[0], { exercise: "Pull-up", weight: 0, reps: 8 });
  assert.deepEqual(parseSets("- Just a note"), []);
  assert.equal(Math.round(e1rm(100, 5)), 117);
  const notes = [
    { path: "Fitness/a.md", content: WORKOUT_TEMPLATE("2026-10-05", "strength", "- Squat: 3x5 @ 100\n- Pull-up: 3x8 @ bw") },
    { path: "Fitness/b.md", content: WORKOUT_TEMPLATE("2026-10-09", "strength", "- Squat: 105 x 5, 105 x 4") },
    { path: "Fitness/c.md", content: WORKOUT_TEMPLATE("2026-10-11", "run", "", 30).replace("type: workout", "type: workout\ndistance_km: 6") },
  ];
  const ws = workouts(notes);
  assert.deepEqual(records(ws).map((r) => [r.exercise, r.set.weight, r.date]), [["Squat", 105, "2026-10-09"]]);
  assert.deepEqual(newRecords(ws, "Fitness/b.md"), ["Squat"]);
  assert.deepEqual(progress(ws, "squat"), [{ date: "2026-10-05", e1rm: 116.7 }, { date: "2026-10-09", e1rm: 122.5 }]);
  assert.deepEqual(weekly(ws, "2026-10-12", 2), [{ week: "2026-10-05", sessions: 3, volume: 1500 + 525 + 420, km: 6 }, { week: "2026-10-12", sessions: 0, volume: 0, km: 0 }]);
  assert.equal(pace(30, 6), "5:00 /km");
  // a run from a GPX route block
  const track = "```track\nname: Loop\npt 52.0,4.0\npt 52.009,4.0\n```";
  assert.ok((workout("r.md", `---\ntype: workout\ndate: 2026-10-10\n---\n${track}\n`).km ?? 0) > 0.9);
});

test("home: upkeep moves on when done; items roll up into an inventory with warranties", () => {
  const u = UPKEEP_TEMPLATE("Change the furnace filter", "3 months", "2026-10-10");
  const notes = [{ path: "Home/Upkeep/Change the furnace filter.md", content: u }];
  assert.deepEqual(upkeep(notes, "2026-10-12").map((x) => [x.job, x.inDays]), [["Change the furnace filter", -2]]);
  const done = doneUpkeep(u, "2026-10-12");
  assert.equal(frontmatter(done).data.last_done, "2026-10-12");
  assert.equal(upkeep([{ path: "a.md", content: done }], "2026-10-12")[0].next, "2027-01-12");
  assert.equal(parseTasks([{ path: "a.md", content: done }]).length, 1);
  const fridge = ITEM_TEMPLATE({ name: "Fridge", room: "Kitchen", brand: "Acme", value: 1200, warrantyUntil: "2026-11-30", manual: "https://example.com/fridge.pdf" });
  const its = items([{ path: "Home/Items/Fridge.md", content: fridge }, { path: "Home/Items/Sofa.md", content: ITEM_TEMPLATE({ name: "Sofa", room: "Living room", value: 800 }) }], "2026-10-12");
  assert.deepEqual(its.map((i) => [i.name, i.room, i.manual, i.warrantyDays]), [["Fridge", "Kitchen", true, 49], ["Sofa", "Living room", false, undefined]]);
  assert.deepEqual(inventory(its).map((r) => [r.room, r.value]), [["Kitchen", 1200], ["Living room", 800]]);
  assert.deepEqual(warrantiesEnding(its).map((i) => i.name), ["Fridge"]);
  assert.equal(parseTasks([{ path: "f.md", content: fridge }])[0].due, "2026-10-31");
});
