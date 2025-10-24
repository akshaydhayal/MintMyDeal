import Link from 'next/link'

export default function HomePage() {
	return (
		<div className="space-y-6">
			<h2 className="text-2xl font-semibold">Discover and Redeem Deals</h2>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Link href="/deals" className="rounded-lg border border-neutral-800 p-4 hover:border-neutral-600">
					<div className="text-lg font-medium">Browse Deals</div>
					<p className="text-neutral-400">See on-chain deals and mint coupons.</p>
				</Link>
				<Link href="/merchant" className="rounded-lg border border-neutral-800 p-4 hover:border-neutral-600">
					<div className="text-lg font-medium">Merchant Dashboard</div>
					<p className="text-neutral-400">Register and create deals.</p>
				</Link>
			</div>
		</div>
	)
}
