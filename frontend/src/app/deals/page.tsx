"use client";

import { useEffect, useMemo, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { fetchAllDeals, type DealAccount } from '@/lib/solana/instructions';
import Link from 'next/link';
import { DealCardSkeleton } from '@/components/Loader';

export default function DealsPage() {
	const { connection } = useConnection();
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

	const [deals, setDeals] = useState<Array<{ pubkey: string; account: DealAccount }>>([]);
	const [loading, setLoading] = useState(true);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active');

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

	// Separate deals into active and expired
	const { activeDeals, expiredDeals } = useMemo(() => {
		const active: Array<{ pubkey: string; account: DealAccount }> = [];
		const expired: Array<{ pubkey: string; account: DealAccount }> = [];
		const now = Math.floor(Date.now() / 1000); // Current time in seconds

		deals.forEach(d => {
			const expiry = typeof d.account.expiry === 'bigint' 
				? Number(d.account.expiry) 
				: Number(d.account.expiry);
			const isExpired = expiry < now;
			
			if (isExpired) {
				expired.push(d);
			} else {
				active.push(d);
			}
		});

		return { activeDeals: active, expiredDeals: expired };
	}, [deals]);

	const DealCard = ({ d }: { d: { pubkey: string; account: DealAccount } }) => {
		const minted = d.account.minted as number;
		const totalSupply = d.account.total_supply as number;
		const isSoldOut = minted >= totalSupply;
		const expiry = typeof d.account.expiry === 'bigint' ? Number(d.account.expiry) : Number(d.account.expiry);
		const expiryDate = new Date(expiry * 1000);
		const isExpired = expiry < Math.floor(Date.now() / 1000);
		
		return (
			<Link 
				key={d.pubkey} 
				href={`/deals/${d.pubkey}`}
				className="rounded-lg border border-neutral-800 overflow-hidden hover:border-neutral-600 hover:shadow-lg transition-all group"
			>
				{d.account.image_uri && (
					<div className="aspect-video w-full bg-neutral-900 relative overflow-hidden">
						<img 
							src={d.account.image_uri} 
							alt={d.account.title}
							className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
							onError={(e) => {
								e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23171717" width="400" height="300"/%3E%3Ctext fill="%23525252" font-family="system-ui" font-size="18" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EImage not available%3C/text%3E%3C/svg%3E';
							}}
						/>
						{isSoldOut && (
							<div className="absolute inset-0 bg-black/60 flex items-center justify-center">
								<div className="text-white font-bold text-xl">🔒 SOLD OUT</div>
							</div>
						)}
					</div>
				)}
				<div className="p-4 space-y-2">
					<div className="flex items-start justify-between gap-2">
						<div className="font-medium text-lg group-hover:text-white transition-colors">{d.account.title}</div>
						<div className="px-2 py-0.5 rounded bg-green-900/50 text-green-200 text-xs font-medium whitespace-nowrap">
							{d.account.discount_percent}% OFF
						</div>
					</div>
					<p className="text-sm text-neutral-400 line-clamp-2">{d.account.description}</p>
					<div className="flex items-center justify-between pt-2 border-t border-neutral-800">
						<div className="text-xs text-neutral-500">
							Deal <span className="font-mono">#{String(d.account.deal_id)}</span>
						</div>
						<div className={`text-sm font-medium ${isSoldOut ? 'text-red-400' : 'text-neutral-300'}`}>
							{d.account.minted}/{d.account.total_supply} minted
						</div>
					</div>
					<div className="pt-2 flex items-center justify-between gap-2">
						<div className="text-xs text-blue-400 group-hover:text-blue-300 flex items-center gap-1">
							View Deal Details →
						</div>
						<div className={`text-xs ${isExpired ? 'text-yellow-400' : 'text-neutral-500'}`}>
							🕒 {isExpired ? 'Expired' : `Expires ${expiryDate.toLocaleDateString()}`}
						</div>
					</div>
				</div>
			</Link>
		);
	};

	const renderDealGrid = (dealList: Array<{ pubkey: string; account: DealAccount }>) => {
		if (dealList.length === 0) {
			return (
				<div className="text-center py-12 border border-dashed border-neutral-800 rounded-lg">
					<div className="text-4xl mb-3">📭</div>
					<div className="text-lg font-medium text-neutral-300 mb-2">No Deals Found</div>
					<p className="text-sm text-neutral-500">Check back later for exciting deals!</p>
				</div>
			);
		}
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{dealList.map(d => <DealCard key={d.pubkey} d={d} />)}
			</div>
		);
	};

	return (
		<div className="space-y-8">
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

			{/* Tabs */}
			<div className="border-b border-neutral-800">
				<div className="flex items-center justify-between gap-4">
					<div className="flex gap-1">
					<button
						onClick={() => setActiveTab('active')}
						className={`px-6 py-3 font-medium text-sm transition-colors relative ${
							activeTab === 'active'
								? 'text-white'
								: 'text-neutral-400 hover:text-white'
						}`}
					>
						✨ Active Deals
						{activeTab === 'active' && (
							<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
						)}
						{activeDeals.length > 0 && (
							<span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
								activeTab === 'active' 
									? 'bg-purple-600 text-white' 
									: 'bg-neutral-800 text-neutral-400'
							}`}>
								{activeDeals.length}
							</span>
						)}
					</button>
					<button
						onClick={() => setActiveTab('expired')}
						className={`px-6 py-3 font-medium text-sm transition-colors relative ${
							activeTab === 'expired'
								? 'text-white'
								: 'text-neutral-400 hover:text-white'
						}`}
					>
						⏰ Expired Deals
						{activeTab === 'expired' && (
							<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-600" />
						)}
						{expiredDeals.length > 0 && (
							<span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
								activeTab === 'expired' 
									? 'bg-yellow-600 text-white' 
									: 'bg-neutral-800 text-neutral-400'
							}`}>
								{expiredDeals.length}
							</span>
						)}
					</button>
					</div>
					<button 
						onClick={async () => {
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
						}} 
						className="text-sm px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors shrink-0"
						disabled={loading}
					>
						{loading ? 'Refreshing...' : '🔄 Refresh'}
					</button>
				</div>
			</div>

			{/* Tab Content */}
			{loading ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<DealCardSkeleton />
					<DealCardSkeleton />
					<DealCardSkeleton />
					<DealCardSkeleton />
					<DealCardSkeleton />
					<DealCardSkeleton />
				</div>
			) : (
				<div className="rounded-lg border border-neutral-800 p-6">
					{activeTab === 'active' && (
						<div>
							<div className="mb-4">
								<p className="text-sm text-green-300/70">
									{activeDeals.length} {activeDeals.length === 1 ? 'deal' : 'deals'} available to mint
								</p>
							</div>
							{renderDealGrid(activeDeals)}
						</div>
					)}
					{activeTab === 'expired' && (
						<div>
							<div className="mb-4">
								<p className="text-sm text-yellow-300/70">
									{expiredDeals.length} {expiredDeals.length === 1 ? 'deal' : 'deals'} that have expired
								</p>
							</div>
							{renderDealGrid(expiredDeals)}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
