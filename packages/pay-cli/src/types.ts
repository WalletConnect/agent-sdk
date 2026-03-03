// ── Payment Status ───────────────────────────────────────────────────

export type PaymentStatus = "requires_action" | "processing" | "succeeded" | "failed" | "expired";

// ── Amount ──────────────────────────────────────────────────────────

export interface AmountDisplay {
  assetName: string;
  assetSymbol: string;
  decimals: number;
  iconUrl?: string | null;
  networkIconUrl?: string | null;
  networkName?: string | null;
}

export interface Amount {
  display: AmountDisplay;
  unit: string;
  value: string;
}

export interface AmountParameter {
  unit: string;
  value: string;
}

// ── Merchant ────────────────────────────────────────────────────────

export interface MerchantInfo {
  name: string;
  iconUrl?: string | null;
}

// ── Payment ─────────────────────────────────────────────────────────

export interface GetPaymentResponse {
  amount: Amount;
  merchant: MerchantInfo;
  status: PaymentStatus;
  expiresAt: number;
}

// ── Create Payment ──────────────────────────────────────────────────

export interface CreatePaymentInput {
  amount: AmountParameter;
  referenceId: string;
}

export interface CreatePaymentResponse {
  paymentId: string;
  gatewayUrl: string;
  status: PaymentStatus;
  expiresAt: number;
  isFinal: boolean;
  pollInMs?: number | null;
}

// ── Payment Options ─────────────────────────────────────────────────

export interface GetPaymentOptionsRequest {
  accounts: string[];
}

export interface WalletRpcAction {
  chain_id: string;
  method: string;
  params: unknown[];
}

export interface WalletRpcActionWrapper {
  type: "walletRpc";
  data: WalletRpcAction;
}

export interface BuildAction {
  type: "build";
  data: { data: string }; // hex-encoded WalletRpcAction JSON
}

export type Action = WalletRpcActionWrapper | BuildAction;

export interface PaymentOption {
  id: string;
  account: string;
  amount: Amount;
  actions: Action[];
  etaS: number;
  collectData?: CollectDataInfo | null;
}

export interface GetPaymentOptionsResponse {
  options: PaymentOption[];
  info?: GetPaymentResponse | null;
  collectData?: CollectDataInfo | null;
}

// ── Information Capture (Travel Rule) ──────────────────────────────

export interface CollectedData {
  fullName: string;
  dob: string; // YYYY-MM-DD
  tosConfirmed: true;
  pobCountry: string; // ISO 3166-1 alpha-2
  pobAddress: string; // city, state
}

export interface CollectDataField {
  type: string;
  id: string;
  name: string;
  required: boolean;
}

export interface CollectDataInfo {
  fields: CollectDataField[];
  schema: unknown;
  url?: string;
}

// ── Submit Information Capture ──────────────────────────────────────

export interface SubmitInformationCaptureRequest {
  accounts: string[];
  data: Record<string, string | boolean>;
}

export interface SubmitInformationCaptureResponse {
  status: "success" | "pending";
}

// ── Confirm Payment ─────────────────────────────────────────────────

export interface ConfirmPaymentResult {
  type: "walletRpc";
  data: string[];
}

export interface ConfirmPaymentRequest {
  optionId: string;
  results: ConfirmPaymentResult[];
}

export interface ConfirmPaymentResponse {
  status: PaymentStatus;
  isFinal: boolean;
  pollInMs?: number | null;
}

// ── Payment Status Polling ──────────────────────────────────────────

export interface PaymentInformation {
  optionAmount: Amount;
  txId: string;
}

export interface GetPaymentStatusResponse {
  status: PaymentStatus;
  isFinal: boolean;
  pollInMs?: number | null;
  info?: PaymentInformation | null;
}
