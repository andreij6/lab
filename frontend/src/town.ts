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

export type TownHouse = { lot: number; storeys: number; size: number; lit: number; agent: boolean };
export type TownChan = { name: string; online: number; messages24h: number };
export type TownData = {
  at: number; houses: TownHouse[]; people: number; homes: number; quiet: number; mine?: number; myChannel?: string;
  channels: TownChan[]; postTopics: string[]; postsLive: number; posts24h: number; listings: number; discoveries: number;
  underReview: number; rains24h: number; lastRain?: number; hikers: number; off: string[];
};
export type Target =
  | { kind: "house"; house: TownHouse; mine: boolean } | { kind: "plot" } | { kind: "hall" } | { kind: "stall"; channel: TownChan }
  | { kind: "fountain" } | { kind: "board" } | { kind: "market" } | { kind: "observatory" } | { kind: "obelisk"; n: number }
  | { kind: "park" } | { kind: "trail" } | { kind: "walker"; channel: string; me: boolean };
type Kind = "house" | "plot" | "garden" | "tree" | "pine" | "rock" | "hall" | "stall" | "fountain" | "gazebo" | "market" | "crate" | "observatory" | "obelisk" | "bench" | "lantern";
export type Obj = { k: Kind; x: number; y: number; w: number; d: number; s: number; tg?: Target; h?: TownHouse; face?: "x" | "y" | ""; n?: number; ch?: TownChan; mine?: boolean };
export type Plan = { R: number; lo: number; hi: number; tlo: number; thi: number; objs: Obj[]; water: number[][]; paving: number[][]; stalls: Obj[]; gateY: number; loop: [number, number][] };

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
const ringOf = (b: number) => { const [x, y] = blockAt(b); return Math.max(Math.abs(x), Math.abs(y)); };
/** The 2×2 tiles of slot `slot` in block (bx, by), and the side it faces the road on that we can see. */
function lotTiles(bx: number, by: number, slot: number): { x: number; y: number; face: "x" | "y" | "" } {
  const [cx, cy] = SLOTS[slot];
  const face = cx === 2 && cy === 2 ? (slot % 2 ? "x" : "y") : cx === 2 ? "x" : cy === 2 ? "y" : "";
  return { x: 7 * bx + 1 + 2 * cx, y: 7 * by + 1 + 2 * cy, face };
}
/** A well-mixed 0..1 from a string (FNV alone is biased for keys that differ in one character). */
const h01 = (s: string) => { let h = hashOf(s); h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function layoutTown(t: TownData): Plan {
  const off = new Set(t.off);
  const agents = t.houses.filter((h) => h.agent).sort((a, b) => a.lot - b.lot);
  const quarter = new Map(agents.slice(0, 16).map((h, i) => [h.lot, i]));
  const people = t.houses.filter((h) => !quarter.has(h.lot));
  const used = [...people.map((h) => h.lot), ...(t.mine !== undefined ? [t.mine] : [])];
  const maxBlock = used.length ? Math.floor(Math.max(...used) / 8) : 0;
  const R = Math.max(2, ringOf(maxBlock));
  const tlo = -7 * R, thi = 7 * R + 7, lo = tlo - 6, hi = thi + 6;
  const objs: Obj[] = [], water: number[][] = [], paving: number[][] = [];
  const put = (o: Obj) => { objs.push(o); return o; };
  const tree = (x: number, y: number, seed: string, pine?: boolean) => put({ k: pine ?? h01(seed) < 0.45 ? "pine" : "tree", x: x - 0.3, y: y - 0.3, w: 0.6, d: 0.6, s: hashOf(seed) });
  const byLot = new Map(people.map((h) => [h.lot, h]));
  /** One lot: a house, your quiet plot, or something green. */
  const lot = (bx: number, by: number, slot: number, n: number | undefined, h: TownHouse | undefined) => {
    const { x, y, face } = lotTiles(bx, by, slot);
    const mine = n !== undefined && n === t.mine;
    if (h) {
      // the house sits toward its road; bigger houses fill more of the lot
      const fw = [1.1, 1.3, 1.5, 1.75][h.size], fd = [1.0, 1.2, 1.45, 1.7][h.size];
      const ox = face === "x" ? 1.9 - fw : 0.1 + (1.8 - fw) / 2, oy = face === "y" ? 1.9 - fd : 0.1 + (1.8 - fd) / 2;
      put({ k: "house", x: x + ox, y: y + oy, w: fw, d: fd, s: hashOf(`lot${h.lot}`), h, face, mine, tg: { kind: "house", house: h, mine } });
      if (h.size === 0) put({ k: "garden", x: x + (face === "x" ? 0.15 : 1.3), y: y + (face === "y" ? 0.15 : 1.3), w: 0.55, d: 0.55, s: 1 });
      return;
    }
    if (mine) { put({ k: "plot", x: x + 0.15, y: y + 0.15, w: 1.7, d: 1.7, s: 0, mine, tg: { kind: "plot" } }); return; }
    const key = `${bx},${by},${slot}`, r = h01(`fill${key}`);
    if (r < 0.5) { tree(x + 0.6, y + 0.6, `a${key}`); if (r < 0.3) tree(x + 1.4, y + 1.3, `b${key}`); if (r < 0.15) tree(x + 1.3, y + 0.5, `c${key}`); }
    else if (r < 0.7) put({ k: "garden", x: x + 0.3, y: y + 0.3, w: 1.4, d: 1.4, s: hashOf(key) });
    else if (r < 0.8) water.push([x + 0.25, y + 0.25, 1.5, 1.5]);
    else if (r < 0.9) put({ k: "rock", x: x + 0.7, y: y + 0.8, w: 0.5, d: 0.4, s: hashOf(key) });
  };
  const courtyard = (bx: number, by: number) => tree(7 * bx + 4, 7 * by + 4, `court${bx},${by}`, false);
  // the residential rings, every block up to the outermost one used
  for (let b = 0; ringOf(b) <= R; b++) {
    const [bx, by] = blockAt(b);
    for (let s = 0; s < 8; s++) { const n = b * 8 + s; const h = byLot.get(n); lot(bx, by, s, n, h); }
    courtyard(bx, by);
  }
  // the Agent Quarter, beside the observatory: the first 16 agents' workshops
  const q: [number, number][] = [[-1, 0], [0, -1]];
  q.forEach(([bx, by], qi) => {
    for (let s = 0; s < 8; s++) { const a = agents[qi * 8 + s]; lot(bx, by, s, a?.lot, a); }
    courtyard(bx, by);
  });
  // the civic centre
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
  const stalls = chans.map((ch, i) => ({ ch, at: ring[Math.floor((i * ring.length) / chans.length)] })).map(({ ch, at }, i) => put({ k: "stall", x: at[0] + 0.12, y: at[1] + 0.12, w: 0.76, d: 0.76, s: i, ch, tg: { kind: "stall", channel: ch } }));
  // the board's pavilion (left)
  paving.push([-5, 9, 4, 4]);
  put({ k: "gazebo", x: -4.4, y: 9.6, w: 2.8, d: 2.8, s: 0, tg: { kind: "board" } });
  for (const [x, y] of [[-5.5, 8.5], [-0.5, 8.5], [-5.5, 13.5], [-0.5, 13.5]]) tree(x, y, `bd${x}${y}`, false);
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
  // the observatory (back) and the avenue of discoveries, while the journal is on
  if (!off.has("journal")) {
    paving.push([-6, -2, 6, 1], [-2, -6, 1, 5]);
    put({ k: "observatory", x: -5.6, y: -5.6, w: 3, d: 3, s: 0, tg: { kind: "observatory" } });
    const spots: [number, number][] = [];
    for (let y = -5.5; y <= -0.5; y++) spots.push([-1.5, y]);
    for (let x = -2.5; x >= -5.5; x--) spots.push([x, -1.5]);
    const shown = Math.min(t.discoveries, spots.length);
    for (let i = 0; i < shown; i++) {
      const more = i === shown - 1 && t.discoveries > spots.length;
      put({ k: "obelisk", x: spots[i][0] - 0.2, y: spots[i][1] - 0.2, w: 0.4, d: 0.4, s: more ? 2 : 1, n: more ? t.discoveries : i + 1, tg: { kind: "obelisk", n: more ? t.discoveries : i + 1 } });
    }
  } else for (const [x, y] of [[-5, -5], [-3.5, -4.5], [-4.5, -2.5], [-2, -5], [-2, -2], [-5.2, -1.4]]) tree(x, y, `ob${x}${y}`);
  // the park with its pond (front right)
  water.push([9.2, 1.6, 3, 2.4]);
  for (const [x, y] of [[8.6, 5.4], [12.8, 5.2], [13, 1.4], [10.5, 5.6]]) tree(x, y, `pk${x}${y}`);
  put({ k: "bench", x: 9.6, y: 4.6, w: 1, d: 0.35, s: 0, tg: { kind: "park" } });
  // the trailhead grove (front left): a loop path with lanterns that hikers walk
  const loop: [number, number][] = [[2.5, 9.5], [5.5, 9.5], [5.5, 12.5], [2.5, 12.5]];
  for (let x = 1; x <= 6; x++) for (let y = 8; y <= 13; y++) {
    const onPath = (y === 9 || y === 12) && x >= 2 && x <= 5 || (x === 2 || x === 5) && y >= 9 && y <= 12;
    if (!onPath && h01(`tr${x},${y}`) < 0.75) tree(x + 0.5, y + 0.5, `tr${x},${y}`, h01(`tp${x},${y}`) < 0.7);
  }
  for (const [x, y] of loop) put({ k: "lantern", x: x - 0.1, y: y - 0.1, w: 0.2, d: 0.2, s: 0, tg: { kind: "trail" } });
  // the forest around it all, thinning toward the edge
  for (let x = lo; x <= hi; x++) for (let y = lo; y <= hi; y++) {
    if (x >= tlo && x <= thi && y >= tlo && y <= thi) continue;
    const edge = Math.min(x - lo, hi - x, y - lo, hi - y);
    if (h01(`f${x},${y}`) < 0.22 + edge * 0.07) tree(x + 0.5, y + 0.5, `f${x},${y}`, h01(`fp${x},${y}`) < 0.65);
  }
  // painter's order: back to front by the middle of each footprint
  objs.sort((a, b) => a.x + a.w / 2 + a.y + a.d / 2 - (b.x + b.w / 2 + b.y + b.d / 2) || a.x - b.x);
  return { R, lo, hi, tlo, thi, objs, water, paving, stalls, gateY: thi + 0.5, loop };
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
  tapped: undefined as Target | undefined, pinched: false, flakes: [] as [number, number, number][],
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
const acc = () => `rgb(${S.accent.map((v) => v | 0).join(",")})`;
function hit(pts: [number, number][], tg?: Target) {
  if (!tg) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  S.hits.push({ x0, y0, x1, y1, tg });
}

function drawHouse(o: Obj, t: number) {
  const p = S.pal, hv = o.h!, r = rng(o.s), night = S.o!.dark;
  const { x, y, w, d } = o;
  const h = 6 + hv.storeys * 8, roofC = toHex(p.roofs[Math.floor(r() * 5)]), shape = Math.floor(r() * 3), chim = r() < 0.6;
  const agent = hv.agent;
  const wallL = agent ? shade(p.wall, 0.04) : p.wall, wallR = p.wallR;
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
  if (agent) {
    // a workshop: flat roof, a glass panel, an antenna that blinks
    poly(flat(x, y, w, d, h), shade(p.wall, 0.08));
    poly(flat(x + w * 0.2, y + d * 0.2, w * 0.45, d * 0.5, h + 0.5), night ? "#3d5a7a" : "#cfe6f4");
    const [ax, ay] = P(x + w * 0.8, y + d * 0.3, h);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - 10); ctx.stroke();
    const on = S.still || Math.sin(t * 2.4 + o.s) > 0;
    ctx.fillStyle = on ? `rgb(${skyColours("agents")[0].map((v) => v | 0).join(",")})` : p.line;
    ctx.beginPath(); ctx.arc(ax, ay - 11, 1.8, 0, 6.283); ctx.fill();
    top = h + 12;
  } else {
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
  if (o.mine) {
    ctx.restore();
    // a pennant above your house
    const [px, py] = P(x + w / 2, y + d / 2, top + 4), bob = S.still ? 0 : Math.sin(t * 2) * 1.5;
    ctx.beginPath(); ctx.moveTo(px, py + 6); ctx.lineTo(px, py - 10 + bob); ctx.stroke();
    poly([[px, py - 10 + bob], [px + 9, py - 7 + bob], [px, py - 4 + bob]], acc());
    label("You", px, py - 16 + bob, acc());
  }
  hit([P(x, y, 0), P(x + w, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w / 2, y + d / 2, top)], o.tg);
}
function label(text: string, x: number, y: number, color: string) {
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  const tw = ctx.measureText(text).width;
  ctx.save(); ctx.lineWidth = line;
  ctx.fillStyle = S.o!.dark ? "rgba(20,24,34,.88)" : "rgba(255,255,255,.94)";
  ctx.beginPath(); ctx.roundRect(x - tw / 2 - 5, y - 9, tw + 10, 14, 7); ctx.fill(); ctx.strokeStyle = color; ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(text, x, y + 1.5); ctx.restore();
}
function drawTree(o: Obj) {
  const p = S.pal, [bx, by] = P(o.x + o.w / 2, o.y + o.d / 2), r = rng(o.s), sc = 0.8 + r() * 0.45;
  ctx.fillStyle = "rgba(0,0,0,.06)"; ctx.beginPath(); ctx.ellipse(bx, by, 6 * sc, 3 * sc, 0, 0, 6.283); ctx.fill();
  if (o.k === "pine") {
    const hgt = 22 * sc, wd = 7 * sc;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 4); ctx.stroke();
    poly([[bx - wd, by - 4], [bx + wd, by - 4], [bx, by - hgt * 0.62]], p.pine);
    poly([[bx - wd * 0.78, by - hgt * 0.42], [bx + wd * 0.78, by - hgt * 0.42], [bx, by - hgt]], p.pine);
  } else {
    const c = p.leaf[Math.floor(r() * p.leaf.length)], rad = 6.5 * sc;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 6 * sc); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(bx, by - 6 * sc - rad, rad * 0.95, rad * 1.08, 0, 0, 6.283); ctx.fillStyle = c; ctx.fill(); ctx.stroke();
    if (S.sea.name === "spring" && r() < 0.6) { ctx.fillStyle = "#fff4f7"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(bx + (r() - 0.5) * rad, by - 6 * sc - rad + (r() - 0.5) * rad, 1, 0, 6.283); ctx.fill(); } }
  }
}
function drawPerson(x: number, y: number, c: string, t: number, walking: boolean) {
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
    case "tree": case "pine": return drawTree(o);
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
    case "observatory": {
      const { x, y, w, d } = o, h = 18, cx = x + w / 2, cy = y + d / 2, [sx, sy] = P(cx, cy, h);
      box(x, y, w, d, h, p.wall, p.wallR, shade(p.wall, 0.04));
      for (const f of ["y", "x"] as const) for (let i = 0; i < 3; i++) onFace(f, x, y, w, d, 0.4 + i, 0.6 + i, 7, 13, night ? p.lit : p.win);
      // the dome glows while work is under review
      const reviewing = data.underReview > 0, glow = reviewing ? 0.5 + (S.still ? 0.3 : 0.3 * Math.sin(t * 1.5)) : 0;
      if (glow) { const g = ctx.createRadialGradient(sx, sy - 10, 0, sx, sy - 10, 42); g.addColorStop(0, rgba(S.accent, glow * 0.45)); g.addColorStop(1, rgba(S.accent, 0)); ctx.fillStyle = g; ctx.fillRect(sx - 42, sy - 52, 84, 84); }
      ctx.beginPath(); ctx.ellipse(sx, sy, 30, 15, 0, Math.PI, 0); ctx.bezierCurveTo(sx + 30, sy - 32, sx - 30, sy - 32, sx - 30, sy); ctx.closePath();
      ctx.fillStyle = night ? "#5c6680" : "#e9edf3"; ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(sx, sy - 18); ctx.rotate(-0.5); ctx.fillStyle = night ? "#20263a" : "#56607a"; ctx.fillRect(-3, -9, 6, 12); ctx.restore();
      return hit([P(x, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x + w, y, 0), [sx, sy - 32]], o.tg);
    }
    case "obelisk": {
      // a plinth, a slim shaft, a pointed cap with a light in the accent
      const big = o.s === 2, h = big ? 30 : 20, { x, y, w, d } = o, c = night ? "#6e7896" : "#e6e9ef", m = big ? 0.1 : 0.13;
      box(x - 0.04, y - 0.04, w + 0.08, d + 0.08, 3, shade(c, 0.04), shade(c, 0.12), c);
      box(x + m, y + m, w - 2 * m, d - 2 * m, h - 4, c, shade(c, 0.1), undefined, 3);
      const ap = P(x + w / 2, y + d / 2, h + 3);
      poly([P(x + m, y + d - m, h - 1), P(x + w - m, y + d - m, h - 1), ap], c); poly([P(x + w - m, y + m, h - 1), P(x + w - m, y + d - m, h - 1), ap], shade(c, 0.1));
      ctx.fillStyle = rgba(S.accent, 0.9); ctx.beginPath(); ctx.arc(ap[0], ap[1] - 2, big ? 2.4 : 1.7, 0, 6.283); ctx.fill();
      return hit([P(x, y, 0), P(x + w, y + d, 0), [ap[0] - 6, ap[1] - 4], [ap[0] + 6, ap[1]]], o.tg);
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

/** The ground: a slab with the town's roads, paving and ponds, and a faint tile grid. */
function drawGround() {
  const pl = S.plan!, p = S.pal, { lo, hi, tlo, thi } = pl, n = hi + 1;
  // the slab's two front edges
  poly([P(lo, n), P(n, n), P(n, n, -7), P(lo, n, -7)], p.edge);
  poly([P(n, lo), P(n, n), P(n, n, -7), P(n, lo, -7)], shade(toHex(p.edge.startsWith("#") ? p.edge : "#dcdfe4"), 0.06));
  poly([P(lo, lo), P(n, lo), P(n, n), P(lo, n)], p.ground);
  ctx.save(); ctx.lineWidth = line * 0.7; ctx.strokeStyle = p.grid;
  ctx.beginPath();
  for (let i = lo; i <= n; i++) { let a = P(i, lo), b = P(i, n); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); a = P(lo, i); b = P(n, i); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.strokeStyle = shade(toHex(p.road.startsWith("#") ? p.road : "#e2e3e6"), 0.08); ctx.lineWidth = line * 0.7;
  for (let v = tlo; v <= thi; v += 7) { poly(flat(v, tlo, 1, thi - tlo + 1), p.road); poly(flat(tlo, v, thi - tlo + 1, 1), p.road); }
  ctx.restore();
  for (const [x, y, w, d] of pl.paving) poly(flat(x, y, w, d), p.pave, false);
  ctx.save(); ctx.strokeStyle = S.o!.dark ? "#4a5a70" : "#b9cfdb"; ctx.lineWidth = line * 0.8;
  for (const [x, y, w, d] of pl.water) { const [cx, cy] = P(x + w / 2, y + d / 2); ctx.beginPath(); ctx.ellipse(cx, cy, (w + d) * 7.6, (w + d) * 3.8, 0, 0, 6.283); ctx.fillStyle = p.water; ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // the trail loop through the grove
  ctx.save(); ctx.strokeStyle = S.o!.dark ? "#3a4252" : "#e3dccb"; ctx.lineWidth = 5; ctx.lineJoin = "round";
  ctx.beginPath(); pl.loop.forEach(([x, y], i) => { const [sx, sy] = P(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath(); ctx.stroke(); ctx.restore();
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
      S.walkers.push({ ch, me, path: [[7.5, pl.gateY], [7.5, 10.5], [8.6, 10.5], home], i: 0, u: 0, speed: 1.1 + Math.random() * 0.5, state: fresh ? "stay" : "in", home, wob: Math.random() * 6, c: Math.floor(Math.random() * 5) });
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
  drawGround();
  // what's on screen, with a margin for tall things
  const vx0 = cam.x - w / 2 / cam.z - 60, vx1 = cam.x + w / 2 / cam.z + 60, vy0 = cam.y - h / 2 / cam.z - 20, vy1 = cam.y + h / 2 / cam.z + 80;
  const live: { k: number; draw: () => void }[] = [];
  for (const wk of S.walkers) { const [x, y] = walkerAt(wk); live.push({ k: x + y, draw: () => { drawPerson(x, y, wk.me ? acc() : S.pal.person[wk.c], t, wk.state !== "stay"); const [px, py] = P(x, y); hit([[px - 4, py - 12], [px + 4, py + 2]], (wk.tg ??= { kind: "walker", channel: wk.ch, me: wk.me })); } }); }
  for (const hk of S.hikers) { const [x, y] = loopAt(hk.u); live.push({ k: x + y, draw: () => drawPerson(x, y, S.pal.person[hk.c], t, true) }); }
  live.sort((a, b) => a.k - b.k);
  let li = 0;
  for (const o of S.plan.objs) {
    const k = o.x + o.w / 2 + o.y + o.d / 2;
    while (li < live.length && live[li].k < k) live[li++].draw();
    const [sx, sy] = P(o.x + o.w / 2, o.y + o.d / 2);
    if (sx < vx0 || sx > vx1 || sy < vy0 || sy > vy1) continue;
    drawObj(o, t);
  }
  while (li < live.length) live[li++].draw();
  // speech bubbles over the stalls, at the channel's pace (sped up), and a cloud when it rained lately
  if (!S.still) bubbles(t);
  if (S.data!.lastRain && Date.now() - S.data!.lastRain < 3600e3 && !S.still) rainCloud(t);
  if (S.hover && S.o.mode === "full") outlineHover();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!S.still) weather(dt);
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
const clampZ = (z: number) => Math.max(0.35, Math.min(2.5, z));
function home() {
  const b = worldBox(), pl = S.plan!;
  if (S.o!.mode === "preview") {
    // the civic centre, a little closer
    const [cx, cy] = P(6.5, 6.5);
    S.camHome = [cx, cy];
    S.cam = { x: cx, y: cy, z: clampZ(Math.min(S.w / 640, S.h / 300)) };
    return;
  }
  // the town without most of the forest
  const span = (pl.thi - pl.tlo + 4) * TW;
  S.fit = clampZ(Math.min(S.w / span, S.h / (span / 2)) * 1.35);
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
  const sig = JSON.stringify([o.data.houses, o.data.mine, o.data.off, o.data.channels.map((c) => c.name), o.data.listings, o.data.discoveries]);
  if (sig !== S.sig || !S.plan) { S.plan = layoutTown(o.data); S.sig = sig; }
  S.data = o.data;
  syncWalkers();
  size();
  if (S.camMode !== o.mode) { S.camMode = o.mode; home(); }
  start();
  if (fresh) frame(performance.now());
}
