"use client";

import { useCallback, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveDealPda, deriveMerchantPda, ixCreateDeal, ixRegisterMerchant } from '@/lib/solana/instructions';

export default function MerchantPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const programId = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || ''), []);
	const [loading, setLoading] = useState(false);

	const onRegister = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction) return;
		setLoading(true);
		try {
			const name = String(formData.get('name') || '');
			const uri = String(formData.get('uri') || '');
			const merchantPda = deriveMerchantPda(programId, publicKey);
			const ix = ixRegisterMerchant(programId, publicKey, merchantPda, name, uri);
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			await connection.confirmTransaction(sig, 'confirmed');
			alert(`Merchant registered: ${sig}`);
		} finally {
			setLoading(false);
		}
	}, [publicKey, signTransaction, connection, programId]);

	const onCreate = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction) return;
		setLoading(true);
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
			setLoading(false);
		}
	}, [publicKey, signTransaction, connection, programId]);

	return (
		<div className="space-y-8">
			<h2 className="text-xl font-semibold">Merchant Dashboard</h2>

			<form action={onRegister} className="rounded-lg border border-neutral-800 p-4 space-y-3">
				<div className="font-medium">Register Merchant</div>
				<input name="name" placeholder="Merchant Name" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
				<input name="uri" placeholder="https://example.com" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
				<button disabled={loading} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{loading ? 'Submitting…' : 'Register'}</button>
			</form>

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
					<button disabled={loading} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{loading ? 'Creating…' : 'Create'}</button>
				</div>
			</form>
		</div>
	)
}
