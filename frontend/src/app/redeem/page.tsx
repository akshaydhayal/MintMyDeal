"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveRedeemPda, ixRedeemAndBurn, fetchAllDeals, type DealAccount, ixListNft, deriveEscrowPda, deriveListingPda } from '@/lib/solana/instructions';
import { useToast } from '@/lib/toast/ToastContext';
import { parseContractError, getShortTxSignature, getExplorerUrl } from '@/lib/solana/errors';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { NFTCardSkeleton } from '@/components/Loader';

interface UserNFT {
	mint: PublicKey;
	name: string;
	symbol: string;
	uri: string;
	image?: string;
	dealInfo?: { pubkey: string; account: DealAccount };
}

export default function RedeemPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const { showToast, updateToast } = useToast();
	const programId = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || ''), []);
	
	const [userNFTs, setUserNFTs] = useState<UserNFT[]>([]);
	const [loadingNFTs, setLoadingNFTs] = useState(false);
	const [redeeming, setRedeeming] = useState<string | null>(null);
	const [showListModal, setShowListModal] = useState<UserNFT | null>(null);
	const [listPrice, setListPrice] = useState('');
	const [listing, setListing] = useState<string | null>(null);
	const [redeemSuccessModal, setRedeemSuccessModal] = useState<{ txSig: string; couponCode: string; nftName: string } | null>(null);

	// Use refs to prevent duplicate transaction execution (atomic check)
	const isRedeemingRef = useRef<string | null>(null);
	const isListingRef = useRef(false);

	// Fetch user's NFTs using getTokenAccountsByOwner
	useEffect(() => {
		let mounted = true;
		(async () => {
			if (!publicKey) {
				setUserNFTs([]);
				return;
			}
			
			try {
				setLoadingNFTs(true);
				
				// Fetch all token accounts owned by user
				const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
					programId: TOKEN_PROGRAM_ID,
				});
				
				// Fetch all deals to match NFTs with deals
				const allDeals = await fetchAllDeals(connection, programId);
				
				// Filter and enrich NFTs
				const enrichedNFTs: UserNFT[] = [];
				
				for (const { account } of tokenAccounts.value) {
					try {
						// Parse token account data
						const data = Buffer.from(account.data);
						const mint = new PublicKey(data.slice(0, 32));
						const amount = data.readBigUInt64LE(64);
						
						// Only include tokens with amount = 1 (NFTs)
						if (amount !== 1n) continue;
						
						// Fetch mint account to get decimals
						const mintInfo = await connection.getAccountInfo(mint);
						if (!mintInfo) continue;
						
						const decimals = mintInfo.data[44];
						if (decimals !== 0) continue; // NFTs have 0 decimals
						
						// Try to fetch metadata
						const metadataPda = PublicKey.findProgramAddressSync(
							[
								Buffer.from('metadata'),
								new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
								mint.toBuffer(),
							],
							new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
						)[0];
						
						const metadataAccount = await connection.getAccountInfo(metadataPda);
						let name = 'Unknown NFT';
						let symbol = '';
						let uri = '';
						let imageUrl = '';
						let dealInfo: { pubkey: string; account: DealAccount } | undefined;
						
						if (metadataAccount) {
							try {
								// Parse metadata (simplified)
								const metadataData = metadataAccount.data;
								// Skip first byte (key), then read name
								let offset = 1 + 32 + 32; // key + update_authority + mint
								const nameLength = metadataData.readUInt32LE(offset);
								offset += 4;
								name = metadataData.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '');
								offset += nameLength;
								
								const symbolLength = metadataData.readUInt32LE(offset);
								offset += 4;
								symbol = metadataData.slice(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '');
								offset += symbolLength;
								
								const uriLength = metadataData.readUInt32LE(offset);
								offset += 4;
								uri = metadataData.slice(offset, offset + uriLength).toString('utf8').replace(/\0/g, '');
								
								// Fetch image from metadata URI
								if (uri) {
									try {
										const response = await fetch(uri);
										const metadata = await response.json();
										imageUrl = metadata.image || '';
										
										// Match with deals
										for (const deal of allDeals) {
											if (uri === deal.account.metadata_uri) {
												dealInfo = { pubkey: deal.pubkey.toBase58(), account: deal.account };
												break;
											}
										}
									} catch {
										// Ignore fetch errors
									}
								}
							} catch {
								// Ignore parsing errors
							}
						}
						
						enrichedNFTs.push({
							mint,
							name,
							symbol,
							uri,
							image: imageUrl,
							dealInfo,
						});
					} catch {
						// Skip problematic tokens
					}
				}
				
				if (mounted) {
					setUserNFTs(enrichedNFTs);
				}
			} catch (e: any) {
				console.error('fetch NFTs error', e);
				if (mounted) {
					showToast('error', 'Failed to Load NFTs', 'Could not fetch your NFTs. Please try refreshing.');
				}
			} finally {
				if (mounted) setLoadingNFTs(false);
			}
		})();
		return () => { mounted = false };
	}, [publicKey, connection, programId, showToast]);

	const onRedeemNFT = useCallback(async (nft: UserNFT) => {
		const mintStr = nft.mint.toBase58();
		
		// Atomic check FIRST - prevent duplicate submissions using ref (doesn't depend on re-render)
		if (isRedeemingRef.current !== null) {
			console.log('⚠️ Redemption transaction already in progress, ignoring duplicate call');
			return;
		}
		isRedeemingRef.current = mintStr;
		
		if (!publicKey || !signTransaction) {
			isRedeemingRef.current = null;
			showToast('error', 'Wallet Not Connected', 'Please connect your wallet');
			return;
		}
		
		setRedeeming(mintStr);
		let toastId: string | null = null;
		
		try {
			const mint = nft.mint;
			
			// Get user's token account for this NFT
			const userTokenAccount = getAssociatedTokenAddressSync(
				mint,
				publicKey,
				false,
				TOKEN_PROGRAM_ID
			);
			
			const redeemPda = deriveRedeemPda(programId, mint);
			
			toastId = showToast('loading', `Redeeming ${nft.name}`, 'Burning NFT and creating redemption log');
			
			// Use RedeemAndBurn instruction (burns NFT + creates log)
			const ix = ixRedeemAndBurn(programId, publicKey, userTokenAccount, mint, TOKEN_PROGRAM_ID, redeemPda);
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			
			updateToast(toastId, { title: 'Confirming transaction...', message: getShortTxSignature(sig) });
			await connection.confirmTransaction(sig, 'confirmed');
			
			// Generate random 16-digit alphanumeric coupon code
			const generateCouponCode = () => {
				const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
				let code = '';
				for (let i = 0; i < 16; i++) {
					code += chars.charAt(Math.floor(Math.random() * chars.length));
				}
				// Format as XXXX-XXXX-XXXX-XXXX for readability
				return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
			};
			const couponCode = generateCouponCode();
			
			// Remove NFT from list
			setUserNFTs(prev => prev.filter(n => n.mint.toBase58() !== mintStr));
			
			// Show success modal with transaction and coupon code
			setRedeemSuccessModal({
				txSig: sig,
				couponCode,
				nftName: nft.name
			});
			
			updateToast(toastId, { 
				type: 'success', 
				title: '🎉 NFT Coupon Redeemed!', 
				message: 'Your coupon code is ready!',
				duration: 3000 
			});
		} catch (e: any) {
			console.error('redeem error', e);
			const errorMsg = parseContractError(e);
			if (toastId) {
				updateToast(toastId, { type: 'error', title: 'Redemption Failed', message: errorMsg, duration: 10000 });
			} else {
				showToast('error', 'Redemption Failed', errorMsg);
			}
		} finally {
			setRedeeming(null);
			isRedeemingRef.current = null;
		}
	}, [publicKey, signTransaction, connection, programId, showToast, updateToast]);

	const onListNFT = useCallback(async () => {
		// Atomic check FIRST - prevent duplicate submissions using ref (doesn't depend on re-render)
		if (isListingRef.current) {
			console.log('⚠️ Listing transaction already in progress, ignoring duplicate call');
			return;
		}
		isListingRef.current = true;
		let toastId: string | null = null;

		try {
			if (!publicKey || !signTransaction || !showListModal) {
				isListingRef.current = false;
				showToast('error', 'Wallet Not Connected', 'Please connect your wallet');
				return;
			}

			const nft = showListModal; // After validation, we know it's not null
			const mintStr = nft.mint.toBase58();

			// Set state IMMEDIATELY after validation to disable button ASAP
			setListing(mintStr);

			const priceNum = parseFloat(listPrice);
			if (!priceNum || priceNum <= 0) {
				isListingRef.current = false;
				setListing(null);
				showToast('error', 'Invalid Price', 'Please enter a valid price');
				return;
			}

			const priceLamports = BigInt(Math.floor(priceNum * 1e9)); // Convert SOL to lamports

			toastId = showToast('loading', 'Listing NFT...', 'Preparing transaction');

			const [escrowPda] = deriveEscrowPda(programId, nft.mint);
			const escrowATA = getAssociatedTokenAddressSync(nft.mint, escrowPda, true);
			const sellerATA = getAssociatedTokenAddressSync(nft.mint, publicKey);
			const [listingPda] = deriveListingPda(programId, nft.mint, publicKey);
			
			// Create escrow ATA if needed
			const escrowInfo = await connection.getAccountInfo(escrowATA);
			const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
			
			const tx = new Transaction();
			if (!escrowInfo) {
				tx.add(createAssociatedTokenAccountInstruction(
					publicKey,
					escrowATA,
					escrowPda,
					nft.mint
				));
			}

			const listIx = ixListNft(programId, publicKey, listingPda, nft.mint, sellerATA, escrowATA, TOKEN_PROGRAM_ID, priceLamports);
			tx.add(listIx);
			
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			
			// Double-check ref before signing (extra safety)
			if (!isListingRef.current) {
				console.warn('⚠️ Listing ref was reset, aborting transaction');
				return;
			}
			
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());

			updateToast(toastId, { title: 'Confirming transaction...', message: getShortTxSignature(sig) });
			await connection.confirmTransaction(sig, 'confirmed');

			// Remove NFT from list (it's now in escrow)
			setUserNFTs(prev => prev.filter(n => n.mint.toBase58() !== mintStr));
			setShowListModal(null);
			setListPrice('');

			updateToast(toastId, {
				type: 'success',
				title: 'NFT Listed Successfully!',
				message: `Listed for ${priceNum} SOL`,
				txLink: getExplorerUrl(sig),
				duration: 10000
			});
		} catch (e: any) {
			console.error('list error', e);
			const errorMsg = parseContractError(e);
			if (toastId) {
				updateToast(toastId, { type: 'error', title: 'Listing Failed', message: errorMsg, duration: 10000 });
			} else {
				showToast('error', 'Listing Failed', errorMsg);
			}
		} finally {
			setListing(null);
			isListingRef.current = false;
		}
	}, [publicKey, signTransaction, connection, programId, showToast, updateToast, showListModal, listPrice]);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-3xl font-bold mb-2">🎟️ Redeem NFT Coupons</h2>
				<p className="text-neutral-400">Select an NFT coupon from your wallet to redeem</p>
			</div>

			{/* Info Card */}
			<div className="rounded-lg border border-blue-800/50 bg-blue-950/20 p-4">
				<div className="flex items-start gap-3">
					<div className="text-2xl">ℹ️</div>
					<div className="flex-1">
						<div className="font-medium text-blue-200 mb-2">How Redemption Works</div>
						<ul className="text-sm text-blue-100/70 space-y-1">
							<li>• Your NFT will be <strong>permanently burned</strong> (destroyed)</li>
							<li>• A redemption log will be created on-chain as proof</li>
							<li>• Show the transaction signature to the merchant</li>
							{/* <li>• Each NFT can only be redeemed <strong>once</strong></li> */}
						</ul>
					</div>
				</div>
			</div>

			{/* Wallet Not Connected */}
			{!publicKey && (
				<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-12 text-center">
					<div className="text-5xl mb-4">👛</div>
					<div className="text-xl font-medium text-neutral-300 mb-2">Connect Your Wallet</div>
					<p className="text-neutral-400">
						Connect your wallet to view and redeem your NFT coupons
					</p>
				</div>
			)}

			{/* Loading NFTs */}
			{publicKey && loadingNFTs && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<NFTCardSkeleton />
					<NFTCardSkeleton />
					<NFTCardSkeleton />
					<NFTCardSkeleton />
					<NFTCardSkeleton />
					<NFTCardSkeleton />
				</div>
			)}

			{/* No NFTs Found */}
			{publicKey && !loadingNFTs && userNFTs.length === 0 && (
				<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-12 text-center">
					<div className="text-5xl mb-4">📭</div>
					<div className="text-xl font-medium text-neutral-300 mb-2">No NFT Coupons Found</div>
					<p className="text-neutral-400 mb-4">
						You don't have any NFT coupons in your wallet yet
					</p>
					<a 
						href="/deals"
						className="inline-block px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors"
					>
						Browse Deals
					</a>
				</div>
			)}

			{/* NFT Grid */}
			{publicKey && !loadingNFTs && userNFTs.length > 0 && (
				<div>
					<div className="flex items-center justify-between mb-4">
						<div className="text-lg font-medium">
							Your NFT Coupons ({userNFTs.length})
						</div>
						<button
							onClick={() => window.location.reload()}
							className="text-sm text-blue-400 hover:text-blue-300 underline"
						>
							Refresh
						</button>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{userNFTs.map((nft) => {
							const isRedeeming = redeeming === nft.mint.toBase58();
							
							return (
								<div 
									key={nft.mint.toBase58()}
									className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden hover:border-neutral-600 transition-all"
								>
									{/* NFT Image */}
									{nft.image && (
										<div className="aspect-video w-full bg-neutral-900 relative">
											<img 
												src={nft.image} 
												alt={nft.name}
												className="w-full h-full object-cover"
												onError={(e) => {
													e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23171717" width="400" height="300"/%3E%3Ctext fill="%23525252" font-family="system-ui" font-size="18" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E🎟️%3C/text%3E%3C/svg%3E';
												}}
											/>
										</div>
									)}

									{/* NFT Details */}
									<div className="p-4 space-y-3">
										<div>
											<div className="font-medium text-lg mb-1">{nft.name}</div>
											<div className="text-xs text-neutral-500 font-mono">
												{nft.mint.toBase58().slice(0, 8)}...{nft.mint.toBase58().slice(-8)}
											</div>
										</div>

										{/* Deal Info if matched */}
										{nft.dealInfo && (
											<div className="text-sm text-neutral-400 bg-neutral-800/50 rounded p-2">
												<div className="flex items-center gap-1 mb-1">
													<span>💰</span>
													<span className="font-medium text-green-400">
														{nft.dealInfo.account.discount_percent}% OFF
													</span>
												</div>
												<div className="text-xs text-neutral-500">
													Deal #{String(nft.dealInfo.account.deal_id)}
												</div>
											</div>
										)}

									{/* Action Buttons */}
									<div className="flex gap-2">
										<button
											onClick={() => setShowListModal(nft)}
											disabled={isRedeeming}
											className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
										>
											💰 List NFT
										</button>
										<button
											onClick={() => onRedeemNFT(nft)}
											disabled={isRedeeming}
											className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
										>
											{isRedeeming ? '⏳ Redeeming...' : '🔥 Redeem'}
										</button>
									</div>
								</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* List NFT Modal */}
			{showListModal && (
				<div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
					<div className="bg-neutral-900 rounded-xl border border-neutral-800 max-w-md w-full p-6 space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-xl font-bold">💰 List NFT for Sale</h3>
							<button
								onClick={() => {
									setShowListModal(null);
									setListPrice('');
								}}
								className="text-neutral-400 hover:text-white"
							>
								✕
							</button>
						</div>

						{/* NFT Preview */}
						<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
							{showListModal.image && (
								<div className="aspect-video bg-neutral-900">
									<img 
										src={showListModal.image} 
										alt={showListModal.name}
										className="w-full h-full object-cover"
									/>
								</div>
							)}
							<div className="p-3">
								<div className="font-medium">{showListModal.name}</div>
								{showListModal.dealInfo && (
									<div className="text-xs text-green-400 mt-1">
										{showListModal.dealInfo.account.discount_percent}% OFF - {showListModal.dealInfo.account.title}
									</div>
								)}
							</div>
						</div>

						{/* Price Input */}
						<div className="space-y-2">
							<label className="block text-sm font-medium text-neutral-300">
								Price (SOL) <span className="text-red-400">*</span>
							</label>
							<input
								type="number"
								step="0.01"
								min="0"
								value={listPrice}
								onChange={(e) => setListPrice(e.target.value)}
								placeholder="0.5"
								className="w-full px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
							/>
							<p className="text-xs text-neutral-400">
								Buyers will pay this amount in SOL
							</p>
						</div>

						{/* Action Buttons */}
						<div className="flex gap-3 pt-2">
							<button
								onClick={() => {
									setShowListModal(null);
									setListPrice('');
								}}
								className="flex-1 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									// Additional check before calling onListNFT (double protection)
									if (isListingRef.current) {
										console.log('⚠️ Listing already in progress, ignoring click');
										return;
									}
									if (listing === showListModal.mint.toBase58()) {
										console.log('⚠️ Listing already in progress (state check), ignoring click');
										return;
									}
									onListNFT();
								}}
								disabled={!listPrice || listing === showListModal.mint.toBase58() || isListingRef.current}
								className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								{listing === showListModal.mint.toBase58() || isListingRef.current ? '⏳ Listing...' : '💰 List NFT'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Redemption Success Modal */}
			{redeemSuccessModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setRedeemSuccessModal(null)}>
					<div className="relative bg-gradient-to-br from-green-950/90 to-emerald-950/90 rounded-xl border-2 border-green-500/50 shadow-2xl max-w-lg w-full max-h-[95vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
						{/* Scrollable Content */}
						<div className="flex-1 overflow-y-auto p-5 space-y-4">
							{/* Header */}
							<div className="text-center">
								<div className="text-4xl mb-2">🎉</div>
								<h3 className="text-xl font-bold text-green-200 mb-1">NFT Redeemed Successfully!</h3>
								<p className="text-green-300/70 text-xs">
									<span className="font-semibold text-green-200">{redeemSuccessModal.nftName}</span> has been burned
								</p>
							</div>

							{/* Coupon Code Section */}
							<div className="bg-black/40 rounded-lg border border-green-600/30 p-3 space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-xs font-medium text-green-300">Your Coupon Code:</span>
									<button
										onClick={() => {
											navigator.clipboard.writeText(redeemSuccessModal.couponCode.replace(/-/g, ''));
											showToast('success', 'Copied!', 'Coupon code copied to clipboard');
										}}
										className="text-xs px-2 py-1 rounded bg-green-800/50 hover:bg-green-800/70 text-green-200 transition-colors"
									>
										📋 Copy
									</button>
								</div>
								<div className="bg-black/60 rounded-lg p-3 border border-green-500/50">
									<div className="font-mono text-xl font-bold text-green-200 text-center tracking-wider select-all">
										{redeemSuccessModal.couponCode}
									</div>
								</div>
								<p className="text-xs text-green-300/60 text-center">
									Use at physical stores or enter online
								</p>
							</div>

							{/* Transaction Signature Section */}
							<div className="bg-black/40 rounded-lg border border-blue-600/30 p-3 space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-xs font-medium text-blue-300">Transaction Proof:</span>
									<button
										onClick={() => {
											navigator.clipboard.writeText(redeemSuccessModal.txSig);
											showToast('success', 'Copied!', 'Transaction signature copied to clipboard');
										}}
										className="text-xs px-2 py-1 rounded bg-blue-800/50 hover:bg-blue-800/70 text-blue-200 transition-colors"
									>
										📋 Copy
									</button>
								</div>
								<div className="bg-black/60 rounded-lg p-2 border border-blue-500/50 max-h-20 overflow-y-auto">
									<div className="font-mono text-xs text-blue-200 break-all select-all">
										{redeemSuccessModal.txSig}
									</div>
								</div>
								<a
									href={getExplorerUrl(redeemSuccessModal.txSig)}
									target="_blank"
									rel="noopener noreferrer"
									className="block text-center text-xs text-blue-400 hover:text-blue-300 underline"
								>
									🔗 View on Solana Explorer →
								</a>
								<p className="text-xs text-blue-300/60 text-center">
									Merchants can verify on-chain
								</p>
							</div>

							{/* Instructions */}
							<div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 space-y-1">
								<div className="flex items-start gap-2">
									<span className="text-sm">💡</span>
									<div className="flex-1">
										<p className="text-xs font-medium text-yellow-200 mb-1">How to use:</p>
										<ul className="text-xs text-yellow-300/80 space-y-0.5 list-disc list-inside">
											<li><strong>Physical:</strong> Show code or screen</li>
											<li><strong>Online:</strong> Enter code or share transaction</li>
										</ul>
									</div>
								</div>
							</div>
						</div>

						{/* Close Button - Fixed at bottom */}
						<div className="p-4 border-t border-green-600/30 bg-green-950/50">
							<button
								onClick={() => setRedeemSuccessModal(null)}
								className="w-full px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
							>
								✓ Got it!
							</button>
						</div>
					</div>
				</div>
			)}

		</div>
	)
}
