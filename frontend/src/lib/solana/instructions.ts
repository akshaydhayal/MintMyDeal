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
	SetCollectionMint: 7,
	ListNft: 8,
	BuyNft: 9,
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
			image_uri: 'string',
			metadata_uri: 'string',
		},
	},
	MintCouponArgs: { struct: { deal_id: 'u64' } },
	RedeemCouponArgs: { struct: { mint: { array: { type: 'u8', len: 32 } } } },
	AddReviewArgs: { struct: { deal_id: 'u64', rating: 'u8', comment: 'string' } },
	VerifyAndCountMintArgs: { struct: { deal_id: 'u64', mint: { array: { type: 'u8', len: 32 } } } },
	RedeemAndBurnArgs: { struct: { mint: { array: { type: 'u8', len: 32 } } } },
	SetCollectionMintArgs: { struct: { collection_mint: { array: { type: 'u8', len: 32 } } } },

	Merchant: {
		struct: {
			merchant: { array: { type: 'u8', len: 32 } },
			name: 'string',
			uri: 'string',
			total_deals: 'u32',
			collection_mint: { array: { type: 'u8', len: 32 } },
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
			image_uri: 'string',
			metadata_uri: 'string',
		},
	},
	Review: {
		struct: {
			user: { array: { type: 'u8', len: 32 } },
			deal: { array: { type: 'u8', len: 32 } },
			rating: 'u8',
			comment: 'string',
			created_at: 'i64',
		},
	},
	ListNftArgs: { struct: { price: 'u64' } },
	Listing: {
		struct: {
			seller: { array: { type: 'u8', len: 32 } },
			nft_mint: { array: { type: 'u8', len: 32 } },
			price: 'u64',
			created_at: 'i64',
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

export function ixSetCollectionMint(programId: PublicKey, payer: PublicKey, merchantPda: PublicKey, collectionMint: PublicKey) {
	const data = Buffer.concat([Buffer.from([IX.SetCollectionMint]), serialize(schemas.SetCollectionMintArgs as any, { collection_mint: Array.from(collectionMint.toBytes()) })]);
	return new TransactionInstruction({
		programId,
		keys: [
			{ pubkey: payer, isSigner: true, isWritable: false },
			{ pubkey: merchantPda, isSigner: false, isWritable: true },
		],
		data,
	});
}

export function ixCreateDeal(
	programId: PublicKey,
	payer: PublicKey,
	merchantPda: PublicKey,
	dealPda: PublicKey,
	args: {
		deal_id: bigint;
		title: string;
		description: string;
		discount_percent: number;
		expiry: bigint;
		total_supply: number;
		image_uri: string;
		metadata_uri: string;
	}
) {
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
	image_uri: string;
	metadata_uri: string;
};

export type MerchantAccount = {
	merchant: Uint8Array;
	name: string;
	uri: string;
	total_deals: number;
	collection_mint: Uint8Array;
};

export async function fetchDeal(connection: Connection, dealPda: PublicKey): Promise<DealAccount | null> {
	const info = await connection.getAccountInfo(dealPda);
	if (!info?.data) return null;
	const decoded = deserialize<DealAccount>(schemas.Deal as any, info.data);
	return decoded;
}

export async function fetchMerchant(connection: Connection, merchantPda: PublicKey): Promise<MerchantAccount | null> {
	const info = await connection.getAccountInfo(merchantPda);
	if (!info?.data) return null;
	try {
		const decoded = deserialize<MerchantAccount>(schemas.Merchant as any, info.data);
		return decoded;
	} catch {
		return null;
	}
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

export type ReviewAccount = {
	user: Uint8Array;
	deal: Uint8Array;
	rating: number;
	comment: string;
	created_at: bigint;
};

export function ixAddReview(programId: PublicKey, user: PublicKey, merchantPda: PublicKey, dealPda: PublicKey, reviewPda: PublicKey, dealId: bigint, rating: number, comment: string) {
	const data = Buffer.concat([Buffer.from([IX.AddReview]), serialize(schemas.AddReviewArgs as any, { deal_id: dealId, rating, comment })]);
	return new TransactionInstruction({
		programId,
		keys: [
			{ pubkey: user, isSigner: true, isWritable: true },
			{ pubkey: merchantPda, isSigner: false, isWritable: false },
			{ pubkey: dealPda, isSigner: false, isWritable: false },
			{ pubkey: reviewPda, isSigner: false, isWritable: true },
			{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
		],
		data,
	});
}

export async function fetchReview(connection: Connection, reviewPda: PublicKey): Promise<ReviewAccount | null> {
	const info = await connection.getAccountInfo(reviewPda);
	if (!info?.data) return null;
	try {
		const decoded = deserialize<ReviewAccount>(schemas.Review as any, info.data);
		return decoded;
	} catch {
		return null;
	}
}

export async function fetchReviewsForDeal(connection: Connection, programId: PublicKey, dealPda: PublicKey): Promise<Array<{ pubkey: PublicKey; account: ReviewAccount }>> {
	const accounts = await connection.getProgramAccounts(programId, { commitment: 'confirmed' });
	const out: Array<{ pubkey: PublicKey; account: ReviewAccount }> = [];
	for (const acc of accounts) {
		try {
			const decoded = deserialize<ReviewAccount>(schemas.Review as any, acc.account.data);
			// Filter by deal PDA
			const dealBytes = dealPda.toBytes();
			if (Buffer.from(decoded.deal).equals(Buffer.from(dealBytes))) {
				out.push({ pubkey: acc.pubkey, account: decoded });
			}
		} catch (e) {
			// not a Review account; skip
		}
	}
	// Sort by created_at descending (newest first)
	return out.sort((a, b) => Number(b.account.created_at - a.account.created_at));
}

// ==================== Marketplace Instructions ====================

export type ListingAccount = {
	seller: number[];
	nft_mint: number[];
	price: bigint;
	created_at: bigint;
};

export function deriveListingPda(programId: PublicKey, nftMint: PublicKey, seller: PublicKey): [PublicKey, number] {
	return PublicKey.findProgramAddressSync([Buffer.from('listing'), nftMint.toBuffer(), seller.toBuffer()], programId);
}

export function deriveEscrowPda(programId: PublicKey, nftMint: PublicKey): [PublicKey, number] {
	return PublicKey.findProgramAddressSync([Buffer.from('escrow'), nftMint.toBuffer()], programId);
}

export function ixListNft(
	programId: PublicKey,
	seller: PublicKey,
	listingPda: PublicKey,
	nftMint: PublicKey,
	sellerTokenAccount: PublicKey,
	escrowTokenAccount: PublicKey,
	tokenProgram: PublicKey,
	price: bigint
) {
	const data = Buffer.concat([Buffer.from([IX.ListNft]), serialize(schemas.ListNftArgs as any, { price })]);
	return new TransactionInstruction({
		programId,
		keys: [
			{ pubkey: seller, isSigner: true, isWritable: true },
			{ pubkey: listingPda, isSigner: false, isWritable: true },
			{ pubkey: nftMint, isSigner: false, isWritable: false },
			{ pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
			{ pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
			{ pubkey: tokenProgram, isSigner: false, isWritable: false },
			{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
		],
		data,
	});
}

export function ixBuyNft(
	programId: PublicKey,
	buyer: PublicKey,
	seller: PublicKey,
	listingPda: PublicKey,
	nftMint: PublicKey,
	escrowPda: PublicKey,
	escrowTokenAccount: PublicKey,
	buyerTokenAccount: PublicKey,
	tokenProgram: PublicKey
) {
	const data = Buffer.from([IX.BuyNft]);
	return new TransactionInstruction({
		programId,
		keys: [
			{ pubkey: buyer, isSigner: true, isWritable: true },
			{ pubkey: seller, isSigner: false, isWritable: true },
			{ pubkey: listingPda, isSigner: false, isWritable: true },
			{ pubkey: nftMint, isSigner: false, isWritable: false },
			{ pubkey: escrowPda, isSigner: false, isWritable: false },
			{ pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
			{ pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
			{ pubkey: tokenProgram, isSigner: false, isWritable: false },
			{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
		],
		data,
	});
}

export async function fetchListing(connection: Connection, listingPda: PublicKey): Promise<ListingAccount | null> {
	const info = await connection.getAccountInfo(listingPda);
	if (!info?.data) return null;
	try {
		const decoded = deserialize<ListingAccount>(schemas.Listing as any, info.data);
		return decoded;
	} catch {
		return null;
	}
}

export async function fetchAllListings(connection: Connection, programId: PublicKey): Promise<Array<{ pubkey: PublicKey; account: ListingAccount }>> {
	const accounts = await connection.getProgramAccounts(programId, { commitment: 'confirmed' });
	const out: Array<{ pubkey: PublicKey; account: ListingAccount }> = [];
	
	// Listing account size is 80 bytes (32 + 32 + 8 + 8)
	const LISTING_SIZE = 80;
	
	console.log(`Total program accounts: ${accounts.length}`);
	
	for (const acc of accounts) {
		// Filter by account size first
		if (acc.account.data.length !== LISTING_SIZE) {
			console.log(`Skipping account ${acc.pubkey.toBase58()}: wrong size (${acc.account.data.length} bytes, expected ${LISTING_SIZE})`);
			continue;
		}
		
		try {
			const decoded = deserialize<ListingAccount>(schemas.Listing as any, acc.account.data);
			
			// Additional validation: check if price is reasonable (not crazy high)
			// Max reasonable price: 1000 SOL = 1,000,000,000,000 lamports
			const MAX_REASONABLE_PRICE = BigInt(1_000_000_000_000);
			if (decoded.price > MAX_REASONABLE_PRICE) {
				console.log(`Skipping account ${acc.pubkey.toBase58()}: unreasonable price (${decoded.price})`);
				continue;
			}
			
			// Also skip if price is exactly 0 (likely not a real listing)
			if (decoded.price === BigInt(0)) {
				console.log(`Skipping account ${acc.pubkey.toBase58()}: price is 0`);
				continue;
			}
			
			// Validate that seller and nft_mint are valid pubkeys (all non-zero)
			const sellerBytes = Buffer.from(decoded.seller);
			const mintBytes = Buffer.from(decoded.nft_mint);
			const isSellerValid = sellerBytes.some(b => b !== 0);
			const isMintValid = mintBytes.some(b => b !== 0);
			
			if (!isSellerValid || !isMintValid) {
				console.log(`Skipping account ${acc.pubkey.toBase58()}: invalid seller or mint pubkey`);
				continue;
			}
			
			console.log(`Valid listing found: ${acc.pubkey.toBase58()}, price: ${decoded.price}`);
			out.push({ pubkey: acc.pubkey, account: decoded });
		} catch (e) {
			// not a Listing account; skip
		}
	}
	return out.sort((a, b) => Number(b.account.created_at - a.account.created_at));
}
