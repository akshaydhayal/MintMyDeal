"use client";

import { ReactNode, useMemo } from 'react';
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

import '@solana/wallet-adapter-react-ui/styles.css';

export function SolanaProviders({ children }: { children: ReactNode }) {
	const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl('devnet');
	const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
	return (
		<ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
			<WalletProvider wallets={wallets} autoConnect>
				<WalletModalProvider>
					<div className="max-w-5xl mx-auto px-4 py-3 flex justify-end"><WalletMultiButton /></div>
					{children}
				</WalletModalProvider>
			</WalletProvider>
		</ConnectionProvider>
	);
}
