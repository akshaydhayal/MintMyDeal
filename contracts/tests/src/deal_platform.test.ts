import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, clusterApiUrl } from "@solana/web3.js";
import { beforeAll, describe, test } from "bun:test";
import * as borsh from "borsh";
import * as bs58 from "bs58";
import { IX, SEEDS } from "./helpers/layout";
import { schemas, serialize, deserialize } from "./helpers/borsh";

function getConnection(): Connection {
	const url = process.env.SOLANA_URL || clusterApiUrl("devnet");
	return new Connection(url, "confirmed");
}

function loadPayer(): Keypair {
	const pk58 = process.env.PRIVATE_KEY_BASE58;
	if (pk58 && pk58.length > 0) {
		return Keypair.fromSecretKey(bs58.default.decode(pk58));
	}
	const keypairPath = process.env.SOLANA_KEYPAIR || `${process.env.HOME}/.config/solana/id.json`;
	try {
		const txt = Bun.file(keypairPath).textSync();
		const arr = JSON.parse(txt) as number[];
		return Keypair.fromSecretKey(Uint8Array.from(arr));
	} catch (e) {
		throw new Error(`Provide PRIVATE_KEY_BASE58 or SOLANA_KEYPAIR (path). Tried ${keypairPath}`);
	}
}

async function programId(): Promise<PublicKey> {
	// Read from program-id file written by deploy script
	const text = await Bun.file("../programs/deal_platform/program-id").text();
	return new PublicKey(text.trim());
}

function u8(i: number) { return Buffer.from([i]); }
function u64LeBytes(n: bigint) {
	const buf = Buffer.alloc(8);
	const view = new DataView(buf.buffer);
	view.setBigUint64(0, n, true);
	return Buffer.from(buf);
}

describe("Deal Platform (Bun + web3.js)", () => {
	let connection: Connection;
	let user: Keypair;
	let program: PublicKey;

	let merchantPda: PublicKey;
	let dealPda: PublicKey;
	let reviewPda: PublicKey;
	let redeemPda: PublicKey;

	let dealId = 1n;

	beforeAll(async () => {
		connection = getConnection();
		user = loadPayer();
		console.log("user", user.publicKey.toBase58());
		program = await programId();
		console.log("program", program.toBase58());

		merchantPda = PublicKey.findProgramAddressSync(
			[SEEDS.MERCHANT, user.publicKey.toBuffer()],
			program,
		)[0];
		dealPda = PublicKey.findProgramAddressSync(
			[SEEDS.DEAL, user.publicKey.toBuffer(), u64LeBytes(dealId)],
			program,
		)[0];
	});

	test("register merchant", async () => {
		const data = Buffer.concat([
			u8(IX.RegisterMerchant),
			serialize(schemas.RegisterMerchantArgs as any, { name: "Demo Merchant", uri: "https://demo" }),
		]);
		const ix = new TransactionInstruction({
			programId: program,
			keys: [
				{ pubkey: user.publicKey, isSigner: true, isWritable: true },
				{ pubkey: merchantPda, isSigner: false, isWritable: true },
				{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
			],
			data,
		});
		const tx = new Transaction().add(ix);
		tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
		tx.sign(user);
		const sig = await connection.sendRawTransaction(tx.serialize());
		await connection.confirmTransaction(sig, "confirmed");
		console.log("register merchant:", sig);
	});

	test("create deal", async () => {
		const data = Buffer.concat([
			u8(IX.CreateDeal),
			serialize(schemas.CreateDealArgs as any, {
				deal_id: dealId,
				title: "10%",
				description: "Save 10%",
				discount_percent: 10,
				expiry: BigInt(Math.floor(Date.now() / 1000) + 86400),
				total_supply: 2,
			}),
		]);
		const ix = new TransactionInstruction({
			programId: program,
			keys: [
				{ pubkey: user.publicKey, isSigner: true, isWritable: true },
				{ pubkey: merchantPda, isSigner: false, isWritable: true },
				{ pubkey: dealPda, isSigner: false, isWritable: true },
				{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
			],
			data,
		});
		const tx = new Transaction().add(ix);
		tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
		tx.sign(user);
		const sig = await connection.sendRawTransaction(tx.serialize());
		await connection.confirmTransaction(sig, "confirmed");
		console.log("create deal:", sig);
	});

	test("mint coupon (counter)", async () => {
		const data = Buffer.concat([
			u8(IX.MintCoupon),
			serialize(schemas.MintCouponArgs as any, { deal_id: dealId }),
		]);
		const ix = new TransactionInstruction({
			programId: program,
			keys: [
				{ pubkey: user.publicKey, isSigner: true, isWritable: false },
				{ pubkey: merchantPda, isSigner: false, isWritable: false },
				{ pubkey: dealPda, isSigner: false, isWritable: true },
			],
			data,
		});
		const tx = new Transaction().add(ix);
		tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
		tx.sign(user);
		const sig = await connection.sendRawTransaction(tx.serialize());
		await connection.confirmTransaction(sig, "confirmed");
		console.log("mint coupon:", sig);
	});

	test("redeem coupon (log)", async () => {
		const fakeMint = Keypair.generate().publicKey; // placeholder mint
		redeemPda = PublicKey.findProgramAddressSync([SEEDS.REDEEM, fakeMint.toBuffer()], program)[0];
		const data = Buffer.concat([
			u8(IX.RedeemCoupon),
			serialize(schemas.RedeemCouponArgs as any, { mint: Array.from(fakeMint.toBytes()) }),
		]);
		const ix = new TransactionInstruction({
			programId: program,
			keys: [
				{ pubkey: user.publicKey, isSigner: true, isWritable: false },
				{ pubkey: redeemPda, isSigner: false, isWritable: true },
				{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
			],
			data,
		});
		const tx = new Transaction().add(ix);
		tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
		tx.sign(user);
		const sig = await connection.sendRawTransaction(tx.serialize());
		await connection.confirmTransaction(sig, "confirmed");
		console.log("redeem coupon:", sig);
	});

	test("add review", async () => {
		reviewPda = PublicKey.findProgramAddressSync([SEEDS.REVIEW, dealPda.toBuffer(), user.publicKey.toBuffer()], program)[0];
		const data = Buffer.concat([
			u8(IX.AddReview),
			serialize(schemas.AddReviewArgs as any, { deal_id: dealId, rating: 5, comment: "Great" }),
		]);
		const ix = new TransactionInstruction({
			programId: program,
			keys: [
				{ pubkey: user.publicKey, isSigner: true, isWritable: false },
				{ pubkey: merchantPda, isSigner: false, isWritable: false },
				{ pubkey: dealPda, isSigner: false, isWritable: false },
				{ pubkey: reviewPda, isSigner: false, isWritable: true },
				{ pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
			],
			data,
		});
		const tx = new Transaction().add(ix);
		tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
		tx.sign(user);
		const sig = await connection.sendRawTransaction(tx.serialize());
		await connection.confirmTransaction(sig, "confirmed");
		console.log("add review:", sig);
	});
});
