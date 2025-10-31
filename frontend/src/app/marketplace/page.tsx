"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { fetchAllDeals, type DealAccount, ixBuyNft, fetchAllListings, type ListingAccount, deriveEscrowPda } from '@/lib/solana/instructions';
import { useToast } from '@/lib/toast/ToastContext';
import { parseContractError, getShortTxSignature, getExplorerUrl } from '@/lib/solana/errors';
import { DealCardSkeleton } from '@/components/Loader';

interface ListingWithMetadata {
	pubkey: PublicKey;
	listing: ListingAccount;
	nftMetadata?: {
		name: string;
		image?: string;
		uri: string;
	};
	dealInfo?: { pubkey: string; account: DealAccount };
}

export default function MarketplacePage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const { showToast, updateToast } = useToast();
	const programId = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || ''), []);
	
	const [listings, setListings] = useState<ListingWithMetadata[]>([]);
	const [loading, setLoading] = useState(true);
	const [buying, setBuying] = useState<string | null>(null);

	// Use ref to prevent duplicate transaction execution (atomic check)
	const isBuyingRef = useRef<string | null>(null);

	const fetchListings = useCallback(async () => {
		setLoading(true);
		try {
			const allListings = await fetchAllListings(connection, programId);
			const allDeals = await fetchAllDeals(connection, programId);
			
			const listingsWithMetadata: ListingWithMetadata[] = [];
			
			for (const { pubkey, account: listing } of allListings) {
				const nftMint = new PublicKey(listing.nft_mint);
				
				try {
					const metadataPDA = PublicKey.findProgramAddressSync(
						[
							Buffer.from('metadata'),
							new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
							nftMint.toBuffer(),
						],
						new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
					)[0];
					
					const metadataAccount = await connection.getAccountInfo(metadataPDA);
					
					let name = 'Unknown NFT';
					let uri = '';
					let image: string | undefined;
					let dealInfo: { pubkey: string; account: DealAccount } | undefined;
					
					if (metadataAccount) {
						try {
							// Parse metadata using proper offsets
							const metadataData = metadataAccount.data;
							// Skip first byte (key), then read name
							let offset = 1 + 32 + 32; // key + update_authority + mint
							const nameLength = metadataData.readUInt32LE(offset);
							offset += 4;
							name = metadataData.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '');
							offset += nameLength;
							
							const symbolLength = metadataData.readUInt32LE(offset);
							offset += 4;
							// symbol = metadataData.slice(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '');
							offset += symbolLength;
							
							const uriLength = metadataData.readUInt32LE(offset);
							offset += 4;
							uri = metadataData.slice(offset, offset + uriLength).toString('utf8').replace(/\0/g, '');
							
							// Fetch image from metadata URI
							if (uri) {
								try {
									const response = await fetch(uri);
									const metadata = await response.json();
									image = metadata.image || '';
									
									// Match with deals
									const matchingDeal = allDeals.find(d => d.account.metadata_uri === uri);
									if (matchingDeal) {
										dealInfo = {
											pubkey: matchingDeal.pubkey.toBase58(),
											account: matchingDeal.account
										};
									}
								} catch (e) {
									console.error('Failed to fetch metadata from URI:', uri, e);
								}
							}
						} catch (e) {
							console.error('Failed to parse metadata account:', e);
						}
					}
					
					listingsWithMetadata.push({
						pubkey,
						listing,
						nftMetadata: { name, image, uri },
						dealInfo
					});
				} catch (e) {
					console.error('Failed to fetch NFT metadata for listing:', e);
				}
			}
			
			console.log(`Fetched ${listingsWithMetadata.length} listings with metadata`);
			listingsWithMetadata.forEach((listing, idx) => {
				console.log(`Listing ${idx + 1}:`, {
					name: listing.nftMetadata?.name,
					hasImage: !!listing.nftMetadata?.image,
					imageUrl: listing.nftMetadata?.image,
					uri: listing.nftMetadata?.uri
				});
			});
			setListings(listingsWithMetadata);
		} catch (e: any) {
			console.error('fetch listings error', e);
			showToast('error', 'Failed to Load Listings', e.message);
		} finally {
			setLoading(false);
		}
	}, [connection, programId, showToast]);

	useEffect(() => {
		fetchListings();
	}, [fetchListings]);

	const onBuyNFT = useCallback(async (listingData: ListingWithMetadata) => {
		if (!publicKey || !signTransaction) {
			showToast('error', 'Wallet Not Connected', 'Please connect your wallet');
			return;
		}

		const listingKey = listingData.pubkey.toBase58();
		// Atomic check: prevent duplicate submissions using ref (doesn't depend on re-render)
		if (isBuyingRef.current !== null) return;
		isBuyingRef.current = listingKey;

		const nftMint = new PublicKey(listingData.listing.nft_mint);
		const seller = new PublicKey(listingData.listing.seller);
		
		setBuying(listingKey);
		const toastId = showToast('loading', 'Buying NFT...', 'Preparing transaction');

		try {
			const { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
			const buyerATA = getAssociatedTokenAddressSync(nftMint, publicKey);
			const [escrowPda] = deriveEscrowPda(programId, nftMint);
			const escrowATA = getAssociatedTokenAddressSync(nftMint, escrowPda, true);
			
			// Create buyer's ATA if needed
			const buyerATAInfo = await connection.getAccountInfo(buyerATA);
			
			const tx = new Transaction();
			if (!buyerATAInfo) {
				tx.add(createAssociatedTokenAccountInstruction(
					publicKey,
					buyerATA,
					publicKey,
					nftMint
				));
			}

			const buyIx = ixBuyNft(programId, publicKey, seller, listingData.pubkey, nftMint, escrowPda, escrowATA, buyerATA, TOKEN_PROGRAM_ID);
			tx.add(buyIx);
			
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			
			updateToast(toastId, { title: 'Confirming transaction...', message: getShortTxSignature(sig) });
			await connection.confirmTransaction(sig, 'confirmed');
			
			// Refresh listings
			await fetchListings();
			
			const priceSOL = Number(listingData.listing.price) / LAMPORTS_PER_SOL;
			updateToast(toastId, {
				type: 'success',
				title: 'NFT Purchased Successfully!',
				message: `Paid ${priceSOL.toFixed(2)} SOL`,
				txLink: getExplorerUrl(sig),
				duration: 10000
			});
		} catch (e: any) {
			console.error('buy NFT error', e);
			const errorMsg = parseContractError(e);
			updateToast(toastId, { type: 'error', title: 'Purchase Failed', message: errorMsg, duration: 10000 });
		} finally {
			setBuying(null);
			isBuyingRef.current = null;
		}
	}, [publicKey, signTransaction, connection, showToast, updateToast, fetchListings]);

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-3xl font-bold mb-2">🛒 NFT Marketplace</h2>
				<p className="text-neutral-400">Buy NFT coupons from other users</p>
			</div>

			<div className="flex items-center justify-between">
				<div className="text-sm text-neutral-500">
					{listings.length} {listings.length === 1 ? 'listing' : 'listings'} available
				</div>
				<button 
					onClick={fetchListings}
					disabled={loading}
					className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
				>
					{loading ? '⏳' : '🔄'} Refresh
				</button>
			</div>

			{loading && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<DealCardSkeleton />
					<DealCardSkeleton />
					<DealCardSkeleton />
				</div>
			)}

			{!loading && listings.length === 0 && (
				<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-12 text-center">
					<div className="text-6xl mb-4">🛍️</div>
					<div className="text-xl font-medium text-neutral-300 mb-2">No Listings Available</div>
					<p className="text-neutral-400 mb-4">
						Be the first to list an NFT coupon for sale!
					</p>
					<a 
						href="/redeem"
						className="inline-block px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
					>
						List Your NFTs
					</a>
				</div>
			)}

			{!loading && listings.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{listings.map((listingData) => {
						const isBuying = buying === listingData.pubkey.toBase58();
						const priceSOL = Number(listingData.listing.price) / LAMPORTS_PER_SOL;
						const isOwnListing = publicKey && new PublicKey(listingData.listing.seller).equals(publicKey);
						
						return (
							<div 
								key={listingData.pubkey.toBase58()}
								className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden hover:border-neutral-600 transition-all"
							>
								{/* NFT Image */}
								<div className="aspect-video w-full bg-neutral-900 relative">
									{listingData.nftMetadata?.image ? (
										<img 
											src={listingData.nftMetadata.image} 
											alt={listingData.nftMetadata?.name || 'NFT'}
											className="w-full h-full object-cover"
											onError={(e) => {
												e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23171717" width="400" height="300"/%3E%3Ctext fill="%23525252" font-family="system-ui" font-size="18" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E🎟️%3C/text%3E%3C/svg%3E';
											}}
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center text-6xl">
											🎫
										</div>
									)}
									{isOwnListing && (
										<div className="absolute top-2 left-2 px-2 py-1 rounded bg-blue-600 text-white text-xs font-bold">
											YOUR LISTING
										</div>
									)}
								</div>
								
								{/* NFT Details */}
								<div className="p-4 space-y-3">
									<div>
										<div className="font-medium text-lg mb-1">
											{listingData.nftMetadata?.name || 'NFT Coupon'}
										</div>
										<div className="text-xs text-neutral-500 font-mono">
											{new PublicKey(listingData.listing.nft_mint).toBase58().slice(0, 8)}...{new PublicKey(listingData.listing.nft_mint).toBase58().slice(-8)}
										</div>
									</div>

									{/* Deal Info if matched */}
									{listingData.dealInfo && (
										<div className="text-sm text-neutral-400 bg-neutral-800/50 rounded p-2">
											<div className="flex items-center gap-1 mb-1">
												<span>💰</span>
												<span className="font-medium text-green-400">
													{listingData.dealInfo.account.discount_percent}% OFF
												</span>
											</div>
											<div className="text-xs text-neutral-500">
												{listingData.dealInfo.account.title}
											</div>
										</div>
									)}
									
									{/* Price Display */}
									<div className="flex items-center justify-between p-3 rounded-lg bg-blue-900/20 border border-blue-800/30">
										<span className="text-sm text-blue-300">Price</span>
										<span className="font-bold text-xl text-blue-100">
											{priceSOL.toFixed(2)} SOL
										</span>
									</div>
									
									{/* Buy Button */}
									{isOwnListing ? (
										<div className="text-center text-sm text-neutral-400 py-2 bg-neutral-800/30 rounded">
											This is your listing
										</div>
									) : (
										<button
											onClick={() => onBuyNFT(listingData)}
											disabled={isBuying || !publicKey}
											className="w-full px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
										>
											{isBuying ? '⏳ Buying...' : '💰 Buy Now'}
										</button>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

