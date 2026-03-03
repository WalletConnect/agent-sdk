import { deserializeTSR, serializeTSR } from "./tsr.js";
import { pollPaymentStatus } from "./api.js";
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
import type { PayClient } from "./api.js";

const SERVER_FN_BASE = "/_serverFn";

const SERVER_FNS = {
  getPayment: "getPaymentFn_createServerFn_handler",
  createPayment: "createPaymentFn_createServerFn_handler",
  getPaymentOptions: "getPaymentOptionsFn_createServerFn_handler",
  confirmPayment: "confirmPaymentFn_createServerFn_handler",
  getPaymentStatus: "getPaymentStatusFn_createServerFn_handler",
  submitInformationCapture: "submitInformationCaptureFn_createServerFn_handler",
} as const;

export interface FrontendClientOptions {
  /** Frontend URL, e.g. "https://staging.pay.walletconnect.com" */
  frontendUrl: string;
}

/** The TanStack Start server function response envelope */
interface ServerFnEnvelope<T> {
  result: EngineResponse<T>;
  error: unknown;
  context: unknown;
}

/** The EngineResponse wrapper from the backend */
type EngineResponse<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: { code: string; message?: string } };

async function callServerFn<T>(
  frontendUrl: string,
  fnName: string,
  data: unknown,
): Promise<T> {
  const url = `${frontendUrl}${SERVER_FN_BASE}/${fnName}`;
  // TanStack Start expects seroval-encoded payloads via fromJSON()
  // Must use application/json — FormData passes raw FormData to handler
  // The payload must wrap input in { data } to match how the handler destructures
  const serialized = serializeTSR({ data });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-tsr-serverFn": "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(serialized),
  });

  if (!res.ok) {
    throw new Error(`Server function error: ${res.status} ${res.statusText}`);
  }

  const raw = await res.json();
  const envelope = deserializeTSR<ServerFnEnvelope<T>>(raw);

  // Check for TanStack-level errors
  if (envelope.error !== undefined && envelope.error !== null) {
    const errMsg = envelope.error instanceof Error ? envelope.error.message : String(envelope.error);
    throw new Error(`Server function error: ${errMsg}`);
  }

  // Unwrap EngineResponse
  const engineResult = envelope.result;
  if (engineResult.status === "error") {
    const { code, message } = engineResult.error;
    throw new Error(`${code}: ${message ?? "Unknown error"}`);
  }

  return engineResult.data;
}

/**
 * Create a PayClient that proxies through the frontend's TanStack Start
 * server functions. No API keys required — the frontend injects its own
 * credentials server-side.
 */
export function createFrontendPayClient(options: FrontendClientOptions): PayClient {
  const { frontendUrl } = options;

  const client: PayClient = {
    async createPayment(input: CreatePaymentInput) {
      return callServerFn<CreatePaymentResponse>(frontendUrl, SERVER_FNS.createPayment, {
        body: input,
      });
    },

    async getPayment(id: string) {
      return callServerFn<GetPaymentResponse>(frontendUrl, SERVER_FNS.getPayment, {
        paymentId: id,
      });
    },

    async getPaymentOptions(id: string, request: GetPaymentOptionsRequest) {
      return callServerFn<GetPaymentOptionsResponse>(frontendUrl, SERVER_FNS.getPaymentOptions, {
        paymentId: id,
        request,
      });
    },

    async confirmPayment(id: string, request: ConfirmPaymentRequest) {
      return callServerFn<ConfirmPaymentResponse>(frontendUrl, SERVER_FNS.confirmPayment, {
        paymentId: id,
        request,
      });
    },

    async submitInformationCapture(id: string, request: SubmitInformationCaptureRequest) {
      return callServerFn<SubmitInformationCaptureResponse>(
        frontendUrl,
        SERVER_FNS.submitInformationCapture,
        { paymentId: id, request },
      );
    },

    async getPaymentStatus(id: string) {
      return callServerFn<GetPaymentStatusResponse>(frontendUrl, SERVER_FNS.getPaymentStatus, {
        paymentId: id,
      });
    },

    async pollStatus(id: string) {
      return pollPaymentStatus((pid) => client.getPaymentStatus(pid), id);
    },
  };

  return client;
}
