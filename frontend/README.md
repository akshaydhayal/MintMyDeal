# Monke Deals Frontend

Next.js app with Tailwind and Solana Wallet Adapter for the Deal & Loyalty platform.

## Setup

```bash
cd frontend
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_SOLANA_RPC=http://127.0.0.1:8899
NEXT_PUBLIC_PROGRAM_ID=<paste from ../contracts/programs/deal_platform/program-id>
```

Run dev:

```bash
npm run dev
```

## Pages

- `/` Home
- `/merchant` Register merchant and create deals
- `/deals` Create deal and mint coupon (counter-only)
- `/redeem` Redeem coupon (writes RedeemLog)

## Notes

- This client uses JS-side borsh and instruction builders aligned with the on-chain program.
- NFT mint/burn is not implemented yet; mint is a counter-only placeholder.
