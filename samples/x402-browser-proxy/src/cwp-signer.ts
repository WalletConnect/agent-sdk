import { walletExec } from "@walletconnect/cli-sdk";
import type { ClientEvmSigner } from "@x402/evm";

export interface CwpSignerOptions {
  /** Full path to the wallet-* executable */
  path: string;
  /** EVM account address */
  account: `0x${string}`;
  /** Optional companion-wallet session ID for spending limits */
  sessionId?: string;
}

/**
 * Recursively converts BigInt values to strings so the object is JSON-serializable.
 * walletExec uses JSON.stringify internally, which throws on BigInt.
 */
function bigintToString(obj: unknown): unknown {
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(bigintToString);
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = bigintToString(value);
    }
    return result;
  }
  return obj;
}

/**
 * Creates a ClientEvmSigner that delegates signing to a CWP wallet provider.
 *
 * This bridges the x402 payment signing interface with the CLI Wallet Protocol,
 * allowing any CWP-compatible wallet (e.g., companion-wallet) to sign x402 payments.
 */
export function createCwpSigner(options: CwpSignerOptions): ClientEvmSigner {
  const { path: providerPath, account, sessionId } = options;

  return {
    address: account,

    async signTypedData({
      domain,
      types,
      primaryType,
      message,
    }: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<`0x${string}`> {
      const result = (await walletExec(
        providerPath,
        "sign-typed-data",
        {
          account,
          typedData: bigintToString({ domain, types, primaryType, message }) as Record<string, unknown>,
          ...(sessionId && { sessionId }),
        },
        30000, // 30s timeout for signing
      )) as { signature: `0x${string}` };

      return result.signature;
    },
  };
}
