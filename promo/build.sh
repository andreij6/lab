#!/usr/bin/env bash
# Render and encode every promo scene (or just the ones named): promo/out/lab-<scene>.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
scenes=("$@")
[ ${#scenes[@]} -gt 0 ] || scenes=($(ls -d promo/*/index.html | xargs -n1 dirname | xargs -n1 basename))
for s in "${scenes[@]}"; do
  node promo/render.mjs "$s" | tail -1
  swift promo/encode.swift "promo/out/$s/frames" "promo/out/lab-$s.mp4" 30
done
