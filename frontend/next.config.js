/**** @type {import('next').NextConfig} ****/
const nextConfig = {
	experimental: { appDir: true },
	env: {
		NEXT_PUBLIC_SOLANA_RPC: process.env.NEXT_PUBLIC_SOLANA_RPC,
		NEXT_PUBLIC_PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID,
	},
	webpack: (config, { isServer }) => {
		config.resolve = config.resolve || {};
		
		// For server bundles, externalize Irys and its dependencies
		if (isServer) {
			config.externals = config.externals || [];
			config.externals.push({
				'@irys/bundles': 'commonjs @irys/bundles',
				'@irys/upload': 'commonjs @irys/upload',
				'axios': 'commonjs axios',
			});
		}
		
		// For client bundles, disable Node.js modules
		if (!isServer) {
			config.resolve.fallback = {
				...(config.resolve.fallback || {}),
				fs: false,
				path: false,
				os: false,
				readline: false,
				crypto: false,
				stream: false,
				zlib: false,
				util: false,
			};
			config.resolve.alias = {
				...(config.resolve.alias || {}),
				inquirer: false,
			};
		}
		
		return config;
	},
};

module.exports = nextConfig;
