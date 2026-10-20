// Lab's living skies: one engine, two intensities.
//
// - notes: an open notebook's empty view. Every note is a star and every [[link]] a line, laid out
//   by a small force simulation so related notes gather; the most-linked shine brightest; a new note
//   is born with a wave along its own links. Hover a star for its title; click it to open the note.
// - bands: a still slice of sky in a kit's colours across the top of its tab (paintBand).
//
// Only one sky animates at a time (~30 fps, paused while the page is hidden); people who ask for
// reduced motion get still frames. Low contrast under text, in light and dark themes.

export type RGB = [number, number, number];
type Star = { x: number; y: number; vx: number; vy: number; z: number; r: number; tw: number; ph: number; ax?: number; ay?: number };
type Pulse = { from: number; at: number; edges: [number, number, number][] };
export type SkyGraph = { nodes: { id: string; label: string; degree: number }[]; edges: { source: string; target: string }[] };
export type SkyOpts = { key: string; graph?: SkyGraph; dark: boolean; accent: string; onOpen?: (id: string) => void };

/** The notes sky's two aurora colours. */
const NOTES_SKY: [string, string] = ["#818cf8", "#22d3ee"];
/** Each kit's band. */
export const KIT_SKIES: Record<string, [string, string]> = {
  study: ["#a78bfa", "#818cf8"], work: ["#60a5fa", "#2dd4bf"], organize: ["#94a3b8", "#22d3ee"], research: ["#818cf8", "#38bdf8"],
  writing: ["#fb7185", "#a78bfa"], care: ["#f472b6", "#fb7185"], software: ["#22d3ee", "#4ade80"], career: ["#2dd4bf", "#38bdf8"],
  crypto: ["#f5c542", "#34d399"], money: ["#34d399", "#a3e635"], creator: ["#f472b6", "#fb923c"], fitness: ["#fb7185", "#fbbf24"],
  home: ["#fbbf24", "#2dd4bf"], trips: ["#4ade80", "#38bdf8"],
};
export const hex = (h: string): RGB => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h.trim()); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [110, 124, 255]; };
export const hashOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
export const rng = (seed: number) => { let r = seed | 1; return () => ((r = Math.imul(r ^ (r >>> 15), 2246822519) ^ Math.imul(r ^ (r >>> 13), 3266489917)) >>> 0) / 4294967296; };
export const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A notes graph laid out in the unit square: repulsion between every pair, springs along links,
 *  a pull to the centre. Positions from `prev` stay put (a new note settles near its links). */
export function layoutGraph(ids: string[], edges: [number, number][], prev = new Map<string, [number, number]>(), iters?: number): [number, number][] {
  const n = ids.length;
  if (!n) return [];
  const adj: number[][] = ids.map(() => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  const fresh = ids.filter((id) => !prev.has(id)).length;
  const pos: [number, number][] = ids.map((id, i) => {
    const p = prev.get(id);
    if (p) return [p[0], p[1]];
    const r = rng(hashOf(id));
    const nb = adj[i].map((j) => prev.get(ids[j])).find(Boolean);
    return nb ? [nb[0] + (r() - 0.5) * 0.08, nb[1] + (r() - 0.5) * 0.08] : [0.1 + r() * 0.8, 0.1 + r() * 0.8];
  });
  const full = fresh > n * 0.3;
  const steps = iters ?? (full ? 140 : 40);
  const k = 0.75 * Math.sqrt(1 / n);
  let temp = full ? 0.1 : 0.025;
  for (let it = 0; it < steps; it++) {
    const disp = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
      let d = Math.hypot(dx, dy);
      if (d < 1e-4) { dx = 1e-3 * (i - j); dy = 1e-3; d = 1.5e-3; }
      const f = (k * k) / d;
      disp[i][0] += (dx / d) * f; disp[i][1] += (dy / d) * f; disp[j][0] -= (dx / d) * f; disp[j][1] -= (dy / d) * f;
    }
    for (const [a, b] of edges) {
      const dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1], d = Math.hypot(dx, dy) || 1e-3, f = (d * d) / k;
      disp[a][0] -= (dx / d) * f; disp[a][1] -= (dy / d) * f; disp[b][0] += (dx / d) * f; disp[b][1] += (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      disp[i][0] += (0.5 - pos[i][0]) * 0.6 * k; disp[i][1] += (0.5 - pos[i][1]) * 0.6 * k;
      const d = Math.hypot(disp[i][0], disp[i][1]) || 1;
      pos[i][0] += (disp[i][0] / d) * Math.min(d, temp); pos[i][1] += (disp[i][1] / d) * Math.min(d, temp);
    }
    temp *= 0.97;
  }
  // fit the constellation inside the frame, keeping its shape
  const xs = pos.map((p) => p[0]), ys = pos.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = 0.8 / Math.max(x1 - x0, y1 - y0, 0.2);
  return pos.map(([x, y]) => [0.5 + (x - (x0 + x1) / 2) * s, 0.5 + (y - (y0 + y1) / 2) * s]);
}

const S = {
  canvas: undefined as HTMLCanvasElement | undefined,
  ctx: undefined as CanvasRenderingContext2D | undefined,
  w: 0, h: 0, dpr: 1,
  key: "",
  stars: [] as Star[],
  // notes mode: what each star is
  ids: [] as string[], labels: [] as string[], deg: [] as number[], adj: [] as number[][], edges: [] as [number, number][], sig: "",
  anchors: new Map<string, [number, number]>(), known: new Set<string>(),
  hover: -1, onOpen: undefined as ((id: string) => void) | undefined,
  from: [hex("#6d7cff"), hex("#b46cff")] as [RGB, RGB], to: [hex("#6d7cff"), hex("#b46cff")] as [RGB, RGB], fadeAt: 0,
  dark: true, accent: hex("#6d7cff"),
  pointer: { x: 0.5, y: 0.5, on: false, sx: 0.5, sy: 0.5 },
  pulses: [] as Pulse[],
  raf: 0, last: 0, t0: performance.now(),
  still: still(),
  ro: undefined as ResizeObserver | undefined,
};

const fieldSize = () => Math.round(Math.max(44, Math.min(110, (S.w * S.h) / 7500)));
function seedField() {
  S.stars = field(fieldSize(), [0.35, 0.65, 1]);
  S.ids = []; S.labels = []; S.deg = []; S.adj = []; S.edges = [];
}
/** Drifting stars on the given depths. */
function field(n: number, depths: number[]): Star[] {
  const rnd = rng(0x2545f491);
  return Array.from({ length: n }, () => { const z = depths[Math.floor(rnd() * depths.length)]; return { x: rnd(), y: rnd(), vx: (rnd() - 0.5) * 0.006 * z, vy: (rnd() - 0.5) * 0.004 * z, z, r: (0.6 + rnd() * 1.1) * (0.6 + z * 0.6), tw: 0.6 + rnd() * 1.6, ph: rnd() * 6.28 }; });
}
/** Stars from the notes graph (the 240 most linked when there are more). */
function seedNotes(g: SkyGraph) {
  const nodes = [...g.nodes].sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id)).slice(0, 240);
  const at = new Map(nodes.map((n, i) => [n.id, i]));
  const edges: [number, number][] = [];
  for (const e of g.edges) { const a = at.get(e.source), b = at.get(e.target); if (a !== undefined && b !== undefined && a !== b) edges.push([a, b]); }
  const ids = nodes.map((n) => n.id);
  const pos = layoutGraph(ids, edges, S.anchors);
  S.anchors = new Map(ids.map((id, i) => [id, pos[i]]));
  S.ids = ids; S.labels = nodes.map((n) => n.label); S.deg = nodes.map((n) => n.degree); S.edges = edges;
  S.adj = ids.map(() => []);
  for (const [a, b] of edges) { S.adj[a].push(b); S.adj[b].push(a); }
  S.stars = nodes.map((n, i) => { const r = rng(hashOf(n.id)); return { x: pos[i][0], y: pos[i][1], ax: pos[i][0], ay: pos[i][1], vx: 0, vy: 0, z: 1, r: 1.1 + Math.min(3.2, Math.sqrt(n.degree) * 0.75), tw: 0.5 + r() * 1.2, ph: r() * 6.28 }; });
  // a faint far field behind the notes, so a young notebook's sky is not bare
  S.stars.push(...field(Math.max(24, fieldSize() - nodes.length), [0.2, 0.35]));
}
function size() {
  const c = S.canvas!;
  const box = c.getBoundingClientRect();
  S.dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  if (w === S.w && h === S.h && c.width === Math.round(w * S.dpr)) return;
  S.w = w; S.h = h;
  c.width = Math.round(w * S.dpr); c.height = Math.round(h * S.dpr);
  if (S.still) frame(performance.now());
}
/** Where star `st` is on screen now, with its depth's lean toward the pointer. */
function pos(st: Star): [number, number] {
  const lean = 7 * st.z;
  return [st.x * S.w + (S.pointer.sx - 0.5) * lean, st.y * S.h + (S.pointer.sy - 0.5) * lean];
}
function frame(now: number) {
  const ctx = S.ctx!, w = S.w, h = S.h, t = (now - S.t0) / 1000, dt = Math.min(0.1, (now - (S.last || now)) / 1000);
  S.last = now;
  const moving = !S.still;
  ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const fade = Math.min(1, (now - S.fadeAt) / 1400);
  const [c1, c2] = [mix(S.from[0], S.to[0], fade), mix(S.from[1], S.to[1], fade)];
  const dark = S.dark, k = dark ? 1 : 0.55;
  // the aurora: three soft lights on slow Lissajous paths
  ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
  const blobs: [RGB, number, number, number, number][] = [[c1, 0.22, 0.13, 0.07, 0.62], [c2, 0.17, 0.11, 0.05, 0.55], [mix(c1, S.accent, 0.5), 0.12, 0.09, 0.11, 0.48]];
  blobs.forEach(([col, a, fx, fy, rad], i) => {
    const x = w * (0.5 + 0.38 * Math.sin(t * fx + i * 2.1)), y = h * (0.5 + 0.34 * Math.cos(t * fy + i * 1.3));
    const r = Math.max(w, h) * rad;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a * k * 0.8)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  ctx.globalCompositeOperation = "source-over";
  // stars breathe around their place in the graph; the far field drifts and wraps
  if (moving) for (const st of S.stars) {
    if (st.ax !== undefined) { st.x = st.ax + 0.004 * Math.sin(t * st.tw * 0.5 + st.ph); st.y = st.ay! + 0.004 * Math.cos(t * st.tw * 0.4 + st.ph); }
    else { st.x = (st.x + st.vx * dt + 1) % 1; st.y = (st.y + st.vy * dt + 1) % 1; }
  }
  S.pointer.sx += (S.pointer.x - S.pointer.sx) * Math.min(1, dt * 3);
  S.pointer.sy += (S.pointer.y - S.pointer.sy) * Math.min(1, dt * 3);
  const P = S.stars.map(pos);
  const ink: RGB = dark ? [225, 230, 255] : [40, 48, 90];
  ctx.lineWidth = 1;
  // the real links, the hovered note\'s brighter
    for (const [a, b] of S.edges) {
      const hot = a === S.hover || b === S.hover;
      ctx.strokeStyle = rgba(mix(ink, hot ? c2 : c1, hot ? 0.6 : 0.45), (hot ? 0.55 : 0.2) * k);
      ctx.lineWidth = hot ? 1.4 : 1;
      ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke();
    }
  ctx.lineWidth = 1;
  // waves of light: a new note along its links
  const lit = new Map<number, number>();
  S.pulses = S.pulses.filter((p) => t - p.at < 3.2);
  for (const p of S.pulses) {
    const age = t - p.at, life = 1 - age / 3.2;
    const [ox, oy] = P[p.from] ?? [w / 2, h / 2];
    ctx.strokeStyle = rgba(c2, 0.35 * life * k); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ox, oy, age * 160, 0, 6.283); ctx.stroke();
    ctx.lineWidth = 1.6;
    for (const [a, b, hop] of p.edges) {
      const u = (age - hop * 0.17) / 0.32;
      if (u <= 0 || !P[a] || !P[b]) continue;
      const e = Math.min(1, u), [ax, ay] = P[a], [bx, by] = P[b];
      const g = ctx.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, rgba(c1, 0)); g.addColorStop(Math.max(0.01, e), rgba(mix(c2, [255, 255, 255], 0.35), 0.75 * life * k)); g.addColorStop(Math.min(1, e + 0.01), rgba(c2, 0));
      ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * e, ay + (by - ay) * e); ctx.stroke();
      if (u >= 1) lit.set(b, Math.max(lit.get(b) ?? 0, life));
    }
    lit.set(p.from, Math.max(lit.get(p.from) ?? 0, life));
  }
  ctx.lineWidth = 1;
  // the stars: the most linked notes brightest
  const hub = Math.max(3, ...S.deg) * 0.6;
  S.stars.forEach((st, i) => {
    const [x, y] = P[i];
    const tw = moving ? 0.55 + 0.45 * Math.sin(t * st.tw + st.ph) : 0.8;
    const glow = lit.get(i) ?? 0, bright = (S.deg[i] ?? 0) >= hub || i === S.hover;
    const r = st.r + glow * 2.4 + (i === S.hover ? 1.5 : 0);
    if (bright || glow > 0) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
      halo.addColorStop(0, rgba(bright ? S.accent : c2, (0.3 + glow * 0.4) * k)); halo.addColorStop(1, rgba(c2, 0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 7, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = rgba(bright ? mix(ink, S.accent, 0.25) : mix(ink, c1, 0.15), (0.42 + 0.5 * st.z) * tw * k + glow * 0.6 + (bright ? 0.3 : 0));
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  });
  // the hovered note's title
  if (S.hover >= 0 && P[S.hover]) {
    const [x, y] = P[S.hover], label = S.labels[S.hover] ?? "";
    ctx.font = "600 12px system-ui, -apple-system, sans-serif";
    const tw = ctx.measureText(label).width, bx = Math.min(w - tw - 18, Math.max(6, x + 10)), by = Math.max(6, y - 28);
    ctx.fillStyle = dark ? "rgba(20,22,34,.85)" : "rgba(255,255,255,.92)";
    ctx.beginPath(); ctx.roundRect(bx, by, tw + 12, 20, 6); ctx.fill();
    ctx.fillStyle = dark ? "#e8eaf6" : "#1f2440"; ctx.fillText(label, bx + 6, by + 14);
  }
}
function loop(now: number) {
  S.raf = 0;
  if (!S.canvas?.isConnected) return;
  if (!document.hidden && now - S.last >= 32) frame(now);
  S.raf = requestAnimationFrame(loop);
}
function start() {
  if (S.still) { frame(performance.now()); return; }
  if (!S.raf) S.raf = requestAnimationFrame(loop);
}

/** Any CSS colour (oklch, color-mix, a variable's value) as RGB, by letting the browser paint it. */
function cssRgb(css: string): RGB | undefined {
  const c = document.createElement("canvas"); c.width = c.height = 1;
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x || !css) return undefined;
  x.fillStyle = "#000"; x.fillStyle = css; x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}
const accentCache = new Map<string, RGB>();
export const accentOf = (css: string) => { if (!accentCache.has(css)) accentCache.set(css, cssRgb(css) ?? hex("#6d7cff")); return accentCache.get(css)!; };

/** Put the sky on `canvas` (again after a re-render: the stars and waves carry on). `key` is the
 *  notebook and `graph` its notes; notes that were not there last time are born with a wave. */
export function attachSky(canvas: HTMLCanvasElement, o: SkyOpts) {
  const fresh = S.canvas !== canvas;
  if (fresh) {
    S.canvas = canvas;
    S.ctx = canvas.getContext("2d") ?? undefined;
    if (!S.ctx) return;
    S.ro?.disconnect();
    S.ro = new ResizeObserver(() => size());
    S.ro.observe(canvas);
    const host = canvas.parentElement!;
    host.addEventListener("pointermove", (e) => {
      const b = canvas.getBoundingClientRect();
      S.pointer.x = (e.clientX - b.left) / b.width; S.pointer.y = (e.clientY - b.top) / b.height; S.pointer.on = e.pointerType === "mouse";
      // the nearest star within reach is the hovered note (not over the view's own buttons and text)
      const over = (e.target as HTMLElement).closest("button, a, input, textarea, form, .hints, h2, h3, p");
      let best = -1, bd = 14;
      if (!over) S.stars.slice(0, S.ids.length).forEach((st, i) => { const [x, y] = pos(st); const d = Math.hypot(x - (e.clientX - b.left), y - (e.clientY - b.top)); if (d < bd) { bd = d; best = i; } });
      if (best !== S.hover) { S.hover = best; host.style.cursor = best >= 0 ? "pointer" : ""; if (S.still) frame(performance.now()); }
    });
    host.addEventListener("pointerleave", () => { S.pointer.on = false; S.pointer.x = S.pointer.y = 0.5; S.hover = -1; host.style.cursor = ""; });
    host.addEventListener("click", (e) => { if (S.hover >= 0 && !(e.target as HTMLElement).closest("button, a, input, textarea, form")) S.onOpen?.(S.ids[S.hover]); });
  }
  S.dark = o.dark;
  S.accent = accentOf(o.accent);
  S.onOpen = o.onOpen;
  const switched = o.key !== S.key;
  if (switched) {
    const now = performance.now(), fade = Math.min(1, (now - S.fadeAt) / 1400);
    S.from = [mix(S.from[0], S.to[0], fade), mix(S.from[1], S.to[1], fade)];
    S.to = [mix(hex(NOTES_SKY[0]), S.accent, 0.35), hex(NOTES_SKY[1])];
    if (!S.key) S.from = S.to;
    S.anchors = new Map(); S.known = new Set(); S.sig = "";
    S.key = o.key; S.fadeAt = now; S.pulses = []; S.hover = -1;
  }
  size();
  if (o.graph) {
    const sig = `${o.graph.nodes.map((n) => n.id).join("\u0000")}|${o.graph.edges.length}`;
    if (sig !== S.sig) {
      const before = S.known;
      seedNotes(o.graph);
      S.sig = sig;
      S.known = new Set(S.ids);
      // the notes that are new since the last look are born with a wave
      if (before.size) for (const id of S.ids.filter((x) => !before.has(x)).slice(0, 3)) skyPulse(id);
    }
    if (!S.ids.length) seedField();
  }
  start();
  // a re-render hands over a blank canvas: paint it now rather than at the next tick
  if (fresh || switched) frame(performance.now());
}

/** A wave of light from a note's star along its links, six hops out. */
export function skyPulse(from: string) {
  if (S.still || !S.stars.length) return;
  const origin = S.ids.indexOf(from);
  if (origin < 0) return;
  const P = S.stars.map(pos);
  const near = (a: number) => S.adj[a] ?? [];
  const seen = new Set([origin]), edges: [number, number, number][] = [];
  let ring = [origin];
  for (let h = 1; h <= 6 && ring.length; h++) {
    const next: number[] = [];
    for (const a of ring) for (const b of near(a)) if (!seen.has(b)) { seen.add(b); edges.push([a, b, h - 1]); next.push(b); }
    ring = next;
  }
  S.pulses.push({ from: origin, at: (performance.now() - S.t0) / 1000, edges });
  if (S.pulses.length > 4) S.pulses.shift();
}

/** A still slice of sky across the top of a kit's tab, in its colours (painted once per size). */
export function paintBand(canvas: HTMLCanvasElement, kit: string, dark: boolean, accent: string) {
  const box = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  const key = `${kit}:${w}x${h}:${dark}`;
  if (canvas.dataset.painted === key) return;
  canvas.dataset.painted = key;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const [c1, c2] = (KIT_SKIES[kit] ?? ["#6d7cff", "#b46cff"]).map(hex) as [RGB, RGB];
  const acc = accentOf(accent), k = dark ? 1 : 0.6, ink: RGB = dark ? [225, 230, 255] : [40, 48, 90];
  ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
  for (const [col, x, y, rad, a] of [[c1, 0.18, 0.3, 0.55, 0.32], [c2, 0.7, 0.75, 0.5, 0.26], [mix(c1, acc, 0.5), 0.95, 0.1, 0.4, 0.18]] as [RGB, number, number, number, number][]) {
    const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, Math.max(w, h) * rad);
    g.addColorStop(0, rgba(col, a * k)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = "source-over";
  const rnd = rng(hashOf(kit) || 7), n = Math.round(Math.max(18, (w * h) / 2600));
  const P = Array.from({ length: n }, () => [rnd() * w, rnd() * h, 0.5 + rnd() * 1.4, rnd()] as const);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
    if (d < 90) { ctx.strokeStyle = rgba(mix(ink, c1, 0.4), (1 - d / 90) * 0.24 * k); ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke(); }
  }
  for (const [x, y, r, b] of P) { ctx.fillStyle = rgba(mix(ink, c2, 0.2), (0.35 + b * 0.5) * k); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
}
