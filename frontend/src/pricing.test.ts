import { test } from "node:test";
import assert from "node:assert/strict";
import { cyclesPerIcp, minDepositE8s } from "./pricing.ts";

test("the minimum deposit covers starting a notebook, in half ICPs, never under 1", () => {
  // 1 ICP = 3.5 XDR = 3.5 TC: starting a notebook is 0.43 ICP, so the floor of 1 ICP applies
  assert.equal(cyclesPerIcp(35_000n), 3_500_000_000_000n);
  assert.equal(minDepositE8s(35_000n), 100_000_000n);
  // 1 ICP = 1.2 TC: 1.25 ICP, rounded up to 1.5
  assert.equal(minDepositE8s(12_000n), 150_000_000n);
  // 1 ICP = 0.7 TC: 2.14 ICP, rounded up to 2.5
  assert.equal(minDepositE8s(7_000n), 250_000_000n);
  // exactly 1.5 TC per ICP needs exactly 1 ICP
  assert.equal(minDepositE8s(15_000n), 100_000_000n);
  // no rate (CMC unreachable): 1 ICP
  assert.equal(minDepositE8s(undefined), 100_000_000n);
});
