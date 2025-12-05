"use client";

import { useCallback, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { deriveRedeemPda, ixRedeem } from '@/lib/solana/instructions';
import { useToast } from '@/lib/toast/ToastContext';
import { parseContractError, getShortTxSignature, getExplorerUrl } from '@/lib/solana/errors';

export default function RedeemPage() {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const { showToast, updateToast } = useToast();
	const programId = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || ''), []);
	const [loading, setLoading] = useState(false);

	const onRedeem = useCallback(async (formData: FormData) => {
		if (!publicKey || !signTransaction) {
			showToast('error', 'Wallet Not Connected', 'Please connect your wallet');
			return;
		}
		setLoading(true);
		const toastId = showToast('loading', 'Redeeming NFT coupon...', 'Burning NFT and creating log');
		try {
			const mintStr = String(formData.get('mint') || '');
			if (!mintStr) throw new Error('Please enter a mint address');
			const mint = new PublicKey(mintStr);
			const redeemPda = deriveRedeemPda(programId, mint);
			const ix = ixRedeem(programId, publicKey, redeemPda, mint);
			const tx = new Transaction().add(ix);
			tx.feePayer = publicKey;
			tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
			const signed = await signTransaction(tx);
			const sig = await connection.sendRawTransaction(signed.serialize());
			updateToast(toastId, { title: 'Confirming transaction...', message: getShortTxSignature(sig) });
			await connection.confirmTransaction(sig, 'confirmed');
			updateToast(toastId, { 
				type: 'success', 
				title: 'NFT Redeemed Successfully!', 
				message: `Transaction: ${getShortTxSignature(sig)}`,
				txLink: getExplorerUrl(sig),
				duration: 10000 
			});
		} catch (e: any) {
			console.error('redeem error', e);
			const errorMsg = parseContractError(e);
			updateToast(toastId, { type: 'error', title: 'Redemption Failed', message: errorMsg, duration: 10000 });
		} finally {
			setLoading(false);
		}
	}, [publicKey, signTransaction, connection, programId, showToast, updateToast]);

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
