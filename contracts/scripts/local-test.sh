#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[1/2] Installing test deps (if needed)..."
cd tests && bun install && cd ..

echo "[2/2] Running Bun tests against localhost..."
(cd tests && SOLANA_URL=http://127.0.0.1:8899 bun test --silent src/**/*.test.ts)

echo "\nLocal Bun tests completed."
