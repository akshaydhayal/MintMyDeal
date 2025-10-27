"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveDealPda, deriveMerchantPda, fetchAllDeals, ixVerifyAndCountMint, type DealAccount } from '@/lib/solana/instructions';
import { useUmi } from '@/lib/umi/client';
import { generateSigner, percentAmount } from '@metaplex-foundation/umi';
import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import { useToast } from '@/lib/toast/ToastContext';
import { parseContractError, getShortTxSignature, getExplorerUrl } from '@/lib/solana/errors';
import Link from 'next/link';

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

	const dealPubkeyStr = params.id as string; // This is now the PDA address, not deal_id

	// Memoize programId to prevent recreating on every render
	const programId = useMemo(() => {
		return new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '');
	}, []);

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
		}
	}, [publicKey, signTransaction, deal, dealPubkeyStr, umi, connection, programId, showToast, updateToast]);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="text-center">
					<div className="text-4xl mb-4 animate-pulse">⏳</div>
					<div className="text-xl text-neutral-300">Loading deal...</div>
				</div>
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
	const expiryDate = new Date(Number(deal.account.expiry) * 1000);
	const isExpired = expiryDate < new Date();

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

					{/* Expiry Info */}
					<div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4">
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
									<div className="text-xs text-red-400">This deal has expired</div>
								)}
							</div>
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

			{/* Bottom Section: Metadata Links */}
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
	);
}

