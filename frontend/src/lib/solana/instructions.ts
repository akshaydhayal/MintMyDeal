import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import * as borsh from 'borsh';

const IX = {
	RegisterMerchant: 0,
	CreateDeal: 1,
	MintCoupon: 2,
	RedeemCoupon: 3,
	AddReview: 4,
} as const;

const schemas = {
	RegisterMerchantArgs: { struct: { name: 'string', uri: 'string' } },
	CreateDealArgs: {
		struct: {
			deal_id: 'u64',
			title: 'string',
			description: 'string',
			discount_percent: 'u8',
			expiry: 'i64',
			total_supply: 'u32',
		},
	},
	MintCouponArgs: { struct: { deal_id: 'u64' } },
	RedeemCouponArgs: { struct: { mint: { array: { type: 'u8', len: 32 } } } },
	AddReviewArgs: { struct: { deal_id: 'u64', rating: 'u8', comment: 'string' } },
} as const;

function serialize(schema: borsh.Schema, value: any): Uint8Array {
	return borsh.serialize(schema as any, value);
}

function u64LeBytes(n: bigint) {
	const buf = Buffer.alloc(8);
	const view = new DataView(buf.buffer);
	view.setBigUint64(0, n, true);
	return Buffer.from(buf);
}

export function deriveMerchantPda(programId: PublicKey, merchant: PublicKey) {
	return PublicKey.findProgramAddressSync([Buffer.from('merchant'), merchant.toBuffer()], programId)[0];
}

export function deriveDealPda(programId: PublicKey, merchant: PublicKey, dealId: bigint) {
	return PublicKey.findProgramAddressSync([Buffer.from('deal'), merchant.toBuffer(), u64LeBytes(dealId)], programId)[0];
}

export function deriveReviewPda(programId: PublicKey, dealPda: PublicKey, user: PublicKey) {
	return PublicKey.findProgramAddressSync([Buffer.from('review'), dealPda.toBuffer(), user.toBuffer()], programId)[0];
}

export function deriveRedeemPda(programId: PublicKey, mint: PublicKey) {
	return PublicKey.findProgramAddressSync([Buffer.from('redeem'), mint.toBuffer()], programId)[0];
}

export function ixRegisterMerchant(programId: PublicKey, payer: PublicKey, merchantPda: PublicKey, name: string, uri: string) {
	const data = Buffer.concat([Buffer.from([IX.RegisterMerchant]), serialize(schemas.RegisterMerchantArgs as any, { name, uri })]);
	return new TransactionInstruction({
		programId,
		keys: [
			{ pubkey: payer, isSigner: true, isWritable: true },
			{ pubkey: merchantPda, isSigner: false, isWritable: true },
			{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
		],
		data,
	});
}

export function ixCreateDeal(programId: PublicKey, payer: PublicKey, merchantPda: PublicKey, dealPda: PublicKey, args: { deal_id: bigint; title: string; description: string; discount_percent: number; expiry: bigint; total_supply: number; }) {
	const data = Buffer.concat([Buffer.from([IX.CreateDeal]), serialize(schemas.CreateDealArgs as any, args)]);
	return new TransactionInstruction({
		programId,
		keys: [
			{ pubkey: payer, isSigner: true, isWritable: true },
			{ pubkey: merchantPda, isSigner: false, isWritable: true },
			{ pubkey: dealPda, isSigner: false, isWritable: true },
			{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
		],
		data,
	});
}

export function ixMintCoupon(programId: PublicKey, user: PublicKey, merchantPda: PublicKey, dealPda: PublicKey, dealId: bigint) {
	const data = Buffer.concat([Buffer.from([IX.MintCoupon]), serialize(schemas.MintCouponArgs as any, { deal_id: dealId })]);
	return new TransactionInstruction({
		programId,
		keys: [
			{ pubkey: user, isSigner: true, isWritable: false },
			{ pubkey: merchantPda, isSigner: false, isWritable: false },
			{ pubkey: dealPda, isSigner: false, isWritable: true },
		],
		data,
	});
}

export function ixRedeem(programId: PublicKey, user: PublicKey, redeemPda: PublicKey, mint: PublicKey) {
	const data = Buffer.concat([Buffer.from([IX.RedeemCoupon]), serialize(schemas.RedeemCouponArgs as any, { mint: Array.from(mint.toBytes()) })]);
	return new TransactionInstruction({
		programId,
		keys: [
			{ pubkey: user, isSigner: true, isWritable: false },
			{ pubkey: redeemPda, isSigner: false, isWritable: true },
			{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
		],
		data,
	});
}

export function ixAddReview(programId: PublicKey, user: PublicKey, merchantPda: PublicKey, dealPda: PublicKey, reviewPda: PublicKey, args: { deal_id: bigint; rating: number; comment: string; }) {
	const data = Buffer.concat([Buffer.from([IX.AddReview]), serialize(schemas.AddReviewArgs as any, args)]);
	return new TransactionInstruction({
		programId,
		keys: [
			{ pubkey: user, isSigner: true, isWritable: false },
			{ pubkey: merchantPda, isSigner: false, isWritable: false },
			{ pubkey: dealPda, isSigner: false, isWritable: false },
			{ pubkey: reviewPda, isSigner: false, isWritable: true },
			{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
		],
		data,
	});
}
