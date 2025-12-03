"use client";

import { createUmi } from '@metaplex-foundation/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { createBundlrUploader } from '@metaplex-foundation/umi-uploader-bundlr';
import { Connection } from '@solana/web3.js';
import { useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

export function useUmi() {
	const { connection } = useConnection();
	const wallet = useWallet();
	const umi = useMemo(() => {
		const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
		const u = createUmi(rpc).use(walletAdapterIdentity(wallet)).use(createBundlrUploader());
		return u;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [wallet.publicKey?.toBase58()]);
	return umi;
}
