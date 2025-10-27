# Reviews & Ratings Feature 💬⭐

## Overview
A beautiful, on-chain review system that allows users to rate and comment on deals. Reviews are stored permanently on Solana blockchain as PDAs.

## Features

### ⭐ Star Rating System
- **5-star rating scale** with interactive star buttons
- Users select 1-5 stars when writing a review
- Visual feedback with amber-colored stars
- Hover animations for better UX

### 💬 Comments
- **280 character limit** (Twitter-style)
- Character counter for user guidance
- Rich text area with focus states
- Placeholder text for guidance

### 📊 Average Rating Display
- **Aggregate rating** calculated from all reviews
- Large prominent display with average score
- Visual star representation
- Count of total reviews
- Shown in a dedicated card when reviews exist

### 🔒 One Review Per User
- **Contract enforces** one review per user per deal
- PDA derivation: `[b"review", deal_pda, user_pubkey]`
- Frontend checks and shows existing review
- Blue highlight for user's own review

### 🎨 Beautiful UI Design

#### Review Form (When Not Reviewed)
- **Green-themed card** with soft background
- Interactive star selector with hover effects
- Textarea with border focus animation
- Submit button with disabled states
- Real-time character count

#### User's Review Display
- **Blue-themed card** highlighting own review
- "You have already reviewed" message
- Stars and comment displayed
- Timestamp of review submission

#### Reviews List
- **Card-based layout** with proper spacing
- Gradient avatar circles with user initials
- Shortened wallet addresses (4 chars...4 chars)
- Timestamp with full formatting
- Stars displayed for each review
- User's review highlighted in blue
- Others in neutral dark theme

### 📱 Responsive States

#### Loading State
- Animated hourglass emoji
- "Loading reviews..." message
- Centered display

#### Empty State
- Empty mailbox emoji (📭)
- "No reviews yet" message
- Encouragement to be first reviewer

#### Error Handling
- Toast notifications for all errors
- Contract error parsing with human-friendly messages
- Validation for comment length
- Validation for empty comments

### 🔗 On-Chain Integration

#### Smart Contract
- **Review PDA**: Unique per deal and user
- **Fields**: user, deal, rating (u8, 1-5), comment (string, max 280), created_at (i64)
- **Validation**: Rating must be 1-5, comment ≤ 280 chars
- **Error**: `AlreadyInitialized` if user tries to review twice

#### Frontend Functions
- `fetchReviewsForDeal()`: Fetches all reviews for a specific deal
- `ixAddReview()`: Creates AddReview instruction
- `deriveReviewPda()`: Derives unique review PDA
- Automatic filtering by deal PDA
- Sorted by timestamp (newest first)

### 🎯 User Experience Flow

1. **User visits deal page** → Reviews load automatically
2. **If not connected** → No review form shown
3. **If connected & not reviewed** → Green review form appears
4. **User selects stars** → Visual feedback
5. **User types comment** → Character counter updates
6. **Submit button** → Disabled if comment empty
7. **Transaction sent** → Toast with progress
8. **Success** → Review appears, form disappears
9. **User's review** → Highlighted in blue
10. **Average rating** → Updates automatically

### 🔔 Toast Notifications

- **Submitting**: "Submitting Review" with loading state
- **Confirming**: Shows transaction signature
- **Success**: "Review Submitted!" with Explorer link
- **Error**: Parsed contract error with code
- **Validation**: Immediate feedback for invalid input

### 🎨 Color Scheme

- **Stars**: Amber (#fbbf24) for filled, dark neutral for empty
- **Review Form**: Green theme (#166534 background, #16a34a border)
- **User's Review**: Blue theme (#1e3a8a background, #1d4ed8 border)
- **Other Reviews**: Dark neutral (#171717 background, #262626 border)
- **Section**: Amber border (#78350f) with light amber background

### 📐 Layout

- **Full-width section** at bottom of deal page
- **Responsive grid** for reviews (stacked on mobile)
- **Proper spacing** between all elements
- **Clear visual hierarchy** with sizing and colors
- **Avatar circles** add personality to reviews

### ✨ Interactive Elements

- **Star buttons**: Scale on hover (1.1x)
- **Submit button**: Color change on hover
- **Textarea**: Border color change on focus
- **Review cards**: Subtle border styling
- **Timestamps**: Full date/time formatting

### 🚀 Performance

- **Efficient filtering**: Client-side filtering by deal PDA
- **Single RPC call**: Uses `getProgramAccounts` once
- **Smart sorting**: Newest reviews first
- **Memoized program ID**: Prevents unnecessary re-renders
- **Conditional loading**: Only fetches when deal is loaded

## Code Files Modified

1. **`frontend/src/lib/solana/instructions.ts`**
   - Added `Review` schema
   - Added `ReviewAccount` type
   - Added `ixAddReview()` function
   - Added `fetchReview()` function
   - Added `fetchReviewsForDeal()` function
   - Added `deriveReviewPda()` function

2. **`frontend/src/app/deals/[id]/page.tsx`**
   - Added review state management
   - Added `useEffect` to fetch reviews
   - Added `onSubmitReview` callback
   - Added complete reviews UI section
   - Added star rating selector
   - Added comment textarea
   - Added reviews list display

## Usage Example

### For Users
1. Navigate to any deal page
2. Scroll to the "Reviews & Ratings" section
3. Click stars to select rating (1-5)
4. Type a comment (max 280 characters)
5. Click "Submit Review"
6. Approve transaction in wallet
7. Review appears immediately after confirmation

### For Developers
```typescript
// Fetch reviews for a deal
const reviews = await fetchReviewsForDeal(connection, programId, dealPda);

// Submit a review
const reviewPda = deriveReviewPda(programId, dealPda, userPubkey);
const ix = ixAddReview(programId, userPubkey, merchantPda, dealPda, reviewPda, dealId, rating, comment);
```

## Technical Details

- **PDA Seeds**: `["review", deal_pda_bytes, user_pubkey_bytes]`
- **Account Space**: 32 + 32 + 1 + 4 + 280 + 8 = 357 bytes
- **Rating Range**: 1-5 (enforced by contract)
- **Comment Limit**: 280 characters (enforced by contract and frontend)
- **Timestamp**: Unix timestamp (seconds since epoch)
- **Sorting**: Descending by `created_at` (newest first)

## Future Enhancements (Not Implemented)

- Edit review functionality
- Delete review functionality
- Reply to reviews
- Report inappropriate reviews
- Filter reviews by rating
- Pagination for many reviews
- Review reactions (helpful/not helpful)

---

**Status**: ✅ Fully Implemented and Working
**Last Updated**: October 27, 2025

