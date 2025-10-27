# 🚀 Marketplace Quick Start Guide

## Deploy & Test in 5 Minutes!

---

## 📋 Prerequisites
- Solana CLI installed
- Wallet with devnet SOL
- Node.js & npm installed

---

## ⚡ Quick Deploy

### **1. Build & Deploy Program** (2 minutes)
```bash
cd contracts

# Build the marketplace program
cargo build-sbf --manifest-path programs/marketplace/Cargo.toml

# Deploy to devnet
solana program deploy --url devnet target/deploy/marketplace.so

# Copy the Program ID that's printed!
```

### **2. Update Frontend** (1 minute)
```bash
cd frontend

# Create or update .env.local
echo "NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=<YOUR_PROGRAM_ID_HERE>" >> .env.local

# Install dependencies (if needed)
npm install

# Start dev server
npm run dev
```

### **3. Test the Marketplace!** (2 minutes)

#### **Step 1: Get an NFT Coupon**
1. Go to http://localhost:3000/deals
2. Connect your wallet (make sure it has devnet SOL)
3. Mint an NFT coupon from any deal

#### **Step 2: List Your NFT**
1. Go to http://localhost:3000/profile
2. See your minted NFT
3. Click "💰 List for Sale"
4. Enter price (e.g., `0.1` SOL)
5. Click "List NFT" and confirm transaction
6. ✅ NFT is now listed!

#### **Step 3: Buy an NFT** (use different wallet)
1. Switch to another wallet (or use incognito with new wallet)
2. Go to http://localhost:3000/marketplace
3. See the listed NFT
4. Click "💰 Buy Now"
5. Confirm transaction
6. ✅ NFT transferred to your wallet!

---

## 🎯 Testing Checklist

### **Seller Tests:**
- [ ] Can see owned NFTs in Profile
- [ ] Can list NFT with custom price
- [ ] NFT disappears from Profile after listing
- [ ] NFT appears on Marketplace
- [ ] Receive SOL when someone buys

### **Buyer Tests:**
- [ ] Can see all listings on Marketplace
- [ ] Price displays correctly
- [ ] Can buy NFT with sufficient SOL
- [ ] NFT appears in wallet after purchase
- [ ] Can re-sell purchased NFT

---

## 🔧 Common Commands

### **Check Program Account**
```bash
solana account <MARKETPLACE_PROGRAM_ID> --url devnet
```

### **Check Listing PDA**
```bash
# Derive PDA manually
solana program derive-address <MARKETPLACE_PROGRAM_ID> \
  "listing" <NFT_MINT> <SELLER_PUBKEY>
```

### **Monitor Transactions**
```bash
# Watch wallet transactions
solana logs --url devnet
```

---

## 💡 Pro Tips

### **Get Devnet SOL**
```bash
solana airdrop 2 --url devnet
```

### **Check NFT Token Accounts**
```bash
spl-token accounts --url devnet
```

### **View on Explorer**
After each transaction, click the "View on Solana Explorer →" link in the toast notification to see on-chain details!

---

## 🐛 Quick Fixes

### **"Program Not Found"**
- Make sure `NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID` is set correctly
- Restart dev server after updating .env.local

### **"Insufficient SOL"**
```bash
solana airdrop 2 --url devnet
```

### **"NFT Not Showing"**
- Wait 30 seconds and refresh
- Check wallet is connected
- Verify transaction confirmed on Explorer

---

## 📊 What to Expect

### **Gas Costs (Devnet SOL):**
- List NFT: ~0.002 SOL
- Buy NFT: ~0.001 SOL
- Create ATA: ~0.002 SOL (one-time)

### **Transaction Times:**
- List: 1-3 seconds
- Buy: 1-3 seconds
- Confirmation: 15-30 seconds

---

## 🎉 Success!

If you can complete all steps above, your marketplace is **fully functional**!

**Next Steps:**
- Test with friends
- Add platform fees if desired
- Deploy to mainnet when ready
- Add more features from `MARKETPLACE_README.md`

---

## 📞 Need Help?

Check the full `MARKETPLACE_README.md` for:
- Architecture details
- Troubleshooting guide
- Security features
- Future enhancements

**Happy Trading!** 🛒🚀

