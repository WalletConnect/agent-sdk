import { ExactEvmScheme } from "@x402/evm";
import type { ClientEvmSigner } from "@x402/evm";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type {
  PaymentRequirements,
  PaymentRequired,
} from "@x402/core/types";
import { logger } from "./logger.js";

export interface X402ClientHandle {
  httpClient: x402HTTPClient;
  walletAddress: `0x${string}`;
}

/**
 * Initialize the x402 client with a CWP-backed signer.
 */
export function initializeClient(signer: ClientEvmSigner): X402ClientHandle {
  const client = new x402Client();
  const evmScheme = new ExactEvmScheme(signer);
  client.register("eip155:*", evmScheme);

  const httpClient = new x402HTTPClient(client);

  logger.info(`Initialized x402 client with wallet: ${signer.address}`);

  return { httpClient, walletAddress: signer.address };
}

export function parsePaymentHeader(
  headerValue: string,
): PaymentRequired | null {
  try {
    const decoded = Buffer.from(headerValue, "base64").toString("utf-8");
    const paymentRequired = JSON.parse(decoded) as PaymentRequired;

    // If resource is missing but is in accepts[0].extra, copy it up
    if (
      !paymentRequired.resource &&
      paymentRequired.accepts?.length > 0
    ) {
      const firstAccept = paymentRequired.accepts[0] as Record<string, unknown>;
      const extra = firstAccept.extra as Record<string, string> | undefined;
      if (extra?.resource) {
        paymentRequired.resource = {
          url: extra.resource,
          description: extra.description || "",
          mimeType: extra.mimeType || "application/json",
        };
      }
    }

    return paymentRequired;
  } catch (error) {
    logger.error("Failed to parse payment header:", error);
    return null;
  }
}

export async function signPayment(
  httpClient: x402HTTPClient,
  paymentRequired: PaymentRequired,
  maxPayment: bigint,
): Promise<Record<string, string> | null> {
  const accepts = paymentRequired.accepts || [];
  if (accepts.length === 0) {
    logger.error("No payment options available in requirements");
    return null;
  }

  const paymentReq = accepts[0] as PaymentRequirements;
  const amount = BigInt(paymentReq.amount);

  if (amount > maxPayment) {
    logger.warn(
      `Payment amount ${amount} exceeds max allowed ${maxPayment}. Rejecting.`,
    );
    return null;
  }

  const resourceUrl =
    paymentRequired.resource?.url ||
    (paymentReq.extra as Record<string, string> | undefined)?.resource ||
    "unknown";
  logger.payment(
    `Signing payment: ${paymentReq.amount} on ${paymentReq.network} for ${resourceUrl}`,
  );

  try {
    const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);

    if (process.env.DEBUG) {
      logger.debug(
        `Payment payload: ${JSON.stringify(paymentPayload, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`,
      );
    }

    const headers = httpClient.encodePaymentSignatureHeader(paymentPayload);

    if (process.env.DEBUG) {
      logger.debug(`Payment headers: ${JSON.stringify(headers)}`);
    }

    return headers;
  } catch (error) {
    logger.error("Failed to sign payment:", error);
    return null;
  }
}
