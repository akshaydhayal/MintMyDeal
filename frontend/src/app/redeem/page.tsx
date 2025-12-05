"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveRedeemPda, ixRedeemAndBurn, fetchAllDeals, type DealAccount } from '@/lib/solana/instructions';
import { useToast } from '@/lib/toast/ToastContext';
import { parseContractError, getShortTxSignature, getExplorerUrl } from '@/lib/solana/errors';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';

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
		if (!publicKey || !signTransaction) {
			showToast('error', 'Wallet Not Connected', 'Please connect your wallet');
			return;
		}
		
		const mintStr = nft.mint.toBase58();
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
			
			// Remove NFT from list
			setUserNFTs(prev => prev.filter(n => n.mint.toBase58() !== mintStr));
			
			updateToast(toastId, { 
				type: 'success', 
				title: '🎉 NFT Coupon Redeemed!', 
				message: 'NFT has been burned. Show this transaction to the merchant.',
				txLink: getExplorerUrl(sig),
				duration: 10000 
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
		}
	}, [publicKey, signTransaction, connection, programId, showToast, updateToast]);

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
							<li>• Each NFT can only be redeemed <strong>once</strong></li>
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
				<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-12 text-center">
					<div className="text-4xl mb-4 animate-pulse">⏳</div>
					<div className="text-xl text-neutral-300">Loading your NFTs...</div>
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

										{/* Redeem Button */}
										<button
											onClick={() => onRedeemNFT(nft)}
											disabled={isRedeeming}
											className="w-full px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
										>
											{isRedeeming ? '⏳ Redeeming...' : '🔥 Redeem Coupon'}
										</button>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

		</div>
	)
}
