// The Home kit, all pure: recurring upkeep (each job a note whose task moves on when it is done, so
// Work always shows the next one), and item notes for what is in the house, with room, value,
// warranty and manual, rolled up into an inventory.
import { frontmatter, type NoteLike } from "./notes.ts";
import { setProperty } from "./organize.ts";
import { addPeriod, setDue } from "./work.ts";

const typeOf = (content: string) => (frontmatter(content).data.type ?? "").trim().toLowerCase();
const stem = (path: string) => path.split("/").pop()!.replace(/\.md$/, "");
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const daysBefore = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10); };
const DUE_RE = /^- \[ \] [^\n]*📅\s*(\d{4}-\d{2}-\d{2})/m;

// ---- upkeep

export type Upkeep = { path: string; job: string; every: string; lastDone?: string; next?: string; inDays?: number };
export const isUpkeep = (content: string) => typeOf(content) === "upkeep";
export function upkeep(notes: NoteLike[], today: string): Upkeep[] {
  return notes.filter((n) => n.path.endsWith(".md") && isUpkeep(n.content)).map((n) => {
    const fm = frontmatter(n.content);
    const next = DUE_RE.exec(fm.body)?.[1];
    return { path: n.path, job: stem(n.path), every: (fm.data.every ?? "").trim() || "year", lastDone: (fm.data.last_done ?? "").trim() || undefined, next, inDays: next ? days(today, next) : undefined };
  }).sort((a, b) => (a.next ?? "9").localeCompare(b.next ?? "9"));
}
export function UPKEEP_TEMPLATE(job: string, every: string, next: string, how = ""): string {
  return `---\ntype: upkeep\nevery: ${every}\nlast_done: \n---\n\n# ${job}\n\n- [ ] ${job} 📅 ${next}\n\n## How\n\n${how.trim() || "Steps, part numbers, who to call."}\n`;
}
/** Done today: remember it, and move the task to the next time it is due. */
export function doneUpkeep(content: string, today: string): string {
  const fm = frontmatter(content);
  return setDue(setProperty(content, "last_done", today), addPeriod(today, fm.data.every ?? "year"));
}

// ---- items: inventory, warranties, manuals

export type Item = { path: string; name: string; room: string; brand?: string; model?: string; bought?: string; value?: number; warrantyUntil?: string; warrantyDays?: number; manual: boolean };
export const isItem = (content: string) => typeOf(content) === "item";
export function items(notes: NoteLike[], today: string): Item[] {
  return notes.filter((n) => n.path.endsWith(".md") && isItem(n.content)).map((n) => {
    const fm = frontmatter(n.content);
    const d = fm.data;
    const w = (d.warranty_until ?? "").trim() || undefined;
    const value = Number((d.value ?? "").replace(/[$,\s]/g, ""));
    return { path: n.path, name: stem(n.path), room: (d.room ?? "").trim() || "Other", brand: (d.brand ?? "").trim() || undefined, model: (d.model ?? "").trim() || undefined, bought: (d.bought ?? "").trim() || undefined, value: (d.value ?? "").trim() && Number.isFinite(value) ? value : undefined, warrantyUntil: w, warrantyDays: w ? days(today, w) : undefined, manual: /!\[\[[^\]\n]+\.pdf[^\]\n]*\]\]/i.test(fm.body) };
  }).sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name));
}
/** What is in each room and what it is worth, for insurance. */
export function inventory(its: Item[]): { room: string; count: number; value: number }[] {
  const by = new Map<string, { room: string; count: number; value: number }>();
  for (const i of its) { const r = by.get(i.room) ?? { room: i.room, count: 0, value: 0 }; r.count++; r.value += i.value ?? 0; by.set(i.room, r); }
  return [...by.values()].sort((a, b) => b.value - a.value);
}
/** Warranties ending within `within` days (not already over). */
export const warrantiesEnding = (its: Item[], within = 60) => its.filter((i) => i.warrantyDays !== undefined && i.warrantyDays >= 0 && i.warrantyDays <= within).sort((a, b) => a.warrantyDays! - b.warrantyDays!);
export type NewItem = { name: string; room: string; brand?: string; model?: string; bought?: string; value?: number; warrantyUntil?: string; manual?: string };
/** An item note; with a warranty, a reminder a month before it ends shows in Work. */
export function ITEM_TEMPLATE(i: NewItem): string {
  const props = [["type", "item"], ["room", i.room], ["brand", i.brand ?? ""], ["model", i.model ?? ""], ["bought", i.bought ?? ""], ["value", i.value === undefined ? "" : String(i.value)], ["warranty_until", i.warrantyUntil ?? ""]];
  const remind = i.warrantyUntil ? `\n- [ ] Warranty ends ${i.warrantyUntil}: anything to claim? 📅 ${daysBefore(i.warrantyUntil, 30)}\n` : "";
  return `---\n${props.map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n# ${i.name}\n${remind}\n## Manual\n\n${i.manual?.trim() ? `![[${i.manual.trim()}]]` : "Paste the manual's PDF link inside ![[ and ]] and it shows on this page."}\n\n## Notes\n\nReceipt, serial number, repairs.\n`;
}
