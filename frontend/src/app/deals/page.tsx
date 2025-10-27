"use client";

import { useEffect, useMemo, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { fetchAllDeals, type DealAccount } from '@/lib/solana/instructions';
import Link from 'next/link';

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
						{deals.map(d => {
							const minted = d.account.minted as number;
							const totalSupply = d.account.total_supply as number;
							const isSoldOut = minted >= totalSupply;
							
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
										<div className="pt-2">
											<div className="text-xs text-blue-400 group-hover:text-blue-300 flex items-center gap-1">
												View Deal Details →
											</div>
										</div>
									</div>
								</Link>
							);
						})}
					</div>
				)}
			</section>
		</div>
	)
}
