#!/usr/bin/env bash
# Local only: the stand-in LLM canister that forwards to Ollama (see canisters/llm-dev).
set -euo pipefail
cd "$(dirname "$0")/.."
T=target/wasm32-unknown-unknown/release
cargo build --target wasm32-unknown-unknown --release -p llm_dev
candid-extractor "$T/llm_dev.wasm" > canisters/llm-dev/llm_dev.did
ic-wasm "$T/llm_dev.wasm" -o target/llm_dev.wasm shrink
ic-wasm target/llm_dev.wasm -o target/llm_dev.wasm metadata candid:service -f canisters/llm-dev/llm_dev.did -v public
if [ -n "${ICP_WASM_OUTPUT_PATH:-}" ]; then cp target/llm_dev.wasm "$ICP_WASM_OUTPUT_PATH"; fi
