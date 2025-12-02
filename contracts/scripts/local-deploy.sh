#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PROGRAM_DIR=programs/deal_platform
KEYPAIR_FILE="$PROGRAM_DIR/deal_platform-keypair.json"
PROGRAM_ID_FILE="$PROGRAM_DIR/program-id"

solana config set --url http://127.0.0.1:8899 >/dev/null

if [ ! -f "$KEYPAIR_FILE" ]; then
	echo "Generating program keypair..."
	solana-keygen new --no-bip39-passphrase --outfile "$KEYPAIR_FILE" --silent
fi

PROGRAM_ID=$(solana-keygen pubkey "$KEYPAIR_FILE")

echo "$PROGRAM_ID" > "$PROGRAM_ID_FILE"

echo "Program ID set to $PROGRAM_ID"

echo "[1/3] Building SBF..."
cargo build-sbf --manifest-path $PROGRAM_DIR/Cargo.toml

echo "[2/3] Deploying to local validator..."
solana program deploy "$PROGRAM_DIR/target/deploy/deal_platform.so" --program-id "$KEYPAIR_FILE"

echo "[3/3] Verify deployment:"
solana program show "$PROGRAM_ID"
