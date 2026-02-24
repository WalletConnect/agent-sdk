/** CWP exit codes per CAIP-397 */
export const ExitCode = {
  SUCCESS: 0,
  ERROR: 1,
  UNSUPPORTED: 2,
  REJECTED: 3,
  TIMEOUT: 4,
  NOT_CONNECTED: 5,
  SESSION_ERROR: 6,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** CWP operations */
export type Operation =
  | "info"
  | "generate"
  | "accounts"
  | "sign-message"
  | "sign-typed-data"
  | "sign-transaction"
  | "send-transaction"
  | "grant-session"
  | "revoke-session"
  | "get-session"
  | "balance"
  | "fund"
  | "drain";

/** Info response */
export interface InfoResponse {
  name: string;
  version: string;
  rdns: string;
  capabilities: string[];
  chains: string[];
}

/** Account entry */
export interface AccountEntry {
  chain: string;
  address: string;
}

/** Accounts response */
export interface AccountsResponse {
  accounts: AccountEntry[];
}

/** Sign message input */
export interface SignMessageInput {
  account: string;
  message: string;
  sessionId?: string;
}

/** Sign typed data input */
export interface SignTypedDataInput {
  account: string;
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  };
  sessionId?: string;
}

/** Sign transaction input */
export interface SignTransactionInput {
  account: string;
  transaction: Record<string, unknown>;
  chain: string;
  sessionId?: string;
}

/** Send transaction input */
export interface SendTransactionInput {
  account: string;
  transaction: Record<string, unknown>;
  chain: string;
  sessionId?: string;
}

/** Signature response */
export interface SignatureResponse {
  signature: string;
}

/** Signed transaction response */
export interface SignedTransactionResponse {
  signedTransaction: string;
}

/** Transaction hash response */
export interface TransactionHashResponse {
  transactionHash: string;
}

/** Session permission */
export interface SessionPermission {
  operation: string;
  policies?: SessionPolicy[];
}

/** Session policy */
export interface SessionPolicy {
  type: "value-limit" | "recipient-allowlist" | "call-limit";
  params: Record<string, unknown>;
}

/** Grant session input */
export interface GrantSessionInput {
  account: string;
  chain: string;
  permissions: SessionPermission[];
  expiry: number;
}

/** Grant session response */
export interface GrantSessionResponse {
  sessionId: string;
  permissions: SessionPermission[];
  expiry: number;
}

/** Revoke session input */
export interface RevokeSessionInput {
  sessionId: string;
}

/** Revoke session response */
export interface RevokeSessionResponse {
  revoked: true;
}

/** Get session input */
export interface GetSessionInput {
  sessionId: string;
}

/** Stored session state */
export interface SessionState {
  sessionId: string;
  account: string;
  chain: string;
  permissions: SessionPermission[];
  expiry: number;
  revoked: boolean;
  callCounts: Record<string, number>;
  totalValue: Record<string, string>;
}

/** Balance input */
export interface BalanceInput {
  account: string;
  chain: string;
}

/** Individual token balance entry */
export interface BalanceEntry {
  token: string;
  balance: string;
  raw: string;
}

/** Balance response */
export interface BalanceResponse {
  balances: BalanceEntry[];
}

/** CWP error response written to stdout on failure */
export interface ErrorResponse {
  error: string;
  code: string;
}

/** Wallet file stored on disk (mnemonic-based) */
export interface WalletFile {
  version: 2;
  address: string;
  mnemonic: string;
}
