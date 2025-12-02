import * as borsh from "borsh";

export const schemas = {
	RegisterMerchantArgs: {
		struct: { name: "string", uri: "string" },
	},
	CreateDealArgs: {
		struct: {
			deal_id: "u64",
			title: "string",
			description: "string",
			discount_percent: "u8",
			expiry: "i64",
			total_supply: "u32",
		},
	},
	MintCouponArgs: {
		struct: { deal_id: "u64" },
	},
	RedeemCouponArgs: {
		struct: { mint: { array: { type: "u8", len: 32 } } },
	},
	AddReviewArgs: {
		struct: { deal_id: "u64", rating: "u8", comment: "string" },
	},
	Merchant: {
		struct: {
			merchant: { array: { type: "u8", len: 32 } },
			name: "string",
			uri: "string",
			total_deals: "u32",
		},
	},
	Deal: {
		struct: {
			deal_id: "u64",
			merchant: { array: { type: "u8", len: 32 } },
			title: "string",
			description: "string",
			discount_percent: "u8",
			expiry: "i64",
			total_supply: "u32",
			minted: "u32",
		},
	},
	Review: {
		struct: {
			user: { array: { type: "u8", len: 32 } },
			deal: { array: { type: "u8", len: 32 } },
			rating: "u8",
			comment: "string",
			created_at: "i64",
		},
	},
	RedeemLog: {
		struct: {
			token_mint: { array: { type: "u8", len: 32 } },
			user: { array: { type: "u8", len: 32 } },
			redeemed_at: "i64",
		},
	},
} as const;

export function serialize(schema: borsh.Schema, value: any): Uint8Array {
	return borsh.serialize(schema as any, value);
}

export function deserialize<T>(schema: borsh.Schema, data: Buffer | Uint8Array): T {
	return borsh.deserialize(schema as any, data) as T;
}
