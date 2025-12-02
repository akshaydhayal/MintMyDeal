#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PROGRAM_DIR=programs/deal_platform
PROGRAM_ID=$(cat "$PROGRAM_DIR/program-id")

echo "Using PROGRAM_ID=$PROGRAM_ID"

echo "Building CLI..."
cargo build -p cli --release

CLI=target/release/monke_deals_cli

# Simple smoke test: register merchant and create a deal
$CLI --cluster devnet --program-id "$PROGRAM_ID" register-merchant \
	--name "Demo Merchant" \
	--uri "https://example.com/merchant/demo"

$CLI --cluster devnet --program-id "$PROGRAM_ID" create-deal \
	--deal-id 1 \
	--title "10% Off" \
	--description "Save on your next purchase" \
	--discount 10 \
	--expiry $(($(date +%s) + 86400)) \
	--total-supply 5

$CLI --cluster devnet --program-id "$PROGRAM_ID" mint-coupon --deal-id 1

$CLI --cluster devnet --program-id "$PROGRAM_ID" add-review \
	--deal-id 1 \
	--rating 5 \
	--comment "Great savings!"

RAND_MINT=$(solana-keygen new --no-bip39-passphrase --silent | head -n 1 | awk '{print $2}')
$CLI --cluster devnet --program-id "$PROGRAM_ID" redeem-coupon --mint "$RAND_MINT"

echo "Devnet smoke test complete."
