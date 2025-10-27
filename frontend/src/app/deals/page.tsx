"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveDealPda, deriveMerchantPda, fetchAllDeals, fetchMerchant, ixCreateDeal, ixMintCoupon, ixVerifyAndCountMint, type DealAccount, type MerchantAccount } from '@/lib/solana/instructions';
import { useUmi } from '@/lib/umi/client';
import { mintCoreAsset } from '@/lib/umi/mint';
import { mintTokenMetadataNft } from '@/lib/umi/mint';

export default function DealsPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const umi = useUmi();
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

	const [creating, setCreating] = useState(false);
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

	const onCreate = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction || !programId) { setErrorMsg('Connect wallet and configure program id'); return; }
		setCreating(true);
		try {
			const title = String(formData.get('title') || '');
			const description = String(formData.get('description') || '');
			const discount = Number(formData.get('discount') || 0);
			const total = Number(formData.get('total') || 1);
			const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400);
			const dealId = BigInt(Number(formData.get('dealId') || 1));
			if (!title) throw new Error('Title is required');

			const merchantPda = deriveMerchantPda(programId, publicKey);
			const dealPda = deriveDealPda(programId, publicKey, dealId);
			const ix = ixCreateDeal(programId, publicKey, merchantPda, dealPda, { deal_id: dealId, title, description, discount_percent: discount, expiry, total_supply: total });
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' });
			await connection.confirmTransaction(sig, 'confirmed');
			setErrorMsg(null);
			const list = await fetchAllDeals(connection, programId);
			setDeals(list.map(d => ({ pubkey: d.pubkey.toBase58(), account: d.account })));
			alert(`Deal created: ${sig}`);
		} catch (e: any) {
			console.error('create deal error', e);
			setErrorMsg(e?.message || 'Transaction failed');
		} finally {
			setCreating(false);
		}
	}, [publicKey, signTransaction, connection, programId]);

	const onMint = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction || !programId) { setErrorMsg('Connect wallet and configure program id'); return; }
		setMinting(true);
		try {
			const dealId = BigInt(Number(formData.get('dealId') || 1));
			const deal = deals.find(d => BigInt(d.account.deal_id as any) === dealId);
			if (!deal) throw new Error('Deal not found in list');
			const title = deal.account.title;
			const description = deal.account.description;
			const imageFile = formData.get('image') as File | null;

			// Mint Token Metadata NFT to ensure full metadata support
			const minted = await mintTokenMetadataNft(umi, title, description, imageFile || undefined);
			setErrorMsg(null);
			alert(`NFT created: ${minted.mint}`);
		} catch (e: any) {
			console.error('mint error', e);
			setErrorMsg(e?.message || 'Transaction failed');
		} finally {
			setMinting(false);
		}
	}, [publicKey, signTransaction, programId, umi, deals]);

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
					<ul className="divide-y divide-neutral-800">
						{deals.map(d => (
							<li key={d.pubkey} className="py-3 flex items-start justify-between gap-4">
								<div>
									<div className="font-medium">{d.account.title}</div>
									<div className="text-sm text-neutral-400">{d.account.description}</div>
									<div className="text-sm text-neutral-400">Deal PDA: <span className="font-mono">{d.pubkey}</span></div>
								</div>
								<div className="text-sm text-neutral-300">{d.account.minted}/{d.account.total_supply} minted</div>
							</li>
						))}
					</ul>
				)}
			</section>

			<form action={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-neutral-800 p-4">
				<div className="col-span-1 md:col-span-2 font-medium">Create Deal</div>
				<label className="space-y-1">
					<span className="text-sm text-neutral-400">Deal ID</span>
					<input name="dealId" type="number" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" defaultValue={1} />
				</label>
				<label className="space-y-1">
					<span className="text-sm text-neutral-400">Title</span>
					<input name="title" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" placeholder="10% Off" />
				</label>
				<label className="space-y-1">
					<span className="text-sm text-neutral-400">Description</span>
					<input name="description" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" placeholder="Save on purchase" />
				</label>
				<label className="space-y-1">
					<span className="text-sm text-neutral-400">Discount %</span>
					<input name="discount" type="number" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" defaultValue={10} />
				</label>
				<label className="space-y-1">
					<span className="text-sm text-neutral-400">Total Supply</span>
					<input name="total" type="number" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" defaultValue={2} />
				</label>
				<div className="col-span-1 md:grid-cols-2">
					<button disabled={creating} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{creating ? 'Creating…' : 'Create'}</button>
				</div>
			</form>

			<form action={onMint} className="rounded-lg border border-neutral-800 p-4 space-y-3">
				<div className="font-medium">Mint Coupon Asset (Core)</div>
				<label className="space-y-1 block">
					<span className="text-sm text-neutral-400">Deal ID</span>
					<input name="dealId" type="number" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" defaultValue={1} />
				</label>
				<label className="space-y-1 block">
					<span className="text-sm text-neutral-400">Image (optional)</span>
					<input name="image" type="file" accept="image/*" className="w-full text-sm" />
				</label>
				<button disabled={minting} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{minting ? 'Minting…' : 'Mint Asset'}</button>
			</form>
		</div>
	)
}
