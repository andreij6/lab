#!/usr/bin/env bash
# Local only: the stand-in exchange rate canister with made-up prices (see canisters/xrc-dev).
set -euo pipefail
cd "$(dirname "$0")/.."
T=target/wasm32-unknown-unknown/release
cargo build --target wasm32-unknown-unknown --release -p xrc_dev
candid-extractor "$T/xrc_dev.wasm" > canisters/xrc-dev/xrc_dev.did
ic-wasm "$T/xrc_dev.wasm" -o target/xrc_dev.wasm shrink
ic-wasm target/xrc_dev.wasm -o target/xrc_dev.wasm metadata candid:service -f canisters/xrc-dev/xrc_dev.did -v public
if [ -n "${ICP_WASM_OUTPUT_PATH:-}" ]; then cp target/xrc_dev.wasm "$ICP_WASM_OUTPUT_PATH"; fi
