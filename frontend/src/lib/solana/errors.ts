// Contract error codes mapping
const DEAL_ERRORS: Record<number, string> = {
	0: 'Invalid instruction - please try again',
	1: 'Account address mismatch - incorrect PDA derivation',
	2: 'This account has already been initialized',
	3: 'Math overflow occurred - value too large',
	4: 'Unauthorized - you don\'t have permission for this action',
	5: 'Deal sold out - no more NFTs available to mint',
	6: 'This coupon has already been redeemed',
	7: 'Invalid input - please check your data',
};

export function parseContractError(error: any): string {
	// Try to extract custom program error
	const errorString = error?.message || error?.toString() || '';
	
	// Pattern: "custom program error: 0x4" or "custom program error: 4"
	const customErrorMatch = errorString.match(/custom program error: (?:0x)?(\d+)/i);
	if (customErrorMatch) {
		const errorCode = parseInt(customErrorMatch[1], 10);
		const humanError = DEAL_ERRORS[errorCode];
		if (humanError) {
			return `${humanError} (Error code: 0x${errorCode.toString(16)})`;
		}
		return `Contract error (code 0x${errorCode.toString(16)})`;
	}

	// Check for common Solana errors
	if (errorString.includes('Transaction simulation failed')) {
		if (errorString.includes('insufficient')) {
			return 'Insufficient SOL balance for transaction';
		}
		if (errorString.includes('Blockhash not found')) {
			return 'Transaction expired - please try again';
		}
		return 'Transaction simulation failed - please check your inputs';
	}

	if (errorString.includes('User rejected')) {
		return 'Transaction cancelled by user';
	}

	if (errorString.includes('WalletNotConnected')) {
		return 'Please connect your wallet first';
	}

	// Return original message if we can't parse it
	if (errorString.length > 0 && errorString.length < 200) {
		return errorString;
	}

	return 'An unexpected error occurred';
}

export function getExplorerUrl(signature: string, cluster: 'devnet' | 'mainnet-beta' | 'testnet' = 'devnet'): string {
	return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

export function getShortTxSignature(sig: string): string {
	if (sig.length <= 16) return sig;
	return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
}

