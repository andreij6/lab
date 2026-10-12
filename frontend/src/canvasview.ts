// Read-only viewer for Obsidian `.canvas` boards (JSON Canvas): text, file, link and group nodes
// drawn on a pannable, zoomable SVG with edges and labels.
import { base } from "./notes.ts";

type CNode = { id: string; type: string; x: number; y: number; width: number; height: number; text?: string; file?: string; url?: string; label?: string; color?: string };
type CEdge = { id: string; fromNode: string; toNode: string; label?: string; fromSide?: string; toSide?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const COLORS = ["", "#ef6b6b", "#f0a24c", "#e9d35f", "#5fd39c", "#5fb8ec", "#b58cf4"];

export function parseCanvas(json: string): { nodes: CNode[]; edges: CEdge[] } {
  try {
    const d = JSON.parse(json) as { nodes?: CNode[]; edges?: CEdge[] };
    return { nodes: Array.isArray(d.nodes) ? d.nodes : [], edges: Array.isArray(d.edges) ? d.edges : [] };
  } catch {
    return { nodes: [], edges: [] };
  }
}

function anchor(n: CNode, side?: string): [number, number] {
  switch (side) {
    case "top": return [n.x + n.width / 2, n.y];
    case "bottom": return [n.x + n.width / 2, n.y + n.height];
    case "left": return [n.x, n.y + n.height / 2];
    case "right": return [n.x + n.width, n.y + n.height / 2];
  }
  return [n.x + n.width / 2, n.y + n.height / 2];
}

/** The board as SVG markup; wrap it in a container with `mountCanvasPanZoom`. */
export function canvasSvg(json: string): string {
  const { nodes, edges } = parseCanvas(json);
  if (!nodes.length) return `<p class="muted">Empty canvas.</p>`;
  const minX = Math.min(...nodes.map((n) => n.x)) - 40;
  const minY = Math.min(...nodes.map((n) => n.y)) - 40;
  const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + 40;
  const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + 40;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const color = (c?: string) => (c && /^\d$/.test(c) ? COLORS[Number(c)] : c && c.startsWith("#") ? c : "");
  const groups = nodes.filter((n) => n.type === "group");
  const others = nodes.filter((n) => n.type !== "group");
  const node = (n: CNode) => {
    const c = color(n.color);
    const style = c ? ` style="--nc:${esc(c)}"` : "";
    const body = n.type === "text" ? `<div class="cv-text">${esc(n.text ?? "")}</div>`
      : n.type === "file" ? `<div class="cv-file"><a href="#" data-action="wiki" data-target="${esc((n.file ?? "").replace(/\.md$/, ""))}">${esc(base(n.file ?? ""))}</a></div>`
      : n.type === "link" ? `<div class="cv-link"><a href="${esc(n.url ?? "")}" target="_blank" rel="noopener">${esc(n.url ?? "")}</a></div>`
      : `<div class="cv-group-label">${esc(n.label ?? "")}</div>`;
    return `<foreignObject x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}"><div xmlns="http://www.w3.org/1999/xhtml" class="cv-node cv-${esc(n.type)}"${style}>${body}</div></foreignObject>`;
  };
  const edge = (e: CEdge) => {
    const a = byId.get(e.fromNode);
    const b = byId.get(e.toNode);
    if (!a || !b) return "";
    const [x1, y1] = anchor(a, e.fromSide);
    const [x2, y2] = anchor(b, e.toSide);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    return `<path class="cv-edge" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" marker-end="url(#cv-arrow)"/>${e.label ? `<text class="cv-edge-label" x="${mx}" y="${my - 6}" text-anchor="middle">${esc(e.label)}</text>` : ""}`;
  };
  return `<svg class="cv" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="cv-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="cv-arrowhead"/></marker></defs>${groups.map(node).join("")}${edges.map(edge).join("")}${others.map(node).join("")}</svg>`;
}

/** Wheel zooms, drag pans. */
export function mountCanvasPanZoom(host: HTMLElement) {
  const svg = host.querySelector<SVGSVGElement>("svg.cv");
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  let drag: { x: number; y: number; vx: number; vy: number } | undefined;
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const f = Math.exp(e.deltaY * 0.0015);
    const r = svg.getBoundingClientRect();
    const px = vb.x + ((e.clientX - r.left) / r.width) * vb.width;
    const py = vb.y + ((e.clientY - r.top) / r.height) * vb.height;
    vb.x = px - (px - vb.x) * f;
    vb.y = py - (py - vb.y) * f;
    vb.width *= f;
    vb.height *= f;
  }, { passive: false });
  svg.addEventListener("pointerdown", (e) => { if ((e.target as HTMLElement).closest("a")) return; drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener("pointermove", (e) => { if (!drag) return; const r = svg.getBoundingClientRect(); vb.x = drag.vx - ((e.clientX - drag.x) / r.width) * vb.width; vb.y = drag.vy - ((e.clientY - drag.y) / r.height) * vb.height; });
  svg.addEventListener("pointerup", () => (drag = undefined));
}
