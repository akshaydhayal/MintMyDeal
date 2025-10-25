"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveDealPda, deriveMerchantPda, fetchMerchant, ixCreateDeal, ixRegisterMerchant, ixSetCollectionMint, type MerchantAccount } from '@/lib/solana/instructions';
import { useUmi } from '@/lib/umi/client';
import { mintCollection, uploadImageAndJson } from '@/lib/umi/mint';

export default function MerchantPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const umi = useUmi();
	const programId = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || ''), []);
	const [loading, setLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [merchantAcc, setMerchantAcc] = useState<MerchantAccount | null>(null);

	const merchantPda = useMemo(() => (publicKey ? deriveMerchantPda(programId, publicKey) : null), [programId, publicKey]);

	useEffect(() => {
		let mounted = true;
		(async () => {
			if (!merchantPda) return;
			try {
				const acc = await fetchMerchant(connection, merchantPda);
				if (!mounted) return;
				setMerchantAcc(acc);
			} catch (e: any) {
				console.error('fetch merchant', e);
			}
		})();
		return () => { mounted = false };
	}, [connection, merchantPda]);

	const onRegister = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction) return;
		setLoading(true);
		try {
			const name = String(formData.get('name') || '');
			const uri = String(formData.get('uri') || '');
			const mpda = deriveMerchantPda(programId, publicKey);
			const ix = ixRegisterMerchant(programId, publicKey, mpda, name, uri);
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			await connection.confirmTransaction(sig, 'confirmed');
			setErrorMsg(null);
			const acc = await fetchMerchant(connection, mpda);
			setMerchantAcc(acc);
			alert(`Merchant registered: ${sig}`);
		} catch (e: any) {
			console.error('register merchant error', e);
			setErrorMsg(e?.message || 'Failed to register');
		} finally {
			setLoading(false);
		}
	}, [publicKey, signTransaction, connection, programId]);

	const onCreateCollection = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction) return;
		if (!merchantPda) return;
		setLoading(true);
		try {
			const name = String(formData.get('cname') || 'Merchant Collection');
			const symbol = String(formData.get('csymbol') || 'DEAL');
			const desc = String(formData.get('cdesc') || '');
			const imgFile = formData.get('cimage') as File | null;
			if (!imgFile) throw new Error('Image required');
			const { imageUri, jsonUri } = await uploadImageAndJson(umi, imgFile, { name, symbol, description: desc });
			const collection = await mintCollection(umi, name, symbol, jsonUri);
			const ix = ixSetCollectionMint(programId, publicKey, merchantPda, new PublicKey(collection));
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			await connection.confirmTransaction(sig, 'confirmed');
			const acc = await fetchMerchant(connection, merchantPda);
			setMerchantAcc(acc);
			setErrorMsg(null);
			alert(`Collection set: ${collection.toString()}`);
		} catch (e: any) {
			console.error('create collection error', e);
			setErrorMsg(e?.message || 'Failed to create collection');
		} finally {
			setLoading(false);
		}
	}, [publicKey, signTransaction, connection, programId, merchantPda, umi]);

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

			const mpda = deriveMerchantPda(programId, publicKey);
			const dealPda = deriveDealPda(programId, publicKey, dealId);
			const ix = ixCreateDeal(programId, publicKey, mpda, dealPda, { deal_id: dealId, title, description, discount_percent: discount, expiry, total_supply: total });
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			await connection.confirmTransaction(sig, 'confirmed');
			alert(`Deal created: ${sig}`);
		} catch (e: any) {
			console.error('create deal error', e);
			setErrorMsg(e?.message || 'Failed to create deal');
		} finally {
			setLoading(false);
		}
	}, [publicKey, signTransaction, connection, programId]);

	return (
		<div className="space-y-8">
			<h2 className="text-xl font-semibold">Merchant Dashboard</h2>

			{errorMsg && (
				<div className="rounded border border-yellow-800 bg-yellow-950/50 text-yellow-200 px-3 py-2">{errorMsg}</div>
			)}

			<section className="rounded-lg border border-neutral-800 p-4 space-y-3">
				<div className="font-medium">Register Merchant</div>
				<form action={onRegister} className="space-y-3">
					<input name="name" placeholder="Merchant Name" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
					<input name="uri" placeholder="https://example.com" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
					<button disabled={loading} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{loading ? 'Submitting…' : 'Register'}</button>
				</form>
				{merchantAcc && (
					<div className="text-sm text-neutral-400">Collection: <span className="font-mono">{new PublicKey(merchantAcc.collection_mint).toBase58()}</span></div>
				)}
			</section>

			<section className="rounded-lg border border-neutral-800 p-4 space-y-3">
				<div className="font-medium">Create Collection</div>
				<form action={onCreateCollection} className="space-y-3" encType="multipart/form-data">
					<input name="cname" placeholder="Collection Name" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
					<input name="csymbol" placeholder="Symbol" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
					<input name="cdesc" placeholder="Description" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
					<input name="cimage" type="file" accept="image/*" className="w-full text-sm" />
					<button disabled={loading} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{loading ? 'Minting…' : 'Create Collection'}</button>
				</form>
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
				<div className="col-span-1 md:col-span-2">
					<button disabled={loading} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{loading ? 'Creating…' : 'Create'}</button>
				</div>
			</form>
		</div>
	)
}
