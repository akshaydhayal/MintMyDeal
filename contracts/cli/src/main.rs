use std::str::FromStr;

use anyhow::Result;
use borsh::BorshSerialize;
use clap::{Parser, Subcommand};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
	commitment_config::CommitmentConfig,
	signature::{read_keypair_file, Keypair, Signer},
	transaction::Transaction,
};
use solana_sdk::{instruction::Instruction, pubkey::Pubkey};

#[derive(Parser, Debug)]
#[command(name = "monke_deals_cli")]
struct Cli {
	#[arg(long, default_value = "devnet")] // devnet or localhost
	cluster: String,
	#[arg(long)]
	program_id: String,
	#[command(subcommand)]
	command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
	RegisterMerchant { #[arg(long)] name: String, #[arg(long)] uri: String },
	CreateDeal {
		#[arg(long)] deal_id: u64,
		#[arg(long)] title: String,
		#[arg(long)] description: String,
		#[arg(long)] discount: u8,
		#[arg(long)] expiry: i64,
		#[arg(long, default_value_t = 1)] total_supply: u32,
	},
	MintCoupon { #[arg(long)] deal_id: u64 },
	RedeemCoupon { #[arg(long)] mint: String },
	AddReview { #[arg(long)] deal_id: u64, #[arg(long)] rating: u8, #[arg(long)] comment: String },
}

fn rpc_url(cluster: &str) -> String {
	match cluster {
		"localhost" => "http://127.0.0.1:8899".to_string(),
		_ => "https://api.devnet.solana.com".to_string(),
	}
}

fn payer_path() -> String {
	std::env::var("SOLANA_KEYPAIR").unwrap_or_else(|_| format!("{}/.config/solana/id.json", std::env::var("HOME").unwrap()))
}

fn main() -> Result<()> {
	let cli = Cli::parse();
	let url = rpc_url(&cli.cluster);
	let client = RpcClient::new_with_commitment(url, CommitmentConfig::confirmed());
	let program_id = Pubkey::from_str(&cli.program_id)?;
	let payer = read_keypair_file(payer_path())?;

	let ix: Instruction = match cli.command {
		Commands::RegisterMerchant { name, uri } => {
			let merchant_pda = {
				let seeds = [b"merchant", payer.pubkey().as_ref()];
				Pubkey::find_program_address(&seeds, &program_id).0
			};
			let data = deal_platform::instruction::DealInstruction::RegisterMerchant { name, uri }.try_to_vec()?;
			Instruction {
				program_id,
				accounts: vec![
					solana_sdk::instruction::AccountMeta::new(payer.pubkey(), true),
					solana_sdk::instruction::AccountMeta::new(merchant_pda, false),
					solana_sdk::instruction::AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
				],
				data,
			}
		}
		Commands::CreateDeal { deal_id, title, description, discount, expiry, total_supply } => {
			let merchant_pda = {
				let seeds = [b"merchant", payer.pubkey().as_ref()];
				Pubkey::find_program_address(&seeds, &program_id).0
			};
			let deal_pda = {
				let seeds = [b"deal", payer.pubkey().as_ref(), &deal_id.to_le_bytes()];
				Pubkey::find_program_address(&seeds, &program_id).0
			};
			let data = deal_platform::instruction::DealInstruction::CreateDeal { deal_id, title, description, discount_percent: discount, expiry, total_supply }.try_to_vec()?;
			Instruction {
				program_id,
				accounts: vec![
					solana_sdk::instruction::AccountMeta::new(payer.pubkey(), true),
					solana_sdk::instruction::AccountMeta::new(merchant_pda, false),
					solana_sdk::instruction::AccountMeta::new(deal_pda, false),
					solana_sdk::instruction::AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
				],
				data,
			}
		}
		Commands::MintCoupon { deal_id } => {
			let merchant_pda = {
				let seeds = [b"merchant", payer.pubkey().as_ref()];
				Pubkey::find_program_address(&seeds, &program_id).0
			};
			let deal_pda = {
				let seeds = [b"deal", payer.pubkey().as_ref(), &deal_id.to_le_bytes()];
				Pubkey::find_program_address(&seeds, &program_id).0
			};
			let data = deal_platform::instruction::DealInstruction::MintCouponNft { deal_id }.try_to_vec()?;
			Instruction {
				program_id,
				accounts: vec![
					solana_sdk::instruction::AccountMeta::new(payer.pubkey(), true),
					solana_sdk::instruction::AccountMeta::new_readonly(merchant_pda, false),
					solana_sdk::instruction::AccountMeta::new(deal_pda, false),
				],
				data,
			}
		}
		Commands::RedeemCoupon { mint } => {
			let mint_pk = Pubkey::from_str(&mint)?;
			let redeem_pda = {
				let seeds = [b"redeem", mint_pk.as_ref()];
				Pubkey::find_program_address(&seeds, &program_id).0
			};
			let data = deal_platform::instruction::DealInstruction::RedeemCoupon { mint: mint_pk.to_bytes() }.try_to_vec()?;
			Instruction {
				program_id,
				accounts: vec![
					solana_sdk::instruction::AccountMeta::new(payer.pubkey(), true),
					solana_sdk::instruction::AccountMeta::new(redeem_pda, false),
					solana_sdk::instruction::AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
				],
				data,
			}
		}
		Commands::AddReview { deal_id, rating, comment } => {
			let merchant_pda = {
				let seeds = [b"merchant", payer.pubkey().as_ref()];
				Pubkey::find_program_address(&seeds, &program_id).0
			};
			let deal_pda = {
				let seeds = [b"deal", payer.pubkey().as_ref(), &deal_id.to_le_bytes()];
				Pubkey::find_program_address(&seeds, &program_id).0
			};
			let review_pda = {
				let seeds = [b"review", deal_pda.as_ref(), payer.pubkey().as_ref()];
				Pubkey::find_program_address(&seeds, &program_id).0
			};
			let data = deal_platform::instruction::DealInstruction::AddReview { deal_id, rating, comment }.try_to_vec()?;
			Instruction {
				program_id,
				accounts: vec![
					solana_sdk::instruction::AccountMeta::new(payer.pubkey(), true),
					solana_sdk::instruction::AccountMeta::new_readonly(merchant_pda, false),
					solana_sdk::instruction::AccountMeta::new_readonly(deal_pda, false),
					solana_sdk::instruction::AccountMeta::new(review_pda, false),
					solana_sdk::instruction::AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
				],
				data,
			}
		}
	};

	let recent_blockhash = client.get_latest_blockhash()?;
	let mut tx = Transaction::new_with_payer(&[ix], Some(&payer.pubkey()));
	tx.sign(&[&payer], recent_blockhash);
	let sig = client.send_and_confirm_transaction(&tx)?;
	println!("Signature: {}", sig);
	Ok(())
}
