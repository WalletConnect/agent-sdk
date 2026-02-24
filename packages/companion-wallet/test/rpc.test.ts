import { describe, it, expect } from "vitest";
import { resolveChain, getTransport, parseChainId, getChainName, SUPPORTED_CHAINS } from "../src/chains.js";
import { mainnet, base, optimism } from "viem/chains";

describe("chains", () => {
  describe("SUPPORTED_CHAINS", () => {
    it("includes mainnet chains only", () => {
      expect(SUPPORTED_CHAINS).toContain("eip155:1");
      expect(SUPPORTED_CHAINS).toContain("eip155:8453");
      expect(SUPPORTED_CHAINS).toContain("eip155:10");
      expect(SUPPORTED_CHAINS).toHaveLength(3);
    });

    it("does not include testnets", () => {
      expect(SUPPORTED_CHAINS).not.toContain("eip155:11155111");
      expect(SUPPORTED_CHAINS).not.toContain("eip155:84532");
    });
  });

  describe("resolveChain", () => {
    it("resolves eip155:1 to mainnet", () => {
      expect(resolveChain("eip155:1").id).toBe(mainnet.id);
    });

    it("resolves eip155:8453 to base", () => {
      expect(resolveChain("eip155:8453").id).toBe(base.id);
    });

    it("resolves eip155:10 to optimism", () => {
      expect(resolveChain("eip155:10").id).toBe(optimism.id);
    });

    it("throws for unsupported chain", () => {
      expect(() => resolveChain("eip155:999")).toThrow("Unsupported chain");
    });
  });

  describe("getTransport", () => {
    it("returns a transport for supported chains", () => {
      const transport = getTransport("eip155:1");
      expect(transport).toBeDefined();
    });

    it("throws for unsupported chain", () => {
      expect(() => getTransport("eip155:999")).toThrow("Unsupported chain");
    });

    it("uses env var override when set", () => {
      process.env.WALLET_RPC_URL_1 = "https://custom-rpc.example.com";
      const transport = getTransport("eip155:1");
      expect(transport).toBeDefined();
      delete process.env.WALLET_RPC_URL_1;
    });
  });

  describe("parseChainId", () => {
    it("extracts chain ID from CAIP-2", () => {
      expect(parseChainId("eip155:1")).toBe(1);
      expect(parseChainId("eip155:8453")).toBe(8453);
      expect(parseChainId("eip155:10")).toBe(10);
    });

    it("throws for invalid format", () => {
      expect(() => parseChainId("invalid")).toThrow("Invalid CAIP-2");
      expect(() => parseChainId("cosmos:1")).toThrow("Invalid CAIP-2");
    });
  });

  describe("getChainName", () => {
    it("returns human-readable names", () => {
      expect(getChainName("eip155:1")).toBe("Ethereum");
      expect(getChainName("eip155:8453")).toBe("Base");
      expect(getChainName("eip155:10")).toBe("Optimism");
    });

    it("throws for unsupported chain", () => {
      expect(() => getChainName("eip155:999")).toThrow("Unsupported chain");
    });
  });
});
