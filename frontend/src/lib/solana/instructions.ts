import { PublicKey, SystemProgram, TransactionInstruction, Connection } from '@solana/web3.js';
import * as borsh from 'borsh';

const IX = {
	RegisterMerchant: 0,
	CreateDeal: 1,
	MintCoupon: 2,
	RedeemCoupon: 3,
	AddReview: 4,
	VerifyAndCountMint: 5,
	RedeemAndBurn: 6,
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
	VerifyAndCountMintArgs: { struct: { deal_id: 'u64', mint: { array: { type: 'u8', len: 32 } } } },
	RedeemAndBurnArgs: { struct: { mint: { array: { type: 'u8', len: 32 } } } },

	Merchant: {
		struct: {
			merchant: { array: { type: 'u8', len: 32 } },
			name: 'string',
			uri: 'string',
			total_deals: 'u32',
		},
	},
	Deal: {
		struct: {
			deal_id: 'u64',
			merchant: { array: { type: 'u8', len: 32 } },
			title: 'string',
			description: 'string',
			discount_percent: 'u8',
			expiry: 'i64',
			total_supply: 'u32',
			minted: 'u32',
		},
	},
} as const;

function serialize(schema: borsh.Schema, value: any): Uint8Array {
	return borsh.serialize(schema as any, value);
}

export function deserialize<T>(schema: borsh.Schema, data: Buffer | Uint8Array): T {
	return borsh.deserialize(schema as any, data) as T;
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

export function ixVerifyAndCountMint(programId: PublicKey, user: PublicKey, merchantPda: PublicKey, dealPda: PublicKey, dealId: bigint, mint: PublicKey) {
	const data = Buffer.concat([Buffer.from([IX.VerifyAndCountMint]), serialize(schemas.VerifyAndCountMintArgs as any, { deal_id: dealId, mint: Array.from(mint.toBytes()) })]);
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

export function ixRedeemAndBurn(programId: PublicKey, user: PublicKey, userToken: PublicKey, mint: PublicKey, tokenProgram: PublicKey, redeemPda: PublicKey) {
	const data = Buffer.concat([Buffer.from([IX.RedeemAndBurn]), serialize(schemas.RedeemAndBurnArgs as any, { mint: Array.from(mint.toBytes()) })]);
	return new TransactionInstruction({
		programId,
		keys: [
			{ pubkey: user, isSigner: true, isWritable: false },
			{ pubkey: userToken, isSigner: false, isWritable: true },
			{ pubkey: mint, isSigner: false, isWritable: true },
			{ pubkey: tokenProgram, isSigner: false, isWritable: false },
			{ pubkey: redeemPda, isSigner: false, isWritable: true },
			{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
		],
		data,
	});
}

export type DealAccount = {
	deal_id: bigint;
	merchant: Uint8Array;
	title: string;
	description: string;
	discount_percent: number;
	expiry: bigint;
	total_supply: number;
	minted: number;
};

export async function fetchDeal(connection: Connection, dealPda: PublicKey): Promise<DealAccount | null> {
	const info = await connection.getAccountInfo(dealPda);
	if (!info?.data) return null;
	const decoded = deserialize<DealAccount>(schemas.Deal as any, info.data);
	return decoded;
}

export async function fetchAllDeals(connection: Connection, programId: PublicKey): Promise<Array<{ pubkey: PublicKey; account: DealAccount }>> {
	const accounts = await connection.getProgramAccounts(programId, { commitment: 'confirmed' });
	const out: Array<{ pubkey: PublicKey; account: DealAccount }> = [];
	for (const acc of accounts) {
		try {
			const decoded = deserialize<DealAccount>(schemas.Deal as any, acc.account.data);
			out.push({ pubkey: acc.pubkey, account: decoded });
		} catch (e) {
			// not a Deal account; skip
		}
	}
	return out;
}
