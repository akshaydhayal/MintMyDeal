"use client";

import { generateSigner, percentAmount, type Umi } from '@metaplex-foundation/umi';
import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import { create } from '@metaplex-foundation/mpl-core';

async function uploadViaIrysApi(name: string, description: string, imageFile?: File) {
	console.log('🚀 Starting upload with Irys (server-side)...');
	if (imageFile) {
		console.log(`📦 Image size: ${(imageFile.size / 1024).toFixed(2)} KB`);
	}
	
	const formData = new FormData();
	formData.append('name', name);
	formData.append('description', description);
	if (imageFile) {
		formData.append('image', imageFile);
	}
	
	const res = await fetch('/api/irys-upload', {
		method: 'POST',
		body: formData,
	});
	
	if (!res.ok) {
		const err = await res.json();
		console.error('❌ Upload failed:', err);
		throw new Error(`upload failed: ${res.status}`);
	}
	
	const { imageUri, metadataUri } = await res.json();
	console.log('✅ Upload successful!');
	console.log('🖼️  Image URI:', imageUri);
	console.log('📄 Metadata URI:', metadataUri);
	
	return { imageUri, metadataUri };
}

export async function mintTokenMetadataNft(
	umi: Umi,
	name: string,
	description: string,
	imageFile?: File,
) {
	const { imageUri, metadataUri } = await uploadViaIrysApi(name, description, imageFile);
	const mint = generateSigner(umi);
	await createNft(umi, {
		mint,
		name,
		symbol: 'DEAL',
		uri: metadataUri,
		sellerFeeBasisPoints: percentAmount(0),
		isMutable: true,
	}).sendAndConfirm(umi);
	console.log('[mint] token-metadata NFT minted:', { mint: mint.publicKey.toString(), metadataUri, imageUri });
	return { mint: mint.publicKey.toString(), uri: metadataUri, image: imageUri };
}

export async function mintCoreAsset(
	umi: Umi,
	name: string,
	description: string,
	imageFile?: File,
	attributes?: Array<{ trait_type: string; value: string | number }>,
) {
	const { imageUri, metadataUri } = await uploadViaIrysApi(name, description, imageFile);
	const asset = generateSigner(umi);
	const tx = await create(umi, {
		asset,
		name,
		uri: metadataUri,
	}).sendAndConfirm(umi);
	const sigString = typeof tx.signature === 'string' ? tx.signature : Buffer.from(tx.signature).toString('base64');
	console.log('[core-mint] asset minted:', { asset: asset.publicKey.toString(), metadataUri, imageUri, sig: sigString });
	return { asset: asset.publicKey.toString(), signature: sigString, uri: metadataUri };
}

// Legacy function for merchant page - uploads image and JSON metadata
export async function uploadImageAndJson(
	umi: Umi,
	imageFile: File,
	metadata: { name: string; symbol?: string; description?: string },
) {
	const { imageUri, metadataUri } = await uploadViaIrysApi(
		metadata.name,
		metadata.description || '',
		imageFile
	);
	return { imageUri, jsonUri: metadataUri };
}

// Legacy function for merchant page - mints a Token Metadata collection NFT
export async function mintCollection(
	umi: Umi,
	name: string,
	symbol: string,
	uri: string,
) {
	const mint = generateSigner(umi);
	await createNft(umi, {
		mint,
		name,
		symbol,
		uri,
		sellerFeeBasisPoints: percentAmount(0),
		isCollection: true,
	}).sendAndConfirm(umi);
	console.log('[mint-collection] NFT collection minted:', mint.publicKey.toString());
	return mint.publicKey.toString();
}
