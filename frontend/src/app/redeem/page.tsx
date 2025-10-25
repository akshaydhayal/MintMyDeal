"use client";

import { useCallback, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { deriveRedeemPda, ixRedeem } from '@/lib/solana/instructions';

export default function RedeemPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const programId = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || ''), []);
	const [loading, setLoading] = useState(false);

	const onRedeem = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction) return;
		setLoading(true);
		try {
			const mintStr = String(formData.get('mint') || '');
			const mint = mintStr ? new PublicKey(mintStr) : Keypair.generate().publicKey;
			const redeemPda = deriveRedeemPda(programId, mint);
			const ix = ixRedeem(programId, publicKey, redeemPda, mint);
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			await connection.confirmTransaction(sig, 'confirmed');
			alert(`Redeemed (log): ${sig}`);
		} finally {
			setLoading(false);
		}
	}, [publicKey, signTransaction, connection, programId]);

	return (
		<div className="space-y-6">
			<h2 className="text-xl font-semibold">Redeem Coupon</h2>
			<form action={onRedeem} className="rounded-lg border border-neutral-800 p-4 space-y-3">
				<input name="mint" placeholder="Mint address (optional)" className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
				<button disabled={loading} className="px-3 py-1.5 rounded bg-white text-black disabled:opacity-50">{loading ? 'Redeeming…' : 'Redeem'}</button>
			</form>
		</div>
	)
}
