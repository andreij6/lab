// Problems, pure: the note shape (`type: problem`), its claims, and the hash the registry stamps on
// checks. The UI and the registry calls live in main.ts.

import { frontmatter } from "./notes.ts";

export const FIELDS: [string, string][] = [
  ["mathematics", "Mathematics"], ["physics", "Physics"], ["computer-science", "Computer science"], ["biology", "Biology"],
  ["chemistry", "Chemistry"], ["engineering", "Engineering"], ["economics", "Economics"], ["open-problems", "Other"],
];
export const fieldLabel = (f: string) => FIELDS.find(([v]) => v === f)?.[1] ?? f;

export type Claim = { n: number; title: string; lean: boolean };
export type ProblemNote = { field: string; status: "open" | "partial" | "solved"; statement: string; claims: Claim[]; depends: string[] };

export const isProblemNote = (content: string) => frontmatter(content).data.type?.trim().toLowerCase() === "problem";

/** A new problem note: the statement, a first claim with room for Lean, attempts and related notes. */
export function problemTemplate(title: string, field: string, statement: string): string {
  return `---
type: problem
field: ${field}
status: open
tags: [problem, ${field}]
---
# ${title}

## Statement

${statement.trim() || "What is being asked, precisely. Name the objects, the hypotheses and what would count as an answer."}

## Claims

### Claim 1: ${title}

A claim is one thing someone else can check. Put the Lean statement (and proof) in a \`lean\` block; prose alone is fine too.

\`\`\`lean
theorem claim_1 : True := by
  trivial
\`\`\`

## Attempts

Attempts others send back are merged here by you, each under its own heading, credited to whoever sent it.

## Related

-
`;
}

/** What the registry needs from a problem note: field, status, the statement, numbered claims
 *  (`### ` headings under `## Claims`, in order; a claim is "lean" when its section has a lean block). */
export function parseProblem(content: string): ProblemNote {
  const { data, body } = frontmatter(content);
  const st = (data.status ?? "open").trim().toLowerCase();
  const status = st === "solved" ? "solved" : st === "partial" ? "partial" : "open";
  const section = (name: string) => {
    const m = new RegExp(`^## ${name}[ \\t]*$`, "mi").exec(body);
    if (!m) return "";
    const rest = body.slice(m.index + m[0].length), next = rest.search(/\n## /);
    return (next < 0 ? rest : rest.slice(0, next)).trim();
  };
  const statement = section("Statement").replace(/\s+/g, " ").slice(0, 2000);
  const claims: Claim[] = [];
  const cs = section("Claims");
  const parts = cs.split(/^### /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n"), head = (nl < 0 ? p : p.slice(0, nl)).trim(), rest = nl < 0 ? "" : p.slice(nl);
    claims.push({ n: claims.length + 1, title: head.replace(/^claim\s*\d+\s*[:.\-–]\s*/i, "") || head, lean: /```lean/.test(rest) });
  }
  const depends = [...(data.depends ?? "").matchAll(/\[\[([^\]]+)\]\]|([^,\[\]]+)/g)].map((m) => (m[1] ?? m[2]).trim()).filter(Boolean);
  return { field: (data.field ?? "open-problems").trim().toLowerCase(), status, statement, claims, depends };
}

/** sha256 of the note, hex: what the registry stamps on every check so a changed note shows as stale. */
export async function noteHash(content: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The problem note with an attempt merged under `## Attempts`, credited. */
export function mergeAttempt(content: string, by: string, title: string, attempt: string): string {
  const body = frontmatter(attempt).body.replace(/^#\s[^\n]*\n/, "").trim();
  const block = `\n### ${title} — by ${by}\n\n${body}\n`;
  const m = /^## Attempts[ \t]*$/m.exec(content);
  if (!m) return `${content.replace(/\s+$/, "")}\n\n## Attempts\n${block}`;
  const at = m.index + m[0].length;
  const rest = content.slice(at), next = rest.search(/\n## /);
  const end = next < 0 ? content.length : at + next;
  return `${content.slice(0, end).replace(/\s+$/, "")}\n${block}${content.slice(end)}`;
}
