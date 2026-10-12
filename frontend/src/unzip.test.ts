import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzip } from "./unzip.ts";
import { zip } from "./zip.ts";

const text = (u: Uint8Array) => new TextDecoder().decode(u);

test("reads our own stored archives", async () => {
  const bytes = zip([{ path: "Daily/", dir: true }, { path: "Daily/x.md", data: "# x ✓" }, { path: "y.md", data: "y" }]);
  const got = await unzip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  assert.deepEqual(got.map((e) => [e.path, e.dir, text(e.data)]), [["Daily/", true, ""], ["Daily/x.md", false, "# x ✓"], ["y.md", false, "y"]]);
});

test("reads a deflated archive made by the system zip", async () => {
  const dir = mkdtempSync(join(tmpdir(), "unzip-"));
  mkdirSync(join(dir, "vault/.obsidian"), { recursive: true });
  mkdirSync(join(dir, "vault/Notes"), { recursive: true });
  const big = "lorem ipsum ".repeat(5000);
  writeFileSync(join(dir, "vault/Notes/Big.md"), big);
  writeFileSync(join(dir, "vault/Hello.md"), "hello [[Big]] ünï");
  writeFileSync(join(dir, "vault/.obsidian/app.json"), "{}");
  execFileSync("zip", ["-r", "-q", "../v.zip", "."], { cwd: join(dir, "vault") });
  const buf = readFileSync(join(dir, "v.zip"));
  const got = await unzip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  const byPath = new Map(got.map((e) => [e.path, e]));
  assert.equal(text(byPath.get("Notes/Big.md")!.data), big, "deflated entry inflates");
  assert.equal(text(byPath.get("Hello.md")!.data), "hello [[Big]] ünï");
  assert.ok(byPath.has(".obsidian/app.json"));
});
