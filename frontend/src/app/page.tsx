import Link from 'next/link'

export default function HomePage() {
	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-3xl font-bold mb-2">Web3 Deal Discovery Platform</h2>
				<p className="text-neutral-400">Discover deals, mint NFT coupons, and redeem them on Solana</p>
			</div>
			
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Link href="/merchant" className="rounded-lg border border-blue-800/50 bg-blue-950/30 p-6 hover:border-blue-600 transition-colors">
					<div className="text-xl font-medium text-blue-200 mb-2">🏪 For Merchants</div>
					<p className="text-neutral-400 text-sm">Register and create deals with NFT coupons (upload image once, reuse forever)</p>
				</Link>
				
				<Link href="/deals" className="rounded-lg border border-green-800/50 bg-green-950/30 p-6 hover:border-green-600 transition-colors">
					<div className="text-xl font-medium text-green-200 mb-2">🎁 For Users</div>
					<p className="text-neutral-400 text-sm">Browse deals and mint NFT coupons instantly (no upload, redeemable & transferable)</p>
				</Link>
				
				<Link href="/redeem" className="rounded-lg border border-purple-800/50 bg-purple-950/30 p-6 hover:border-purple-600 transition-colors">
					<div className="text-xl font-medium text-purple-200 mb-2">🎫 Redeem</div>
					<p className="text-neutral-400 text-sm">Redeem your NFT coupons for real-world savings</p>
				</Link>
			</div>

			<div className="rounded-lg border border-neutral-800 p-6 bg-neutral-900/50">
				<h3 className="text-lg font-medium mb-3">How It Works</h3>
				<ol className="space-y-2 text-sm text-neutral-400">
					<li><span className="text-neutral-200 font-medium">1.</span> Merchants register and create deals (upload NFT image once)</li>
					<li><span className="text-neutral-200 font-medium">2.</span> Users browse deals and mint NFT coupons (instant, reuses metadata)</li>
					<li><span className="text-neutral-200 font-medium">3.</span> NFTs are transferable - trade, gift, or sell them!</li>
					<li><span className="text-neutral-200 font-medium">4.</span> Redeem NFTs to claim your discount (burns the NFT)</li>
				</ol>
			</div>
		</div>
	)
}
