// Lean notes and their alignment with prose. Pure. A Lean note is a markdown note with ```lean
// blocks; this reads the declarations out of them (name, docstring, binders, hypotheses, flags and
// the `-- step: id` tags that tie a lemma to a prose block `^id`), builds the step-to-lemma
// alignment for a prose note, and lists the hypotheses the prose never mentions. Heuristic, meant
// to highlight what to look at, never to certify.

export type Hyp = { name: string; type: string; implicit: boolean };
export type Decl = { kind: string; name: string; doc: string; binders: string; hyps: Hyp[]; statement: string; flags: string[]; steps: string[]; line: number };

const FLAG_RE: [RegExp, string][] = [
  [/\bsorry\b/, "sorry"], [/\badmit\b/, "admit"], [/\baxiom\b/, "axiom"], [/\bnative_decide\b/, "native_decide"], [/\bunsafe\b/, "unsafe"],
  [/\bpartial\s+def\b/, "partial def"], [/set_option\s+maxHeartbeats/, "maxHeartbeats raised"], [/\bopaque\b/, "opaque"],
];

/** Every ```lean block of a note, joined. */
export function leanCode(content: string): string {
  return [...content.matchAll(/```lean\s*\n([\s\S]*?)```/g)].map((m) => m[1]).join("\n\n");
}
export const isLeanNote = (content: string): boolean => /```lean\b/.test(content);

/** Split `(h : P) {x : T} [inst : C]` style binders; implicit ones are the braces and brackets. */
export function parseBinders(binders: string): Hyp[] {
  const out: Hyp[] = [];
  for (const m of binders.matchAll(/([({[⦃])\s*([^:(){}[\]⦃⦄]+?)\s*:\s*([^(){}[\]⦃⦄]+?)\s*[)}\]⦄]/g)) {
    const implicit = m[1] !== "(";
    for (const name of m[2].trim().split(/\s+/)) out.push({ name, type: m[3].trim(), implicit });
  }
  return out;
}

/** Declarations in order: theorem, lemma, def, instance, axiom, with their docstring and step tags. */
export function parseLean(code: string): Decl[] {
  const lines = code.split("\n");
  const out: Decl[] = [];
  let doc = "";
  let steps: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const d = /^\s*(?:@\[[^\]]*\]\s*)?(?:private\s+|protected\s+|noncomputable\s+)*(theorem|lemma|def|instance|axiom|abbrev|structure)\s+([^\s:({[⦃]+)(.*)$/.exec(line);
    if (/^\s*\/--/.test(line)) {
      const buf: string[] = [];
      let j = i;
      for (; j < lines.length; j++) { buf.push(lines[j]); if (lines[j].includes("-/")) break; }
      doc = buf.join("\n").replace(/^\s*\/--\s?/, "").replace(/\s*-\/\s*$/, "").trim();
      i = j + 1;
      continue;
    }
    const tag = /^\s*--\s*(?:step|note)s?\s*:\s*(.+)$/.exec(line);
    if (tag) { steps.push(...tag[1].split(/[,\s]+/).map((s) => s.replace(/^\^/, "").trim()).filter(Boolean)); i++; continue; }
    if (!d) { if (line.trim() && !line.trim().startsWith("--")) { doc = ""; steps = []; } i++; continue; }
    // the signature runs until `:=`, `where` or `|` at the start of a line
    let sig = d[3];
    let j = i + 1;
    while (!/:=|\bwhere\b/.test(sig) && j < lines.length && !/^\s*\|/.test(lines[j]) && !/^\s*(theorem|lemma|def|instance|axiom|abbrev|structure)\b/.test(lines[j])) { sig += ` ${lines[j].trim()}`; j++; }
    const head = sig.split(/:=|\bwhere\b/)[0];
    const colon = splitSignature(head);
    const bodyEnd = (() => { let k = j; while (k < lines.length && !/^\s*(?:@\[[^\]]*\]\s*)?(?:private\s+|protected\s+|noncomputable\s+)*(theorem|lemma|def|instance|axiom|abbrev|structure|\/--|end\b|namespace\b|section\b)/.test(lines[k])) k++; return k; })();
    const body = lines.slice(i, bodyEnd).join("\n");
    const flags = FLAG_RE.filter(([re]) => re.test(body)).map(([, f]) => f);
    if (d[1] === "axiom") flags.unshift("axiom");
    out.push({ kind: d[1], name: d[2], doc, binders: colon.binders, hyps: parseBinders(colon.binders), statement: colon.statement, flags: [...new Set(flags)], steps, line: i + 1 });
    doc = "";
    steps = [];
    i = Math.max(j, i + 1);
  }
  return out;
}

/** Binders up to the top-level colon, statement after it. */
function splitSignature(head: string): { binders: string; statement: string } {
  let depth = 0;
  for (let k = 0; k < head.length; k++) {
    const ch = head[k];
    if ("({[⦃".includes(ch)) depth++;
    else if (")}]⦄".includes(ch)) depth--;
    else if (ch === ":" && depth === 0 && head[k + 1] !== "=") return { binders: head.slice(0, k).trim(), statement: head.slice(k + 1).trim() };
  }
  return { binders: head.trim(), statement: "" };
}

/** Block ids in prose (` ^step-3` at a line end) with the line's text. */
export function proseSteps(content: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  for (const line of content.split("\n")) {
    const m = /^(.*?)\s\^([A-Za-z0-9-]+)\s*$/.exec(line);
    if (m) out.push({ id: m[2], text: m[1].trim() });
  }
  return out;
}

export type Alignment = { backed: { id: string; text: string; lemmas: string[] }[]; informalOnly: { id: string; text: string }[]; formalOnly: Decl[]; coverage: number };
/** Which prose steps have a tagged lemma, which do not, and which lemmas no step cites. */
export function align(prose: string, decls: Decl[]): Alignment {
  const steps = proseSteps(prose);
  const byStep = new Map<string, string[]>();
  for (const d of decls) for (const s of d.steps) byStep.set(s, [...(byStep.get(s) ?? []), d.name]);
  const backed = steps.filter((s) => byStep.has(s.id)).map((s) => ({ ...s, lemmas: byStep.get(s.id)! }));
  const informalOnly = steps.filter((s) => !byStep.has(s.id));
  const cited = new Set(backed.flatMap((b) => b.lemmas));
  const formalOnly = decls.filter((d) => (d.kind === "theorem" || d.kind === "lemma") && !cited.has(d.name) && !d.steps.length);
  return { backed, informalOnly, formalOnly, coverage: steps.length ? backed.length / steps.length : 0 };
}

/** Tokens of a Lean type that carry meaning in prose: identifiers of two or more letters and numbers. */
const tokens = (s: string): string[] => [...new Set((s.match(/[A-Za-zα-ωΑ-Ω_][A-Za-z0-9α-ωΑ-Ω_'.]*|\d+/g) ?? []).map((t) => t.split(".").pop()!.replace(/'+$/, "")).filter((t) => t && !/^(fun|λ|Type|Prop|Sort|Nat|Int|Real|ℕ|ℤ|ℝ|the|of|in|and|by)$/.test(t)).map((t) => t.toLowerCase()))];
const mentioned = (text: string, t: string): boolean => new RegExp(`(^|[^a-z0-9α-ω])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9α-ω])`).test(text);
/** Hypotheses with a number or a name the prose never mentions: the classic way a formalisation proves less than the paper claims. */
export function unmentionedHyps(decl: Decl, prose: string): Hyp[] {
  const text = prose.toLowerCase();
  return decl.hyps.filter((h) => !h.implicit && !/^(inst|_)/.test(h.name) && !h.type.match(/^(Type|Sort|Prop)\b/)).filter((h) => {
    const ts = tokens(h.type);
    return ts.length > 0 && ts.some((t) => !mentioned(text, t));
  });
}

/** The English next to the Lean: docstring, or a bare signature if there is none. */
export const statementCard = (d: Decl): { english: string; lean: string } => ({ english: d.doc || "(no docstring: write the English statement as a `/-- … -/` docstring so it lives with the Lean)", lean: `${d.kind} ${d.name} ${d.binders} : ${d.statement}`.replace(/\s+/g, " ").trim() });
