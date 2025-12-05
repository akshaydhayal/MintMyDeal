# 🧪 Testing the Integrated Marketplace

## Quick Test Checklist

### ✅ **Step 1: Deploy Contract**
```bash
cd contracts
cargo build-sbf --manifest-path programs/deal_platform/Cargo.toml
solana program deploy --url devnet target/deploy/deal_platform.so
```

**Expected:** Successfully deployed program, note the program ID.

---

### ✅ **Step 2: Configure Frontend**
Update `frontend/.env.local`:
```bash
NEXT_PUBLIC_PROGRAM_ID=<YOUR_PROGRAM_ID_FROM_STEP_1>
```

---

### ✅ **Step 3: Start Frontend**
```bash
cd frontend
npm install  # if first time
npm run dev
```

**Expected:** Server running on `http://localhost:3000`

---

### ✅ **Step 4: Test Complete Flow**

#### **4.1 Setup**
1. Open `http://localhost:3000`
2. Connect your Solana wallet (ensure it has devnet SOL)
3. Get devnet SOL if needed: `solana airdrop 2`

#### **4.2 Register as Merchant**
1. Go to "Merchant" page
2. Fill in merchant name and website
3. Click "Register as Merchant"
4. **Expected:** Success toast, merchant profile appears

#### **4.3 Create a Deal**
1. On Merchant page, click "Create New Deal"
2. Fill in deal details:
   - Title: "Test Pizza Deal"
   - Description: "50% off pizza"
   - Discount: 50
   - Supply: 10
   - Expiry: Future date
   - Upload image
3. Click "Create Deal"
4. **Expected:** 
   - Image uploading message
   - Metadata uploading message
   - Transaction success toast with explorer link

#### **4.4 Mint NFT Coupon**
1. Go to "Deals" page
2. Click on your created deal
3. Click "Mint NFT Coupon"
4. **Expected:** 
   - NFT minted successfully
   - Success toast with transaction link
   - Supply counter updates

#### **4.5 List NFT for Sale**
1. Go to "Profile" page
2. You should see your minted NFT
3. Click "💰 List for Sale"
4. Enter price (e.g., "0.5" for 0.5 SOL)
5. Click "💰 List NFT"
6. **Expected:** 
   - Listing transaction success
   - NFT disappears from profile (now in escrow)
   - Success toast

#### **4.6 View Marketplace**
1. Go to "Marketplace" page
2. **Expected:** 
   - Your listed NFT appears
   - Shows image, title, price
   - "💰 Buy Now" button visible

#### **4.7 Buy NFT (use different wallet)**
1. Disconnect current wallet
2. Connect a different wallet (with devnet SOL)
3. Go to "Marketplace" page
4. Click "💰 Buy Now" on the listing
5. **Expected:** 
   - Purchase transaction success
   - SOL transferred to seller
   - NFT appears in buyer's profile
   - Listing disappears from marketplace

#### **4.8 Verify Ownership**
1. Go to "Profile" page
2. **Expected:** NFT now owned by buyer
3. Can list it again or redeem it

---

## 🐛 Troubleshooting

### **Error: "Invalid listing PDA"**
- **Cause:** Mismatch in PDA derivation
- **Fix:** Ensure you're using the correct program ID

### **Error: "Insufficient funds"**
- **Cause:** Not enough SOL in wallet
- **Fix:** Run `solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet`

### **Error: "custom program error: 0x4"**
- **Cause:** Merchant not registered
- **Fix:** Register as merchant first on Merchant page

### **NFT not showing in Profile**
- **Cause:** May need to refresh
- **Fix:** Click the "🔄 Refresh" button or reload page

---

## 📊 Expected Results

### **Transaction Logs:**

#### **List NFT:**
```
Program <PROGRAM_ID> invoke [1]
Program 11111111111111111111111111111111 invoke [2]
Program 11111111111111111111111111111111 success
Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [2]
Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
Program log: NFT listed for 500000000 lamports
Program <PROGRAM_ID> consumed XXXXX of 200000 compute units
Program <PROGRAM_ID> success
```

#### **Buy NFT:**
```
Program <PROGRAM_ID> invoke [1]
Program 11111111111111111111111111111111 invoke [2]
Program 11111111111111111111111111111111 success
Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [2]
Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
Program log: NFT purchased for 500000000 lamports
Program <PROGRAM_ID> consumed XXXXX of 200000 compute units
Program <PROGRAM_ID> success
```

---

## ✅ Success Criteria

- ✅ Contract deploys without errors
- ✅ Merchant can register
- ✅ Deal can be created with image/metadata upload
- ✅ NFT coupon can be minted
- ✅ NFT appears in profile
- ✅ NFT can be listed for sale
- ✅ Listing appears on marketplace
- ✅ Another user can buy the NFT
- ✅ SOL transfers correctly
- ✅ NFT ownership transfers correctly
- ✅ Listing is closed after purchase

---

## 🎉 If All Tests Pass

**Congratulations!** 🎊

Your integrated marketplace is working perfectly! Users can now:
- ✅ Mint NFT coupons from deals
- ✅ List their NFTs for sale
- ✅ Buy NFTs from other users
- ✅ Transfer ownership seamlessly

**All in ONE contract!** 🚀

---

## 📝 Next Steps

### **Optional Enhancements:**
1. Add "Cancel Listing" functionality
2. Add "Make Offer" for negotiation
3. Add listing fees (platform revenue)
4. Add royalties to original deal creator
5. Add filtering/sorting on marketplace

### **Production Checklist:**
- [ ] Audit smart contract
- [ ] Test on mainnet-beta with real SOL
- [ ] Set up monitoring
- [ ] Add rate limiting
- [ ] Implement caching for listings
- [ ] Add analytics

---

**Happy Testing!** 🧪✨

