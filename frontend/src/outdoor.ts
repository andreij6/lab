// For deep wilderness trips: GPX routes drawn as a map and an elevation profile, trip and review
// templates, gear / food / water workbooks, skills decks, and folding a post-trip review back into
// a gear list. Pure; the UI lives in main.ts (the Trips tab).
import { evaluate, parseWorkbook, serializeWorkbook, type Sheet, type Workbook } from "./sheet.ts";

// ------------------------------------------------------------ routes

export type Pt = { lat: number; lon: number; ele?: number };
export type Waypoint = Pt & { name: string };
export type Track = { name: string; points: Pt[]; waypoints: Waypoint[] };

const num = (s: string | undefined) => (s === undefined || s === "" ? undefined : Number(s));
const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(tag)?.[1];
const unxml = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();

/** Track points (`trkpt`, else `rtept`) and waypoints of a GPX file. */
export function parseGpx(xml: string): Track {
  const name = unxml(/<(?:trk|rte|metadata)>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(xml)?.[1] ?? /<name>([\s\S]*?)<\/name>/.exec(xml)?.[1] ?? "Route");
  const read = (tag: string) => [...xml.matchAll(new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, "g"))].map((m) => ({ lat: Number(attr(m[1], "lat")), lon: Number(attr(m[1], "lon")), ele: num(/<ele>([^<]*)<\/ele>/.exec(m[2] ?? "")?.[1]), name: unxml(/<name>([\s\S]*?)<\/name>/.exec(m[2] ?? "")?.[1] ?? "") })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  let points = read("trkpt");
  if (!points.length) points = read("rtept");
  return { name, points: points.map(({ lat, lon, ele }) => ({ lat, lon, ele })), waypoints: read("wpt").map((w, i) => ({ ...w, name: w.name || `Waypoint ${i + 1}` })) };
}
/** At most `max` points, evenly picked, first and last kept. */
export function simplify(points: Pt[], max = 1500): Pt[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}
/** The compact block a route note keeps: ```track with `pt lat,lon,ele` and `wpt lat,lon,ele Name` lines. */
export function trackBlock(t: Track): string {
  const f = (p: Pt) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}${p.ele === undefined ? "" : `,${Math.round(p.ele)}`}`;
  return ["```track", `name: ${t.name}`, ...simplify(t.points).map((p) => `pt ${f(p)}`), ...t.waypoints.map((w) => `wpt ${f(w)} ${w.name}`), "```"].join("\n");
}
export function parseTrackBlock(text: string): Track {
  const t: Track = { name: "Route", points: [], waypoints: [] };
  for (const line of text.split("\n")) {
    const m = /^(pt|wpt)\s+(-?[\d.]+),(-?[\d.]+)(?:,(-?[\d.]+))?\s*(.*)$/.exec(line.trim());
    if (m) { const p = { lat: Number(m[2]), lon: Number(m[3]), ele: num(m[4]) }; if (m[1] === "pt") t.points.push(p); else t.waypoints.push({ ...p, name: m[5] || "Waypoint" }); }
    else if (/^name:/.test(line.trim())) t.name = line.trim().slice(5).trim();
  }
  return t;
}
/** Great-circle distance in km. */
export function haversine(a: Pt, b: Pt): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export type TrackStats = { km: number; ascent: number; descent: number; minEle?: number; maxEle?: number; cum: number[] };
/** Distance and climbing; elevation changes under 3 m are treated as GPS noise. */
export function trackStats(points: Pt[]): TrackStats {
  const cum = [0];
  let ascent = 0, descent = 0, ref = points[0]?.ele;
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
    const e = points[i].ele;
    if (e !== undefined && ref !== undefined) { const d = e - ref; if (Math.abs(d) >= 3) { if (d > 0) ascent += d; else descent -= d; ref = e; } } else if (e !== undefined) ref = e;
  }
  const eles = points.map((p) => p.ele).filter((e): e is number => e !== undefined);
  return { km: cum[cum.length - 1] ?? 0, ascent: Math.round(ascent), descent: Math.round(descent), minEle: eles.length ? Math.min(...eles) : undefined, maxEle: eles.length ? Math.max(...eles) : undefined, cum };
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** The route as SVG: a map (north up, no tiles, works offline) and an elevation profile, with the numbers that matter. */
export function trackHtml(t: Track): string {
  if (t.points.length < 2 && !t.waypoints.length) return `<div class="track empty">No points in this route.</div>`;
  const all = [...t.points, ...t.waypoints];
  const lat0 = Math.min(...all.map((p) => p.lat)), lat1 = Math.max(...all.map((p) => p.lat));
  const lon0 = Math.min(...all.map((p) => p.lon)), lon1 = Math.max(...all.map((p) => p.lon));
  const kx = Math.cos(((lat0 + lat1) / 2) * Math.PI / 180);
  const W = 480, H = 300, P = 18;
  const sx = (lon1 - lon0) * kx || 1e-9, sy = lat1 - lat0 || 1e-9;
  const s = Math.min((W - 2 * P) / sx, (H - 2 * P) / sy);
  const ox = (W - sx * s) / 2, oy = (H - sy * s) / 2;
  const X = (p: Pt) => (ox + (p.lon - lon0) * kx * s).toFixed(1), Y = (p: Pt) => (H - oy - (p.lat - lat0) * s).toFixed(1);
  const st = trackStats(t.points);
  const kmPerPx = st.km && t.points.length > 1 ? 1 / s / (180 / Math.PI / 6371) : 0;
  const bar = kmPerPx ? (() => { const target = (W / 5) * kmPerPx; const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].find((v) => v >= target) ?? 100; const px = nice / kmPerPx; return `<g transform="translate(${P},${H - 10})"><line x1="0" x2="${px.toFixed(1)}" y1="0" y2="0" stroke="currentColor" stroke-width="2"/><text x="${(px / 2).toFixed(1)}" y="-4" font-size="10" text-anchor="middle" fill="currentColor">${nice} km</text></g>`; })() : "";
  const line = t.points.length > 1 ? `<polyline points="${t.points.map((p) => `${X(p)},${Y(p)}`).join(" ")}" fill="none" stroke="#e35d6a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(t.points[0])}" cy="${Y(t.points[0])}" r="5" fill="#4fc27a"><title>Start</title></circle><circle cx="${X(t.points[t.points.length - 1])}" cy="${Y(t.points[t.points.length - 1])}" r="5" fill="#111" stroke="#fff" stroke-width="1.5"><title>End</title></circle>` : "";
  const wps = t.waypoints.map((w) => `<g><circle cx="${X(w)}" cy="${Y(w)}" r="4" fill="#4f8cff" stroke="#fff" stroke-width="1"/><text x="${(Number(X(w)) + 6).toFixed(1)}" y="${(Number(Y(w)) + 3).toFixed(1)}" font-size="10" fill="currentColor">${esc(w.name)}</text></g>`).join("");
  const map = `<svg viewBox="0 0 ${W} ${H}" class="track-map" role="img" aria-label="Map of ${esc(t.name)}"><text x="${W - P}" y="${P}" font-size="11" text-anchor="end" fill="currentColor" opacity=".7">N ↑</text>${line}${wps}${bar}</svg>`;
  const eles = t.points.map((p) => p.ele);
  let profile = "";
  if (st.minEle !== undefined && st.maxEle !== undefined && st.km > 0) {
    const PW = 480, PH = 120, L = 40, B = 18;
    const span = st.maxEle - st.minEle || 1;
    const px = (i: number) => (L + (st.cum[i] / st.km) * (PW - L - 6)).toFixed(1);
    const py = (e: number) => (6 + (1 - (e - st.minEle!) / span) * (PH - B - 6)).toFixed(1);
    const pts = eles.map((e, i) => (e === undefined ? "" : `${px(i)},${py(e)}`)).filter(Boolean);
    profile = `<svg viewBox="0 0 ${PW} ${PH}" class="track-profile" role="img" aria-label="Elevation profile"><polygon points="${L},${PH - B} ${pts.join(" ")} ${(PW - 6).toFixed(1)},${PH - B}" fill="#4f8cff" opacity=".18"/><polyline points="${pts.join(" ")}" fill="none" stroke="#4f8cff" stroke-width="2"/><text x="${L - 4}" y="12" font-size="10" text-anchor="end" fill="currentColor" opacity=".7">${Math.round(st.maxEle)} m</text><text x="${L - 4}" y="${PH - B}" font-size="10" text-anchor="end" fill="currentColor" opacity=".7">${Math.round(st.minEle)} m</text><text x="${PW - 6}" y="${PH - 4}" font-size="10" text-anchor="end" fill="currentColor" opacity=".7">${st.km.toFixed(1)} km</text></svg>`;
  }
  const facts = `<div class="track-facts"><b>${esc(t.name)}</b><span>${st.km.toFixed(1)} km (${(st.km * 0.621371).toFixed(1)} mi)</span>${st.minEle !== undefined ? `<span>↑ ${st.ascent} m · ↓ ${st.descent} m</span><span>${Math.round(st.minEle)}–${Math.round(st.maxEle!)} m</span>` : ""}<span>${t.waypoints.length} waypoint${t.waypoints.length === 1 ? "" : "s"}</span></div>`;
  return `<div class="track">${facts}${map}${profile}</div>`;
}
/** A route note made from a GPX file: the map block, then one heading per waypoint so `[[Route#Waypoint: Lower Falls]]` links work. */
export function routeNote(t: Track): string {
  const st = trackStats(t.points);
  const wp = t.waypoints.map((w) => `## Waypoint: ${w.name}\n\n${w.lat.toFixed(5)}, ${w.lon.toFixed(5)}${w.ele === undefined ? "" : ` · ${Math.round(w.ele)} m`}\n`).join("\n");
  return `---\ntype: route\ndistance_km: ${st.km.toFixed(1)}\nascent_m: ${st.ascent}\n---\n# ${t.name}\n\n${trackBlock(t)}\n\n${wp}`;
}

// ------------------------------------------------------------ templates

const today = () => new Date().toISOString().slice(0, 10);
export const TRIP_TEMPLATE = `---
type: trip
start: {{date}}
end: {{date}}
return_by: {{date}} 18:00
party:
contact:
---
# {{title}}

> [!warning] Leave this plan with someone
> Share it read-only (Share… on the plan) and agree what they do if you are not back by **return_by**.

## Route

- Start (trailhead, parking):
- End:
- Route note: [[ ]]

## Days

| Day | From | To | Distance | Ascent | Camp | Water |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | |
| 2 | | | | | | |

## Water sources

-

## Bail-out points

-

## Permits and rules

- [ ] Permit:
- [ ] Fire rules:
- [ ] Bear canister / food storage:

## Gear and food

- Gear list: [[ ]]
- Food plan: [[ ]]

## Emergency

- Contact at home:
- Ranger station / agency:
- Nearest hospital:
- Satellite messenger / PLB:
- Plan if late:
`;
export const REVIEW_TEMPLATE = `---
type: trip-review
trip:
date: {{date}}
---
# {{title}}

## What went well

-

## Leave at home next time

-

## Missing or wished for

-

## What broke or failed

-

## Add to gear list

One per line: \`Item, Category, grams\`. "Apply to a gear list" adds these.

-

## Remove from gear list

One item name per line. "Apply to a gear list" removes these.

-
`;
/** `YYYY-MM-DD HH:MM` in local time (field notes are read where they were written). */
export const localStamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export const fieldEntry = (time: Date, pos?: { lat: number; lon: number; alt?: number | null }) => `---
type: field-entry
time: ${localStamp(time)}
${pos ? `lat: ${pos.lat.toFixed(5)}\nlon: ${pos.lon.toFixed(5)}\n${pos.alt ? `ele: ${Math.round(pos.alt)}\n` : ""}` : ""}---
# ${time.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}

`;

// ------------------------------------------------------------ workbooks

const CATS = ["Shelter", "Sleep", "Pack", "Kitchen", "Water", "Clothing", "Navigation", "Safety and first aid", "Hygiene", "Electronics", "Food"];
const GEAR: [string, string, number, number, string, string][] = [
  ["Tent", "Shelter", 1100, 1, "no", "no"], ["Stakes", "Shelter", 90, 1, "no", "no"], ["Sleeping bag", "Sleep", 850, 1, "no", "no"], ["Sleeping pad", "Sleep", 450, 1, "no", "no"],
  ["Backpack", "Pack", 1200, 1, "no", "no"], ["Stove", "Kitchen", 80, 1, "no", "no"], ["Pot", "Kitchen", 120, 1, "no", "no"], ["Fuel canister", "Kitchen", 230, 1, "no", "yes"],
  ["Water filter", "Water", 85, 1, "no", "no"], ["Bottles", "Water", 40, 2, "no", "no"], ["Rain jacket", "Clothing", 300, 1, "no", "no"], ["Puffy jacket", "Clothing", 350, 1, "no", "no"],
  ["Boots", "Clothing", 900, 1, "yes", "no"], ["Map and compass", "Navigation", 120, 1, "no", "no"], ["First aid kit", "Safety and first aid", 200, 1, "no", "no"], ["Headlamp", "Electronics", 60, 1, "no", "no"],
  ["Satellite messenger", "Safety and first aid", 110, 1, "yes", "no"], ["Trowel", "Hygiene", 20, 1, "no", "no"], ["Food (per day)", "Food", 750, 3, "no", "yes"],
];
/** A gear list: items with weights, worn and consumable flags; a summary sheet with base weight and a pie by category. */
export function gearWorkbook(): string {
  const gear: string[][] = [["Item", "Category", "Weight (g)", "Qty", "Worn", "Consumable", "Total (g)"]];
  GEAR.forEach((g, i) => gear.push([g[0], g[1], String(g[2]), String(g[3]), g[4], g[5], `=C${i + 2}*D${i + 2}`]));
  const R = "Gear!$B$2:$B$300", T = "Gear!$G$2:$G$300";
  const summary: string[][] = [["Category", "Grams", "", "Weights", "Grams", "Pounds"]];
  CATS.forEach((c, i) => summary.push([c, `=SUMIF(${R}, "${c}", ${T})`, "", ...(i === 0 ? ["Total", `=SUM(${T})`, "=ROUND(E2/453.6, 2)"] : i === 1 ? ["Worn", "=SUMIF(Gear!$E$2:$E$300, \"yes\", Gear!$G$2:$G$300)", "=ROUND(E3/453.6, 2)"] : i === 2 ? ["Consumables", "=SUMIF(Gear!$F$2:$F$300, \"yes\", Gear!$G$2:$G$300)", "=ROUND(E4/453.6, 2)"] : i === 3 ? ["Base weight", "=E2-E3-E4", "=ROUND(E5/453.6, 2)"] : [])]));
  const wb: Workbook = { sheets: [{ name: "Gear", rows: gear, charts: [] }, { name: "Summary", rows: summary, charts: [{ id: "bycat", type: "pie", title: "Weight by category", labels: "A", values: ["B"], legend: "right", palette: "earth", showValues: true }] }] };
  return serializeWorkbook(wb);
}
/** Base weight of a gear workbook (Summary!E5), for comparing lists. */
export const GEAR_BASE_REF = { sheet: "Summary", ref: "E5" };
export const isGearWorkbook = (json: string) => { const wb = parseWorkbook(json); return wb.sheets.some((s) => s.name === "Gear" && s.rows[0]?.[0] === "Item" && s.rows[0]?.[2] === "Weight (g)"); };
export function baseWeight(json: string): number | undefined {
  const wb = parseWorkbook(json);
  const v = evaluate(wb).get("Summary")?.[4]?.[4];
  return typeof v === "number" ? v : undefined;
}
/** A food plan: items per day with grams and calories, daily totals against a target, LOW flags, a chart. */
export function foodWorkbook(days = 3, target = 3000): string {
  const food: string[][] = [["Day", "Item", "Grams", "Calories", "Cal/oz"]];
  const menu: [string, number, number][] = [["Granola with milk powder", 140, 620], ["Tortillas and peanut butter", 180, 900], ["Trail mix", 120, 640], ["Dehydrated dinner", 160, 650], ["Chocolate", 50, 270]];
  for (let d = 1; d <= days; d++) for (const [item, g, cal] of menu) { const r = food.length + 1; food.push([String(d), item, String(g), String(cal), `=IF(C${r}>0, ROUND(D${r}/(C${r}/28.35), 0), "")`]); }
  const dayRows: string[][] = [["Day", "Calories", "Grams", "Cal/oz", "Status", "", "Daily target (kcal)", String(target)]];
  for (let d = 1; d <= days; d++) { const r = d + 1; dayRows.push([String(d), `=SUMIF(Food!$A$2:$A$300, A${r}, Food!$D$2:$D$300)`, `=SUMIF(Food!$A$2:$A$300, A${r}, Food!$C$2:$C$300)`, `=IF(C${r}>0, ROUND(B${r}/(C${r}/28.35), 0), "")`, `=IF(B${r}<$H$1, "LOW", "ok")`]); }
  // a blank row first, so the chart (which stops at the first blank label) leaves the total out
  const t = days + 3;
  dayRows.push([], ["Total", `=SUM(B2:B${days + 1})`, `=SUM(C2:C${days + 1})`, `=IF(C${t}>0, ROUND(B${t}/(C${t}/28.35), 0), "")`]);
  return serializeWorkbook({ sheets: [{ name: "Food", rows: food, charts: [] }, { name: "Days", rows: dayRows, charts: [{ id: "cal", type: "bar", title: "Calories per day", labels: "A", values: ["B"], palette: "warm", showValues: true, yLabel: "kcal" }] }] });
}
/** A water and resupply ledger: sources by mile, distance to the next one and how much to carry. */
export function waterWorkbook(): string {
  const rows: string[][] = [["Mile", "Source", "Kind", "Reliable", "Miles to next", "Carry (L)", "", "Litres per mile", "0.5"]];
  const src: [number, string, string, string][] = [[0, "Trailhead tap", "water", "yes"], [6.5, "Creek crossing", "water", "yes"], [14, "Spring (check reports)", "water", "seasonal"], [22, "Town (post office box)", "resupply", "yes"], [31, "Lake", "water", "yes"]];
  src.forEach(([m, s, k, r], i) => { const row = i + 2; rows.push([String(m), s, k, r, `=IF(A${row + 1}="", "", A${row + 1}-A${row})`, `=IF(E${row}="", "", ROUND(E${row}*$I$1, 1))`]); });
  return serializeWorkbook({ sheets: [{ name: "Water", rows, charts: [{ id: "gap", type: "bar", title: "Carry between sources (L)", labels: "B", values: ["F"], palette: "cool", showValues: true }] }] });
}
/** Fold a post-trip review into a gear workbook: add `Item, Category, grams` lines, remove named items. */
export function applyReviewToGear(review: string, json: string): { json: string; added: number; removed: number } {
  const sec = (h: string) => { const m = new RegExp(`^##\\s+${h}\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "im").exec(review); return (m?.[1] ?? "").split("\n").map((l) => /^\s*[-*+]\s+(.+)$/.exec(l)?.[1]?.trim()).filter((l): l is string => !!l); };
  const wb = parseWorkbook(json);
  const gear = wb.sheets.find((s) => s.name === "Gear") as Sheet | undefined;
  if (!gear) return { json, added: 0, removed: 0 };
  const drop = new Set(sec("Remove from gear list").map((x) => x.toLowerCase()));
  const before = gear.rows.length;
  gear.rows = [gear.rows[0], ...gear.rows.slice(1).filter((r) => !drop.has((r[0] ?? "").trim().toLowerCase()))];
  const removed = before - gear.rows.length;
  let added = 0;
  for (const line of sec("Add to gear list")) {
    const [item, cat = "", grams = "0"] = line.split(/\s*,\s*/);
    if (!item) continue;
    gear.rows.push([item, cat, String(Number(grams.replace(/[^\d.]/g, "")) || 0), "1", "no", "no", ""]);
    added++;
  }
  gear.rows.forEach((r, i) => { if (i > 0) { while (r.length < 7) r.push(""); r[6] = `=C${i + 1}*D${i + 1}`; } });
  return { json: serializeWorkbook(wb), added, removed };
}

// ------------------------------------------------------------ skills decks

const deck = (title: string, note: string, cards: [string, string][]) => `---\nquiz: cards\n---\n\n# ${title}\n\n${note}\n\n${cards.map(([f, b]) => `${f}::${b}`).join("\n\n")}\n`;
export const DECKS: Record<string, string> = {
  Knots: deck("Knots", "Practise each one with a real rope until you can tie it without looking.", [
    ["Fixed loop at the end of a line that will not slip or jam and unties after loading", "Bowline"],
    ["Quick, adjustable hitch around a post or carabiner", "Clove hitch"],
    ["Adjustable loop for tensioning tent guylines", "Taut-line hitch"],
    ["Hitch that gives mechanical advantage to tension a line, such as a bear-bag line", "Trucker's hitch"],
    ["Joins two ropes of different thickness", "Sheet bend"],
    ["Friction hitch that grips a rope under load and slides when unloaded", "Prusik"],
    ["Ties a line off to a tree or post", "Two half hitches"],
    ["Tie-in knot for climbing that is easy to check", "Figure-eight follow-through"],
  ]),
  "First aid": deck("Wilderness first aid refresher", "A refresher, not training: take a Wilderness First Aid course before relying on any of this.", [
    ["First thing to do at any accident scene", "Make sure the scene is safe for you before you help"],
    ["Priorities of the first check", "Stop severe bleeding, then airway, breathing, circulation"],
    ["Severe bleeding from a limb", "Firm direct pressure; a tourniquet if pressure does not stop life-threatening bleeding"],
    ["Early signs of hypothermia", "Shivering and the umbles: stumbles, mumbles, fumbles, grumbles"],
    ["Treating mild hypothermia", "Shelter, dry clothes, insulation from the ground, warm sweet drinks if fully alert"],
    ["Heat stroke versus heat exhaustion", "Heat stroke brings confusion or collapse: cool the person fast and evacuate, it is an emergency"],
    ["A hot spot on the foot", "Stop and cover it with tape or moleskin before it becomes a blister"],
    ["Suspected neck or back injury after a fall", "Keep the head and neck still and do not move the person unless they are in danger"],
    ["Headache and nausea after climbing to altitude", "Stop going up; descend if it gets worse or if confusion or breathlessness at rest appears"],
    ["Snakebite", "Keep calm and still, remove rings, keep the limb near heart level, evacuate; no cutting, sucking, ice or tourniquet"],
    ["Lightning on an exposed ridge", "Get off high ground, away from lone trees and water, and spread the group out"],
  ]),
  Navigation: deck("Navigation", "Practise with a map and compass on a known trail first.", [
    ["Angle between true north and magnetic north", "Declination; adjust bearings by it"],
    ["Contour lines close together", "A steep slope"],
    ["A linear feature you follow, such as a stream or ridge", "A handrail"],
    ["A feature past your target that tells you you went too far", "A catching feature"],
    ["Aiming deliberately to one side of a target on a linear feature", "Aiming off, so you know which way to turn"],
    ["How to measure distance without GPS", "A pace count: your paces per 100 m on known ground"],
    ["The bearing back the way you came", "The back bearing: add or subtract 180 degrees"],
    ["Reading a grid reference", "Along the corridor, then up the stairs: easting first, then northing"],
  ]),
  "Leave No Trace": deck("Leave No Trace", "The seven principles and the numbers worth remembering.", [
    ["Principle 1", "Plan ahead and prepare"], ["Principle 2", "Travel and camp on durable surfaces"], ["Principle 3", "Dispose of waste properly"],
    ["Principle 4", "Leave what you find"], ["Principle 5", "Minimise campfire impacts"], ["Principle 6", "Respect wildlife"], ["Principle 7", "Be considerate of other visitors"],
    ["How deep is a cathole", "15 to 20 cm (6 to 8 inches)"],
    ["How far from water, trails and camp for catholes and camping", "About 60 m (200 feet, roughly 70 adult steps)"],
  ]),
  "Plants to avoid": deck("Plants to avoid", "For recognising hazards only. Never eat a wild plant on the strength of these cards.", [
    ["Leaves in groups of three, glossy or dull, vine or shrub", "Poison ivy: leaves of three, let it be"],
    ["Oak-like lobed leaves in threes, western North America", "Poison oak"],
    ["Fine stinging hairs that burn on contact", "Stinging nettle"],
    ["Huge umbrella-shaped flower heads, sap burns skin in sunlight", "Giant hogweed: avoid the sap entirely"],
    ["Umbrella-shaped white flowers and purple-streaked hollow stems near water", "Possibly water hemlock, one of the most toxic plants: do not touch or eat"],
  ]),
};
export { today };
