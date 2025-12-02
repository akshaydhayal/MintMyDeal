# Contracts: Solana Native Program for Deal & Loyalty Platform

This workspace contains a native Solana program (no Anchor) implementing core PDAs and instructions for a Web3 Groupon-style platform, plus a small Rust CLI and scripts for local and devnet testing.

## Layout

- `programs/deal_platform`: Solana program source code
- `cli`: Rust CLI to call program instructions on any cluster
- `scripts`: Helper scripts for building, local testing, and devnet deploy/test
- `tests`: Bun + TypeScript tests using @solana/web3.js and borsh

## Prereqs

- Rust + cargo
- Solana CLI (v1.18.x) with SBF toolchain installed
  - `solana --version`
  - `solana-install init 1.18.26`
  - `cargo build-sbf` available
- Bun runtime for tests: `curl -fsSL https://bun.sh/install | bash`

## Quickstart

### Local validator

1) Start validator in another terminal:
```bash
solana-test-validator
```

2) Deploy locally:
```bash
cd contracts
./scripts/local-deploy.sh
```

3) Run Bun tests (uses the program-id written by deploy script):
```bash
cd contracts/tests
bun install
export PRIVATE_KEY_BASE58=$(solana-keygen pubkey -k ~/.config/solana/id.json >/dev/null 2>&1; cat ~/.config/solana/id.json | jq -r 'join(",")' | sed 's/,/ /g' | xargs -n1 printf "%d " | xxd -r -p | base58) # or set manually
# Prefer: export PRIVATE_KEY_BASE58=<base58-secret-key>
SOLANA_URL=http://127.0.0.1:8899 bun test --silent src/**/*.test.ts
```

Alternative shortcut:
```bash
cd contracts
./scripts/local-test.sh
```

### Devnet deploy + tests

```bash
cd contracts
./scripts/devnet-deploy.sh
cd tests && bun install
export PRIVATE_KEY_BASE58=<base58-secret-key with devnet SOL>
SOLANA_URL=https://api.devnet.solana.com bun test --silent src/**/*.test.ts
```

### Program ID management

The program reads its ID from `programs/deal_platform/program-id` via `include_str!`. The deploy scripts will:

- Create a new program keypair if missing
- Write the public key into `program-id`
- Build SBF and deploy

If you already have a keypair, put it at `programs/deal_platform/deal_platform-keypair.json` and re-run the deploy script.

## Instructions implemented

- `register_merchant(name, uri)` → creates Merchant PDA
- `create_deal(title, description, discount_percent, expiry, total_supply)` → creates Deal PDA
- `mint_coupon_nft(deal_id)` → increments minted counter up to `total_supply` (future: Metaplex CPI)
- `redeem_coupon(mint_pubkey)` → creates RedeemLog PDA (prevents double redemption)
- `add_review(rating, comment)` → creates Review PDA for a user+deal

Note: NFT minting/burning is stubbed for now; current version tracks supply and redemption log on-chain.
