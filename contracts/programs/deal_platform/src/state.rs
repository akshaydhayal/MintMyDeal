extern crate alloc;

use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};
use borsh_derive::{BorshDeserialize as BorshDeserializeDerive, BorshSerialize as BorshSerializeDerive};
use solana_program::pubkey::Pubkey;

pub const MAX_NAME_LEN: usize = 64;
pub const MAX_URI_LEN: usize = 200;
pub const MAX_TITLE_LEN: usize = 80;
pub const MAX_DESC_LEN: usize = 512;
pub const MAX_COMMENT_LEN: usize = 280;

#[derive(BorshSerializeDerive, BorshDeserializeDerive, Debug, PartialEq, Eq, Clone)]
pub struct Merchant {
	pub merchant: Pubkey,
	pub name: String,
	pub uri: String,
	pub total_deals: u32,
}

impl Merchant {
	pub fn space() -> usize {
		32 + 4 + MAX_NAME_LEN + 4 + MAX_URI_LEN + 4
	}
}

#[derive(BorshSerializeDerive, BorshDeserializeDerive, Debug, PartialEq, Eq, Clone)]
pub struct Deal {
	pub deal_id: u64,
	pub merchant: Pubkey,
	pub title: String,
	pub description: String,
	pub discount_percent: u8,
	pub expiry: i64,
	pub total_supply: u32,
	pub minted: u32,
}

impl Deal {
	pub fn space() -> usize {
		8 + 32 + 4 + MAX_TITLE_LEN + 4 + MAX_DESC_LEN + 1 + 8 + 4 + 4
	}
}

#[derive(BorshSerializeDerive, BorshDeserializeDerive, Debug, PartialEq, Eq, Clone)]
pub struct Review {
	pub user: Pubkey,
	pub deal: Pubkey,
	pub rating: u8,
	pub comment: String,
	pub created_at: i64,
}

impl Review {
	pub fn space() -> usize {
		32 + 32 + 1 + 4 + MAX_COMMENT_LEN + 8
	}
}

#[derive(BorshSerializeDerive, BorshDeserializeDerive, Debug, PartialEq, Eq, Clone)]
pub struct RedeemLog {
	pub token_mint: Pubkey,
	pub user: Pubkey,
	pub redeemed_at: i64,
}

impl RedeemLog {
	pub fn space() -> usize {
		32 + 32 + 8
	}
}

pub mod seeds {
	pub const MERCHANT: &[u8] = b"merchant";
	pub const DEAL: &[u8] = b"deal";
	pub const REVIEW: &[u8] = b"review";
	pub const REDEEM: &[u8] = b"redeem";
}
