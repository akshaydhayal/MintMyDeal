extern crate alloc;

use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use borsh_derive::{BorshDeserialize as BorshDeserializeDerive, BorshSerialize as BorshSerializeDerive};

#[derive(BorshSerializeDerive, BorshDeserializeDerive, Debug, PartialEq, Eq, Clone)]
pub enum DealInstruction {
	// 0
	RegisterMerchant { name: String, uri: String },
	// 1
	CreateDeal {
		deal_id: u64,
		title: String,
		description: String,
		discount_percent: u8,
		expiry: i64,
		total_supply: u32,
		image_uri: String,
		metadata_uri: String,
	},
	// 2
	MintCouponNft { deal_id: u64 },
	// 3
	RedeemCoupon { mint: [u8; 32] },
	// 4
	AddReview { deal_id: u64, rating: u8, comment: String },
	// 5
	VerifyAndCountMint { deal_id: u64, mint: [u8; 32] },
	// 6
	RedeemAndBurn { mint: [u8; 32] },
	// 7 (new, placed last to avoid shifting earlier discriminants)
	SetCollectionMint { collection_mint: [u8; 32] },
}
