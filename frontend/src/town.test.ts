import { test } from "node:test";
import assert from "node:assert/strict";
import { blockAt, layoutTown, project, season, unproject, type TownData, type TownHouse } from "./town.ts";

const town = (houses: TownHouse[], more: Partial<TownData> = {}): TownData => ({ at: 1, houses, people: houses.length, homes: houses.length, quiet: 0, channels: [{ name: "general", online: 2, messages24h: 5 }], postTopics: [], postsLive: 0, posts24h: 0, listings: 3, discoveries: 2, underReview: 0, rains24h: 0, hikers: 0, off: [], ...more });
const house = (lot: number, agent = false): TownHouse => ({ lot, storeys: 1, size: lot % 4, lit: lot % 3, agent });
const spot = (d: TownData) => new Map(layoutTown(d).objs.filter((o) => o.k === "house").map((o) => [o.h!.lot, [o.x, o.y]]));

test("town: the same data gives the same plan", () => {
  const d = town([1, 5, 9, 40].map((n) => house(n)));
  assert.deepEqual(layoutTown(d), layoutTown(d));
});

test("town: a house never moves when others come or go", () => {
  const base = spot(town([3, 10, 30, 77].map((n) => house(n))));
  const more = spot(town([0, 3, 10, 12, 30, 77, 200].map((n) => house(n))));
  const fewer = spot(town([10, 77].map((n) => house(n))));
  for (const [lot, p] of base) assert.deepEqual(more.get(lot), p);
  for (const [lot, p] of fewer) assert.deepEqual(base.get(lot), p);
});

test("town: blocks fill each ring once, all sides first, never the civic centre", () => {
  const seen = new Set<string>();
  for (let b = 0; b < 16 + 24 + 32; b++) {
    const [x, y] = blockAt(b), k = `${x},${y}`;
    assert.ok(Math.max(Math.abs(x), Math.abs(y)) >= 2, k);
    assert.ok(!seen.has(k), `repeat ${k}`);
    seen.add(k);
  }
  assert.equal(new Set([0, 1, 2, 3].map((b) => blockAt(b).join())).size, 4);
  assert.deepEqual([0, 1, 2, 3].map((b) => blockAt(b)), [[0, -2], [2, 0], [0, 2], [-2, 0]]);
});

test("town: houses don't overlap each other or the roads", () => {
  const d = town(Array.from({ length: 120 }, (_, i) => house(i * 3)));
  const hs = layoutTown(d).objs.filter((o) => o.k === "house");
  const road = (v: number) => ((v % 7) + 7) % 7 === 0;
  for (const o of hs) {
    for (let x = Math.floor(o.x); x < o.x + o.w; x++) assert.ok(!road(x), `lot ${o.h!.lot} on road x=${x}`);
    for (let y = Math.floor(o.y); y < o.y + o.d; y++) assert.ok(!road(y), `lot ${o.h!.lot} on road y=${y}`);
  }
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
    const a = hs[i], b = hs[j];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y, `${a.h!.lot} overlaps ${b.h!.lot}`);
  }
});

test("town: agents move into the quarter, the 17th stays at its own lot", () => {
  const agents = Array.from({ length: 17 }, (_, i) => house(i * 9, true));
  const hs = layoutTown(town(agents)).objs.filter((o) => o.k === "house");
  const inQuarter = hs.filter((o) => (o.x > -7 && o.x < 0 && o.y > 0 && o.y < 7) || (o.x > 0 && o.x < 7 && o.y > -7 && o.y < 0));
  assert.equal(inQuarter.length, 16);
  assert.ok(!inQuarter.some((o) => o.h!.lot === 16 * 9));
});

test("town: switched-off spaces are not built", () => {
  const on = layoutTown(town([house(1)])).objs.map((o) => o.k);
  const off = layoutTown(town([house(1)], { off: ["market", "journal"] })).objs.map((o) => o.k);
  assert.ok(on.includes("market") && on.includes("observatory") && on.filter((k) => k === "obelisk").length === 2);
  assert.ok(!off.includes("market") && !off.includes("observatory") && !off.includes("obelisk"));
});

test("town: your quiet notebook is an outlined plot", () => {
  const objs = layoutTown(town([house(1)], { mine: 9 })).objs;
  assert.ok(objs.some((o) => o.k === "plot" && o.mine));
  assert.ok(layoutTown(town([house(9)], { mine: 9 })).objs.some((o) => o.k === "house" && o.mine));
});

test("town: seasons and projection", () => {
  assert.deepEqual(season(new Date(2026, 9, 15)), { name: "autumn", next: "winter", days: 47 });
  assert.equal(season(new Date(2026, 11, 3)).name, "winter");
  assert.equal(season(new Date(2027, 1, 28)).next, "spring");
  for (const [x, y] of [[0, 0], [3.5, -2], [-10, 12]]) { const [a, b] = unproject(...project(x, y)); assert.ok(Math.abs(a - x) < 1e-9 && Math.abs(b - y) < 1e-9); }
});
