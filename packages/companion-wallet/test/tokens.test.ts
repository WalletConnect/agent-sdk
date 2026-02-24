import { describe, it, expect } from "vitest";
import { getToken, getTokenSymbols } from "../src/tokens.js";

describe("tokens", () => {
  describe("WCT on Optimism", () => {
    it("resolves WCT token on eip155:10", () => {
      const token = getToken("wct", "eip155:10");
      expect(token.symbol).toBe("WCT");
      expect(token.decimals).toBe(18);
      expect(token.address).toBe("0xeF4461891DfB3AC8572cCf7C794664A8DD927945");
    });

    it("includes wct in Optimism token symbols", () => {
      const symbols = getTokenSymbols("eip155:10");
      expect(symbols).toContain("wct");
    });

    it("is case-insensitive", () => {
      const token = getToken("WCT", "eip155:10");
      expect(token.symbol).toBe("WCT");
    });
  });

  describe("WCT on unsupported chains", () => {
    it("throws for WCT on Ethereum mainnet", () => {
      expect(() => getToken("wct", "eip155:1")).toThrow("WCT not supported on chain eip155:1");
    });

    it("throws for WCT on Base", () => {
      expect(() => getToken("wct", "eip155:8453")).toThrow("WCT not supported on chain eip155:8453");
    });

    it("does not include wct in Ethereum token symbols", () => {
      const symbols = getTokenSymbols("eip155:1");
      expect(symbols).not.toContain("wct");
    });
  });
});
