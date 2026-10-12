// The activity grid: notes created per day over the last year, GitHub style. Pure helpers.

export const dayKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Count timestamps (nanoseconds, as the canister stores them) per local calendar day. */
export function countByDay(createdNs: Iterable<bigint>): Map<string, number> {
  const m = new Map<string, number>();
  for (const ns of createdNs) {
    const k = dayKey(new Date(Number(ns / 1_000_000n)));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export type Cell = { key: string; count: number; date: Date };
/** 53 columns of 7 days ending today (weeks start on Sunday), oldest first; cells after today are null. */
export function gridWeeks(today: Date, counts: Map<string, number>, weeks = 53): (Cell | null)[][] {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(end.getDate() - end.getDay() - (weeks - 1) * 7);
  const out: (Cell | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: (Cell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      if (date > end) { col.push(null); continue; }
      const key = dayKey(date);
      col.push({ key, count: counts.get(key) ?? 0, date });
    }
    out.push(col);
  }
  return out;
}

/** 0 to 4, the shade of a cell. */
export const level = (n: number): number => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4);

/** Days in a row with at least one note, ending today or yesterday. */
export function streak(today: Date, counts: Map<string, number>): number {
  let n = 0;
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!counts.get(dayKey(d))) d.setDate(d.getDate() - 1);
  while (counts.get(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
