import { test } from "node:test";
import assert from "node:assert/strict";
import { IDL } from "@icp-sdk/core/candid";
import { approveArg, principalSubaccount } from "./oisy.ts";
import { Principal } from "@icp-sdk/core/principal";

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

test("an approval can name the registry subaccount bound to one sign-in", () => {
  const me = Principal.fromText("aaaaa-aa");
  const p = Principal.fromText("xpvre-j76fs-hptuk-4sfn2-eci54-x53uq-zkjkg-ge2xb-5vpif-hzlip-vae");
  const sub = principalSubaccount(p);
  assert.equal(sub.length, 32);
  assert.equal(sub[0], p.toUint8Array().length);
  assert.deepEqual([...sub.slice(1, 1 + sub[0])], [...p.toUint8Array()]);
  assert.ok(sub.slice(1 + sub[0]).every((b) => b === 0));
  const AccountIdl = IDL.Record({ owner: IDL.Principal, subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)) });
  const Args = IDL.Record({ fee: IDL.Opt(IDL.Nat), memo: IDL.Opt(IDL.Vec(IDL.Nat8)), from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)), created_at_time: IDL.Opt(IDL.Nat64), amount: IDL.Nat, expected_allowance: IDL.Opt(IDL.Nat), expires_at: IDL.Opt(IDL.Nat64), spender: AccountIdl });
  const [d] = IDL.decode([Args], approveArg(me.toText(), 1n, undefined, sub)) as unknown as [{ spender: { subaccount: [Uint8Array] } }];
  assert.deepEqual([...d.spender.subaccount[0]], [...sub]);
});
