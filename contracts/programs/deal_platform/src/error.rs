use solana_program::program_error::ProgramError;
use thiserror_no_std::Error;

#[derive(Clone, Debug, Eq, Error, num_derive::FromPrimitive, PartialEq)]
pub enum DealError {
	#[error("Invalid instruction")]
	InvalidInstruction,
	#[error("PDA derivation mismatch")]
	PdaDerivationMismatch,
	#[error("Account already initialized")]
	AlreadyInitialized,
	#[error("Math overflow")]
	Overflow,
	#[error("Unauthorized")]
	Unauthorized,
	#[error("Deal sold out")]
	DealSoldOut,
	#[error("Coupon already redeemed")]
	AlreadyRedeemed,
	#[error("Invalid input")]
	InvalidInput,
}

impl From<DealError> for ProgramError {
	fn from(e: DealError) -> Self {
		ProgramError::Custom(e as u32)
	}
}
