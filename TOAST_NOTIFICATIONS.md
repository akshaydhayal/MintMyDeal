# Toast Notification System Documentation

## Overview

A comprehensive toast notification system has been integrated across the entire DApp, providing real-time feedback for all transactions, uploads, and errors.

## Features

### ✅ Toast Types

1. **Success** (Green)
   - Deal creation complete
   - NFT minting successful
   - Merchant registration
   - Collection creation
   - Redemption complete

2. **Error** (Red)
   - Transaction failures
   - Upload errors
   - Contract errors (human-friendly)
   - Validation errors

3. **Loading** (Blue)
   - Transaction in progress
   - Upload in progress
   - Real-time status updates

4. **Info** (Gray)
   - General information

### ⏱️ Duration

- **Default**: 10 seconds for success/error messages
- **Loading**: Stays until completion or error
- **Auto-dismiss**: Toasts automatically fade out after duration
- **Manual close**: Click × button to dismiss early

### 📍 Position

- **Fixed** at top-right of screen
- **Stacked** vertically
- **Slide animation** from right
- **Backdrop blur** for visibility

## Integration Points

### 1. Merchant Registration
**File**: `frontend/src/app/merchant/page.tsx`

**Toast Flow**:
```
Loading → "Registering merchant..."
         ↓
Loading → "Confirming transaction..." (with tx signature)
         ↓
Success → "Merchant Registered Successfully!" (10s)
```

**Error Handling**:
- Parses contract errors
- Shows human-friendly messages
- Displays error code context

---

### 2. Deal Creation
**File**: `frontend/src/app/merchant/page.tsx`

**Toast Flow**:
```
Loading → "Checking merchant registration..."
         ↓
Loading → "Creating Deal #N..." (auto-calculated ID)
         ↓
Loading → "Uploading to Irys/Arweave..." (with progress note)
         ↓
Loading → "Upload complete!" (shows URIs)
         ↓
Loading → "Confirming transaction..." (with tx signature)
         ↓
Success → "Deal #N Created Successfully!" (10s)
```

**Error Handling**:
- Upload failures with specific error
- Transaction errors with contract code
- Merchant not registered error

---

### 3. Collection Creation
**File**: `frontend/src/app/merchant/page.tsx`

**Toast Flow**:
```
Loading → "Creating collection NFT..."
         ↓
Loading → "Uploading to Irys..." (metadata upload)
         ↓
Loading → "Minting collection NFT..." (on-chain creation)
         ↓
Loading → "Linking collection to merchant..." (finalizing)
         ↓
Success → "Collection Created Successfully!" (10s, with mint address)
```

**Error Handling**:
- Image upload errors
- Minting failures
- Link transaction errors

---

### 4. NFT Minting (User)
**File**: `frontend/src/app/deals/page.tsx`

**Toast Flow**:
```
Loading → "Minting NFT: [Deal Title]" (creating NFT)
         ↓
Loading → "Verifying and counting..." (updating counter)
         ↓
Loading → "Confirming transaction..." (with tx signature)
         ↓
Success → "NFT Minted Successfully!" (10s, with mint address)
```

**Error Handling**:
- Wallet not connected
- Deal sold out (mint limit)
- Transaction failures
- Verification errors

**Special Features**:
- Auto-refreshes deal list after mint
- Shows updated minted count
- Reuses pre-uploaded metadata (no upload delay)

---

### 5. NFT Redemption
**File**: `frontend/src/app/redeem/page.tsx`

**Toast Flow**:
```
Loading → "Redeeming NFT coupon..." (burning NFT)
         ↓
Loading → "Confirming transaction..." (with tx signature)
         ↓
Success → "NFT Redeemed Successfully!" (10s, with tx signature)
```

**Error Handling**:
- Wallet not connected
- Invalid mint address
- Already redeemed errors
- Burn transaction failures

---

## Contract Error Codes

The system automatically translates contract error codes to human-friendly messages:

| Code | Contract Error | User-Friendly Message |
|------|---------------|----------------------|
| 0x0  | InvalidInstruction | "Invalid instruction - please try again" |
| 0x1  | PdaDerivationMismatch | "Account address mismatch - incorrect PDA derivation" |
| 0x2  | AlreadyInitialized | "This account has already been initialized" |
| 0x3  | Overflow | "Math overflow occurred - value too large" |
| 0x4  | Unauthorized | "Unauthorized - you don't have permission for this action" |
| 0x5  | DealSoldOut | "Deal sold out - no more NFTs available to mint" |
| 0x6  | AlreadyRedeemed | "This coupon has already been redeemed" |
| 0x7  | InvalidInput | "Invalid input - please check your data" |

**Error Parser**: `frontend/src/lib/solana/errors.ts`

---

## Technical Implementation

### Component Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── Toast.tsx              # Toast UI component
│   ├── lib/
│   │   ├── toast/
│   │   │   └── ToastContext.tsx   # Toast context & hook
│   │   └── solana/
│   │       └── errors.ts          # Error parser & helpers
│   └── app/
│       └── layout.tsx             # ToastProvider wrapper
```

### Usage Example

```typescript
import { useToast } from '@/lib/toast/ToastContext';

const { showToast, updateToast } = useToast();

// Show loading toast
const toastId = showToast('loading', 'Processing...', 'Please wait');

// Update to show progress
updateToast(toastId, { title: 'Uploading...', message: 'Step 2 of 3' });

// Complete with success
updateToast(toastId, { 
  type: 'success', 
  title: 'Complete!', 
  message: 'Transaction confirmed',
  duration: 10000 
});

// Or show error
updateToast(toastId, { 
  type: 'error', 
  title: 'Failed', 
  message: parseContractError(error),
  duration: 10000 
});
```

### Helper Functions

**`parseContractError(error: any): string`**
- Extracts and translates contract error codes
- Handles common Solana errors (insufficient funds, blockhash, etc.)
- Provides user-friendly fallback messages

**`getShortTxSignature(sig: string): string`**
- Shortens transaction signatures for display
- Format: `abc12345...xyz67890`

---

## Visual Design

### Toast Card
```
┌──────────────────────────────────┐
│ 🎉  Title                      × │
│                                  │
│ Optional message with details    │
└──────────────────────────────────┘
```

### Colors & States
- **Success**: Green border & background (#064e3b)
- **Error**: Red border & background (#450a0a)
- **Loading**: Blue border & background (#172554)
- **Info**: Gray border & background (#171717)

### Animations
- **Enter**: Slide in from right (300ms)
- **Exit**: Fade out and slide right (300ms)
- **Loading**: Pulsing dot indicator

---

## User Experience Benefits

1. **Real-time Feedback**: Users always know what's happening
2. **Progress Tracking**: Multi-step operations show clear progress
3. **Error Clarity**: No more cryptic error codes
4. **Transaction Verification**: Shows tx signatures for blockchain verification
5. **Non-blocking**: Toasts don't interrupt user flow
6. **Auto-dismiss**: No manual cleanup required
7. **Persistent History**: Can see multiple toasts at once

---

## Future Enhancements

Possible improvements:
- Click toast to view full transaction details
- Copy transaction signature button
- Toast history panel
- Sound effects for success/error
- Browser notifications for background operations
- Retry button for failed transactions
- Export toast log for debugging

---

## Testing Checklist

- [x] Merchant registration success
- [x] Merchant registration error
- [x] Deal creation with upload progress
- [x] Deal creation errors
- [x] Collection creation multi-step
- [x] NFT minting success
- [x] NFT minting sold out error
- [x] Redemption success
- [x] Wallet not connected errors
- [x] Contract error code translation
- [x] Transaction signature display
- [x] Auto-dismiss timing
- [x] Manual dismiss functionality
- [x] Multiple toast stacking
- [x] Build compilation

---

## Deployment Notes

**Environment Variables Required**:
- `NEXT_PUBLIC_SOLANA_RPC` - RPC endpoint
- `NEXT_PUBLIC_PROGRAM_ID` - Contract program ID
- `IRYS_PRIVATE_KEY_BASE58` - Server-side Irys key

**No Additional Dependencies**: All toast functionality uses existing packages.

---

## Summary

The toast notification system provides comprehensive, user-friendly feedback for all DApp operations. Every transaction, upload, and error is communicated clearly with appropriate context, making the platform more accessible and professional.

**Total Integration Points**: 5 major flows (merchant registration, deal creation, collection creation, NFT minting, redemption)

**Error Coverage**: All contract errors + common Solana errors + validation errors

**Auto-dismiss**: 10 seconds for all success/error messages

**User-friendly**: Contract error codes translated to plain English

