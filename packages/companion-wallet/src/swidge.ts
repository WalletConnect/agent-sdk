import {
  createConfig,
  EVM,
  getQuote,
  convertQuoteToRoute,
  executeRoute,
  type RouteExtended,
} from "@lifi/sdk";
import {
  createWalletClient,
  createPublicClient,
  http,
  type Hex,
  formatUnits,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  resolveChain,
  getTransport,
  parseChainId,
  resolveChainByNumericId,
  SUPPORTED_CHAINS,
} from "./chains.js";
import { getBalance, getTokenBalance, getBalances } from "./rpc.js";
import {
  getToken,
  getLifiTokenAddress,
  parseTokenAmount,
  findTokenSymbolByAddress,
} from "./tokens.js";
import { ask } from "./prompt.js";
import type {
  BalanceEntry,
  SwidgeNeeded,
  SwidgeResult,
  BridgeResult,
  SwidgeOptions,
} from "./types.js";

/** Track LI.FI SDK init state by account address (not private key) */
let lifiInitAddress: string | null = null;

/** Initialize LI.FI SDK with companion wallet's viem wallet client */
function initLifi(privateKey: Hex): void {
  const account = privateKeyToAccount(privateKey);
  if (lifiInitAddress === account.address) return;

  createConfig({
    integrator: "walletconnect-agent-sdk",
    providers: [
      EVM({
        getWalletClient: async () =>
          createWalletClient({
            account,
            chain: mainnet,
            transport: http(mainnet.rpcUrls.default.http[0]),
          }),
        switchChain: async (chainId: number) => {
          const chain = resolveChainByNumericId(chainId);
          return createWalletClient({
            account,
            chain,
            transport: http(chain.rpcUrls.default.http[0]),
          });
        },
      }),
    ],
  });

  lifiInitAddress = account.address;
}

/** Check if a transaction has sufficient funds, returns deficit details if not */
export async function checkSufficiency(
  address: Hex,
  tx: Record<string, unknown>,
  caip2Chain: string,
): Promise<SwidgeNeeded | null> {
  const chain = resolveChain(caip2Chain);
  const transport = getTransport(caip2Chain);
  const publicClient = createPublicClient({ chain, transport });

  const nativeBalance = await getBalance(address, caip2Chain);

  // Estimate gas cost
  let gasCost: bigint;
  try {
    const gas = await publicClient.estimateGas({
      account: address,
      to: tx.to as Hex,
      value: tx.value ? BigInt(tx.value as string | number) : undefined,
      data: tx.data as Hex | undefined,
    });
    const gasPrice = await publicClient.getGasPrice();
    gasCost = gas * gasPrice;
  } catch {
    // Fallback: 21k gas * 50 gwei
    gasCost = 21_000n * 50_000_000_000n;
  }

  const data = (tx.data as string | undefined) || "";
  const value = tx.value ? BigInt(tx.value as string | number) : 0n;

  // ERC-20 transfer (selector: 0xa9059cbb)
  if (data.startsWith("0xa9059cbb") && tx.to) {
    const amountHex = "0x" + data.slice(74, 138);
    const transferAmount = BigInt(amountHex);
    const tokenBalance = await getTokenBalance(
      address,
      tx.to as Hex,
      caip2Chain,
    );

    if (tokenBalance < transferAmount) {
      const tokenSymbol = findTokenSymbolByAddress(
        tx.to as string,
        caip2Chain,
      );
      return {
        token: tokenSymbol || (tx.to as string),
        needed: transferAmount,
        available: tokenBalance,
        deficit: transferAmount - tokenBalance,
        isGas: false,
      };
    }

    if (nativeBalance < gasCost) {
      return {
        token: "eth",
        needed: gasCost,
        available: nativeBalance,
        deficit: gasCost - nativeBalance,
        isGas: true,
      };
    }

    return null;
  }

  // ERC-20 approve (selector: 0x095ea7b3) - only need gas
  if (data.startsWith("0x095ea7b3")) {
    if (nativeBalance < gasCost) {
      return {
        token: "eth",
        needed: gasCost,
        available: nativeBalance,
        deficit: gasCost - nativeBalance,
        isGas: true,
      };
    }
    return null;
  }

  // Native transfer or generic contract call
  const totalNeeded = value + gasCost;
  if (nativeBalance < totalNeeded) {
    return {
      token: "eth",
      needed: totalNeeded,
      available: nativeBalance,
      deficit: totalNeeded - nativeBalance,
      isGas: value === 0n,
    };
  }

  return null;
}

/** Scan supported chains for token balances, optionally excluding a chain */
export async function scanAllBalances(
  address: Hex,
  excludeChain?: string,
): Promise<Map<string, BalanceEntry[]>> {
  const chains = excludeChain
    ? SUPPORTED_CHAINS.filter((c) => c !== excludeChain)
    : SUPPORTED_CHAINS;
  const result = new Map<string, BalanceEntry[]>();
  await Promise.all(
    chains.map(async (chain) => {
      try {
        const balances = await getBalances(address, chain);
        result.set(chain, balances);
      } catch {
        result.set(chain, []);
      }
    }),
  );
  return result;
}

/** Source candidate for bridging */
interface SourceCandidate {
  chain: string;
  token: string;
  balance: bigint;
  decimals: number;
}

/** Find the best source chain/token with enough funds to bridge */
export function findBestSource(
  allBalances: Map<string, BalanceEntry[]>,
  targetChain: string,
  targetToken: string,
): SourceCandidate | null {
  let best: SourceCandidate | null = null;

  for (const [chain, balances] of allBalances) {
    if (chain === targetChain) continue;

    for (const entry of balances) {
      const raw = BigInt(entry.raw);
      if (raw === 0n) continue;

      const sym = entry.token.toLowerCase();
      let tokenInfo;
      try {
        tokenInfo = getToken(sym, chain);
      } catch {
        continue;
      }

      const candidate: SourceCandidate = {
        chain,
        token: sym,
        balance: raw,
        decimals: tokenInfo.decimals,
      };

      // Prefer same token on another chain
      if (sym === targetToken.toLowerCase()) {
        if (
          !best ||
          best.token !== targetToken.toLowerCase() ||
          raw > best.balance
        ) {
          best = candidate;
        }
      } else if (!best || best.token !== targetToken.toLowerCase()) {
        // Any token with balance as fallback (prefer higher balance)
        if (!best || raw > best.balance) {
          best = candidate;
        }
      }
    }
  }

  return best;
}

/** Core LI.FI route execution — shared by swidgeIfNeeded and swidge */
async function executeLifiRoute(
  privateKey: Hex,
  fromChain: string,
  toChain: string,
  fromToken: string,
  toToken: string,
  amount: bigint,
): Promise<BridgeResult> {
  initLifi(privateKey);

  const account = privateKeyToAccount(privateKey);
  const fromChainId = parseChainId(fromChain);
  const toChainId = parseChainId(toChain);
  const fromTokenAddress = getLifiTokenAddress(fromToken, fromChain);
  const toTokenAddress = getLifiTokenAddress(toToken, toChain);

  const quote = await getQuote({
    fromChain: fromChainId,
    toChain: toChainId,
    fromToken: fromTokenAddress,
    toToken: toTokenAddress,
    fromAmount: amount.toString(),
    fromAddress: account.address,
  });

  const route = convertQuoteToRoute(quote);

  const executedRoute: RouteExtended = await executeRoute(route, {
    updateRouteHook: (updatedRoute: RouteExtended) => {
      const step = updatedRoute.steps[0];
      if (step?.execution?.status) {
        process.stderr.write(`\r  Bridge status: ${step.execution.status}`);
      }
    },
  });

  process.stderr.write("\n");

  const txHash =
    executedRoute.steps[0]?.execution?.process?.find(
      (p: { txHash?: string }) => p.txHash,
    )?.txHash || "0x";

  const fromTokenInfo = getToken(fromToken, fromChain);
  const toTokenInfo = getToken(toToken, toChain);

  return {
    fromChain,
    toChain,
    fromToken: fromTokenInfo.symbol,
    toToken: toTokenInfo.symbol,
    fromAmount: formatUnits(amount, fromTokenInfo.decimals),
    toAmount: quote.estimate?.toAmount
      ? formatUnits(BigInt(quote.estimate.toAmount), toTokenInfo.decimals)
      : "unknown",
    txHash,
  };
}

/** Prompt for bridge confirmation in TTY mode */
async function confirmBridge(
  source: SourceCandidate,
  targetChain: string,
  targetToken: string,
  deficit: bigint,
): Promise<boolean> {
  const fromTokenInfo = getToken(source.token, source.chain);
  let toTokenInfo;
  try {
    toTokenInfo = getToken(targetToken, targetChain);
  } catch {
    toTokenInfo = { symbol: targetToken, decimals: 18 };
  }

  const deficitFormatted = formatUnits(deficit, toTokenInfo.decimals);

  process.stderr.write(
    `\nInsufficient ${toTokenInfo.symbol} on ${targetChain}.\n` +
      `   Bridge ~${deficitFormatted} ${toTokenInfo.symbol} from ${source.chain} (${fromTokenInfo.symbol})?\n`,
  );

  const answer = await ask("   Proceed? (y/n) ", process.stderr);
  return answer.toLowerCase() === "y";
}

/**
 * Check balance before a transaction and auto-bridge if needed.
 * In TTY mode, prompts for confirmation. In pipe/agent mode, auto-bridges.
 */
export async function swidgeIfNeeded(
  privateKey: Hex,
  address: Hex,
  tx: Record<string, unknown>,
  caip2Chain: string,
): Promise<SwidgeResult> {
  let needed: SwidgeNeeded | null;
  try {
    needed = await checkSufficiency(address, tx, caip2Chain);
  } catch (err) {
    process.stderr.write(
      `Swidge check skipped: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return { bridged: false };
  }

  if (!needed) return { bridged: false };

  // Scan other chains for available funds (skip target chain)
  const allBalances = await scanAllBalances(address, caip2Chain);
  const source = findBestSource(allBalances, caip2Chain, needed.token);

  if (!source) {
    process.stderr.write(
      `\nInsufficient ${needed.token} on ${caip2Chain} and no funds found on other chains to bridge.\n`,
    );
    return { bridged: false };
  }

  // TTY mode: prompt for confirmation
  if (process.stdin.isTTY) {
    const confirmed = await confirmBridge(
      source,
      caip2Chain,
      needed.token,
      needed.deficit,
    );
    if (!confirmed) {
      return { bridged: false };
    }
  } else {
    // Pipe/agent mode: auto-bridge, log to stderr
    let toTokenInfo;
    try {
      toTokenInfo = getToken(needed.token, caip2Chain);
    } catch {
      toTokenInfo = { symbol: needed.token, decimals: 18 };
    }
    process.stderr.write(
      `Auto-bridging ${formatUnits(needed.deficit, toTokenInfo.decimals)} ${toTokenInfo.symbol} from ${source.chain}...\n`,
    );
  }

  const bridgeResult = await executeLifiRoute(
    privateKey,
    source.chain,
    caip2Chain,
    source.token,
    needed.token,
    needed.deficit,
  );

  return { bridged: true, bridgeResult };
}

/**
 * Standalone bridge/swap between chains via LI.FI SDK.
 */
export async function swidge(
  privateKey: Hex,
  options: SwidgeOptions,
): Promise<BridgeResult> {
  const fromTokenInfo = getToken(options.fromToken, options.fromChain);
  const amount = parseTokenAmount(options.amount, fromTokenInfo.decimals);
  return executeLifiRoute(
    privateKey,
    options.fromChain,
    options.toChain,
    options.fromToken,
    options.toToken,
    amount,
  );
}
