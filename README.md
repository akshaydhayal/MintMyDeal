# 🐵 Mint My Deals - Web3 Loyalty Platform on Solana

Live Project Link: [https://mint-my-deal.vercel.app/](https://mint-my-deal.vercel.app/)

**MintMyDeals** is a decentralized deal discovery and loyalty platform built on Solana where merchants create NFT-based coupons that users can mint, own, transfer, trade on our marketplace, or redeem at merchants.

## 📖 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Screenshots](#screenshots)
- [Demo Video](#demo-video)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Smart Contract](#smart-contract)
- [Frontend Features](#frontend-features)
- [Marketplace](#marketplace)
- [Usage Guide](#usage-guide)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## 🎯 Overview

MintMyDeals revolutionizes traditional loyalty programs by transforming coupons into transferable NFTs on the Solana blockchain. Unlike conventional platforms that lock deals to user accounts, our platform enables:

- ✅ **True Ownership** - NFTs you truly own in your wallet
- ✅ **Peer-to-Peer Trading** - Built-in marketplace for trading coupons
- ✅ **Decentralized Storage** - Metadata stored on Arweave via Irys
- ✅ **Transparent & Verifiable** - All transactions on-chain
- ✅ **Merchant & User Friendly** - Intuitive interfaces for both parties

## ✨ Key Features

### For Merchants
- **Easy Registration** - Register on-chain with name and website
- **Deal Creation** - Create unlimited deals with:
  - Custom discount percentages
  - Supply limits (NFT quantity)
  - Expiry dates and times
  - NFT images and metadata
- **Deal Management** - View all created deals with stats
- **Automatic NFT Template** - Each deal becomes an NFT template users can mint

### For Users
- **Deal Discovery** - Browse active and expired deals in tabbed interface
- **One-Click Minting** - Mint NFT coupons directly to wallet
- **Wallet Integration** - Automatic NFT detection and display
- **Redemption** - Burn NFT on-chain and receive:
  - Transaction signature for verification
  - 16-digit alphanumeric coupon code
  - Works for both physical and online stores
- **Marketplace** - List or buy NFT coupons from other users

### Technical Features
- **Unified Smart Contract** - All features in one Solana program
- **Atomic Transaction Guards** - Prevents duplicate submissions
- **Automatic UI Updates** - Real-time state synchronization
- **Comprehensive Error Handling** - User-friendly error messages
- **Mobile Responsive** - Works on all devices

## 📸 Screenshots

### Homepage / Deals Discovery
![Deals Discovery Page](https://github.com/akshaydhayal/MintMyDeal/blob/main/frontend/assets/Mint-My-Deals0.png)
*Browse active and expired deals with our intuitive tab-based interface*

### Merchant Dashboard
![Merchant Dashboard](https://github.com/akshaydhayal/MintMyDeal/blob/main/frontend/assets/merchant%20register.png)
*Merchant Registration*

![Merchant Dashboard](https://github.com/akshaydhayal/MintMyDeal/blob/main/frontend/assets/merchant%20page.png)
*Merchants can create unlimited deals with detailed configuration options*

### Deal Creation Modal
![Create Deal Modal](https://github.com/akshaydhayal/MintMyDeal/blob/main/frontend/assets/create%20deal.png)
*Create deals with images, discounts, supply limits, and expiry dates*

### Deal Detail Page
![Deal Details](https://github.com/akshaydhayal/MintMyDeal/blob/main/frontend/assets/Mint-My-Deals00.png)
*View deal information, mint coupons, and read reviews*

### Marketplace
![Marketplace](https://github.com/akshaydhayal/MintMyDeal/blob/main/frontend/assets/marketplace%20page.png)
*Browse and purchase NFT coupons from other users*

### NFT Listing Modal
![NFT Minting](https://github.com/akshaydhayal/MintMyDeal/blob/main/frontend/assets/list%20nft.png)
*Seamless NFT Listing Modal*

### Redeem Page
![Redeem NFTs](https://github.com/akshaydhayal/MintMyDeal/blob/main/frontend/assets/redeem%20page.png)
*View all your NFT coupons and redeem them with one click*

### Redemption Success Modal
![Redemption Success](https://github.com/akshaydhayal/MintMyDeal/blob/main/frontend/assets/nft%20redeem.png)
*Clear redemption confirmation with coupon code and transaction proof*



---
## 🛠 Tech Stack

### Blockchain
- **Solana** - High-performance blockchain
- **Anchor Framework** - Rust-based Solana program framework
- **SPL Token** - Standard token program for NFTs
- **Metaplex Token Metadata** - NFT metadata standards

### Frontend
- **Next.js 13+** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Solana Web3.js** - Solana JavaScript library
- **@solana/wallet-adapter** - Wallet integration

### Storage
- **Irys (Arweave)** - Decentralized permanent storage for NFT metadata and images

### Development Tools
- **Rust** - Smart contract development
- **Cargo** - Rust package manager
- **npm/yarn** - JavaScript package manager

## 🏗 Architecture

### Smart Contract Architecture

```
deal_platform/
├── Instructions
│   ├── Register Merchant
│   ├── Create Deal
│   ├── Verify & Count Mint
│   ├── Redeem & Burn NFT
│   ├── Add Review
│   ├── List NFT (Marketplace)
│   └── Buy NFT (Marketplace)
│
├── State Accounts
│   ├── Merchant (PDA)
│   ├── Deal (PDA)
│   ├── Review (PDA)
│   ├── Redeem Log (PDA)
│   └── Listing (PDA)
│
└── Escrow System
    └── NFT Escrow Account (PDA)
```

### Frontend Architecture

```
frontend/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Home/redirect
│   ├── deals/             # Deal discovery
│   ├── deals/[id]         # Deal detail & minting
│   ├── merchant/          # Merchant dashboard
│   ├── redeem/            # NFT redemption
│   └── marketplace/       # NFT marketplace
│
├── lib/
│   ├── solana/            # Solana utilities
│   │   ├── instructions.ts    # Contract instructions
│   │   └── errors.ts           # Error handling
│   ├── umi/               # UMI (Metaplex) client
│   └── toast/             # Toast notifications
│
└── components/            # Reusable components
    └── Loader.tsx         # Loading skeletons
```

### Transaction Flow

1. **Deal Creation**: Merchant creates deal → Metadata uploaded to Irys → Deal account created on-chain
2. **NFT Minting**: User mints NFT → Metaplex NFT created → Deal counter incremented
3. **Redemption**: NFT burned → Redeem log created → Coupon code generated
4. **Marketplace**: NFT transferred to escrow → Listing created → Buyer purchases → NFT transferred

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Rust 1.70+ and Cargo
- Solana CLI (latest version)
- A Solana wallet (Phantom recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/monke-nft.git
   cd monke-nft
   ```

2. **Install dependencies**
   ```bash
   # Frontend dependencies
   cd frontend
   npm install

   # Smart contract dependencies (already in contracts folder)
   cd ../contracts/programs/deal_platform
   cargo build-sbf
   ```

3. **Set up environment variables**
   ```bash
   # In frontend directory, create .env.local
   NEXT_PUBLIC_PROGRAM_ID=your_program_id_here
   NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
   ```

4. **Deploy smart contract** (if needed)
   ```bash
   # Build and deploy
   cd contracts/programs/deal_platform
   anchor build
   anchor deploy
   ```

5. **Run the frontend**
   ```bash
   cd frontend
   npm run dev
   ```

6. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
monke-nft/
├── contracts/
│   ├── programs/
│   │   └── deal_platform/        # Solana smart contract
│   │       ├── src/
│   │       │   ├── lib.rs         # Program entry point
│   │       │   ├── state.rs       # Account structures
│   │       │   ├── instruction.rs # Instruction definitions
│   │       │   └── processor.rs   # Instruction handlers
│   │       └── Cargo.toml
│   └── tests/                     # Contract tests
│
├── frontend/
│   ├── app/                       # Next.js pages
│   ├── components/                # React components
│   ├── lib/                       # Utilities
│   ├── public/                    # Static assets
│   └── package.json
│
├── screenshots/                    # Screenshot images
│   ├── deals-discovery.png
│   ├── merchant-dashboard.png
│   └── ...
│
└── README.md                      # This file
```

## 📜 Smart Contract

### Program ID
```
DealPlatform Program (Your Program ID)
```

### Main Instructions

#### Register Merchant
Creates a merchant account on-chain with name and website URI.

#### Create Deal
Creates a deal with title, description, discount percentage, total supply, expiry, and metadata URIs.

#### Verify & Count Mint
Verifies NFT mint and increments deal's minted counter. Prevents over-minting.

#### Redeem & Burn
Burns the NFT and creates an immutable redemption log on-chain.

#### List NFT
Lists NFT on marketplace by transferring to escrow and creating listing account.

#### Buy NFT
Purchases NFT from marketplace by transferring SOL to seller and NFT to buyer.

### State Accounts

All accounts use Program Derived Addresses (PDAs) for deterministic address generation:

- **Merchant**: `[merchant, merchant_pubkey]`
- **Deal**: `[deal, merchant_pubkey, deal_id]`
- **Review**: `[review, deal_pda, user_pubkey]`
- **Redeem Log**: `[redeem, nft_mint]`
- **Listing**: `[listing, nft_mint, seller_pubkey]`
- **Escrow**: `[escrow, nft_mint]`

## 🎨 Frontend Features

### Wallet Integration
- Seamless Phantom wallet connection
- Automatic wallet detection
- Transaction signing with user approval
- Error handling for wallet rejections

### Transaction Management
- Atomic guards prevent duplicate submissions
- Real-time transaction status updates
- Automatic UI refresh after successful transactions
- Comprehensive error messages with Solana Explorer links

### User Experience
- Loading skeletons for better perceived performance
- Toast notifications for user feedback
- Responsive design for all screen sizes
- Intuitive navigation and clear CTAs

### NFT Display
- Automatic NFT fetching from user wallet
- Metadata parsing and image display
- Deal information matching
- Empty state handling

## 🛒 Marketplace

### Listing NFTs
- Simple price input interface
- Automatic escrow account creation
- NFT transferred to escrow on listing
- Listing visible on marketplace

### Buying NFTs
- Fixed-price listings only
- Automatic buyer ATA creation if needed
- SOL transferred to seller
- NFT transferred from escrow to buyer
- Listing account closed after purchase

### Validation
- Filters invalid listings (wrong size, invalid prices, zero addresses)
- Displays only active, valid listings
- Real-time listing updates

## 📖 Usage Guide

### For Merchants

1. **Connect Wallet**: Use Phantom or compatible Solana wallet
2. **Register**: Navigate to `/merchant` and register with name and website
3. **Create Deal**: Click "Create Deal" button, fill form:
   - Upload NFT image
   - Set discount percentage
   - Set total supply
   - Set expiry date/time
4. **View Deals**: See all your created deals with stats

### For Users

1. **Browse Deals**: Visit `/deals` to see active deals
2. **Mint NFT**: Click on a deal, then click "Mint NFT Coupon"
3. **View NFTs**: Go to `/redeem` to see all your NFT coupons
4. **Redeem**: Click "Redeem" on an NFT to burn it and get coupon code
5. **Trade**: Click "List NFT" to sell on marketplace, or browse `/marketplace` to buy


## 📝 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


---

**Built with ❤️ on Solana**

*Last updated: 2024*

