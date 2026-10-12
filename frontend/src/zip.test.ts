import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, zip } from "./zip.ts";

test("crc32 matches the reference value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test("the archive round-trips through the system unzip", () => {
  const bytes = zip([
    { path: "Daily/", dir: true },
    { path: "Daily/2026-10-10.md", data: "# Today\n\nSee [[Ideas]] — ünïcödé ✓\n", mtime: new Date(2026, 9, 10, 12, 30) },
    { path: "Ideas.md", data: "ideas" },
    { path: "Empty/", dir: true },
  ]);
  const dir = mkdtempSync(join(tmpdir(), "zip-"));
  const file = join(dir, "nb.zip");
  writeFileSync(file, bytes);
  execFileSync("unzip", ["-t", file], { stdio: "pipe" });
  execFileSync("unzip", ["-q", file, "-d", dir]);
  assert.equal(readFileSync(join(dir, "Daily/2026-10-10.md"), "utf8"), "# Today\n\nSee [[Ideas]] — ünïcödé ✓\n");
  assert.equal(readFileSync(join(dir, "Ideas.md"), "utf8"), "ideas");
  assert.ok(readFileSync(file).length > 200);
});
