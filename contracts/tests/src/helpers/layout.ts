export const IX = {
	RegisterMerchant: 0,
	CreateDeal: 1,
	MintCoupon: 2,
	RedeemCoupon: 3,
	AddReview: 4,
} as const;

export const SEEDS = {
	MERCHANT: Buffer.from("merchant"),
	DEAL: Buffer.from("deal"),
	REVIEW: Buffer.from("review"),
	REDEEM: Buffer.from("redeem"),
};
