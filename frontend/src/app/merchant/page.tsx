"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveDealPda, deriveMerchantPda, fetchMerchant, ixCreateDeal, ixRegisterMerchant, ixSetCollectionMint, type MerchantAccount } from '@/lib/solana/instructions';
import { useUmi } from '@/lib/umi/client';
import { mintCollection, uploadImageAndJson } from '@/lib/umi/mint';
import { useToast } from '@/lib/toast/ToastContext';
import { parseContractError, getShortTxSignature, getExplorerUrl } from '@/lib/solana/errors';

export default function MerchantPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const umi = useUmi();
	const { showToast, updateToast } = useToast();
	const programId = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || ''), []);
	const [loading, setLoading] = useState(false);
	const [creating, setCreating] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [uploadStatus, setUploadStatus] = useState<string | null>(null);
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
		const toastId = showToast('loading', 'Registering merchant...', 'Preparing transaction');
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
			updateToast(toastId, { title: 'Confirming transaction...', message: getShortTxSignature(sig) });
			await connection.confirmTransaction(sig, 'confirmed');
			setErrorMsg(null);
			const acc = await fetchMerchant(connection, mpda);
			setMerchantAcc(acc);
			updateToast(toastId, { 
				type: 'success', 
				title: 'Merchant Registered Successfully!', 
				message: `Transaction: ${getShortTxSignature(sig)}`,
				txLink: getExplorerUrl(sig),
				duration: 10000 
			});
		} catch (e: any) {
			console.error('register merchant error', e);
			const errorMsg = parseContractError(e);
			setErrorMsg(errorMsg);
			updateToast(toastId, { type: 'error', title: 'Registration Failed', message: errorMsg, duration: 10000 });
		} finally {
			setLoading(false);
		}
	}, [publicKey, signTransaction, connection, programId, showToast, updateToast]);

	const onCreateCollection = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction) return;
		if (!merchantPda) return;
		setLoading(true);
		const toastId = showToast('loading', 'Creating collection NFT...', 'Uploading metadata');
		try {
			const name = String(formData.get('cname') || 'Merchant Collection');
			const symbol = String(formData.get('csymbol') || 'DEAL');
			const desc = String(formData.get('cdesc') || '');
			const imgFile = formData.get('cimage') as File | null;
			if (!imgFile) throw new Error('Image required');
			
			updateToast(toastId, { title: 'Uploading to Irys...', message: 'This may take a minute' });
			const { imageUri, jsonUri } = await uploadImageAndJson(umi, imgFile, { name, symbol, description: desc });
			
			updateToast(toastId, { title: 'Minting collection NFT...', message: 'Creating on-chain' });
			const collection = await mintCollection(umi, name, symbol, jsonUri);
			
			updateToast(toastId, { title: 'Linking collection to merchant...', message: 'Finalizing' });
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
			updateToast(toastId, { 
				type: 'success', 
				title: 'Collection Created Successfully!', 
				message: `Mint: ${collection.slice(0, 8)}...${collection.slice(-8)}`,
				txLink: getExplorerUrl(sig),
				duration: 10000 
			});
		} catch (e: any) {
			console.error('create collection error', e);
			const errorMsg = parseContractError(e);
			setErrorMsg(errorMsg);
			updateToast(toastId, { type: 'error', title: 'Collection Creation Failed', message: errorMsg, duration: 10000 });
		} finally {
			setLoading(false);
		}
	}, [publicKey, signTransaction, connection, programId, merchantPda, umi, showToast, updateToast]);

	const onCreate = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction || !programId) { 
			showToast('error', 'Wallet Not Connected', 'Please connect your wallet and try again');
			return;
		}
		setCreating(true);
		setUploadStatus(null);
		setErrorMsg(null);
		
		let toastId: string | null = null;
		
		try {
			// Check if merchant is registered
			toastId = showToast('loading', 'Checking merchant registration...');
			const merchantPda = deriveMerchantPda(programId, publicKey);
			const merchantAcc = await fetchMerchant(connection, merchantPda);
			if (!merchantAcc) {
				throw new Error('You must register as a merchant first! Please register above.');
			}
			
			// Auto-calculate next deal ID
			const dealId = BigInt(merchantAcc.total_deals + 1);
			updateToast(toastId, { title: `Creating Deal #${dealId}...`, message: 'Preparing upload' });
			
			const title = String(formData.get('title') || '');
			const description = String(formData.get('description') || '');
			const discount = Number(formData.get('discount') || 0);
			const total = Number(formData.get('total') || 1);
			const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400);
			const imageFile = formData.get('image') as File | null;
			
			if (!title) throw new Error('Title is required');
			if (!imageFile) throw new Error('NFT image is required');

			// Upload image and metadata
			updateToast(toastId, { title: 'Uploading to Irys/Arweave...', message: 'This may take a minute' });
			const uploadFormData = new FormData();
			uploadFormData.append('name', title);
			uploadFormData.append('description', description);
			uploadFormData.append('image', imageFile);
			
			const uploadRes = await fetch('/api/irys-upload', {
				method: 'POST',
				body: uploadFormData,
			});
			
			if (!uploadRes.ok) {
				const err = await uploadRes.json();
				throw new Error(`Upload failed: ${err.error || uploadRes.status}`);
			}
			
			const { imageUri, metadataUri } = await uploadRes.json();
			updateToast(toastId, { title: 'Upload complete!', message: 'Creating deal on-chain...' });

			const dealPda = deriveDealPda(programId, publicKey, dealId);
			const ix = ixCreateDeal(programId, publicKey, merchantPda, dealPda, {
				deal_id: dealId,
				title,
				description,
				discount_percent: discount,
				expiry,
				total_supply: total,
				image_uri: imageUri || '',
				metadata_uri: metadataUri,
			});
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' });
			
			updateToast(toastId, { title: 'Confirming transaction...', message: getShortTxSignature(sig) });
			await connection.confirmTransaction(sig, 'confirmed');
			
			// Refresh merchant account
			const updatedAcc = await fetchMerchant(connection, merchantPda);
			setMerchantAcc(updatedAcc);
			setErrorMsg(null);
			
			// Show success
			updateToast(toastId, { 
				type: 'success', 
				title: `Deal #${dealId} Created Successfully!`, 
				message: `Transaction: ${getShortTxSignature(sig)}`,
				txLink: getExplorerUrl(sig),
				duration: 10000 
			});
		} catch (e: any) {
			console.error('create deal error', e);
			const errorMsg = parseContractError(e);
			setErrorMsg(errorMsg);
			if (toastId) {
				updateToast(toastId, { type: 'error', title: 'Deal Creation Failed', message: errorMsg, duration: 10000 });
			} else {
				showToast('error', 'Deal Creation Failed', errorMsg);
			}
		} finally {
			setCreating(false);
			setUploadStatus(null);
		}
	}, [publicKey, signTransaction, connection, programId, showToast, updateToast]);

	return (
		<div className="space-y-8">
			<h2 className="text-xl font-semibold">Merchant Dashboard</h2>

			{errorMsg && (
				<div className="rounded border border-yellow-800 bg-yellow-950/50 text-yellow-200 px-3 py-2">{errorMsg}</div>
			)}
			{uploadStatus && (
				<div className="rounded border border-blue-800 bg-blue-950/50 text-blue-200 px-3 py-2 flex items-center gap-2">
					{uploadStatus.includes('...') && <span className="animate-pulse">●</span>}
					{uploadStatus}
				</div>
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
				<div className="font-medium">Create Collection (Optional)</div>
				<p className="text-sm text-neutral-400">Create a collection NFT for your merchant profile (optional feature)</p>
				<form action={onCreateCollection} className="space-y-3" encType="multipart/form-data">
					<input name="cname" placeholder="Collection Name" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
					<input name="csymbol" placeholder="Symbol" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
					<input name="cdesc" placeholder="Description" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
					<input name="cimage" type="file" accept="image/*" className="w-full text-sm" />
					<button disabled={loading} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{loading ? 'Minting…' : 'Create Collection'}</button>
				</form>
			</section>

			<form action={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-neutral-800 p-4">
				<div className="col-span-1 md:col-span-2">
					<div className="font-medium">Create Deal (Auto-Numbered)</div>
					<div className="text-xs text-neutral-400 mt-1">Deal ID will be automatically assigned based on your total deals. Image & metadata uploaded once and reused for all NFT mints.</div>
				</div>
				<label className="space-y-1">
					<span className="text-sm text-neutral-400">Title</span>
					<input name="title" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" placeholder="10% Off Pizza" required />
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
					<input name="total" type="number" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" defaultValue={100} />
				</label>
				<label className="space-y-1 col-span-1 md:col-span-2">
					<span className="text-sm text-neutral-400">NFT Image (Required - uploaded once for all mints)</span>
					<input name="image" type="file" accept="image/*" className="w-full text-sm" required />
				</label>
				<div className="col-span-1 md:col-span-2">
					<button disabled={creating} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{creating ? 'Creating & Uploading…' : 'Create Deal'}</button>
				</div>
			</form>

			{merchantAcc && (
				<section className="rounded-lg border border-green-800/50 bg-green-950/30 p-4">
					<div className="font-medium text-green-200">📊 Your Stats</div>
					<p className="text-sm text-green-300/80 mt-2">
						Total Deals Created: <span className="font-mono font-bold">{merchantAcc.total_deals}</span>
					</p>
					<p className="text-sm text-green-300/80 mt-1">
						View and mint NFTs on the <a href="/deals" className="underline font-medium">Deals page</a>
					</p>
				</section>
			)}
		</div>
	)
}
