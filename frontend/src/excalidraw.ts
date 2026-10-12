// Excalidraw drawings: `.excalidraw` files (plain scene JSON) and Obsidian's Excalidraw plugin
// `.excalidraw.md` files (front matter + a ```json or ```compressed-json drawing block). The editor
// and the SVG exporter load on first use; React is only in that chunk.
import LZString from "lz-string";

export type Scene = { elements: unknown[]; appState: Record<string, unknown>; files: Record<string, unknown> };

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}
if (typeof window !== "undefined") window.EXCALIDRAW_ASSET_PATH = "/excalidraw/";

export const isExcalidraw = (path: string, content?: string) => /\.excalidraw(\.md)?$/i.test(path) || (!!content && /^---[\s\S]*?excalidraw-plugin:/m.test(content.slice(0, 400)));

/** Scene data out of either file format; an empty scene for a new or unreadable file. */
export function parseScene(content: string): Scene {
  const empty: Scene = { elements: [], appState: {}, files: {} };
  let json = content.trim();
  if (/^---/.test(json) || /```(compressed-)?json/.test(json)) {
    const m = /```compressed-json\s*\n([\s\S]*?)\n```/.exec(content);
    const p = /```json\s*\n([\s\S]*?)\n```/.exec(content);
    if (m) json = LZString.decompressFromBase64(m[1].replace(/\s+/g, "")) ?? "";
    else if (p) json = p[1];
    else return empty;
  }
  try {
    const d = JSON.parse(json) as Partial<Scene>;
    return { elements: Array.isArray(d.elements) ? d.elements : [], appState: d.appState ?? {}, files: d.files ?? {} };
  } catch {
    return empty;
  }
}

const KEEP_APP_STATE = ["viewBackgroundColor", "gridSize", "currentItemStrokeColor", "currentItemBackgroundColor", "currentItemFontFamily", "theme"];

/** Write the scene back in the same format the file came in (plugin markdown or plain JSON). */
export function serializeScene(scene: Scene, original: string, path: string): string {
  const appState = Object.fromEntries(Object.entries(scene.appState).filter(([k]) => KEEP_APP_STATE.includes(k)));
  const json = JSON.stringify({ type: "excalidraw", version: 2, source: "notebooks", elements: scene.elements, appState, files: scene.files }, null, 2);
  if (!/\.md$/i.test(path)) return json;
  const fm = /^---\n[\s\S]*?\n---\n/.exec(original)?.[0] ?? "---\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n---\n";
  const texts = (scene.elements as { type?: string; text?: string; id?: string }[]).filter((e) => e.type === "text" && e.text).map((e) => `${e.text} ^${e.id}`).join("\n\n");
  return `${fm}==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'\n\n\n# Excalidraw Data\n\n## Text Elements\n${texts}\n\n%%\n## Drawing\n\`\`\`json\n${json}\n\`\`\`\n%%`;
}

export const NEW_DRAWING = serializeScene({ elements: [], appState: {}, files: {} }, "", "x.excalidraw.md");

type Root = { unmount(): void };
const roots = new Map<HTMLElement, Root>();

/** Mount the editor into `host`; `onChange` gets the serialized file when the drawing changes. */
export async function mountEditor(host: HTMLElement, content: string, path: string, dark: boolean, onChange: (next: string) => void): Promise<void> {
  const [{ Excalidraw }, React, { createRoot }] = await Promise.all([import("@excalidraw/excalidraw"), import("react"), import("react-dom/client")]);
  await import("@excalidraw/excalidraw/index.css");
  if (!host.isConnected) return;
  const scene = parseScene(content);
  let last = "";
  let timer = 0;
  const root = createRoot(host);
  roots.set(host, root);
  root.render(
    React.createElement(Excalidraw as unknown as React.ComponentType<Record<string, unknown>>, {
      initialData: { elements: scene.elements, appState: { ...scene.appState, collaborators: new Map() }, files: scene.files, scrollToContent: true },
      theme: dark ? "dark" : "light",
      UIOptions: { canvasActions: { loadScene: false, saveToActiveFile: false } },
      onChange: (elements: unknown[], appState: Record<string, unknown>, files: Record<string, unknown>) => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
          const live = (elements as { isDeleted?: boolean }[]).filter((e) => !e.isDeleted);
          const next = serializeScene({ elements: live, appState, files }, content, path);
          if (next !== last) {
            last = next;
            onChange(next);
          }
        }, 600);
      },
    }),
  );
}

/** Unmount every editor whose host is no longer in the document (call before replacing the DOM). */
export function unmountEditors(all = false) {
  for (const [host, root] of roots) {
    if (all || !host.isConnected) {
      root.unmount();
      roots.delete(host);
    }
  }
}

/** A static SVG of a drawing, for `![[drawing.excalidraw]]` embeds. */
export async function toSvg(content: string, dark: boolean): Promise<SVGSVGElement> {
  const { exportToSvg } = await import("@excalidraw/excalidraw");
  const scene = parseScene(content);
  return exportToSvg({ elements: scene.elements as never, appState: { ...scene.appState, exportWithDarkMode: dark, exportBackground: false } as never, files: scene.files as never, exportPadding: 16 });
}
