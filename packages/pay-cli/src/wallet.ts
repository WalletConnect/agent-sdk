import { spawn } from "child_process";
import { selectProvider, walletExec } from "@walletconnect/cli-sdk";
import type { WalletProviderInfo } from "@walletconnect/cli-sdk";
import type { WalletRpcAction } from "./types.js";
import { WALLET_OPERATION_TIMEOUT_MS } from "./constants.js";

export async function selectPaymentWallet(
  chain: string,
  walletName?: string,
): Promise<WalletProviderInfo> {
  const provider = await selectProvider({
    wallet: walletName,
    capability: "send-transaction",
    chain,
  });

  if (!provider) {
    throw new Error("No compatible wallet provider found. Install a CWP wallet provider.");
  }

  return provider;
}

/** Get all CAIP-10 accounts from a CWP provider */
export async function getAllAccounts(providerPath: string): Promise<string[]> {
  const result = (await walletExec(providerPath, "accounts", undefined, 10000)) as {
    accounts: Array<{ address: string; chain: string }>;
  };
  return result.accounts.map((a) => `${a.chain}:${a.address}`);
}

export async function findAccount(
  provider: WalletProviderInfo,
  chain: string,
): Promise<string> {
  const accounts = await getAllAccounts(provider.path);
  const match = accounts.find((a) => a.startsWith(`${chain}:`));
  if (!match) {
    throw new Error(`Wallet "${provider.info?.name ?? "unknown"}" has no account for chain ${chain}.`);
  }
  return match.split(":").pop()!;
}

/**
 * Map unknown RPC methods to CWP operation names for the fallback path.
 * Known methods (eth_signTypedData_v4, eth_sendTransaction) are handled
 * directly by sendTransaction via execWalletconnectCli.
 */
function toCwpInput(
  account: string,
  chain: string,
  rpc: WalletRpcAction,
): { operation: string; input: object } {
  switch (rpc.method) {
    case "personal_sign":
      return { operation: "sign-message", input: { account, message: rpc.params[0] } };
    default:
      return { operation: rpc.method, input: { account, chain, params: rpc.params } };
  }
}

/**
 * Execute a wallet RPC action using the `walletconnect` CLI directly.
 * Bypasses the CWP wallet binary shell script for reliability.
 */
function execWalletconnectCli(
  command: string,
  arg: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("walletconnect", [command, arg], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err: Error & { code?: string }) => {
      reject(new Error(err.code === "ENOENT" ? "walletconnect binary not found" : err.message));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        // Parse JSON from stdout (skip any stderr status lines)
        const lines = stdout.trim().split("\n");
        const jsonLine = lines.find((l) => l.startsWith("{"));
        if (jsonLine) {
          try {
            const parsed = JSON.parse(jsonLine);
            resolve(parsed.signature ?? parsed.transactionHash ?? jsonLine);
          } catch {
            resolve(jsonLine);
          }
        } else {
          resolve(stdout.trim());
        }
      } else {
        reject(new Error(`Wallet operation failed (exit ${code}): ${stderr || stdout}`.trim()));
      }
    });

    proc.stdin.end();
  });
}

export async function sendTransaction(
  _providerPath: string,
  _account: string,
  _chain: string,
  rpc: WalletRpcAction,
): Promise<string> {
  // Use the walletconnect CLI directly for supported methods
  switch (rpc.method) {
    case "eth_signTypedData_v4":
    case "eth_signTypedData": {
      const typedData =
        typeof rpc.params[1] === "string" ? rpc.params[1] : JSON.stringify(rpc.params[1]);
      return execWalletconnectCli("sign-typed-data", typedData, WALLET_OPERATION_TIMEOUT_MS);
    }
    case "eth_sendTransaction": {
      const tx = typeof rpc.params[0] === "string" ? rpc.params[0] : JSON.stringify({
        ...rpc.params[0] as Record<string, unknown>,
        chainId: rpc.chain_id,
      });
      return execWalletconnectCli("send-transaction", tx, WALLET_OPERATION_TIMEOUT_MS);
    }
    default: {
      // Fallback to CWP binary for other methods
      const { operation, input } = toCwpInput(_account, _chain, rpc);
      const result = (await walletExec(
        _providerPath,
        operation,
        input,
        WALLET_OPERATION_TIMEOUT_MS,
      )) as { result?: string; signature?: string; transactionHash?: string } | string;

      if (typeof result === "string") return result;
      return result.signature ?? result.transactionHash ?? result.result ?? JSON.stringify(result);
    }
  }
}
