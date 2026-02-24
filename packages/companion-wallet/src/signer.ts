import { privateKeyToAccount } from "viem/accounts";
import type { Hex, TransactionSerializable } from "viem";
import { parseChainId } from "./chains.js";

/**
 * Sign a plaintext message.
 */
export async function signMessage(
  privateKey: Hex,
  message: string,
): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  return account.signMessage({ message });
}

/**
 * Sign EIP-712 typed data.
 */
export async function signTypedData(
  privateKey: Hex,
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  },
): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return account.signTypedData(typedData as any);
}

/**
 * Sign a transaction (does not broadcast).
 */
export async function signTransaction(
  privateKey: Hex,
  transaction: Record<string, unknown>,
  caip2Chain: string,
): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  const chainId = parseChainId(caip2Chain);

  const normalized = normalizeTransaction(transaction);
  const tx: TransactionSerializable = {
    ...normalized,
    chainId,
  };

  // Default to EIP-1559 if no type or gas pricing fields are provided
  if (!transaction.type && !transaction.gasPrice && !transaction.maxFeePerGas && !transaction.accessList && !transaction.blobs && !transaction.authorizationList) {
    (tx as Record<string, unknown>).type = "eip1559";
  }

  return account.signTransaction(tx);
}

/**
 * Normalize transaction fields from JSON input to viem types.
 */
export function normalizeTransaction(
  tx: Record<string, unknown>,
): TransactionSerializable {
  return {
    to: tx.to as Hex | undefined,
    value: tx.value !== undefined ? BigInt(tx.value as string | number) : undefined,
    data: tx.data as Hex | undefined,
    nonce: tx.nonce !== undefined ? Number(tx.nonce) : undefined,
    gas: tx.gas !== undefined ? BigInt(tx.gas as string | number) : undefined,
    gasPrice: tx.gasPrice !== undefined ? BigInt(tx.gasPrice as string | number) : undefined,
    maxFeePerGas: tx.maxFeePerGas !== undefined ? BigInt(tx.maxFeePerGas as string | number) : undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas !== undefined ? BigInt(tx.maxPriorityFeePerGas as string | number) : undefined,
  } as TransactionSerializable;
}
