"use client";

import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function Navbar() {
	return (
		<header className="border-b border-neutral-800 bg-black sticky top-0 z-50">
			<div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
				<div className="flex items-center gap-8">
					<Link href="/" className="font-bold text-xl hover:text-neutral-300 transition-colors">
						🐵 Monke Deals
					</Link>
					<nav className="hidden md:flex items-center gap-6">
						<Link href="/deals" className="text-sm text-neutral-400 hover:text-white transition-colors">
							Browse Deals
						</Link>
						<Link href="/marketplace" className="text-sm text-neutral-400 hover:text-white transition-colors">
							🛒 Marketplace
						</Link>
						<Link href="/merchant" className="text-sm text-neutral-400 hover:text-white transition-colors">
							Merchant Dashboard
						</Link>
						<Link href="/redeem" className="text-sm text-neutral-400 hover:text-white transition-colors">
							Redeem NFT
						</Link>
					</nav>
				</div>
				<div>
					<WalletMultiButton />
				</div>
			</div>
		</header>
	);
}

