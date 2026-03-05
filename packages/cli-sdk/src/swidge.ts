/**
 * Swidge (swap/bridge) module for WalletConnect CLI.
 * Uses LI.FI REST API for quoting and WalletConnect for transaction execution.
 * No additional dependencies — uses fetch() for all external calls.
 */

import type { WalletConnectCLI } from "./client.js";

// --- Types ---

interface LifiTransactionRequest {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  gasPrice?: string;
}

interface LifiQuoteResponse {
  transactionRequest: LifiTransactionRequest;
  estimate: {
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
  };
  action: {
    fromToken: { address: string; symbol: string; decimals: number; chainId: number };
    toToken: { address: string; symbol: string; decimals: number; chainId: number };
    fromAmount: string;
  };
}

export interface SwidgeCLIOptions {
  fromChain: string;   // CAIP-2
  toChain: string;     // CAIP-2
  fromToken: string;   // symbol (ETH, USDC, etc.)
  toToken: string;     // symbol
  amount: string;      // human-readable
}

export interface SwidgeCLIResult {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  txHash: string;
}

// --- Constants ---

const EVM_CHAINS: Record<string, { name: string; rpc: string }> = {
  "eip155:1": { name: "Ethereum", rpc: "https://eth.drpc.org" },
  "eip155:8453": { name: "Base", rpc: "https://mainnet.base.org" },
  "eip155:10": { name: "Optimism", rpc: "https://mainnet.optimism.io" },
};

const LIFI_API = "https://li.quest/v1";

const NATIVE_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
]);

// --- Helpers ---

function parseChainId(caip2: string): number {
  const parts = caip2.split(":");
  const id = parseInt(parts[1], 10);
  if (parts.length !== 2 || isNaN(id)) {
    throw new Error(`Invalid CAIP-2 chain ID: ${caip2}`);
  }
  return id;
}

function chainName(caip2: string): string {
  return EVM_CHAINS[caip2]?.name || caip2;
}

function rpcUrl(caip2: string): string | undefined {
  return EVM_CHAINS[caip2]?.rpc;
}

/** Common token decimals for amount conversion. Defaults to 18 for unknown tokens. */
const TOKEN_DECIMALS: Record<string, number> = {
  usdc: 6, usdt: 6,
  wbtc: 8,
  // 18 decimals: eth, weth, dai, wct, link, uni, etc.
};

function getTokenDecimals(token: string): number {
  return TOKEN_DECIMALS[token.toLowerCase()] ?? 18;
}

function isNativeToken(address: string): boolean {
  return NATIVE_ADDRESSES.has(address.toLowerCase());
}

/** Parse human-readable amount to smallest unit */
export function parseAmount(amount: string, decimals: number): bigint {
  if (!amount || !/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  const [whole = "0", frac = ""] = amount.split(".");
  const paddedFrac = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFrac);
}

/** Format smallest unit to human-readable */
export function formatAmount(value: bigint, decimals: number): string {
  const str = value.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals);
  const frac = str.slice(str.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

// --- RPC ---

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result: string; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export async function getBalanceRpc(chainId: string, address: string): Promise<bigint> {
  const url = rpcUrl(chainId);
  if (!url) throw new Error(`No RPC URL for chain ${chainId}`);
  return BigInt(await rpcCall(url, "eth_getBalance", [address, "latest"]));
}

async function getAllowanceRpc(
  chainId: string, tokenAddress: string,
  owner: string, spender: string,
): Promise<bigint> {
  const url = rpcUrl(chainId);
  if (!url) return 0n;
  // allowance(address owner, address spender) = 0xdd62ed3e
  const data = "0xdd62ed3e" +
    owner.slice(2).toLowerCase().padStart(64, "0") +
    spender.slice(2).toLowerCase().padStart(64, "0");
  const result = await rpcCall(url, "eth_call", [{ to: tokenAddress, data }, "latest"]);
  return BigInt(result);
}

// --- LI.FI API ---

async function getLifiQuote(
  fromChain: number, toChain: number,
  fromToken: string, toToken: string,
  fromAmount: string, fromAddress: string,
): Promise<LifiQuoteResponse> {
  const url = new URL(`${LIFI_API}/quote`);
  url.searchParams.set("fromChain", fromChain.toString());
  url.searchParams.set("toChain", toChain.toString());
  url.searchParams.set("fromToken", fromToken);
  url.searchParams.set("toToken", toToken);
  url.searchParams.set("fromAmount", fromAmount);
  url.searchParams.set("fromAddress", fromAddress);
  url.searchParams.set("integrator", "walletconnect-agent-sdk");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LI.FI quote failed (${res.status}): ${text}`);
  }
  return (await res.json()) as LifiQuoteResponse;
}

// --- Core swidge ---

/**
 * Execute a swap/bridge via LI.FI, sending transactions through WalletConnect.
 * The user's connected wallet approves each transaction.
 */
export async function swidgeViaWalletConnect(
  sdk: WalletConnectCLI,
  address: string,
  options: SwidgeCLIOptions,
): Promise<SwidgeCLIResult> {
  const fromChainId = parseChainId(options.fromChain);
  const toChainId = parseChainId(options.toChain);
  const decimals = getTokenDecimals(options.fromToken);
  const fromAmount = parseAmount(options.amount, decimals);

  process.stderr.write(`\nFetching LI.FI quote...\n`);

  const quote = await getLifiQuote(
    fromChainId, toChainId,
    options.fromToken, options.toToken,
    fromAmount.toString(), address,
  );

  const fromSymbol = quote.action.fromToken.symbol;
  const toSymbol = quote.action.toToken.symbol;
  const toDec = quote.action.toToken.decimals;
  const estimatedOut = formatAmount(BigInt(quote.estimate.toAmount), toDec);

  process.stderr.write(
    `  ${options.amount} ${fromSymbol} (${chainName(options.fromChain)}) -> ` +
    `~${estimatedOut} ${toSymbol} (${chainName(options.toChain)})\n`,
  );

  // ERC-20 approval if needed
  const fromTokenAddr = quote.action.fromToken.address;
  if (!isNativeToken(fromTokenAddr) && quote.estimate.approvalAddress) {
    const allowance = await getAllowanceRpc(
      options.fromChain, fromTokenAddr, address, quote.estimate.approvalAddress,
    );

    // Use the amount from the LI.FI quote (what the router expects)
    const quoteFromAmount = BigInt(quote.action.fromAmount);
    if (allowance < quoteFromAmount) {
      process.stderr.write(`  Requesting token approval in wallet...\n`);

      // approve(address spender, uint256 amount) = 0x095ea7b3
      const approveData = "0x095ea7b3" +
        quote.estimate.approvalAddress.slice(2).toLowerCase().padStart(64, "0") +
        quoteFromAmount.toString(16).padStart(64, "0");

      await sdk.request<string>({
        chainId: options.fromChain,
        request: {
          method: "eth_sendTransaction",
          params: [{
            from: address,
            to: fromTokenAddr,
            data: approveData,
            value: "0x0",
          }],
        },
      });

      process.stderr.write(`  Approval confirmed.\n`);
    }
  }

  // Send bridge transaction
  process.stderr.write(`  Requesting bridge transaction in wallet...\n`);

  const txHash = await sdk.request<string>({
    chainId: options.fromChain,
    request: {
      method: "eth_sendTransaction",
      params: [{
        from: address,
        to: quote.transactionRequest.to,
        data: quote.transactionRequest.data,
        value: quote.transactionRequest.value,
        gas: quote.transactionRequest.gasLimit,
      }],
    },
  });

  process.stderr.write(`  Bridge tx confirmed: ${txHash}\n`);

  return {
    fromChain: options.fromChain,
    toChain: options.toChain,
    fromToken: fromSymbol,
    toToken: toSymbol,
    fromAmount: options.amount,
    toAmount: estimatedOut,
    txHash,
  };
}

/**
 * Check if a send-transaction has insufficient ETH and offer to bridge.
 * In TTY mode: prompts user. In pipe mode: auto-bridges.
 * Returns the bridge result if bridging occurred, null otherwise.
 */
export async function trySwidgeBeforeSend(
  sdk: WalletConnectCLI,
  chainId: string,
  address: string,
  txValue: string | undefined,
): Promise<SwidgeCLIResult | null> {
  if (!rpcUrl(chainId) || !txValue) return null;

  let balance: bigint;
  let value: bigint;
  try {
    balance = await getBalanceRpc(chainId, address);
    value = BigInt(txValue);
  } catch {
    return null;
  }
  if (balance >= value) return null;

  // Add 10% buffer for gas costs on the destination tx
  const deficit = (value - balance) * 11n / 10n;

  // Find a source chain with funds (collect then reduce to avoid race)
  const otherChains = Object.keys(EVM_CHAINS).filter((c) => c !== chainId);
  const balances = await Promise.all(
    otherChains.map(async (chain) => {
      try {
        return { chain, balance: await getBalanceRpc(chain, address) };
      } catch {
        return { chain, balance: 0n };
      }
    }),
  );
  const best = balances.reduce(
    (a, b) => (b.balance > a.balance ? b : a),
    { chain: "", balance: 0n },
  );
  const sourceChain = best.balance > 0n ? best.chain : null;

  if (!sourceChain) {
    process.stderr.write(
      `\nWarning: Insufficient ETH on ${chainName(chainId)} and no funds found on other chains.\n` +
      `  Consider: walletconnect swidge --from-chain <chain> --to-chain ${chainId} --from-token ETH --to-token ETH --amount <needed>\n\n`,
    );
    return null;
  }

  const deficitFormatted = formatAmount(deficit, 18);

  // TTY: prompt; pipe: auto-bridge
  if (process.stdin.isTTY) {
    const readline = await import("node:readline/promises");
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    process.stderr.write(
      `\nInsufficient ETH on ${chainName(chainId)}.\n` +
      `  Bridge ~${deficitFormatted} ETH from ${chainName(sourceChain)}?\n`,
    );
    const answer = await rl.question("  Proceed? (y/n) ");
    rl.close();
    if (answer.trim().toLowerCase() !== "y") return null;
  } else {
    process.stderr.write(
      `Auto-bridging ~${deficitFormatted} ETH from ${chainName(sourceChain)} to ${chainName(chainId)}...\n`,
    );
  }

  try {
    const result = await swidgeViaWalletConnect(sdk, address, {
      fromChain: sourceChain,
      toChain: chainId,
      fromToken: "ETH",
      toToken: "ETH",
      amount: deficitFormatted,
    });

    // Wait for bridge funds to arrive on destination chain
    process.stderr.write(`  Waiting for bridge to complete...`);
    const arrived = await waitForBalance(chainId, address, balance, 300_000);
    if (arrived) {
      process.stderr.write(` done.\n\n`);
    } else {
      process.stderr.write(` timed out. Proceeding anyway.\n\n`);
    }

    return result;
  } catch (err) {
    process.stderr.write(
      `\nBridge failed: ${err instanceof Error ? err.message : String(err)}\n` +
      `  Proceeding with original transaction.\n\n`,
    );
    return null;
  }
}

/** Poll destination chain balance until it increases above the initial value */
async function waitForBalance(
  chainId: string, address: string,
  initialBalance: bigint, timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5_000));
    try {
      const current = await getBalanceRpc(chainId, address);
      if (current > initialBalance) return true;
    } catch {
      // retry on RPC errors
    }
  }
  return false;
}
