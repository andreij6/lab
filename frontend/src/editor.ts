// Pure editing behaviours for a plain textarea, the way Obsidian's editor handles lists: Enter
// continues a list item (numbers increment, task boxes stay empty), Enter on an empty item ends
// the list, Tab / Shift+Tab indent or outdent the line, and a task checkbox in the preview flips
// its `[ ]` in the source.

export type Edit = { value: string; start: number; end: number };

const ITEM = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/;
const INDENT = "\t";

function lineBounds(value: string, pos: number): [number, number] {
  const s = value.lastIndexOf("\n", pos - 1) + 1;
  const e0 = value.indexOf("\n", pos);
  return [s, e0 < 0 ? value.length : e0];
}

/** Enter inside a list item; `null` when it is not a list line (let the browser insert a newline). */
export function continueList(value: string, start: number): Edit | null {
  const [s, e] = lineBounds(value, start);
  const line = value.slice(s, e);
  const m = ITEM.exec(line);
  if (!m) return null;
  const [, indent, marker, gap, task, rest] = m;
  if (!rest.trim() && start >= e) {
    // empty item: end the list (drop the marker)
    const v = value.slice(0, s) + indent + value.slice(e);
    const p = s + indent.length;
    return { value: v, start: p, end: p };
  }
  const next = /^\d+/.test(marker) ? `${Number.parseInt(marker, 10) + 1}${marker.slice(-1)}` : marker;
  const ins = `\n${indent}${next}${gap}${task ? "[ ] " : ""}`;
  const v = value.slice(0, start) + ins + value.slice(start);
  return { value: v, start: start + ins.length, end: start + ins.length };
}

/** Tab / Shift+Tab: indent or outdent every line in the selection (lists or not). */
export function indentLines(value: string, start: number, end: number, out = false): Edit {
  const [s] = lineBounds(value, start);
  const [, e] = lineBounds(value, Math.max(start, end - (end > start ? 1 : 0)));
  const lines = value.slice(s, e).split("\n");
  let firstDelta = 0;
  let total = 0;
  const changed = lines.map((l, i) => {
    let d = 0;
    let n = l;
    if (out) {
      if (l.startsWith(INDENT)) { n = l.slice(1); d = -1; }
      else if (l.startsWith("    ")) { n = l.slice(4); d = -4; }
      else if (l.startsWith("  ")) { n = l.slice(2); d = -2; }
    } else { n = INDENT + l; d = 1; }
    if (i === 0) firstDelta = d;
    total += d;
    return n;
  });
  const v = value.slice(0, s) + changed.join("\n") + value.slice(e);
  const ns = Math.max(s, start + firstDelta);
  return { value: v, start: ns, end: start === end ? ns : Math.max(ns, end + total) };
}

/** Flip the n-th task checkbox (`- [ ]` / `- [x]`) in the source, counting the way the renderer does. */
export function toggleTask(value: string, n: number): string {
  let i = -1;
  return value.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/gm, (m, pre: string, box: string) => {
    i++;
    return i === n ? `${pre}[${box === " " ? "x" : " "}]` : m;
  });
}
