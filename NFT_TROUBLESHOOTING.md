# 🔍 NFT Troubleshooting Guide

## Issue: "I don't see any minted NFTs in the Profile page"

---

## ✅ What Was Fixed

Updated the Profile page to check **both** token programs:
- `TOKEN_PROGRAM_ID` (standard SPL tokens)
- `TOKEN_2022_PROGRAM_ID` (Token Extensions program)

Some NFTs use the newer Token-2022 program, so we now fetch from both.

---

## 🧪 How to Check If You Have NFTs

### **1. Check Your Wallet on Solana Explorer**

1. Go to: `https://explorer.solana.com/address/<YOUR_WALLET_ADDRESS>?cluster=devnet`
2. Replace `<YOUR_WALLET_ADDRESS>` with your wallet public key
3. Look at the "Tokens" tab
4. Check if you see any tokens with:
   - Amount: `1`
   - Decimals: `0`
   
These are likely your NFTs!

### **2. Check via Terminal**

```bash
# Get your wallet address
solana address

# Check token accounts
spl-token accounts --url devnet

# You should see something like:
# Token                                         Balance
# xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx       1
```

### **3. Check Browser Console**

1. Open your app (`http://localhost:3000/profile`)
2. Open browser DevTools (F12)
3. Go to "Console" tab
4. Look for the log: `Found X NFTs for user`
5. If X is 0, you don't have NFTs yet

---

## 🎯 Common Reasons for No NFTs

### **1. No NFTs Minted Yet**
**Solution:** Mint an NFT first!
1. Go to `/deals` page
2. Click on a deal
3. Click "Mint NFT Coupon"
4. Wait for transaction to confirm
5. Refresh `/profile` page

### **2. Wrong Network**
**Solution:** Ensure you're on devnet!
```bash
# Check current network
solana config get

# If not devnet, switch:
solana config set --url devnet
```

### **3. Wrong Wallet Connected**
**Solution:** 
- Make sure the wallet you minted with is the same wallet connected to the app
- Check wallet address in browser

### **4. RPC Issue**
**Solution:** Try different RPC endpoint in `.env.local`:
```bash
# Try different devnet RPC
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
# OR
NEXT_PUBLIC_SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

### **5. Metadata Not Found**
**Solution:** 
- Check if NFT was minted with proper metadata
- Look in browser console for "Failed to fetch NFT metadata" errors
- Verify metadata URI is accessible

### **6. Token Account Parsing Error**
**Solution:**
- This is rare, but check console for parsing errors
- NFT might use non-standard format

---

## 🐛 Debugging Steps

### **Step 1: Check if Mint Transaction Succeeded**

1. When you mint an NFT, save the transaction signature
2. Check on Solana Explorer:
   ```
   https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet
   ```
3. Look for "Success" status
4. Check "Token Balances" section for the minted NFT

### **Step 2: Verify Token Account Exists**

```bash
# Get associated token account
spl-token accounts --owner <YOUR_WALLET> --url devnet

# If you see accounts with balance 1, you have NFTs!
```

### **Step 3: Check Metadata Program**

NFTs use the Metaplex Token Metadata program:
- Program ID: `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`

Verify your NFT has metadata:
1. Get your NFT mint address
2. Check on explorer:
   ```
   https://explorer.solana.com/address/<MINT_ADDRESS>?cluster=devnet
   ```
3. Look for "Metadata" section

### **Step 4: Check Browser Console**

Open DevTools and look for:
- `Found X NFTs for user` - Should show count > 0
- Any error messages about:
  - Token account fetching
  - Metadata fetching
  - Network issues

### **Step 5: Manually Test Fetch**

Open browser console on `/profile` page and run:
```javascript
// Get connection
const connection = new Connection('https://api.devnet.solana.com');

// Your wallet address
const wallet = new PublicKey('YOUR_WALLET_ADDRESS');

// Fetch token accounts
const accounts = await connection.getTokenAccountsByOwner(wallet, {
  programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
});

console.log('Token accounts:', accounts.value.length);
```

---

## ✅ Expected Behavior

### **When You Have NFTs:**
- Profile page shows: "Your NFTs (X)" where X > 0
- NFT cards display with:
  - Image (or 🎫 emoji if no image)
  - NFT name
  - Deal title (if linked to a deal)
  - "💰 List for Sale" button

### **When You Don't Have NFTs:**
- Profile page shows: "📭 No NFTs Found"
- Message: "You don't have any NFT coupons yet"
- Button: "Browse Deals"

### **While Loading:**
- Shows 3 skeleton loaders (animated cards)

---

## 🔧 Quick Fixes

### **Fix 1: Clear Cache**
```bash
# In frontend directory
rm -rf .next
npm run dev
```

### **Fix 2: Reinstall Dependencies**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### **Fix 3: Try Different Browser**
- Some wallets work better in different browsers
- Try Chrome/Brave if using Firefox, or vice versa

### **Fix 4: Check Wallet Extension**
- Update wallet extension to latest version
- Try disconnecting and reconnecting
- Try a different wallet (Phantom, Solflare, etc.)

---

## 🎯 Test Flow

### **Complete Test to Verify Everything Works:**

1. **Connect Wallet**
   - Go to app
   - Connect wallet
   - Verify you're on devnet

2. **Register as Merchant**
   - Go to `/merchant`
   - Register with name and website
   - Transaction should succeed

3. **Create Deal**
   - On merchant page, click "Create New Deal"
   - Fill all fields
   - Upload image
   - Submit
   - Wait for image + metadata upload
   - Transaction should succeed

4. **Mint NFT**
   - Go to `/deals`
   - Click your deal
   - Click "Mint NFT Coupon"
   - Transaction should succeed
   - Save the transaction signature!

5. **Check Profile**
   - Go to `/profile`
   - Wait 5-10 seconds for loading
   - Check browser console: "Found X NFTs"
   - NFT should appear!

6. **If NFT Doesn't Appear:**
   - Wait 30 seconds (sometimes RPC is slow)
   - Hard refresh page (Ctrl+Shift+R or Cmd+Shift+R)
   - Check Solana Explorer with transaction signature
   - Check browser console for errors
   - Verify wallet address matches

---

## 📞 Still Not Working?

### **Gather This Info:**

1. **Wallet Address:**
   ```bash
   solana address
   ```

2. **Network:**
   ```bash
   solana config get
   ```

3. **Transaction Signature** (from mint)

4. **Browser Console Errors** (screenshot)

5. **RPC Endpoint** (from `.env.local`)

6. **Check if token account exists:**
   ```bash
   spl-token accounts --url devnet
   ```

### **Then Check:**

1. Verify NFT exists on Solana Explorer
2. Verify metadata exists and is accessible
3. Try different RPC endpoint
4. Try different wallet
5. Try different browser

---

## 🎉 Success Indicators

When everything works correctly:

✅ Browser console shows: `Found 1 NFTs for user` (or more)
✅ Profile page displays NFT card with image
✅ "💰 List for Sale" button is clickable
✅ No errors in console
✅ Loading completes within 5-10 seconds

---

## 📚 Related Files

- Frontend: `frontend/src/app/profile/page.tsx`
- Contract: `contracts/programs/deal_platform/src/processor.rs`
- Metadata: Stored on Irys/Arweave

---

**Most Common Issue:** Not waiting long enough after minting!
**Solution:** Wait 30 seconds, then refresh the page. Devnet can be slow! ⏰

