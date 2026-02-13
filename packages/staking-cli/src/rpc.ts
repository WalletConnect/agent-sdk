import { decodeAbiParameters } from "viem";
import { OPTIMISM_RPC_URL } from "./constants.js";
import type { TxData } from "./contracts.js";

let requestId = 1;

async function rpcRequest(
  method: string,
  params: unknown[],
  rpcUrl: string,
): Promise<string> {
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

  const json = (await res.json()) as { result?: string; error?: { message: string } };

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

/** Wait for a transaction to be confirmed (polls eth_getTransactionReceipt) */
export async function waitForTx(
  txHash: string,
  rpcUrl: string = OPTIMISM_RPC_URL,
  { intervalMs = 2000, timeoutMs = 60000 } = {},
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await rpcRequest(
        "eth_getTransactionReceipt",
        [txHash],
        rpcUrl,
      );
      if (result) return;
    } catch {
      // receipt not available yet
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
  return { amount: BigInt(amount), end, transferredAmount };
}
