import { test } from "node:test";
import assert from "node:assert/strict";
import LZString from "lz-string";
import { NEW_DRAWING, isExcalidraw, parseScene, serializeScene } from "./excalidraw.ts";

const scene = { elements: [{ id: "a1", type: "text", text: "hello", isDeleted: false }, { id: "r1", type: "rectangle" }], appState: { viewBackgroundColor: "#fff", zoom: { value: 2 } }, files: {} };

test("recognises both file kinds", () => {
  assert.ok(isExcalidraw("Sketch.excalidraw"));
  assert.ok(isExcalidraw("Sketch.excalidraw.md"));
  assert.ok(isExcalidraw("Note.md", "---\nexcalidraw-plugin: parsed\n---\n"));
  assert.ok(!isExcalidraw("Note.md", "# plain"));
});

test("plain json and plugin markdown round-trip; compressed-json is read", () => {
  const plain = serializeScene(scene, "", "Sketch.excalidraw");
  assert.equal(parseScene(plain).elements.length, 2);
  assert.deepEqual(parseScene(plain).appState, { viewBackgroundColor: "#fff" }, "transient app state is dropped");
  const md = serializeScene(scene, "", "Sketch.excalidraw.md");
  assert.match(md, /^---\nexcalidraw-plugin: parsed/);
  assert.match(md, /## Text Elements\nhello \^a1/);
  assert.equal(parseScene(md).elements.length, 2);
  const keepFm = serializeScene(scene, "---\nexcalidraw-plugin: parsed\ntags: [excalidraw, mine]\n---\nold body", "S.excalidraw.md");
  assert.match(keepFm, /tags: \[excalidraw, mine\]/, "existing front matter is kept");
  const compressed = `---\nexcalidraw-plugin: parsed\n---\n%%\n## Drawing\n\`\`\`compressed-json\n${LZString.compressToBase64(JSON.stringify(scene))}\n\`\`\`\n%%`;
  assert.equal(parseScene(compressed).elements.length, 2);
  assert.deepEqual(parseScene("not json at all"), { elements: [], appState: {}, files: {} });
  assert.equal(parseScene(NEW_DRAWING).elements.length, 0);
});
