/**** @type {import('next').NextConfig} ****/
const nextConfig = {
	experimental: { appDir: true },
	env: {
		NEXT_PUBLIC_SOLANA_RPC: process.env.NEXT_PUBLIC_SOLANA_RPC,
		NEXT_PUBLIC_PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID,
	},
};

module.exports = nextConfig;
