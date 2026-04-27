import bs58 from 'bs58';
import {
  Connection,
  Keypair,
  PublicKey,
  type ParsedInstruction,
  type PartiallyDecodedInstruction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import type { EntryPaymentReceipt, EntryPaymentResult, PaymentConfig } from './paymentTypes';

const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.VITE_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const tokenMint = process.env.UNC_TOKEN_MINT ?? process.env.VITE_UNC_TOKEN_MINT ?? null;
const tokenDecimals = Number(process.env.UNC_TOKEN_DECIMALS ?? process.env.VITE_UNC_TOKEN_DECIMALS ?? 6);
const hotWalletAddress = process.env.HOT_WALLET_ADDRESS ?? null;
const hotWalletSecret = process.env.HOT_WALLET_SECRET_KEY ?? null;
const treasuryWalletAddress = process.env.TREASURY_WALLET_ADDRESS ?? null;

const connection = new Connection(rpcUrl, 'confirmed');

function parseSecretKey(secret: string) {
  const trimmed = secret.trim();
  if (trimmed.startsWith('[')) {
    return Uint8Array.from(JSON.parse(trimmed) as number[]);
  }

  return bs58.decode(trimmed);
}

function getHotWalletKeypair() {
  if (!hotWalletSecret) {
    return null;
  }

  return Keypair.fromSecretKey(parseSecretKey(hotWalletSecret));
}

function tokenAmountToBaseUnits(amountUnc: number) {
  const fixed = amountUnc.toFixed(tokenDecimals);
  const [whole, fraction = ''] = fixed.split('.');
  return BigInt(`${whole}${fraction.padEnd(tokenDecimals, '0')}`);
}

function baseUnitsToTokenNumber(baseUnits: bigint) {
  return Number(baseUnits) / (10 ** tokenDecimals);
}

function isParsedInstruction(instruction: ParsedInstruction | PartiallyDecodedInstruction): instruction is ParsedInstruction {
  return 'parsed' in instruction;
}

export function getPaymentConfig(): PaymentConfig {
  const enabled = Boolean(tokenMint && hotWalletAddress && treasuryWalletAddress);

  return {
    enabled,
    rpcUrl,
    tokenMint,
    tokenDecimals: Number.isFinite(tokenDecimals) ? tokenDecimals : 6,
    hotWalletAddress,
    treasuryWalletAddress,
  };
}

export function getHotWalletTokenAccount() {
  if (!tokenMint || !hotWalletAddress) {
    return null;
  }

  return getAssociatedTokenAddressSync(
    new PublicKey(tokenMint),
    new PublicKey(hotWalletAddress),
    true,
  ).toBase58();
}

export async function verifyEntryPayment(input: {
  signature: string;
  wager: string;
  walletAddress: string;
  amountUnc: number;
}): Promise<EntryPaymentResult> {
  const config = getPaymentConfig();
  if (!config.enabled || !tokenMint || !hotWalletAddress) {
    return { ok: false, message: 'Wager payments are not configured on the server yet.' };
  }

  const expectedAmount = tokenAmountToBaseUnits(input.amountUnc);
  const expectedDestination = getHotWalletTokenAccount();
  if (!expectedDestination) {
    return { ok: false, message: 'Hot wallet token account is not configured.' };
  }

  const tx = await connection.getParsedTransaction(input.signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx || tx.meta?.err) {
    return { ok: false, message: 'Payment transaction is not confirmed successfully.' };
  }

  for (const instruction of tx.transaction.message.instructions) {
    if (!isParsedInstruction(instruction) || instruction.program !== 'spl-token') {
      continue;
    }

    const parsed = instruction.parsed;
    if (parsed?.type !== 'transferChecked' && parsed?.type !== 'transfer') {
      continue;
    }

    const info = parsed.info ?? {};
    const mintMatches = !info.mint || info.mint === tokenMint;
    const authorityMatches = info.authority === input.walletAddress || info.multisigAuthority === input.walletAddress;
    const destinationMatches = info.destination === expectedDestination;
    const amount = info.tokenAmount?.amount
      ? BigInt(info.tokenAmount.amount)
      : BigInt(info.amount ?? '0');

    if (mintMatches && authorityMatches && destinationMatches && amount >= expectedAmount) {
      return {
        ok: true,
        message: 'Entry payment verified.',
        receipt: {
          signature: input.signature,
          wager: input.wager,
          walletAddress: input.walletAddress,
          amountUnc: baseUnitsToTokenNumber(amount),
          verifiedAt: Date.now(),
        },
      };
    }
  }

  return { ok: false, message: 'Transaction did not contain the required $UNC entry transfer.' };
}

export async function settleMatchPayout(input: {
  winnerWalletAddress: string | null;
  grossPotUnc: number;
  houseFeeUnc: number;
  payoutPoolUnc: number;
}) {
  const config = getPaymentConfig();
  const hotWallet = getHotWalletKeypair();
  if (!config.enabled || !hotWallet || !tokenMint || !treasuryWalletAddress || !input.winnerWalletAddress) {
    return {
      ok: false,
      message: 'Payout skipped because hot wallet, treasury, token mint, or winner wallet is not configured.',
      signatures: [] as string[],
    };
  }

  const mint = new PublicKey(tokenMint);
  const sourceAta = getAssociatedTokenAddressSync(mint, hotWallet.publicKey, true);
  const treasury = new PublicKey(treasuryWalletAddress);
  const winner = new PublicKey(input.winnerWalletAddress);
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury, true);
  const winnerAta = getAssociatedTokenAddressSync(mint, winner, true);
  const signatures: string[] = [];

  const tx = new Transaction();
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(hotWallet.publicKey, treasuryAta, treasury, mint),
    createAssociatedTokenAccountIdempotentInstruction(hotWallet.publicKey, winnerAta, winner, mint),
  );

  const feeAmount = tokenAmountToBaseUnits(input.houseFeeUnc);
  const payoutAmount = tokenAmountToBaseUnits(input.payoutPoolUnc);

  if (feeAmount > 0n) {
    tx.add(createTransferCheckedInstruction(sourceAta, mint, treasuryAta, hotWallet.publicKey, feeAmount, tokenDecimals));
  }

  if (payoutAmount > 0n) {
    tx.add(createTransferCheckedInstruction(sourceAta, mint, winnerAta, hotWallet.publicKey, payoutAmount, tokenDecimals));
  }

  if (tx.instructions.length <= 2) {
    return { ok: true, message: 'No paid payout required.', signatures };
  }

  const signature = await sendAndConfirmTransaction(connection, tx, [hotWallet], { commitment: 'confirmed' });
  signatures.push(signature);
  return { ok: true, message: 'Match payout settled.', signatures };
}
