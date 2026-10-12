// Spaced repetition (SM-2, the Anki family) for flashcards. Pure: the schedule for a card is a
// small record keyed by a hash of its front, kept in the notebook's settings so it follows the
// notebook between devices. Days are local calendar days.
import { dayKey } from "./activity.ts";

/** ease ×1000, interval in days, due day key, repetitions in a row */
export type Sched = { e: number; i: number; d: string; r: number };
export type Rating = "again" | "hard" | "good" | "easy";

/** A stable key for a card: FNV-1a over its front. */
export function cardKey(front: string): string {
  let h = 0x811c9dc5;
  for (const ch of front.trim()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export const addDays = (d: Date, n: number): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };

/** The next schedule after rating a card today (SM-2 with Anki's hard/easy tweaks). */
export function review(prev: Sched | undefined, rating: Rating, today: Date): Sched {
  const e0 = prev?.e ?? 2500;
  const i0 = prev?.i ?? 0;
  const r0 = prev?.r ?? 0;
  let e = e0;
  let i: number;
  let r: number;
  switch (rating) {
    case "again": e = Math.max(1300, e0 - 200); i = 0; r = 0; break;
    case "hard": e = Math.max(1300, e0 - 150); i = Math.max(1, Math.round(i0 * 1.2)); r = r0 + 1; break;
    case "good": i = r0 === 0 ? 1 : r0 === 1 ? 6 : Math.round(i0 * e0 / 1000); r = r0 + 1; break;
    case "easy": e = e0 + 150; i = Math.max(4, Math.round((r0 === 0 ? 4 : i0 * e0 / 1000) * 1.3)); r = r0 + 1; break;
  }
  return { e, i, d: dayKey(addDays(today, i)), r };
}

/** Due when never reviewed or the due day is today or earlier. */
export const isDue = (s: Sched | undefined, today: Date): boolean => !s || s.d <= dayKey(today);
