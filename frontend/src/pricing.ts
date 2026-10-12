// What a new notebook costs Lab to start, in ICP: the canister's creation fee plus the cycles the
// registry gives it, at the cycles minting canister's ICP/XDR rate (1 XDR buys 1 TC of cycles).

/** Creating a canister on a 13-node subnet costs 0.5 TC; the registry then grants it 1 TC. */
export const SPAWN_CYCLES = 1_500_000_000_000n;
/** Cycles one ICP buys today, from the CMC's `xdr_permyriad_per_icp` (10,000ths of an XDR per ICP). */
export const cyclesPerIcp = (xdrPermyriadPerIcp: bigint): bigint => xdrPermyriadPerIcp * 100_000_000n;
/** The smallest deposit for a new notebook, in e8s: enough ICP to cover starting it, rounded up to
 *  the next half ICP, and never under 1 ICP. Without a rate it is 1 ICP. */
export function minDepositE8s(xdrPermyriadPerIcp?: bigint, spawnCycles = SPAWN_CYCLES): bigint {
  const floor = 100_000_000n;
  if (!xdrPermyriadPerIcp || xdrPermyriadPerIcp <= 0n) return floor;
  const e8s = (spawnCycles * 100_000_000n + cyclesPerIcp(xdrPermyriadPerIcp) - 1n) / cyclesPerIcp(xdrPermyriadPerIcp);
  const half = 50_000_000n;
  const rounded = ((e8s + half - 1n) / half) * half;
  return rounded > floor ? rounded : floor;
}
