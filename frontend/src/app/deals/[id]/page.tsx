"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveDealPda, deriveMerchantPda, deriveReviewPda, fetchAllDeals, fetchReviewsForDeal, ixVerifyAndCountMint, ixAddReview, type DealAccount, type ReviewAccount } from '@/lib/solana/instructions';
import { useUmi } from '@/lib/umi/client';
import { generateSigner, percentAmount } from '@metaplex-foundation/umi';
import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import { useToast } from '@/lib/toast/ToastContext';
import { parseContractError, getShortTxSignature, getExplorerUrl } from '@/lib/solana/errors';
import Link from 'next/link';
import { Loader, Skeleton } from '@/components/Loader';

export default function DealDetailPage() {
	const params = useParams();
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const umi = useUmi();
	const { showToast, updateToast } = useToast();

	const [deal, setDeal] = useState<{ pubkey: string; account: DealAccount } | null>(null);
	const [loading, setLoading] = useState(true);
	const [minting, setMinting] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	
	// Reviews state
	const [reviews, setReviews] = useState<Array<{ pubkey: PublicKey; account: ReviewAccount }>>([]);
	const [loadingReviews, setLoadingReviews] = useState(false);
	const [submittingReview, setSubmittingReview] = useState(false);
	const [newRating, setNewRating] = useState(5);
	const [newComment, setNewComment] = useState('');
	const [userReview, setUserReview] = useState<{ pubkey: PublicKey; account: ReviewAccount } | null>(null);

	// Use refs to prevent duplicate transaction execution (atomic check)
	const isMintingRef = useRef(false);
	const isSubmittingReviewRef = useRef(false);

	// Countdown timer state (must be before conditional returns)
	const [timeRemaining, setTimeRemaining] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

	const dealPubkeyStr = params.id as string; // This is now the PDA address, not deal_id

	// Memoize programId to prevent recreating on every render
	const programId = useMemo(() => {
		return new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '');
	}, []);

	// Calculate expiry for countdown (must be before conditional returns)
	const expiry = deal ? (typeof deal.account.expiry === 'bigint' ? Number(deal.account.expiry) : Number(deal.account.expiry)) : 0;
	const expiryDate = deal ? new Date(expiry * 1000) : new Date();
	const isExpired = deal ? expiryDate < new Date() : false;

	// Fetch deal data - only depends on dealPubkeyStr which is stable from URL params
	useEffect(() => {
		let mounted = true;
		(async () => {
			if (!dealPubkeyStr) return;
			try {
				setLoading(true);
				const allDeals = await fetchAllDeals(connection, programId);
				// Find deal by PDA address (unique identifier)
				const foundDeal = allDeals.find(d => d.pubkey.toBase58() === dealPubkeyStr);
				if (mounted) {
					if (foundDeal) {
						setDeal({ pubkey: foundDeal.pubkey.toBase58(), account: foundDeal.account });
					} else {
						setErrorMsg('Deal not found');
					}
					setLoading(false);
				}
			} catch (e: any) {
				console.error('fetch deal error', e);
				if (mounted) {
					setErrorMsg('Failed to load deal');
					setLoading(false);
				}
			}
		})();
		return () => { mounted = false };
	}, [dealPubkeyStr]); // Only re-fetch if the deal ID in URL changes

	// Fetch reviews for this deal
	useEffect(() => {
		let mounted = true;
		(async () => {
			if (!deal) return;
			try {
				setLoadingReviews(true);
				const dealPda = new PublicKey(deal.pubkey);
				const fetchedReviews = await fetchReviewsForDeal(connection, programId, dealPda);
				if (mounted) {
					setReviews(fetchedReviews);
					// Check if current user has already reviewed
					if (publicKey) {
						const userRev = fetchedReviews.find(r => 
							Buffer.from(r.account.user).equals(publicKey.toBuffer())
						);
						setUserReview(userRev || null);
					}
					setLoadingReviews(false);
				}
			} catch (e: any) {
				console.error('fetch reviews error', e);
				if (mounted) setLoadingReviews(false);
			}
		})();
		return () => { mounted = false };
	}, [deal, publicKey, connection, programId]);

	// Countdown timer effect (MUST be after all other useEffects, but before conditional returns)
	useEffect(() => {
		if (!deal || isExpired || expiry === 0) {
			setTimeRemaining(null);
			return;
		}

		const updateCountdown = () => {
			const now = Math.floor(Date.now() / 1000);
			const remaining = expiry - now;

			if (remaining <= 0) {
				setTimeRemaining(null);
				return;
			}

			const days = Math.floor(remaining / 86400);
			const hours = Math.floor((remaining % 86400) / 3600);
			const minutes = Math.floor((remaining % 3600) / 60);
			const seconds = remaining % 60;

			setTimeRemaining({ days, hours, minutes, seconds });
		};

		updateCountdown();
		const interval = setInterval(updateCountdown, 1000);

		return () => clearInterval(interval);
	}, [expiry, isExpired, deal]);

	const onSubmitReview = useCallback(async () => {
		if (!publicKey || !signTransaction || !deal) {
			showToast('error', 'Cannot Submit Review', 'Please connect your wallet');
			return;
		}

		if (!newComment.trim()) {
			showToast('error', 'Comment Required', 'Please write a comment');
			return;
		}

		if (newComment.length > 280) {
			showToast('error', 'Comment Too Long', 'Maximum 280 characters');
			return;
		}

		// Atomic check: prevent duplicate submissions using ref (doesn't depend on re-render)
		if (isSubmittingReviewRef.current) return;
		isSubmittingReviewRef.current = true;
		setSubmittingReview(true);
		let toastId: string | null = null;

		try {
			const dealId = BigInt(deal.account.deal_id as any);
			const merchantPubkey = new PublicKey(deal.account.merchant);
			const merchantPda = deriveMerchantPda(programId, merchantPubkey);
			const dealPda = new PublicKey(deal.pubkey);
			const reviewPda = deriveReviewPda(programId, dealPda, publicKey);

			toastId = showToast('loading', 'Submitting Review', 'Creating review on-chain...');

			const ix = ixAddReview(programId, publicKey, merchantPda, dealPda, reviewPda, dealId, newRating, newComment);
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			updateToast(toastId, { title: 'Confirming transaction...', message: getShortTxSignature(sig) });
			await connection.confirmTransaction(sig, 'confirmed');

			// Refresh reviews
			const fetchedReviews = await fetchReviewsForDeal(connection, programId, dealPda);
			setReviews(fetchedReviews);
			const userRev = fetchedReviews.find(r => 
				Buffer.from(r.account.user).equals(publicKey.toBuffer())
			);
			setUserReview(userRev || null);

			// Reset form
			setNewComment('');
			setNewRating(5);

			updateToast(toastId, {
				type: 'success',
				title: 'Review Submitted!',
				message: 'Your review has been added',
				txLink: getExplorerUrl(sig),
				duration: 10000
			});
		} catch (e: any) {
			console.error('submit review error', e);
			const errorMsg = parseContractError(e);
			if (toastId) {
				updateToast(toastId, { type: 'error', title: 'Review Submission Failed', message: errorMsg, duration: 10000 });
			} else {
				showToast('error', 'Review Submission Failed', errorMsg);
			}
		} finally {
			setSubmittingReview(false);
			isSubmittingReviewRef.current = false;
		}
	}, [publicKey, signTransaction, deal, newRating, newComment, connection, programId, showToast, updateToast]);

	const onMint = useCallback(async () => {
		if (!publicKey || !signTransaction || !deal) {
			showToast('error', 'Cannot Mint', 'Please connect your wallet');
			return;
		}

		// Check if deal is sold out
		const minted = deal.account.minted as number;
		const totalSupply = deal.account.total_supply as number;
		if (minted >= totalSupply) {
			showToast('error', 'Deal Sold Out', `All ${totalSupply} NFTs have been minted`);
			return;
		}

		// Atomic check: prevent duplicate submissions using ref (doesn't depend on re-render)
		if (isMintingRef.current) return;
		isMintingRef.current = true;
		setMinting(true);
		let toastId: string | null = null;

		try {
			const dealId = BigInt(deal.account.deal_id as any);
			const title = deal.account.title;
			const metadataUri = deal.account.metadata_uri;

			if (!metadataUri) {
				throw new Error('Deal metadata URI not found');
			}

			toastId = showToast('loading', `Minting NFT: ${title}`, 'Creating NFT on-chain...');

			// Mint NFT using stored metadata
			const mint = generateSigner(umi);
			await createNft(umi, {
				mint,
				name: title,
				symbol: 'DEAL',
				uri: metadataUri,
				sellerFeeBasisPoints: percentAmount(0),
				isMutable: true,
			}).sendAndConfirm(umi);

			const mintPubkey = new PublicKey(mint.publicKey.toString());

			// Verify and increment counter
			updateToast(toastId, { title: 'Verifying and counting...', message: 'Updating deal counter' });
			const merchantPubkey = new PublicKey(deal.account.merchant);
			const merchantPda = deriveMerchantPda(programId, merchantPubkey);
			const dealPda = new PublicKey(deal.pubkey); // Use the actual PDA address
			const ix = ixVerifyAndCountMint(programId, publicKey, merchantPda, dealPda, dealId, mintPubkey);
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			updateToast(toastId, { title: 'Confirming transaction...', message: getShortTxSignature(sig) });
			await connection.confirmTransaction(sig, 'confirmed');

			setErrorMsg(null);

			// Refresh deal data
			const allDeals = await fetchAllDeals(connection, programId);
			const updatedDeal = allDeals.find(d => d.pubkey.toBase58() === dealPubkeyStr);
			if (updatedDeal) {
				setDeal({ pubkey: updatedDeal.pubkey.toBase58(), account: updatedDeal.account });
			}

			updateToast(toastId, {
				type: 'success',
				title: 'NFT Minted Successfully!',
				message: `Mint: ${getShortTxSignature(mintPubkey.toBase58())}`,
				txLink: getExplorerUrl(sig),
				duration: 10000
			});
		} catch (e: any) {
			console.error('mint error', e);
			const errorMsg = parseContractError(e);
			setErrorMsg(errorMsg);
			if (toastId) {
				updateToast(toastId, { type: 'error', title: 'Minting Failed', message: errorMsg, duration: 10000 });
			} else {
				showToast('error', 'Minting Failed', errorMsg);
			}
		} finally {
			setMinting(false);
			isMintingRef.current = false;
		}
	}, [publicKey, signTransaction, deal, dealPubkeyStr, umi, connection, programId, showToast, updateToast]);

	if (loading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-8 w-32" />
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Image skeleton */}
					<div className="rounded-lg overflow-hidden">
						<Skeleton className="aspect-video w-full h-64" />
					</div>
					{/* Info skeleton */}
					<div className="space-y-4">
						<Skeleton className="h-10 w-3/4" />
						<Skeleton className="h-6 w-1/4" />
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-3/4" />
						<div className="pt-4">
							<Skeleton className="h-12 w-full" />
						</div>
					</div>
				</div>
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (errorMsg && !deal) {
		return (
			<div className="space-y-6">
				<Link href="/deals" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2">
					← Back to Deals
				</Link>
				<div className="rounded-lg border border-red-800 bg-red-950/30 p-8 text-center">
					<div className="text-4xl mb-4">❌</div>
					<div className="text-xl font-medium text-red-200 mb-2">Deal Not Found</div>
					<p className="text-red-300/70">{errorMsg}</p>
				</div>
			</div>
		);
	}

	if (!deal) return null;

	const minted = deal.account.minted as number;
	const totalSupply = deal.account.total_supply as number;
	const isSoldOut = minted >= totalSupply;
	const percentageMinted = (minted / totalSupply) * 100;

	return (
		<div className="space-y-6">
			{/* Back Button */}
			<Link href="/deals" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors">
				← Back to All Deals
			</Link>

			{errorMsg && (
				<div className="rounded border border-yellow-800 bg-yellow-950/50 text-yellow-200 px-4 py-3">
					{errorMsg}
				</div>
			)}

			{/* Main Content Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Left: Image */}
				<div className="space-y-4">
					<div className="aspect-video w-full rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
						{deal.account.image_uri ? (
							<img
								src={deal.account.image_uri}
								alt={deal.account.title}
								className="w-full h-full object-cover"
								onError={(e) => {
									e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="450"%3E%3Crect fill="%23171717" width="800" height="450"/%3E%3Ctext fill="%23525252" font-family="system-ui" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EImage not available%3C/text%3E%3C/svg%3E';
								}}
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center text-neutral-500">
								No image available
							</div>
						)}
					</div>

					{/* Deal Stats Cards */}
					<div className="grid grid-cols-2 gap-4">
						<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
							<div className="text-xs text-neutral-500 mb-1">Deal ID</div>
							<div className="text-2xl font-bold font-mono">#{String(deal.account.deal_id)}</div>
						</div>
						<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
							<div className="text-xs text-neutral-500 mb-1">Discount</div>
							<div className="text-2xl font-bold text-green-400">{deal.account.discount_percent}% OFF</div>
						</div>
					</div>

					{/* Expiry Info with Countdown */}
					<div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 space-y-3">
						<div className="text-sm font-medium mb-2">Valid Until</div>
						<div className="flex items-center gap-2">
							<span className="text-lg">
								{isExpired ? '⏰' : '📅'}
							</span>
							<div>
								<div className={isExpired ? 'text-red-400' : 'text-neutral-200'}>
									{expiryDate.toLocaleDateString('en-US', { 
										year: 'numeric', 
										month: 'long', 
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</div>
								{isExpired && (
									<div className="text-xs text-red-400 mt-1">This deal has expired</div>
								)}
							</div>
						</div>

						{/* Countdown Timer */}
						{!isExpired && timeRemaining && (
							<div className="pt-3 border-t border-neutral-800">
								<div className="text-xs text-neutral-500 mb-2">Time Remaining</div>
								<div className="flex items-center gap-3">
									{timeRemaining.days > 0 && (
										<div className="text-center">
											<div className="text-2xl font-bold text-orange-400">{timeRemaining.days}</div>
											<div className="text-xs text-neutral-500">days</div>
										</div>
									)}
									<div className="text-center">
										<div className="text-2xl font-bold text-orange-400">{timeRemaining.hours}</div>
										<div className="text-xs text-neutral-500">hours</div>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-orange-400">{timeRemaining.minutes}</div>
										<div className="text-xs text-neutral-500">minutes</div>
									</div>
									<div className="text-center">
										<div className="text-xl font-bold text-orange-300">{timeRemaining.seconds}</div>
										<div className="text-xs text-neutral-500">seconds</div>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Metadata Links */}
					{(deal.account.image_uri || deal.account.metadata_uri) && (
						<div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/30">
							<div className="text-sm font-medium mb-3">🔗 Links</div>
							<div className="flex flex-wrap gap-3">
								{deal.account.image_uri && (
									<a
										href={deal.account.image_uri}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm text-blue-400 hover:text-blue-300 underline"
									>
										View Image on Arweave →
									</a>
								)}
								{deal.account.metadata_uri && (
									<a
										href={deal.account.metadata_uri}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm text-blue-400 hover:text-blue-300 underline"
									>
										View Metadata on Arweave →
									</a>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Right: Details */}
				<div className="space-y-6">
					{/* Title and Discount Badge */}
					<div>
						<div className="flex items-start justify-between gap-4 mb-3">
							<h1 className="text-4xl font-bold">{deal.account.title}</h1>
							<div className="px-4 py-2 rounded-lg bg-green-900/50 border border-green-700">
								<div className="text-3xl font-bold text-green-200">{deal.account.discount_percent}%</div>
								<div className="text-xs text-green-300/70">OFF</div>
							</div>
						</div>
						<p className="text-lg text-neutral-300">{deal.account.description}</p>
					</div>

					{/* Availability Status */}
					<div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4">
						<div className="flex items-center justify-between mb-2">
							<div className="text-sm font-medium">Availability</div>
							<div className="text-sm font-mono">
								<span className={minted >= totalSupply ? 'text-red-400' : 'text-green-400'}>
									{minted}
								</span>
								<span className="text-neutral-500"> / {totalSupply}</span>
								<span className="text-neutral-500 ml-2">minted</span>
							</div>
						</div>
						
						{/* Progress Bar */}
						<div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden">
							<div
								className={`h-full transition-all duration-500 ${
									isSoldOut ? 'bg-red-500' : percentageMinted > 75 ? 'bg-yellow-500' : 'bg-green-500'
								}`}
								style={{ width: `${Math.min(percentageMinted, 100)}%` }}
							/>
						</div>
						<div className="text-xs text-neutral-500 mt-1">
							{isSoldOut ? 'Sold Out' : `${(100 - percentageMinted).toFixed(1)}% remaining`}
						</div>
					</div>

					{/* Mint Button */}
					<div className="rounded-lg border border-purple-800/50 bg-purple-950/30 p-6">
						<div className="text-lg font-medium text-purple-200 mb-3">
							{isSoldOut ? '🔒 Sold Out' : isExpired ? '⏰ Expired' : '🎁 Mint NFT Coupon'}
						</div>
						<p className="text-sm text-neutral-400 mb-4">
							{isSoldOut 
								? 'All NFT coupons have been minted for this deal.' 
								: isExpired
								? 'This deal has expired and is no longer available.'
								: 'Mint this NFT to your wallet. You can trade it or redeem it later for your discount!'}
						</p>
						<button
							onClick={onMint}
							disabled={minting || isSoldOut || isExpired || !publicKey}
							className="w-full px-6 py-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{!publicKey 
								? '👆 Connect Wallet to Mint'
								: minting 
								? '⏳ Minting...' 
								: isSoldOut 
								? '🔒 Sold Out'
								: isExpired
								? '⏰ Expired'
								: '🎁 Mint NFT Coupon'}
						</button>
						{!publicKey && (
							<div className="text-xs text-center text-neutral-500 mt-2">
								Connect your wallet using the button in the top-right corner
							</div>
						)}
					</div>

					{/* Additional Info */}
					<div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/30">
						<div className="text-sm font-medium mb-3">📋 Deal Information</div>
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-neutral-500">NFT Standard</span>
								<span className="text-neutral-200">Metaplex Token Metadata</span>
							</div>
							<div className="flex justify-between">
								<span className="text-neutral-500">Blockchain</span>
								<span className="text-neutral-200">Solana</span>
							</div>
							<div className="flex justify-between">
								<span className="text-neutral-500">Transferable</span>
								<span className="text-green-400">✓ Yes</span>
							</div>
							<div className="flex justify-between">
								<span className="text-neutral-500">Redeemable</span>
								<span className="text-green-400">✓ Yes (burns NFT)</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Reviews Section */}
			<div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-6">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-2xl font-bold flex items-center gap-2">
						💬 Reviews & Ratings
					</h2>
					<div className="text-sm text-neutral-400">
						{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
					</div>
				</div>

				{/* Average Rating Display */}
				{reviews.length > 0 && (
					<div className="mb-6 p-4 rounded-lg bg-neutral-900/50 border border-neutral-800">
						<div className="flex items-center gap-4">
							<div className="text-center">
								<div className="text-4xl font-bold text-amber-400">
									{(reviews.reduce((sum, r) => sum + r.account.rating, 0) / reviews.length).toFixed(1)}
								</div>
								<div className="text-xs text-neutral-500 mt-1">Average Rating</div>
							</div>
							<div className="flex-1">
								<div className="flex items-center gap-1 mb-1">
									{[1, 2, 3, 4, 5].map(star => (
										<span key={star} className={`text-2xl ${
											star <= Math.round(reviews.reduce((sum, r) => sum + r.account.rating, 0) / reviews.length)
												? 'text-amber-400'
												: 'text-neutral-700'
										}`}>
											★
										</span>
									))}
								</div>
								<div className="text-sm text-neutral-400">
									Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Add Review Form */}
				{publicKey && !userReview && (
					<div className="mb-6 p-4 rounded-lg border border-green-800/50 bg-green-950/20">
						<div className="text-lg font-medium text-green-200 mb-3">✍️ Write a Review</div>
						<div className="space-y-4">
							{/* Star Rating Selector */}
							<div>
								<label className="text-sm text-neutral-400 block mb-2">Your Rating</label>
								<div className="flex items-center gap-2">
									{[1, 2, 3, 4, 5].map(star => (
										<button
											key={star}
											type="button"
											onClick={() => setNewRating(star)}
											className="text-4xl hover:scale-110 transition-transform"
										>
											<span className={star <= newRating ? 'text-amber-400' : 'text-neutral-700'}>
												★
											</span>
										</button>
									))}
									<span className="ml-2 text-sm text-neutral-400">
										{newRating} {newRating === 1 ? 'star' : 'stars'}
									</span>
								</div>
							</div>

							{/* Comment Input */}
							<div>
								<label className="text-sm text-neutral-400 block mb-2">
									Your Comment ({newComment.length}/280)
								</label>
								<textarea
									value={newComment}
									onChange={(e) => setNewComment(e.target.value)}
									placeholder="Share your thoughts about this deal..."
									className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 focus:border-green-600 focus:outline-none resize-none"
									rows={4}
									maxLength={280}
								/>
							</div>

							{/* Submit Button */}
							<button
								onClick={onSubmitReview}
								disabled={submittingReview || !newComment.trim()}
								className="w-full px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								{submittingReview ? '⏳ Submitting...' : '📝 Submit Review'}
							</button>
						</div>
					</div>
				)}

				{/* User's existing review - Just show a message */}
				{userReview && (
					<div className="mb-6 p-3 rounded-lg border border-blue-800/50 bg-blue-950/20 text-center">
						<div className="text-sm text-blue-300">✅ You have already reviewed this deal</div>
					</div>
				)}

				{/* Reviews List */}
				{loadingReviews ? (
					<div className="text-center py-8 text-neutral-400">
						<div className="text-2xl mb-2 animate-pulse">⏳</div>
						Loading reviews...
					</div>
				) : reviews.length === 0 ? (
					<div className="text-center py-8 text-neutral-400">
						<div className="text-4xl mb-2">📭</div>
						<div>No reviews yet. Be the first to review this deal!</div>
					</div>
				) : (
					<div className="space-y-4">
						{reviews.map((review) => {
							const reviewerAddress = new PublicKey(review.account.user).toBase58();
							const isCurrentUser = publicKey && Buffer.from(review.account.user).equals(publicKey.toBuffer());
							
							return (
								<div 
									key={review.pubkey.toBase58()} 
									className={`p-4 rounded-lg border ${
										isCurrentUser 
											? 'border-blue-700 bg-blue-950/30' 
											: 'border-neutral-800 bg-neutral-900/30'
									}`}
								>
									<div className="flex items-start justify-between mb-2">
										<div className="flex items-center gap-2">
											<div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">
												{reviewerAddress.slice(0, 2).toUpperCase()}
											</div>
											<div>
												<div className="text-sm font-medium text-neutral-200">
													{reviewerAddress.slice(0, 4)}...{reviewerAddress.slice(-4)}
													{isCurrentUser && <span className="ml-2 text-xs text-blue-400">(You)</span>}
												</div>
												<div className="text-xs text-neutral-500">
													{new Date(Number(review.account.created_at) * 1000).toLocaleDateString('en-US', {
														year: 'numeric',
														month: 'short',
														day: 'numeric',
														hour: '2-digit',
														minute: '2-digit'
													})}
												</div>
											</div>
										</div>
										<div className="flex items-center gap-1">
											{[1, 2, 3, 4, 5].map(star => (
												<span key={star} className={`text-lg ${
													star <= review.account.rating ? 'text-amber-400' : 'text-neutral-700'
												}`}>
													★
												</span>
											))}
										</div>
									</div>
									<p className="text-neutral-300 leading-relaxed">{review.account.comment}</p>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

