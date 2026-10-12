// OISY wallet as the payment method: a small relying-party client for the signer standards OISY
// speaks over postMessage (ICRC-29 transport, ICRC-25 permissions, ICRC-27 accounts, ICRC-49
// canister calls). Every payment is an `icrc2_approve` on the ICP ledger signed inside the OISY
// popup, after which our canister pulls the approved amount. No delegation: one popup per action,
// as OISY requires. ponytail: hand-rolled instead of @dfinity/oisy-wallet-signer, whose peer deps
// pin an older @icp-sdk/core than this app uses.
import { IDL } from "@icp-sdk/core/candid";
import { Principal } from "@icp-sdk/core/principal";

export const OISY_SIGNER = "https://oisy.com/sign";
export const ICP_LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
export type OisyAccount = { owner: string; subaccount?: string };

type Rpc = { jsonrpc: "2.0"; id: number | string; method: string; params?: unknown };
type RpcReply = { jsonrpc: "2.0"; id: number | string; result?: unknown; error?: { code: number; message: string } };

const ERRORS: Record<number, string> = { 1000: "the wallet reported an error", 2000: "the wallet does not support this", 2001: "the canister has no consent message for this call", 3000: "permission not granted in the wallet", 3001: "you cancelled it in the wallet", 4000: "network error in the wallet", 4001: "the wallet window was closed" };

export class Oisy {
  private win: Window | null = null;
  private origin?: string;
  private seq = 0;
  private pending = new Map<number | string, { res: (v: unknown) => void; rej: (e: Error) => void }>();
  private onMessage = (ev: MessageEvent) => {
    if (!this.win || ev.source !== this.win) return;
    const m = ev.data as RpcReply;
    if (!m || m.jsonrpc !== "2.0" || m.id === undefined) return;
    if (!this.origin) {
      if (m.result === "ready") this.origin = ev.origin;
      else return;
    } else if (ev.origin !== this.origin) return;
    const p = this.pending.get(m.id);
    if (!p) return;
    this.pending.delete(m.id);
    if (m.error) p.rej(new Error(`OISY: ${ERRORS[m.error.code] ?? m.error.message ?? `error ${m.error.code}`}`));
    else p.res(m.result);
  };
  private closedPoll = 0;
  private url: string;

  constructor(url = OISY_SIGNER) {
    this.url = url;
  }

  /** Open the signer popup, wait for it to be ready, ask for the two scopes we need, return the account. */
  async connect(timeoutMs = 120_000): Promise<OisyAccount> {
    window.addEventListener("message", this.onMessage);
    const w = 576;
    const h = 625;
    const left = Math.max(0, (screen.width - w) / 2 + (window.screenX ?? 0));
    const top = Math.max(0, (screen.height - h) / 2 + (window.screenY ?? 0));
    this.win = window.open(this.url, "oisy-wallet", `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
    if (!this.win) throw new Error("OISY: the popup was blocked; allow popups for this site and try again");
    this.closedPoll = window.setInterval(() => {
      if (this.win?.closed) {
        for (const p of this.pending.values()) p.rej(new Error("OISY: the wallet window was closed"));
        this.pending.clear();
        this.disconnect();
      }
    }, 500);
    const started = Date.now();
    // ICRC-29: poll icrc29_status until the signer answers "ready"
    while (!this.origin) {
      if (Date.now() - started > timeoutMs) {
        this.disconnect();
        throw new Error("OISY: the wallet did not answer in time");
      }
      const id = `s${++this.seq}`;
      const reply = new Promise<unknown>((res, rej) => this.pending.set(id, { res, rej }));
      this.win.postMessage({ jsonrpc: "2.0", id, method: "icrc29_status" } satisfies Rpc, "*");
      await Promise.race([reply.catch(() => undefined), new Promise((r) => setTimeout(r, 500))]);
      this.pending.delete(id);
    }
    const perms = (await this.send("icrc25_request_permissions", { scopes: [{ method: "icrc27_accounts" }, { method: "icrc49_call_canister" }] })) as { scopes: { scope: { method: string }; state: string }[] };
    const denied = perms.scopes.filter((s) => s.state === "denied").map((s) => s.scope.method);
    if (denied.length) throw new Error(`OISY: permission denied for ${denied.join(", ")}`);
    const acc = (await this.send("icrc27_accounts")) as { accounts: OisyAccount[] };
    if (!acc.accounts?.length) throw new Error("OISY: the wallet returned no account");
    return acc.accounts[0];
  }

  private send(method: string, params?: unknown): Promise<unknown> {
    if (!this.win || !this.origin) return Promise.reject(new Error("OISY: not connected"));
    const id = ++this.seq;
    const p = new Promise<unknown>((res, rej) => this.pending.set(id, { res, rej }));
    this.win.postMessage({ jsonrpc: "2.0", id, method, params } satisfies Rpc, this.origin);
    return p;
  }

  /** ICRC-49: ask the wallet to sign and submit a canister call; resolves once the wallet has the certificate. */
  callCanister(args: { canisterId: string; sender: string; method: string; arg: Uint8Array }): Promise<{ contentMap: string; certificate: string }> {
    return this.send("icrc49_call_canister", { canisterId: args.canisterId, sender: args.sender, method: args.method, arg: b64(args.arg) }) as Promise<{ contentMap: string; certificate: string }>;
  }

  disconnect() {
    window.removeEventListener("message", this.onMessage);
    clearInterval(this.closedPoll);
    try {
      this.win?.close();
    } catch {
      /* cross-origin close can throw */
    }
    this.win = null;
    this.origin = undefined;
  }
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const AccountIdl = IDL.Record({ owner: IDL.Principal, subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)) });
const ApproveArgsIdl = IDL.Record({ fee: IDL.Opt(IDL.Nat), memo: IDL.Opt(IDL.Vec(IDL.Nat8)), from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)), created_at_time: IDL.Opt(IDL.Nat64), amount: IDL.Nat, expected_allowance: IDL.Opt(IDL.Nat), expires_at: IDL.Opt(IDL.Nat64), spender: AccountIdl });

/** Candid-encoded `icrc2_approve` arguments, the way the ledger expects them. */
export function approveArg(spender: string, amountE8s: bigint, expiresAtNs?: bigint): Uint8Array {
  return new Uint8Array(IDL.encode([ApproveArgsIdl], [{ fee: [], memo: [], from_subaccount: [], created_at_time: [], amount: amountE8s, expected_allowance: [], expires_at: expiresAtNs === undefined ? [] : [expiresAtNs], spender: { owner: Principal.fromText(spender), subaccount: [] } }]));
}

const TransferArgIdl = IDL.Record({ to: AccountIdl, fee: IDL.Opt(IDL.Nat), memo: IDL.Opt(IDL.Vec(IDL.Nat8)), from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)), created_at_time: IDL.Opt(IDL.Nat64), amount: IDL.Nat });
/** Candid-encoded `icrc1_transfer` arguments. */
export function transferArg(to: string, amountE8s: bigint): Uint8Array {
  return new Uint8Array(IDL.encode([TransferArgIdl], [{ to: { owner: Principal.fromText(to), subaccount: [] }, fee: [], memo: [], from_subaccount: [], created_at_time: [], amount: amountE8s }]));
}
/** Move ICP from the OISY wallet to `to` (the app's own account for the signed-in principal). */
export async function transferWithOisy(opts: { to: string; amountE8s: bigint; signerUrl?: string; onStatus?: (s: string) => void }): Promise<string> {
  const oisy = new Oisy(opts.signerUrl);
  try {
    opts.onStatus?.("Opening your OISY wallet…");
    const account = await oisy.connect();
    opts.onStatus?.(`Send ${Number(opts.amountE8s) / 1e8} ICP in OISY…`);
    await oisy.callCanister({ canisterId: ICP_LEDGER, sender: account.owner, method: "icrc1_transfer", arg: transferArg(opts.to, opts.amountE8s) });
    return account.owner;
  } finally {
    oisy.disconnect();
  }
}

/**
 * The whole payment handshake: connect OISY, have the user approve `amountE8s` for `spender` on the
 * ICP ledger, and return the wallet principal our canister will pull from. The popup closes after.
 */
export async function approveWithOisy(opts: { spender: string; amountE8s: bigint; signerUrl?: string; onStatus?: (s: string) => void; ledger?: string; symbol?: string; decimals?: number }): Promise<string> {
  const oisy = new Oisy(opts.signerUrl);
  try {
    opts.onStatus?.("Opening your OISY wallet…");
    const account = await oisy.connect();
    opts.onStatus?.(`Approve ${Number(opts.amountE8s) / 10 ** (opts.decimals ?? 8)} ${opts.symbol ?? "ICP"} in OISY…`);
    // every ICRC-2 ledger (ICP, TCYCLES, ckBTC, ckETH, ckUSDC, ckUSDT) takes the same approve record
    await oisy.callCanister({ canisterId: opts.ledger ?? ICP_LEDGER, sender: account.owner, method: "icrc2_approve", arg: approveArg(opts.spender, opts.amountE8s) });
    return account.owner;
  } finally {
    oisy.disconnect();
  }
}
