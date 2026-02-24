import {
  mainnet,
  base,
  optimism,
  type Chain,
} from "viem/chains";
import { http, type Transport } from "viem";

interface ChainEntry {
  chain: Chain;
  name: string;
  defaultRpcUrl: string;
}

const CHAIN_REGISTRY: Record<string, ChainEntry> = {
  "eip155:1": { chain: mainnet, name: "Ethereum", defaultRpcUrl: "https://eth.drpc.org" },
  "eip155:8453": { chain: base, name: "Base", defaultRpcUrl: "https://mainnet.base.org" },
  "eip155:10": {
    chain: optimism,
    name: "Optimism",
    defaultRpcUrl: "https://mainnet.optimism.io",
  },
};

/** All supported CAIP-2 chain identifiers */
export const SUPPORTED_CHAINS = Object.keys(CHAIN_REGISTRY);

/**
 * Resolve a CAIP-2 chain ID to a viem Chain object.
 * Throws if chain is not supported.
 */
export function resolveChain(caip2: string): Chain {
  const entry = CHAIN_REGISTRY[caip2];
  if (!entry) {
    throw new Error(
      `Unsupported chain: ${caip2}. Supported: ${SUPPORTED_CHAINS.join(", ")}`,
    );
  }
  return entry.chain;
}

/**
 * Get the RPC transport for a chain.
 * Checks for WALLET_RPC_URL_<chainId> env var override first.
 */
export function getTransport(caip2: string): Transport {
  const entry = CHAIN_REGISTRY[caip2];
  if (!entry) {
    throw new Error(`Unsupported chain: ${caip2}`);
  }

  const chainId = caip2.split(":")[1];
  const envUrl = process.env[`WALLET_RPC_URL_${chainId}`];
  return http(envUrl || entry.defaultRpcUrl);
}

/**
 * Extract the numeric chain ID from a CAIP-2 identifier.
 */
export function parseChainId(caip2: string): number {
  const parts = caip2.split(":");
  if (parts.length !== 2 || parts[0] !== "eip155") {
    throw new Error(`Invalid CAIP-2 chain ID: ${caip2}`);
  }
  return parseInt(parts[1], 10);
}

/**
 * Get the human-readable name for a CAIP-2 chain.
 */
export function getChainName(caip2: string): string {
  const entry = CHAIN_REGISTRY[caip2];
  if (!entry) {
    throw new Error(`Unsupported chain: ${caip2}`);
  }
  return entry.name;
}
