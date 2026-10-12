// Jupyter notebooks (nbformat 4) as notes: parse, edit and serialise the standard JSON so the file
// still opens in JupyterLab or VS Code. Pure; execution lives in pyodide.ts.

export type Output =
  | { kind: "text"; text: string; stream?: "stdout" | "stderr" }
  | { kind: "error"; name: string; value: string; traceback: string }
  | { kind: "image"; mime: string; data: string }
  | { kind: "html"; html: string };
export type Cell = { id: string; type: "code" | "markdown"; source: string; outputs: Output[]; count: number | null };
export type Notebook = { cells: Cell[]; raw: Record<string, unknown> };

const str = (v: unknown): string => (Array.isArray(v) ? v.join("") : typeof v === "string" ? v : "");
const newId = () => Math.random().toString(36).slice(2, 10);

export function parseNotebook(json: string): Notebook {
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(json) as Record<string, unknown>; } catch { raw = {}; }
  const cells = (Array.isArray(raw.cells) ? raw.cells : []) as Record<string, unknown>[];
  return {
    raw,
    cells: cells.map((c) => ({
      id: typeof c.id === "string" ? c.id : newId(),
      type: c.cell_type === "markdown" ? "markdown" : "code",
      source: str(c.source),
      count: typeof c.execution_count === "number" ? c.execution_count : null,
      outputs: (Array.isArray(c.outputs) ? c.outputs : []).map(fromJupyterOutput).filter((o): o is Output => !!o),
    })),
  };
}

function fromJupyterOutput(o: Record<string, unknown>): Output | undefined {
  const data = (o.data ?? {}) as Record<string, unknown>;
  switch (o.output_type) {
    case "stream": return { kind: "text", text: str(o.text), stream: o.name === "stderr" ? "stderr" : "stdout" };
    case "error": return { kind: "error", name: String(o.ename ?? "Error"), value: String(o.evalue ?? ""), traceback: (Array.isArray(o.traceback) ? o.traceback : []).join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
    case "execute_result":
    case "display_data": {
      if (data["image/png"]) return { kind: "image", mime: "image/png", data: str(data["image/png"]).replace(/\n/g, "") };
      if (data["image/svg+xml"]) return { kind: "html", html: str(data["image/svg+xml"]) };
      if (data["text/html"]) return { kind: "html", html: str(data["text/html"]) };
      if (data["text/plain"]) return { kind: "text", text: str(data["text/plain"]) };
      return undefined;
    }
    default: return undefined;
  }
}

function toJupyterOutput(o: Output): Record<string, unknown> {
  switch (o.kind) {
    case "text": return o.stream ? { output_type: "stream", name: o.stream, text: o.text } : { output_type: "execute_result", execution_count: null, metadata: {}, data: { "text/plain": o.text } };
    case "error": return { output_type: "error", ename: o.name, evalue: o.value, traceback: o.traceback.split("\n") };
    case "image": return { output_type: "display_data", metadata: {}, data: { [o.mime]: o.data } };
    case "html": return { output_type: "display_data", metadata: {}, data: { "text/html": o.html } };
  }
}

export function serializeNotebook(nb: Notebook): string {
  const raw = { ...nb.raw };
  raw.nbformat = 4;
  raw.nbformat_minor = Math.max(5, Number(raw.nbformat_minor ?? 5));
  raw.metadata = raw.metadata ?? { kernelspec: { name: "python3", display_name: "Python 3", language: "python" }, language_info: { name: "python" } };
  raw.cells = nb.cells.map((c) => (c.type === "markdown"
    ? { cell_type: "markdown", id: c.id, metadata: {}, source: c.source }
    : { cell_type: "code", id: c.id, metadata: {}, execution_count: c.count, source: c.source, outputs: c.outputs.map(toJupyterOutput) }));
  return `${JSON.stringify(raw, null, 1)}\n`;
}

export const NEW_IPYNB = serializeNotebook({ raw: {}, cells: [
  { id: newId(), type: "markdown", source: "# Notebook\n\nShift+Enter runs a cell. NumPy, pandas and matplotlib load on first import. `sheet(\"Name\")` loads a spreadsheet note as a DataFrame (`sheet(\"Name\", \"Tab\")` picks a tab).", outputs: [], count: null },
  { id: newId(), type: "code", source: "import numpy as np\nx = np.linspace(0, 6.28, 50)\nnp.round(np.sin(x[:5]), 3)", outputs: [], count: null },
] });

export const addCell = (nb: Notebook, after: number, type: Cell["type"]): Cell => { const c: Cell = { id: newId(), type, source: "", outputs: [], count: null }; nb.cells.splice(after + 1, 0, c); return c; };
export const moveCell = (nb: Notebook, i: number, d: -1 | 1): void => { const j = i + d; if (j < 0 || j >= nb.cells.length) return; [nb.cells[i], nb.cells[j]] = [nb.cells[j], nb.cells[i]]; };
export const isNotebookPath = (p: string): boolean => p.toLowerCase().endsWith(".ipynb");
