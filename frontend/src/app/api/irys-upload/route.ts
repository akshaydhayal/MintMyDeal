import { NextResponse } from 'next/server'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { createGenericFile, createSignerFromKeypair, signerIdentity } from '@metaplex-foundation/umi'
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'

export const runtime = 'nodejs'

export async function POST(request: Request) {
	try {
		const form = await request.formData()
		const name = String(form.get('name') || '')
		const description = String(form.get('description') || '')
		const image = form.get('image') as File | null
		if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

		const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com'
		const sk58 = process.env.IRYS_PRIVATE_KEY_BASE58 || ''
		if (!sk58) return NextResponse.json({ error: 'IRYS_PRIVATE_KEY_BASE58 missing' }, { status: 500 })
		const kp = Keypair.fromSecretKey(bs58.decode(sk58))
		const umi = createUmi(rpc).use(irysUploader()).use(signerIdentity(createSignerFromKeypair(createUmi(rpc), { publicKey: kp.publicKey as any, secretKey: kp.secretKey as any } as any)))

		let files: any[] = []
		if (image) {
			const buf = new Uint8Array(await image.arrayBuffer())
			files = [createGenericFile(buf, (image as any).name || 'image.png', { contentType: image.type || 'application/octet-stream' })]
		}
		
		let imageUri: string | undefined = undefined
		if (files.length) {
			console.log('📤 Uploading image to Irys...')
			;[imageUri] = await umi.uploader.upload(files)
			console.log('🖼️  Image uploaded:', imageUri)
		}
		
		const metadata = imageUri
			? {
					name,
					description,
					image: imageUri,
					attributes: [],
					properties: {
						files: [
							{
								uri: imageUri,
								type: 'image/png',
							},
						],
						category: 'image',
					},
			  }
			: { name, description, attributes: [] }
		
		console.log('📤 Uploading metadata to Irys...')
		const metadataUri = await umi.uploader.uploadJson(metadata)
		console.log('✅ Metadata uploaded:', metadataUri)
		return NextResponse.json({ imageUri, metadataUri })
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'upload failed' }, { status: 500 })
	}
}
