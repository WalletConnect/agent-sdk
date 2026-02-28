import { decodeAbiParameters } from "viem";
import { OPTIMISM_RPC_URL } from "./constants.js";
import type { TxData } from "./contracts.js";

let requestId = 1;

async function rpcRequest<T = string>(
  method: string,
  params: unknown[],
  rpcUrl: string,
): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId++,
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`RPC request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { result?: T; error?: { message: string } };

  if (json.error) {
    throw new Error(`RPC error: ${json.error.message}`);
  }

  return json.result!;
}

async function ethCall(tx: TxData, rpcUrl: string): Promise<string> {
  return rpcRequest("eth_call", [{ to: tx.to, data: tx.data }, "latest"], rpcUrl);
}

/** Read a uint256 from an eth_call result */
export async function readUint256(
  tx: TxData,
  rpcUrl: string = OPTIMISM_RPC_URL,
): Promise<bigint> {
  const result = await ethCall(tx, rpcUrl);
  const [value] = decodeAbiParameters([{ type: "uint256" }], result as `0x${string}`);
  return value;
}

/** Estimate gas for a transaction, with a 20% buffer */
export async function estimateGas(
  from: string,
  tx: TxData,
  rpcUrl: string = OPTIMISM_RPC_URL,
): Promise<string> {
  const result = await rpcRequest(
    "eth_estimateGas",
    [{ from, to: tx.to, data: tx.data, value: "0x0" }, "latest"],
    rpcUrl,
  );
  // Add 20% buffer to the estimate
  const estimate = BigInt(result);
  const buffered = estimate + estimate / 5n;
  return `0x${buffered.toString(16)}`;
}

interface TxReceipt {
  status: string;
  blockNumber: string;
  transactionHash: string;
}

/** Wait for a transaction to be confirmed (polls eth_getTransactionReceipt) */
export async function waitForTx(
  txHash: string,
  rpcUrl: string = OPTIMISM_RPC_URL,
  { intervalMs = 2000, timeoutMs = 60000 } = {},
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = await rpcRequest<TxReceipt | null>(
        "eth_getTransactionReceipt",
        [txHash],
        rpcUrl,
      );
      if (receipt) {
        if (receipt.status === "0x0") {
          throw new Error(`Transaction ${txHash} reverted`);
        }
        return;
      }
    } catch (err) {
      // Re-throw revert errors, swallow "receipt not available yet"
      if (err instanceof Error && err.message.includes("reverted")) throw err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Transaction ${txHash} not confirmed within ${timeoutMs / 1000}s`);
}

/** Read the locks() return: (int128 amount, uint256 end, uint256 transferredAmount) */
export async function readLocks(
  tx: TxData,
  rpcUrl: string = OPTIMISM_RPC_URL,
): Promise<{ amount: bigint; end: bigint; transferredAmount: bigint }> {
  const result = await ethCall(tx, rpcUrl);
  const [amount, end, transferredAmount] = decodeAbiParameters(
    [{ type: "int128" }, { type: "uint256" }, { type: "uint256" }],
    result as `0x${string}`,
  );
  return { amount, end, transferredAmount };
}
