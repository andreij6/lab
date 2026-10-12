# What REA found in Obsidian, and what this rebuild does with it

Target: `obsidian-1.14.4.asar` (sha256 `146ef8470d8cbb4a6db209bdc19bf2bad13350444186c0fd93c31087b142b92f`),
the app bundle Obsidian 1.14.4 loads on macOS. Tool: REA 6.3.0,
`analyze-javascript-application` (Evidence `ev_26a1b4d7179c66a19085ce220dac7cf890dc78329e5322d3db3d0138159cd683`,
application graph `jag_38a5688f…`, semantic graph `jsrg_ff13dbd6…`). The bundle is minified and
was parsed as inert text; nothing was executed. Where REA's graph only located code, the exact
rule was read from the located source (`app.js` byte offsets below). Observations are what the
shipped code says; inferences and design choices are marked as such.

## Observed

| Topic | Observation | Where |
|---|---|---|
| Inventory | 38 files: `app.js` (3.9 MB, the whole app), `main.js` (Electron main), `worker.js`, `starter.js`, CodeMirror (`lib/codemirror/*`), Prism, Mermaid, MathJax, pdf.js, moment, i18n, a bundled "sandbox" notebook of three notes | REA asar-entry nodes (38) |
| Process model | 1 main, 1 preload, 4 renderer roles, 2 BrowserWindows, 12 workers, 47 literal IPC channels with 47 main-side handlers, 77 paired renderer sends, no contextBridge APIs | REA summary |
| Storage | localStorage keys such as `obsidian`, `vim`, `site-theme`, `local-themes`, `spellcheck-language`, `most-recently-in…`; an IndexedDB database (the metadata cache); sessionStorage `obsidian-uri` | REA storage nodes (33) |
| A notebook is a folder | "a notebook is a plain folder on your computer … you own this folder" | bundled `sandbox/Notebook is just a local folder.md` |
| Config folder | `.obsidian` (`$P=".obsidian"`), with `app.json`, `appearance.json`, `hotkeys.json`, `core-plugins.json`, `workspace.json` / `workspace-mobile.json`, `types.json` | `app.js` @1412172, @2880280, @3707967 |
| Default settings | `alwaysUpdateLinks:false`, `useMarkdownLinks:false`, `newLinkFormat:"shortest"`, `newFileLocation:"root"`, `attachmentFolderPath:"/"`, `defaultViewMode:"source"`, `livePreview:true`, `readableLineLength:true`, `spellcheck:true`, `tabSize:4`, `promptDelete:true`, `trashOption:"system"` | `app.js` @1409789–@1410322 |
| File name rules | Link-breaking characters `# ^ [ ] \|` are refused in any name; path-breaking `\ / :` too (plus `* ? < > "` on Windows/macOS); names may not end with a dot or a space; DOS device names are forbidden | `app.js` @1335844 (`wA`, `kA`, `xA`), @1336380 |
| Wiki link syntax | `/^(!?)\[\[(.+?)]]/`; `!` marks an embed; a target containing `[[` is not a link; `target\|alias` and `target#heading` are split afterwards | `app.js` @756053 |
| Link resolution | `getLinkpathDest`: an empty target with a source file is the file itself; a target with `/` is a path tried as is, then with `.md`; otherwise a case-insensitive lookup by name (`uniqueFileLookup`), first hit wins | `app.js` @1750690 |
| Link cache | Per file, `resolvedLinks[path] = {dest: count}` and `unresolvedLinks[path] = {name: count}`; backlinks are computed by iterating all refs and keeping those whose destination is the file | `app.js` @1759927, @1753914, @1763467 |
| Rename | Links in other notes are rewritten on rename, after a prompt unless `alwaysUpdateLinks` | `app.js` @1791643 |
| Tags | `/^#[^ -⁯⸀-⹿'!"#$%&()*+,.:;<=>?@^`{\|}~\[\]\\\s]+/`, suggested after start-of-text or whitespace | `app.js` @755116, @1829469 |
| Markdown | remark-style tokenizer with `breaks:true, commonmark:true`; front matter is a `---` YAML block only at the start; block ids `^abc` ; `%%comments%%` | `app.js` @755116, @762856, @769662 |
| New notes | `getMarkdownNewFileParent`: root, current folder, or a fixed folder per `newFileLocation` | `app.js` @1787067 |
| Core plugins in a real notebook | file-explorer, global-search, switcher, graph, backlink, canvas, outgoing-link, tag-pane, properties, page-preview, daily-notes, templates, command-palette, outline, word-count, bookmarks, file-recovery, sync, bases | a user notebook's `.obsidian/core-plugins.json` |

## Inferred

- The metadata cache (links, tags, headings per file) is built on the client from file contents
  and persisted in IndexedDB; the files themselves are the source of truth. (Static reading of
  `metadataCache` call sites; no runtime observation.)
- Live preview, the graph (pixi.js is bundled), PDF and Mermaid rendering are renderer-side
  features with no server component. Only theme/plugin stats and Publish/Sync talk to
  `*.obsidian.md` endpoints (REA endpoint nodes).

## Unknown / not pursued

- Runtime IPC payloads, actual enforcement of sender checks, and anything behind the 234k
  `ambiguous-target` / `dynamic-call` unknowns in the semantic graph. Not needed for a rebuild.
- Sync and Publish protocols: out of scope by design (every notebook is its own canister).

## What the rebuild keeps, drops, and changes

Kept, as observed: a notebook is a flat set of files keyed by path; the name rules; `[[link]]`,
`[[link|alias]]`, `[[link#heading]]`, `![[embed]]` syntax; path-or-name link resolution; resolved
and unresolved links, backlinks and tags indexed on the client from file contents; links rewritten
on rename (always, the `alwaysUpdateLinks:true` behaviour); `Untitled.md`, `Untitled 1.md`, …
for new notes in the root; `---` front matter with `tags:`.

Also kept: real folders (empty ones included), the context menu on the file tree, the quick
switcher, tab groups that split and accept dragged tabs (Obsidian's `workspace.json` layout of
tabs/splits is the model; here it is kept per notebook in the browser), list editing (Enter
continues an item, Tab indents, task boxes toggle from reading view), themes on Obsidian's own
CSS variable names, the rest of Obsidian Flavored Markdown (callouts, `==highlights==`,
`%%comments%%`, `![[embeds]]`, aliases, heading and `^block` links, footnotes, math, Mermaid,
code highlighting), vault import with attachments, and a knowledge graph (Obsidian bundles pixi.js for its graph view; here it is a plain
canvas with a small force simulation) plus a local graph of the open note.

Design choices (not Obsidian behaviour): the "folder" is a canister that only its owner can read
or write; the owner signs in with Internet Identity; each notebook is a separate canister the owner
controls and funds with cycles; the editor is a textarea with a rendered preview (`marked` +
DOMPurify) rather than CodeMirror live preview; no `.obsidian` config folder, plugins, canvas,
daily notes, templates or attachments. Those are the natural next steps, in that order.
