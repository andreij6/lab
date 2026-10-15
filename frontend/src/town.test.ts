import { test } from "node:test";
import assert from "node:assert/strict";
import { blockAt, cellAt, DISTRICTS, homeBlock, layoutTown, project, season, unproject, BRIDGE, LAND, ROAD, VOID, WATER, type TownData, type TownHouse } from "./town.ts";

const town = (houses: TownHouse[], more: Partial<TownData> = {}): TownData => ({ at: 1, houses, people: houses.length, homes: houses.length, quiet: 0, channels: [{ name: "general", online: 2, messages24h: 5 }], postTopics: [], postsLive: 0, posts24h: 0, listings: 3, rains24h: 0, hikers: 0, off: [], building: [], notebooks: houses.length, spawned24h: 0, spawned7d: 0, newcomers7d: 0, cycles: 0, burnPerDay: 0, fundraisersOpen: 0, raisedE8s: 0, campers: 0, meCamping: false, ...more });
const house = (lot: number): TownHouse => ({ lot, storeys: 1, size: lot % 4, lit: lot % 3 });
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

test("town: an island, not a square: a lake, a river over the edge, a bridge on the road out", () => {
  const pl = layoutTown(town([house(1), house(300)]));
  const cells = [...pl.cells];
  const count = (v: number) => cells.filter((c) => c === v).length;
  assert.ok(count(VOID) > 0, "the corners of the grid are sea");
  assert.ok(count(WATER) > 30 && count(BRIDGE) >= 1);
  // the shore is uneven: rows of the grid end at different places
  const ends = new Set<number>();
  for (let y = pl.lo; y <= pl.hi; y++) { let x = pl.hi; while (x > pl.lo && cellAt(pl, x, y) === VOID) x--; ends.add(x); }
  assert.ok(ends.size > 4);
  // the river reaches the front edge of the island
  assert.ok(Array.from({ length: pl.n }, (_, i) => pl.lo + i).some((x) => cellAt(pl, x, pl.hi) === WATER || (cellAt(pl, x, pl.hi - 1) === WATER && cellAt(pl, x, pl.hi) === VOID)));
  // no house or building stands on water or a street
  for (const o of pl.objs) if (["house", "hall", "factory", "school", "chapel", "tower", "market", "gazebo"].includes(o.k)) {
    for (let x = Math.floor(o.x); x < o.x + o.w; x++) for (let y = Math.floor(o.y); y < o.y + o.d; y++) assert.equal(cellAt(pl, x, y), LAND, `${o.k} at ${x},${y}`);
  }
  assert.equal(cellAt(pl, 7, 7), ROAD);
  // and no holes: every empty cell touches the edge through other empty cells
  const seen = new Set<string>(), todo: [number, number][] = [];
  for (let i = pl.lo; i <= pl.hi; i++) for (const [x, y] of [[i, pl.lo], [i, pl.hi], [pl.lo, i], [pl.hi, i]]) if (cellAt(pl, x, y) === VOID) todo.push([x, y]);
  while (todo.length) { const [x, y] = todo.pop()!, k = `${x},${y}`; if (seen.has(k) || x < pl.lo || y < pl.lo || x > pl.hi || y > pl.hi || cellAt(pl, x, y) !== VOID) continue; seen.add(k); todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  assert.equal(seen.size, count(VOID));
});

test("town: the town grows block by block, not as a full square", () => {
  const small = layoutTown(town([house(1)])), big = layoutTown(town([house(1), house(16 * 8 + 3)]));
  const roads = (p: ReturnType<typeof layoutTown>) => [...p.cells].filter((c) => c === ROAD).length;
  assert.ok(roads(big) > roads(small));
  // ring 3 is only partly built: some of its block corners are still woods
  const [bx, by] = blockAt(16 + 23);
  assert.notEqual(cellAt(big, 7 * bx + 3, 7 * by), ROAD);
});

test("town: districts hold their landmarks, and homes are never built there", () => {
  const pl = layoutTown(town(Array.from({ length: 200 }, (_, i) => house(i))));
  const held = new Set(DISTRICTS.flatMap((d) => d.blocks.map((b) => b.join())));
  for (let b = 0; b < 40; b++) assert.ok(!held.has(homeBlock(b).join()), `home block ${b}`);
  const ids = pl.objs.flatMap((o) => (o.tg?.kind === "landmark" ? [o.tg.landmark.id] : []));
  assert.deepEqual(ids.sort(), ["dominic", "icpswap", "nns", "oisy", "soon"]);
  for (const o of pl.objs.filter((o) => o.k === "house")) assert.ok(!held.has([Math.floor((o.x - 1) / 7), Math.floor((o.y - 1) / 7)].join()), `a home in a district at ${o.x},${o.y}`);
  // every district is named on a sign
  assert.deepEqual(new Set(pl.objs.filter((o) => o.k === "sign" && o.s === 1).map((o) => (o.tg as { district: { id: string } }).district.id)), new Set(DISTRICTS.map((d) => d.id)));
  for (const d of DISTRICTS) for (const l of d.landmarks) assert.ok(d.blocks.some((b) => b.join() === l.block.join()), `${l.id} sits in its district`);
});

test("town: people without a notebook camp by the lake, yours first", () => {
  const pl = layoutTown(town([house(1)], { campers: 5, meCamping: true }));
  const tents = pl.objs.filter((o) => o.k === "tent");
  assert.equal(tents.length, 5);
  assert.equal(tents.filter((o) => o.mine).length, 1);
  assert.ok(pl.objs.some((o) => o.k === "campfire"));
  for (const o of tents) assert.equal(cellAt(pl, Math.floor(o.x), Math.floor(o.y)), LAND);
  assert.equal(layoutTown(town([house(1)], { campers: 99 })).objs.filter((o) => o.k === "tent").length, 24);
});

test("town: the districts are spread out, not side by side", () => {
  const firsts = DISTRICTS.map((d) => d.blocks[0]);
  for (let i = 0; i < firsts.length; i++) for (let j = i + 1; j < firsts.length; j++) assert.ok(Math.max(Math.abs(firsts[i][0] - firsts[j][0]), Math.abs(firsts[i][1] - firsts[j][1])) >= 2, `${DISTRICTS[i].id} beside ${DISTRICTS[j].id}`);
  assert.ok(!layoutTown(town([house(1)])).objs.some((o) => o.k === "sign" && o.s !== 1), "no room-for-more signs");
});

test("town: new notebooks are building sites", () => {
  const objs = layoutTown(town([house(1)], { building: [1, 40] })).objs.filter((o) => o.k === "house" && o.building);
  assert.deepEqual(objs.map((o) => o.h!.lot).sort((a, b) => a - b), [1, 40]);
});

test("town: switched-off spaces are not built", () => {
  const on = layoutTown(town([house(1)])).objs.map((o) => o.k);
  const off = layoutTown(town([house(1)], { off: ["market"] })).objs.map((o) => o.k);
  assert.ok(on.includes("market") && on.filter((k) => k === "crate").length === 3);
  assert.ok(!off.includes("market"));
  for (const k of ["hall", "factory", "school", "chapel", "tower", "fountain", "gazebo"] as const) assert.ok(off.includes(k), k);
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

test("town: 20,000 homes lay out in a few seconds, every one placed, none on another", () => {
  const houses = Array.from({ length: 20_000 }, (_, i) => house(i + Math.floor(i / 7)));
  const t0 = performance.now(), pl = layoutTown(town(houses)), ms = performance.now() - t0;
  const placed = pl.objs.filter((o) => o.k === "house");
  assert.equal(placed.length, 20_000);
  assert.equal(new Set(placed.map((o) => `${o.x},${o.y}`)).size, 20_000);
  assert.ok(ms < 8000, `layout took ${ms | 0} ms`);
});
