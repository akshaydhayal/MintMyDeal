"use client";

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { bundlrUploader } from '@metaplex-foundation/umi-uploader-bundlr';
import { useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

export function useUmi() {
	const { connection } = useConnection();
	const wallet = useWallet();
	const umi = useMemo(() => {
		const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
		let u = createUmi(rpc).use(bundlrUploader());
		if (wallet && wallet.publicKey) {
			u = u.use(walletAdapterIdentity(wallet));
		}
		return u;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [wallet.publicKey?.toBase58()]);
	return umi;
}
