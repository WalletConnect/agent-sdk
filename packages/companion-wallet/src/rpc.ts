import {
  createWalletClient,
  createPublicClient,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChain, getTransport } from "./chains.js";
import { normalizeTransaction } from "./signer.js";

/**
 * Get the native token balance for an address on a chain.
 */
export async function getBalance(address: Hex, caip2Chain: string): Promise<bigint> {
  const chain = resolveChain(caip2Chain);
  const transport = getTransport(caip2Chain);
  const client = createPublicClient({ chain, transport });
  return client.getBalance({ address });
}

/**
 * Send a transaction: estimate gas, set nonce, sign, and broadcast.
 * Returns the transaction hash.
 */
export async function sendTransaction(
  privateKey: Hex,
  transaction: Record<string, unknown>,
  caip2Chain: string,
): Promise<Hex> {
  const chain = resolveChain(caip2Chain);
  const transport = getTransport(caip2Chain);
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const normalized = normalizeTransaction(transaction);

  const request = {
    to: normalized.to as Hex,
    value: normalized.value,
    data: normalized.data as Hex | undefined,
    nonce: normalized.nonce,
    gas: normalized.gas,
    account,
    chain,
  };

  // Estimate gas if not provided
  if (!request.gas) {
    request.gas = await publicClient.estimateGas({
      account: account.address,
      to: request.to,
      value: request.value,
      data: request.data,
    });
  }

  const hash = await walletClient.sendTransaction(request);
  return hash;
}
