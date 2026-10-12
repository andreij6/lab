// Pure note logic, no DOM: link and tag syntax, link resolution, the notebook index, search and the
// folder tree. The syntax rules are the ones REA observed in Obsidian 1.14.4
// (docs/REVERSE_ENGINEERING.md); everything here runs against notes already loaded from the notebook
// canister, the way Obsidian keeps its metadata cache on the client.

export type NoteLike = { path: string; content: string; agent?: string | null };

export const stem = (p: string): string => p.replace(/\.md$/, "");
export const base = (p: string): string => stem(p).split("/").pop() ?? "";
export const dir = (p: string): string => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");

/** Fenced blocks and inline code: links and tags inside them are not links and tags. */
export const CODE_RE = /```[\s\S]*?(?:```|$)|`[^`\n]+`/g;
/** Apply `f` to every stretch of `s` that is not code, leaving the code untouched. */
export function outsideCode(s: string, f: (chunk: string) => string): string {
  let out = "";
  let last = 0;
  for (const m of s.matchAll(CODE_RE)) {
    out += f(s.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + f(s.slice(last));
}
const noCode = (s: string) => s.replace(CODE_RE, " ");

/** `[[target]]`, `[[target|alias]]`, `[[target#heading]]`, `![[embed]]`; no nesting (observed: /^(!?)\[\[(.+?)]]/). */
export const LINK_RE = /(!?)\[\[([^[\]]+?)\]\]/g;
export type Link = { target: string; alias: string; heading: string; embed: boolean; raw: string };

export function parseLinks(content: string): Link[] {
  const out: Link[] = [];
  for (const m of noCode(content).matchAll(LINK_RE)) {
    let inner = m[2].trim();
    let alias = "";
    const bar = inner.indexOf("|");
    if (bar >= 0) {
      alias = inner.slice(bar + 1).trim();
      inner = inner.slice(0, bar).trim();
    }
    let heading = "";
    const hash = inner.indexOf("#");
    if (hash >= 0) {
      heading = inner.slice(hash + 1).trim();
      inner = inner.slice(0, hash).trim();
    }
    out.push({ target: inner, alias, heading, embed: m[1] === "!", raw: m[0] });
  }
  return out;
}

/** `#tag` after start or whitespace, Obsidian's character class; purely numeric tags do not count. */
export const TAG_RE = /(^|\s)#([^ -⁯⸀-⹿'!"#$%&()*+,.:;<=>?@^`{|}~[\]\\\s]+)/g;

/** Minimal front matter: `---` block at the very top with `key: value` lines (and `tags: [a, b]`). */
export function frontmatter(content: string): { data: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!m) return { data: {}, body: content };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, body: content.slice(m[0].length) };
}

/** Front matter `aliases: [a, b]` (or `alias:`), the other names a note answers to. */
export function parseAliases(content: string): string[] {
  const fm = frontmatter(content).data;
  const raw = fm.aliases ?? fm.alias;
  if (!raw) return [];
  return raw.replace(/^\[|\]$/g, "").split(",").map((a) => a.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

export type Heading = { level: number; text: string; line: number };
/** ATX headings outside code, for the outline and `[[Note#Heading]]`. */
export function headings(content: string): Heading[] {
  const out: Heading[] = [];
  const lines = noCode(frontmatter(content).body).split(/\r?\n/);
  const offset = content.split(/\r?\n/).length - lines.length;
  lines.forEach((l, i) => {
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l);
    if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i + offset });
  });
  return out;
}

/** The part of a note under `heading` up to the next heading of the same or a higher level (for `![[Note#Heading]]`). */
export function section(content: string, heading: string): string | undefined {
  const lines = content.split(/\r?\n/);
  const hs = headings(content);
  const i = hs.findIndex((h) => h.text.toLowerCase() === heading.trim().toLowerCase());
  if (i < 0) return undefined;
  const start = hs[i].line;
  const end = hs.slice(i + 1).find((h) => h.level <= hs[i].level)?.line ?? lines.length;
  return lines.slice(start, end).join("\n");
}

/** Rewrite (or add) the front matter block with `data`; an empty object strips it. */
export function setFrontmatter(content: string, data: Record<string, string>): string {
  const { body } = frontmatter(content);
  const keys = Object.keys(data).filter((k) => k.trim());
  if (!keys.length) return body;
  return `---\n${keys.map((k) => `${k.trim()}: ${data[k]}`).join("\n")}\n---\n${body}`;
}

export function parseTags(content: string): string[] {
  const { data, body } = frontmatter(content);
  const tags = new Set<string>();
  for (const m of noCode(body).matchAll(TAG_RE)) if (/[^0-9]/.test(m[2])) tags.add(m[2]);
  const fm = data.tags ?? data.tag;
  if (fm) for (const t of fm.replace(/^\[|\]$/g, "").split(/[,\s]+/)) if (t && /[^0-9]/.test(t)) tags.add(t.replace(/^#/, "").replace(/^["']|["']$/g, ""));
  return [...tags];
}

/**
 * Where a link points (observed getLinkpathDest): a target with a `/` is a path, tried as is and
 * with `.md`; otherwise the note with that name, case-insensitively, the shortest path winning.
 */
export function resolve(target: string, paths: Iterable<string>, aliases?: Map<string, string>): string | undefined {
  const all = [...paths];
  const byAlias = aliases?.get(target.trim().toLowerCase());
  if (target.includes("/")) {
    const t = target.replace(/^\//, "");
    return all.find((p) => p === t) ?? all.find((p) => p === `${t}.md`);
  }
  const want = target.trim().toLowerCase();
  const hits = all.filter((p) => base(p).toLowerCase() === want || p.toLowerCase() === want);
  hits.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return hits[0] ?? byAlias;
}

export type Index = {
  /** path -> resolved link targets (paths) */
  links: Map<string, Set<string>>;
  /** path -> link targets that match no note */
  unresolved: Map<string, Set<string>>;
  /** path -> notes that link to it */
  backlinks: Map<string, Set<string>>;
  /** tag -> paths */
  tags: Map<string, Set<string>>;
  /** lower-cased alias -> path */
  aliases: Map<string, string>;
};

export function buildIndex(notes: NoteLike[]): Index {
  const paths = notes.map((n) => n.path);
  const idx: Index = { links: new Map(), unresolved: new Map(), backlinks: new Map(), tags: new Map(), aliases: new Map() };
  for (const n of notes) for (const a of parseAliases(n.content)) if (!idx.aliases.has(a.toLowerCase())) idx.aliases.set(a.toLowerCase(), n.path);
  for (const n of notes) {
    const links = new Set<string>();
    const unresolved = new Set<string>();
    for (const l of parseLinks(n.content)) {
      const dest = l.target ? resolve(l.target, paths, idx.aliases) : n.path;
      if (dest) {
        links.add(dest);
        if (!idx.backlinks.has(dest)) idx.backlinks.set(dest, new Set());
        idx.backlinks.get(dest)!.add(n.path);
      } else unresolved.add(l.target);
    }
    idx.links.set(n.path, links);
    idx.unresolved.set(n.path, unresolved);
    for (const t of parseTags(n.content)) {
      if (!idx.tags.has(t)) idx.tags.set(t, new Set());
      idx.tags.get(t)!.add(n.path);
    }
  }
  return idx;
}

export type Hit = { path: string; snippet: string };

/**
 * Case-insensitive search with Obsidian's basic operators: `tag:x`, `path:x`, `file:x`, `-word`
 * excludes, `"a phrase"` keeps spaces. Name matches come first, then content, with one snippet.
 */
export function search(notes: NoteLike[], query: string, limit = 50): Hit[] {
  const terms = [...query.matchAll(/(-?)(?:(tag|path|file):)?(?:"([^"]+)"|(\S+))/g)].map((m) => ({ not: m[1] === "-", op: m[2], v: (m[3] ?? m[4]).toLowerCase() })).filter((t) => t.v);
  if (!terms.length) return [];
  const byName: Hit[] = [];
  const byBody: Hit[] = [];
  for (const n of notes) {
    const name = base(n.path).toLowerCase();
    const path = n.path.toLowerCase();
    const body = n.content.toLowerCase();
    let tags: string[] | undefined;
    let ok = true;
    let nameHit = false;
    let firstIdx = -1;
    let firstLen = 0;
    for (const t of terms) {
      let hit: boolean;
      if (t.op === "tag") hit = (tags ??= parseTags(n.content).map((x) => x.toLowerCase())).some((x) => x === t.v.replace(/^#/, "") || x.startsWith(`${t.v.replace(/^#/, "")}/`));
      else if (t.op === "path") hit = path.includes(t.v);
      else if (t.op === "file") hit = name.includes(t.v);
      else {
        const inName = name.includes(t.v);
        const i = body.indexOf(t.v);
        hit = inName || i >= 0;
        if (!t.not && inName) nameHit = true;
        if (!t.not && i >= 0 && firstIdx < 0) { firstIdx = i; firstLen = t.v.length; }
      }
      if (hit === t.not) { ok = false; break; }
    }
    if (!ok) continue;
    if (nameHit) byName.push({ path: n.path, snippet: "" });
    else byBody.push({ path: n.path, snippet: firstIdx >= 0 ? n.content.slice(Math.max(0, firstIdx - 40), firstIdx + firstLen + 60).replace(/\s+/g, " ") : "" });
  }
  return [...byName, ...byBody].slice(0, limit);
}

export type Folder = { name: string; path: string; folders: Folder[]; files: string[] };

/** Folders and files from file paths plus explicit (possibly empty) folders. */
export function tree(paths: Iterable<string>, folders: Iterable<string> = []): Folder {
  const root: Folder = { name: "", path: "", folders: [], files: [] };
  const descend = (parts: string[]): Folder => {
    let node = root;
    for (const part of parts) {
      let next = node.folders.find((f) => f.name === part);
      if (!next) {
        next = { name: part, path: node.path ? `${node.path}/${part}` : part, folders: [], files: [] };
        node.folders.push(next);
      }
      node = next;
    }
    return node;
  };
  for (const f of [...folders].sort((a, b) => a.localeCompare(b))) descend(f.split("/"));
  for (const p of [...paths].sort((a, b) => a.localeCompare(b))) descend(p.split("/").slice(0, -1)).files.push(p);
  const sortAll = (f: Folder) => {
    f.folders.sort((a, b) => a.name.localeCompare(b.name)).forEach(sortAll);
  };
  sortAll(root);
  return root;
}

/** Subsequence match with a score: contiguous and word-start hits score higher. Lower is better; -1 is no match. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  const i = t.indexOf(q);
  if (i >= 0) return i === 0 ? 0 : 1 + i / 100;
  let ti = 0;
  let score = 10;
  for (const ch of q) {
    const j = t.indexOf(ch, ti);
    if (j < 0) return -1;
    score += j - ti + (j > 0 && /[\s/_-]/.test(t[j - 1]) ? 0 : 1);
    ti = j + 1;
  }
  return score;
}

/** Notes ranked for the quick switcher: best fuzzy match on the name, then on the path. */
export function fuzzy(query: string, paths: Iterable<string>, limit = 12): string[] {
  const scored: [number, string][] = [];
  for (const p of paths) {
    const sb = fuzzyScore(query, base(p));
    const sp = fuzzyScore(query, stem(p));
    const s = sb >= 0 ? sb : sp >= 0 ? 20 + sp : -1;
    if (s >= 0) scored.push([s, p]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).slice(0, limit).map(([, p]) => p);
}

/** The first line of `from` that links to `target`, for a backlink's context. */
export function backlinkContext(from: NoteLike, target: string, paths: Iterable<string>): string {
  const all = [...paths];
  for (const line of from.content.split(/\r?\n/)) {
    for (const l of parseLinks(line)) {
      const dest = l.target ? resolve(l.target, all) : from.path;
      if (dest === target) return line.trim();
    }
  }
  return "";
}

export type GraphNode = { id: string; label: string; degree: number; unresolved: boolean; agent?: string };
export type GraphEdge = { source: string; target: string };

/** Nodes and edges for the knowledge graph; `focus` + `depth` cut it down to a local graph. */
export function graphData(notes: NoteLike[], idx: Index, opts: { focus?: string; depth?: number; unresolved?: boolean } = {}): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const ids = new Set(notes.map((n) => n.path));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const [from, tos] of idx.links) for (const to of tos) if (from !== to && !seen.has(`${from}\u0000${to}`) && !seen.has(`${to}\u0000${from}`)) { seen.add(`${from}\u0000${to}`); edges.push({ source: from, target: to }); }
  if (opts.unresolved) for (const [from, tos] of idx.unresolved) for (const t of tos) { ids.add(`?${t}`); edges.push({ source: from, target: `?${t}` }); }
  let keep = ids;
  if (opts.focus) {
    keep = new Set([opts.focus]);
    let frontier = [opts.focus];
    for (let d = 0; d < (opts.depth ?? 1); d++) {
      const next: string[] = [];
      for (const e of edges) {
        if (frontier.includes(e.source) && !keep.has(e.target)) { keep.add(e.target); next.push(e.target); }
        if (frontier.includes(e.target) && !keep.has(e.source)) { keep.add(e.source); next.push(e.source); }
      }
      frontier = next;
    }
  }
  const es = edges.filter((e) => keep.has(e.source) && keep.has(e.target));
  const degree = new Map<string, number>();
  for (const e of es) { degree.set(e.source, (degree.get(e.source) ?? 0) + 1); degree.set(e.target, (degree.get(e.target) ?? 0) + 1); }
  const agentOf = new Map(notes.filter((n) => n.agent).map((n) => [n.path, n.agent!]));
  const nodes = [...keep].map((id) => ({ id, label: id.startsWith("?") ? id.slice(1) : base(id) || id, degree: degree.get(id) ?? 0, unresolved: id.startsWith("?"), agent: agentOf.get(id) }));
  return { nodes, edges: es };
}

/** A free `Untitled.md` (then `Untitled 1.md`, …) in `folder`, as Obsidian does for new notes. */
export function untitled(paths: Iterable<string>, folder = ""): string {
  const have = new Set(paths);
  for (let i = 0; ; i++) {
    const p = `${folder ? `${folder}/` : ""}Untitled${i ? ` ${i}` : ""}.md`;
    if (!have.has(p)) return p;
  }
}
