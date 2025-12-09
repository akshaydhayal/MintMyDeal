"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { deriveDealPda, deriveMerchantPda, fetchMerchant, fetchAllDeals, ixCreateDeal, ixRegisterMerchant, type MerchantAccount, type DealAccount } from '@/lib/solana/instructions';
import { useToast } from '@/lib/toast/ToastContext';
import { parseContractError, getShortTxSignature, getExplorerUrl } from '@/lib/solana/errors';
import Link from 'next/link';
import { DealCardSkeleton, Loader } from '@/components/Loader';

export default function MerchantPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const { showToast, updateToast } = useToast();
	const programId = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || ''), []);
	const [loading, setLoading] = useState(false);
	const [creating, setCreating] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [merchantAcc, setMerchantAcc] = useState<MerchantAccount | null>(null);
	const [merchantDeals, setMerchantDeals] = useState<Array<{ pubkey: string; deal: DealAccount }>>([]);
	const [loadingDeals, setLoadingDeals] = useState(false);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [uploadStatus, setUploadStatus] = useState<string | null>(null);

	// Use refs to prevent duplicate transaction execution (atomic check)
	const isRegisteringRef = useRef(false);
	const isCreatingRef = useRef(false);

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

	// Fetch all deals created by this merchant
	const fetchMerchantDeals = useCallback(async () => {
		if (!publicKey || !programId) return;
		setLoadingDeals(true);
		try {
			// Fetch all deals using the helper function
			const allDeals = await fetchAllDeals(connection, programId);
			
			// Filter to only show deals from this merchant
			const merchantDealsFiltered = allDeals.filter(d => {
				const merchantPubkey = new PublicKey(d.account.merchant);
				return merchantPubkey.equals(publicKey);
			});
			
			// Sort by deal_id descending (newest first)
			merchantDealsFiltered.sort((a, b) => Number(b.account.deal_id - a.account.deal_id));
			
			// Convert to the format we need
			const deals = merchantDealsFiltered.map(d => ({
				pubkey: d.pubkey.toBase58(),
				deal: d.account
			}));
			
			console.log('Merchant deals fetched:', deals.length);
			setMerchantDeals(deals);
		} catch (e: any) {
			console.error('fetch merchant deals error', e);
		} finally {
			setLoadingDeals(false);
		}
	}, [connection, programId, publicKey]);

	useEffect(() => {
		if (merchantAcc && publicKey) {
			fetchMerchantDeals();
		}
	}, [merchantAcc, publicKey, fetchMerchantDeals]);

	const onRegister = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction) return;
		// Atomic check: prevent duplicate submissions using ref (doesn't depend on re-render)
		if (isRegisteringRef.current) return;
		isRegisteringRef.current = true;
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
			isRegisteringRef.current = false;
		}
	}, [publicKey, signTransaction, connection, programId, showToast, updateToast]);

	const onCreate = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction || !programId) { 
			showToast('error', 'Wallet Not Connected', 'Please connect your wallet and try again');
			return;
		}
		// Atomic check: prevent duplicate submissions using ref (doesn't depend on re-render)
		if (isCreatingRef.current) return;
		isCreatingRef.current = true;
		setCreating(true);
		setErrorMsg(null);
		setUploadStatus(null);
		
		let toastId: string | null = null;
		
		try {
			// Check if merchant is registered
			setUploadStatus('Checking merchant registration...');
			toastId = showToast('loading', 'Checking merchant registration...');
			const merchantPda = deriveMerchantPda(programId, publicKey);
			const merchantAcc = await fetchMerchant(connection, merchantPda);
			if (!merchantAcc) {
				throw new Error('You must register as a merchant first! Please register above.');
			}
			
			// Auto-calculate next deal ID
			const dealId = BigInt(merchantAcc.total_deals + 1);
			setUploadStatus('Preparing deal...');
			updateToast(toastId, { title: `Creating Deal #${dealId}...`, message: 'Preparing upload' });
			
			const title = String(formData.get('title') || '');
			const description = String(formData.get('description') || '');
			const discount = Number(formData.get('discount') || 0);
			const total = Number(formData.get('total') || 1);
			const expiryInput = String(formData.get('expiry') || '');
			const imageFile = formData.get('image') as File | null;
			
			if (!expiryInput) throw new Error('Expiry date is required');
			
			// Convert datetime-local input to Unix timestamp (seconds)
			const expiryDate = new Date(expiryInput);
			if (isNaN(expiryDate.getTime())) throw new Error('Invalid expiry date');
			
			// Check if expiry is in the future
			if (expiryDate.getTime() <= Date.now()) {
				throw new Error('Expiry date must be in the future');
			}
			
			const expiry = BigInt(Math.floor(expiryDate.getTime() / 1000));
			
			if (!title) throw new Error('Title is required');
			if (!imageFile) throw new Error('NFT image is required');

			// Upload image
			setUploadStatus('⏳ Uploading image...');
			updateToast(toastId, { title: 'Uploading image to Irys...', message: 'Uploading to Arweave (permanent storage)' });
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
			console.log('✅ Image uploaded:', imageUri);
			console.log('✅ Metadata uploaded:', metadataUri);
			
			// Show image uploaded
			setUploadStatus('✅ Image uploaded successfully!');
			await new Promise(resolve => setTimeout(resolve, 800));
			
			// Show metadata uploaded
			setUploadStatus('✅ Metadata uploaded successfully!');
			await new Promise(resolve => setTimeout(resolve, 800));
			
			// Show success message for uploads
			updateToast(toastId, { 
				type: 'success', 
				title: '✅ Upload Complete!', 
				message: `Image & metadata uploaded successfully`,
				duration: 3000
			});
			
			// Wait a moment to show the success message, then continue
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			// Create a new toast for the transaction
			setUploadStatus('Creating deal on blockchain...');
			toastId = showToast('loading', 'Creating deal on-chain...', 'Preparing transaction');

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
			
			setUploadStatus('Confirming transaction...');
			updateToast(toastId, { title: 'Confirming transaction...', message: getShortTxSignature(sig) });
			await connection.confirmTransaction(sig, 'confirmed');
			
			// Refresh merchant account and deals list
			setUploadStatus('Finalizing...');
			const updatedAcc = await fetchMerchant(connection, merchantPda);
			setMerchantAcc(updatedAcc);
			await fetchMerchantDeals();
			setErrorMsg(null);
			
			// Close modal and show success
			setShowCreateModal(false);
			setUploadStatus(null);
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
			setUploadStatus(null);
			if (toastId) {
				updateToast(toastId, { type: 'error', title: 'Deal Creation Failed', message: errorMsg, duration: 10000 });
			} else {
				showToast('error', 'Deal Creation Failed', errorMsg);
			}
		} finally {
			setCreating(false);
			isCreatingRef.current = false;
		}
	}, [publicKey, signTransaction, connection, programId, showToast, updateToast, fetchMerchantDeals]);

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-3xl font-bold mb-2">Merchant Dashboard</h2>
				<p className="text-neutral-400">Create and manage your deals</p>
			</div>

			{errorMsg && (
				<div className="rounded border border-yellow-800 bg-yellow-950/50 text-yellow-200 px-3 py-2">{errorMsg}</div>
			)}

			{/* Merchant Profile & Actions Section - Show if registered */}
			{merchantAcc && (
				<section className="rounded-lg border border-blue-800/50 bg-gradient-to-br from-blue-950/40 to-purple-950/40 overflow-hidden">
					{/* Header with gradient background */}
					<div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 p-6 border-b border-blue-800/30">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<div className="w-16 h-16 rounded-full bg-blue-900/50 border-2 border-blue-600 flex items-center justify-center text-3xl">
									🏪
								</div>
								<div>
									<div className="text-2xl font-bold text-blue-100 mb-1">{merchantAcc.name || 'Your Merchant Profile'}</div>
									<div className="flex items-center gap-3 text-sm">
										<span className="px-2 py-1 rounded-full bg-green-900/30 border border-green-700/50 text-green-300 text-xs font-medium">
											✓ Verified Merchant
										</span>
										<span className="text-blue-300/60">•</span>
										<span className="text-blue-300/70">{merchantAcc.total_deals} {merchantAcc.total_deals === 1 ? 'Deal' : 'Deals'} Created</span>
									</div>
								</div>
							</div>
						<button 
							onClick={() => setShowCreateModal(true)}
							disabled={creating}
							className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
						>
							{creating ? (
								<>
									<div className="animate-spin text-lg">⏳</div>
									<span>Creating...</span>
								</>
							) : (
								<>
									<span className="text-xl">+</span>
									<span>Create Deal</span>
								</>
							)}
						</button>
						</div>
					</div>
					
					{/* Info Grid - Compact */}
					<div className="p-6">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* Website */}
							{merchantAcc.uri && (
								<div className="flex items-center gap-3 p-3 rounded-lg bg-blue-900/20 border border-blue-800/30">
									<div className="text-2xl">🌐</div>
									<div className="flex-1 min-w-0">
										<div className="text-xs text-blue-300/60 mb-0.5">Website</div>
										<a 
											href={merchantAcc.uri} 
											target="_blank" 
											rel="noopener noreferrer" 
											className="text-blue-300 hover:text-blue-200 underline text-sm truncate block"
										>
											{merchantAcc.uri.replace(/^https?:\/\//, '')}
										</a>
									</div>
								</div>
							)}
							
							{/* Wallet Address */}
							<div className="flex items-center gap-3 p-3 rounded-lg bg-blue-900/20 border border-blue-800/30">
								<div className="text-2xl">👛</div>
								<div className="flex-1 min-w-0">
									<div className="text-xs text-blue-300/60 mb-0.5">Wallet</div>
									<div className="font-mono text-xs text-blue-200 truncate">
										{new PublicKey(merchantAcc.merchant).toBase58()}
									</div>
								</div>
							</div>
						</div>
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


			{/* My Deals Section - Show if registered */}
			{merchantAcc && (
				<section className="rounded-lg border border-cyan-800/50 bg-cyan-950/30 p-6">
					<div className="flex items-center justify-between mb-4">
						<div>
							<div className="text-xl font-bold text-cyan-200 mb-1">📦 My Deals</div>
							<p className="text-sm text-cyan-300/70">All deals you've created</p>
						</div>
						<button 
							onClick={fetchMerchantDeals}
							disabled={loadingDeals}
							className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
						>
							{loadingDeals ? '⏳' : '🔄'} Refresh
						</button>
					</div>

					{loadingDeals ? (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							<DealCardSkeleton />
							<DealCardSkeleton />
							<DealCardSkeleton />
						</div>
					) : merchantDeals.length === 0 ? (
						<div className="text-center py-12 border border-dashed border-cyan-800/50 rounded-lg">
							<div className="text-4xl mb-3">📭</div>
							<div className="text-lg font-medium text-cyan-300 mb-2">No Deals Created Yet</div>
							<p className="text-sm text-cyan-300/60">
								Create your first deal above to get started!
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{merchantDeals.map(({ pubkey, deal }) => {
								const minted = typeof deal.minted === 'bigint' ? deal.minted : BigInt(deal.minted);
								const totalSupply = typeof deal.total_supply === 'bigint' ? deal.total_supply : BigInt(deal.total_supply);
								const expiry = typeof deal.expiry === 'bigint' ? deal.expiry : BigInt(deal.expiry);
								const discountPercent = typeof deal.discount_percent === 'bigint' ? deal.discount_percent : BigInt(deal.discount_percent);
								
								const isExpired = Number(expiry) * 1000 < Date.now();
								const isSoldOut = minted >= totalSupply;
								const progress = totalSupply > 0 ? Number((minted * BigInt(100)) / totalSupply) : 0;

								return (
									<Link 
										key={pubkey}
										href={`/deals/${pubkey}`}
										className="group relative rounded-lg border border-cyan-800/50 bg-cyan-950/20 overflow-hidden hover:border-cyan-600 transition-all"
									>
										{/* Deal Image */}
										<div className="relative aspect-video bg-neutral-900">
											{deal.image_uri ? (
												<img 
													src={deal.image_uri} 
													alt={deal.title}
													className="w-full h-full object-cover"
													onError={(e) => {
														const target = e.target as HTMLImageElement;
														target.style.display = 'none';
														target.nextElementSibling?.classList.remove('hidden');
													}}
												/>
											) : null}
											<div className={`${deal.image_uri ? 'hidden' : ''} absolute inset-0 flex items-center justify-center text-6xl`}>
												🎁
											</div>
											
											{/* Status Badge */}
											{isSoldOut ? (
												<div className="absolute top-2 right-2 px-2 py-1 rounded bg-red-600 text-white text-xs font-bold">
													SOLD OUT
												</div>
											) : isExpired ? (
												<div className="absolute top-2 right-2 px-2 py-1 rounded bg-yellow-600 text-white text-xs font-bold">
													EXPIRED
												</div>
											) : null}
										</div>

										{/* Deal Info */}
										<div className="p-4">
											<div className="flex items-start justify-between mb-2">
												<div className="flex-1 min-w-0">
													<div className="font-bold text-cyan-100 group-hover:text-cyan-200 transition-colors truncate">
														{deal.title}
													</div>
													<div className="text-xs text-cyan-300/50 font-mono">
														Deal #{deal.deal_id.toString()}
													</div>
												</div>
												<div className="ml-2 px-2 py-1 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">
													{Number(discountPercent)}% OFF
												</div>
											</div>

											{deal.description && (
												<p className="text-sm text-cyan-300/70 mb-3 line-clamp-2">
													{deal.description}
												</p>
											)}

											{/* Progress Bar */}
											<div className="space-y-1 mb-3">
												<div className="flex justify-between text-xs text-cyan-300/60">
													<span>{Number(minted)} minted</span>
													<span>{Number(totalSupply)} total</span>
												</div>
												<div className="h-2 bg-cyan-950 rounded-full overflow-hidden">
													<div 
														className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all"
														style={{ width: `${progress}%` }}
													/>
												</div>
											</div>

											{/* Expiry Info */}
											<div className="text-xs text-cyan-300/50">
												{isExpired ? (
													<span className="text-yellow-400">⚠️ Expired</span>
												) : (
													<span>
														🕒 Expires {new Date(Number(expiry) * 1000).toLocaleDateString()}
													</span>
												)}
											</div>
										</div>

										{/* Hover Arrow */}
										<div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400">
											→
										</div>
									</Link>
								);
							})}
						</div>
					)}
				</section>
			)}

			{/* Create Deal Modal */}
			{showCreateModal && merchantAcc && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
					<div className="relative bg-neutral-900 rounded-lg border border-purple-800/50 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						{/* Modal Header */}
						<div className="sticky top-0 bg-neutral-900 border-b border-purple-800/50 p-6 py-2 flex items-center justify-between z-10">
							<div>
								<div className="text-2xl font-bold text-purple-200 mb-1">🎁 Create New Deal</div>
								<p className="text-sm text-purple-300/70">
									Your next deal will be <span className="font-mono font-bold text-purple-200">Deal #{merchantAcc.total_deals + 1}</span>
								</p>
								<p className="text-xs text-purple-300/50 mt-1">Image & metadata uploaded once and reused for all NFT mints</p>
							</div>
							<button 
								onClick={() => setShowCreateModal(false)}
								className="text-neutral-400 hover:text-white transition-colors text-2xl leading-none"
								disabled={creating}
							>
								×
							</button>
						</div>

						{/* Modal Body */}
						<div className="p-6 py-1">
							<form action={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<label className="space-y-2">
									<span className="text-sm text-purple-300">Deal Title <span className="text-red-400">*</span></span>
									<input 
										name="title" 
										className="w-full bg-neutral-800 border border-purple-800 rounded px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-600" 
										placeholder="10% Off Pizza" 
										required 
										disabled={creating}
									/>
								</label>
								<label className="space-y-2">
									<span className="text-sm text-purple-300">Description</span>
									<input 
										name="description" 
										className="w-full bg-neutral-800 border border-purple-800 rounded px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-600" 
										placeholder="Save on your next purchase" 
										disabled={creating}
									/>
								</label>
								<label className="space-y-2">
									<span className="text-sm text-purple-300">Discount % <span className="text-red-400">*</span></span>
									<input 
										name="discount" 
										type="number" 
										min="1" 
										max="100" 
										className="w-full bg-neutral-800 border border-purple-800 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-600" 
										defaultValue={10} 
										required
										disabled={creating}
									/>
								</label>
								<label className="space-y-2">
									<span className="text-sm text-purple-300">Total Supply (NFTs) <span className="text-red-400">*</span></span>
									<input 
										name="total" 
										type="number" 
										min="1" 
										className="w-full bg-neutral-800 border border-purple-800 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-600" 
										defaultValue={100} 
										required
										disabled={creating}
									/>
								</label>
								<label className="space-y-2">
									<span className="text-sm text-purple-300">Expiry Date & Time <span className="text-red-400">*</span></span>
									<input 
										name="expiry" 
										type="datetime-local" 
										className="w-full bg-neutral-800 border border-purple-800 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-600 disabled:opacity-50" 
										required
										disabled={creating}
										min={new Date().toISOString().slice(0, 16)}
									/>
									<div className="text-xs text-purple-300/50 mt-1">
										Select when this deal should expire. Users won't be able to mint after this date.
									</div>
								</label>
								<label className="space-y-2 col-span-1 md:col-span-2">
									<span className="text-sm text-purple-300">NFT Image <span className="text-red-400">*</span></span>
									<div className="text-xs text-purple-300/50 mb-1">Uploaded once for all mints - choose wisely!</div>
									<input 
										name="image" 
										type="file" 
										accept="image/*" 
										className="w-full text-sm text-purple-200 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-purple-800 file:text-purple-100 hover:file:bg-purple-700 file:cursor-pointer disabled:opacity-50" 
										required 
										disabled={creating}
									/>
								</label>
								
								{/* Upload Status Display */}
								{uploadStatus && (
									<div className="col-span-1 md:col-span-2">
										<div className="rounded-lg border border-purple-700/50 bg-purple-900/20 p-4">
											<div className="flex items-center gap-3">
												{uploadStatus.includes('✅') ? (
													<div className="text-2xl">✅</div>
												) : (
													<div className="text-2xl animate-spin">⏳</div>
												)}
												<div className="flex-1">
													<div className={`text-sm font-medium ${uploadStatus.includes('✅') ? 'text-green-300' : 'text-purple-200'}`}>
														{uploadStatus}
													</div>
												</div>
											</div>
										</div>
									</div>
								)}
								
								<div className="col-span-1 md:col-span-2 flex gap-3">
									<button 
										type="button"
										onClick={() => setShowCreateModal(false)}
										disabled={creating}
										className="flex-1 px-4 py-3 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
									>
										Cancel
									</button>
									<button 
										type="submit"
										disabled={creating} 
										className="flex-1 px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
									>
										{creating ? (
											<>
												<div className="animate-spin">⏳</div>
												<span>Creating Deal...</span>
											</>
										) : (
											<>
												<span>🎁</span>
												<span>Create Deal</span>
											</>
										)}
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
