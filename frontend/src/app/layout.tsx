import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { SolanaProviders } from '@/lib/solana/Providers'
import { ToastProvider } from '@/lib/toast/ToastContext'

export const metadata: Metadata = {
	title: 'Monke Deals',
	description: 'Web3 Deal Discovery & Loyalty Platform',
}

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<ToastProvider>
					<header className="border-b border-neutral-800">
						<div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
							<h1 className="font-semibold">Monke Deals</h1>
							<div>
								{/* Wallet button inside provider below */}
							</div>
						</div>
					</header>
					<SolanaProviders>
						<main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
					</SolanaProviders>
				</ToastProvider>
			</body>
		</html>
	)
}
