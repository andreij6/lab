import { test } from "node:test";
import assert from "node:assert/strict";
import { countByDay, dayKey, gridWeeks, level, streak } from "./activity.ts";

const ns = (d: Date) => BigInt(d.getTime()) * 1_000_000n;

test("counts per local day and shades", () => {
  const a = new Date(2026, 9, 10, 9);
  const b = new Date(2026, 9, 10, 23);
  const c = new Date(2026, 9, 11, 1);
  const m = countByDay([ns(a), ns(b), ns(c)]);
  assert.equal(m.get("2026-10-10"), 2);
  assert.equal(m.get("2026-10-11"), 1);
  assert.deepEqual([0, 1, 2, 3, 4, 6, 7, 20].map(level), [0, 1, 2, 2, 3, 3, 4, 4]);
});

test("the grid ends today, has 53 columns of 7, and blanks the future", () => {
  const today = new Date(2026, 9, 11); // a Sunday
  const g = gridWeeks(today, new Map([["2026-10-11", 3]]));
  assert.equal(g.length, 53);
  assert.ok(g.every((c) => c.length === 7));
  const last = g[52];
  assert.equal(last[0]?.key, dayKey(today));
  assert.equal(last[0]?.count, 3);
  assert.equal(last[1], null);
  assert.equal(g[0][0]?.key, "2025-10-12");
});

test("streak counts back from today or yesterday", () => {
  const today = new Date(2026, 9, 11);
  const m = new Map([["2026-10-10", 1], ["2026-10-09", 2], ["2026-10-07", 1]]);
  assert.equal(streak(today, m), 2);
  m.set("2026-10-11", 1);
  assert.equal(streak(today, m), 3);
  assert.equal(streak(today, new Map()), 0);
});
