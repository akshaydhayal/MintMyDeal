"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveDealPda, deriveMerchantPda, fetchMerchant, ixCreateDeal, ixRegisterMerchant, type MerchantAccount } from '@/lib/solana/instructions';
import { useToast } from '@/lib/toast/ToastContext';
import { parseContractError, getShortTxSignature, getExplorerUrl } from '@/lib/solana/errors';

export default function MerchantPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const { showToast, updateToast } = useToast();
	const programId = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || ''), []);
	const [loading, setLoading] = useState(false);
	const [creating, setCreating] = useState(false);
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

	const onCreate = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction || !programId) { 
			showToast('error', 'Wallet Not Connected', 'Please connect your wallet and try again');
			return;
		}
		setCreating(true);
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
		}
	}, [publicKey, signTransaction, connection, programId, showToast, updateToast]);

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-3xl font-bold mb-2">Merchant Dashboard</h2>
				<p className="text-neutral-400">Create and manage your deals</p>
			</div>

			{errorMsg && (
				<div className="rounded border border-yellow-800 bg-yellow-950/50 text-yellow-200 px-3 py-2">{errorMsg}</div>
			)}

			{/* Merchant Profile Section - Show if registered */}
			{merchantAcc && (
				<section className="rounded-lg border border-blue-800/50 bg-blue-950/30 p-6">
					<div className="flex items-start justify-between mb-4">
						<div>
							<div className="text-xl font-bold text-blue-200 mb-1">🏪 {merchantAcc.name || 'Your Merchant Profile'}</div>
							<div className="text-sm text-blue-300/60">Registered Merchant</div>
						</div>
					</div>
					
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
						<div className="rounded-lg border border-blue-700/30 bg-blue-900/20 p-4">
							<div className="text-xs text-blue-300/60 mb-1">Merchant Name</div>
							<div className="font-medium text-blue-100">{merchantAcc.name || 'N/A'}</div>
						</div>
						
						<div className="rounded-lg border border-blue-700/30 bg-blue-900/20 p-4">
							<div className="text-xs text-blue-300/60 mb-1">Total Deals Created</div>
							<div className="font-bold text-2xl text-blue-100">{merchantAcc.total_deals}</div>
						</div>
						
						<div className="rounded-lg border border-blue-700/30 bg-blue-900/20 p-4">
							<div className="text-xs text-blue-300/60 mb-1">Website</div>
							{merchantAcc.uri ? (
								<a href={merchantAcc.uri} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline text-sm break-all">
									{merchantAcc.uri}
								</a>
							) : (
								<div className="text-blue-300/40 text-sm">Not provided</div>
							)}
						</div>
					</div>
					
					<div className="mt-4 pt-4 border-t border-blue-800/30">
						<div className="text-xs text-blue-300/60 mb-1">Wallet Address</div>
						<div className="font-mono text-xs text-blue-200 break-all">{new PublicKey(merchantAcc.merchant).toBase58()}</div>
					</div>
				</section>
			)}

			{/* Registration Form - Show only if NOT registered */}
			{!merchantAcc && (
				<section className="rounded-lg border border-green-800/50 bg-green-950/30 p-6">
					<div className="mb-4">
						<div className="text-xl font-bold text-green-200 mb-2">🚀 Register as Merchant</div>
						<p className="text-sm text-green-300/70">Start creating deals by registering your merchant account</p>
					</div>
					<form action={onRegister} className="space-y-4">
						<label className="space-y-2">
							<span className="text-sm text-green-300">Merchant Name <span className="text-red-400">*</span></span>
							<input 
								name="name" 
								placeholder="My Amazing Store" 
								className="w-full bg-neutral-900 border border-green-800 rounded px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-600" 
								required
							/>
						</label>
						<label className="space-y-2">
							<span className="text-sm text-green-300">Website URL (Optional)</span>
							<input 
								name="uri" 
								placeholder="https://mystore.com" 
								className="w-full bg-neutral-900 border border-green-800 rounded px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-600" 
							/>
						</label>
						<button 
							disabled={loading} 
							className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{loading ? 'Registering…' : '✓ Register Merchant'}
						</button>
					</form>
				</section>
			)}

			{/* Create Deal Section - Show only if registered */}
			{merchantAcc ? (
				<section className="rounded-lg border border-purple-800/50 bg-purple-950/30 p-6">
					<div className="mb-4">
						<div className="text-xl font-bold text-purple-200 mb-2">🎁 Create New Deal</div>
						<p className="text-sm text-purple-300/70">
							Your next deal will be <span className="font-mono font-bold text-purple-200">Deal #{merchantAcc.total_deals + 1}</span>
						</p>
						<p className="text-xs text-purple-300/50 mt-1">Image & metadata uploaded once and reused for all NFT mints</p>
					</div>
					<form action={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<label className="space-y-2">
							<span className="text-sm text-purple-300">Deal Title <span className="text-red-400">*</span></span>
							<input 
								name="title" 
								className="w-full bg-neutral-900 border border-purple-800 rounded px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-600" 
								placeholder="10% Off Pizza" 
								required 
							/>
						</label>
						<label className="space-y-2">
							<span className="text-sm text-purple-300">Description</span>
							<input 
								name="description" 
								className="w-full bg-neutral-900 border border-purple-800 rounded px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-600" 
								placeholder="Save on your next purchase" 
							/>
						</label>
						<label className="space-y-2">
							<span className="text-sm text-purple-300">Discount % <span className="text-red-400">*</span></span>
							<input 
								name="discount" 
								type="number" 
								min="1" 
								max="100" 
								className="w-full bg-neutral-900 border border-purple-800 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-600" 
								defaultValue={10} 
								required
							/>
						</label>
						<label className="space-y-2">
							<span className="text-sm text-purple-300">Total Supply (NFTs) <span className="text-red-400">*</span></span>
							<input 
								name="total" 
								type="number" 
								min="1" 
								className="w-full bg-neutral-900 border border-purple-800 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-600" 
								defaultValue={100} 
								required
							/>
						</label>
						<label className="space-y-2 col-span-1 md:col-span-2">
							<span className="text-sm text-purple-300">NFT Image <span className="text-red-400">*</span></span>
							<div className="text-xs text-purple-300/50 mb-1">Uploaded once for all mints - choose wisely!</div>
							<input 
								name="image" 
								type="file" 
								accept="image/*" 
								className="w-full text-sm text-purple-200 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-purple-800 file:text-purple-100 hover:file:bg-purple-700 file:cursor-pointer" 
								required 
							/>
						</label>
						<div className="col-span-1 md:col-span-2">
							<button 
								disabled={creating} 
								className="w-full px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								{creating ? '⏳ Creating & Uploading…' : '🎁 Create Deal'}
							</button>
						</div>
					</form>
				</section>
			) : (
				<section className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-6 text-center">
					<div className="text-4xl mb-3">🔒</div>
					<div className="text-lg font-medium text-neutral-300 mb-2">Register to Create Deals</div>
					<p className="text-sm text-neutral-400">
						You need to register as a merchant before you can create deals. Please fill out the registration form above.
					</p>
				</section>
			)}

			{/* Quick Actions - Show if registered */}
			{merchantAcc && (
				<section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
					<div className="text-lg font-medium mb-4">Quick Actions</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<a 
							href="/deals" 
							className="flex items-center gap-3 p-4 rounded-lg border border-neutral-700 hover:border-neutral-600 transition-colors group"
						>
							<div className="text-2xl">📋</div>
							<div>
								<div className="font-medium group-hover:text-white transition-colors">View All Deals</div>
								<div className="text-xs text-neutral-500">Browse and manage your deals</div>
							</div>
						</a>
						<a 
							href="/deals" 
							className="flex items-center gap-3 p-4 rounded-lg border border-neutral-700 hover:border-neutral-600 transition-colors group"
						>
							<div className="text-2xl">🎨</div>
							<div>
								<div className="font-medium group-hover:text-white transition-colors">See NFTs Minted</div>
								<div className="text-xs text-neutral-500">Check how many NFTs users have minted</div>
							</div>
						</a>
					</div>
				</section>
			)}
		</div>
	)
}
