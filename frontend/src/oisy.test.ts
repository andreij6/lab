import { test } from "node:test";
import assert from "node:assert/strict";
import { IDL } from "@icp-sdk/core/candid";
import { approveArg } from "./oisy.ts";

test("approve arguments encode as the ledger's icrc2_approve record", () => {
  const bytes = approveArg("ryjl3-tyaaa-aaaaa-aaaba-cai", 10_010_000n);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "DIDL");
  const AccountIdl = IDL.Record({ owner: IDL.Principal, subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)) });
  const Args = IDL.Record({ fee: IDL.Opt(IDL.Nat), memo: IDL.Opt(IDL.Vec(IDL.Nat8)), from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)), created_at_time: IDL.Opt(IDL.Nat64), amount: IDL.Nat, expected_allowance: IDL.Opt(IDL.Nat), expires_at: IDL.Opt(IDL.Nat64), spender: AccountIdl });
  const [decoded] = IDL.decode([Args], bytes) as unknown as [{ amount: bigint; spender: { owner: { toText(): string } }; expires_at: [] | [bigint] }];
  assert.equal(decoded.amount, 10_010_000n);
  assert.equal(decoded.spender.owner.toText(), "ryjl3-tyaaa-aaaaa-aaaba-cai");
  assert.deepEqual(decoded.expires_at, []);
});
