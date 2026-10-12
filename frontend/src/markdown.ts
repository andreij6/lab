// Obsidian Flavored Markdown on top of marked: [[links]] and ![[embeds]], #tags, ==highlights==,
// %%comments%%, callouts (> [!note]), $math$ via KaTeX, footnotes, fenced code highlighting,
// Mermaid diagrams (rendered after insertion), block ids (^id), heading ids, markdown links to
// notes and relative images as attachments. Output is sanitized with DOMPurify.
import DOMPurify from "dompurify";
import { parseTrackBlock, trackHtml } from "./outdoor.ts";
import hljs from "highlight.js/lib/common";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Marked, type Tokens } from "marked";
import markedFootnote from "marked-footnote";
import { markedHighlight } from "marked-highlight";
import { isExcalidraw } from "./excalidraw";
import { LINK_RE, TAG_RE, base, frontmatter, outsideCode, parseLinks, section, stem } from "./notes";
import { leanCode, parseLean, statementCard } from "./lean";

export type RenderCtx = {
  /** the note being rendered (for `[[#heading]]` and cycle checks) */
  self?: string;
  resolve: (target: string) => string | undefined;
  /** content of a note, for `![[embeds]]` */
  note: (path: string) => string | undefined;
  /** data: URL of an attachment when loaded; undefined queues a fetch and shows a placeholder */
  attachment: (path: string) => string | undefined;
  chain?: string[];
  /** a badge for a `![[Lean#thm:name]]` embed: what stands behind the claim */
  claimBadge?: (leanPath: string, name: string) => string;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const stripTags = (h: string) => h.replace(/<[^>]*>/g, "");
export const slug = (t: string) => t.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-");
export const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i;
export const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|flac)$/i;
export const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
export const isAttachment = (p: string) => IMAGE_EXT.test(p) || AUDIO_EXT.test(p) || VIDEO_EXT.test(p) || /\.pdf$/i.test(p);

const CALLOUTS: Record<string, [string, string]> = {
  // type -> [icon path, colour token]
  note: ['<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', "blue"],
  abstract: ['<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', "teal"],
  summary: ['<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', "teal"],
  tldr: ['<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', "teal"],
  info: ['<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>', "blue"],
  todo: ['<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>', "blue"],
  tip: ['<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>', "teal"],
  hint: ['<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>', "teal"],
  important: ['<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>', "teal"],
  success: ['<path d="M5 12l5 5L20 7"/>', "green"],
  check: ['<path d="M5 12l5 5L20 7"/>', "green"],
  done: ['<path d="M5 12l5 5L20 7"/>', "green"],
  question: ['<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>', "yellow"],
  help: ['<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>', "yellow"],
  faq: ['<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>', "yellow"],
  warning: ['<path d="M12 3l10 18H2zM12 10v4M12 18h.01"/>', "orange"],
  caution: ['<path d="M12 3l10 18H2zM12 10v4M12 18h.01"/>', "orange"],
  attention: ['<path d="M12 3l10 18H2zM12 10v4M12 18h.01"/>', "orange"],
  failure: ['<path d="M6 6l12 12M18 6 6 18"/>', "red"],
  fail: ['<path d="M6 6l12 12M18 6 6 18"/>', "red"],
  missing: ['<path d="M6 6l12 12M18 6 6 18"/>', "red"],
  danger: ['<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', "red"],
  error: ['<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', "red"],
  bug: ['<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M12 6V3M6 10H3M21 10h-3M6 20l-2 2M18 20l2 2M6 15H3M21 15h-3"/>', "red"],
  example: ['<path d="M4 6h16M4 12h10M4 18h7"/>', "purple"],
  quote: ['<path d="M7 7h4v6H7a3 3 0 0 1-3-3V7zM15 7h4v6h-4a3 3 0 0 1-3-3V7z"/>', "grey"],
  cite: ['<path d="M7 7h4v6H7a3 3 0 0 1-3-3V7zM15 7h4v6h-4a3 3 0 0 1-3-3V7z"/>', "grey"],
};

let cur: RenderCtx = { resolve: () => undefined, note: () => undefined, attachment: () => undefined };

function attachmentHtml(path: string, alt: string, width?: string): string {
  const dest = cur.resolve(path) ?? path;
  const data = cur.attachment(dest);
  const w = width ? ` width="${esc(width)}"` : "";
  if (IMAGE_EXT.test(dest)) return data ? `<img class="embed-img" src="${data}" alt="${esc(alt || base(dest))}"${w}>` : `<span class="attach-pending" data-attach="${esc(dest)}">${esc(base(dest))}…</span>`;
  if (AUDIO_EXT.test(dest)) return data ? `<audio controls src="${data}"></audio>` : `<span class="attach-pending" data-attach="${esc(dest)}">${esc(base(dest))}…</span>`;
  if (VIDEO_EXT.test(dest)) return data ? `<video controls src="${data}"${w}></video>` : `<span class="attach-pending" data-attach="${esc(dest)}">${esc(base(dest))}…</span>`;
  return `<a href="#" class="wikilink attach-link" data-action="attach-open" data-target="${esc(dest)}">${esc(alt || dest.split("/").pop()!)}</a>`;
}

function embedHtml(target: string, heading: string, alias: string): string {
  const dest = cur.resolve(target);
  if (dest && isAttachment(dest)) return attachmentHtml(dest, "", /^\d+$/.test(alias) ? alias : undefined);
  if (dest && isExcalidraw(dest, cur.note(dest))) return `<div class="excalidraw-embed" data-excalidraw-embed="${esc(dest)}"${/^\d+$/.test(alias) ? ` style="max-width:${Number(alias)}px"` : ""}><span class="attach-pending">${esc(base(dest))}…</span></div>`;
  const content = dest ? cur.note(dest) : undefined;
  const chain = cur.chain ?? [];
  const self = cur.self;
  if (!dest || content === undefined) return `<div class="embed embed-missing">${esc(target)} is not in this notebook</div>`;
  if (chain.length >= 3 || chain.includes(dest) || dest === self) return `<div class="embed embed-missing">${esc(base(dest))}: embeds nest too deep</div>`;
  // `![[Lean note#thm:name]]`: the theorem's statement, English docstring beside the Lean, from the Lean note itself
  if (heading.startsWith("thm:")) {
    const name = heading.slice(4).trim();
    const d = parseLean(leanCode(content)).find((x) => x.name === name);
    if (!d) return `<div class="embed embed-missing">${esc(base(dest))}: no theorem named ${esc(name)}</div>`;
    const card = statementCard(d);
    const badge = cur.claimBadge?.(dest, name) ?? "";
    return `<div class="embed thm" data-embed="${esc(dest)}" data-thm="${esc(name)}"><div class="embed-title"><a href="#" class="wikilink" data-action="wiki" data-target="${esc(target)}">${esc(base(dest))} › ${esc(d.kind)} ${esc(name)}</a>${badge}</div><div class="thm-en">${renderMarkdown(card.english, { ...cur, self: dest, chain: [...chain, self ?? ""] })}</div><pre class="thm-lean"><code>${esc(card.lean)}</code></pre>${d.flags.length ? `<div class="thm-flags">${d.flags.map((f) => `<span class="pill low">${esc(f)}</span>`).join("")}</div>` : ""}</div>`;
  }
  const body = heading ? (section(content, heading) ?? `#### ${heading}\n\n*heading not found*`) : content;
  const inner = renderMarkdown(body, { ...cur, self: dest, chain: [...chain, self ?? ""] });
  return `<div class="embed" data-embed="${esc(dest)}"><div class="embed-title"><a href="#" class="wikilink" data-action="wiki" data-target="${esc(target)}${heading ? `#${esc(heading)}` : ""}">${esc(base(dest))}${heading ? ` › ${esc(heading)}` : ""}</a></div><div class="embed-body md">${inner}</div></div>`;
}

const md = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      if (!lang || lang === "mermaid") return code;
      return hljs.highlight(code, { language: hljs.getLanguage(lang) ? lang : "plaintext" }).value;
    },
  }),
  markedFootnote({ refMarkers: false }),
  {
    extensions: [
      {
        name: "highlight",
        level: "inline",
        start: (src) => src.indexOf("=="),
        tokenizer(src) {
          const m = /^==([^=\n](?:[^\n]*?[^=\n])?)==/.exec(src);
          if (m) return { type: "highlight", raw: m[0], text: m[1], tokens: this.lexer.inlineTokens(m[1]) };
        },
        renderer(t) {
          return `<mark>${this.parser.parseInline(t.tokens ?? [])}</mark>`;
        },
      },
      {
        name: "math",
        level: "inline",
        start: (src) => src.indexOf("$"),
        tokenizer(src) {
          const d = /^\$\$([^$]+?)\$\$/.exec(src);
          if (d) return { type: "math", raw: d[0], text: d[1].trim(), display: true };
          const m = /^\$(?!\$)([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)/.exec(src);
          if (m) return { type: "math", raw: m[0], text: m[1], display: false };
        },
        renderer(t) {
          const html = katex.renderToString(t.text as string, { throwOnError: false, displayMode: !!t.display });
          return t.display ? `<div class="math-block">${html}</div>` : html;
        },
      },
      {
        name: "mathblock",
        level: "block",
        start: (src) => src.indexOf("$$"),
        tokenizer(src) {
          const m = /^\$\$\n([\s\S]+?)\n\$\$(?:\n|$)/.exec(src);
          if (m) return { type: "mathblock", raw: m[0], text: m[1].trim() };
        },
        renderer(t) {
          return `<div class="math-block">${katex.renderToString(t.text as string, { throwOnError: false, displayMode: true })}</div>`;
        },
      },
    ],
    renderer: {
      blockquote({ tokens }: Tokens.Blockquote) {
        const body = this.parser.parse(tokens);
        const m = /^<p>\[!([A-Za-z]+)\]([+-]?)[ \t]*([^<\n]*)(?:<br>\n?|\n)?/.exec(body);
        if (!m) return `<blockquote>${body}</blockquote>`;
        let rest = body.slice(m[0].length);
        rest = rest.startsWith("</p>") ? rest.slice(4) : `<p>${rest}`;
        const type = m[1].toLowerCase();
        const [path, color] = CALLOUTS[type] ?? CALLOUTS.note;
        const title = m[3].trim() || type[0].toUpperCase() + type.slice(1);
        const ico = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
        const content = rest.trim() ? `<div class="callout-content">${rest}</div>` : "";
        if (m[2]) return `<details class="callout" data-callout="${type}" data-color="${color}"${m[2] === "+" ? " open" : ""}><summary class="callout-title">${ico}<span>${title}</span></summary>${content}</details>`;
        return `<div class="callout" data-callout="${type}" data-color="${color}"><div class="callout-title">${ico}<span>${title}</span></div>${content}</div>`;
      },
      code({ text, lang, escaped }: Tokens.Code) {
        const l = (lang ?? "").split(/\s/)[0];
        const safe = escaped ? text : esc(text);
        if (l === "mermaid") return `<pre class="mermaid-src" data-mermaid>${safe}</pre>`;
        if (l === "track") return trackHtml(parseTrackBlock(text));
        return `<pre><code class="hljs${l ? ` language-${esc(l)}` : ""}">${safe}\n</code></pre>`;
      },
      heading({ tokens, depth }: Tokens.Heading) {
        const html = this.parser.parseInline(tokens);
        const text = stripTags(html);
        return `<h${depth} id="h-${slug(text)}" data-heading="${esc(text)}">${html}</h${depth}>`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        const t = title ? ` title="${esc(title)}"` : "";
        if (/^(https?:|mailto:|tel:|obsidian:)/i.test(href)) return `<a href="${esc(href)}"${t} target="_blank" rel="noopener" class="external">${text}</a>`;
        if (href.startsWith("#")) return `<a href="#" class="wikilink" data-action="heading" data-heading="${esc(decodeURIComponent(href.slice(1)).replace(/^\^/, ""))}">${text}</a>`;
        const [p, h] = decodeURIComponent(href).split("#");
        const target = stem(p.replace(/^\.\//, ""));
        const dest = cur.resolve(target);
        return `<a href="#" class="wikilink${dest ? "" : " unresolved"}" data-action="wiki" data-target="${esc(target)}${h ? `#${esc(h)}` : ""}"${t}>${text}</a>`;
      },
      image({ href, text, title }: Tokens.Image) {
        if (/^(https?:|data:)/i.test(href)) return `<img src="${esc(href)}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ""}>`;
        return attachmentHtml(decodeURIComponent(href.replace(/^\.\//, "")), text);
      },
    },
  },
);

/** Render one note to sanitized HTML. Front matter becomes a properties table. */
export function renderMarkdown(content: string, ctx: RenderCtx): string {
  const { data, body } = frontmatter(content);
  const embeds: string[] = [];
  const outer = cur;
  cur = ctx;
  const pre = outsideCode(body, (chunk) =>
    chunk
      .replace(/%%[\s\S]*?%%/g, "")
      .replace(LINK_RE, (raw: string) => {
        const l = parseLinks(raw)[0];
        if (!l) return raw;
        if (l.embed) {
          embeds.push(embedHtml(l.target, l.heading, l.alias));
          return `\u0000E${embeds.length - 1}\u0000`;
        }
        const dest = l.target ? ctx.resolve(l.target) : ctx.self;
        const label = l.alias || `${l.target}${l.heading ? `#${l.heading}` : ""}`;
        return `<a class="wikilink${dest ? "" : " unresolved"}" data-action="wiki" data-target="${esc(l.target)}${l.heading ? `#${esc(l.heading)}` : ""}" href="#">${esc(label)}</a>`;
      })
      .replace(TAG_RE, (raw: string, p: string, tag: string) => (/[^0-9]/.test(tag) ? `${p}<a class="tag" data-action="tag" data-tag="${esc(tag)}" href="#">#${esc(tag)}</a>` : raw))
      .replace(/(^|[\s(])@([A-Za-z][\w.-]*[\w])/g, (raw: string, p: string, name: string) => (/^(owner|me)$/i.test(name) && false ? raw : `${p}<a class="mention" data-action="mention" data-name="${esc(name)}" href="#" title="Open ${esc(name)}'s page">@${esc(name)}</a>`))
      .replace(/ \^([A-Za-z0-9-]+)$/gm, ' <span class="blockid" data-block="$1"></span>'),
  );
  cur = ctx;
  let html = md.parse(pre, { breaks: true, gfm: true, async: false }) as string;
  cur = outer;
  html = html.replace(/<p>\u0000E(\d+)\u0000<\/p>|\u0000E(\d+)\u0000/g, (_, a: string, b: string) => embeds[Number(a ?? b)] ?? "").replace(/<input([^>]*) disabled=""([^>]*)>/g, "<input$1$2>");
  const props = Object.keys(data).length ? `<table class="props">${Object.entries(data).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>` : "";
  return props + DOMPurify.sanitize(html, { ADD_ATTR: ["target", "open"], ADD_TAGS: ["details", "summary"] });
}

/** Turn ```mermaid blocks into SVG after the HTML is in the document (the library loads on first use). */
export async function renderDiagrams(root: ParentNode, dark: boolean): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>("pre[data-mermaid]:not([data-done])")];
  if (!blocks.length) return;
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", securityLevel: "strict" });
  for (const [i, el] of blocks.entries()) {
    el.dataset.done = "1";
    try {
      const { svg } = await mermaid.render(`mmd-${Date.now()}-${i}`, el.textContent ?? "");
      const div = document.createElement("div");
      div.className = "mermaid";
      div.innerHTML = svg;
      el.replaceWith(div);
    } catch (e) {
      el.classList.add("mermaid-error");
      el.title = e instanceof Error ? e.message : String(e);
    }
  }
}
