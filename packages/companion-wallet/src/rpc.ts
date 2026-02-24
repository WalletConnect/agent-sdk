import {
  createWalletClient,
  createPublicClient,
  type Hex,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChain, getTransport } from "./chains.js";
import { normalizeTransaction } from "./signer.js";
import { getTokenSymbols, getToken } from "./tokens.js";
import type { BalanceEntry } from "./types.js";

/**
 * Get the native token balance for an address on a chain.
 */
export async function getBalance(address: Hex, caip2Chain: string): Promise<bigint> {
  const chain = resolveChain(caip2Chain);
  const transport = getTransport(caip2Chain);
  const client = createPublicClient({ chain, transport });
  return client.getBalance({ address });
}

const ERC20_BALANCE_OF_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Get the ERC-20 token balance for an address on a chain.
 */
export async function getTokenBalance(
  address: Hex,
  tokenAddress: Hex,
  caip2Chain: string,
): Promise<bigint> {
  const chain = resolveChain(caip2Chain);
  const transport = getTransport(caip2Chain);
  const client = createPublicClient({ chain, transport });
  return client.readContract({
    address: tokenAddress,
    abi: ERC20_BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [address],
  });
}

/**
 * Get all token balances (native ETH + registered ERC-20s) for an address on a chain.
 */
export async function getBalances(
  address: Hex,
  caip2Chain: string,
): Promise<BalanceEntry[]> {
  const symbols = getTokenSymbols(caip2Chain);

  const entries = await Promise.all(
    symbols.map(async (sym) => {
      const token = getToken(sym, caip2Chain);
      let raw: bigint;

      if (token.address) {
        raw = await getTokenBalance(address, token.address, caip2Chain);
      } else {
        raw = await getBalance(address, caip2Chain);
      }

      return {
        token: token.symbol,
        balance: formatUnits(raw, token.decimals),
        raw: raw.toString(),
      };
    }),
  );

  return entries;
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
