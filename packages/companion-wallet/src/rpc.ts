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

  return Promise.all(
    symbols.map(async (sym) => {
      const token = getToken(sym, caip2Chain);
      const raw = token.address
        ? await getTokenBalance(address, token.address, caip2Chain)
        : await getBalance(address, caip2Chain);

      return {
        token: token.symbol,
        balance: formatUnits(raw, token.decimals),
        raw: raw.toString(),
      };
    }),
  );
}

/**
 * Send a transaction: estimate gas, set nonce, sign, and broadcast.
 * Automatically checks balance and bridges from another chain if needed.
 * Returns the transaction hash.
 */
export async function sendTransaction(
  privateKey: Hex,
  transaction: Record<string, unknown>,
  caip2Chain: string,
): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);

  // Check balance and bridge if needed (dynamic import to avoid circular dep)
  try {
    const { swidgeIfNeeded } = await import("./swidge.js");
    const swidgeResult = await swidgeIfNeeded(
      privateKey,
      account.address,
      transaction,
      caip2Chain,
    );
    if (swidgeResult.bridged && swidgeResult.bridgeResult) {
      const br = swidgeResult.bridgeResult;
      process.stderr.write(
        `\nSwidged: ${br.fromAmount} ${br.fromToken} (${br.fromChain}) -> ` +
          `${br.toAmount} ${br.toToken} (${br.toChain})\n\n`,
      );
    }
  } catch (err) {
    // Swidge check is best-effort; log and proceed with transaction
    if (err instanceof Error && !err.message.includes("Cannot find module")) {
      process.stderr.write(
        `Swidge check skipped: ${err.message}\n`,
      );
    }
  }

  const chain = resolveChain(caip2Chain);
  const transport = getTransport(caip2Chain);

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

  return walletClient.sendTransaction(request);
}
