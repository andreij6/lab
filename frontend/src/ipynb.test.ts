import { test } from "node:test";
import assert from "node:assert/strict";
import { NEW_IPYNB, addCell, isNotebookPath, moveCell, parseNotebook, serializeNotebook } from "./ipynb.ts";

test("nbformat round-trips: cells, sources as arrays, outputs of every kind", () => {
  const nb = parseNotebook(JSON.stringify({
    nbformat: 4, nbformat_minor: 5, metadata: { kernelspec: { name: "python3" } },
    cells: [
      { cell_type: "markdown", id: "m1", source: ["# Hi\n", "there"] },
      { cell_type: "code", id: "c1", execution_count: 3, source: "print(1)\n1+1", outputs: [
        { output_type: "stream", name: "stdout", text: ["1\n"] },
        { output_type: "execute_result", execution_count: 3, data: { "text/plain": ["2"] }, metadata: {} },
        { output_type: "display_data", data: { "image/png": "iVBOR\nw0KG" }, metadata: {} },
        { output_type: "display_data", data: { "text/html": "<table></table>" }, metadata: {} },
        { output_type: "error", ename: "ZeroDivisionError", evalue: "division by zero", traceback: ["\u001b[31mTraceback\u001b[0m", "ZeroDivisionError: division by zero"] },
      ] },
    ],
  }));
  assert.deepEqual(nb.cells.map((c) => [c.type, c.source, c.count]), [["markdown", "# Hi\nthere", null], ["code", "print(1)\n1+1", 3]]);
  assert.deepEqual(nb.cells[1].outputs.map((o) => o.kind), ["text", "text", "image", "html", "error"]);
  assert.equal((nb.cells[1].outputs[2] as { data: string }).data, "iVBORw0KG");
  assert.match((nb.cells[1].outputs[4] as { traceback: string }).traceback, /^Traceback\n/);
  const out = JSON.parse(serializeNotebook(nb));
  assert.equal(out.nbformat, 4);
  assert.equal(out.cells[1].outputs[0].output_type, "stream");
  assert.equal(out.cells[1].outputs[4].output_type, "error");
  assert.deepEqual(parseNotebook(serializeNotebook(nb)).cells, nb.cells);
  assert.equal(out.metadata.kernelspec.name, "python3");
});

test("new notebook, add and move cells, bad json", () => {
  const nb = parseNotebook(NEW_IPYNB);
  assert.equal(nb.cells.length, 2);
  assert.equal(JSON.parse(NEW_IPYNB).metadata.kernelspec.language, "python");
  addCell(nb, 1, "code").source = "x = 1";
  assert.equal(nb.cells[2].source, "x = 1");
  moveCell(nb, 2, -1);
  assert.equal(nb.cells[1].source, "x = 1");
  moveCell(nb, 0, -1);
  assert.equal(nb.cells[0].type, "markdown");
  assert.equal(parseNotebook("not json").cells.length, 0);
  assert.ok(isNotebookPath("Analysis.IPYNB") && !isNotebookPath("a.md"));
});
