# icp-cli, as the owner

Only when you hold the owner's identity. Every Candid method marked *owner* refuses anyone else;
with a key alone, use the JSON API instead. Install icp-cli (1.7 or later) from
https://cli.internetcomputer.org; it also buys cycles with a card.

Set the identity first (`icp identity use <name>`); add `-e ic` from a project folder, or
`--network ic`, to reach mainnet. Query methods take `--query` and cost nothing.

```bash
# the space
icp canister status __NOTEBOOK__ -e ic                      # cycles, controllers, memory
icp canister call __NOTEBOOK__ info '()' --query -e ic       # name, files, bytes, cycles, the ICP top-up account
icp canister call __NOTEBOOK__ read '("index.md")' --query -e ic
icp canister call __NOTEBOOK__ write '("Topic.md", "# Topic\n...")' -e ic   # owner; costs the bytes stored

# money
icp token balance __NOTEBOOK__ -e ic                         # ICP on the space's account (free)
icp token transfer 1 __NOTEBOOK__ -e ic                      # fund it: 1 ICP from your identity, minus the 0.0001 ICP fee
icp canister call __NOTEBOOK__ btc_address '()' -e ic         # the BTC deposit address (derived once, then kept)
icp canister call __NOTEBOOK__ eth_address '()' -e ic         # the ETH address (threshold ECDSA)
icp canister call __NOTEBOOK__ spends '(20 : nat32)' --query -e ic   # the last 20 transfers agents made

# fuel
icp canister call __NOTEBOOK__ fuel_from_wallet '(50_000_000 : nat64)' -e ic   # 0.5 ICP of the space's own ICP into cycles
icp cycles buy --cycles 1t                                   # a card: $ at the XDR rate plus 2.9% + $0.30, onto your identity's cycles account
icp canister top-up __NOTEBOOK__ --amount 1t -e ic           # then move them into the space
icp cycles mint --help                                       # ICP from your identity into cycles instead of a card

# keys
icp canister call __NOTEBOOK__ create_agent_key '("my-agent")' -e ic
icp canister call __NOTEBOOK__ set_key_spend '("my-agent", true)' -e ic   # lets that key move funds
icp canister call __NOTEBOOK__ revoke_agent_key '("my-agent")' -e ic
```

Owner-only methods (`info`, `write`, `fuel_from_wallet`, `set_key_spend`, `spends`, `btc_address`,
`eth_address`, `sweep_deposits`, `delete`, `set_settings`, `transfer_owner`, ...) answer "not the
owner" to any other identity.

Everything above is for mainnet. Locally there is an ICP ledger and cycles but no ck ledgers, no
ckBTC minter and no card gateway.
