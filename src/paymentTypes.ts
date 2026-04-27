export interface PaymentConfig {
  enabled: boolean;
  rpcUrl: string | null;
  tokenMint: string | null;
  tokenDecimals: number;
  hotWalletAddress: string | null;
  hotWalletTokenAccount?: string | null;
  treasuryWalletAddress: string | null;
}

export interface EntryPaymentReceipt {
  signature: string;
  wager: string;
  walletAddress: string;
  amountUnc: number;
  verifiedAt: number;
}

export interface EntryPaymentResult {
  ok: boolean;
  message: string;
  receipt?: EntryPaymentReceipt;
}
