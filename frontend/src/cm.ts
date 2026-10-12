// The note editor: CodeMirror 6 with Obsidian's markdown behaviours. Headings, emphasis, code and
// quotes are styled in place; `[[links]]`, `#tags` and `==highlights==` are marked and ⌘-click
// follows a link; Enter continues lists and quotes; Tab indents; `[[`, `#`, `[!` and `{{`
// autocomplete from the notebook.
import { autocompletion, closeBrackets, closeBracketsKeymap, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, drawSelection, dropCursor, highlightActiveLine, keymap, placeholder } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

export type EditorOpts = {
  doc: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange: (text: string) => void;
  onLink: (target: string) => void;
  notes: () => string[];
  tags: () => string[];
  templates?: () => string[];
};
export type Editor = { view: EditorView; getDoc(): string; setDoc(text: string): void; focus(): void; destroy(): void; setReadOnly(v: boolean): void };

const CALLOUTS = ["note", "abstract", "info", "todo", "tip", "success", "question", "warning", "failure", "danger", "bug", "example", "quote"];

const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, class: "cm-h1" },
  { tag: t.heading2, class: "cm-h2" },
  { tag: t.heading3, class: "cm-h3" },
  { tag: t.heading4, class: "cm-h4" },
  { tag: t.heading5, class: "cm-h4" },
  { tag: t.heading6, class: "cm-h4" },
  { tag: t.emphasis, class: "cm-em" },
  { tag: t.strong, class: "cm-strong" },
  { tag: t.strikethrough, class: "cm-strike" },
  { tag: t.monospace, class: "cm-code" },
  { tag: t.quote, class: "cm-quote" },
  { tag: t.link, class: "cm-url" },
  { tag: t.url, class: "cm-url" },
  { tag: t.processingInstruction, class: "cm-syntax" },
  { tag: t.meta, class: "cm-syntax" },
  { tag: t.contentSeparator, class: "cm-hr" },
  { tag: t.list, class: "cm-listmark" },
]);

const INLINE = /\[\[([^[\]\n]+?)\]\]|(^|\s)(#[^\s#,.;:!?'"()[\]{}]+)|==([^=\n]+?)==|(^|[\s(])(@[A-Za-z][\w.-]*)/g;
const link = Decoration.mark({ class: "cm-wikilink" });
const tag = Decoration.mark({ class: "cm-tag" });
const mark = Decoration.mark({ class: "cm-hl" });
const mention = Decoration.mark({ class: "cm-mention" });

/** Marks wiki links, tags and highlights in the visible text. */
const inlineMarks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view);
    }
    build(view: EditorView) {
      const ranges: { from: number; to: number; d: Decoration }[] = [];
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        for (const m of text.matchAll(INLINE)) {
          const start = from + m.index;
          if (m[1] !== undefined) ranges.push({ from: start, to: start + m[0].length, d: link });
          else if (m[3] !== undefined) ranges.push({ from: start + m[2].length, to: start + m[0].length, d: tag });
          else if (m[6] !== undefined) ranges.push({ from: start + m[5].length, to: start + m[0].length, d: mention });
          else ranges.push({ from: start, to: start + m[0].length, d: mark });
        }
      }
      ranges.sort((a, b) => a.from - b.from);
      return Decoration.set(ranges.map((r) => r.d.range(r.from, r.to)));
    }
  },
  { decorations: (v) => v.decorations },
);

function completions(opts: EditorOpts) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const before = line.text.slice(0, ctx.pos - line.from);
    const wiki = /\[\[([^\]|#]*)$/.exec(before);
    if (wiki) {
      const from = ctx.pos - wiki[1].length;
      return { from, validFor: /^[^\]|#]*$/, options: opts.notes().map((n) => ({ label: n, type: "text", apply: `${n}]]` })) };
    }
    const callout = /^>\s*\[!([a-z]*)$/i.exec(before);
    if (callout) return { from: ctx.pos - callout[1].length, validFor: /^[a-z]*$/i, options: CALLOUTS.map((c) => ({ label: c, type: "keyword", apply: `${c}] ` })) };
    const tpl = /\{\{([a-z:]*)$/i.exec(before);
    if (tpl) return { from: ctx.pos - tpl[1].length, options: ["date", "time", "title", "date:YYYY-MM-DD", "date:dddd, MMMM DD"].map((x) => ({ label: x, type: "variable", apply: `${x}}}` })) };
    const hash = /(^|\s)#([^\s#]*)$/.exec(before);
    if (hash && (hash[2].length || ctx.explicit)) {
      const existing = opts.tags();
      if (!existing.length) return null;
      return { from: ctx.pos - hash[2].length, validFor: /^[^\s#]*$/, options: existing.map((x) => ({ label: x, type: "keyword" })) };
    }
    return null;
  };
}

export function createEditor(host: HTMLElement, opts: EditorOpts): Editor {
  const readOnly = new Compartment();
  const extensions: Extension[] = [
    history(),
    drawSelection(),
    dropCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    closeBrackets(),
    markdown({ base: markdownLanguage, addKeymap: true }),
    syntaxHighlighting(mdHighlight),
    inlineMarks,
    autocompletion({ override: [completions(opts)], activateOnTyping: true, icons: false }),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    EditorView.lineWrapping,
    placeholder(opts.placeholder ?? ""),
    readOnly.of([EditorState.readOnly.of(!!opts.readOnly), EditorView.editable.of(!opts.readOnly)]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) opts.onChange(u.state.doc.toString());
    }),
    EditorView.domEventHandlers({
      mousedown(ev, view) {
        if (!(ev.metaKey || ev.ctrlKey)) return false;
        const el = (ev.target as HTMLElement).closest(".cm-wikilink");
        if (!el) return false;
        const pos = view.posAtDOM(el);
        const line = view.state.doc.lineAt(pos);
        const m = [...line.text.matchAll(/\[\[([^[\]\n]+?)\]\]/g)].find((x) => pos >= line.from + x.index && pos <= line.from + x.index + x[0].length);
        if (m) {
          ev.preventDefault();
          opts.onLink(m[1].split("|")[0].trim());
          return true;
        }
        return false;
      },
    }),
  ];
  const view = new EditorView({ state: EditorState.create({ doc: opts.doc, extensions }), parent: host });
  return {
    view,
    getDoc: () => view.state.doc.toString(),
    setDoc(text) {
      if (text === view.state.doc.toString()) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
    setReadOnly: (v) => view.dispatch({ effects: readOnly.reconfigure([EditorState.readOnly.of(v), EditorView.editable.of(!v)]) }),
  };
}
