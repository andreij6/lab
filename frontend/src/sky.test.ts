import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutGraph } from "./sky.ts";

test("layoutGraph: inside the frame, linked notes closer than unlinked, old notes stay put", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  const edges: [number, number][] = [[0, 1], [1, 2], [0, 2], [3, 4], [4, 5], [3, 5]];
  const pos = layoutGraph(ids, edges);
  for (const [x, y] of pos) assert.ok(x >= 0.05 && x <= 0.95 && y >= 0.05 && y <= 0.95);
  const d = (i: number, j: number) => Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]);
  assert.ok(d(0, 1) < d(0, 3) && d(3, 4) < d(2, 5));
  assert.deepEqual(layoutGraph(ids, edges), pos, "deterministic");
  const prev = new Map(ids.map((id, i) => [id, pos[i]] as [string, [number, number]]));
  const more = layoutGraph([...ids, "g"], [...edges, [6, 0]], prev);
  assert.ok(Math.hypot(more[0][0] - pos[0][0], more[0][1] - pos[0][1]) < 0.25, "an old note barely moves when one is added");
  assert.deepEqual(layoutGraph([], []), []);
});
