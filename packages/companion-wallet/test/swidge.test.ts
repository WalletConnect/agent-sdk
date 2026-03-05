import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @lifi/sdk before any imports
vi.mock("@lifi/sdk", () => ({
  createConfig: vi.fn(),
  EVM: vi.fn().mockReturnValue({}),
  getQuote: vi.fn(),
  convertQuoteToRoute: vi.fn(),
  executeRoute: vi.fn(),
}));

// Mock rpc.ts to avoid real network calls
vi.mock("../src/rpc.js", () => ({
  getBalance: vi.fn(),
  getTokenBalance: vi.fn(),
  getBalances: vi.fn(),
  sendTransaction: vi.fn(),
}));

import { findBestSource, checkSufficiency } from "../src/swidge.js";
import { getLifiTokenAddress } from "../src/tokens.js";
import { resolveChainByNumericId } from "../src/chains.js";
import { getBalance, getTokenBalance } from "../src/rpc.js";
import { mainnet, base, optimism } from "viem/chains";
import type { BalanceEntry } from "../src/types.js";

describe("swidge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLifiTokenAddress", () => {
    it("returns zero address for native ETH", () => {
      const addr = getLifiTokenAddress("eth", "eip155:1");
      expect(addr).toBe("0x0000000000000000000000000000000000000000");
    });

    it("returns contract address for USDC", () => {
      const addr = getLifiTokenAddress("usdc", "eip155:1");
      expect(addr).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    });

    it("returns contract address for WCT on Optimism", () => {
      const addr = getLifiTokenAddress("wct", "eip155:10");
      expect(addr).toBe("0xeF4461891DfB3AC8572cCf7C794664A8DD927945");
    });

    it("returns USDC address on Base", () => {
      const addr = getLifiTokenAddress("usdc", "eip155:8453");
      expect(addr).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    });
  });

  describe("resolveChainByNumericId", () => {
    it("resolves Ethereum mainnet (1)", () => {
      expect(resolveChainByNumericId(1).id).toBe(mainnet.id);
    });

    it("resolves Base (8453)", () => {
      expect(resolveChainByNumericId(8453).id).toBe(base.id);
    });

    it("resolves Optimism (10)", () => {
      expect(resolveChainByNumericId(10).id).toBe(optimism.id);
    });

    it("throws for unsupported chain ID", () => {
      expect(() => resolveChainByNumericId(999)).toThrow(
        "Unsupported numeric chain ID: 999",
      );
    });
  });

  describe("findBestSource", () => {
    function makeBalances(
      entries: Record<string, BalanceEntry[]>,
    ): Map<string, BalanceEntry[]> {
      return new Map(Object.entries(entries));
    }

    it("returns null when no funds on other chains", () => {
      const balances = makeBalances({
        "eip155:10": [{ token: "ETH", balance: "0", raw: "0" }],
        "eip155:1": [{ token: "ETH", balance: "0", raw: "0" }],
        "eip155:8453": [{ token: "ETH", balance: "0", raw: "0" }],
      });

      const result = findBestSource(balances, "eip155:10", "eth");
      expect(result).toBeNull();
    });

    it("prefers same token on another chain", () => {
      const balances = makeBalances({
        "eip155:10": [{ token: "ETH", balance: "0", raw: "0" }],
        "eip155:1": [
          { token: "ETH", balance: "5", raw: "5000000000000000000" },
          { token: "USDC", balance: "100", raw: "100000000" },
        ],
        "eip155:8453": [
          { token: "ETH", balance: "2", raw: "2000000000000000000" },
        ],
      });

      const result = findBestSource(balances, "eip155:10", "eth");
      expect(result).not.toBeNull();
      expect(result!.token).toBe("eth");
      expect(result!.chain).toBe("eip155:1"); // Higher balance
    });

    it("falls back to different token when same token not available", () => {
      const balances = makeBalances({
        "eip155:10": [{ token: "WCT", balance: "0", raw: "0" }],
        "eip155:1": [
          { token: "ETH", balance: "0", raw: "0" },
          { token: "USDC", balance: "50", raw: "50000000" },
        ],
        "eip155:8453": [
          { token: "ETH", balance: "0", raw: "0" },
          { token: "USDC", balance: "100", raw: "100000000" },
        ],
      });

      const result = findBestSource(balances, "eip155:10", "wct");
      expect(result).not.toBeNull();
      // Should pick USDC on Base (higher balance)
      expect(result!.token).toBe("usdc");
      expect(result!.chain).toBe("eip155:8453");
    });

    it("skips target chain", () => {
      const balances = makeBalances({
        "eip155:10": [
          { token: "ETH", balance: "10", raw: "10000000000000000000" },
        ],
        "eip155:1": [{ token: "ETH", balance: "0", raw: "0" }],
      });

      const result = findBestSource(balances, "eip155:10", "eth");
      expect(result).toBeNull();
    });
  });

  describe("checkSufficiency", () => {
    it("returns null when native balance covers value + gas", async () => {
      vi.mocked(getBalance).mockResolvedValue(
        10n * 10n ** 18n, // 10 ETH
      );

      const result = await checkSufficiency(
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        { to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", value: "1000000000000000000" },
        "eip155:1",
      );

      expect(result).toBeNull();
    });

    it("returns deficit for insufficient native balance", async () => {
      vi.mocked(getBalance).mockResolvedValue(0n);

      const result = await checkSufficiency(
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        { to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", value: "1000000000000000000" },
        "eip155:1",
      );

      expect(result).not.toBeNull();
      expect(result!.token).toBe("eth");
      expect(result!.deficit).toBeGreaterThan(0n);
    });

    it("checks ERC-20 transfer sufficiency", async () => {
      // Native balance sufficient for gas
      vi.mocked(getBalance).mockResolvedValue(10n ** 18n);
      // Token balance insufficient
      vi.mocked(getTokenBalance).mockResolvedValue(5000000n); // 5 USDC

      // ERC-20 transfer of 10 USDC: selector(4) + to(32) + amount(32) = 68 bytes
      const to = "f39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      const amount = "0000000000000000000000000000000000000000000000000000000000989680"; // 10_000_000 (10 USDC)
      const data = `0xa9059cbb000000000000000000000000${to}${amount}`;

      const result = await checkSufficiency(
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        {
          to: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC on Optimism
          data,
        },
        "eip155:10",
      );

      expect(result).not.toBeNull();
      expect(result!.token).toBe("usdc");
      expect(result!.isGas).toBe(false);
      expect(result!.deficit).toBe(10_000_000n - 5_000_000n);
    });

    it("only checks gas for ERC-20 approve", async () => {
      vi.mocked(getBalance).mockResolvedValue(10n ** 18n); // Enough for gas

      const to = "f39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      const amount = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      const data = `0x095ea7b3000000000000000000000000${to}${amount}`;

      const result = await checkSufficiency(
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        {
          to: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          data,
        },
        "eip155:10",
      );

      expect(result).toBeNull();
    });
  });

  describe("TTY detection", () => {
    it("detects TTY mode", () => {
      // process.stdin.isTTY is undefined in test environment (non-TTY)
      expect(process.stdin.isTTY).toBeUndefined();
    });
  });
});
