"use client";

import { useCallback, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { clusterApiUrl, PublicKey, Transaction } from '@solana/web3.js';
import { deriveDealPda, deriveMerchantPda, ixCreateDeal, ixMintCoupon } from '@/lib/solana/instructions';

export default function DealsPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	console.log('prog id : ',process.env.NEXT_PUBLIC_PROGRAM_ID);
	const programId = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || ''), []);
	const [creating, setCreating] = useState(false);
	const [minting, setMinting] = useState(false);

	const onCreate = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction) return;
		setCreating(true);
		try {
			const title = String(formData.get('title') || '');
			const description = String(formData.get('description') || '');
			const discount = Number(formData.get('discount') || 0);
			const total = Number(formData.get('total') || 1);
			const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400);
			const dealId = BigInt(Number(formData.get('dealId') || 1));

			const merchantPda = deriveMerchantPda(programId, publicKey);
			const dealPda = deriveDealPda(programId, publicKey, dealId);
			const ix = ixCreateDeal(programId, publicKey, merchantPda, dealPda, { deal_id: dealId, title, description, discount_percent: discount, expiry, total_supply: total });
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			await connection.confirmTransaction(sig, 'confirmed');
			alert(`Deal created: ${sig}`);
		} finally {
			setCreating(false);
		}
	}, [publicKey, signTransaction, connection, programId]);

	const onMint = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction) return;
		setMinting(true);
		try {
			const dealId = BigInt(Number(formData.get('dealId') || 1));
			const merchantPda = deriveMerchantPda(programId, publicKey);
			const dealPda = deriveDealPda(programId, publicKey, dealId);
			const ix = ixMintCoupon(programId, publicKey, merchantPda, dealPda, dealId);
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			await connection.confirmTransaction(sig, 'confirmed');
			alert(`Minted (counter): ${sig}`);
		} finally {
			setMinting(false);
		}
	}, [publicKey, signTransaction, connection, programId]);

	return (
		<div className="space-y-8">
			<h2 className="text-xl font-semibold">Deals</h2>

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
				<div className="col-span-1 md:col-span-2">
					<button disabled={creating} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{creating ? 'Creating…' : 'Create'}</button>
				</div>
			</form>

			<form action={onMint} className="rounded-lg border border-neutral-800 p-4 space-y-3">
				<div className="font-medium">Mint Coupon (counter)</div>
				<label className="space-y-1 block">
					<span className="text-sm text-neutral-400">Deal ID</span>
					<input name="dealId" type="number" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" defaultValue={1} />
				</label>
				<button disabled={minting} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{minting ? 'Minting…' : 'Mint'}</button>
			</form>
		</div>
	)
}
