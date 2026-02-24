import { encodeFunctionData, type Hex } from "viem";

export interface TokenInfo {
  symbol: string;
  decimals: number;
  address?: Hex; // undefined for native ETH
}

/** USDC contract addresses per CAIP-2 chain */
const USDC_ADDRESSES: Record<string, Hex> = {
  "eip155:1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "eip155:10": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
};

/** Tokens available on each chain */
const TOKEN_REGISTRY: Record<string, string[]> = {
  "eip155:1": ["eth", "usdc"],
  "eip155:8453": ["eth", "usdc"],
  "eip155:10": ["eth", "usdc"],
};

/**
 * Get the list of supported token symbols for a chain.
 */
export function getTokenSymbols(chain: string): string[] {
  return TOKEN_REGISTRY[chain] ?? ["eth"];
}

/**
 * Resolve token info for a symbol on a given chain.
 */
export function getToken(symbol: string, chain: string): TokenInfo {
  const s = symbol.toLowerCase();

  if (s === "eth") {
    return { symbol: "ETH", decimals: 18 };
  }

  if (s === "usdc") {
    const address = USDC_ADDRESSES[chain];
    if (!address) {
      throw new Error(`USDC not supported on chain ${chain}`);
    }
    return { symbol: "USDC", decimals: 6, address };
  }

  throw new Error(`Unknown token: ${symbol}`);
}

/**
 * Parse a human-readable amount into its smallest unit (wei / micro-USDC).
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = amount.split(".");
  const paddedFrac = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFrac);
}

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * Build a raw ERC-20 transfer call (to, data, value=0x0).
 */
export function buildErc20Transfer(
  tokenAddress: Hex,
  to: Hex,
  amount: bigint,
): { to: Hex; data: Hex; value: Hex } {
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [to, amount],
  });

  return { to: tokenAddress, data, value: "0x0" as Hex };
}
