// The knowledge graph: a force-directed layout on a canvas. Notes are nodes, `[[links]]` are
// edges; the current note is highlighted, hovering lights up a node's neighbourhood, dragging
// pins a node, the wheel zooms, dragging the background pans, a click opens the note.
// ponytail: O(n²) repulsion per frame; a Barnes-Hut tree when notebooks pass ~1,500 notes.
import type { GraphEdge, GraphNode } from "./notes";

type N = GraphNode & { x: number; y: number; vx: number; vy: number; fixed: boolean; r: number };
type E = { a: N; b: N };
export type GraphOpts = { onOpen?: (id: string) => void; labels?: "auto" | "always" | "hover"; /** positions survive re-mounts (the pane is re-rendered on every save) */ cache?: Map<string, { x: number; y: number }> };

export class ForceGraph {
  private nodes: N[] = [];
  private edges: E[] = [];
  private byId = new Map<string, N>();
  private neighbours = new Map<string, Set<string>>();
  private ctx: CanvasRenderingContext2D;
  private k = 1;
  private tx = 0;
  private ty = 0;
  private alpha = 1;
  private raf = 0;
  private hover?: N;
  private current?: string;
  private drag?: { node?: N; sx: number; sy: number; ox: number; oy: number; moved: boolean };
  private ro: ResizeObserver;
  private w = 0;
  private h = 0;
  private get repulsion() {
    return Math.min(1600, 400 + this.nodes.length * 25);
  }
  private colors = { edge: "#888", node: "#aaa", current: "#7c6cff", ghost: "#777", label: "#ddd", halo: "rgba(124,108,255,0.25)", agent: "#4cd4a0" };

  constructor(private canvas: HTMLCanvasElement, private opts: GraphOpts = {}) {
    this.ctx = canvas.getContext("2d")!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointerleave", this.onUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("dblclick", () => this.fit());
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }

  /** Replace the data; nodes already on screen keep their positions so the picture does not jump. */
  setData(nodes: GraphNode[], edges: GraphEdge[], current?: string) {
    const old = this.byId;
    this.byId = new Map();
    const R = Math.max(60, Math.sqrt(nodes.length) * 28);
    this.nodes = nodes.map((n, i) => {
      const prev = old.get(n.id) ?? this.opts.cache?.get(n.id);
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      const node: N = { ...n, x: prev?.x ?? Math.cos(a) * R, y: prev?.y ?? Math.sin(a) * R, vx: 0, vy: 0, fixed: old.get(n.id)?.fixed ?? false, r: 3.5 + Math.sqrt(n.degree) * 1.6 };
      this.byId.set(n.id, node);
      return node;
    });
    this.edges = edges.flatMap((e) => {
      const a = this.byId.get(e.source);
      const b = this.byId.get(e.target);
      return a && b ? [{ a, b }] : [];
    });
    this.neighbours = new Map();
    for (const { a, b } of this.edges) {
      if (!this.neighbours.has(a.id)) this.neighbours.set(a.id, new Set());
      if (!this.neighbours.has(b.id)) this.neighbours.set(b.id, new Set());
      this.neighbours.get(a.id)!.add(b.id);
      this.neighbours.get(b.id)!.add(a.id);
    }
    this.current = current;
    if (old.size === 0) {
      this.fit(false);
      this.settled = false;
    }
    this.hover = undefined;
    this.reheat();
  }

  setCurrent(id?: string) {
    this.current = id;
    this.draw();
  }

  private style: { colors: Map<string, string>; match?: Set<string> } = { colors: new Map() };
  /** Per-node colours (groups) and an optional set of matching nodes to spotlight. */
  setStyle(style: { colors: Map<string, string>; match?: Set<string> }) {
    this.style = style;
    this.draw();
  }

  private readColors() {
    const cs = getComputedStyle(this.canvas);
    const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
    this.colors = { edge: v("--graph-edge", "#888"), node: v("--graph-node", "#aaa"), current: v("--accent", "#7c6cff"), ghost: v("--graph-ghost", "#777"), label: v("--fg", "#ddd"), halo: v("--graph-halo", "rgba(124,108,255,0.25)"), agent: v("--graph-node-agent", "#4cd4a0") };
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.w = width;
    this.h = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.readColors();
    this.draw();
  }

  /** Centre and scale the graph to the canvas. */
  fit(animateFrom = true) {
    if (!this.nodes.length) return;
    const xs = this.nodes.map((n) => n.x);
    const ys = this.nodes.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 120) + 80;
    this.k = Math.min(1.6, Math.min(this.w, this.h) / span);
    this.tx = this.w / 2 - ((minX + maxX) / 2) * this.k;
    this.ty = this.h / 2 - ((minY + maxY) / 2) * this.k;
    if (animateFrom) this.draw();
  }

  private reheat(a = 1) {
    this.alpha = Math.max(this.alpha, a);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
  }

  private settled = true;
  private tick = () => {
    this.step();
    this.draw();
    this.alpha *= 0.985;
    if (this.alpha > 0.004) this.raf = requestAnimationFrame(this.tick);
    else {
      // first time a fresh layout cools down: frame it
      if (!this.settled && !this.drag) this.fit();
      this.settled = true;
      if (this.drag?.node) this.raf = requestAnimationFrame(this.tick);
    }
  };

  /** One simulation step: repulsion between every pair, springs along edges, a gentle pull to the centre. */
  private step() {
    const ns = this.nodes;
    const a = this.alpha;
    for (let i = 0; i < ns.length; i++) {
      const p = ns[i];
      for (let j = i + 1; j < ns.length; j++) {
        const q = ns[j];
        let dx = q.x - p.x;
        let dy = q.y - p.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2; d2 = 1; }
        // short-range repulsion: unbounded range spread 60 notes over ~3,000 units, dots shrank to nothing when fitted
        if (d2 > 22500) continue;
        const f = (this.repulsion * a) / d2;
        const fx = dx * f, fy = dy * f;
        p.vx -= fx; p.vy -= fy; q.vx += fx; q.vy += fy;
      }
      p.vx -= p.x * 0.06 * a;
      p.vy -= p.y * 0.06 * a;
    }
    for (const { a: p, b: q } of this.edges) {
      const dx = q.x - p.x, dy = q.y - p.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const rest = 70 + (p.r + q.r) * 2;
      const f = ((d - rest) / d) * 0.06 * a;
      const fx = dx * f, fy = dy * f;
      p.vx += fx; p.vy += fy; q.vx -= fx; q.vy -= fy;
    }
    for (const n of ns) {
      if (!n.fixed) {
        n.vx *= 0.6; n.vy *= 0.6;
        n.x += n.vx; n.y += n.vy;
      } else n.vx = n.vy = 0;
      this.opts.cache?.set(n.id, { x: n.x, y: n.y });
    }
  }

  private draw() {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    c.save();
    c.translate(this.tx, this.ty);
    c.scale(this.k, this.k);
    const focus = this.hover ?? (this.current ? this.byId.get(this.current) : undefined);
    const near = focus ? this.neighbours.get(focus.id) ?? new Set<string>() : undefined;
    c.lineWidth = 1 / this.k;
    for (const { a, b } of this.edges) {
      const lit = focus && (a === focus || b === focus);
      c.strokeStyle = lit ? this.colors.current : this.colors.edge;
      c.globalAlpha = lit ? 0.9 : this.hover ? 0.12 : 0.3;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    const showAll = this.opts.labels === "always" || (this.opts.labels !== "hover" && (this.k > 1.1 || this.nodes.length <= 40));
    for (const n of this.nodes) {
      const isCur = n.id === this.current;
      const matched = !this.style.match || this.style.match.has(n.id);
      const lit = (!focus || n === focus || near!.has(n.id)) && matched;
      // hovering spotlights a neighbourhood; the open note alone only softens the rest, so the map stays readable
      c.globalAlpha = lit ? 1 : this.hover || this.style.match ? 0.2 : 0.6;
      if (isCur || n === this.hover) {
        c.fillStyle = this.colors.halo;
        c.beginPath();
        c.arc(n.x, n.y, n.r + 7, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = n.unresolved ? this.colors.ghost : isCur || n === this.hover ? this.colors.current : n.agent ? this.colors.agent : this.style.colors.get(n.id) ?? this.colors.node;
      c.beginPath();
      if (n.agent) {
        // agent notes are diamonds, so they read differently even in print
        c.moveTo(n.x, n.y - n.r * 1.3);
        c.lineTo(n.x + n.r * 1.3, n.y);
        c.lineTo(n.x, n.y + n.r * 1.3);
        c.lineTo(n.x - n.r * 1.3, n.y);
        c.closePath();
      } else c.arc(n.x, n.y, Math.max(n.r, 3 / this.k), 0, Math.PI * 2);
      c.fill();
      if (n.unresolved) {
        c.strokeStyle = this.colors.ghost;
        c.setLineDash([2 / this.k, 2 / this.k]);
        c.stroke();
        c.setLineDash([]);
      }
      if (showAll || n === this.hover || isCur || (focus && near!.has(n.id))) {
        c.globalAlpha = lit ? 0.95 : 0.3;
        c.fillStyle = this.colors.label;
        c.font = `${Math.max(9, 12 / this.k)}px Inter, system-ui, sans-serif`;
        c.textAlign = "center";
        c.fillText(n.label, n.x, n.y + n.r + 12 / this.k);
      }
    }
    c.restore();
    c.globalAlpha = 1;
  }

  private toGraph(px: number, py: number) {
    return { x: (px - this.tx) / this.k, y: (py - this.ty) / this.k };
  }
  private at(px: number, py: number): N | undefined {
    const { x, y } = this.toGraph(px, py);
    let best: N | undefined;
    let bd = Infinity;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < n.r + 8 / this.k && d < bd) { best = n; bd = d; }
    }
    return best;
  }
  private local(ev: PointerEvent | WheelEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { px: ev.clientX - r.left, py: ev.clientY - r.top };
  }

  private onDown = (ev: PointerEvent) => {
    const { px, py } = this.local(ev);
    const node = this.at(px, py);
    this.drag = { node, sx: px, sy: py, ox: this.tx, oy: this.ty, moved: false };
    if (node) { node.fixed = true; this.reheat(0.3); }
    this.canvas.setPointerCapture(ev.pointerId);
  };
  private onMove = (ev: PointerEvent) => {
    const { px, py } = this.local(ev);
    if (this.drag) {
      if (Math.hypot(px - this.drag.sx, py - this.drag.sy) > 3) this.drag.moved = true;
      if (this.drag.node) {
        const g = this.toGraph(px, py);
        this.drag.node.x = g.x;
        this.drag.node.y = g.y;
        this.reheat(0.2);
      } else {
        this.tx = this.drag.ox + (px - this.drag.sx);
        this.ty = this.drag.oy + (py - this.drag.sy);
        this.draw();
      }
      return;
    }
    const h = this.at(px, py);
    if (h !== this.hover) {
      this.hover = h;
      this.canvas.style.cursor = h ? "pointer" : "grab";
      this.canvas.title = h ? h.id : "";
      this.draw();
    }
  };
  private onUp = (ev: PointerEvent) => {
    const d = this.drag;
    if (!d) return;
    this.drag = undefined;
    if (d.node) {
      d.node.fixed = false;
      if (!d.moved && !d.node.unresolved) this.opts.onOpen?.(d.node.id);
      this.reheat(0.3);
    }
    if (ev.type === "pointerleave") { this.hover = undefined; this.draw(); }
  };
  private onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    const { px, py } = this.local(ev);
    const factor = Math.exp(-ev.deltaY * 0.0015);
    const k2 = Math.min(6, Math.max(0.15, this.k * factor));
    const g = this.toGraph(px, py);
    this.k = k2;
    this.tx = px - g.x * k2;
    this.ty = py - g.y * k2;
    this.draw();
  };
}
