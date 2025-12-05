"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveDealPda, deriveMerchantPda, fetchAllDeals, ixVerifyAndCountMint, type DealAccount } from '@/lib/solana/instructions';
import { useUmi } from '@/lib/umi/client';
import { generateSigner, percentAmount } from '@metaplex-foundation/umi';
import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import { useToast } from '@/lib/toast/ToastContext';
import { parseContractError, getShortTxSignature, getExplorerUrl } from '@/lib/solana/errors';

export default function DealsPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const umi = useUmi();
	const { showToast, updateToast } = useToast();
	const [programIdError, setProgramIdError] = useState<string | null>(null);
	const programId = useMemo(() => {
		try {
			const pid = process.env.NEXT_PUBLIC_PROGRAM_ID || '';
			if (!pid) throw new Error('NEXT_PUBLIC_PROGRAM_ID missing');
			return new PublicKey(pid);
		} catch (e: any) {
			setProgramIdError(e?.message || 'Invalid program id');
			return null as any;
		}
	}, []);

	const [minting, setMinting] = useState(false);
	const [deals, setDeals] = useState<Array<{ pubkey: string; account: DealAccount }>>([]);
	const [loading, setLoading] = useState(true);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		(async () => {
			if (!programId) return;
			try {
				setLoading(true);
				const list = await fetchAllDeals(connection, programId);
				if (!mounted) return;
				setDeals(list.map(d => ({ pubkey: d.pubkey.toBase58(), account: d.account })));
				setErrorMsg(null);
			} catch (e: any) {
				console.error('fetchAllDeals error', e);
				if (mounted) setErrorMsg(e?.message || 'Failed to load deals');
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => { mounted = false };
	}, [connection, programId]);

	const onMint = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction || !programId) { 
			showToast('error', 'Wallet Not Connected', 'Please connect your wallet');
			return;
		}
		setMinting(true);
		let toastId: string | null = null;
		try {
			const dealId = BigInt(Number(formData.get('dealId') || 1));
			const deal = deals.find(d => BigInt(d.account.deal_id as any) === dealId);
			if (!deal) throw new Error('Deal not found in list');
			
			// Check if deal has reached mint limit
			const minted = deal.account.minted as number;
			const totalSupply = deal.account.total_supply as number;
			if (minted >= totalSupply) {
				throw new Error(`Mint limit reached: ${minted}/${totalSupply} NFTs already minted`);
			}
			
			const title = deal.account.title;
			const metadataUri = deal.account.metadata_uri;
			
			if (!metadataUri) {
				throw new Error('Deal metadata URI not found. Please recreate the deal with an NFT image.');
			}

			// Mint Token Metadata NFT using stored metadata URI (no upload needed!)
			toastId = showToast('loading', `Minting NFT: ${title}`, 'Creating NFT on-chain...');
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
			
			// Call VerifyAndCountMint to increment on-chain counter
			updateToast(toastId, { title: 'Verifying and counting...', message: 'Updating deal counter' });
			const merchantPubkey = new PublicKey(deal.account.merchant);
			const merchantPda = deriveMerchantPda(programId, merchantPubkey);
			const dealPda = deriveDealPda(programId, merchantPubkey, dealId);
			const ix = ixVerifyAndCountMint(programId, publicKey, merchantPda, dealPda, dealId, mintPubkey);
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			updateToast(toastId, { title: 'Confirming transaction...', message: getShortTxSignature(sig) });
			await connection.confirmTransaction(sig, 'confirmed');
			
			setErrorMsg(null);
			
			// Refresh deals list to show updated count
			const list = await fetchAllDeals(connection, programId);
			setDeals(list.map(d => ({ pubkey: d.pubkey.toBase58(), account: d.account })));
			
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
	}, [publicKey, signTransaction, programId, umi, deals, connection, showToast, updateToast]);

	return (
		<div className="space-y-8">
			<h2 className="text-xl font-semibold">Deals</h2>

			{programIdError && (
				<div className="rounded border border-red-900 bg-red-950/50 text-red-300 px-3 py-2">
					{programIdError}
				</div>
			)}
			{errorMsg && (
				<div className="rounded border border-yellow-800 bg-yellow-950/50 text-yellow-200 px-3 py-2">
					{errorMsg}
				</div>
			)}

			<section className="rounded-lg border border-neutral-800 p-4">
				<div className="flex items-center justify-between mb-3">
					<div className="font-medium">Browse Deals</div>
					<button onClick={async () => {
						try {
							setLoading(true);
							const list = await fetchAllDeals(connection, programId);
							setDeals(list.map(d => ({ pubkey: d.pubkey.toBase58(), account: d.account })));
							setErrorMsg(null);
						} catch (e: any) {
							console.error('refresh error', e);
							setErrorMsg(e?.message || 'Failed to refresh');
						} finally {
							setLoading(false);
						}
					}} className="text-sm underline">Refresh</button>
				</div>
				{loading ? (
					<div className="text-neutral-400">Loading…</div>
				) : deals.length === 0 ? (
					<div className="text-neutral-400">No deals found.</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{deals.map(d => (
							<div key={d.pubkey} className="rounded-lg border border-neutral-800 overflow-hidden hover:border-neutral-600 transition-colors">
								{d.account.image_uri && (
									<div className="aspect-video w-full bg-neutral-900 relative">
										<img 
											src={d.account.image_uri} 
											alt={d.account.title}
											className="w-full h-full object-cover"
											onError={(e) => {
												e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23171717" width="400" height="300"/%3E%3Ctext fill="%23525252" font-family="system-ui" font-size="18" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EImage not available%3C/text%3E%3C/svg%3E';
											}}
										/>
									</div>
								)}
								<div className="p-4 space-y-2">
									<div className="flex items-start justify-between gap-2">
										<div className="font-medium text-lg">{d.account.title}</div>
										<div className="px-2 py-0.5 rounded bg-green-900/50 text-green-200 text-xs font-medium whitespace-nowrap">
											{d.account.discount_percent}% OFF
										</div>
									</div>
									<p className="text-sm text-neutral-400 line-clamp-2">{d.account.description}</p>
									<div className="flex items-center justify-between pt-2 border-t border-neutral-800">
										<div className="text-xs text-neutral-500">
											Deal ID: <span className="font-mono">{String(d.account.deal_id)}</span>
										</div>
										<div className="text-sm text-neutral-300 font-medium">
											{d.account.minted}/{d.account.total_supply} minted
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			<form action={onMint} className="rounded-lg border border-neutral-800 p-4 space-y-3">
				<div className="font-medium">Mint Coupon NFT (Uses Pre-Uploaded Metadata)</div>
				<p className="text-sm text-neutral-400">No image upload needed - metadata is reused from the deal!</p>
				<label className="space-y-1 block">
					<span className="text-sm text-neutral-400">Deal ID</span>
					<input name="dealId" type="number" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" defaultValue={1} />
				</label>
				<button disabled={minting} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{minting ? 'Minting…' : 'Mint NFT'}</button>
			</form>
		</div>
	)
}
