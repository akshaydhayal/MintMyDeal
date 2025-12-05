# Toast Notification Examples - Visual Guide

## 🎨 Success Toasts (with Explorer Links)

### Example 1: Merchant Registration
```
╔════════════════════════════════════════════════════════════╗
║ ✅  Merchant Registered Successfully!                    × ║
║                                                            ║
║ Transaction: 3shL...LBLAcbG                                ║
║                                                            ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝
   └─ Clickable link opens:
      https://explorer.solana.com/tx/3shL...?cluster=devnet
```

### Example 2: Deal Creation
```
╔════════════════════════════════════════════════════════════╗
║ ✅  Deal #1 Created Successfully!                        × ║
║                                                            ║
║ Transaction: 4abc...xyz789                                 ║
║                                                            ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝
```

### Example 3: NFT Minting
```
╔════════════════════════════════════════════════════════════╗
║ ✅  NFT Minted Successfully!                             × ║
║                                                            ║
║ Mint: 5def...ghi012                                        ║
║                                                            ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝
```

### Example 4: Collection Creation
```
╔════════════════════════════════════════════════════════════╗
║ ✅  Collection Created Successfully!                     × ║
║                                                            ║
║ Mint: 6jkl...mno345                                        ║
║                                                            ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝
```

### Example 5: Redemption
```
╔════════════════════════════════════════════════════════════╗
║ ✅  NFT Redeemed Successfully!                           × ║
║                                                            ║
║ Transaction: 7pqr...stu678                                 ║
║                                                            ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝
```

---

## 🚨 Error Toasts (with Error Codes)

### Example 1: Unauthorized (0x4)
```
╔════════════════════════════════════════════════════════════╗
║ ❌  Deal Creation Failed                                 × ║
║                                                            ║
║ Unauthorized - you don't have permission for this          ║
║ action (Error code: 0x4)                                   ║
╚════════════════════════════════════════════════════════════╝
   └─ User needs to register as merchant first
```

### Example 2: Deal Sold Out (0x5)
```
╔════════════════════════════════════════════════════════════╗
║ ❌  Minting Failed                                       × ║
║                                                            ║
║ Deal sold out - no more NFTs available to mint             ║
║ (Error code: 0x5)                                          ║
╚════════════════════════════════════════════════════════════╝
   └─ All NFTs have been minted
```

### Example 3: Already Initialized (0x2)
```
╔════════════════════════════════════════════════════════════╗
║ ❌  Registration Failed                                  × ║
║                                                            ║
║ This account has already been initialized                  ║
║ (Error code: 0x2)                                          ║
╚════════════════════════════════════════════════════════════╝
   └─ Merchant already registered
```

### Example 4: Already Redeemed (0x6)
```
╔════════════════════════════════════════════════════════════╗
║ ❌  Redemption Failed                                    × ║
║                                                            ║
║ This coupon has already been redeemed                      ║
║ (Error code: 0x6)                                          ║
╚════════════════════════════════════════════════════════════╝
   └─ Can't redeem the same NFT twice
```

### Example 5: Invalid Input (0x7)
```
╔════════════════════════════════════════════════════════════╗
║ ❌  Minting Failed                                       × ║
║                                                            ║
║ Invalid input - please check your data                     ║
║ (Error code: 0x7)                                          ║
╚════════════════════════════════════════════════════════════╝
   └─ Bad form data or parameters
```

### Example 6: PDA Derivation Mismatch (0x1)
```
╔════════════════════════════════════════════════════════════╗
║ ❌  Transaction Failed                                   × ║
║                                                            ║
║ Account address mismatch - incorrect PDA derivation        ║
║ (Error code: 0x1)                                          ║
╚════════════════════════════════════════════════════════════╝
   └─ Internal error - contact support
```

### Example 7: Math Overflow (0x3)
```
╔════════════════════════════════════════════════════════════╗
║ ❌  Transaction Failed                                   × ║
║                                                            ║
║ Math overflow occurred - value too large                   ║
║ (Error code: 0x3)                                          ║
╚════════════════════════════════════════════════════════════╝
   └─ Number exceeds maximum
```

### Example 8: Invalid Instruction (0x0)
```
╔════════════════════════════════════════════════════════════╗
║ ❌  Transaction Failed                                   × ║
║                                                            ║
║ Invalid instruction - please try again                     ║
║ (Error code: 0x0)                                          ║
╚════════════════════════════════════════════════════════════╝
   └─ Wrong instruction format - refresh and retry
```

---

## ⏳ Loading Toasts (Progress Updates)

### Example 1: Merchant Registration
```
Step 1:
╔════════════════════════════════════════════════════════════╗
║ ⏳●  Registering merchant...                                ║
║                                                            ║
║ Preparing transaction                                      ║
╚════════════════════════════════════════════════════════════╝

Step 2:
╔════════════════════════════════════════════════════════════╗
║ ⏳●  Confirming transaction...                              ║
║                                                            ║
║ 3shL...LAC3                                                ║
╚════════════════════════════════════════════════════════════╝

Step 3 (Final):
╔════════════════════════════════════════════════════════════╗
║ ✅  Merchant Registered Successfully!                    × ║
║                                                            ║
║ Transaction: 3shL...LAC3                                   ║
║                                                            ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝
```

### Example 2: Deal Creation (Multi-Step)
```
Step 1:
╔════════════════════════════════════════════════════════════╗
║ ⏳●  Checking merchant registration...                      ║
╚════════════════════════════════════════════════════════════╝

Step 2:
╔════════════════════════════════════════════════════════════╗
║ ⏳●  Creating Deal #1...                                    ║
║                                                            ║
║ Preparing upload                                           ║
╚════════════════════════════════════════════════════════════╝

Step 3:
╔════════════════════════════════════════════════════════════╗
║ ⏳●  Uploading to Irys/Arweave...                           ║
║                                                            ║
║ This may take a minute                                     ║
╚════════════════════════════════════════════════════════════╝

Step 4:
╔════════════════════════════════════════════════════════════╗
║ ⏳●  Upload complete!                                       ║
║                                                            ║
║ Creating deal on-chain...                                  ║
╚════════════════════════════════════════════════════════════╝

Step 5:
╔════════════════════════════════════════════════════════════╗
║ ⏳●  Confirming transaction...                              ║
║                                                            ║
║ 4abc...xyz9                                                ║
╚════════════════════════════════════════════════════════════╝

Step 6 (Final):
╔════════════════════════════════════════════════════════════╗
║ ✅  Deal #1 Created Successfully!                        × ║
║                                                            ║
║ Transaction: 4abc...xyz9                                   ║
║                                                            ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝
```

### Example 3: NFT Minting
```
Step 1:
╔════════════════════════════════════════════════════════════╗
║ ⏳●  Minting NFT: 10% Off Pizza                            ║
║                                                            ║
║ Creating NFT on-chain...                                   ║
╚════════════════════════════════════════════════════════════╝

Step 2:
╔════════════════════════════════════════════════════════════╗
║ ⏳●  Verifying and counting...                              ║
║                                                            ║
║ Updating deal counter                                      ║
╚════════════════════════════════════════════════════════════╝

Step 3:
╔════════════════════════════════════════════════════════════╗
║ ⏳●  Confirming transaction...                              ║
║                                                            ║
║ 5def...ghi2                                                ║
╚════════════════════════════════════════════════════════════╝

Step 4 (Final):
╔════════════════════════════════════════════════════════════╗
║ ✅  NFT Minted Successfully!                             × ║
║                                                            ║
║ Mint: 5def...ghi2                                          ║
║                                                            ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝
```

---

## 📱 Multiple Toasts (Stacked)

```
Top (newest):
╔════════════════════════════════════════════════════════════╗
║ ✅  NFT Minted Successfully!                             × ║
║ Mint: 5def...ghi2                                          ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝

Middle:
╔════════════════════════════════════════════════════════════╗
║ ✅  Deal #2 Created Successfully!                        × ║
║ Transaction: 4abc...xyz9                                   ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝

Bottom (oldest):
╔════════════════════════════════════════════════════════════╗
║ ✅  Merchant Registered Successfully!                    × ║
║ Transaction: 3shL...LAC3                                   ║
║ View on Solana Explorer →                                 ║
╚════════════════════════════════════════════════════════════╝

Each toast:
- Stacks vertically
- Slides in from right
- Auto-dismisses after 10 seconds
- Can be manually closed with ×
```

---

## 🎨 Color Coding

### Success (Green)
```
Border: #064e3b (dark green)
Background: rgba(6, 78, 59, 0.9) (semi-transparent green)
Text: #86efac (light green)
```

### Error (Red)
```
Border: #450a0a (dark red)
Background: rgba(69, 10, 10, 0.9) (semi-transparent red)
Text: #fca5a5 (light red)
```

### Loading (Blue)
```
Border: #172554 (dark blue)
Background: rgba(23, 37, 84, 0.9) (semi-transparent blue)
Text: #93c5fd (light blue)
Indicator: ● (pulsing dot)
```

### Info (Gray)
```
Border: #171717 (dark gray)
Background: rgba(23, 23, 23, 0.9) (semi-transparent gray)
Text: #d4d4d4 (light gray)
```

---

## 🎯 User Interactions

### Clicking Explorer Link:
```
User Action: Clicks "View on Solana Explorer →"
Result: Opens new tab with:
  https://explorer.solana.com/tx/[signature]?cluster=devnet

What User Sees on Explorer:
- Transaction status (Success/Failed)
- Block number
- Timestamp
- Fee
- All instructions
- All accounts
- Logs
- Full details for verification ✅
```

### Clicking Close Button (×):
```
User Action: Clicks ×
Result: Toast immediately fades out and slides right
Duration: 300ms exit animation
```

### Hovering Over Link:
```
User Action: Hovers over "View on Solana Explorer →"
Result: 
- Opacity increases from 90% to 100%
- Underline remains visible
- Cursor changes to pointer
```

---

## 📏 Responsive Design

### Desktop (Wide Screen):
```
Position: Fixed top-right
Width: 320px - 400px (min-max)
Gap between toasts: 8px
Margin from edge: 16px
```

### Mobile (Narrow Screen):
```
Position: Fixed top-right
Width: 100% - 32px (responsive)
Gap between toasts: 8px
Margin from edge: 16px
Text wraps for long messages
```

---

## ⏱️ Timing

### Auto-dismiss:
- Success toasts: 10 seconds
- Error toasts: 10 seconds
- Info toasts: 10 seconds
- Loading toasts: Until completion/error

### Animation:
- Slide-in: 300ms
- Slide-out: 300ms
- Fade: 300ms

---

## 🔍 Real-World Scenarios

### Scenario 1: First-Time User
```
1. Connects wallet
2. Tries to create deal
   ❌ "Unauthorized - you don't have permission (Error code: 0x4)"
3. Realizes need to register
4. Registers as merchant
   ✅ "Merchant Registered Successfully! View on Solana Explorer →"
5. Creates deal successfully
   ✅ "Deal #1 Created Successfully! View on Solana Explorer →"
```

### Scenario 2: Power User
```
1. Creates 3 deals in a row
   ✅ "Deal #1 Created..." (with link)
   ✅ "Deal #2 Created..." (with link)
   ✅ "Deal #3 Created..." (with link)
2. All 3 toasts visible, stacked
3. Clicks each link to verify on-chain
4. All verified ✅
```

### Scenario 3: Error Recovery
```
1. Tries to mint NFT
2. Gets error:
   ❌ "Deal sold out - no more NFTs available (Error code: 0x5)"
3. Sees error code 0x5
4. Looks up code in documentation
5. Understands issue: mint limit reached
6. Tries different deal ✅
```

---

**Pro Tip:** Keep the toast notifications open to show users during demos! They look professional and build trust. 🎉

