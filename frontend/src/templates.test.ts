import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyPath, fillTemplate, formatDate } from "./templates.ts";

test("date tokens and template fill", () => {
  const d = new Date(2026, 9, 11, 9, 5, 7);
  assert.equal(formatDate(d, "YYYY-MM-DD HH:mm:ss ddd MMM"), "2026-10-11 09:05:07 Sun Oct");
  assert.equal(fillTemplate("# {{title}}\n{{date}} {{time}} {{date:dddd, MMMM DD}} {{nope}}", { title: "T", now: d }), "# T\n2026-10-11 09:05 Sunday, October 11 {{nope}}");
  assert.equal(dailyPath(d), "Daily/2026-10-11.md");
});
