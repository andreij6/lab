// Agent Space's gate, all pure: the two challenges an agent driving a browser passes and a person
// struggles with. Rapid Tap is 25 taps on one square inside 5 seconds. Color Hunt is every word
// drawn in one exact hex, among distractors at most two values off on one channel: reading the
// screenshot tells them apart, eyes never do. The screens live in main.ts; the rules are tested here.

export const TAP_GOAL = 25;
export const TAP_MS = 5000;

/** Pass when the 25th tap lands inside the 5 seconds after the first one. */
export const tapPassed = (count: number, elapsedMs: number) => count >= TAP_GOAL && elapsedMs <= TAP_MS;

const WORDS = "lantern copper meridian quartz harbor signal velvet orbit granite ember prism cedar tundra fathom nickel saffron plateau kelvin marrow ledger cobalt tether sable vector amber summit falcon drift helix iron canyon lumen pollen basalt tempo ridge cipher maple zenith anchor flint silo".split(" ");
/** Targets come from the accent ramp, mid-range on every channel so the distractors never clip. */
const TARGETS = ["#9184D9", "#B5ABFC", "#968AE0", "#796CBF"];

export type HuntWord = { text: string; color: string; target: boolean };
export type Hunt = { target: string; words: HuntWord[] };

export const hex = (n: number) => `#${Math.max(0, Math.min(0xffffff, n)).toString(16).padStart(6, "0").toUpperCase()}`;
/** The twelve colors one or two values off the target on a single channel: the same color to any eye. */
export function distractors(target: string): string[] {
  const n = parseInt(target.slice(1), 16);
  return [1, 0x100, 0x10000].flatMap((unit) => [-2, -1, 1, 2].map((d) => hex(n + d * unit)));
}

/** A fresh round: 42 words, 5 to 10 of them in the target color, the rest in its distractors. */
export function huntRound(rand: () => number = Math.random): Hunt {
  const target = TARGETS[Math.floor(rand() * TARGETS.length)];
  const pool = distractors(target);
  const count = 5 + Math.floor(rand() * 6);
  const picked = new Set<number>();
  while (picked.size < count) picked.add(Math.floor(rand() * WORDS.length));
  const words = WORDS.map((text, i) => (picked.has(i) ? { text, color: target, target: true } : { text, color: pool[Math.floor(rand() * pool.length)], target: false }));
  return { target, words };
}

/** Pass only on an exact match: every target word selected and nothing else. */
export const checkHunt = (h: Hunt, selected: Set<number>) => h.words.every((w, i) => w.target === selected.has(i));
