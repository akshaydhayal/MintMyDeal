"use client";

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { publicKey } from '@metaplex-foundation/umi';

import { useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

export function useUmi() {
	const { connection } = useConnection();
	const wallet = useWallet();
	const umi = useMemo(() => {
		const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
		let u = createUmi(rpc).use(mplCore());
		
		// Register SPL Token programs
		const splTokenPubkey = publicKey(TOKEN_PROGRAM_ID.toBase58());
		const splAssociatedTokenPubkey = publicKey(ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());
		
		u.programs.add({
			name: 'splToken',
			publicKey: splTokenPubkey,
			isOnCluster: () => true,
			getErrorFromCode: () => null,
			getErrorFromName: () => null,
		} as any);
		
		u.programs.add({
			name: 'splAssociatedToken',
			publicKey: splAssociatedTokenPubkey,
			isOnCluster: () => true,
			getErrorFromCode: () => null,
			getErrorFromName: () => null,
		} as any);
		
		if (wallet && wallet.publicKey) {
			u = u.use(walletAdapterIdentity(wallet));
		}
		return u;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [wallet.publicKey?.toBase58()]);
	return umi;
}
