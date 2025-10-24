extern crate alloc;

use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use borsh_derive::{BorshDeserialize as BorshDeserializeDerive, BorshSerialize as BorshSerializeDerive};

#[derive(BorshSerializeDerive, BorshDeserializeDerive, Debug, PartialEq, Eq, Clone)]
pub enum DealInstruction {
	RegisterMerchant { name: String, uri: String },
	CreateDeal {
		deal_id: u64,
		title: String,
		description: String,
		discount_percent: u8,
		expiry: i64,
		total_supply: u32,
	},
	MintCouponNft { deal_id: u64 },
	RedeemCoupon { mint: [u8; 32] },
	AddReview { deal_id: u64, rating: u8, comment: String },
}
