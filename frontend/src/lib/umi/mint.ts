"use client";

import { generateSigner, percentAmount, publicKey } from '@metaplex-foundation/umi';
import { createNft, createCollectionNft, setAndVerifyCollectionV1 } from '@metaplex-foundation/mpl-token-metadata';
import { createGenericFileFromBrowser, createJsonManifest } from '@metaplex-foundation/umi';
import type { Umi } from '@metaplex-foundation/umi';

export async function uploadImageAndJson(umi: Umi, file: File, json: Record<string, any>) {
	const image = await createGenericFileFromBrowser(file);
	const imageUri = await umi.uploader.upload([image]).then((r) => r[0]);
	const fullJson = { image: imageUri, ...json };
	const jsonUri = await umi.uploader.uploadJson(fullJson);
	return { imageUri, jsonUri };
}

export async function mintCollection(umi: Umi, name: string, symbol: string, uri: string) {
	const collectionMint = generateSigner(umi);
	await createCollectionNft(umi, {
		mint: collectionMint,
		name,
		symbol,
		uri,
		sellerFeeBasisPoints: percentAmount(0),
		isMutable: true,
	}).sendAndConfirm(umi);
	return collectionMint.publicKey;
}

export async function mintCouponNft(
	umi: Umi,
	collection: string,
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
		isMutable: true,
		collection: { key: publicKey(collection), verified: false },
	}).sendAndConfirm(umi);
	return mint.publicKey;
}
