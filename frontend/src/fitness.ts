// The Fitness kit, all pure: workout notes whose lines are sets (`- Squat: 100 x 5, 105 x 3` or
// `- Squat: 3x5 @ 100`), personal records by estimated one-rep max, progress per exercise, weekly
// volume and distance, and runs from GPX routes (the Trips kit's ```track blocks).
import { frontmatter, type NoteLike } from "./notes.ts";
import { parseTrackBlock, trackStats } from "./outdoor.ts";

export type WorkSet = { exercise: string; weight: number; reps: number };
export type Workout = { path: string; title: string; date: string; kind: string; unit: string; sets: WorkSet[]; km?: number; minutes?: number };
export const isWorkout = (content: string) => (frontmatter(content).data.type ?? "").trim().toLowerCase() === "workout";
const n = (s: string) => Number(s.replace(",", "."));

/** One line's sets. `W x R` entries are single sets; `S x R @ W` is S sets of R at W; `@ bw` is
 *  bodyweight, counted as 0. Units after numbers are ignored. */
export function parseSets(line: string): WorkSet[] {
  const m = /^\s*[-*+]\s+(?:\[[ xX]\]\s+)?([^:]+?):\s*(.+)$/.exec(line);
  if (!m) return [];
  const exercise = m[1].trim(), rhs = m[2].replace(/(kg|lbs?|#)\b/gi, "");
  const many = /^\s*(\d+)\s*[x×]\s*(\d+)\s*@\s*(bw|[\d.,]+)\s*$/i.exec(rhs);
  if (many) return Array.from({ length: Math.min(50, Number(many[1])) }, () => ({ exercise, weight: /bw/i.test(many[3]) ? 0 : n(many[3]), reps: Number(many[2]) }));
  const out: WorkSet[] = [];
  for (const part of rhs.split(",")) {
    const s = /^\s*([\d.]+)\s*[x×]\s*(\d+)\s*$/i.exec(part);
    if (s) out.push({ exercise, weight: n(s[1]), reps: Number(s[2]) });
  }
  return out;
}
const TRACK_RE = /```track\n([\s\S]*?)```/;
export function workout(path: string, content: string): Workout {
  const fm = frontmatter(content);
  const d = fm.data;
  let code = false;
  const sets = fm.body.split("\n").flatMap((l) => { if (/^\s*```/.test(l)) { code = !code; return []; } return code ? [] : parseSets(l); });
  const track = TRACK_RE.exec(fm.body);
  const km = Number(d.distance_km) || (track ? Math.round(trackStats(parseTrackBlock(track[1]).points).km * 100) / 100 : undefined);
  return { path, title: path.split("/").pop()!.replace(/\.md$/, ""), date: (d.date ?? "").trim(), kind: (d.kind ?? (km ? "run" : "strength")).trim().toLowerCase(), unit: (d.unit ?? "kg").trim() || "kg", sets, km: km || undefined, minutes: Number(d.minutes) || undefined };
}
export const workouts = (notes: NoteLike[]) => notes.filter((x) => x.path.endsWith(".md") && isWorkout(x.content)).map((x) => workout(x.path, x.content)).filter((w) => w.date).sort((a, b) => a.date.localeCompare(b.date) || a.path.localeCompare(b.path));

/** Epley's estimate of the most you could lift once. */
export const e1rm = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));
const best = (sets: WorkSet[]) => sets.reduce<WorkSet | undefined>((b, s) => (!b || e1rm(s.weight, s.reps) > e1rm(b.weight, b.reps) ? s : b), undefined);

export type Record = { exercise: string; set: WorkSet; e1rm: number; date: string; path: string };
/** The best set ever per weighted exercise, by estimated one-rep max. */
export function records(ws: Workout[]): Record[] {
  const by = new Map<string, Record>();
  for (const w of ws) for (const s of w.sets) {
    if (!s.weight) continue;
    const key = s.exercise.toLowerCase(), e = e1rm(s.weight, s.reps);
    if (!by.has(key) || e > by.get(key)!.e1rm) by.set(key, { exercise: s.exercise, set: s, e1rm: e, date: w.date, path: w.path });
  }
  return [...by.values()].sort((a, b) => b.date.localeCompare(a.date) || a.exercise.localeCompare(b.exercise));
}
/** Exercises where this workout beat every earlier one. */
export function newRecords(ws: Workout[], path: string): string[] {
  const w = ws.find((x) => x.path === path);
  if (!w) return [];
  const before = records(ws.filter((x) => x.date < w.date || (x.date === w.date && x.path < w.path)));
  const prev = new Map(before.map((r) => [r.exercise.toLowerCase(), r.e1rm]));
  return [...new Set(w.sets.filter((s) => s.weight && prev.has(s.exercise.toLowerCase()) && e1rm(s.weight, s.reps) > prev.get(s.exercise.toLowerCase())!).map((s) => s.exercise))];
}
/** The best estimated one-rep max per workout for one exercise, oldest first. */
export function progress(ws: Workout[], exercise: string): { date: string; e1rm: number }[] {
  return ws.flatMap((w) => { const b = best(w.sets.filter((s) => s.exercise.toLowerCase() === exercise.toLowerCase() && s.weight)); return b ? [{ date: w.date, e1rm: Math.round(e1rm(b.weight, b.reps) * 10) / 10 }] : []; });
}
const monday = (d: string) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
/** Sessions, lifted volume (weight × reps) and distance per week for the last `n` weeks. */
export function weekly(ws: Workout[], today: string, weeks = 8): { week: string; sessions: number; volume: number; km: number }[] {
  const m = monday(today);
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(`${m}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 7 * (weeks - 1 - i));
    const week = d.toISOString().slice(0, 10), these = ws.filter((w) => monday(w.date) === week);
    return { week, sessions: these.length, volume: these.reduce((a, w) => a + w.sets.reduce((b, s) => b + s.weight * s.reps, 0), 0), km: Math.round(these.reduce((a, w) => a + (w.km ?? 0), 0) * 10) / 10 };
  });
}
/** Minutes per km as "5:12 /km". */
export function pace(minutes: number | undefined, km: number | undefined): string | undefined {
  if (!minutes || !km) return undefined;
  const p = minutes / km, mm = Math.floor(p), ss = Math.round((p - mm) * 60);
  return `${ss === 60 ? mm + 1 : mm}:${String(ss === 60 ? 0 : ss).padStart(2, "0")} /km`;
}
export const WORKOUT_TEMPLATE = (date: string, kind: string, sets: string, minutes?: number, unit = "kg") => `---\ntype: workout\ndate: ${date}\nkind: ${kind}\nunit: ${unit}\nminutes: ${minutes ?? ""}\n---\n\n# ${kind[0].toUpperCase()}${kind.slice(1)} · ${date}\n\n${sets.trim() || (kind === "strength" ? "- Squat: 3x5 @ 60\n- Bench press: 50 x 8, 50 x 8, 52.5 x 6" : "")}\n\n## How it felt\n\n`;
