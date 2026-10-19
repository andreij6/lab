import assert from "node:assert/strict";
import { test } from "node:test";
import { qrMatrix, qrSvg } from "./qr.ts";

test("a short text fits version 1 and a longer one grows the code", () => {
  assert.equal(qrMatrix("hello").length, 21);
  assert.equal(qrMatrix("https://buy.stripe.com/6oU7sLg7t4ih4LtgwX3VC00?order=abcdef").length, 33);
  assert.throws(() => qrMatrix("x".repeat(300)));
});

test("the three finder patterns and the dark module are where readers look for them", () => {
  const m = qrMatrix("hello"), n = m.length;
  const finder = (r: number, c: number) => [0, 6].every((i) => [0, 1, 2, 3, 4, 5, 6].every((j) => m[r + i][c + j] && m[r + j][c + i])) && m[r + 3][c + 3] && !m[r + 1][c + 1];
  assert.ok(finder(0, 0) && finder(0, n - 7) && finder(n - 7, 0));
  assert.equal(m[n - 8][8], true);
  for (let i = 8; i < n - 8; i++) assert.equal(m[6][i], i % 2 === 0, `timing at ${i}`);
});

test("the same text draws the same code", () => {
  assert.equal(qrSvg("agent space"), qrSvg("agent space"));
  assert.match(qrSvg("agent space"), /^<svg /);
});
