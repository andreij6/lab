import { test } from "node:test";
import assert from "node:assert/strict";
import { TRADE_TEMPLATE, THESIS_TEMPLATE, closeTrade, isThesis, isTrade, journalStats, pnl, reviewThesis, rMultiple, theses, thesisCardSummary, trade, usd, watchSymbols } from "./crypto.ts";
import { parseTasks } from "./work.ts";
import { claims } from "./kits.ts";
import { frontmatter } from "./notes.ts";

test("a trade note: log it, price it open, close it, and its numbers", () => {
  const long = TRADE_TEMPLATE({ asset: "BTC", side: "long", size: 0.5, entry: 60000, stop: 58000, opened: "2026-10-01", thesis: "Halving cycle" }, "Broke out of the range");
  assert.ok(isTrade(long));
  const t = trade("Crypto/Trades/a.md", long);
  assert.deepEqual([t.asset, t.side, t.size, t.entry, t.stop, t.exit, t.thesis], ["BTC", "long", 0.5, 60000, 58000, undefined, "Halving cycle"]);
  assert.equal(pnl(t), undefined);
  assert.equal(pnl(t, 62000), 1000);
  assert.equal(rMultiple(t, 62000), 1);
  const closed = trade("a.md", closeTrade(long, 64000, "2026-10-08", "Took profit at the target"));
  assert.deepEqual([closed.exit, closed.closed, pnl(closed), rMultiple(closed)], [64000, "2026-10-08", 2000, 2]);
  assert.match(closeTrade(long, 64000, "2026-10-08", "Took profit at the target"), /## Lesson\n\nTook profit at the target\n/);
  // a short that lost, with fees
  const short = trade("b.md", closeTrade(TRADE_TEMPLATE({ asset: "eth", side: "short", size: 2, entry: 3000, opened: "2026-10-06" }, "").replace("fees: 0", "fees: 10"), 3100, "2026-10-07"));
  assert.equal(pnl(short), -210);
  const open = trade("c.md", TRADE_TEMPLATE({ asset: "SOL", side: "long", size: 10, entry: 180, opened: "2026-10-10" }, ""));
  const s = journalStats([closed, short, open], "2026-10-12", 3);
  assert.deepEqual([s.open, s.closed, s.winRate, s.realized, s.avgWin, s.avgLoss, s.avgR, s.best?.path, s.worst?.path], [1, 2, 50, 1790, 2000, -210, 2, "a.md", "b.md"]);
  assert.deepEqual(s.weeks, [{ week: "2026-09-28", pnl: 0 }, { week: "2026-10-05", pnl: 1790 }, { week: "2026-10-12", pnl: 0 }]);
  assert.deepEqual(s.byAsset.map((a) => [a.asset, a.pnl]), [["BTC", 2000], ["ETH", -210]]);
});

test("a thesis remembers its price, comes due in Work, and is reviewed until it breaks", () => {
  const c = THESIS_TEMPLATE({ asset: "BTC", belief: "BTC outperforms ETH this cycle", because: "ETF inflows keep growing\nSupply is fixed", wrongIf: "ETH/BTC closes a month above 0.06", price: 98000, today: "2026-10-12" });
  assert.ok(isThesis(c) && frontmatter(c).data.type !== "thesis");
  const notes = [{ path: "Crypto/Theses/BTC.md", content: c }];
  let [t] = theses(notes, "2026-10-12");
  assert.deepEqual([t.title, t.asset, t.priceThen, t.review, t.due, t.status], ["BTC outperforms ETH this cycle", "BTC", 98000, "2026-11-11", false, "holds"]);
  const card = thesisCardSummary(t, 107800);
  assert.equal(card.deltaLabel, "+10.0%");
  assert.match(card.markdown, /now \$107,800 \(\+10\.0%\)/);
  assert.equal(theses(notes, "2026-11-11")[0].due, true);
  // its reasons are Research claims, and its review is a task in Work
  assert.equal(claims(c, [], () => undefined).length, 2);
  assert.equal(parseTasks(notes).find((x) => x.text.startsWith("Review"))?.due, "2026-11-11");
  const held = reviewThesis(c, true, "2026-11-11", 101000);
  assert.match(held, /- \[x\] Review: does this still hold\? 📅 2026-11-11 ✅ 2026-11-11 · still held at \$101,000\n- \[ \] Review: does this still hold\? 📅 2026-12-11\n$/);
  [t] = theses([{ path: "x.md", content: held }], "2026-11-12");
  assert.deepEqual([t.review, t.due], ["2026-12-11", false]);
  const broke = reviewThesis(held, false, "2026-12-11", 80000);
  [t] = theses([{ path: "x.md", content: broke }], "2026-12-12");
  assert.deepEqual([t.status, t.due], ["broken", false]);
  assert.match(broke, /✅ 2026-12-11 · broke at \$80,000/);
});

test("prices: the watchlist plus coins in play, formatted for people", () => {
  const open = trade("a.md", TRADE_TEMPLATE({ asset: "ICP", side: "long", size: 1, entry: 9, opened: "2026-10-10" }, ""));
  assert.deepEqual(watchSymbols(["BTC", "eth"], [open], []), ["BTC", "ETH", "ICP"]);
  assert.equal(watchSymbols(["A", "B", "C", "D", "E", "F", "G", "H", "I"], [], []).length, 8);
  assert.deepEqual([usd(98123.4), usd(3.414), usd(0.012345), usd(-210), usd(1790, true), usd(undefined)], ["$98,123", "$3.41", "$0.0123", "−$210.00", "+$1,790", "–"]);
});
