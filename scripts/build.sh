#!/usr/bin/env bash
# Build the notebook canister first; the registry embeds it gzipped and spawns one per notebook.
set -euo pipefail
cd "$(dirname "$0")/.."
T=target/wasm32-unknown-unknown/release
build() {
  cargo build --target wasm32-unknown-unknown --release -p "$1"
  candid-extractor "$T/$1.wasm" > "canisters/$1/$1.did"
  ic-wasm "$T/$1.wasm" -o "target/$1.wasm" shrink
  ic-wasm "target/$1.wasm" -o "target/$1.wasm" metadata candid:service -f "canisters/$1/$1.did" -v public
}
build notebook
gzip -9nc target/notebook.wasm > target/notebook.wasm.gz
build registry
if [ -n "${ICP_WASM_OUTPUT_PATH:-}" ]; then cp target/registry.wasm "$ICP_WASM_OUTPUT_PATH"; fi
ls -l target/notebook.wasm.gz target/registry.wasm
