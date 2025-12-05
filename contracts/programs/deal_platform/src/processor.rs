extern crate alloc;

use alloc::format;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
	account_info::{next_account_info, AccountInfo},
	entrypoint::ProgramResult,
	msg,
	program::{invoke},
	program_error::ProgramError,
	pubkey::Pubkey,
	system_instruction,
	sysvar::{clock::Clock, Sysvar},
};

use crate::{
	error::DealError,
	instruction::DealInstruction,
	state::{seeds, Deal, Listing, Merchant, RedeemLog, Review, MAX_COMMENT_LEN, MAX_DESC_LEN, MAX_NAME_LEN, MAX_TITLE_LEN, MAX_URI_LEN},
};

pub struct Processor;

impl Processor {
	fn read_unpacked<T: BorshDeserialize>(data: &[u8]) -> Result<T, ProgramError> {
		let mut cursor = borsh::maybestd::io::Cursor::new(data);
		T::deserialize_reader(&mut cursor).map_err(|_| DealError::InvalidInput.into())
	}

	pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
		let ix = DealInstruction::try_from_slice(data).map_err(|_| DealError::InvalidInstruction)?;
		match ix {
			DealInstruction::RegisterMerchant { name, uri } => {
				Self::process_register_merchant(program_id, accounts, name, uri)
			}
			DealInstruction::SetCollectionMint { collection_mint } => {
				Self::process_set_collection_mint(program_id, accounts, Pubkey::new_from_array(collection_mint))
			}
			DealInstruction::CreateDeal { deal_id, title, description, discount_percent, expiry, total_supply, image_uri, metadata_uri } => {
				Self::process_create_deal(program_id, accounts, deal_id, title, description, discount_percent, expiry, total_supply, image_uri, metadata_uri)
			}
			DealInstruction::MintCouponNft { deal_id } => Self::process_mint_coupon(program_id, accounts, deal_id),
			DealInstruction::RedeemCoupon { mint } => Self::process_redeem_coupon(program_id, accounts, Pubkey::new_from_array(mint)),
			DealInstruction::AddReview { deal_id, rating, comment } => Self::process_add_review(program_id, accounts, deal_id, rating, comment),
			DealInstruction::VerifyAndCountMint { deal_id, mint: _ } => Self::process_verify_and_count_mint(program_id, accounts, deal_id),
			DealInstruction::RedeemAndBurn { mint } => Self::process_redeem_and_burn(program_id, accounts, Pubkey::new_from_array(mint)),
			DealInstruction::ListNft { price } => Self::process_list_nft(program_id, accounts, price),
			DealInstruction::BuyNft => Self::process_buy_nft(program_id, accounts),
		}
	}

	fn assert_len(s: &str, max: usize) -> Result<(), ProgramError> {
		if s.len() > max { return Err(DealError::InvalidInput.into()); }
		Ok(())
	}

	fn process_register_merchant(
		program_id: &Pubkey,
		accounts: &[AccountInfo],
		name: alloc::string::String,
		uri: alloc::string::String,
	) -> ProgramResult {
		Self::assert_len(&name, MAX_NAME_LEN)?;
		Self::assert_len(&uri, MAX_URI_LEN)?;

		let account_iter = &mut accounts.iter();
		let payer = next_account_info(account_iter)?; // signer
		let merchant_pda_ai = next_account_info(account_iter)?;
		let system_program = next_account_info(account_iter)?;

		if !payer.is_signer { return Err(DealError::Unauthorized.into()); }

		let (merchant_pda, bump) = Pubkey::find_program_address(&[seeds::MERCHANT, payer.key.as_ref()], program_id);
		if merchant_pda != *merchant_pda_ai.key { return Err(DealError::PdaDerivationMismatch.into()); }
		if merchant_pda_ai.data_len() > 0 && !merchant_pda_ai.data_is_empty() { return Err(DealError::AlreadyInitialized.into()); }

		let rent = solana_program::rent::Rent::get()?;
		let lamports = rent.minimum_balance(Merchant::space());
		let create_ix = system_instruction::create_account(
			payer.key,
			merchant_pda_ai.key,
			lamports,
			Merchant::space() as u64,
			program_id,
		);
		solana_program::program::invoke_signed(
			&create_ix,
			&[payer.clone(), merchant_pda_ai.clone(), system_program.clone()],
			&[&[seeds::MERCHANT, payer.key.as_ref(), &[bump]]],
		)?;

		let merchant = Merchant { merchant: *payer.key, name, uri, total_deals: 0, collection_mint: Pubkey::default() };
		merchant.serialize(&mut &mut merchant_pda_ai.data.borrow_mut()[..])?;
		Ok(())
	}

	fn process_set_collection_mint(
		program_id: &Pubkey,
		accounts: &[AccountInfo],
		collection_mint: Pubkey,
	) -> ProgramResult {
		let account_iter = &mut accounts.iter();
		let payer = next_account_info(account_iter)?; // signer (merchant)
		let merchant_pda_ai = next_account_info(account_iter)?; // write

		if !payer.is_signer { return Err(DealError::Unauthorized.into()); }
		let (merchant_pda, _bump) = Pubkey::find_program_address(&[seeds::MERCHANT, payer.key.as_ref()], program_id);
		if merchant_pda != *merchant_pda_ai.key { return Err(DealError::PdaDerivationMismatch.into()); }

		let mut merchant: Merchant = {
			let data = merchant_pda_ai.data.borrow();
			Self::read_unpacked(&data)?
		};
		merchant.collection_mint = collection_mint;
		let mut dst = merchant_pda_ai.data.borrow_mut();
		merchant.serialize(&mut &mut dst[..])?;
		Ok(())
	}

	fn process_create_deal(
		program_id: &Pubkey,
		accounts: &[AccountInfo],
		deal_id: u64,
		title: alloc::string::String,
		description: alloc::string::String,
		discount_percent: u8,
		expiry: i64,
		total_supply: u32,
		image_uri: alloc::string::String,
		metadata_uri: alloc::string::String,
	) -> ProgramResult {
		Self::assert_len(&title, MAX_TITLE_LEN)?;
		Self::assert_len(&description, MAX_DESC_LEN)?;
		Self::assert_len(&image_uri, MAX_URI_LEN)?;
		Self::assert_len(&metadata_uri, MAX_URI_LEN)?;

		let account_iter = &mut accounts.iter();
		let payer = next_account_info(account_iter)?; // signer (merchant)
		let merchant_pda_ai = next_account_info(account_iter)?;
		let deal_pda_ai = next_account_info(account_iter)?;
		let system_program = next_account_info(account_iter)?;

		if !payer.is_signer { return Err(DealError::Unauthorized.into()); }

		let (merchant_pda, _merchant_bump) = Pubkey::find_program_address(&[seeds::MERCHANT, payer.key.as_ref()], program_id);
		if merchant_pda != *merchant_pda_ai.key { return Err(DealError::PdaDerivationMismatch.into()); }

		if merchant_pda_ai.data_is_empty() { return Err(DealError::Unauthorized.into()); }

		let deal_seed_id = deal_id.to_le_bytes();
		let (deal_pda, deal_bump) = Pubkey::find_program_address(&[seeds::DEAL, payer.key.as_ref(), &deal_seed_id], program_id);
		if deal_pda != *deal_pda_ai.key { return Err(DealError::PdaDerivationMismatch.into()); }
		if deal_pda_ai.data_len() > 0 && !deal_pda_ai.data_is_empty() { return Err(DealError::AlreadyInitialized.into()); }

		let rent = solana_program::rent::Rent::get()?;
		let lamports = rent.minimum_balance(Deal::space());
		let create_ix = system_instruction::create_account(
			payer.key,
			deal_pda_ai.key,
			lamports,
			Deal::space() as u64,
			program_id,
		);
		solana_program::program::invoke_signed(
			&create_ix,
			&[payer.clone(), deal_pda_ai.clone(), system_program.clone()],
			&[&[seeds::DEAL, payer.key.as_ref(), &deal_seed_id, &[deal_bump]]],
		)?;

		// Write deal
		{
			let mut dst = deal_pda_ai.data.borrow_mut();
			let deal = Deal {
				deal_id,
				merchant: *payer.key,
				title,
				description,
				discount_percent,
				expiry,
				total_supply,
				minted: 0,
				image_uri,
				metadata_uri,
			};
			deal.serialize(&mut &mut dst[..])?;
		}

		// Increment merchant.total_deals (best-effort), ensuring borrow scopes do not overlap
		{
			let merchant_owned = {
				let data = merchant_pda_ai.data.borrow();
				Self::read_unpacked::<Merchant>(&data)
			};
			if let Ok(mut merchant) = merchant_owned {
				if let Some(next) = merchant.total_deals.checked_add(1) { merchant.total_deals = next; }
				let mut dst = merchant_pda_ai.data.borrow_mut();
				let _ = merchant.serialize(&mut &mut dst[..]);
			}
		}

		Ok(())
	}

	fn process_mint_coupon(
		program_id: &Pubkey,
		accounts: &[AccountInfo],
		deal_id: u64,
	) -> ProgramResult {
		let account_iter = &mut accounts.iter();
		let user = next_account_info(account_iter)?; // signer
		let merchant_pda_ai = next_account_info(account_iter)?;
		let deal_pda_ai = next_account_info(account_iter)?;

		if !user.is_signer { return Err(DealError::Unauthorized.into()); }

		msg!("mint: merchant data len {}", merchant_pda_ai.data_len());
		let merchant: Merchant = {
			let data = merchant_pda_ai.data.borrow();
			Self::read_unpacked(&data)?
		};
		let (expected_deal_pda, _bump) = Pubkey::find_program_address(
			&[seeds::DEAL, merchant.merchant.as_ref(), &deal_id.to_le_bytes()],
			program_id,
		);
		if expected_deal_pda != *deal_pda_ai.key { return Err(DealError::PdaDerivationMismatch.into()); }

		msg!("mint: deal data len {}", deal_pda_ai.data_len());
		{
			let mut deal: Deal = {
				let data = deal_pda_ai.data.borrow();
				Self::read_unpacked(&data)?
			};
			deal.minted = deal.minted.checked_add(1).ok_or(DealError::Overflow)?;
			if deal.minted > deal.total_supply { return Err(DealError::DealSoldOut.into()); }
			let mut dst = deal_pda_ai.data.borrow_mut();
			deal.serialize(&mut &mut dst[..])?;
		}

		Ok(())
	}

	fn process_redeem_coupon(
		program_id: &Pubkey,
		accounts: &[AccountInfo],
		mint: Pubkey,
	) -> ProgramResult {
		let account_iter = &mut accounts.iter();
		let user = next_account_info(account_iter)?; // signer
		let redeem_log_ai = next_account_info(account_iter)?;
		let system_program = next_account_info(account_iter)?;

		if !user.is_signer { return Err(DealError::Unauthorized.into()); }

		let (redeem_pda, bump) = Pubkey::find_program_address(&[seeds::REDEEM, mint.as_ref()], program_id);
		if redeem_pda != *redeem_log_ai.key { return Err(DealError::PdaDerivationMismatch.into()); }
		if !redeem_log_ai.data_is_empty() { return Err(DealError::AlreadyRedeemed.into()); }

		let rent = solana_program::rent::Rent::get()?;
		let lamports = rent.minimum_balance(RedeemLog::space());
		let create_ix = system_instruction::create_account(
			user.key,
			redeem_log_ai.key,
			lamports,
			RedeemLog::space() as u64,
			program_id,
		);
		solana_program::program::invoke_signed(
			&create_ix,
			&[user.clone(), redeem_log_ai.clone(), system_program.clone()],
			&[&[seeds::REDEEM, mint.as_ref(), &[bump]]],
		)?;

		let now = Clock::get()?.unix_timestamp;
		let log = RedeemLog { token_mint: mint, user: *user.key, redeemed_at: now };
		log.serialize(&mut &mut redeem_log_ai.data.borrow_mut()[..])?;
		Ok(())
	}

	fn process_add_review(
		program_id: &Pubkey,
		accounts: &[AccountInfo],
		deal_id: u64,
		rating: u8,
		comment: alloc::string::String,
	) -> ProgramResult {
		if rating == 0 || rating > 5 { return Err(DealError::InvalidInput.into()); }
		if comment.len() > MAX_COMMENT_LEN { return Err(DealError::InvalidInput.into()); }

		let account_iter = &mut accounts.iter();
		let user = next_account_info(account_iter)?; // signer
		let merchant_pda_ai = next_account_info(account_iter)?;
		let deal_pda_ai = next_account_info(account_iter)?;
		let review_pda_ai = next_account_info(account_iter)?;
		let system_program = next_account_info(account_iter)?;

		if !user.is_signer { return Err(DealError::Unauthorized.into()); }

		let merchant: Merchant = Self::read_unpacked(&merchant_pda_ai.data.borrow())?;
		let (expected_deal_pda, _bump) = Pubkey::find_program_address(
			&[seeds::DEAL, merchant.merchant.as_ref(), &deal_id.to_le_bytes()],
			program_id,
		);
		if expected_deal_pda != *deal_pda_ai.key { return Err(DealError::PdaDerivationMismatch.into()); }

		let (review_pda, bump) = Pubkey::find_program_address(&[seeds::REVIEW, deal_pda_ai.key.as_ref(), user.key.as_ref()], program_id);
		if review_pda != *review_pda_ai.key { return Err(DealError::PdaDerivationMismatch.into()); }
		if !review_pda_ai.data_is_empty() { return Err(DealError::AlreadyInitialized.into()); }

		let rent = solana_program::rent::Rent::get()?;
		let lamports = rent.minimum_balance(Review::space());
		let create_ix = solana_program::system_instruction::create_account(
			user.key,
			review_pda_ai.key,
			lamports,
			Review::space() as u64,
			program_id,
		);
		solana_program::program::invoke_signed(
			&create_ix,
			&[user.clone(), review_pda_ai.clone(), system_program.clone()],
			&[&[seeds::REVIEW, deal_pda_ai.key.as_ref(), user.key.as_ref(), &[bump]]],
		)?;

		let now = Clock::get()?.unix_timestamp;
		let review = Review { user: *user.key, deal: *deal_pda_ai.key, rating, comment, created_at: now };
		review.serialize(&mut &mut review_pda_ai.data.borrow_mut()[..])?;
		Ok(())
	}

	fn process_verify_and_count_mint(
		program_id: &Pubkey,
		accounts: &[AccountInfo],
		deal_id: u64,
	) -> ProgramResult {
		let account_iter = &mut accounts.iter();
		let user = next_account_info(account_iter)?; // signer
		let merchant_pda_ai = next_account_info(account_iter)?; // read
		let deal_pda_ai = next_account_info(account_iter)?; // write

		if !user.is_signer { return Err(DealError::Unauthorized.into()); }

		// Read merchant to resolve original merchant pubkey and deal PDA
		let merchant: Merchant = {
			let data = merchant_pda_ai.data.borrow();
			Self::read_unpacked(&data)?
		};
		let (expected_deal_pda, _bump) = Pubkey::find_program_address(&[seeds::DEAL, merchant.merchant.as_ref(), &deal_id.to_le_bytes()], program_id);
		if expected_deal_pda != *deal_pda_ai.key { return Err(DealError::PdaDerivationMismatch.into()); }

		// Increment supply if available
		{
			let mut deal: Deal = {
				let data = deal_pda_ai.data.borrow();
				Self::read_unpacked(&data)?
			};
			if deal.minted >= deal.total_supply { return Err(DealError::DealSoldOut.into()); }
			deal.minted = deal.minted.checked_add(1).ok_or(DealError::Overflow)?;
			let mut dst = deal_pda_ai.data.borrow_mut();
			deal.serialize(&mut &mut dst[..])?;
		}
		Ok(())
	}

	fn process_redeem_and_burn(
		program_id: &Pubkey,
		accounts: &[AccountInfo],
		mint: Pubkey,
	) -> ProgramResult {
		let account_iter = &mut accounts.iter();
		let user = next_account_info(account_iter)?; // signer & burn authority
		let user_token_ai = next_account_info(account_iter)?; // user's token account for mint
		let mint_ai = next_account_info(account_iter)?; // mint account
		let token_program_ai = next_account_info(account_iter)?; // spl-token program
		let redeem_log_ai = next_account_info(account_iter)?; // pda
		let system_program = next_account_info(account_iter)?;

		if !user.is_signer { return Err(DealError::Unauthorized.into()); }
		if *mint_ai.key != mint { return Err(DealError::InvalidInput.into()); }

		// Burn 1 token
		let burn_ix = spl_token::instruction::burn(
			&spl_token::id(),
			user_token_ai.key,
			mint_ai.key,
			user.key,
			&[],
			1,
		).map_err(|_| ProgramError::InvalidInstructionData)?;
		invoke(
			&burn_ix,
			&[
				user_token_ai.clone(),
				mint_ai.clone(),
				user.clone(),
				token_program_ai.clone(),
			],
		)?;

		// Write RedeemLog once
		let (redeem_pda, bump) = Pubkey::find_program_address(&[seeds::REDEEM, mint.as_ref()], program_id);
		if redeem_pda != *redeem_log_ai.key { return Err(DealError::PdaDerivationMismatch.into()); }
		if !redeem_log_ai.data_is_empty() { return Err(DealError::AlreadyRedeemed.into()); }

		let rent = solana_program::rent::Rent::get()?;
		let lamports = rent.minimum_balance(RedeemLog::space());
		let create_ix = system_instruction::create_account(
			user.key,
			redeem_log_ai.key,
			lamports,
			RedeemLog::space() as u64,
			program_id,
		);
		solana_program::program::invoke_signed(
			&create_ix,
			&[user.clone(), redeem_log_ai.clone(), system_program.clone()],
			&[&[seeds::REDEEM, mint.as_ref(), &[bump]]],
		)?;

		let now = Clock::get()?.unix_timestamp;
		let log = RedeemLog { token_mint: mint, user: *user.key, redeemed_at: now };
		log.serialize(&mut &mut redeem_log_ai.data.borrow_mut()[..])?;
		Ok(())
	}

	fn process_list_nft(program_id: &Pubkey, accounts: &[AccountInfo], price: u64) -> ProgramResult {
		let accounts_iter = &mut accounts.iter();
		let seller = next_account_info(accounts_iter)?;
		let listing_pda = next_account_info(accounts_iter)?;
		let nft_mint = next_account_info(accounts_iter)?;
		let seller_token_account = next_account_info(accounts_iter)?;
		let escrow_token_account = next_account_info(accounts_iter)?;
		let token_program = next_account_info(accounts_iter)?;
		let system_program = next_account_info(accounts_iter)?;

		if !seller.is_signer { return Err(ProgramError::MissingRequiredSignature); }
		if price == 0 { return Err(DealError::InvalidInput.into()); }

		// Verify listing PDA
		let (listing_pda_pubkey, listing_bump) = Pubkey::find_program_address(
			&[seeds::LISTING, nft_mint.key.as_ref(), seller.key.as_ref()],
			program_id,
		);
		if listing_pda_pubkey != *listing_pda.key {
			msg!("Invalid listing PDA");
			return Err(ProgramError::InvalidAccountData);
		}

		// Create listing account
		let rent = solana_program::rent::Rent::get()?;
		let space = Listing::space();
		let lamports = rent.minimum_balance(space);
		let create_ix = system_instruction::create_account(
			seller.key,
			listing_pda.key,
			lamports,
			space as u64,
			program_id,
		);
		solana_program::program::invoke_signed(
			&create_ix,
			&[seller.clone(), listing_pda.clone(), system_program.clone()],
			&[&[seeds::LISTING, nft_mint.key.as_ref(), seller.key.as_ref(), &[listing_bump]]],
		)?;

		// Transfer NFT to escrow
		let transfer_ix = spl_token::instruction::transfer(
			token_program.key,
			seller_token_account.key,
			escrow_token_account.key,
			seller.key,
			&[],
			1,
		)?;
		invoke(&transfer_ix, &[seller_token_account.clone(), escrow_token_account.clone(), seller.clone(), token_program.clone()])?;

		// Save listing data
		let clock = Clock::get()?;
		let listing = Listing {
			seller: *seller.key,
			nft_mint: *nft_mint.key,
			price,
			created_at: clock.unix_timestamp,
		};
		listing.serialize(&mut &mut listing_pda.data.borrow_mut()[..])?;

		msg!("NFT listed for {} lamports", price);
		Ok(())
	}

	fn process_buy_nft(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
		let accounts_iter = &mut accounts.iter();
		let buyer = next_account_info(accounts_iter)?;
		let seller = next_account_info(accounts_iter)?;
		let listing_pda = next_account_info(accounts_iter)?;
		let nft_mint = next_account_info(accounts_iter)?;
		let escrow_pda = next_account_info(accounts_iter)?;
		let escrow_token_account = next_account_info(accounts_iter)?;
		let buyer_token_account = next_account_info(accounts_iter)?;
		let token_program = next_account_info(accounts_iter)?;
		let system_program = next_account_info(accounts_iter)?;

		if !buyer.is_signer { return Err(ProgramError::MissingRequiredSignature); }

		// Verify listing PDA
		let (listing_pda_pubkey, _) = Pubkey::find_program_address(
			&[seeds::LISTING, nft_mint.key.as_ref(), seller.key.as_ref()],
			program_id,
		);
		if listing_pda_pubkey != *listing_pda.key {
			msg!("Invalid listing PDA");
			return Err(ProgramError::InvalidAccountData);
		}

		// Deserialize listing
		let listing = Listing::try_from_slice(&listing_pda.data.borrow())?;

		// Verify seller matches
		if listing.seller != *seller.key { return Err(DealError::Unauthorized.into()); }

		// Transfer SOL from buyer to seller
		invoke(
			&system_instruction::transfer(buyer.key, seller.key, listing.price),
			&[buyer.clone(), seller.clone(), system_program.clone()],
		)?;

		// Verify and derive escrow PDA
		let (escrow_pda_pubkey, escrow_bump) = Pubkey::find_program_address(&[seeds::ESCROW, nft_mint.key.as_ref()], program_id);
		if escrow_pda_pubkey != *escrow_pda.key {
			msg!("Invalid escrow PDA");
			return Err(ProgramError::InvalidAccountData);
		}
		
		// Transfer NFT from escrow to buyer
		let transfer_ix = spl_token::instruction::transfer(
			token_program.key,
			escrow_token_account.key,
			buyer_token_account.key,
			escrow_pda.key,
			&[],
			1,
		)?;
		solana_program::program::invoke_signed(
			&transfer_ix,
			&[escrow_token_account.clone(), buyer_token_account.clone(), escrow_pda.clone(), token_program.clone()],
			&[&[seeds::ESCROW, nft_mint.key.as_ref(), &[escrow_bump]]],
		)?;

		// Close listing account and return rent to seller
		**seller.lamports.borrow_mut() = seller.lamports().checked_add(listing_pda.lamports()).ok_or(ProgramError::ArithmeticOverflow)?;
		**listing_pda.lamports.borrow_mut() = 0;
		listing_pda.data.borrow_mut().fill(0);

		msg!("NFT purchased for {} lamports", listing.price);
		Ok(())
	}
}
