"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader } from '@/components/Loader';

export default function HomePage() {
	const { connected } = useWallet();
	const router = useRouter();

	useEffect(() => {
		// Redirect to deals page if wallet is connected
		if (connected) {
			router.push('/deals');
		}
	}, [connected, router]);

	// Show loader if wallet is connected (during redirect)
	if (connected) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader size="lg" text="Redirecting to deals..." />
			</div>
		);
	}

	return (
		<div className="space-y-12">
			{/* Hero Section */}
			<div className="text-center space-y-6">
				<div className="text-6xl mb-4">🐵</div>
				<h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
					List My Deals
				</h1>
				<p className="text-2xl text-neutral-300 max-w-2xl mx-auto">
					Web3 Deal Discovery Platform
				</p>
				<p className="text-lg text-neutral-400 max-w-2xl mx-auto">
					Discover exclusive deals, mint NFT coupons, and redeem them on Solana
				</p>
				
				{/* CTA Button */}
				<div className="pt-4">
					<div className="inline-block rounded-lg border border-green-800/50 bg-green-950/30 px-6 py-3">
						<div className="text-green-200 font-medium mb-1">👆 Connect your wallet to get started</div>
						<div className="text-xs text-green-300/60">Click the button in the top-right corner</div>
					</div>
				</div>
			</div>
			
			{/* Features Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div className="rounded-lg border border-blue-800/50 bg-blue-950/30 p-6 hover:border-blue-600 transition-colors">
					<div className="text-4xl mb-4">🏪</div>
					<div className="text-xl font-medium text-blue-200 mb-2">For Merchants</div>
					<p className="text-neutral-400 text-sm">Register and create deals with NFT coupons. Upload image once, reuse forever for all mints.</p>
				</div>
				
				<div className="rounded-lg border border-green-800/50 bg-green-950/30 p-6 hover:border-green-600 transition-colors">
					<div className="text-4xl mb-4">🎁</div>
					<div className="text-xl font-medium text-green-200 mb-2">For Users</div>
					<p className="text-neutral-400 text-sm">Browse deals and mint NFT coupons instantly. No upload needed - redeemable and transferable!</p>
				</div>
				
				<div className="rounded-lg border border-purple-800/50 bg-purple-950/30 p-6 hover:border-purple-600 transition-colors">
					<div className="text-4xl mb-4">🎫</div>
					<div className="text-xl font-medium text-purple-200 mb-2">Redeem & Save</div>
					<p className="text-neutral-400 text-sm">Redeem your NFT coupons for real-world savings. Burns NFT on redemption for security.</p>
				</div>
			</div>

			{/* How It Works */}
			<div className="rounded-lg border border-neutral-800 p-8 bg-neutral-900/50">
				<h3 className="text-2xl font-bold mb-6 text-center">How It Works</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					<div className="text-center">
						<div className="w-16 h-16 rounded-full bg-blue-900/50 border border-blue-700 flex items-center justify-center mx-auto mb-3 text-2xl">
							1
						</div>
						<div className="font-medium text-blue-200 mb-2">Merchants Create</div>
						<p className="text-xs text-neutral-400">Register and create deals with NFT images</p>
					</div>
					
					<div className="text-center">
						<div className="w-16 h-16 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center mx-auto mb-3 text-2xl">
							2
						</div>
						<div className="font-medium text-green-200 mb-2">Users Browse</div>
						<p className="text-xs text-neutral-400">Discover deals and mint NFT coupons</p>
					</div>
					
					<div className="text-center">
						<div className="w-16 h-16 rounded-full bg-purple-900/50 border border-purple-700 flex items-center justify-center mx-auto mb-3 text-2xl">
							3
						</div>
						<div className="font-medium text-purple-200 mb-2">Transfer & Trade</div>
						<p className="text-xs text-neutral-400">NFTs are fully transferable - trade or gift them</p>
					</div>
					
					<div className="text-center">
						<div className="w-16 h-16 rounded-full bg-orange-900/50 border border-orange-700 flex items-center justify-center mx-auto mb-3 text-2xl">
							4
						</div>
						<div className="font-medium text-orange-200 mb-2">Redeem & Save</div>
						<p className="text-xs text-neutral-400">Claim your discount by burning the NFT</p>
					</div>
				</div>
			</div>

			{/* Features List */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="rounded-lg border border-neutral-800 p-6 bg-neutral-900/30">
					<h4 className="text-lg font-medium mb-4 text-neutral-200">✨ Key Features</h4>
					<ul className="space-y-3 text-sm text-neutral-400">
						<li className="flex items-start gap-2">
							<span className="text-green-400 mt-0.5">✓</span>
							<span>NFT coupons on Solana blockchain</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-green-400 mt-0.5">✓</span>
							<span>Instant minting with pre-uploaded metadata</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-green-400 mt-0.5">✓</span>
							<span>Fully transferable - trade or gift NFTs</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-green-400 mt-0.5">✓</span>
							<span>Secure redemption with NFT burning</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-green-400 mt-0.5">✓</span>
							<span>Decentralized storage on Arweave</span>
						</li>
					</ul>
				</div>

				<div className="rounded-lg border border-neutral-800 p-6 bg-neutral-900/30">
					<h4 className="text-lg font-medium mb-4 text-neutral-200">🎯 Why ListMyDeals?</h4>
					<ul className="space-y-3 text-sm text-neutral-400">
						<li className="flex items-start gap-2">
							<span className="text-blue-400 mt-0.5">→</span>
							<span>Own your coupons - truly yours, not platform-locked</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-blue-400 mt-0.5">→</span>
							<span>Trade value - sell unused coupons to others</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-blue-400 mt-0.5">→</span>
							<span>Transparent - verify everything on blockchain</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-blue-400 mt-0.5">→</span>
							<span>No middleman - direct merchant to user</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-blue-400 mt-0.5">→</span>
							<span>Lower fees - powered by Solana</span>
						</li>
					</ul>
				</div>
			</div>

			{/* Final CTA */}
			<div className="text-center py-8">
				<div className="rounded-lg border border-neutral-700 bg-gradient-to-r from-blue-950/30 via-purple-950/30 to-pink-950/30 p-8">
					<h3 className="text-3xl font-bold mb-4">Ready to Get Started?</h3>
					<p className="text-neutral-300 mb-6 max-w-xl mx-auto">
						Connect your Solana wallet to start browsing deals and minting NFT coupons
					</p>
					<div className="inline-flex items-center gap-2 text-neutral-400 text-sm">
						<span>👆</span>
						<span>Click the wallet button in the top-right corner</span>
					</div>
				</div>
			</div>
		</div>
	)
}
