import { PAY_API_PROD, PAY_API_STAGING, WCP_VERSION, SDK_NAME, SDK_PLATFORM, DEFAULT_POLL_INTERVAL_MS, MAX_POLL_DURATION_MS } from "./constants.js";
import type {
  CreatePaymentInput,
  CreatePaymentResponse,
  GetPaymentResponse,
  GetPaymentOptionsRequest,
  GetPaymentOptionsResponse,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  GetPaymentStatusResponse,
  SubmitInformationCaptureRequest,
  SubmitInformationCaptureResponse,
} from "./types.js";

export interface PayClientOptions {
  baseUrl?: string;
  staging?: boolean;
  /** Wallet API key for gateway endpoints (checkout, status) */
  walletApiKey: string;
  /** Partner API key for merchant endpoints (create) — optional */
  partnerApiKey?: string;
  /** Merchant ID for merchant endpoints (create) — optional */
  merchantId?: string;
  sdkVersion: string;
}

export interface PayClient {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResponse>;
  getPayment(id: string): Promise<GetPaymentResponse>;
  getPaymentOptions(id: string, request: GetPaymentOptionsRequest): Promise<GetPaymentOptionsResponse>;
  confirmPayment(id: string, request: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse>;
  submitInformationCapture?(id: string, request: SubmitInformationCaptureRequest): Promise<SubmitInformationCaptureResponse>;
  getPaymentStatus(id: string): Promise<GetPaymentStatusResponse>;
  pollStatus(id: string): Promise<GetPaymentStatusResponse>;
}

/** Shared polling loop used by both direct and frontend clients */
export async function pollPaymentStatus(
  getStatus: (id: string) => Promise<GetPaymentStatusResponse>,
  id: string,
): Promise<GetPaymentStatusResponse> {
  const deadline = Date.now() + MAX_POLL_DURATION_MS;
  while (Date.now() < deadline) {
    const status = await getStatus(id);
    if (status.isFinal) return status;
    const delay = status.pollInMs ?? DEFAULT_POLL_INTERVAL_MS;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error("Payment status polling timed out");
}

export function createPayClient(options: PayClientOptions): PayClient {
  const baseUrl = options.baseUrl ?? (options.staging ? PAY_API_STAGING : PAY_API_PROD);

  const sdkHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Wcp-Version": WCP_VERSION,
    "Sdk-Name": SDK_NAME,
    "Sdk-Version": options.sdkVersion,
    "Sdk-Platform": SDK_PLATFORM,
  };

  const gwHeaders: Record<string, string> = { ...sdkHeaders, "Api-Key": options.walletApiKey };

  function merchantHeaders(): Record<string, string> {
    if (!options.partnerApiKey || !options.merchantId) {
      throw new Error("Partner API key and Merchant ID are required for merchant operations");
    }
    return {
      ...sdkHeaders,
      "Api-Key": options.partnerApiKey,
      "Merchant-Id": options.merchantId,
    };
  }

  async function request<T>(
    path: string,
    headers: Record<string, string>,
    init?: { method?: string; body?: string },
  ): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let message = `Pay API error: ${res.status} ${res.statusText}`;
      if (body) {
        try {
          const parsed = JSON.parse(body) as { code?: string; message?: string };
          if (parsed.message) message = `${parsed.code ?? "ERROR"}: ${parsed.message}`;
        } catch {
          message += ` — ${body}`;
        }
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
  }

  const client: PayClient = {
    async createPayment(input) {
      return request<CreatePaymentResponse>("/v1/merchant/payment", merchantHeaders(), {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    async getPayment(id) {
      return request<GetPaymentResponse>(`/v1/gateway/payment/${id}`, gwHeaders);
    },

    async getPaymentOptions(id, body) {
      return request<GetPaymentOptionsResponse>(`/v1/gateway/payment/${id}/options`, gwHeaders, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    async confirmPayment(id, body) {
      return request<ConfirmPaymentResponse>(`/v1/gateway/payment/${id}/confirm`, gwHeaders, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    async getPaymentStatus(id) {
      return request<GetPaymentStatusResponse>(`/v1/gateway/payment/${id}/status`, gwHeaders);
    },

    async pollStatus(id) {
      return pollPaymentStatus((pid) => client.getPaymentStatus(pid), id);
    },
  };

  return client;
}
