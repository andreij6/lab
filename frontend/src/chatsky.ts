// The community chat's living background: a constellation behind the messages. Stars drift on
// three depths and lean toward the pointer; near ones are linked like notes in the graph; an aurora
// in the channel's own colours moves behind them. People online are the bright stars, and every new
// message sends a wave of light out along the links from its author's star. Low contrast under
// text, light and dark themes, ~30 fps, paused while hidden, one still frame for reduced motion.

type RGB = [number, number, number];
type Star = { x: number; y: number; vx: number; vy: number; z: number; r: number; tw: number; ph: number };
type Pulse = { from: number; at: number; hop: Map<number, number>; edges: [number, number, number][] };

/** Each channel's sky: two aurora colours. Others get a pair from their name. */
const SKIES: Record<string, [string, string]> = {
  general: ["#6d7cff", "#b46cff"], help: ["#38bdf8", "#5eead4"], careers: ["#2dd4bf", "#38bdf8"], crypto: ["#f5c542", "#34d399"],
  creators: ["#f472b6", "#fb923c"], notebooks: ["#818cf8", "#22d3ee"], study: ["#a78bfa", "#818cf8"], agents: ["#4ade80", "#22d3ee"],
  market: ["#fbbf24", "#f472b6"], developers: ["#fb923c", "#f43f5e"],
};
const hex = (h: string): RGB => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h.trim()); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [110, 124, 255]; };
const hashOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const hsl = (h: number, s: number, l: number): RGB => { const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0) * 255, f(8) * 255, f(4) * 255]; };
/** The two aurora colours of `channel`, known or derived from its name. */
export function skyColours(channel: string): [RGB, RGB] {
  const known = SKIES[channel];
  if (known) return [hex(known[0]), hex(known[1])];
  const h = hashOf(channel) % 360;
  return [hsl(h, 0.75, 0.62), hsl((h + 55) % 360, 0.75, 0.6)];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

const S = {
  canvas: undefined as HTMLCanvasElement | undefined,
  ctx: undefined as CanvasRenderingContext2D | undefined,
  w: 0, h: 0, dpr: 1,
  stars: [] as Star[],
  people: new Map<string, number>(),
  channel: "", from: [hex("#6d7cff"), hex("#b46cff")] as [RGB, RGB], to: [hex("#6d7cff"), hex("#b46cff")] as [RGB, RGB], fadeAt: 0,
  dark: true, accent: hex("#6d7cff"),
  pointer: { x: 0.5, y: 0.5, on: false, sx: 0.5, sy: 0.5 },
  pulses: [] as Pulse[], comet: undefined as { x: number; y: number; dx: number; dy: number; at: number } | undefined, nextComet: 0,
  raf: 0, last: 0, t0: performance.now(),
  still: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  ro: undefined as ResizeObserver | undefined,
};
const LINK = 132;

function seed() {
  const n = Math.round(Math.max(44, Math.min(110, (S.w * S.h) / 7500)));
  let r = 0x2545f491;
  const rnd = () => ((r = Math.imul(r ^ (r >>> 15), 2246822519) ^ Math.imul(r ^ (r >>> 13), 3266489917)) >>> 0) / 4294967296;
  S.stars = Array.from({ length: n }, () => { const z = [0.35, 0.65, 1][Math.floor(rnd() * 3)]; return { x: rnd(), y: rnd(), vx: (rnd() - 0.5) * 0.006 * z, vy: (rnd() - 0.5) * 0.004 * z, z, r: (0.6 + rnd() * 1.1) * (0.6 + z * 0.6), tw: 0.6 + rnd() * 1.6, ph: rnd() * 6.28 }; });
}
function size() {
  const c = S.canvas!;
  const box = c.getBoundingClientRect();
  S.dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  if (w === S.w && h === S.h && c.width === Math.round(w * S.dpr)) return;
  const reseed = !S.stars.length || Math.abs(w * h - S.w * S.h) > S.w * S.h * 0.5;
  S.w = w; S.h = h;
  c.width = Math.round(w * S.dpr); c.height = Math.round(h * S.dpr);
  if (reseed) seed();
  if (S.still) frame(performance.now());
}
/** Where star `i` is on screen now, with its depth's lean toward the pointer. */
function pos(st: Star): [number, number] {
  const lean = 18 * st.z;
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
    g.addColorStop(0, rgba(col, a * k)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  ctx.globalCompositeOperation = "source-over";
  // the stars drift and wrap
  if (moving) for (const st of S.stars) { st.x = (st.x + st.vx * dt + 1) % 1; st.y = (st.y + st.vy * dt + 1) % 1; }
  S.pointer.sx += (S.pointer.x - S.pointer.sx) * Math.min(1, dt * 3);
  S.pointer.sy += (S.pointer.y - S.pointer.sy) * Math.min(1, dt * 3);
  const P = S.stars.map(pos);
  const ink: RGB = dark ? [225, 230, 255] : [40, 48, 90];
  // links: near stars on the same depth band or next to it, fainter with distance
  ctx.lineWidth = 1;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], d2 = dx * dx + dy * dy;
    if (d2 > LINK * LINK || Math.abs(S.stars[i].z - S.stars[j].z) > 0.35) continue;
    const a = (1 - Math.sqrt(d2) / LINK) * 0.22 * k * Math.min(S.stars[i].z, S.stars[j].z);
    ctx.strokeStyle = rgba(mix(ink, c1, 0.35), a);
    ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke();
  }
  // the pointer: a lantern that ties nearby stars to it
  if (S.pointer.on && moving) {
    const px = S.pointer.x * w, py = S.pointer.y * h;
    for (const [x, y] of P) { const d = Math.hypot(x - px, y - py); if (d < 150) { ctx.strokeStyle = rgba(mix(ink, c2, 0.5), (1 - d / 150) * 0.22 * k); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke(); } }
  }
  // waves of light from new messages
  const lit = new Map<number, number>();
  S.pulses = S.pulses.filter((p) => t - p.at < 3.2);
  for (const p of S.pulses) {
    const age = t - p.at, life = 1 - age / 3.2;
    const [ox, oy] = P[p.from] ?? [w / 2, h / 2];
    const ring = age * 160;
    ctx.strokeStyle = rgba(c2, 0.35 * life * k); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ox, oy, ring, 0, 6.283); ctx.stroke();
    ctx.lineWidth = 1.6;
    for (const [a, b, hop] of p.edges) {
      const u = (age - hop * 0.17) / 0.32;
      if (u <= 0) continue;
      const e = Math.min(1, u), [ax, ay] = P[a], [bx, by] = P[b];
      const g = ctx.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, rgba(c1, 0)); g.addColorStop(Math.max(0.01, e), rgba(mix(c2, [255, 255, 255], 0.35), 0.75 * life * k)); g.addColorStop(Math.min(1, e + 0.01), rgba(c2, 0));
      ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * e, ay + (by - ay) * e); ctx.stroke();
      if (u >= 1) lit.set(b, Math.max(lit.get(b) ?? 0, life));
    }
    lit.set(p.from, Math.max(lit.get(p.from) ?? 0, life));
  }
  ctx.lineWidth = 1;
  // the stars, people brightest
  const personOf = new Set(S.people.values());
  S.stars.forEach((st, i) => {
    const [x, y] = P[i];
    const tw = moving ? 0.55 + 0.45 * Math.sin(t * st.tw + st.ph) : 0.8;
    const glow = lit.get(i) ?? 0, person = personOf.has(i);
    const r = st.r * (person ? 2.1 : 1) + glow * 2.4;
    if (person || glow > 0) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
      halo.addColorStop(0, rgba(person ? S.accent : c2, (0.35 + glow * 0.4) * k)); halo.addColorStop(1, rgba(c2, 0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 7, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = rgba(person ? mix(ink, S.accent, 0.25) : mix(ink, c1, 0.15), (0.42 + 0.5 * st.z) * tw * k + glow * 0.6 + (person ? 0.3 : 0));
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  });
  // now and then, a shooting star
  if (moving) {
    if (!S.comet && t > S.nextComet) { S.comet = { x: 0.2 + Math.random() * 0.8, y: -0.05, dx: -(0.35 + Math.random() * 0.25), dy: 0.45 + Math.random() * 0.2, at: t }; S.nextComet = t + 16 + Math.random() * 22; }
    if (S.comet) {
      const c = S.comet, u = (t - c.at) / 1.1;
      if (u > 1) S.comet = undefined;
      else {
        const x = (c.x + c.dx * u) * w, y = (c.y + c.dy * u) * h, tx = x - c.dx * 0.12 * w, ty = y - c.dy * 0.12 * h;
        const g = ctx.createLinearGradient(tx, ty, x, y);
        g.addColorStop(0, rgba(c2, 0)); g.addColorStop(1, rgba([255, 255, 255], 0.7 * Math.sin(u * Math.PI) * k));
        ctx.strokeStyle = g; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); ctx.lineWidth = 1;
      }
    }
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

/** Put the sky on `canvas` (again after a re-render: the stars and waves carry on), for `channel`,
 *  with the principals online there as the bright stars. */
export function attachSky(canvas: HTMLCanvasElement, o: { channel: string; online: string[]; dark: boolean; accent: string }) {
  const fresh = S.canvas !== canvas;
  if (fresh) {
    S.canvas = canvas;
    S.ctx = canvas.getContext("2d") ?? undefined;
    if (!S.ctx) return;
    S.ro?.disconnect();
    S.ro = new ResizeObserver(() => size());
    S.ro.observe(canvas);
    const host = canvas.parentElement!;
    host.addEventListener("pointermove", (e) => { const b = canvas.getBoundingClientRect(); S.pointer.x = (e.clientX - b.left) / b.width; S.pointer.y = (e.clientY - b.top) / b.height; S.pointer.on = e.pointerType === "mouse"; });
    host.addEventListener("pointerleave", () => { S.pointer.on = false; S.pointer.x = S.pointer.y = 0.5; });
  }
  S.dark = o.dark;
  if (!accentCache.has(o.accent)) accentCache.set(o.accent, cssRgb(o.accent) ?? hex("#6d7cff"));
  S.accent = accentCache.get(o.accent)!;
  if (o.channel !== S.channel) {
    const now = performance.now(), fade = Math.min(1, (now - S.fadeAt) / 1400);
    S.from = [mix(S.from[0], S.to[0], fade), mix(S.from[1], S.to[1], fade)];
    S.to = skyColours(o.channel);
    if (!S.channel) S.from = S.to;
    S.channel = o.channel; S.fadeAt = now; S.pulses = [];
  }
  size();
  // people get stars of their own, the same one each time
  S.people.clear();
  const n = S.stars.length, taken = new Set<number>();
  for (const p of o.online) { let i = hashOf(p) % n; while (taken.has(i) && taken.size < n) i = (i + 1) % n; taken.add(i); S.people.set(p, i); }
  start();
  // a re-render hands over a blank canvas: paint it now rather than at the next tick
  if (fresh) frame(performance.now());
}

/** A new message from `author`: a wave of light from their star along the links, six hops out. */
export function skyPulse(author: string) {
  if (S.still || !S.stars.length) return;
  const n = S.stars.length;
  const from = S.people.get(author) ?? hashOf(author) % n;
  const P = S.stars.map(pos);
  const near = (a: number) => { const out: number[] = []; for (let b = 0; b < n; b++) if (b !== a && Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) < LINK * 1.15) out.push(b); return out; };
  const hop = new Map([[from, 0]]), edges: [number, number, number][] = [];
  let ring = [from];
  for (let h = 1; h <= 6 && ring.length; h++) {
    const next: number[] = [];
    for (const a of ring) for (const b of near(a)) if (!hop.has(b)) { hop.set(b, h); edges.push([a, b, h - 1]); next.push(b); }
    ring = next;
  }
  S.pulses.push({ from, at: (performance.now() - S.t0) / 1000, hop, edges });
  if (S.pulses.length > 4) S.pulses.shift();
}
