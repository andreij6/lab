import { test } from "node:test";
import assert from "node:assert/strict";
import { canvasSvg, parseCanvas } from "./canvasview.ts";

test("json canvas parses and renders nodes and edges", () => {
  const json = JSON.stringify({ nodes: [{ id: "a", type: "text", x: 0, y: 0, width: 200, height: 80, text: "hello <b>" }, { id: "b", type: "file", x: 300, y: 0, width: 200, height: 80, file: "Ideas.md" }, { id: "g", type: "group", x: -20, y: -20, width: 600, height: 200, label: "Box" }], edges: [{ id: "e", fromNode: "a", toNode: "b", fromSide: "right", toSide: "left", label: "to" }] });
  const svg = canvasSvg(json);
  assert.equal(parseCanvas(json).nodes.length, 3);
  assert.match(svg, /hello &#60;b&#62;/);
  assert.match(svg, /data-target="Ideas"/);
  assert.match(svg, /cv-edge-label[^>]*>to</);
  assert.match(svg, /cv-group-label">Box/);
  assert.match(canvasSvg("nope"), /Empty canvas/);
});
