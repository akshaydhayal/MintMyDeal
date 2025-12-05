# 🎨 Marketplace Visual Guide

## What You'll See

---

## 📱 Page 1: Profile (/profile)

```
╔═══════════════════════════════════════════════════════╗
║  🐵 Monke Deals    [Deals] [🛒 Marketplace] [Profile]║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  My Profile                                          ║
║  Your NFT coupons                                    ║
║                                                       ║
║  Your NFTs (3)                                       ║
║                                                       ║
║  ┌─────────┐  ┌─────────┐  ┌─────────┐             ║
║  │ [IMAGE] │  │ [IMAGE] │  │ [IMAGE] │             ║
║  │  10% OFF│  │  15% OFF│  │  20% OFF│             ║
║  ├─────────┤  ├─────────┤  ├─────────┤             ║
║  │ Pizza   │  │ Coffee  │  │ Burger  │             ║
║  │ Coupon  │  │ Coupon  │  │ Coupon  │             ║
║  │         │  │         │  │         │             ║
║  │ [💰 List]│  │ [💰 List]│  │ [💰 List]│             ║
║  │ for Sale│  │ for Sale│  │ for Sale│             ║
║  └─────────┘  └─────────┘  └─────────┘             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝

Click "💰 List for Sale" → Modal Opens:

╔═══════════════════════════════════╗
║  💰 List NFT for Sale            ║
╟───────────────────────────────────╢
║  [NFT IMAGE PREVIEW]             ║
║  Pizza Coupon                    ║
║                                  ║
║  Price (SOL) *                   ║
║  ┌───────────────────────────┐  ║
║  │ 0.5                       │  ║
║  └───────────────────────────┘  ║
║  Buyers will pay this in SOL    ║
║                                  ║
║  [Cancel]    [💰 List NFT]      ║
╚═══════════════════════════════════╝
```

---

## 🛒 Page 2: Marketplace (/marketplace)

```
╔═══════════════════════════════════════════════════════╗
║  🐵 Monke Deals    [Deals] [🛒 Marketplace] [Profile]║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  🛒 NFT Marketplace                                  ║
║  Buy NFT coupons from other users                    ║
║                                                       ║
║  3 listings available               [🔄 Refresh]     ║
║                                                       ║
║  ┌─────────┐  ┌─────────┐  ┌─────────┐             ║
║  │ [IMAGE] │  │ [IMAGE] │  │ [IMAGE] │             ║
║  │  10% OFF│  │  15% OFF│  │  20% OFF│             ║
║  ├─────────┤  ├─────────┤  ├─────────┤             ║
║  │ Pizza   │  │ Coffee  │  │ Burger  │             ║
║  │ Coupon  │  │ Coupon  │  │ Coupon  │             ║
║  │         │  │         │  │         │             ║
║  │ Price   │  │ Price   │  │ Price   │             ║
║  │ 0.5 SOL │  │ 0.3 SOL │  │ 0.8 SOL │             ║
║  │         │  │         │  │         │             ║
║  │[💰 Buy  │  │[💰 Buy  │  │[💰 Buy  │             ║
║  │  Now]   │  │  Now]   │  │  Now]   │             ║
║  └─────────┘  └─────────┘  └─────────┘             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

---

## 🔄 Transaction Flow

### **Listing an NFT:**
```
1. User on Profile Page
   ↓
2. Clicks "💰 List for Sale"
   ↓
3. Modal Opens
   - Shows NFT preview
   - Input price field
   ↓
4. User enters: 0.5 SOL
   ↓
5. Clicks "💰 List NFT"
   ↓
6. Toast: "⏳ Listing NFT..."
   ↓
7. Wallet: Sign Transaction
   ↓
8. Toast: "⏳ Confirming transaction..."
   ↓
9. Toast: "✅ NFT Listed Successfully!"
   ↓
10. NFT disappears from Profile
    NFT appears on Marketplace
```

### **Buying an NFT:**
```
1. User on Marketplace Page
   ↓
2. Sees NFT listing: 0.5 SOL
   ↓
3. Clicks "💰 Buy Now"
   ↓
4. Toast: "⏳ Buying NFT..."
   ↓
5. Wallet: Sign Transaction
   ↓
6. Toast: "⏳ Confirming transaction..."
   ↓
7. Toast: "✅ NFT Purchased Successfully!"
   ↓
8. NFT appears in wallet
   Can view in Profile
   Can re-sell if desired!
```

---

## 🎯 Toast Notifications

### **Loading:**
```
┌────────────────────────────────┐
│ ⏳  Listing NFT...             │
│     Preparing transaction      │
└────────────────────────────────┘
```

### **Success:**
```
┌────────────────────────────────┐
│ ✅  NFT Listed Successfully!   │
│     Listed for 0.5 SOL         │
│     View on Solana Explorer →  │
└────────────────────────────────┘
(Auto-dismisses after 10 seconds)
```

### **Error:**
```
┌────────────────────────────────┐
│ ❌  Listing Failed             │
│     Insufficient SOL balance   │
│     (Error code: 0x1)          │
└────────────────────────────────┘
```

---

## 📊 Data Flow Diagram

```
┌─────────┐
│  User   │
│ Wallet  │
└────┬────┘
     │
     ├─── List NFT (Profile Page)
     │    │
     │    ├→ Sign TX
     │    │
     │    ├→ Smart Contract: list_nft
     │    │  │
     │    │  ├─ Create Listing PDA
     │    │  │  • Seller: User
     │    │  │  • NFT Mint: xyz123
     │    │  │  • Price: 0.5 SOL
     │    │  │
     │    │  └─ Transfer NFT → Escrow PDA
     │    │
     │    └→ NFT now on Marketplace
     │
     └─── Buy NFT (Marketplace Page)
          │
          ├→ Sign TX
          │
          ├→ Smart Contract: buy_nft
          │  │
          │  ├─ Transfer SOL: Buyer → Seller
          │  │
          │  ├─ Transfer NFT: Escrow → Buyer
          │  │
          │  └─ Close Listing PDA
          │
          └→ NFT in Buyer's Wallet
```

---

## 🎨 Color Scheme

### **Profile Page:**
- Primary: Blue (`blue-600`)
- Buttons: Blue with hover
- Cards: Neutral with blue borders

### **Marketplace Page:**
- Primary: Green for "Buy" (`green-600`)
- Price: Blue cards
- Listings: Neutral cards with hover

### **Modals:**
- Background: Dark (`neutral-900`)
- Border: Blue glow
- Buttons: Blue/Green

### **Toasts:**
- Loading: Purple
- Success: Green
- Error: Red
- Background: Semi-transparent dark

---

## 📱 Responsive Design

### **Desktop (>1024px):**
- 3 columns of NFT cards
- Full navigation visible
- Large modals

### **Tablet (768-1024px):**
- 2 columns of NFT cards
- Compact navigation
- Medium modals

### **Mobile (<768px):**
- 1 column of NFT cards
- Hamburger menu
- Full-screen modals

---

## ✨ Animations

### **Cards:**
- Hover: Scale up + shadow
- Click: Slight press effect

### **Buttons:**
- Hover: Darker background
- Disabled: Opacity 50%
- Loading: Spinning icon

### **Toasts:**
- Enter: Slide in from right
- Exit: Fade out
- Progress bar: Linear animation

### **Loaders:**
- Spinner: Rotate 360°
- Skeleton: Pulse opacity

---

## 🎯 User Journey Map

```
NEW USER:
  └─ Browse Deals → Mint NFT → View in Profile
       ↓
  Use coupon OR sell on marketplace
       ↓
  If sell: List on Profile → Appears on Marketplace
       ↓
  Another user buys → Receive SOL

BUYER:
  └─ Browse Marketplace → Find good deal
       ↓
  Buy NFT → NFT in wallet
       ↓
  Use coupon OR re-sell for profit
```

---

## 🏆 Success Metrics

### **For Sellers:**
✅ Can list NFT in < 30 seconds
✅ Clear price input
✅ Immediate feedback
✅ Receive SOL instantly on sale

### **For Buyers:**
✅ Can find NFT in < 10 seconds
✅ Price clearly displayed
✅ One-click purchase
✅ NFT in wallet immediately

---

## 🎉 The Result

A **beautiful, simple, functional** marketplace that:

✨ **Just Works**
✨ **Looks Great**
✨ **Feels Fast**
✨ **Easy to Use**

**Ready for users!** 🚀
