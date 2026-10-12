// Python in the browser: Pyodide (CPython on WebAssembly) in a worker, loaded on the first run.
// ponytail: Pyodide and its packages come from the jsDelivr CDN; host /pyodide/ in the frontend
// canister and change PYODIDE_URL to go fully self-contained (about 12 MB core plus packages used).
import type { Output } from "./ipynb.ts";

export const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";

const WORKER_SRC = `
importScripts(${JSON.stringify(`${PYODIDE_URL}pyodide.js`)});
let ready;
const prelude = \`
import sys, io, base64, os, json
os.environ["MPLBACKEND"] = "AGG"
__sheets = {}
def sheet(name, tab=None):
    """A spreadsheet note as a pandas DataFrame: sheet("Budget") or sheet("Budget", "Sheet2")."""
    import pandas as pd
    wb = __sheets.get(name) or __sheets.get(name + ".sheet")
    if wb is None:
        raise KeyError("no spreadsheet note named %r; have: %s" % (name, ", ".join(k for k in __sheets if not k.endswith(".sheet"))))
    key = tab if tab is not None else next(iter(wb))
    if key not in wb:
        raise KeyError("sheet %r has no tab %r; tabs: %s" % (name, key, ", ".join(wb)))
    return pd.read_csv(io.StringIO(wb[key]))
def __nb_figures():
    try:
        import matplotlib.pyplot as plt
    except Exception:
        return []
    out = []
    for n in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(n).savefig(buf, format="png", bbox_inches="tight")
        out.append(base64.b64encode(buf.getvalue()).decode())
    plt.close("all")
    return out
\`;
async function boot() {
  const py = await loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_URL)} });
  await py.runPythonAsync(prelude);
  return py;
}
self.onmessage = async (e) => {
  const { id, code, sheets } = e.data;
  const outputs = [];
  const post = (o) => { outputs.push(o); self.postMessage({ id, partial: o }); };
  try {
    ready = ready || boot();
    const py = await ready;
    py.setStdout({ batched: (s) => post({ kind: "text", text: s + "\\n", stream: "stdout" }) });
    py.setStderr({ batched: (s) => post({ kind: "text", text: s + "\\n", stream: "stderr" }) });
    await py.loadPackagesFromImports(code, { messageCallback: () => {}, errorMessageCallback: (m) => post({ kind: "text", text: m + "\\n", stream: "stderr" }) });
    if (sheets) { py.globals.set("__sheets_json", JSON.stringify(sheets)); await py.runPythonAsync("__sheets = json.loads(__sheets_json)"); }
    if (/\\bsheet\\s*\\(/.test(code)) await py.loadPackage("pandas", { messageCallback: () => {} });
    let result = await py.runPythonAsync(code);
    const figs = await py.runPythonAsync("__nb_figures()");
    for (const f of figs.toJs ? figs.toJs() : figs) post({ kind: "image", mime: "image/png", data: f });
    if (result !== undefined && result !== null) {
      let html;
      try { if (result._repr_html_) html = result._repr_html_(); } catch {}
      if (html) post({ kind: "html", html: String(html) });
      else {
        let text;
        try { text = result.__repr__ ? result.__repr__() : String(result); } catch { text = String(result); }
        post({ kind: "text", text: String(text) });
      }
      if (result.destroy) try { result.destroy(); } catch {}
    }
    self.postMessage({ id, done: true, outputs });
  } catch (err) {
    const msg = String(err && err.message || err);
    const m = /^([A-Za-z_]+Error|[A-Za-z_]+Exception|KeyboardInterrupt|SystemExit)\\s*:?\\s*(.*)$/m.exec(msg.split("\\n").filter(Boolean).pop() || "");
    const o = { kind: "error", name: m ? m[1] : "Error", value: m ? m[2] : msg.split("\\n").pop() || "", traceback: msg };
    outputs.push(o);
    self.postMessage({ id, done: true, outputs, error: true });
  }
};
`;

let worker: Worker | undefined;
let seq = 0;
const pending = new Map<number, { onPartial: (o: Output) => void; resolve: (r: { outputs: Output[]; error: boolean }) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
  worker.onmessage = (e: MessageEvent<{ id: number; partial?: Output; done?: boolean; outputs?: Output[]; error?: boolean }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    if (e.data.partial) p.onPartial(e.data.partial);
    if (e.data.done) { pending.delete(e.data.id); p.resolve({ outputs: e.data.outputs ?? [], error: !!e.data.error }); }
  };
  worker.onerror = () => { for (const p of pending.values()) p.resolve({ outputs: [{ kind: "error", name: "Worker", value: "Python could not start; check the network and try again.", traceback: "" }], error: true }); pending.clear(); worker = undefined; };
  return worker;
}

/** Run one cell; partial outputs stream in as they are printed. */
export function runPython(code: string, onPartial: (o: Output) => void = () => {}, sheets?: Record<string, Record<string, string>>): Promise<{ outputs: Output[]; error: boolean }> {
  const id = ++seq;
  return new Promise((resolve) => { pending.set(id, { onPartial, resolve }); getWorker().postMessage({ id, code, sheets }); });
}

/** Stop the interpreter: kills the worker; the next run boots a fresh one. */
export function restartPython() {
  worker?.terminate();
  worker = undefined;
  for (const p of pending.values()) p.resolve({ outputs: [{ kind: "text", text: "Interrupted.\n", stream: "stderr" }], error: true });
  pending.clear();
}
export const pythonLoaded = () => !!worker;
