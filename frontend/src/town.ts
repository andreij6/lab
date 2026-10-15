// Lab's town: the app's activity as a small isometric town, in the calm flat style of a city
// builder (nothing to play). A house for each person with a notebook edited in the last 30 days;
// community buildings for the public spaces; people online in chat walk to their channel's stall.
//
// - layoutTown(data): a pure, deterministic plan. A house's place depends only on its lot (its
//   owner's lowest token id), so adding or removing other houses never moves it.
// - attachTown(canvas, opts): the renderer, a singleton like the sky: it rebinds to the new canvas
//   after each render and keeps its camera and walkers. ~30 fps, paused while hidden; reduced motion
//   gets still frames. Light theme is day, dark is night with lit windows.

import { accentOf, hashOf, hex, mix, rgba, rng, skyColours, still, type RGB } from "./sky.ts";

export type TownHouse = { lot: number; storeys: number; size: number; lit: number; low?: boolean; badges?: number };
export type TownSponsor = { name: string; blurb: string; url: string; color: string };
export type TownChan = { name: string; online: number; messages24h: number };
export type TownData = {
  at: number; houses: TownHouse[]; people: number; homes: number; maxShown: number; quiet: number; mine?: number; myChannel?: string;
  channels: TownChan[]; postTopics: string[]; postsLive: number; posts24h: number; listings: number; rains24h: number; lastRain?: number; hikers: number; off: string[];
  building: number[]; notebooks: number; spawned24h: number; spawned7d: number; newcomers7d: number; cycles: number; burnPerDay: number; fundraisersOpen: number; raisedE8s: number;
  campers: number; meCamping: boolean;
  sponsors: TownSponsor[]; myQuests?: [number, number, number];
};
export type Target =
  | { kind: "house"; house: TownHouse; mine: boolean; building: boolean } | { kind: "plot" } | { kind: "hall" } | { kind: "stall"; channel: TownChan }
  | { kind: "fountain" } | { kind: "board" } | { kind: "market" } | { kind: "factory" } | { kind: "school" } | { kind: "chapel" } | { kind: "tower" }
  | { kind: "park" } | { kind: "trail" } | { kind: "lake" } | { kind: "walker"; channel: string; me: boolean }
  | { kind: "landmark"; landmark: Landmark } | { kind: "district"; district: District } | { kind: "station" } | { kind: "visitor"; mine: boolean };
type Kind = "swiss" | "fence" | "station" | "canopy" | "buffer" | "trestle" | "news" | "datacentre" | "credentials" | "bank" | "exchange" | "capitol" | "statue" | "launchpad" | "office" | "sign" | "house" | "plot" | "garden" | "tree" | "pine" | "poplar" | "bush" | "rock" | "hall" | "stall" | "fountain" | "gazebo" | "market" | "crate" | "factory" | "school" | "chapel" | "tower" | "bench" | "lantern" | "bridge" | "reeds";
export type Obj = { k: Kind; x: number; y: number; w: number; d: number; s: number; tg?: Target; h?: TownHouse; face?: "x" | "y" | ""; ch?: TownChan; mine?: boolean; building?: boolean };
/** Ground cells: nothing (beyond the shore), land, water, road, a bridge over water, railway. */
// ---------------------------------------------------------------- districts and landmarks

/** A place in the town for something beyond Lab: it links out. `at` is [x, y, w, d] in tiles from
 *  the corner of its district block (a block is 6×6 tiles). `office` is the plain building for
 *  anything new: give it a `color` and it needs no drawing code of its own. */
export type Landmark = { sponsored?: boolean; id: string; kind: "bank" | "exchange" | "capitol" | "statue" | "launchpad" | "news" | "datacentre" | "swiss" | "credentials" | "office"; title: string; blurb: string; url: string; block: [number, number]; at: [number, number, number, number]; color?: string };
/** A district: blocks set aside (homes are never built there) for landmarks of a kind; the room
 *  left over is for the next ones. */
export type District = { id: string; name: string; blurb: string; blocks: [number, number][]; landmarks: Landmark[]; outskirts?: boolean };
export const DISTRICTS: District[] = [
  {
    // beside the park and the Square, on the right
    id: "finance", name: "The financial district", blurb: "Where money on the Internet Computer is kept and traded.", blocks: [[2, 0], [2, 1]],
    landmarks: [
      { id: "oisy", kind: "bank", title: "OISY Wallet", blurb: "The bank: a wallet for ICP, Bitcoin, Ethereum and more, and how every payment in Lab is made.", url: "https://oisy.com", block: [2, 0], at: [0.4, 3.4, 2.8, 2.3] },
      { id: "icpswap", kind: "exchange", title: "ICPSwap", blurb: "The exchange: swap ICP and other tokens on the Internet Computer.", url: "https://www.icpswap.com", block: [2, 0], at: [3.2, 3.3, 2.6, 2.5] },
    ],
  },
  {
    // behind the school, on the left
    id: "icp", name: "The ICP quarter", blurb: "The Internet Computer's government, its news, and the people who built it.", blocks: [[-2, -1], [-2, 0]],
    landmarks: [
      { id: "nns", kind: "capitol", title: "The NNS", blurb: "The Network Nervous System: the Internet Computer's government, where ICP neurons vote on every proposal.", url: "https://nns.internetcomputer.org/", block: [-2, -1], at: [0.2, 0.2, 5.6, 2.6] },
      { id: "dfinity-news", kind: "news", title: "DFINITY on X", blurb: "The news station: what's new on the Internet Computer, from the DFINITY Foundation's account on X.", url: "https://x.com/dfinity", block: [-2, 0], at: [0.2, 0.2, 2.8, 2.0] },
      { id: "dominic", kind: "statue", title: "Dominic Williams", blurb: "Founder and chief scientist of DFINITY, who set out to build the Internet Computer.", url: "https://x.com/dominic_w", block: [-2, 0], at: [3.0, 3.0, 2.9, 2.9] },
    ],
  },
  {
    // next to the government quarter
    id: "embassies", name: "Embassy row", blurb: "Countries and global programmes building on the Internet Computer.", blocks: [[-2, 1]],
    landmarks: [
      { id: "pakistan", kind: "datacentre", title: "The Pakistan Subnet", blurb: "In February 2026 the Pakistan Digital Authority and the DFINITY Foundation agreed to build a Pakistan Subnet: a sovereign cloud on the Internet Computer for national apps and AI.", url: "https://internetcomputer.org/news/media-releases/pakistan-digital-authority-dfinity-partnership-announcement/", block: [-2, 1], at: [0.2, 0.3, 3.0, 2.0] },
      { id: "swiss", kind: "swiss", title: "The Swiss Subnet", blurb: "A subnet of the Internet Computer whose 13 independent node providers are all in Switzerland and Liechtenstein, so its data stays there; run by Swiss Subnet AG in Zug, live since January 2026.", url: "https://forum.dfinity.org/t/introducing-the-swiss-subnet-a-secure-and-compliant-blockchain-infrastructure-leveraging-the-internet-computer-protocol/41135", block: [-2, 1], at: [3.5, 0.4, 2.3, 2.0] },
      { id: "undp", kind: "credentials", title: "UNDP · Universal Trusted Credentials", blurb: "UNDP and the DFINITY Foundation build Universal Trusted Credentials on the Internet Computer, so small businesses can prove who they are and get financing, starting with a pilot in Cambodia.", url: "https://www.undp.org/policy-centre/singapore/press-releases/undp-partners-dfinity-foundation-enhance-financial-inclusion-msmes", block: [-2, 1], at: [0.6, 3.2, 3.0, 2.5] },
    ],
  },
  {
    // the back right corner: a building for each project that pays to keep Lab running
    id: "sponsors", name: "The Sponsors", blurb: "Projects that pay by the month for a building here; the ICP keeps Lab running.", blocks: [[1, -2], [2, -2]],
    landmarks: [],
  },
  {
    // out on the coast beyond the last streets, fenced, launching over the sea: rockets are no
    // neighbours for homes. Its landmarks' `at` counts from the corner of the site, not a block.
    id: "spaceport", name: "The spaceport", blurb: "Launchpads for what is next on the Internet Computer, out on the coast where it is safe.", blocks: [], outskirts: true,
    landmarks: [
      { id: "soon", kind: "launchpad", title: "SOON launchpad", blurb: "A launchpad on the Internet Computer. Watch for the next launch.", url: "https://soonlaunchpad.fun/", block: [0, 0], at: [0.5, 0.5, 5, 5] },
    ],
  },
];
const reserved = new Set(DISTRICTS.flatMap((d) => d.blocks.map(([x, y]) => `${x},${y}`)));
const homeBlocks: [number, number][] = [];
let spiralSeen = 0;
/** Homes' block `b`: the spiral of blocks, skipping the ones districts hold. */
export function homeBlock(b: number): [number, number] {
  while (homeBlocks.length <= b) { const c = blockAt(spiralSeen++); if (!reserved.has(c.join())) homeBlocks.push(c); }
  return homeBlocks[b];
}

export const VOID = 0, LAND = 1, WATER = 2, ROAD = 3, BRIDGE = 4, RAIL = 5;
export type Plan = {
  R: number; lo: number; hi: number; n: number; cells: Uint8Array; objs: Obj[]; water: number[][]; paving: number[][];
  stalls: Obj[]; gate: [number, number]; loop: [number, number][]; yard: [number, number, number, number]; lake: [number, number];
  /** the railway along the front of the island: its row, where it comes out of and goes into the hills, where the train stops */
  rail: { y: number; x0: number; x1: number; stop: number }; platform: [number, number][];
};
export const cellAt = (p: Plan, x: number, y: number) => (x < p.lo || y < p.lo || x > p.hi || y > p.hi ? VOID : p.cells[(y - p.lo) * p.n + (x - p.lo)]);

// ---------------------------------------------------------------- the plan

/** Meteorological seasons (northern hemisphere), and how many days until the next begins. */
export function season(d: Date): { name: "winter" | "spring" | "summer" | "autumn"; next: string; days: number } {
  // ponytail: northern hemisphere only; flip by locale if people in the south ask
  const names = ["winter", "spring", "summer", "autumn"] as const;
  const m = d.getMonth(), i = Math.floor(((m + 1) % 12) / 3);
  const y = d.getFullYear() + (m === 11 ? 1 : 0);
  const starts = [new Date(y, 2, 1), new Date(y, 5, 1), new Date(y, 8, 1), new Date(y, 11, 1)];
  const next = starts[i];
  const day0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return { name: names[i], next: names[(i + 1) % 4], days: Math.round((next.getTime() - day0.getTime()) / 864e5) };
}

const SLOTS: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];
/** Residential block `b` (0 = the first block of ring 2) as block coordinates: each ring fills from
 *  the middle of its four sides outward, alternating sides, so the town grows evenly. */
export function blockAt(b: number): [number, number] {
  let r = 2;
  while (4 * (r + 1) * r - 8 <= b) r++;
  const j = b - (4 * r * (r - 1) - 8), side = j % 4, m = Math.floor(j / 4);
  const k = m === 0 ? r : m % 2 ? r - (m + 1) / 2 : r + m / 2;
  return side === 0 ? [-r + k, -r] : side === 1 ? [r, -r + k] : side === 2 ? [r - k, r] : [-r, r - k];
}
const ringOf = (b: number) => { const [x, y] = homeBlock(b); return Math.max(Math.abs(x), Math.abs(y)); };
/** The 2×2 tiles of slot `slot` in block (bx, by), and the side it faces the road on that we can see. */
function lotTiles(bx: number, by: number, slot: number): { x: number; y: number; face: "x" | "y" | "" } {
  const [cx, cy] = SLOTS[slot];
  const face = cx === 2 && cy === 2 ? (slot % 2 ? "x" : "y") : cx === 2 ? "x" : cy === 2 ? "y" : "";
  return { x: 7 * bx + 1 + 2 * cx, y: 7 * by + 1 + 2 * cy, face };
}
/** A well-mixed 0..1 from a string (FNV alone is biased for keys that differ in one character). */
const h01 = (s: string) => { let h = hashOf(s); h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** A smooth wobble around the island (the same every time). */
const shore = (a: number) => 0.52 + 0.26 * Math.sin(3 * a + 1.3) + 0.16 * Math.sin(5 * a + 0.4) + 0.08 * Math.sin(9 * a + 2.2);
const BELT = 13;

export function layoutTown(t: TownData): Plan {
  const off = new Set(t.off), building = new Set(t.building);
  const byLot = new Map(t.houses.map((h) => [h.lot, h]));
  const used = [...t.houses.map((h) => h.lot), ...t.building, ...(t.mine !== undefined ? [t.mine] : [])];
  const maxBlock = used.length ? Math.floor(Math.max(...used) / 8) : 0;
  // the town: the civic centre, all of ring 2, then the blocks that are lived in so far
  const blocks: [number, number][] = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) blocks.push([x, y]);
  const homesBlocks: number[] = [];
  for (const d of DISTRICTS) blocks.push(...d.blocks);
  for (let b = 0; ringOf(b) <= 2 || b <= maxBlock; b++) { homesBlocks.push(b); blocks.push(homeBlock(b)); }
  const R = Math.max(...blocks.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
  const tlo = -7 * R, thi = 7 * R + 7, lo = tlo - BELT, hi = thi + BELT, n = hi - lo + 1;
  const cells = new Uint8Array(n * n);
  const set = (x: number, y: number, v: number) => { if (x >= lo && y >= lo && x <= hi && y <= hi) cells[(y - lo) * n + (x - lo)] = v; };
  const get = (x: number, y: number) => (x < lo || y < lo || x > hi || y > hi ? VOID : cells[(y - lo) * n + (x - lo)]);
  // the island: the town's square of land and an uneven belt of country around it
  const c = (tlo + thi) / 2;
  for (let x = lo; x <= hi; x++) for (let y = lo; y <= hi; y++) {
    const dx = Math.max(tlo - x, 0, x - thi), dy = Math.max(tlo - y, 0, y - thi), d = Math.hypot(dx, dy);
    if (d <= 0.5 + BELT * shore(Math.atan2(y - c, x - c)) * 0.95) set(x, y, LAND);
  }
  // a lake in the country on the left, and a river through it from the back of the island to the front
  const lake: [number, number] = [tlo - 7, Math.round(c) - 4];
  const riverX = (y: number) => lake[0] + (y > lake[1] ? 2.2 : 1.4) * Math.sin((y - lake[1]) * 0.3);
  for (let x = lo; x <= hi; x++) for (let y = lo; y <= hi; y++) {
    const a = Math.atan2(y - lake[1], x - lake[0]), r = 4.6 + 1.1 * Math.sin(3 * a + 0.7);
    const inLake = Math.hypot(x + 0.5 - lake[0], (y + 0.5 - lake[1]) * 1.15) < r, inRiver = Math.abs(x + 0.5 - riverX(y + 0.5)) < 0.95;
    const bank = Math.hypot(x + 0.5 - lake[0], (y + 0.5 - lake[1]) * 1.15) < r + 2 || Math.abs(x + 0.5 - riverX(y + 0.5)) < 3;
    if (inLake || inRiver) set(x, y, WATER); else if (bank && get(x, y) === VOID && x < tlo) set(x, y, LAND);
  }
  // the outskirts, beyond the last streets and away from homes: the spaceport on the back right coast,
  // the works (the notebook factory) in the front right corner by the railway
  const space: [number, number] = [thi + 4, tlo + 4], works: [number, number] = [thi + 2, thi + 1];
  // their ground: rounded and uneven, so the coast bulges round them rather than jutting out in squares;
  // and a strip along the front for the railway from the station to the works
  const bulge = (cx: number, cy: number, r: number) => { for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) { const a = Math.atan2(y - cy, x - cx); if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r * (0.92 + 0.12 * Math.sin(3 * a + cx) + 0.06 * Math.sin(7 * a)) && get(x, y) === VOID) set(x, y, LAND); } };
  bulge(space[0] + 3, space[1] + 3, 6.5);
  bulge(works[0] + 3.5, works[1] + 2.5, 6);
  for (let x = -1; x <= works[0] + 8; x++) { const deep = thi + 7 + Math.round(1.2 * Math.sin(x * 0.45) + 0.8 * Math.sin(x * 1.3)); for (let y = thi + 1; y <= deep; y++) if (get(x, y) === VOID) set(x, y, LAND); }
  // no lakes of nothing inside the island: anything the sea can't reach from the edge is land
  const sea = new Uint8Array(n * n), stack: number[] = [];
  for (let i = 0; i < n; i++) for (const j of [i, (n - 1) * n + i, i * n, i * n + n - 1]) if (!cells[j] && !sea[j]) { sea[j] = 1; stack.push(j); }
  while (stack.length) {
    const j = stack.pop()!, x = j % n, y = (j - x) / n;
    for (const k of [x > 0 ? j - 1 : -1, x < n - 1 ? j + 1 : -1, y > 0 ? j - n : -1, y < n - 1 ? j + n : -1]) if (k >= 0 && !cells[k] && !sea[k]) { sea[k] = 1; stack.push(k); }
  }
  for (let j = 0; j < n * n; j++) if (!cells[j] && !sea[j]) cells[j] = LAND;
  // the railway runs across the front of the island, the station by the town gate
  const TY = thi + 5;
  let rx0 = 7, rx1 = 7;
  while (get(rx0 - 1, TY) !== VOID && rx0 - 1 > lo + 1) rx0--;
  while (get(rx1 + 1, TY) !== VOID && rx1 + 1 < hi - 1) rx1++;
  const trestle: number[] = [];
  for (let x = rx0; x <= rx1; x++) { if (get(x, TY) === WATER) trestle.push(x); else set(x, TY, RAIL); }
  for (let y = thi + 1; y <= TY - 3; y++) set(7, y, ROAD);
  // the road out of town to the west, over the river on a bridge
  for (let x = tlo - 1; x >= lo; x--) { const v = get(x, 7); if (v === VOID) break; set(x, 7, v === WATER ? BRIDGE : ROAD); }
  // the streets: around every block of the town
  for (const [bx, by] of blocks) for (let i = 0; i <= 7; i++) for (const [x, y] of [[7 * bx + i, 7 * by], [7 * bx + i, 7 * by + 7], [7 * bx, 7 * by + i], [7 * bx + 7, 7 * by + i]]) set(x, y, ROAD);
  // access roads from the outskirts to the nearest street: along the street rows, so they cross no lots
  const access = (x: number, y: number) => { for (; x >= tlo - 1 && get(x, y) !== ROAD; x--) if (get(x, y) === LAND) set(x, y, ROAD); };
  access(space[0] - 1, space[1] + 3);
  access(works[0] + 5, thi);
  const inBlock = new Set<string>();
  for (const [bx, by] of blocks) for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) inBlock.add(`${7 * bx + x},${7 * by + y}`);

  const objs: Obj[] = [], water: number[][] = [], paving: number[][] = [];
  const put = (o: Obj) => { objs.push(o); return o; };
  const tree = (x: number, y: number, seed: string, kind?: "tree" | "pine" | "poplar" | "bush") => {
    const r = h01(seed), k = kind ?? (r < 0.42 ? "pine" : r < 0.8 ? "tree" : r < 0.92 ? "poplar" : "bush");
    return put({ k, x: x - 0.3, y: y - 0.3, w: 0.6, d: 0.6, s: hashOf(seed) });
  };
  /** One lot: a home (or one being built), your quiet plot, or something green. */
  const lot = (bx: number, by: number, slot: number, n: number) => {
    const { x, y, face } = lotTiles(bx, by, slot);
    const mine = n === t.mine, isNew = building.has(n);
    const h = byLot.get(n) ?? (isNew ? { lot: n, storeys: 1, size: 0, lit: 2 } : undefined);
    if (h) {
      // the house sits toward its road; bigger houses fill more of the lot
      const fw = [1.1, 1.3, 1.5, 1.75][h.size], fd = [1.0, 1.2, 1.45, 1.7][h.size];
      const ox = face === "x" ? 1.9 - fw : 0.1 + (1.8 - fw) / 2, oy = face === "y" ? 1.9 - fd : 0.1 + (1.8 - fd) / 2;
      put({ k: "house", x: x + ox, y: y + oy, w: fw, d: fd, s: hashOf(`lot${h.lot}`), h, face, mine, building: isNew, tg: { kind: "house", house: h, mine, building: isNew } });
      if (h.size === 0 && !isNew) put({ k: "garden", x: x + (face === "x" ? 0.15 : 1.3), y: y + (face === "y" ? 0.15 : 1.3), w: 0.55, d: 0.55, s: 1 });
      return;
    }
    if (mine) { put({ k: "plot", x: x + 0.15, y: y + 0.15, w: 1.7, d: 1.7, s: 0, mine, tg: { kind: "plot" } }); return; }
    const key = `${bx},${by},${slot}`, r = h01(`fill${key}`);
    if (r < 0.5) { tree(x + 0.6, y + 0.6, `a${key}`); if (r < 0.3) tree(x + 1.4, y + 1.3, `b${key}`); if (r < 0.15) tree(x + 1.3, y + 0.5, `c${key}`, "bush"); }
    else if (r < 0.7) put({ k: "garden", x: x + 0.3, y: y + 0.3, w: 1.4, d: 1.4, s: hashOf(key) });
    else if (r < 0.78) water.push([x + 0.25, y + 0.25, 1.5, 1.5]);
    else if (r < 0.9) put({ k: "rock", x: x + 0.7, y: y + 0.8, w: 0.5, d: 0.4, s: hashOf(key) });
  };
  for (const b of homesBlocks) {
    const [bx, by] = homeBlock(b);
    for (let s = 0; s < 8; s++) lot(bx, by, s, b * 8 + s);
    tree(7 * bx + 4, 7 * by + 4, `court${bx},${by}`, "tree");
  }
  // the districts: their landmarks, a sign, and room for more (the sponsors' buildings come with the data)
  const SLOTS4: [number, number, number, number][] = [[0.3, 0.3, 2.4, 2.4], [3.3, 0.3, 2.4, 2.4], [0.3, 3.3, 2.4, 2.4], [3.3, 3.3, 2.4, 2.4]];
  const districts = DISTRICTS.map((d) => d.id !== "sponsors" ? d : { ...d, landmarks: t.sponsors.slice(0, 8).map((sp, i): Landmark => ({ sponsored: true, id: `sponsor-${i}`, kind: "office", title: sp.name, blurb: sp.blurb, url: sp.url, color: sp.color, block: d.blocks[Math.floor(i / 4)], at: SLOTS4[i % 4] })) });
  for (const dist of districts) {
    for (const [bx, by] of dist.blocks) paving.push([7 * bx + 1, 7 * by + 1, 6, 6]);
    const origin = (lm: Landmark): [number, number] => (dist.outskirts ? space : [7 * lm.block[0] + 1, 7 * lm.block[1] + 1]);
    for (const lm of dist.landmarks) { const [ox, oy, w, d] = lm.at, [x0, y0] = origin(lm); put({ k: lm.kind, x: x0 + ox, y: y0 + oy, w, d, s: hashOf(lm.id), tg: { kind: "landmark", landmark: lm } }); }
    if (dist.outskirts) {
      // a fence around the site (open where the road comes in) and its name at the gate
      paving.push([space[0], space[1], 6, 6]);
      put({ k: "fence", x: space[0] - 0.3, y: space[1] - 0.3, w: 6.6, d: 6.6, s: 0 });
      put({ k: "sign", x: space[0] - 0.8, y: space[1] + 4.2, w: 0.3, d: 0.1, s: 1, tg: { kind: "district", district: dist } });
    }
    // every 3×3 corner of a district block nobody holds yet: grass and a tree or two (the first one
    // carries the district's name)
    let named = false;
    for (const [bx, by] of dist.blocks) for (const [cx, cy] of [[0, 0], [3, 0], [0, 3], [3, 3]]) {
      const x0 = 7 * bx + 1 + cx, y0 = 7 * by + 1 + cy;
      const taken = dist.landmarks.some((lm) => { const [ox, oy, w, d] = lm.at, lx = 7 * lm.block[0] + 1 + ox, ly = 7 * lm.block[1] + 1 + oy; return lx < x0 + 3 && lx + w > x0 && ly < y0 + 3 && ly + d > y0; });
      if (taken) continue;
      tree(x0 + 0.7, y0 + 0.8, `ds${x0},${y0}`, "tree"); tree(x0 + 2.3, y0 + 0.6, `dt${x0},${y0}`, "bush");
      if (!named) put({ k: "sign", x: x0 + 1.3, y: y0 + 2.0, w: 0.3, d: 0.1, s: 1, tg: { kind: "district", district: dist } });
      named = true;
    }
    // a district with no room left: its name at the front corner of its first block
    if (!named && dist.blocks.length) { const [bx, by] = dist.blocks[0]; put({ k: "sign", x: 7 * bx + 5.9, y: 7 * by + 6.2, w: 0.3, d: 0.1, s: 1, tg: { kind: "district", district: dist } }); }
  }
  // the civic centre: the town hall
  paving.push([1, 1, 6, 6]);
  put({ k: "hall", x: 2, y: 2, w: 4, d: 4, s: 0, tg: { kind: "hall" } });
  // the Square: a fountain, a stall for each channel around it, the way in from the west road
  paving.push([8, 8, 6, 6]);
  put({ k: "fountain", x: 10.2, y: 10.2, w: 1.6, d: 1.6, s: 0, tg: { kind: "fountain" } });
  const ring: [number, number][] = [];
  for (let x = 8; x <= 13; x++) ring.push([x, 8]);
  for (let y = 9; y <= 13; y++) ring.push([13, y]);
  for (let x = 12; x >= 8; x--) ring.push([x, 13]);
  for (let y = 12; y >= 9; y--) if (y !== 10 && y !== 11) ring.push([8, y]);
  const chans = t.channels.slice(0, 16);
  // spread around the Square, evenly
  const stalls = chans.map((ch, i) => { const at = ring[Math.floor((i * ring.length) / chans.length)]; return put({ k: "stall", x: at[0] + 0.12, y: at[1] + 0.12, w: 0.76, d: 0.76, s: i, ch, tg: { kind: "stall", channel: ch } }); });
  // the board's pavilion (left)
  paving.push([-5, 9, 4, 4]);
  put({ k: "gazebo", x: -4.4, y: 9.6, w: 2.8, d: 2.8, s: 0, tg: { kind: "board" } });
  for (const [x, y] of [[-5.5, 8.5], [-0.5, 8.5], [-5.5, 13.5], [-0.5, 13.5]]) tree(x, y, `bd${x}${y}`, "tree");
  // the market hall (right), or a park while the market is off
  if (!off.has("market")) {
    paving.push([8, -6, 6, 6]);
    put({ k: "market", x: 8.6, y: -5.4, w: 4.8, d: 2.4, s: 0, tg: { kind: "market" } });
    for (let i = 0; i < Math.min(12, t.listings); i++) put({ k: "crate", x: 8.8 + (i % 6) * 0.78, y: -2.4 + Math.floor(i / 6) * 0.8, w: 0.5, d: 0.5, s: i });
  } else {
    water.push([9.2, -5, 2.6, 2]);
    for (const [x, y] of [[8.6, -1.4], [12.8, -1.6], [13, -5.4], [10.6, -1.0]]) tree(x, y, `mk${x}${y}`);
    put({ k: "bench", x: 10.3, y: -2.6, w: 1, d: 0.35, s: 0 });
  }
  // the notebook works, out in the front right corner by the railway: the registry, where every notebook is
  // made, a crate in its yard for each this week, ready to go out by train
  paving.push([works[0] - 0.3, works[1] - 0.3, 6.6, 3.9]);
  put({ k: "factory", x: works[0], y: works[1], w: 4.4, d: 2.8, s: 0, tg: { kind: "factory" } });
  for (let i = 0; i < Math.min(10, t.spawned7d); i++) put({ k: "crate", x: works[0] + 4.7 + (i % 2) * 0.7, y: works[1] + 0.2 + Math.floor(i / 2) * 0.62, w: 0.5, d: 0.5, s: i + 20 });
  // where the works stood, behind the town hall: the town green, a pond under trees, benches
  water.push([-5.3, -5.2, 3.2, 2.6]);
  for (const [x, y] of [[-5.6, -1.6], [-1.6, -5.6], [-1.4, -1.4], [-3.6, -1.2], [-1.2, -3.4]]) tree(x, y, `gr${x}${y}`, "tree");
  put({ k: "bench", x: -4.6, y: -2.2, w: 1, d: 0.35, s: 0, tg: { kind: "park" } });
  put({ k: "bench", x: -2.4, y: -4.4, w: 0.35, d: 1, s: 0 });
  // the school (back left), its yard full of this week's newcomers
  put({ k: "school", x: -5.6, y: 1.4, w: 3.8, d: 2.0, s: 0, tg: { kind: "school" } });
  paving.push([-6, 4, 5, 2.6]);
  for (const [x, y] of [[-0.6, 1.6], [-0.7, 5.4]]) tree(x, y, `sc${x}${y}`, "tree");
  // the chapel (back right), where fundraisers ring the bell
  put({ k: "chapel", x: 2.4, y: -5.6, w: 2.0, d: 3.6, s: 0, tg: { kind: "chapel" } });
  paving.push([2, -2, 3, 1]);
  for (const [x, y] of [[5.4, -5.4], [5.6, -3.4], [1.4, -1.2], [5.4, -1.4]]) tree(x, y, `ch${x}${y}`, x > 5 ? "poplar" : "tree");
  // the park (front right): a pond, and the water tower that shows the town's cycles
  water.push([8.7, 1.5, 2.8, 2.2]);
  put({ k: "tower", x: 11.7, y: 3.4, w: 1.4, d: 1.4, s: 0, tg: { kind: "tower" } });
  for (const [x, y] of [[8.6, 5.4], [13.2, 1.4], [10.4, 5.7], [13.3, 6.2]]) tree(x, y, `pk${x}${y}`);
  put({ k: "bench", x: 9.2, y: 4.6, w: 1, d: 0.35, s: 0, tg: { kind: "park" } });
  // the trailhead grove (front left): a loop path with lanterns that hikers walk
  const loop: [number, number][] = [[2.5, 9.5], [5.5, 9.5], [5.5, 12.5], [2.5, 12.5]];
  for (let x = 1; x <= 6; x++) for (let y = 8; y <= 13; y++) {
    const onPath = (y === 9 || y === 12) && x >= 2 && x <= 5 || (x === 2 || x === 5) && y >= 9 && y <= 12;
    if (!onPath && h01(`tr${x},${y}`) < 0.75) tree(x + 0.5, y + 0.5, `tr${x},${y}`, h01(`tp${x},${y}`) < 0.7 ? "pine" : "tree");
  }
  for (const [x, y] of loop) put({ k: "lantern", x: x - 0.1, y: y - 0.1, w: 0.2, d: 0.2, s: 0, tg: { kind: "trail" } });
  // the station: a platform along the track where visitors wait (people who signed in this month and
  // have no notebook yet; yours first), a station house, tunnel mouths at both ends, a trestle over the river
  const camp = new Set<string>();
  for (let x = space[0] - 1; x <= space[0] + 7; x++) for (let y = space[1] - 1; y <= space[1] + 7; y++) camp.add(`${x},${y}`);
  for (let x = works[0] - 1; x <= works[0] + 7; x++) for (let y = works[1] - 1; y <= works[1] + 4; y++) camp.add(`${x},${y}`);
  for (let x = 0; x <= 15; x++) for (let y = TY - 3; y <= TY - 1; y++) camp.add(`${x},${y}`);
  paving.push([0.6, TY - 1, 14, 0.9]);
  put({ k: "station", x: 8.4, y: TY - 3, w: 4.2, d: 1.7, s: 0, tg: { kind: "station" } });
  put({ k: "canopy", x: 1.2, y: TY - 1, w: 5.6, d: 0.9, s: 0, tg: { kind: "station" } });
  for (const x of [rx0, rx1]) put({ k: "buffer", x: x === rx0 ? x : x + 0.7, y: TY + 0.15, w: 0.3, d: 0.7, s: 0 });
  for (const x of trestle) put({ k: "trestle", x, y: TY, w: 1, d: 1, s: 0 });
  const platform: [number, number][] = [];
  for (let i = 0; i < 24; i++) platform.push([1 + ((i * 0.585) % 13.6), TY - 0.45 - (i % 2) * 0.3]);
  // the country: woods that thin toward the shore  // the country: woods that thin toward the shore, reeds by the water, the bridge
  for (let x = lo; x <= hi; x++) for (let y = lo; y <= hi; y++) {
    const v = get(x, y);
    if (v === BRIDGE) { put({ k: "bridge", x, y, w: 1, d: 1, s: 0 }); continue; }
    if (v !== LAND || inBlock.has(`${x},${y}`) || camp.has(`${x},${y}`)) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => get(x + a, y + b));
    if (near.includes(WATER)) { if (h01(`rd${x},${y}`) < 0.35) put({ k: "reeds", x: x + 0.3, y: y + 0.3, w: 0.4, d: 0.4, s: hashOf(`rd${x},${y}`) }); continue; }
    if (near.includes(ROAD) || near.includes(BRIDGE) || near.includes(RAIL)) continue;
    const coast = near.includes(VOID) ? 0.12 : 0;
    if (h01(`f${x},${y}`) < 0.5 - coast) tree(x + 0.5, y + 0.5, `f${x},${y}`);
  }
  put({ k: "rock", x: lake[0] + 2.6, y: lake[1] - 3.1, w: 0.5, d: 0.4, s: 7, tg: { kind: "lake" } });
  // the gate: where the street between the Square and the grove leaves town
  let gy = 14;
  while (get(7, gy + 1) === ROAD) gy++;
  // painter's order: back to front by the middle of each footprint
  objs.sort((a, b) => a.x + a.w / 2 + a.y + a.d / 2 - (b.x + b.w / 2 + b.y + b.d / 2) || a.x - b.x);
  return { R, lo, hi, n, cells, objs, water, paving, stalls, gate: [7.5, gy + 0.5], loop, yard: [-5.6, 4.2, 4.4, 2.2], lake, rail: { y: TY, x0: rx0, x1: rx1, stop: 8.2 }, platform };
}

// ---------------------------------------------------------------- drawing

const TW = 32, TH = 16;
/** A point on the ground (tiles) and its height (px) on screen, before the camera. */
export const project = (x: number, y: number, z = 0): [number, number] => [(x - y) * (TW / 2), (x + y) * (TH / 2) - z];
export const unproject = (sx: number, sy: number): [number, number] => [sy / TH + sx / TW, sy / TH - sx / TW];

type Pal = { ground: string; grid: string; road: string; pave: string; edge: string; line: string; wall: string; wallR: string; roofs: string[]; water: string; leaf: string[]; pine: string; trunk: string; win: string; lit: string; person: string[] };
const ROOFS = ["#f2b8c6", "#b9dcc2", "#b8cfee", "#f3dea0", "#d4c6ef"];
function palette(dark: boolean, sea: ReturnType<typeof season>["name"]): Pal {
  const leaf = { winter: ["#dfe8d5", "#e8e2cc", "#d3e2d6"], spring: ["#f6c9d6", "#cde6c4", "#f9dbe3"], summer: ["#a9d3a8", "#bcdcae", "#9ccaa5"], autumn: ["#f2c27e", "#e9a27a", "#efd08d"] }[sea];
  const pine = sea === "winter" ? "#a8c6b4" : "#8fbba0";
  const day: Pal = {
    ground: { winter: "#f6f6f3", spring: "#eef3e6", summer: "#e7efda", autumn: "#f2ede1" }[sea], grid: "rgba(40,50,70,.07)", road: "#e2e3e6", pave: "#ececeb", edge: "#dcdfe4",
    line: "#3a3f4a", wall: "#fdfdfc", wallR: "#e9ebee", roofs: ROOFS, water: sea === "winter" ? "#dbe8ee" : "#c9e1ec", leaf, pine, trunk: "#8a7a68",
    win: "#c8d6e6", lit: "#ffd98a", person: ["#5b6b8c", "#c0727e", "#6f9a7a", "#b08a4a", "#7c6fb0"],
  };
  if (!dark) return day;
  const dim = (c: string, t = 0.5) => { const m = mix(hex(c), [36, 42, 58], t); return `rgb(${m.map((v) => v | 0).join(",")})`; };
  return {
    ...day, ground: sea === "winter" ? "#2a3142" : "#222a38", grid: "rgba(255,255,255,.045)", road: "#303849", pave: "#2e3545", edge: "#161b26",
    line: "#0c0f16", wall: "#4a5265", wallR: "#3d4456", roofs: ROOFS.map((r) => dim(r, 0.45)), water: sea === "winter" ? "#3a4a5c" : "#2a4258",
    leaf: leaf.map((l) => dim(l, 0.5)), pine: dim(pine, 0.45), trunk: "#5a5048", win: "#2c3343", person: day.person.map((p) => dim(p, 0.2)),
  };
}

type Walker = { tg?: Target; ch: string; me: boolean; path: [number, number][]; i: number; u: number; speed: number; state: "in" | "stay" | "out"; home: [number, number]; wob: number; c: number; leave?: boolean };
type Hit = { x0: number; y0: number; x1: number; y1: number; tg: Target };
export type TownOpts = { data: TownData; mode: "preview" | "full"; dark: boolean; accent: string; onOpen: (t: Target) => void; tip: (t: Target) => string };

const S = {
  canvas: undefined as HTMLCanvasElement | undefined, ctx: undefined as CanvasRenderingContext2D | undefined, tipEl: undefined as HTMLElement | undefined,
  w: 0, h: 0, dpr: 1, plan: undefined as Plan | undefined, data: undefined as TownData | undefined, sig: "", o: undefined as TownOpts | undefined,
  pal: palette(false, "winter"), sea: season(new Date()), accent: hex("#6d7cff"),
  cam: { x: 0, y: 0, z: 1 }, camHome: [0, 0] as [number, number], camMode: "", fit: 1,
  walkers: [] as Walker[], hikers: [] as { u: number; speed: number; c: number }[], bubbles: [] as { i: number; at: number }[], nextBubble: new Map<string, number>(),
  hits: [] as Hit[], hover: undefined as Target | undefined,
  raf: 0, last: 0, t0: performance.now(), still: still(), ro: undefined as ResizeObserver | undefined,
  drag: undefined as { x: number; y: number; cx: number; cy: number; moved: boolean } | undefined, pts: new Map<number, [number, number]>(), pinch: 0,
  tapped: undefined as Target | undefined, pinched: false, warned: false, visitorTg: [] as Target[], flakes: [] as [number, number, number][],
};

let ctx!: CanvasRenderingContext2D;
let line = 1.3;
function poly(pts: [number, number][], fill?: string, stroke = true) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) ctx.stroke();
}
const P = project;
const flat = (x: number, y: number, w: number, d: number, z = 0): [number, number][] => [P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)];
/** A box: the two faces we see, then its top. */
function box(x: number, y: number, w: number, d: number, h: number, left: string, right: string, top?: string, z = 0) {
  poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], left);
  poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], right);
  if (top) poly(flat(x, y, w, d, z + h), top);
}
/** A rectangle on the front (y + d) face or the right (x + w) face: u along it, z up. */
function onFace(f: "y" | "x", x: number, y: number, w: number, d: number, u0: number, u1: number, z0: number, z1: number, fill: string, stroke = true) {
  const at = (u: number, z: number) => (f === "y" ? P(x + u, y + d, z) : P(x + w, y + u, z));
  poly([at(u0, z0), at(u1, z0), at(u1, z1), at(u0, z1)], fill, stroke);
}
const shade = (c: string, t: number) => { const m = mix(hex(c.startsWith("#") ? c : "#888888"), [0, 0, 0], t); return `rgb(${m.map((v) => v | 0).join(",")})`; };
const toHex = (c: string) => { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(c); return m ? "#" + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, "0")).join("") : c; };
/** A channel's latest counts (the plan keeps the ones it was laid out with). */
const chan = (name: string) => S.data!.channels.find((c) => c.name === name) ?? { name, online: 0, messages24h: 0 };
/** The Internet Computer's colours, for the NNS flag and the rocket's band. */
const ICP = ["#29abe2", "#522785", "#ed1e79", "#f15a24", "#fbb03b"];
const acc = () => `rgb(${S.accent.map((v) => v | 0).join(",")})`;
function hit(pts: [number, number][], tg?: Target) {
  if (!tg) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  S.hits.push({ x0, y0, x1, y1, tg });
}

/** A crane beside a building site: a lattice mast, a jib, a load swinging on its cable. */
function crane(bx: number, by: number, t: number) {
  const [mx, my] = P(bx, by), top = my - 58, sway = S.still ? 0 : Math.sin(t * 0.8) * 3;
  ctx.save(); ctx.strokeStyle = S.pal.line;
  ctx.lineWidth = line * 1.1;
  ctx.beginPath(); ctx.moveTo(mx - 2.5, my); ctx.lineTo(mx - 2.5, top); ctx.moveTo(mx + 2.5, my); ctx.lineTo(mx + 2.5, top); ctx.stroke();
  ctx.beginPath(); for (let z = my; z > top + 5; z -= 6) { ctx.moveTo(mx - 2.5, z); ctx.lineTo(mx + 2.5, z - 6); } ctx.stroke();
  ctx.lineWidth = line * 1.6; ctx.strokeStyle = "#e0a92e";
  ctx.beginPath(); ctx.moveTo(mx - 44, top); ctx.lineTo(mx + 16, top); ctx.stroke();
  ctx.lineWidth = line;
  ctx.strokeStyle = S.pal.line; ctx.beginPath(); ctx.moveTo(mx - 34 + sway, top); ctx.lineTo(mx - 34 + sway, top + 24); ctx.stroke();
  ctx.restore();
  poly([[mx + 10, top - 1], [mx + 16, top - 1], [mx + 16, top + 5], [mx + 10, top + 5]], shade(S.pal.wallR.startsWith("#") ? S.pal.wallR : "#cccccc", 0.3));
  poly([[mx - 38 + sway, top + 24], [mx - 30 + sway, top + 24], [mx - 30 + sway, top + 29], [mx - 38 + sway, top + 29]], "#d9b98e");
}
/** A notebook made in the last three days: the house going up, its frame, scaffolding and a crane. */
function drawSite(o: Obj, t: number) {
  const p = S.pal, night = S.o!.dark, { x, y, w, d } = o, h = 14, rh = 6 + Math.min(w, d) * 5;
  poly(flat(x - 0.15, y - 0.15, w + 0.3, d + 0.3), night ? "#463f35" : "#e8dcc6", false);
  box(x, y, w, d, 2, shade(p.wallR.startsWith("#") ? p.wallR : "#e9ebee", 0.06), shade(p.wallR.startsWith("#") ? p.wallR : "#e9ebee", 0.12), p.pave);
  // the walls are half up
  const brick = night ? "#7a5a4a" : "#e9c3a8";
  box(x, y, w, d, h * 0.45, brick, shade(brick, 0.1), undefined, 2);
  // the frame: corner posts, top beams, rafters to the ridge
  const corners: [number, number][] = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
  ctx.save(); ctx.strokeStyle = night ? "#b8946a" : "#a87f52"; ctx.lineWidth = line * 1.3;
  ctx.beginPath();
  for (const [cx, cy] of corners) { const a = P(cx, cy, 2), b = P(cx, cy, h); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  corners.forEach(([cx, cy], i) => { const [nx, ny] = corners[(i + 1) % 4], a = P(cx, cy, h), b = P(nx, ny, h); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); });
  for (const u of [0, 0.5, 1]) { const a = P(x + w * u, y, h), m = P(x + w * u, y + d / 2, h + rh), b = P(x + w * u, y + d, h); ctx.moveTo(a[0], a[1]); ctx.lineTo(m[0], m[1]); ctx.lineTo(b[0], b[1]); }
  { const a = P(x, y + d / 2, h + rh), b = P(x + w, y + d / 2, h + rh); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke(); ctx.restore();
  scaffold(o, h + 2);
  // a pallet of bricks
  box(x + w + 0.08, y + d - 0.45, 0.4, 0.4, 3, brick, shade(brick, 0.12), shade(brick, -0.05));
  crane(x - 0.2, y - 0.25, t);
}
/** Scaffolding along the front of a building: poles and two planks. */
function scaffold(o: Obj, top: number) {
  const { x, y, w, d } = o, yy = y + d + 0.18;
  ctx.save(); ctx.strokeStyle = S.o!.dark ? "#8a93a8" : "#7d8597"; ctx.lineWidth = line;
  ctx.beginPath();
  for (const u of [0.05, w / 2, w - 0.05]) { const a = P(x + u, yy, 0), b = P(x + u, yy, top); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  for (const z of [top * 0.45, top * 0.9]) { const a = P(x, yy, z), b = P(x + w, yy, z); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke(); ctx.restore();
}
function drawHouse(o: Obj, t: number) {
  const p = S.pal, hv = o.h!, r = rng(o.s), night = S.o!.dark;
  const { x, y, w, d } = o;
  if (o.building && hv.storeys <= 1) { drawSite(o, t); if (o.mine) mineMark(o, 30, t); return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), P(x, y, 58)], o.tg); }
  const h = 6 + hv.storeys * 8, roofC = toHex(p.roofs[Math.floor(r() * 5)]), shape = Math.floor(r() * 3), chim = r() < 0.6;
  const wallL = p.wall, wallR = p.wallR;
  if (o.mine) { ctx.save(); ctx.strokeStyle = acc(); ctx.lineWidth = line * 1.6; }
  box(x, y, w, d, h, wallL, wallR);
  // windows: lit at night when the house was edited this week
  const lit = night && hv.lit >= 1, winC = lit ? p.lit : p.win;
  for (let s = 0; s < hv.storeys; s++) {
    const z0 = 4 + s * 8, z1 = z0 + 4;
    const nl = Math.max(1, Math.round(w / 0.55)), nr = Math.max(1, Math.round(d / 0.55));
    for (let i = 0; i < nl; i++) { const u = (i + 0.5) * (w / nl); if (s === 0 && o.face === "y" && i === Math.floor(nl / 2)) continue; onFace("y", x, y, w, d, u - 0.11, u + 0.11, z0, z1, winC); }
    for (let i = 0; i < nr; i++) { const u = (i + 0.5) * (d / nr); if (s === 0 && o.face === "x" && i === Math.floor(nr / 2)) continue; onFace("x", x, y, w, d, u - 0.11, u + 0.11, z0, z1, winC); }
  }
  if (o.face === "y") onFace("y", x, y, w, d, w / 2 - 0.13, w / 2 + 0.13, 0, 6.5, shade(roofC, 0.25));
  if (o.face === "x") onFace("x", x, y, w, d, d / 2 - 0.13, d / 2 + 0.13, 0, 6.5, shade(roofC, 0.25));
  if (lit) { const [cx, cy] = P(x + w / 2, y + d, h / 2); const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26); g.addColorStop(0, "rgba(255,210,130,.18)"); g.addColorStop(1, "rgba(255,210,130,0)"); ctx.fillStyle = g; ctx.fillRect(cx - 26, cy - 26, 52, 52); }
  let top = h;
  {
    const rh = 6 + Math.min(w, d) * 5, dark2 = shade(roofC, 0.12);
    if (shape === 0) { // gable, ridge along x
      poly([P(x, y, h), P(x + w, y, h), P(x + w, y + d / 2, h + rh), P(x, y + d / 2, h + rh)], dark2);
      poly([P(x, y + d, h), P(x + w, y + d, h), P(x + w, y + d / 2, h + rh), P(x, y + d / 2, h + rh)], roofC);
      poly([P(x + w, y, h), P(x + w, y + d, h), P(x + w, y + d / 2, h + rh)], wallR);
    } else if (shape === 1) { // gable, ridge along y
      poly([P(x, y, h), P(x, y + d, h), P(x + w / 2, y + d, h + rh), P(x + w / 2, y, h + rh)], dark2);
      poly([P(x + w, y, h), P(x + w, y + d, h), P(x + w / 2, y + d, h + rh), P(x + w / 2, y, h + rh)], shade(roofC, 0.06));
      poly([P(x, y + d, h), P(x + w, y + d, h), P(x + w / 2, y + d, h + rh)], wallL);
    } else { // pyramid
      const a = P(x + w / 2, y + d / 2, h + rh);
      poly([P(x, y, h), P(x + w, y, h), a], dark2); poly([P(x, y, h), P(x, y + d, h), a], dark2);
      poly([P(x + w, y, h), P(x + w, y + d, h), a], shade(roofC, 0.06)); poly([P(x, y + d, h), P(x + w, y + d, h), a], roofC);
    }
    if (chim) box(x + w * 0.25, y + d * 0.2, 0.18, 0.18, rh * 0.75 + 3, shade(roofC, 0.3), shade(roofC, 0.4), shade(roofC, 0.2), h);
    top = h + rh;
    // smoke when it was edited today
    if (chim && hv.lit === 2 && !S.still) {
      const [cx, cy] = P(x + w * 0.34, y + d * 0.29, h + rh * 0.75 + 3);
      for (let i = 0; i < 4; i++) {
        const u = ((t * 0.35 + i / 4 + (o.s % 97) / 97) % 1);
        ctx.fillStyle = night ? `rgba(200,210,230,${0.35 * (1 - u)})` : `rgba(150,158,170,${0.35 * (1 - u)})`;
        ctx.beginPath(); ctx.arc(cx + Math.sin(u * 6 + i) * 3 + u * 6, cy - u * 22, 1.5 + u * 3, 0, 6.283); ctx.fill();
      }
    }
  }
  trimmings(o, h, roofC, t);
  if (o.mine) ctx.restore();
  // a new notebook: another storey going up
  if (o.building) { scaffold(o, h + 4); crane(x - 0.2, y - 0.25, t); top = Math.max(top, 58); }
  // running low on cycles: a red lamp by the door blinks
  if (hv.low) {
    const on = S.still || Math.sin(t * 3 + o.s) > -0.2, [lx, ly] = o.face === "x" ? P(x + w, y + d / 2 + 0.3, 8) : P(x + w / 2 + 0.3, y + d, 8);
    if (on) { const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 9); g.addColorStop(0, "rgba(240,80,70,.55)"); g.addColorStop(1, "rgba(240,80,70,0)"); ctx.fillStyle = g; ctx.fillRect(lx - 9, ly - 9, 18, 18); }
    ctx.fillStyle = on ? "#f0504a" : "#8a3a36"; ctx.beginPath(); ctx.arc(lx, ly, 1.7, 0, 6.283); ctx.fill(); ctx.stroke();
  }
  if (o.mine) mineMark(o, top, t);
  hit([P(x, y, 0), P(x + w, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w / 2, y + d / 2, top)], o.tg);
}
/** A two-stage rocket in the Falcon 9 manner, drawn upward from (0, 0): white and slender, black
 *  landing legs folded at its foot, grid fins and a black interstage, a second stage, a fairing. */
function falcon(t: number, firing: boolean, night: boolean) {
  const r = 3.6, white = "#fbfbfa", shadeR = "rgba(0,0,0,.09)", black = "#23262e";
  if (firing) {
    const fl = 22 + Math.sin(t * 40) * 4;
    poly([[-4.5, 0], [4.5, 0], [2.5, fl * 0.7], [0, fl + 10], [-2.5, fl * 0.7]], "#ffb347", false);
    poly([[-2.6, 0], [2.6, 0], [0, fl]], "#fff3c4", false);
    ctx.fillStyle = "rgba(255,255,255,.85)"; for (let i = 1; i <= 3; i++) { const yy = i * fl * 0.24; ctx.beginPath(); ctx.moveTo(0, yy - 1.6); ctx.lineTo(1.2, yy); ctx.lineTo(0, yy + 1.6); ctx.lineTo(-1.2, yy); ctx.fill(); }
  }
  // the first stage, its engines and folded legs
  poly([[-r, 0], [r, 0], [r, -54], [-r, -54]], white);
  poly([[r * 0.35, 0], [r, 0], [r, -54], [r * 0.35, -54]], shadeR, false);
  poly([[-r, 0], [r, 0], [r, -3], [-r, -3]], black);
  ctx.fillStyle = night ? "#555a66" : "#8a8f99"; for (const ex of [-2.2, 0, 2.2]) { ctx.beginPath(); ctx.ellipse(ex, 1.2, 1.1, 0.7, 0, 0, 6.283); ctx.fill(); }
  for (const side of [-1, 1]) poly([[side * r, -2], [side * (r + 1.2), -4], [side * (r + 0.6), -15], [side * r, -15]], black);
  ctx.save(); ctx.font = "800 4px Inter, system-ui, sans-serif"; ctx.fillStyle = "#3a3f4a"; ctx.translate(-0.6, -20); ctx.rotate(-Math.PI / 2); ctx.fillText("SOON", 0, 0); ctx.restore();
  // grid fins and the interstage
  for (const side of [-1, 1]) poly([[side * r, -49], [side * (r + 2.4), -49.6], [side * (r + 2.4), -52], [side * r, -51.6]], black);
  poly([[-r, -54], [r, -54], [r, -60], [-r, -60]], black);
  // the second stage and the fairing
  poly([[-r, -60], [r, -60], [r, -72], [-r, -72]], white);
  poly([[r * 0.35, -60], [r, -60], [r, -72], [r * 0.35, -72]], shadeR, false);
  ctx.beginPath(); ctx.moveTo(-r - 0.6, -72); ctx.lineTo(r + 0.6, -72); ctx.lineTo(r + 0.6, -80); ctx.quadraticCurveTo(r + 0.4, -88, 0, -92); ctx.quadraticCurveTo(-r - 0.4, -88, -r - 0.6, -80); ctx.closePath();
  ctx.fillStyle = white; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -72); ctx.lineTo(0, -91); ctx.save(); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.restore();
  poly([[-r, 0], [r, 0], [r, -72], [-r, -72]], undefined);
}
/** A flag on a pole: Pakistan's (green, a white band at the hoist, a crescent and star), or plain sky blue. */
function flag(x: number, y: number, h: number, kind: "pk" | "blue" | "ch", t: number) {
  const [px, py] = P(x, y), top = py - h, wave = S.still ? 0 : Math.sin(t * 3 + x) * 1.2;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, top - 2); ctx.stroke();
  const fw = 15, fh = 10, q: [number, number][] = [[px, top], [px + fw, top + wave], [px + fw, top + fh + wave], [px, top + fh]];
  if (kind === "pk") {
    poly([[px, top], [px + fw * 0.25, top + wave * 0.25], [px + fw * 0.25, top + fh + wave * 0.25], [px, top + fh]], "#ffffff", false);
    poly([[px + fw * 0.25, top + wave * 0.25], [px + fw, top + wave], [px + fw, top + fh + wave], [px + fw * 0.25, top + fh + wave * 0.25]], "#01411c", false);
    const cx = px + fw * 0.62, cy = top + fh / 2 + wave * 0.6;
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#01411c"; ctx.beginPath(); ctx.arc(cx + 1.1, cy - 0.6, 2.5, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx + 2.4, cy - 1.4, 0.9, 0, 6.283); ctx.fill();
  } else if (kind === "ch") {
    // square, red, a white cross
    const sq: [number, number][] = [[px, top], [px + fh, top + wave * 0.7], [px + fh, top + fh + wave * 0.7], [px, top + fh]];
    poly(sq, "#d52b1e", false);
    const cx = px + fh / 2, cy = top + fh / 2 + wave * 0.35;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(cx - 1.1, cy - 3.4, 2.2, 6.8); ctx.fillRect(cx - 3.4, cy - 1.1, 6.8, 2.2);
    poly(sq, undefined);
    return;
  } else poly(q, "#5b92e5", false);
  poly(q, undefined);
}
/** What quests earned the home: a flower bed, ivy, a flag, a statue, a lantern (TownHouse.badges bits). */
function trimmings(o: Obj, h: number, roofC: string, t: number) {
  const b = o.h!.badges ?? 0;
  if (!b) return;
  const night = S.o!.dark, { x, y, w, d } = o, p = S.pal, front = o.face !== "x";
  if (b & 1) {
    const bx = front ? x + 0.05 : x + w + 0.12, by = front ? y + d + 0.12 : y + 0.05;
    poly(flat(bx, by, front ? 0.55 : 0.3, front ? 0.3 : 0.55), night ? "#3a3a34" : "#e7dcc8");
    ["#f472b6", "#fbbf24", "#f87171", "#a78bfa"].forEach((c, i) => { const [fx, fy] = P(bx + (front ? 0.08 + i * 0.13 : 0.15), by + (front ? 0.15 : 0.08 + i * 0.13)); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(fx, fy - 3, 1.3, 0, 6.283); ctx.fill(); });
  }
  if (b & 2) {
    ctx.fillStyle = night ? "rgba(70,110,80,.85)" : "rgba(110,160,110,.9)";
    for (let i = 0; i < 9; i++) { const u = 0.06 + ((i * 0.37) % 1) * 0.5, z = 1 + ((i * 0.61) % 1) * (h - 3); const [ix, iy] = front ? P(x + u * w, y + d, z) : P(x + w, y + u * d, z); ctx.beginPath(); ctx.arc(ix, iy, 1.6, 0, 6.283); ctx.fill(); }
  }
  if (b & 4) {
    const [fx, fy] = P(x + w * 0.5, y + d * 0.5, h + 6 + Math.min(w, d) * 5), wave = S.still ? 0 : Math.sin(t * 3 + o.s) * 1.2;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 12); ctx.stroke();
    poly([[fx, fy - 12], [fx + 7, fy - 10 + wave], [fx, fy - 7]], roofC);
  }
  if (b & 8) {
    const sx = front ? x + w + 0.12 : x - 0.42, sy = front ? y + d - 0.4 : y + d + 0.12;
    box(sx, sy, 0.3, 0.3, 3, p.wall, p.wallR, p.wall);
    const [px, py] = P(sx + 0.15, sy + 0.15, 3), bronze = night ? "#7c9a8e" : "#8fb9a8";
    poly([[px - 1.5, py], [px + 1.5, py], [px + 1, py - 5], [px - 1, py - 5]], bronze);
    ctx.fillStyle = bronze; ctx.beginPath(); ctx.arc(px, py - 6.5, 1.5, 0, 6.283); ctx.fill(); ctx.stroke();
  }
  if (b & 16) {
    const [lx, ly] = front ? P(x + w / 2 + 0.35, y + d + 0.2) : P(x + w + 0.2, y + d / 2 + 0.35);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly - 9); ctx.stroke();
    if (night) { const g = ctx.createRadialGradient(lx, ly - 10, 0, lx, ly - 10, 12); g.addColorStop(0, "rgba(255,210,130,.45)"); g.addColorStop(1, "rgba(255,210,130,0)"); ctx.fillStyle = g; ctx.fillRect(lx - 12, ly - 22, 24, 24); }
    ctx.fillStyle = night ? p.lit : "#f3dea0"; ctx.beginPath(); ctx.arc(lx, ly - 10, 1.8, 0, 6.283); ctx.fill(); ctx.stroke();
  }
}
/** A pennant and "You" above your house. */
function mineMark(o: Obj, top: number, t: number) {
  const [px, py] = P(o.x + o.w / 2, o.y + o.d / 2, top + 4), bob = S.still ? 0 : Math.sin(t * 2) * 1.5;
  ctx.beginPath(); ctx.moveTo(px, py + 6); ctx.lineTo(px, py - 10 + bob); ctx.stroke();
  poly([[px, py - 10 + bob], [px + 9, py - 7 + bob], [px, py - 4 + bob]], acc());
  label("You", px, py - 16 + bob, acc());
}
function label(text: string, x: number, y: number, color: string) {
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  const tw = ctx.measureText(text).width;
  ctx.save(); ctx.lineWidth = line;
  ctx.fillStyle = S.o!.dark ? "rgba(20,24,34,.88)" : "rgba(255,255,255,.94)";
  ctx.beginPath(); ctx.roundRect(x - tw / 2 - 5, y - 9, tw + 10, 14, 7); ctx.fill(); ctx.strokeStyle = color; ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(text, x, y + 1.5); ctx.restore();
}
/** A tree: a shadow, a trunk, and a canopy lit from the upper left (a lighter cap, a darker belly). */
function drawTree(o: Obj) {
  const p = S.pal, [bx, by] = P(o.x + o.w / 2, o.y + o.d / 2), r = rng(o.s), sc = 0.8 + r() * 0.45, winter = S.sea.name === "winter";
  const leaf = p.leaf[Math.floor(r() * p.leaf.length)], dark = shade(toHex(leaf), 0.14), light = shade(toHex(leaf), -0.12);
  ctx.fillStyle = "rgba(0,0,0,.07)"; ctx.beginPath(); ctx.ellipse(bx + 2, by, 7 * sc, 3.2 * sc, 0, 0, 6.283); ctx.fill();
  const trunk = (hgt: number) => { ctx.save(); ctx.strokeStyle = p.trunk; ctx.lineWidth = line * 1.6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - hgt); ctx.stroke(); ctx.restore(); };
  /** An ellipse canopy with its shading, outlined once. */
  const canopy = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.283); ctx.fillStyle = leaf; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(cx + rx * 0.45, cy + ry * 0.55, rx * 0.95, ry * 0.75, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(cx - rx * 0.35, cy - ry * 0.45, rx * 0.45, ry * 0.35, 0, 0, 6.283); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.283); ctx.stroke();
  };
  if (o.k === "pine") {
    // three tiers, the right half of each in shade, snow on the tips in winter
    const hgt = 24 * sc, wd = 7.5 * sc, pine = toHex(p.pine), pd = shade(pine, 0.16);
    trunk(4);
    for (let i = 0; i < 3; i++) {
      const base = by - 4 - i * hgt * 0.22, apex = base - hgt * (0.5 - i * 0.04), half = wd * (1 - i * 0.24);
      poly([[bx - half, base], [bx, base + 1.5], [bx, apex]], pine, false);
      poly([[bx, base + 1.5], [bx + half, base], [bx, apex]], pd, false);
      poly([[bx - half, base], [bx, base + 1.5], [bx + half, base], [bx, apex]], undefined);
      if (winter) poly([[bx - half * 0.35, apex + (base - apex) * 0.35], [bx + half * 0.35, apex + (base - apex) * 0.35], [bx, apex]], S.o!.dark ? "#cfd8e6" : "#ffffff");
    }
  } else if (o.k === "poplar") {
    trunk(5); canopy(bx, by - 5 - 11 * sc, 4.2 * sc, 11 * sc);
  } else if (o.k === "bush") {
    canopy(bx - 3 * sc, by - 3 * sc, 4 * sc, 3.2 * sc); canopy(bx + 2.5 * sc, by - 3.5 * sc, 4.4 * sc, 3.6 * sc);
  } else {
    const rad = 6.5 * sc;
    trunk(6 * sc); canopy(bx, by - 6 * sc - rad, rad * 1.02, rad * 1.1);
    if (S.sea.name === "spring" && r() < 0.6) { ctx.fillStyle = "#fff4f7"; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(bx + (r() - 0.5) * rad, by - 6 * sc - rad + (r() - 0.5) * rad, 1, 0, 6.283); ctx.fill(); } }
    if (winter && r() < 0.5) { ctx.fillStyle = S.o!.dark ? "rgba(210,220,235,.8)" : "#ffffff"; ctx.beginPath(); ctx.ellipse(bx - rad * 0.2, by - 6 * sc - rad * 1.75, rad * 0.55, rad * 0.22, 0, 0, 6.283); ctx.fill(); }
  }
}
function drawPerson(x: number, y: number, c: string, t: number, walking: boolean, sc = 1, hop = 0) {
  if (sc !== 1 || hop) { const [px, py] = P(x, y); ctx.save(); ctx.translate(px, py - hop); ctx.scale(sc, sc); ctx.translate(-px, -py); drawPerson(x, y, c, t, walking); ctx.restore(); return; }
  const [px, py] = P(x, y), step = walking && !S.still ? Math.sin(t * 9 + x * 3) * 1.2 : 0;
  ctx.fillStyle = "rgba(0,0,0,.1)"; ctx.beginPath(); ctx.ellipse(px, py, 2.6, 1.3, 0, 0, 6.283); ctx.fill();
  ctx.save(); ctx.lineWidth = line;
  ctx.beginPath(); ctx.moveTo(px - 0.8 + step * 0.4, py); ctx.lineTo(px, py - 3.5); ctx.lineTo(px + 0.8 - step * 0.4, py); ctx.stroke();
  poly([[px - 1.8, py - 3], [px + 1.8, py - 3], [px + 1.3, py - 7.5], [px - 1.3, py - 7.5]], c);
  ctx.beginPath(); ctx.arc(px, py - 9.4, 1.8, 0, 6.283); ctx.fillStyle = S.o!.dark ? "#d8cbb8" : "#f1dcc6"; ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawObj(o: Obj, t: number) {
  const p = S.pal, night = S.o!.dark, data = S.data!;
  switch (o.k) {
    case "house": return drawHouse(o, t);
    case "tree": case "pine": case "poplar": case "bush": return drawTree(o);
    case "rock": { const [cx, cy] = P(o.x + 0.25, o.y + 0.2); poly([[cx - 6, cy], [cx - 4, cy - 5], [cx + 2, cy - 7], [cx + 6, cy - 2], [cx + 5, cy + 1]], night ? "#566075" : "#cfd3da"); return; }
    case "garden": {
      poly(flat(o.x, o.y, o.w, o.d), night ? "#3a3a34" : "#e7dcc8");
      ctx.save(); ctx.strokeStyle = night ? "#5e5a4c" : "#c9b89a";
      for (let i = 1; i < 4; i++) { const a = P(o.x + (o.w * i) / 4, o.y + 0.08), b = P(o.x + (o.w * i) / 4, o.y + o.d - 0.08); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      ctx.restore(); return;
    }
    case "plot": {
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = acc(); ctx.lineWidth = line * 1.4;
      poly(flat(o.x, o.y, o.w, o.d), rgba(S.accent, 0.08)); ctx.restore();
      const [cx, cy] = P(o.x + o.w / 2, o.y + o.d / 2, 6); label("You", cx, cy, acc());
      return hit(flat(o.x, o.y, o.w, o.d), o.tg);
    }
    case "hall": {
      const { x, y, w, d } = o, h = 30;
      box(x, y, w, d, h, p.wall, p.wallR, shade(p.wall, 0.03));
      ctx.save(); ctx.strokeStyle = acc(); ctx.lineWidth = line * 1.6;
      ctx.beginPath(); const a = P(x, y + d, h - 3), b = P(x + w, y + d, h - 3), c = P(x + w, y, h - 3); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); ctx.restore();
      for (const f of ["y", "x"] as const) {
        for (let i = 0; i < 4; i++) { const u = 0.5 + i; if (i === 1 || i === 2) { onFace(f, x, y, w, d, u - 0.15, u + 0.15, 13, 19, night ? p.lit : p.win); continue; } onFace(f, x, y, w, d, u - 0.12, u + 0.12, 5, 10, night ? p.lit : p.win); onFace(f, x, y, w, d, u - 0.12, u + 0.12, 15, 20, night ? p.lit : p.win); }
        onFace(f, x, y, w, d, 1.55, 2.45, 0, 7, shade(toHex(acc()), 0.1));
      }
      for (const [u, v] of [[1, 1], [2.6, 1], [1, 2.6], [2.6, 2.6]]) poly(flat(x + u - 0.3, y + v - 0.3, 0.6, 0.6, h), p.roofs[3]);
      // the flag, in the accent
      const [fx, fy] = P(x + w - 0.6, y + 0.6, h), wave = S.still ? 0 : Math.sin(t * 3) * 1.5;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 22); ctx.stroke();
      poly([[fx, fy - 22], [fx + 11, fy - 19 + wave], [fx, fy - 15]], acc());
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), P(x, y, h + 22)], o.tg);
    }
    case "fountain": {
      const cx = o.x + o.w / 2, cy = o.y + o.d / 2, [sx, sy] = P(cx, cy), frozen = data.off.includes("rain") || S.sea.name === "winter";
      const wat = frozen ? (night ? "#4a5a6e" : "#e4eef3") : p.water;
      ctx.beginPath(); ctx.ellipse(sx, sy + 2, 24, 12, 0, 0, 6.283); ctx.fillStyle = p.wallR; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(sx, sy, 24, 12, 0, 0, 6.283); ctx.fillStyle = p.wall; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(sx, sy, 19, 9.5, 0, 0, 6.283); ctx.fillStyle = wat; ctx.fill();
      box(cx - 0.12, cy - 0.12, 0.24, 0.24, 9, p.wall, p.wallR, p.wall);
      // the jets run on a day it rained
      if (!frozen && data.rains24h > 0 && !S.still) {
        ctx.save(); ctx.strokeStyle = night ? "rgba(170,210,240,.8)" : "rgba(110,170,210,.8)";
        for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + t * 0.4, r = 11 + Math.sin(t * 3 + i) * 1.5; ctx.beginPath(); ctx.moveTo(sx, sy - 10); ctx.quadraticCurveTo(sx + Math.cos(a) * r * 0.6, sy - 18, sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.5); ctx.stroke(); }
        ctx.restore();
      }
      return hit([[sx - 24, sy - 18], [sx + 24, sy + 14]], o.tg);
    }
    case "stall": {
      const ch = chan(o.ch!.name), { x, y, w, d } = o, [c1, c2] = skyColours(ch.name), col = `rgb(${c1.map((v) => v | 0).join(",")})`, col2 = `rgb(${mix(c1, [255, 255, 255], 0.55).map((v) => v | 0).join(",")})`;
      box(x, y, w, d, 6, p.wall, p.wallR, shade(p.wall, 0.05));
      // a striped canopy on four corner posts
      for (const [u, v] of [[0.05, d + 0.05], [w + 0.05, d + 0.05], [w + 0.05, 0.05]]) { const a = P(x + u, y + v, 6), b = P(x + u, y + v, 10); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      const ap = (u: number) => P(x + u, y + d / 2, 15);
      for (let i = 0; i < 4; i++) { const u0 = -0.08 + ((w + 0.16) * i) / 4, u1 = -0.08 + ((w + 0.16) * (i + 1)) / 4; poly([P(x + u0, y - 0.08, 10), P(x + u1, y - 0.08, 10), ap(u1), ap(u0)], shade(toHex(i % 2 ? col2 : col), 0.12)); }
      for (let i = 0; i < 4; i++) { const u0 = -0.08 + ((w + 0.16) * i) / 4, u1 = -0.08 + ((w + 0.16) * (i + 1)) / 4; poly([P(x + u0, y + d + 0.08, 10), P(x + u1, y + d + 0.08, 10), ap(u1), ap(u0)], i % 2 ? col2 : col); }
      poly([P(x + w + 0.08, y - 0.08, 10), P(x + w + 0.08, y + d + 0.08, 10), ap(w + 0.08)], col2);
      if (ch.online > 0) { const [gx, gy] = P(x + w / 2, y + d / 2, 4); const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 18); g.addColorStop(0, rgba(c2, night ? 0.35 : 0.18)); g.addColorStop(1, rgba(c2, 0)); ctx.fillStyle = g; ctx.fillRect(gx - 18, gy - 18, 36, 36); }
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), P(x + w / 2, y + d / 2, 15)], o.tg && (ch === o.ch ? o.tg : (o.tg = { kind: "stall", channel: (o.ch = ch) })));
    }
    case "gazebo": {
      const { x, y, w, d } = o, cx = x + w / 2, cy = y + d / 2;
      poly(flat(x, y, w, d), p.wallR); poly(flat(x, y, w, d, 2), p.wall);
      for (const [u, v] of [[0.15, 0.15], [w - 0.15, 0.15], [0.15, d - 0.15], [w - 0.15, d - 0.15]]) { const a = P(x + u, y + v, 2), b = P(x + u, y + v, 18); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      const ap = P(cx, cy, 30), roof = p.roofs[4];
      poly([P(x - 0.1, y - 0.1, 18), P(x + w + 0.1, y - 0.1, 18), ap], shade(toHex(roof), 0.12)); poly([P(x - 0.1, y - 0.1, 18), P(x - 0.1, y + d + 0.1, 18), ap], shade(toHex(roof), 0.12));
      poly([P(x + w + 0.1, y - 0.1, 18), P(x + w + 0.1, y + d + 0.1, 18), ap], shade(toHex(roof), 0.05)); poly([P(x - 0.1, y + d + 0.1, 18), P(x + w + 0.1, y + d + 0.1, 18), ap], roof);
      if (!data.off.includes("board")) {
        // the notice board, a paper for each live post
        const bx = x + 0.5, by = y + d + 0.45, bw = w - 1;
        for (const u of [0.1, bw - 0.1]) { const a = P(bx + u, by, 0), b = P(bx + u, by, 14); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        poly([P(bx, by, 6), P(bx + bw, by, 6), P(bx + bw, by, 14), P(bx, by, 14)], night ? "#5a4a3a" : "#d9b98e");
        data.postTopics.slice(0, 12).forEach((tp, i) => { const u = bx + 0.12 + (i % 6) * ((bw - 0.24) / 6), z = i < 6 ? 10.4 : 6.8; const c = skyColours(tp)[0]; poly([P(u, by, z), P(u + 0.22, by, z), P(u + 0.22, by, z + 3), P(u, by, z + 3)], `rgb(${mix(c, [255, 255, 255], 0.45).map((v) => v | 0).join(",")})`, false); });
      }
      return hit([P(x, y, 0), P(x + w, y + d + 0.6, 0), P(x, y + d + 0.6, 0), P(x + w, y, 0), ap], o.tg);
    }
    case "market": {
      const { x, y, w, d } = o, h = 16;
      box(x, y, w, d, h, p.wall, p.wallR);
      for (let i = 0; i < 5; i++) onFace("y", x, y, w, d, 0.3 + i * 0.95, 0.85 + i * 0.95, 0, 9, i % 2 ? shade(p.wall, 0.15) : (night ? p.lit : p.win));
      const r1 = "#f5c542", r2 = night ? "#6a5c3a" : "#fff3cf";
      for (let i = 0; i < 8; i++) poly([P(x + (w * i) / 8, y + d + 0.5, 9), P(x + (w * (i + 1)) / 8, y + d + 0.5, 9), P(x + (w * (i + 1)) / 8, y + d, 13), P(x + (w * i) / 8, y + d, 13)], i % 2 ? r2 : r1);
      poly([P(x, y, h), P(x + w, y, h), P(x + w, y + d / 2, h + 9), P(x, y + d / 2, h + 9)], shade("#e8a77c", 0.12));
      poly([P(x, y + d, h), P(x + w, y + d, h), P(x + w, y + d / 2, h + 9), P(x, y + d / 2, h + 9)], "#e8a77c");
      poly([P(x + w, y, h), P(x + w, y + d, h), P(x + w, y + d / 2, h + 9)], p.wallR);
      return hit([P(x, y, 0), P(x + w, y + d + 0.5, 0), P(x, y + d + 0.5, 0), P(x + w, y, 0), P(x, y + d / 2, h + 9)], o.tg);
    }
    case "crate": return box(o.x, o.y, o.w, o.d, 5, "#d9b98e", "#c4a275", "#e6c9a0");
    case "factory": {
      // the notebook works: a sawtooth roof with its glazing toward us, two stacks that smoke when notebooks are made
      const { x, y, w, d } = o, h = 16, brick = night ? "#6e5a52" : "#efdccb", glass = night ? p.lit : "#cfe3f1";
      box(x, y, w, d, h, brick, shade(toHex(brick), 0.1));
      for (let i = 0; i < 5; i++) onFace("y", x, y, w, d, 0.25 + i * 0.85, 0.65 + i * 0.85, 6, 12, night ? p.lit : p.win);
      onFace("y", x, y, w, d, w - 1.3, w - 0.4, 0, 9, shade(toHex(brick), 0.3));
      for (let i = 0; i < 3; i++) {
        const u0 = x + (w * i) / 3, u1 = x + (w * (i + 1)) / 3;
        poly([P(u0, y, h), P(u1, y, h + 9), P(u1, y + d, h + 9), P(u0, y + d, h)], night ? "#4a4e5e" : "#c9ced8");
        poly([P(u0, y + d, h), P(u1, y + d, h), P(u1, y + d, h + 9)], brick);
        poly([P(u1, y, h), P(u1, y + d, h), P(u1, y + d, h + 9), P(u1, y, h + 9)], glass);
      }
      const stacks: [number, number][] = [[x + 0.35, y + 0.3], [x + 1.2, y + 0.3]];
      for (const [sx, sy] of stacks) { box(sx, sy, 0.42, 0.42, 46, "#f2f2f0", "#dcdcd8", "#c9c9c4"); box(sx, sy, 0.42, 0.42, 5, "#e07a6a", "#c96456", undefined, 38); }
      if (!S.still) {
        const busy = data.spawned24h > 0, puffs = busy ? 6 : 2;
        for (const [sx, sy] of stacks) {
          const [cx, cy] = P(sx + 0.21, sy + 0.21, 48);
          for (let i = 0; i < puffs; i++) {
            const u = (((t * (busy ? 0.22 : 0.1) + i / puffs + sx) % 1) + 1) % 1;
            ctx.fillStyle = night ? `rgba(190,198,215,${0.42 * (1 - u)})` : `rgba(160,166,178,${0.4 * (1 - u)})`;
            ctx.beginPath(); ctx.arc(cx + u * 26 + Math.sin(u * 5 + i) * 3, cy - u * 34, 2.5 + u * (busy ? 7 : 4), 0, 6.283); ctx.fill();
          }
        }
      }
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), P(x + 0.35, y + 0.3, 50)], o.tg);
    }
    case "school": {
      // a schoolhouse: a hip roof, a bell tower, a clock; this week's newcomers play in the yard
      const { x, y, w, d } = o, h = 15, rh = 9, cream = night ? "#585e6a" : "#fbf2dc", roof = night ? "#8a5a4e" : "#e39a7a";
      box(x, y, w, d, h, cream, shade(toHex(cream), 0.08));
      for (let i = 0; i < 4; i++) if (i !== 2) onFace("y", x, y, w, d, 0.3 + i * 0.9, 0.75 + i * 0.9, 5, 11, night ? p.lit : p.win);
      onFace("y", x, y, w, d, 2.1, 2.5, 0, 8, shade(toHex(roof), 0.25));
      for (let i = 0; i < 2; i++) onFace("x", x, y, w, d, 0.4 + i * 0.8, 0.75 + i * 0.8, 5, 11, night ? p.lit : p.win);
      const r0 = P(x + 0.7, y + d / 2, h + rh), r1 = P(x + w - 0.7, y + d / 2, h + rh);
      poly([P(x, y, h), P(x + w, y, h), r1, r0], shade(toHex(roof), 0.12)); poly([P(x, y, h), P(x, y + d, h), r0], shade(toHex(roof), 0.12));
      poly([P(x + w, y, h), P(x + w, y + d, h), r1], shade(toHex(roof), 0.05)); poly([P(x, y + d, h), P(x + w, y + d, h), r1, r0], roof);
      const bx = x + w / 2 - 0.3, by = y + d / 2 - 0.3;
      box(bx, by, 0.6, 0.6, 9, cream, shade(toHex(cream), 0.08), undefined, h + rh - 3);
      const ap = P(bx + 0.3, by + 0.3, h + rh + 13);
      poly([P(bx, by + 0.6, h + rh + 6), P(bx + 0.6, by + 0.6, h + rh + 6), ap], roof); poly([P(bx + 0.6, by, h + rh + 6), P(bx + 0.6, by + 0.6, h + rh + 6), ap], shade(toHex(roof), 0.08));
      const [kx, ky] = P(bx + 0.3, by + 0.6, h + rh + 2.5); ctx.fillStyle = "#e0a92e"; ctx.beginPath(); ctx.arc(kx, ky, 1.8, 0, 6.283); ctx.fill(); ctx.stroke();
      const [cx, cy] = P(x + w / 2, y + d, h - 3.5); ctx.beginPath(); ctx.ellipse(cx, cy, 3.2, 2.6, 0, 0, 6.283); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 1.8); ctx.moveTo(cx, cy); ctx.lineTo(cx + 1.4, cy + 0.6); ctx.stroke();
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), ap], o.tg);
    }
    case "chapel": {
      // the chapel: a nave, a rose window, a steeple whose bell swings while a fundraiser is open
      const { x, y, w, d } = o, h = 13, rh = 10, stone = night ? "#5a6070" : "#f4f1ea", slate = night ? "#3c4252" : "#9aa3b5";
      box(x, y, w, d, h, stone, shade(toHex(stone), 0.08));
      for (let i = 0; i < 3; i++) onFace("x", x, y, w, d, 0.5 + i * 1.1, 0.8 + i * 1.1, 4, 10, night ? p.lit : "#c9d5ea");
      poly([P(x, y, h), P(x, y + d, h), P(x + w / 2, y + d, h + rh), P(x + w / 2, y, h + rh)], shade(toHex(slate), 0.1));
      poly([P(x + w, y, h), P(x + w, y + d, h), P(x + w / 2, y + d, h + rh), P(x + w / 2, y, h + rh)], slate);
      poly([P(x, y + d, h), P(x + w, y + d, h), P(x + w / 2, y + d, h + rh)], stone);
      // the rose window: stained glass in the channels' colours, glowing at night
      const [rx, ry] = P(x + w / 2, y + d, h + 3);
      const cols = ["general", "help", "study", "crypto", "creators", "careers"].map((c) => skyColours(c)[0]);
      cols.forEach((c, i) => { ctx.beginPath(); ctx.moveTo(rx, ry); ctx.ellipse(rx, ry, 4.4, 3.6, 0, (i / 6) * 6.283, ((i + 1) / 6) * 6.283); ctx.closePath(); ctx.fillStyle = rgba(c, night ? 0.95 : 0.75); ctx.fill(); });
      ctx.beginPath(); ctx.ellipse(rx, ry, 4.4, 3.6, 0, 0, 6.283); ctx.stroke();
      if (night) { const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, 20); g.addColorStop(0, "rgba(255,220,160,.25)"); g.addColorStop(1, "rgba(255,220,160,0)"); ctx.fillStyle = g; ctx.fillRect(rx - 20, ry - 20, 40, 40); }
      // the steeple in front
      const tx = x + w / 2 - 0.45, ty = y + d, tw = 0.9, th = 24;
      box(tx, ty, tw, tw, th, stone, shade(toHex(stone), 0.08));
      onFace("y", tx, ty, tw, tw, 0.3, 0.6, 0, 6, shade(toHex(slate), 0.3));
      onFace("y", tx, ty, tw, tw, 0.22, 0.68, 15, 21, night ? "#20263a" : "#56607a");
      const swing = !S.still && data.fundraisersOpen > 0 && !data.off.includes("fundraisers") ? Math.sin(t * 3) * 1.6 : 0;
      const [bx2, by2] = P(tx + tw / 2, ty + tw, 17.5); ctx.fillStyle = "#e0a92e"; ctx.beginPath(); ctx.arc(bx2 + swing, by2, 2, 0, 6.283); ctx.fill(); ctx.stroke();
      const sp = P(tx + tw / 2, ty + tw / 2, th + 20);
      poly([P(tx, ty + tw, th), P(tx + tw, ty + tw, th), sp], slate); poly([P(tx + tw, ty, th), P(tx + tw, ty + tw, th), sp], shade(toHex(slate), 0.1));
      ctx.beginPath(); ctx.moveTo(sp[0], sp[1]); ctx.lineTo(sp[0], sp[1] - 7); ctx.moveTo(sp[0] - 2.5, sp[1] - 4.5); ctx.lineTo(sp[0] + 2.5, sp[1] - 4.5); ctx.stroke();
      return hit([P(x, y, 0), P(x + w, y + d + 1, 0), P(x, y + d + 1, 0), P(x + w, y, 0), [sp[0], sp[1] - 7]], o.tg);
    }
    case "tower": {
      // the water tower: the cycles every notebook holds. Splayed legs with cross braces, a ladder to a
      // railed catwalk, a shaded tank with seams and an accent band, a sight glass whose level is the
      // days the cycles last at today's burn (a year fills it), and the burn dripping from the riser.
      const { x, y, w, d } = o, cx = x + w / 2, cy = y + d / 2, [sx, sy] = P(cx, cy);
      const z0 = 34, z1 = 54, yb = sy - z0, yt = sy - z1, rx = 19, ry = 9.5;
      const days = data.burnPerDay > 0 ? data.cycles / data.burnPerDay : data.cycles > 0 ? 365 : 0, level = Math.max(0.03, Math.min(1, days / 365));
      const steel = night ? "#7d8aa6" : "#9aa6bd", tankL = night ? "#69758f" : "#f4f6fa", tankR = night ? "#4a546b" : "#c9d0dc";
      // legs and braces
      const feet: [number, number][] = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
      const top = (u: number, v: number): [number, number] => P(cx + (u - cx) * 0.42, cy + (v - cy) * 0.42, z0);
      const at = (u: number, v: number, f: number): [number, number] => { const a = P(u, v), b = top(u, v); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
      ctx.save(); ctx.strokeStyle = steel; ctx.lineWidth = line * 1.5;
      ctx.beginPath(); for (const [u, v] of feet) { const a = P(u, v), b = top(u, v); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
      ctx.lineWidth = line * 0.8; ctx.beginPath();
      for (const [i, j] of [[3, 2], [1, 2]]) for (const [f0, f1] of [[0.08, 0.5], [0.5, 0.92]]) {
        const [a, b] = [feet[i], feet[j]], p0 = at(a[0], a[1], f0), p1 = at(b[0], b[1], f1), q0 = at(b[0], b[1], f0), q1 = at(a[0], a[1], f1);
        ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]);
        const m0 = at(a[0], a[1], f1), m1 = at(b[0], b[1], f1); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]);
      }
      ctx.stroke();
      // the riser down the middle, and the ladder up the front leg
      ctx.lineWidth = line * 2.4; ctx.beginPath(); ctx.moveTo(sx, sy - 2); ctx.lineTo(sx, yb + ry); ctx.stroke();
      const l0 = P(x + w * 0.62, y + d), l1 = top(x + w * 0.62, y + d);
      ctx.lineWidth = line * 0.8; ctx.beginPath();
      for (const off of [-1.6, 1.6]) { ctx.moveTo(l0[0] + off, l0[1]); ctx.lineTo(l1[0] + off, l1[1] + 4); }
      for (let f = 0.06; f < 1; f += 0.09) { const px = l0[0] + (l1[0] - l0[0]) * f, py = l0[1] + (l1[1] + 4 - l0[1]) * f; ctx.moveTo(px - 1.6, py); ctx.lineTo(px + 1.6, py); }
      ctx.stroke(); ctx.restore();
      // the catwalk's floor behind the tank
      ctx.beginPath(); ctx.ellipse(sx, yb + 1, rx + 6, ry + 3, 0, Math.PI, 0); ctx.fillStyle = steel; ctx.fill(); ctx.stroke();
      // the tank
      const body = () => { ctx.beginPath(); ctx.moveTo(sx - rx, yt); ctx.lineTo(sx - rx, yb); ctx.ellipse(sx, yb, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(sx + rx, yt); ctx.closePath(); };
      const g = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0); g.addColorStop(0, tankL); g.addColorStop(0.55, tankL); g.addColorStop(1, tankR);
      body(); ctx.fillStyle = g; ctx.fill();
      ctx.save(); body(); ctx.clip();
      // the accent band, and the seams between the plates
      const bandA = yb - 7, bandB = yb - 11;
      ctx.beginPath(); ctx.ellipse(sx, bandA, rx, ry, 0, 0, Math.PI); ctx.lineTo(sx - rx, bandB); ctx.ellipse(sx, bandB, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fillStyle = rgba(S.accent, 0.85); ctx.fill();
      ctx.strokeStyle = night ? "rgba(255,255,255,.12)" : "rgba(40,50,70,.12)"; ctx.lineWidth = line * 0.8; ctx.beginPath();
      for (const a of [-1.1, -0.55, 0, 0.55, 1.1]) { const px = sx + Math.sin(a) * rx, py = Math.cos(a) * ry; ctx.moveTo(px, yt + py); ctx.lineTo(px, yb + py); }
      ctx.stroke(); ctx.restore();
      body(); ctx.stroke();
      // the sight glass: the level, at a glance
      const gx = sx - rx * 0.42, gTop = yt + 4, gBot = yb + ry * 0.6, gl = gBot - (gBot - gTop) * level;
      ctx.beginPath(); ctx.roundRect(gx - 2.6, gTop - 1, 5.2, gBot - gTop + 2, 2.6); ctx.fillStyle = night ? "#1d2333" : "#ffffff"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(gx - 1.6, gl, 3.2, gBot - gl, 1.6); ctx.fillStyle = night ? "#5fb0ee" : "#3f9ad8"; ctx.fill();
      if (night) { const gg = ctx.createRadialGradient(gx, gl, 0, gx, gl, 10); gg.addColorStop(0, "rgba(95,176,238,.45)"); gg.addColorStop(1, "rgba(95,176,238,0)"); ctx.fillStyle = gg; ctx.fillRect(gx - 10, gl - 10, 20, 20); }
      ctx.save(); ctx.lineWidth = line * 0.7; ctx.beginPath(); for (let i = 1; i < 4; i++) { const yy = gBot - ((gBot - gTop) * i) / 4; ctx.moveTo(gx + 2.6, yy); ctx.lineTo(gx + 4.6, yy); } ctx.stroke(); ctx.restore();
      // the catwalk's railing in front
      ctx.save(); ctx.strokeStyle = steel; ctx.lineWidth = line;
      ctx.beginPath(); ctx.ellipse(sx, yb + 1, rx + 6, ry + 3, 0, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(sx, yb - 5, rx + 6, ry + 3, 0, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI, px = sx + Math.cos(a) * (rx + 6), py = Math.sin(a) * (ry + 3); ctx.moveTo(px, yb + 1 + py); ctx.lineTo(px, yb - 5 + py); } ctx.stroke(); ctx.restore();
      // the roof: a cone, a finial, a light for aircraft at night
      ctx.beginPath(); ctx.ellipse(sx, yt, rx, ry, 0, 0, 6.283); ctx.fillStyle = tankR; ctx.fill(); ctx.stroke();
      const rg = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0); rg.addColorStop(0, toHex(p.roofs[2])); rg.addColorStop(1, shade(toHex(p.roofs[2]), 0.18));
      ctx.beginPath(); ctx.moveTo(sx - rx - 2, yt); ctx.lineTo(sx, yt - 15); ctx.lineTo(sx + rx + 2, yt); ctx.ellipse(sx, yt, rx + 2, ry + 1, 0, 0, Math.PI); ctx.closePath(); ctx.fillStyle = rg; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, yt - 15); ctx.lineTo(sx, yt - 20); ctx.stroke();
      const on = !night || S.still || Math.sin(t * 2) > 0;
      ctx.fillStyle = night ? (on ? "#f0504a" : "#5a2a28") : steel; ctx.beginPath(); ctx.arc(sx, yt - 21, 1.8, 0, 6.283); ctx.fill(); ctx.stroke();
      // what the notebooks burn a day drips from the riser, faster when they burn more
      if (!S.still && data.burnPerDay > 0) {
        const rate = Math.min(3, 0.6 + Math.log10(1 + data.burnPerDay / 1e9) * 0.6);
        for (let i = 0; i < 3; i++) { const u = (t * rate + i / 3) % 1; ctx.fillStyle = night ? "rgba(140,190,235,.85)" : "rgba(63,154,216,.8)"; ctx.beginPath(); ctx.ellipse(sx + 2.5, sy - 6 + u * 6, 1.1, 1.6, 0, 0, 6.283); ctx.fill(); }
      }
      ctx.beginPath(); ctx.ellipse(sx + 2.5, sy, 4, 2, 0, 0, 6.283); ctx.fillStyle = p.water; ctx.fill(); ctx.stroke();
      return hit([[sx - rx - 7, yt - 22], [sx + rx + 7, sy + 4]], o.tg);
    }
    case "station": {
      // the station house: brick, a clock tower in the middle, tall arched windows onto the platform
      const { x, y, w, d } = o, h = 13, brick = night ? "#6e5248" : "#e7c9b4", roof = night ? "#3c4252" : "#7d8597";
      box(x, y, w, d, h, brick, shade(toHex(brick), 0.1));
      for (let i = 0; i < 6; i++) { if (i === 2 || i === 3) continue; onFace("y", x, y, w, d, 0.25 + i * 0.66, 0.6 + i * 0.66, 3, 10, night ? p.lit : p.win); }
      onFace("y", x, y, w, d, w / 2 - 0.35, w / 2 + 0.35, 0, 8, shade(toHex(brick), 0.3));
      poly([P(x, y, h), P(x + w, y, h), P(x + w, y + d / 2, h + 6), P(x, y + d / 2, h + 6)], shade(toHex(roof), 0.1));
      poly([P(x, y + d, h), P(x + w, y + d, h), P(x + w, y + d / 2, h + 6), P(x, y + d / 2, h + 6)], roof);
      poly([P(x + w, y, h), P(x + w, y + d, h), P(x + w, y + d / 2, h + 6)], shade(toHex(brick), 0.1));
      const tx = x + w / 2 - 0.4, ty = y + d / 2 - 0.4;
      box(tx, ty, 0.8, 0.8, 12, brick, shade(toHex(brick), 0.1), undefined, h + 2);
      const ap = P(tx + 0.4, ty + 0.4, h + 22); poly([P(tx, ty + 0.8, h + 14), P(tx + 0.8, ty + 0.8, h + 14), ap], roof); poly([P(tx + 0.8, ty, h + 14), P(tx + 0.8, ty + 0.8, h + 14), ap], shade(toHex(roof), 0.1));
      const [cx, cy] = P(tx + 0.4, ty + 0.8, h + 9); ctx.beginPath(); ctx.ellipse(cx, cy, 3.4, 2.8, 0, 0, 6.283); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 2); ctx.moveTo(cx, cy); ctx.lineTo(cx + 1.5, cy + 0.6); ctx.stroke();
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), ap], o.tg);
    }
    case "canopy": {
      // the platform canopy: a flat roof on posts
      const { x, y, w, d } = o, roof = night ? "#3c4252" : "#9aa3b5";
      ctx.beginPath(); for (let i = 0; i <= 4; i++) { const u = x + 0.15 + (i * (w - 0.3)) / 4, a = P(u, y + d * 0.5, 0), b = P(u, y + d * 0.5, 11); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
      box(x, y - 0.1, w, d + 0.2, 1.5, shade(toHex(roof), 0.05), shade(toHex(roof), 0.15), roof, 11);
      return;
    }
    case "fence": {
      // a chain-link fence round the site: posts and two wires, open where the road comes in
      const { x, y, w, d } = o, gate = y + 3.3;
      ctx.save(); ctx.strokeStyle = night ? "#8a93a8" : "#9aa3b5"; ctx.lineWidth = line * 0.9;
      const run = (a: [number, number], b: [number, number]) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 0.7));
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const u = i / n, px = a[0] + (b[0] - a[0]) * u, py = a[1] + (b[1] - a[1]) * u, q0 = P(px, py, 0), q1 = P(px, py, 6); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); }
        for (const z of [2.5, 6]) { const q0 = P(a[0], a[1], z), q1 = P(b[0], b[1], z); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); }
        ctx.stroke();
      };
      run([x, y], [x + w, y]); run([x + w, y], [x + w, y + d]); run([x, y + d], [x + w, y + d]); run([x, y], [x, gate - 0.9]); run([x, gate + 0.9], [x, y + d]);
      ctx.restore();
      return;
    }
    case "buffer": {
      // the end of the line: a buffer stop, striped
      box(o.x, o.y, o.w, o.d, 5, "#f5c542", "#d9a92e", "#2a2d36");
      return;
    }
    case "trestle": {
      // the railway over the river: timber trestle legs under the track
      const { x, y } = o, wood = night ? "#6a5a4a" : "#b9976f";
      ctx.save(); ctx.strokeStyle = wood; ctx.lineWidth = line * 1.6; ctx.beginPath();
      for (const u of [0.2, 0.8]) for (const v of [0.2, 0.8]) { const a = P(x + u, y + v, -6), b = P(x + u, y + v, 2); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke(); ctx.restore();
      box(x, y + 0.1, 1, 0.8, 1.2, wood, shade(toHex(wood), 0.12), shade(toHex(wood), -0.06), 0.8);
      ctx.save(); ctx.strokeStyle = night ? "#9aa3b5" : "#6a7080"; ctx.lineWidth = line * 1.1; ctx.beginPath();
      for (const v of [0.35, 0.65]) { const a = P(x, y + v, 2.2), b = P(x + 1, y + v, 2.2); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke(); ctx.restore();
      return;
    }
    case "news": {
      // the news station: a studio with a big screen, a satellite dish, a lattice mast with a blinking light
      const { x, y, w, d } = o, h = 15, wall = night ? "#4f566a" : "#f3f4f7";
      box(x, y, w, d, h, wall, shade(toHex(wall), 0.08), shade(toHex(wall), 0.04));
      onFace("y", x, y, w, d, 0.2, w - 0.2, 5, 13, "#1d2230");
      // a headline crawling across the screen
      const [s0x, s0y] = P(x + 0.3, y + d, 9), [s1x, s1y] = P(x + w - 0.3, y + d, 9);
      ctx.save(); ctx.beginPath(); const q = [P(x + 0.2, y + d, 5), P(x + w - 0.2, y + d, 5), P(x + w - 0.2, y + d, 13), P(x + 0.2, y + d, 13)]; ctx.moveTo(q[0][0], q[0][1]); q.forEach((pt) => ctx.lineTo(pt[0], pt[1])); ctx.closePath(); ctx.clip();
      const ang = Math.atan2(s1y - s0y, s1x - s0x), len = Math.hypot(s1x - s0x, s1y - s0y), text = "Internet Computer news  ·  follow @dfinity on X  ·  ";
      ctx.translate(s0x, s0y); ctx.rotate(ang); ctx.font = "700 5.5px Inter, system-ui, sans-serif"; ctx.fillStyle = "#29abe2";
      const tw = ctx.measureText(text).width, off = S.still ? 0 : (t * 14) % tw;
      for (let k = -1; k < 3; k++) ctx.fillText(text, k * tw - off, 2);
      ctx.restore();
      onFace("y", x, y, w, d, w - 0.75, w - 0.3, 0, 4, shade(toHex(wall), 0.3));
      for (let i = 0; i < 3; i++) onFace("x", x, y, w, d, 0.3 + i * 0.6, 0.55 + i * 0.6, 6, 11, night ? p.lit : p.win);
      // the dish on the roof
      const [dx, dy] = P(x + w * 0.3, y + d * 0.4, h + 3);
      ctx.beginPath(); ctx.moveTo(dx, dy + 3); ctx.lineTo(dx, dy - 1); ctx.stroke();
      ctx.save(); ctx.translate(dx, dy - 4); ctx.rotate(-0.6); ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, 6.283); ctx.fillStyle = p.wall; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6); ctx.stroke(); ctx.restore();
      // the mast
      const [mx, my] = P(x + w * 0.8, y + d * 0.3, h), top = my - 44;
      ctx.save(); ctx.strokeStyle = night ? "#c96456" : "#d9604c"; ctx.lineWidth = line;
      ctx.beginPath(); ctx.moveTo(mx - 3, my); ctx.lineTo(mx, top); ctx.lineTo(mx + 3, my); for (let z = my; z > top + 4; z -= 6) { const f = (my - z) / (my - top), half = 3 * (1 - f); ctx.moveTo(mx - half, z); ctx.lineTo(mx + half * 0.8, z - 6); } ctx.stroke(); ctx.restore();
      const on = S.still || Math.sin(t * 2.5) > 0; ctx.fillStyle = on ? "#f0504a" : "#5a2a28"; ctx.beginPath(); ctx.arc(mx, top - 1.5, 1.8, 0, 6.283); ctx.fill();
      if (on && night) { const g = ctx.createRadialGradient(mx, top, 0, mx, top, 10); g.addColorStop(0, "rgba(240,80,74,.5)"); g.addColorStop(1, "rgba(240,80,74,0)"); ctx.fillStyle = g; ctx.fillRect(mx - 10, top - 10, 20, 20); }
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), [mx, top - 4]], o.tg);
    }
    case "datacentre": {
      // the Pakistan Subnet: a sovereign data centre, rows of server lights, cooling fans, the flag of Pakistan
      const { x, y, w, d } = o, h = 10, wall = night ? "#4a5164" : "#e9ecf1";
      box(x, y, w, d, h, wall, shade(toHex(wall), 0.08), shade(toHex(wall), 0.03));
      for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) { const u = 0.2 + i * ((w - 0.4) / 9), on = S.still || Math.sin(t * (2 + (i % 3)) + i * 1.3 + r) > -0.3; onFace("y", x, y, w, d, u, u + 0.18, 2.5 + r * 3.5, 4.5 + r * 3.5, on ? "#34d399" : "#14532d", false); }
      for (let i = 0; i < 3; i++) { const [fx, fy] = P(x + 0.6 + i * 1.1, y + d / 2, h + 1.6); box(x + 0.25 + i * 1.1, y + d / 2 - 0.35, 0.7, 0.7, 1.6, shade(toHex(wall), 0.1), shade(toHex(wall), 0.18), shade(toHex(wall), 0.05), h); ctx.beginPath(); ctx.ellipse(fx, fy, 4.2, 2.2, 0, 0, 6.283); ctx.fillStyle = night ? "#2a3040" : "#c9ced8"; ctx.fill(); ctx.stroke(); }
      flag(x + w + 0.25, y + d + 0.15, 30, "pk", t);
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), P(x + w + 0.25, y + d + 0.15, 40)], o.tg);
    }
    case "swiss": {
      // the Swiss Subnet: a chalet of a data centre, steep eaves and a balcony, 13 lights for its 13
      // node providers, the Swiss flag
      const { x, y, w, d } = o, h = 11, wall = night ? "#5a6276" : "#f6f3ec", wood = night ? "#6a4e3a" : "#a8754a", roof = night ? "#4a3e36" : "#8a5a3c";
      box(x, y, w, d, h, wall, shade(toHex(wall), 0.08));
      // a stone base, the nodes' lights along it
      box(x - 0.04, y - 0.04, w + 0.08, d + 0.08, 3, shade(toHex(wall), 0.18), shade(toHex(wall), 0.26), undefined);
      for (let i = 0; i < 13; i++) { const u = 0.15 + i * ((w - 0.3) / 13), on = S.still || Math.sin(t * 2.2 + i * 0.9) > -0.4; onFace("y", x, y, w, d, u, u + 0.09, 0.8, 2.2, on ? "#34d399" : "#14532d", false); }
      for (let i = 0; i < 3; i++) onFace("y", x, y, w, d, 0.3 + i * 0.7, 0.6 + i * 0.7, 5, 9, night ? p.lit : p.win);
      // the balcony
      onFace("y", x, y, w, d + 0.25, 0.1, w - 0.1, 6, 7, wood);
      ctx.save(); ctx.strokeStyle = wood; ctx.beginPath(); for (let i = 0; i <= 8; i++) { const u = 0.1 + i * ((w - 0.2) / 8), a = P(x + u, y + d + 0.25, 6), b = P(x + u, y + d + 0.25, 4.3); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke(); ctx.restore();
      // a steep gable roof with deep eaves, ridge along y
      const e = 0.35, rh = 10;
      poly([P(x - e, y - e, h - 1), P(x - e, y + d + e, h - 1), P(x + w / 2, y + d + e, h + rh), P(x + w / 2, y - e, h + rh)], shade(toHex(roof), 0.12));
      poly([P(x + w + e, y - e, h - 1), P(x + w + e, y + d + e, h - 1), P(x + w / 2, y + d + e, h + rh), P(x + w / 2, y - e, h + rh)], roof);
      poly([P(x, y + d, h), P(x + w, y + d, h), P(x + w / 2, y + d, h + rh - 1)], wood);
      flag(x + w + 0.3, y + d * 0.5, 26, "ch", t);
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), P(x + w / 2, y, h + rh)], o.tg);
    }
    case "credentials": {
      // UNDP's Universal Trusted Credentials: an office with a sky-blue flag, small businesses in front of it
      const { x, y, w, d } = o, h = 12, wall = night ? "#53607a" : "#f4f8fc", blue = "#5b92e5";
      box(x, y, w, d * 0.6, h, wall, shade(toHex(wall), 0.08), shade(toHex(wall), 0.03));
      for (let i = 0; i < 4; i++) onFace("y", x, y, w, d * 0.6, 0.3 + i * 0.6, 0.55 + i * 0.6, 4, 9, night ? p.lit : "#cfe0f5");
      onFace("y", x, y, w, d * 0.6, w / 2 - 0.25, w / 2 + 0.25, 0, 6, blue);
      // three little shops with awnings: the businesses credentials help
      for (let i = 0; i < 3; i++) {
        const sx = x + 0.1 + i * (w / 3), sy = y + d * 0.68, sw = w / 3 - 0.2, cols = ["#f472b6", "#34d399", "#fbbf24"];
        box(sx, sy, sw, 0.5, 5, p.wall, p.wallR, undefined);
        poly([P(sx, sy + 0.55, 5), P(sx + sw, sy + 0.55, 5), P(sx + sw, sy + 0.3, 7.5), P(sx, sy + 0.3, 7.5)], cols[i]);
      }
      flag(x - 0.25, y + d * 0.6, 28, "blue", t);
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), P(x, y, h + 6)], o.tg);
    }
    case "bridge": {
      const { x, y } = o, wood = night ? "#6a5a4a" : "#d2b48c";
      box(x, y + 0.08, 1, 0.84, 2, wood, shade(toHex(wood), 0.12), shade(toHex(wood), -0.06), 1);
      ctx.beginPath();
      for (const v of [0.12, 0.88]) { const a = P(x, y + v, 7), b = P(x + 1, y + v, 7); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); for (const u of [0, 0.5, 1]) { const c2 = P(x + u, y + v, 3), e = P(x + u, y + v, 7); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(e[0], e[1]); } }
      ctx.stroke(); return;
    }
    case "reeds": {
      const [bx, by] = P(o.x + 0.2, o.y + 0.2), r = rng(o.s);
      ctx.save(); ctx.strokeStyle = night ? "#6f8f6a" : "#8fb07f"; ctx.lineWidth = line;
      ctx.beginPath(); for (let i = 0; i < 5; i++) { const dx = (r() - 0.5) * 8, hh = 6 + r() * 6; ctx.moveTo(bx + dx, by); ctx.lineTo(bx + dx + (r() - 0.5) * 2, by - hh); } ctx.stroke(); ctx.restore();
      ctx.fillStyle = night ? "#6a5040" : "#a87a52"; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(bx + (r() - 0.5) * 6, by - 9 - r() * 3, 1, 2.2, 0, 0, 6.283); ctx.fill(); }
      return o.tg ? hit([[bx - 5, by - 12], [bx + 5, by]], o.tg) : undefined;
    }
    case "capitol": {
      // the NNS: a long hall, a portico of columns under a pediment, a dome with the ICP colours flying
      const { x, y, w, d } = o, h = 15, stone = night ? "#5f6578" : "#f6f4ee", stoneR = shade(toHex(stone), 0.08);
      for (let i = 0; i < 3; i++) box(x + 1.3 - i * 0.18, y + d + 0.15 + i * 0.22, w - 2.6 + i * 0.36, 0.22, 2.2 - i * 0.7, stone, stoneR, shade(toHex(stone), 0.03));
      box(x, y, w, d, h, stone, stoneR, shade(toHex(stone), 0.04));
      for (const f of ["y", "x"] as const) { const n = f === "y" ? 8 : 4, len = f === "y" ? w : d; for (let i = 0; i < n; i++) { const u = 0.35 + i * ((len - 0.7) / (n - 1)); onFace(f, x, y, w, d, u - 0.12, u + 0.12, 5, 11, night ? p.lit : p.win); } }
      // the portico
      const px0 = x + w / 2 - 1.4, pw = 2.8, py = y + d + 0.05;
      box(px0, py, pw, 0.55, 1.5, stone, stoneR, shade(toHex(stone), 0.03));
      for (let i = 0; i < 5; i++) box(px0 + 0.1 + i * ((pw - 0.3) / 4), py + 0.3, 0.12, 0.12, h - 1.5, stone, stoneR, undefined, 1.5);
      poly([P(px0 - 0.1, py + 0.55, h), P(px0 + pw + 0.1, py + 0.55, h), P(px0 + pw / 2, py + 0.55, h + 6)], stone);
      poly([P(px0 - 0.1, py, h), P(px0 - 0.1, py + 0.55, h), P(px0 + pw / 2, py + 0.55, h + 6), P(px0 + pw / 2, py, h + 6)], shade(toHex(stone), 0.06));
      // the rotunda: a drum ringed with columns, an entablature, a ribbed dome, a lantern and the flag
      const cx = x + w / 2, cy = y + d / 2, [sx, base] = P(cx, cy, h), rx = 23, ry = 11.5, dh = 13;
      const top = base - dh, stoneD = shade(toHex(stone), 0.14), domeC = night ? "#6d7894" : "#e4eaf2";
      // the drum's back wall, in shade behind the columns
      ctx.beginPath(); ctx.ellipse(sx, base, rx - 3, ry - 1.5, 0, 0, Math.PI); ctx.lineTo(sx - rx + 3, top); ctx.ellipse(sx, top, rx - 3, ry - 1.5, 0, Math.PI, 0, true); ctx.closePath(); ctx.fillStyle = stoneD; ctx.fill();
      // a base ring, then the columns round the front half
      ctx.beginPath(); ctx.ellipse(sx, base, rx, ry, 0, 0, 6.283); ctx.fillStyle = stone; ctx.fill(); ctx.stroke();
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI, px = sx + Math.cos(a) * (rx - 1.5), py = Math.sin(a) * (ry - 1);
        const lit = Math.cos(a) < 0.3;
        ctx.fillStyle = lit ? stone : shade(toHex(stone), 0.07); ctx.fillRect(px - 1.3, top + py, 2.6, dh);
        ctx.strokeRect(px - 1.3, top + py, 2.6, dh);
      }
      // the entablature
      ctx.beginPath(); ctx.ellipse(sx, top, rx + 0.5, ry + 0.3, 0, 0, Math.PI); ctx.lineTo(sx - rx - 0.5, top - 3); ctx.ellipse(sx, top - 3, rx + 0.5, ry + 0.3, 0, Math.PI, 0, true); ctx.closePath(); ctx.fillStyle = stone; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(sx, top - 3, rx + 0.5, ry + 0.3, 0, 0, 6.283); ctx.fillStyle = shade(toHex(stone), 0.04); ctx.fill(); ctx.stroke();
      // the dome, lit from the left, with ribs
      const db = top - 4, dr = rx - 2, dhh = 26;
      const dg = ctx.createLinearGradient(sx - dr, 0, sx + dr, 0); dg.addColorStop(0, domeC); dg.addColorStop(1, shade(toHex(domeC), 0.18));
      ctx.beginPath(); ctx.moveTo(sx - dr, db); ctx.bezierCurveTo(sx - dr, db - dhh * 0.95, sx + dr, db - dhh * 0.95, sx + dr, db); ctx.ellipse(sx, db, dr, ry - 2, 0, 0, Math.PI); ctx.closePath(); ctx.fillStyle = dg; ctx.fill(); ctx.stroke();
      ctx.save(); ctx.globalAlpha = 0.45; ctx.beginPath();
      for (const k of [-0.75, -0.4, 0, 0.4, 0.75]) { const bx = sx + k * dr, by = db + Math.sqrt(Math.max(0, 1 - k * k)) * (ry - 2); ctx.moveTo(bx, by); ctx.quadraticCurveTo(sx + k * dr * 0.85, db - dhh * 0.55, sx, db - dhh * 0.71); }
      ctx.stroke(); ctx.restore();
      // the lantern on top, and the flag
      const lb = db - dhh * 0.71;
      ctx.beginPath(); ctx.ellipse(sx, lb, 5, 2.5, 0, 0, 6.283); ctx.fillStyle = stone; ctx.fill(); ctx.stroke();
      ctx.fillStyle = stone; ctx.fillRect(sx - 4, lb - 6, 8, 6); ctx.strokeRect(sx - 4, lb - 6, 8, 6);
      ctx.fillStyle = night ? p.lit : p.win; ctx.fillRect(sx - 1, lb - 5, 2, 4);
      ctx.beginPath(); ctx.ellipse(sx, lb - 6, 4.6, 2.3, 0, Math.PI, 0); ctx.bezierCurveTo(sx + 4.6, lb - 11, sx - 4.6, lb - 11, sx - 4.6, lb - 6); ctx.fillStyle = domeC; ctx.fill(); ctx.stroke();
      const fy0 = lb - 10;
      ctx.beginPath(); ctx.moveTo(sx, fy0); ctx.lineTo(sx, fy0 - 16); ctx.stroke();
      const wave = S.still ? 0 : Math.sin(t * 3) * 1.2;
      ICP.forEach((c, i) => poly([[sx, fy0 - 16 + i * 1.6], [sx + 13, fy0 - 15 + i * 1.6 + wave], [sx + 13, fy0 - 13.4 + i * 1.6 + wave], [sx, fy0 - 14.4 + i * 1.6]], c, false));
      poly([[sx, fy0 - 16], [sx + 13, fy0 - 15 + wave], [sx + 13, fy0 - 7 + wave], [sx, fy0 - 8]], undefined);
      const sy = fy0 + 20;
      return hit([P(x, y, 0), P(x + w, y + d + 0.8, 0), P(x, y + d + 0.8, 0), P(x + w, y, 0), [sx, sy - 42]], o.tg);
    }
    case "bank": {
      // OISY: a stone bank, four columns, a gold coin in the pediment and its name over the door
      const { x, y, w, d } = o, h = 13, stone = night ? "#5a6276" : "#f1eee6", stoneR = shade(toHex(stone), 0.08), blue = "#3d5afe";
      box(x - 0.1, y + d, w + 0.2, 0.35, 1.2, stone, stoneR, shade(toHex(stone), 0.03));
      box(x, y, w, d, h, stone, stoneR, shade(toHex(stone), 0.04));
      for (let i = 0; i < 4; i++) { const u = 0.35 + i * ((w - 0.7) / 3); box(x + u - 0.08, y + d + 0.05, 0.16, 0.16, h - 2.5, stone, stoneR, undefined, 1.2); }
      onFace("y", x, y, w, d, w / 2 - 0.3, w / 2 + 0.3, 0, 6.5, shade(toHex(stone), 0.35));
      for (let i = 0; i < 3; i++) onFace("x", x, y, w, d, 0.35 + i * 0.6, 0.6 + i * 0.6, 4, 9, night ? p.lit : p.win);
      poly([P(x - 0.1, y + d + 0.2, h), P(x + w + 0.1, y + d + 0.2, h), P(x + w / 2, y + d + 0.2, h + 7)], stone);
      poly([P(x - 0.1, y, h), P(x - 0.1, y + d + 0.2, h), P(x + w / 2, y + d + 0.2, h + 7), P(x + w / 2, y, h + 7)], shade(toHex(stone), 0.07));
      poly([P(x + w + 0.1, y, h), P(x + w + 0.1, y + d + 0.2, h), P(x + w / 2, y + d + 0.2, h + 7), P(x + w / 2, y, h + 7)], stoneR);
      const [cx, cy] = P(x + w / 2, y + d + 0.2, h + 2.8);
      ctx.beginPath(); ctx.ellipse(cx, cy, 3, 2.4, 0, 0, 6.283); ctx.fillStyle = "#f5c542"; ctx.fill(); ctx.stroke();
      const [tx, ty] = P(x + w / 2, y + d + 0.2, h - 1.8);
      ctx.save(); ctx.font = "800 6px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = night ? "#9fb0ff" : blue; ctx.fillText("OISY", tx, ty + 2); ctx.restore();
      return hit([P(x, y, 0), P(x + w, y + d + 0.4, 0), P(x, y + d + 0.4, 0), P(x + w, y, 0), P(x + w / 2, y + d, h + 8)], o.tg);
    }
    case "exchange": {
      // ICPSwap: a trading house with a board of candles that tick up and down, and swap arrows on top
      const { x, y, w, d } = o, h = 17, wall = night ? "#4c5568" : "#eef1f6", wallR = shade(toHex(wall), 0.08);
      box(x, y, w, d, h, wall, wallR, shade(toHex(wall), 0.04));
      onFace("y", x, y, w, d, w / 2 - 0.3, w / 2 + 0.3, 0, 7, shade(toHex(wall), 0.35));
      for (let i = 0; i < 3; i++) onFace("x", x, y, w, d, 0.3 + i * 0.75, 0.6 + i * 0.75, 4, 9, night ? p.lit : p.win);
      // the board over the door
      onFace("y", x, y, w, d, 0.2, w - 0.2, 9, 15.5, "#1d2230");
      for (let i = 0; i < 9; i++) {
        const u = 0.35 + i * ((w - 0.7) / 8), k = Math.sin(i * 1.7 + (S.still ? 0 : Math.floor(t * 1.5)) * 0.9), up = k > -0.15;
        const z0 = 11 + Math.sin(i * 2.3) * 1.2, z1 = z0 + 1 + Math.abs(k) * 2.4;
        onFace("y", x, y, w, d, u - 0.06, u + 0.06, z0, z1, up ? "#34d399" : "#f87171", false);
      }
      // two arrows chasing each other: a swap
      const [ax, ay] = P(x + w / 2, y + d / 2, h + 9), turn = S.still ? 0 : t * 0.8;
      ctx.save(); ctx.translate(ax, ay); ctx.scale(1, 0.55); ctx.rotate(turn); ctx.lineWidth = line * 2.2;
      for (const [c, a0] of [["#29abe2", 0], ["#ed1e79", Math.PI]] as const) {
        ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, 0, 8, a0 + 0.3, a0 + Math.PI - 0.3); ctx.stroke();
        const ex = Math.cos(a0 + Math.PI - 0.3) * 8, ey = Math.sin(a0 + Math.PI - 0.3) * 8; ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(ex - 3, ey); ctx.lineTo(ex + 3, ey); ctx.lineTo(ex + (a0 ? 0 : 0), ey + (a0 ? -4 : 4)); ctx.fill();
      }
      ctx.restore();
      const [sx2, sy2] = P(x + w / 2, y + d / 2, h);
      ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(ax, ay + 4); ctx.stroke();
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), [ax, ay - 8]], o.tg);
    }
    case "statue": {
      // a figure on a plinth, an arm raised to the sky, in a ring of hedges; lit from below at night
      const { x, y, w, d } = o, cx = x + w / 2, cy = y + d / 2, [sx, sy] = P(cx, cy), bronze = night ? "#7c9a8e" : "#8fb9a8";
      ctx.beginPath(); ctx.ellipse(sx, sy, 40, 20, 0, 0, 6.283); ctx.fillStyle = p.pave; ctx.fill(); ctx.save(); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.restore();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.4; if (i === 2) continue; const [hx, hy] = P(cx + Math.cos(a) * 1.25, cy + Math.sin(a) * 1.25); ctx.beginPath(); ctx.ellipse(hx, hy - 3, 5, 3.5, 0, 0, 6.283); ctx.fillStyle = toHex(p.pine); ctx.fill(); ctx.stroke(); }
      if (night) { const g = ctx.createRadialGradient(sx, sy - 18, 0, sx, sy - 18, 34); g.addColorStop(0, "rgba(255,230,180,.28)"); g.addColorStop(1, "rgba(255,230,180,0)"); ctx.fillStyle = g; ctx.fillRect(sx - 34, sy - 52, 68, 68); }
      box(cx - 0.42, cy - 0.42, 0.84, 0.84, 2, shade(toHex(p.wall.startsWith("#") ? p.wall : "#fdfdfc"), 0.1), shade(toHex(p.wall.startsWith("#") ? p.wall : "#fdfdfc"), 0.18), p.wall);
      box(cx - 0.3, cy - 0.3, 0.6, 0.6, 9, p.wall, p.wallR, shade(toHex(p.wall.startsWith("#") ? p.wall : "#fdfdfc"), 0.04), 2);
      onFace("y", cx - 0.3, cy - 0.3, 0.6, 0.6, 0.12, 0.48, 5, 8, "#d9b98e");
      const [fx, fy] = P(cx, cy, 11);
      ctx.save(); ctx.lineWidth = line * 1.2;
      poly([[fx - 3.2, fy], [fx - 1, fy], [fx - 0.6, fy - 9], [fx - 2.6, fy - 9]], shade(toHex(bronze), 0.1));
      poly([[fx + 1, fy], [fx + 3.2, fy], [fx + 2.6, fy - 9], [fx + 0.6, fy - 9]], bronze);
      poly([[fx - 4, fy - 8], [fx + 4, fy - 8], [fx + 3.2, fy - 19], [fx - 3.2, fy - 19]], bronze);
      poly([[fx + 3, fy - 18], [fx + 4.4, fy - 17.4], [fx + 8, fy - 28], [fx + 6.6, fy - 28.6]], bronze);
      poly([[fx - 3, fy - 18], [fx - 4.4, fy - 17.4], [fx - 5.2, fy - 10], [fx - 3.8, fy - 10]], shade(toHex(bronze), 0.1));
      ctx.beginPath(); ctx.arc(fx, fy - 22.5, 3.3, 0, 6.283); ctx.fillStyle = bronze; ctx.fill(); ctx.stroke();
      ctx.restore();
      return hit([[sx - 22, fy - 30], [sx + 22, sy + 8]], o.tg);
    }
    case "launchpad": {
      // SOON: a pad with hazard stripes, a lattice gantry, fuel tanks, and a rocket that goes up now and then
      const { x, y, w, d } = o, cx = x + w / 2, cy = y + d / 2, conc = night ? "#4a5062" : "#dfe1e6";
      box(x + 0.6, y + 0.6, w - 1.2, d - 1.2, 2.5, shade(toHex(conc), 0.06), shade(toHex(conc), 0.14), conc);
      for (let i = 0; i < 10; i++) { const u = x + 0.6 + (i * (w - 1.2)) / 10; poly([P(u, y + d - 0.6, 2.5), P(u + (w - 1.2) / 20, y + d - 0.6, 2.5), P(u + (w - 1.2) / 20, y + d - 0.6, 0.5), P(u, y + d - 0.6, 0.5)], i % 2 ? "#2a2d36" : "#f5c542", false); }
      ctx.beginPath(); ctx.ellipse(...P(cx, cy, 2.5), 16, 8, 0, 0, 6.283); ctx.fillStyle = night ? "#2f3442" : "#c3c7cf"; ctx.fill(); ctx.stroke();
      for (const [u, v] of [[x + 0.1, y + d - 1.4], [x + 0.1, y + d - 0.4]]) { const [tx, ty] = P(u + 0.4, v + 0.4, 6); ctx.beginPath(); ctx.arc(tx, ty, 6.5, 0, 6.283); ctx.fillStyle = p.wall; ctx.fill(); ctx.stroke(); }
      // the gantry
      const gx = cx - 1.6, gy = cy - 1.6, gh = 92;
      ctx.save(); ctx.strokeStyle = night ? "#c96456" : "#d9604c"; ctx.lineWidth = line * 1.2;
      const g0 = P(gx, gy, 2.5), g1 = P(gx + 0.6, gy, 2.5), g2 = P(gx, gy + 0.6, 2.5);
      ctx.beginPath();
      for (const q of [g0, g1, g2]) { ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] - gh); }
      for (let z = 0; z < gh; z += 8) { ctx.moveTo(g0[0], g0[1] - z); ctx.lineTo(g1[0], g1[1] - z - 8); ctx.moveTo(g0[0], g0[1] - z); ctx.lineTo(g2[0], g2[1] - z - 8); }
      ctx.stroke(); ctx.restore();
      // the rocket: on the pad, then up in fire and smoke every couple of minutes
      const cyc = S.still ? 0 : (t + 25) % 120, rising = cyc > 100 && cyc < 113, gone = cyc >= 113;
      const lift = rising ? (cyc - 100) ** 2 * 4.2 : 0, [rx, ry0] = P(cx, cy, 3), ry = ry0 - lift, tilt = rising ? Math.min(0.35, lift / 2400) : 0;
      // the strongback's arms hold it until launch
      if (!rising && !gone) { ctx.save(); ctx.strokeStyle = night ? "#c96456" : "#d9604c"; ctx.lineWidth = line * 1.4; for (const z of [40, 66]) { const [ax, ay] = P(gx + 0.3, gy + 0.3, z); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(rx - 3.6, ry - z + 6); ctx.stroke(); } ctx.restore(); }
      if (rising || (cyc > 96 && !gone)) {
        for (let i = 0; i < 12; i++) { const u = ((t * 0.6 + i / 12) % 1); ctx.fillStyle = `rgba(${night ? "200,205,220" : "238,239,243"},${0.8 * (1 - u)})`; ctx.beginPath(); ctx.arc(rx + (i - 5.5) * 5 * (0.5 + u * 1.4), ry0 + 3 - u * 10, 4 + u * 12, 0, 6.283); ctx.fill(); }
      }
      if (!gone) {
        ctx.save(); ctx.globalAlpha = rising ? Math.max(0, 1 - lift / 1100) : 1;
        ctx.translate(rx + lift * tilt * 0.6, ry); ctx.rotate(tilt);
        falcon(t, rising, night);
        ctx.restore();
      }
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), [rx, ry0 - 96]], o.tg);
    }
    case "office": {
      // a plain building for whatever comes next: glass on the front, a banner in its colour
      const { x, y, w, d } = o, h = 22, c = o.tg?.kind === "landmark" ? o.tg.landmark.color ?? "#6d7cff" : "#6d7cff";
      box(x, y, w, d, h, p.wall, p.wallR, shade(toHex(p.wall.startsWith("#") ? p.wall : "#fdfdfc"), 0.05));
      for (let r = 0; r < 3; r++) onFace("y", x, y, w, d, 0.2, w - 0.2, 4 + r * 6, 8 + r * 6, night ? p.lit : "#cfe3f1");
      onFace("x", x, y, w, d, 0.2, 0.6, 2, h - 2, c);
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), P(x, y, h)], o.tg);
    }
    case "sign": {
      // a signpost: the district's name, or a lot waiting for the next landmark
      const [bx, by] = P(o.x + o.w / 2, o.y + o.d / 2), big = o.s === 1, text = big && o.tg?.kind === "district" ? o.tg.district.name : "Room for more";
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - (big ? 20 : 12)); ctx.stroke();
      ctx.font = `${big ? 700 : 600} ${big ? 9 : 7}px Inter, system-ui, sans-serif`;
      const tw = ctx.measureText(text).width + 8, top = by - (big ? 30 : 20);
      ctx.fillStyle = big ? acc() : night ? "#3a4252" : "#ffffff"; ctx.beginPath(); ctx.roundRect(bx - tw / 2, top, tw, big ? 13 : 10, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = big ? "#ffffff" : night ? "#c8d0e0" : "#5a6276"; ctx.textAlign = "center"; ctx.fillText(text, bx, top + (big ? 9.5 : 7.5)); ctx.textAlign = "start";
      return hit([[bx - tw / 2, top], [bx + tw / 2, by]], o.tg);
    }
    case "bench": { box(o.x, o.y, o.w, o.d, 3, night ? "#5a5048" : "#c9a982", night ? "#4a4038" : "#b39470", night ? "#6a5e52" : "#d9bd98"); if (o.tg) hit(flat(o.x - 1, o.y - 1, 3, 2), o.tg); return; }
    case "lantern": {
      const [lx, ly] = P(o.x + 0.1, o.y + 0.1);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly - 12); ctx.stroke();
      if (night) { const g = ctx.createRadialGradient(lx, ly - 13, 0, lx, ly - 13, 16); g.addColorStop(0, "rgba(255,210,130,.45)"); g.addColorStop(1, "rgba(255,210,130,0)"); ctx.fillStyle = g; ctx.fillRect(lx - 16, ly - 29, 32, 32); }
      ctx.fillStyle = night ? p.lit : "#f3dea0"; ctx.beginPath(); ctx.arc(lx, ly - 13, 2.2, 0, 6.283); ctx.fill(); ctx.stroke();
      return hit([[lx - 6, ly - 16], [lx + 6, ly + 2]], o.tg);
    }
  }
}

/** The island's ground as paths (built once per plan): land, roads, water, the shore, the cliff
 *  faces we can see, and where the river spills over the edge. */
type Ground = { plan: Plan; land: Path2D; rail: Path2D; road: Path2D; water: Path2D; shore: Path2D; coast: Path2D; sideL: Path2D; sideR: Path2D; falls: [number, number, "x" | "y"][]; ripples: [number, number, number][] };
let groundCache: Ground | undefined;
const CLIFF = 8;
function ground(pl: Plan): Ground {
  if (groundCache?.plan === pl) return groundCache;
  const g: Ground = { plan: pl, land: new Path2D(), rail: new Path2D(), road: new Path2D(), water: new Path2D(), shore: new Path2D(), coast: new Path2D(), sideL: new Path2D(), sideR: new Path2D(), falls: [], ripples: [] };
  const tile = (path: Path2D, x: number, y: number) => { const q = flat(x, y, 1, 1); path.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) path.lineTo(q[i][0], q[i][1]); path.closePath(); };
  const edge = (path: Path2D, a: [number, number], b: [number, number]) => { path.moveTo(a[0], a[1]); path.lineTo(b[0], b[1]); };
  for (let y = pl.lo; y <= pl.hi; y++) for (let x = pl.lo; x <= pl.hi; x++) {
    const v = cellAt(pl, x, y);
    if (v === VOID) continue;
    tile(g.land, x, y);
    const wet = v === WATER || v === BRIDGE;
    if (v === ROAD) tile(g.road, x, y);
    if (v === RAIL) tile(g.rail, x, y);
    if (wet) { tile(g.water, x, y); if (h01(`rp${x},${y}`) < 0.12) g.ripples.push([x + 0.5, y + 0.5, h01(`rq${x},${y}`) * 6]); }
    const n = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => cellAt(pl, x + dx, y + dy));
    const corners: [number, number][] = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
    n.forEach((nv, i) => {
      const a = corners[i], b = corners[(i + 1) % 4];
      if (nv === VOID) edge(g.coast, a, b);
      else if (wet !== (nv === WATER || nv === BRIDGE)) edge(g.shore, a, b);
    });
    // the cliff faces toward us: below the +y and +x edges where the island ends
    if (n[2] === VOID) { const q: [number, number][] = [P(x, y + 1), P(x + 1, y + 1), P(x + 1, y + 1, -CLIFF), P(x, y + 1, -CLIFF)]; if (wet) g.falls.push([x, y, "y"]); else { g.sideL.moveTo(q[0][0], q[0][1]); q.slice(1).forEach((p) => g.sideL.lineTo(p[0], p[1])); g.sideL.closePath(); } }
    if (n[1] === VOID) { const q: [number, number][] = [P(x + 1, y), P(x + 1, y + 1), P(x + 1, y + 1, -CLIFF), P(x + 1, y, -CLIFF)]; if (wet) g.falls.push([x, y, "x"]); else { g.sideR.moveTo(q[0][0], q[0][1]); q.slice(1).forEach((p) => g.sideR.lineTo(p[0], p[1])); g.sideR.closePath(); } }
  }
  return (groundCache = g);
}
/** The ground: the island's cliffs, land with a faint grid, the streets, paving, the lake and river. */
function drawGround(t: number) {
  const pl = S.plan!, p = S.pal, g = ground(pl), night = S.o!.dark, frozen = S.sea.name === "winter";
  const edgeC = p.edge.startsWith("#") ? p.edge : "#dcdfe4";
  ctx.fillStyle = edgeC; ctx.fill(g.sideL); ctx.stroke(g.sideL);
  ctx.fillStyle = shade(edgeC, 0.08); ctx.fill(g.sideR); ctx.stroke(g.sideR);
  // where the river leaves the island: a waterfall
  const wat = frozen ? (night ? "#4a5a6e" : "#e2edf3") : p.water;
  for (const [x, y, f] of g.falls) {
    const q: [number, number][] = f === "y" ? [P(x, y + 1), P(x + 1, y + 1), P(x + 1, y + 1, -CLIFF - 6), P(x, y + 1, -CLIFF - 6)] : [P(x + 1, y), P(x + 1, y + 1), P(x + 1, y + 1, -CLIFF - 6), P(x + 1, y, -CLIFF - 6)];
    poly(q, wat);
    if (!S.still && !frozen) { ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.7)"; for (let i = 0; i < 3; i++) { const u = (t * 1.2 + i / 3) % 1, a = q[0], b = q[1], m = [(a[0] + b[0]) / 2 + (i - 1) * 4, (a[1] + b[1]) / 2]; ctx.beginPath(); ctx.moveTo(m[0], m[1] + u * (CLIFF + 2)); ctx.lineTo(m[0], m[1] + u * (CLIFF + 2) + 4); ctx.stroke(); } ctx.restore(); }
  }
  ctx.fillStyle = p.ground; ctx.fill(g.land);
  ctx.save(); ctx.clip(g.land); ctx.lineWidth = line * 0.7; ctx.strokeStyle = p.grid;
  ctx.beginPath();
  for (let i = pl.lo; i <= pl.hi + 1; i++) { let a = P(i, pl.lo), b = P(i, pl.hi + 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); a = P(pl.lo, i); b = P(pl.hi + 1, i); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke(); ctx.restore();
  ctx.fillStyle = p.road; ctx.fill(g.road);
  for (const [x, y, w, d] of pl.paving) poly(flat(x, y, w, d), p.pave, false);
  ctx.fillStyle = wat; ctx.fill(g.water);
  ctx.save(); ctx.strokeStyle = night ? "#4a5a70" : "#a9c6d6"; ctx.lineWidth = line; ctx.stroke(g.shore); ctx.restore();
  // the railway: ballast, sleepers, two rails
  const rl = pl.rail;
  ctx.fillStyle = night ? "#3a3a40" : "#d6d2c8"; ctx.fill(g.rail);
  ctx.save(); ctx.strokeStyle = night ? "#5a4a3c" : "#a88a6a"; ctx.lineWidth = line * 1.4; ctx.beginPath();
  for (let u = rl.x0; u <= rl.x1 + 1; u += 0.34) { const a = P(u, rl.y + 0.18, 1), b = P(u, rl.y + 0.82, 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke(); ctx.strokeStyle = night ? "#9aa3b5" : "#6a7080"; ctx.lineWidth = line * 1.1; ctx.beginPath();
  for (const v of [0.35, 0.65]) { const a = P(rl.x0, rl.y + v, 2), b = P(rl.x1 + 1, rl.y + v, 2); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke(); ctx.restore();
  // ripples on open water; cracks in the ice
  ctx.save(); ctx.strokeStyle = frozen ? (night ? "rgba(200,215,235,.35)" : "rgba(255,255,255,.9)") : night ? "rgba(170,200,230,.35)" : "rgba(255,255,255,.75)"; ctx.lineWidth = line * 0.8;
  for (const [x, y, ph] of g.ripples) {
    const [sx, sy] = P(x, y);
    if (frozen) { ctx.beginPath(); ctx.moveTo(sx - 5, sy - 1); ctx.lineTo(sx, sy + 1); ctx.lineTo(sx + 4, sy - 2); ctx.stroke(); continue; }
    const u = S.still ? 0.5 : (t * 0.25 + ph) % 1;
    ctx.globalAlpha = Math.sin(u * Math.PI); ctx.beginPath(); ctx.ellipse(sx, sy, 3 + u * 6, (3 + u * 6) / 2, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = night ? "#4a5a70" : "#b9cfdb"; ctx.lineWidth = line * 0.8;
  for (const [x, y, w, d] of pl.water) { const [cx, cy] = P(x + w / 2, y + d / 2); ctx.beginPath(); ctx.ellipse(cx, cy, (w + d) * 7.6, (w + d) * 3.8, 0, 0, 6.283); ctx.fillStyle = wat; ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // the trail loop through the grove
  ctx.save(); ctx.strokeStyle = night ? "#3a4252" : "#e3dccb"; ctx.lineWidth = 5; ctx.lineJoin = "round";
  ctx.beginPath(); pl.loop.forEach(([x, y], i) => { const [sx, sy] = P(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath(); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.strokeStyle = p.line; ctx.globalAlpha = 0.55; ctx.stroke(g.coast); ctx.restore();
}

// ---------------------------------------------------------------- life

/** Walkers follow the people online: in from the gate along the west road to their channel's stall. */
function syncWalkers() {
  const d = S.data!, pl = S.plan!;
  const want = new Map<string, number>();
  let total = 0;
  for (const ch of d.channels) { const n = Math.min(ch.online, 60 - total); if (n > 0) { want.set(ch.name, n); total += n; } }
  // your walker goes where you are
  for (const w of S.walkers) if (w.me && w.ch !== d.myChannel) w.leave = true;
  const have = new Map<string, Walker[]>();
  for (const w of S.walkers) if (!w.leave) (have.get(w.ch) ?? have.set(w.ch, []).get(w.ch)!).push(w);
  for (const [ch, ws] of have) {
    const extra = ws.length - (want.get(ch) ?? 0);
    // others leave before you do
    ws.sort((a, b) => Number(a.me) - Number(b.me));
    for (let i = 0; i < extra; i++) ws[ws.length - 1 - i].leave = true;
    if (extra > 0) have.set(ch, ws.filter((w) => !w.leave));
  }
  // still frames: nobody walks out, they are simply gone
  if (S.still) S.walkers = S.walkers.filter((w) => !w.leave);
  for (const [ch, n] of want) {
    const stall = pl.stalls.find((s) => s.ch!.name === ch);
    if (!stall) continue;
    for (let i = (have.get(ch)?.length ?? 0); i < n; i++) {
      const me = d.myChannel === ch && !S.walkers.some((w) => w.me && !w.leave);
      const r = Math.random(), sx = stall.x + 0.38, sy = stall.y + 0.38;
      // stand a little in front of the stall, toward the fountain
      const home: [number, number] = [sx + (11 - sx) * 0.28 + (r - 0.5) * 0.5, sy + (11 - sy) * 0.28 + (Math.random() - 0.5) * 0.5];
      const fresh = S.still || !S.last;
      S.walkers.push({ ch, me, path: [pl.gate, [7.5, 10.5], [8.6, 10.5], home], i: 0, u: 0, speed: 1.1 + Math.random() * 0.5, state: fresh ? "stay" : "in", home, wob: Math.random() * 6, c: Math.floor(Math.random() * 5) });
      if (fresh) S.walkers[S.walkers.length - 1].i = 3;
    }
  }
  S.hikers = Array.from({ length: d.hikers }, (_, i) => S.hikers[i] ?? { u: i / Math.max(1, d.hikers), speed: 0.03 + Math.random() * 0.01, c: i % 5 });
}
function walkerAt(w: Walker): [number, number] {
  if (w.state === "stay") return [w.home[0] + Math.sin(w.wob) * 0.18, w.home[1] + Math.cos(w.wob * 0.8) * 0.18];
  const a = w.path[w.i], b = w.path[Math.min(w.i + 1, w.path.length - 1)];
  return [a[0] + (b[0] - a[0]) * w.u, a[1] + (b[1] - a[1]) * w.u];
}
function stepWalkers(dt: number) {
  for (const w of S.walkers) {
    if (w.state === "stay") { w.wob += dt * 0.6; if (w.leave) { w.state = "out"; w.path = [...w.path].reverse(); w.i = 0; w.u = 0; } continue; }
    const a = w.path[w.i], b = w.path[w.i + 1];
    if (!b) { w.state = w.state === "in" ? "stay" : "out"; if (w.state === "out") w.i = -1; continue; }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    w.u += (w.speed * dt) / len;
    if (w.u >= 1) { w.i++; w.u = 0; if (w.i >= w.path.length - 1) { if (w.state === "in") w.state = "stay"; else w.i = -1; } }
  }
  S.walkers = S.walkers.filter((w) => w.i >= 0);
  for (const h of S.hikers) h.u = (h.u + h.speed * dt) % 1;
}
function loopAt(u: number): [number, number] {
  const L = S.plan!.loop, seg = u * L.length, i = Math.floor(seg), f = seg - i, a = L[i % L.length], b = L[(i + 1) % L.length];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

// ---------------------------------------------------------------- the frame

function frame(now: number) {
  if (!S.ctx || !S.plan || !S.o) return;
  const t = (now - S.t0) / 1000, dt = Math.min(0.1, (now - (S.last || now)) / 1000);
  S.last = now;
  ctx = S.ctx;
  const { w, h, dpr, cam } = S, preview = S.o.mode === "preview";
  if (!S.still) stepWalkers(dt);
  if (preview && !S.still) { cam.x = S.camHome[0] + Math.sin(t * 0.045) * 150; cam.y = S.camHome[1] + Math.sin(t * 0.031) * 50; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (w / 2 - cam.x * cam.z), dpr * (h / 2 - cam.y * cam.z));
  line = 1.25 / Math.max(0.7, cam.z);
  ctx.lineWidth = line; ctx.lineJoin = "round"; ctx.strokeStyle = S.pal.line;
  S.hits = [];
  drawGround(t);
  // what's on screen, with a margin for tall things
  const vx0 = cam.x - w / 2 / cam.z - 60, vx1 = cam.x + w / 2 / cam.z + 60, vy0 = cam.y - h / 2 / cam.z - 20, vy1 = cam.y + h / 2 / cam.z + 80;
  const live: { k: number; draw: () => void }[] = [];
  for (const wk of S.walkers) { const [x, y] = walkerAt(wk); live.push({ k: x + y, draw: () => { drawPerson(x, y, wk.me ? acc() : S.pal.person[wk.c], t, wk.state !== "stay"); const [px, py] = P(x, y); hit([[px - 4, py - 12], [px + 4, py + 2]], (wk.tg ??= { kind: "walker", channel: wk.ch, me: wk.me })); } }); }
  // this week's newcomers play in the schoolyard
  const [yx, yy, yw, yd] = S.plan.yard;
  for (let i = 0; i < Math.min(12, S.data!.newcomers7d); i++) {
    const a = t * 0.4 + i * 1.7, x = yx + 0.3 + ((i * 0.37) % 1) * (yw - 0.6) + (S.still ? 0 : Math.sin(a) * 0.25), y = yy + 0.3 + ((i * 0.61) % 1) * (yd - 0.6) + (S.still ? 0 : Math.cos(a * 0.8) * 0.2);
    const hop = S.still ? 0 : Math.max(0, Math.sin(t * 5 + i * 2)) * 3;
    live.push({ k: x + y, draw: () => drawPerson(x, y, S.pal.person[(i + 2) % 5], t, false, 0.72, hop) });
  }
  // visitors wait on the platform (yours first); the train comes in, stops, goes on
  const rl = S.plan.rail;
  S.plan.platform.slice(0, Math.min(24, S.data!.campers)).forEach(([x, y], i) => {
    const mine = !!S.data!.meCamping && i === 0, wob = S.still ? 0 : Math.sin(t * 0.7 + i) * 0.08;
    live.push({ k: x + y, draw: () => {
      drawPerson(x + wob, y, mine ? acc() : S.pal.person[(i + 1) % 5], t, false);
      const [px, py] = P(x + wob, y);
      if (mine) label("You", px, py - 18, acc());
      hit([[px - 4, py - 12], [px + 4, py + 2]], (S.visitorTg[i] ??= { kind: "visitor", mine }));
    } });
  });
  const tx = trainAt(t, rl);
  if (tx !== undefined) live.push({ k: tx + rl.y + 0.5, draw: () => drawTrain(tx, rl) });
  for (const hk of S.hikers) { const [x, y] = loopAt(hk.u); live.push({ k: x + y, draw: () => drawPerson(x, y, S.pal.person[hk.c], t, true) }); }
  live.sort((a, b) => a.k - b.k);
  let li = 0;
  for (const o of S.plan.objs) {
    const k = o.x + o.w / 2 + o.y + o.d / 2;
    while (li < live.length && live[li].k < k) live[li++].draw();
    const [sx, sy] = P(o.x + o.w / 2, o.y + o.d / 2);
    if (sx < vx0 || sx > vx1 || sy < vy0 || sy > vy1) continue;
    // one drawing that fails must not blank the rest of the town
    try { drawObj(o, t); } catch (e) { if (!S.warned) { S.warned = true; console.warn("town: could not draw", o.k, e); } }
  }
  while (li < live.length) live[li++].draw();
  if (!S.still) birds(t);
  // speech bubbles over the stalls, at the channel's pace (sped up), and a cloud when it rained lately
  if (!S.still) bubbles(t);
  if (S.data!.lastRain && Date.now() - S.data!.lastRain < 3600e3 && !S.still) rainCloud(t);
  if (S.hover && S.o.mode === "full") outlineHover();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!S.still) weather(dt);
}
/** Where the train's front is (tiles along the track), or undefined while it's away: a minute and a half
 *  round, in from the left, a stop at the platform, out to the right. */
function trainAt(t: number, rl: Plan["rail"]): number | undefined {
  const c = S.still ? 30 : (t + 8) % 90, start = rl.x0 + 1.9, run = rl.stop - start, ease = (u: number) => u * u * (3 - 2 * u);
  if (c < 14) return start + run * (1 - (1 - ease(c / 14)) ** 1.5);
  if (c < 36) return rl.stop;
  if (c < 52) return rl.stop + (rl.x1 + 1 - rl.stop + 5.5) * ((c - 36) / 16) ** 2;
  return undefined;
}
/** A locomotive and two coaches heading right, fading in at the start of the line and out at its end. */
function drawTrain(front: number, rl: Plan["rail"]) {
  const night = S.o!.dark, y = rl.y + 0.18, d = 0.64, loco = acc(), coach = night ? "#5a6276" : "#f4f1ea", roof = night ? "#3c4252" : "#9aa3b5";
  const cars: [number, number, boolean][] = [[front - 1.9, 1.9, true], [front - 3.7, 1.7, false], [front - 5.5, 1.7, false]];
  for (const [x, len, isLoco] of [...cars].reverse()) {
    const fade = Math.max(0, Math.min(1, (x - rl.x0) / 2.5, (rl.x1 + 1 - (x + len)) / 2.5));
    if (fade <= 0) continue;
    ctx.save(); ctx.globalAlpha = fade;
    box(x, y, len, d, 9, isLoco ? loco : coach, shade(toHex(isLoco ? (loco.startsWith("#") ? loco : "#6d7cff") : coach), 0.1), roof, 1.5);
    if (isLoco) { box(x + len - 0.5, y, 0.5, d, 3, shade(toHex(loco.startsWith("#") ? loco : "#6d7cff"), 0.15), shade(toHex(loco.startsWith("#") ? loco : "#6d7cff"), 0.25), undefined, 10.5); onFace("x", x, y, len, d, 0.15, d - 0.15, 6, 9, night ? S.pal.lit : S.pal.win); }
    else for (let i = 0; i < 4; i++) onFace("y", x, y, len, d, 0.15 + i * 0.4, 0.4 + i * 0.4, 5.5, 8.5, night ? S.pal.lit : S.pal.win);
    for (const u of [0.25, len - 0.25]) { const [wx, wy] = P(x + u, y + d, 1.5); ctx.beginPath(); ctx.arc(wx, wy, 1.4, 0, 6.283); ctx.fillStyle = "#2a2d36"; ctx.fill(); }
    ctx.restore();
  }
}
/** A few birds in loose flocks, flapping across the sky (decoration only). */
function birds(t: number) {
  const pl = S.plan!, span = pl.hi - pl.lo;
  ctx.save(); ctx.strokeStyle = S.o!.dark ? "rgba(210,220,240,.55)" : "rgba(60,66,80,.55)"; ctx.lineWidth = line * 1.1;
  for (let f = 0; f < 3; f++) {
    const u = ((t * (0.012 + f * 0.003) + f * 0.37) % 1), bx = pl.lo + u * span * 1.3 - span * 0.15, by = pl.lo + span * (0.25 + f * 0.25) + Math.sin(t * 0.2 + f) * 3;
    for (let i = 0; i < 4 + f; i++) {
      const ox = -i * 0.9 + Math.sin(i * 2.3) * 0.4, oy = (i % 2 ? 1 : -1) * i * 0.5, [sx, sy] = P(bx + ox, by + oy, 110 + f * 18 + Math.sin(t + i) * 3);
      const flap = Math.sin(t * 8 + i * 1.7 + f) * 2.2;
      ctx.beginPath(); ctx.moveTo(sx - 4, sy - flap); ctx.quadraticCurveTo(sx - 2, sy - 1, sx, sy + 0.5); ctx.quadraticCurveTo(sx + 2, sy - 1, sx + 4, sy - flap); ctx.stroke();
    }
  }
  ctx.restore();
}
function bubbles(t: number) {
  const pl = S.plan!;
  for (const st of pl.stalls) {
    const m = chan(st.ch!.name).messages24h;
    if (!m) continue;
    const next = S.nextBubble.get(st.ch!.name) ?? t + Math.random() * 6;
    if (t >= next) { S.bubbles.push({ i: st.s, at: t }); S.nextBubble.set(st.ch!.name, t + Math.max(3, Math.min(40, 86400 / 60 / m)) * (0.6 + Math.random() * 0.8)); }
    else S.nextBubble.set(st.ch!.name, next);
  }
  S.bubbles = S.bubbles.filter((b) => t - b.at < 2.6);
  for (const b of S.bubbles) {
    const st = pl.stalls[b.i];
    if (!st) continue;
    const age = t - b.at, a = Math.min(1, age * 4, (2.6 - age) * 2), [bx, by] = P(st.x + 0.4, st.y + 0.4, 22 + age * 4);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = S.o!.dark ? "#e8eaf2" : "#ffffff";
    ctx.beginPath(); ctx.roundRect(bx - 9, by - 7, 18, 11, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = S.pal.line; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(bx + i * 4, by - 1.5, 1, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }
}
function rainCloud(t: number) {
  const [cx, cy] = P(11 + Math.sin(t * 0.1) * 2, 11 + Math.cos(t * 0.13) * 1.5, 70);
  ctx.save(); ctx.fillStyle = S.o!.dark ? "rgba(90,100,125,.9)" : "rgba(255,255,255,.95)";
  for (const [dx, dy, r] of [[-12, 0, 9], [0, -5, 12], [13, 0, 9], [0, 3, 10]]) { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, 6.283); ctx.fill(); }
  ctx.strokeStyle = "#f5c542"; ctx.lineWidth = line * 1.2;
  for (let i = 0; i < 9; i++) { const u = (t * 0.9 + i / 9) % 1, x = cx - 16 + i * 4, y = cy + 8 + u * 40; ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y + 4); ctx.stroke(); }
  ctx.restore();
}
/** Snow in winter, leaves in autumn, petals in spring: screen-space, decoration only. */
function weather(dt: number) {
  const sea = S.sea.name;
  if (sea === "summer") return;
  const n = Math.round((S.w * S.h) / 14000);
  while (S.flakes.length < n) S.flakes.push([Math.random() * S.w, Math.random() * S.h, Math.random()]);
  S.flakes.length = n;
  const c = sea === "winter" ? (S.o!.dark ? "rgba(220,230,250,.55)" : "rgba(170,185,205,.5)") : sea === "autumn" ? "rgba(226,150,90,.55)" : "rgba(244,170,190,.55)";
  ctx.fillStyle = c;
  for (const f of S.flakes) {
    f[1] += dt * (14 + f[2] * 18); f[0] += dt * Math.sin(f[1] * 0.02 + f[2] * 6) * 8;
    if (f[1] > S.h) { f[1] = -4; f[0] = Math.random() * S.w; }
    ctx.beginPath();
    if (sea === "winter") ctx.arc(f[0], f[1], 0.8 + f[2] * 1.2, 0, 6.283); else ctx.ellipse(f[0], f[1], 2.2, 1.1, f[1] * 0.05, 0, 6.283);
    ctx.fill();
  }
}
function outlineHover() {
  const h = S.hits.find((x) => x.tg === S.hover);
  if (!h) return;
  ctx.save(); ctx.strokeStyle = rgba(S.accent, 0.8); ctx.setLineDash([4, 3]); ctx.lineWidth = line * 1.2;
  ctx.beginPath(); ctx.roundRect(h.x0 - 3, h.y0 - 3, h.x1 - h.x0 + 6, h.y1 - h.y0 + 6, 6); ctx.stroke(); ctx.restore();
}

/** The landing preview stops drawing while it is scrolled out of sight. */
const onScreen = () => { const b = S.canvas!.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; };
function loop(now: number) {
  S.raf = 0;
  if (!S.canvas?.isConnected) return;
  if (!document.hidden && now - S.last >= 32 && onScreen()) frame(now);
  S.raf = requestAnimationFrame(loop);
}
function start() {
  if (S.still) { frame(performance.now()); return; }
  if (!S.raf) S.raf = requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- the camera and input

const worldBox = () => { const pl = S.plan!; const l = P(pl.lo, pl.hi + 1)[0], r = P(pl.hi + 1, pl.lo)[0], top = P(pl.lo, pl.lo)[1], bot = P(pl.hi + 1, pl.hi + 1)[1]; return { l, r, top, bot }; };
const clampZ = (z: number) => Math.max(0.22, Math.min(2.5, z));
function home() {
  const b = worldBox(), pl = S.plan!;
  if (S.o!.mode === "preview") {
    // the civic centre, a little closer
    const [cx, cy] = P(6.5, 6.5);
    S.camHome = [cx, cy];
    S.cam = { x: cx, y: cy, z: clampZ(Math.min(S.w / 640, S.h / 300)) };
    return;
  }
  // the whole island
  const span = (pl.hi - pl.lo + 1) * TW;
  S.fit = clampZ(Math.min(S.w / span, (S.h - 120) / (span / 2)) * 1.25);
  S.cam = { x: (b.l + b.r) / 2, y: (b.top + b.bot) / 2, z: S.fit };
}
/** The camera from the toolbar: zoom, recentre, or fly to a lot. */
export function townCamera(cmd: "in" | "out" | "home" | "mine") {
  if (!S.plan) return;
  if (cmd === "in" || cmd === "out") S.cam.z = clampZ(S.cam.z * (cmd === "in" ? 1.25 : 0.8));
  else if (cmd === "home") home();
  else {
    const o = S.plan.objs.find((x) => (x.k === "house" || x.k === "plot") && x.mine);
    if (o) { const [cx, cy] = P(o.x + o.w / 2, o.y + o.d / 2, 12); S.cam = { x: cx, y: cy, z: Math.max(S.cam.z, 1.6) }; }
  }
  if (S.still) frame(performance.now());
}
function size() {
  const c = S.canvas!, b = c.getBoundingClientRect();
  S.dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(b.width)), h = Math.max(1, Math.round(b.height));
  if (w === S.w && h === S.h && c.width === Math.round(w * S.dpr)) return;
  const first = !S.w;
  S.w = w; S.h = h; c.width = Math.round(w * S.dpr); c.height = Math.round(h * S.dpr);
  if (first || S.o?.mode === "preview") home();
  if (S.still) frame(performance.now());
}
function pick(e: PointerEvent | MouseEvent): Target | undefined {
  const b = S.canvas!.getBoundingClientRect(), mx = (e.clientX - b.left - S.w / 2) / S.cam.z + S.cam.x, my = (e.clientY - b.top - S.h / 2) / S.cam.z + S.cam.y;
  for (let i = S.hits.length - 1; i >= 0; i--) { const h = S.hits[i]; if (mx >= h.x0 && mx <= h.x1 && my >= h.y0 && my <= h.y1) return h.tg; }
  return undefined;
}
function showTip(tg: Target | undefined, e?: { clientX: number; clientY: number }) {
  S.hover = tg;
  const el = S.tipEl;
  if (!el) return;
  if (!tg || !e) { el.hidden = true; return; }
  el.innerHTML = S.o!.tip(tg);
  el.hidden = false;
  const host = S.canvas!.parentElement!.getBoundingClientRect();
  const x = Math.min(host.width - el.offsetWidth - 8, Math.max(8, e.clientX - host.left + 14)), y = Math.max(8, e.clientY - host.top - el.offsetHeight - 12);
  el.style.transform = `translate(${x}px, ${y}px)`;
}
/** Zoom about a point on screen (the pointer, or the middle of a pinch). */
function zoomAt(cx: number, cy: number, z: number) {
  const b = S.canvas!.getBoundingClientRect(), mx = cx - b.left - S.w / 2, my = cy - b.top - S.h / 2, z0 = S.cam.z, z1 = clampZ(z);
  S.cam.x += mx / z0 - mx / z1; S.cam.y += my / z0 - my / z1; S.cam.z = z1;
}
function bind(c: HTMLCanvasElement) {
  c.addEventListener("pointerdown", (e) => {
    S.pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (S.o!.mode !== "full") return;
    c.setPointerCapture(e.pointerId);
    if (S.pts.size === 2) { const [a, b] = [...S.pts.values()]; S.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); S.drag = undefined; S.pinched = true; return; }
    S.drag = { x: e.clientX, y: e.clientY, cx: S.cam.x, cy: S.cam.y, moved: false };
  });
  c.addEventListener("pointermove", (e) => {
    if (S.pts.has(e.pointerId)) S.pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (S.pts.size === 2 && S.pinch) { const [a, b] = [...S.pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, S.cam.z * (d / S.pinch)); S.pinch = d; if (S.still) frame(performance.now()); return; }
    const dr = S.drag;
    if (dr) {
      const dx = e.clientX - dr.x, dy = e.clientY - dr.y;
      if (Math.hypot(dx, dy) > 4) dr.moved = true;
      if (dr.moved) { S.cam.x = dr.cx - dx / S.cam.z; S.cam.y = dr.cy - dy / S.cam.z; showTip(undefined); c.style.cursor = "grabbing"; if (S.still) frame(performance.now()); return; }
    }
    if (e.pointerType !== "mouse") return;
    const tg = pick(e);
    c.style.cursor = tg ? "pointer" : S.o!.mode === "full" ? "grab" : "";
    if (tg !== S.hover || tg) { showTip(tg, e); if (S.still) frame(performance.now()); }
  });
  const up = (e: PointerEvent) => {
    S.pts.delete(e.pointerId);
    if (S.pts.size < 2) S.pinch = 0;
    // lifting the fingers after a pinch is not a tap
    if (S.pinched) { if (!S.pts.size) S.pinched = false; S.drag = undefined; return; }
    const dr = S.drag;
    S.drag = undefined;
    c.style.cursor = "";
    if (dr?.moved || e.type === "pointercancel") return;
    const tg = pick(e);
    // touch: the first tap shows what it is, a second opens it
    if (e.pointerType !== "mouse" && tg && S.tapped !== tg) { S.tapped = tg; showTip(tg, e); return; }
    S.tapped = undefined;
    if (tg) S.o!.onOpen(tg); else if (S.o!.mode === "preview") S.o!.onOpen({ kind: "hall" });
  };
  c.addEventListener("pointerup", up);
  c.addEventListener("pointercancel", up);
  c.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !S.drag) showTip(undefined); });
  c.addEventListener("wheel", (e) => {
    if (S.o!.mode !== "full") return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, S.cam.z * Math.exp(-e.deltaY * 0.0015));
    if (S.still) frame(performance.now());
  }, { passive: false });
  c.addEventListener("keydown", (e) => {
    if (S.o!.mode !== "full") return;
    const step = 60 / S.cam.z, k = e.key;
    if (k === "ArrowLeft") S.cam.x -= step; else if (k === "ArrowRight") S.cam.x += step; else if (k === "ArrowUp") S.cam.y -= step; else if (k === "ArrowDown") S.cam.y += step;
    else if (k === "+" || k === "=") townCamera("in"); else if (k === "-") townCamera("out"); else if (k === "0") townCamera("home"); else return;
    e.preventDefault();
    if (S.still) frame(performance.now());
  });
}

/** Put the town on `canvas` (again after a re-render: the camera and walkers carry on). */
export function attachTown(canvas: HTMLCanvasElement, o: TownOpts) {
  const fresh = S.canvas !== canvas;
  S.o = o;
  if (fresh) {
    S.canvas = canvas;
    S.ctx = canvas.getContext("2d") ?? undefined;
    if (!S.ctx) return;
    S.tipEl = canvas.parentElement?.querySelector<HTMLElement>(".town-tip") ?? undefined;
    S.ro?.disconnect();
    S.ro = new ResizeObserver(() => size());
    S.ro.observe(canvas);
    bind(canvas);
    Object.assign(S, { pts: new Map(), drag: undefined, pinch: 0, pinched: false, tapped: undefined, hover: undefined });
    if (S.camMode !== o.mode) { S.w = 0; S.h = 0; }
  }
  S.sea = season(new Date());
  S.pal = palette(o.dark, S.sea.name);
  S.accent = accentOf(o.accent);
  const sig = JSON.stringify([o.data.houses, o.data.mine, o.data.off, o.data.channels.map((c) => c.name), o.data.listings, o.data.spawned7d, o.data.building, o.data.campers, o.data.meCamping, o.data.sponsors]);
  if (sig !== S.sig || !S.plan) { S.plan = layoutTown(o.data); S.sig = sig; }
  S.data = o.data;
  syncWalkers();
  size();
  if (S.camMode !== o.mode) { S.camMode = o.mode; home(); }
  start();
  if (fresh) frame(performance.now());
}
