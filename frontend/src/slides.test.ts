import { test } from "node:test";
import assert from "node:assert/strict";
import { isSlides, splitSlides, SLIDES_TEMPLATE } from "./slides.ts";

test("slides split on --- lines, not front matter, not inside code fences", () => {
  const s = splitSlides("---\ntype: slides\n---\n# One\n\n---\n\n## Two\n\n```\n---\n```\n\n---\n\n\n---\n\nThree");
  assert.deepEqual(s, ["# One", "## Two\n\n```\n---\n```", "Three"]);
  assert.ok(isSlides(SLIDES_TEMPLATE) && !isSlides("# plain"));
  assert.equal(splitSlides(SLIDES_TEMPLATE).length, 4);
});
