import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { SolanaProviders } from '@/lib/solana/Providers'
import { ToastProvider } from '@/lib/toast/ToastContext'
import { Navbar } from '@/components/Navbar'

export const metadata: Metadata = {
	title: 'Mint My Deals',
	description: 'Web3 Deal Discovery & Loyalty Platform',
}

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<ToastProvider>
					<SolanaProviders>
						<Navbar />
						<main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
					</SolanaProviders>
				</ToastProvider>
			</body>
		</html>
	)
}
