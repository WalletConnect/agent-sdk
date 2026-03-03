import { describe, it, expect } from "vitest";
import { formatAmount, formatFiatAmount, formatStatus, label } from "../src/format.js";
import type { Amount } from "../src/types.js";

function makeAmount(value: string, symbol: string, decimals: number): Amount {
  return {
    display: { assetName: symbol, assetSymbol: symbol, decimals },
    unit: `caip19/eip155:1/erc20:0x0`,
    value,
  };
}

describe("formatAmount", () => {
  it("formats USDC amount (6 decimals)", () => {
    expect(formatAmount(makeAmount("10500000", "USDC", 6))).toBe("10.50 USDC");
  });

  it("formats ETH amount (18 decimals)", () => {
    expect(formatAmount(makeAmount("1500000000000000000", "ETH", 18))).toBe("1.50 ETH");
  });

  it("formats zero", () => {
    expect(formatAmount(makeAmount("0", "USDC", 6))).toBe("0.00 USDC");
  });

  it("formats large amounts with commas", () => {
    // 1,234,567.89 USDC
    expect(formatAmount(makeAmount("1234567890000", "USDC", 6))).toBe("1,234,567.89 USDC");
  });
});

describe("formatFiatAmount", () => {
  it("formats USD amount", () => {
    expect(formatFiatAmount("1000", "iso4217/USD")).toBe("10.00 USD");
  });

  it("formats EUR amount", () => {
    expect(formatFiatAmount("5099", "iso4217/EUR")).toBe("50.99 EUR");
  });

  it("formats zero", () => {
    expect(formatFiatAmount("0", "iso4217/USD")).toBe("0.00 USD");
  });
});

describe("formatStatus", () => {
  it("formats requires_action", () => {
    expect(formatStatus("requires_action")).toBe("Requires Action");
  });

  it("formats processing", () => {
    expect(formatStatus("processing")).toBe("Processing");
  });

  it("formats succeeded", () => {
    expect(formatStatus("succeeded")).toBe("Succeeded");
  });

  it("formats failed", () => {
    expect(formatStatus("failed")).toBe("Failed");
  });

  it("formats expired", () => {
    expect(formatStatus("expired")).toBe("Expired");
  });
});

describe("label", () => {
  it("pads the key and formats correctly", () => {
    const result = label("Status", "Pending");
    expect(result).toContain("Status");
    expect(result).toContain("Pending");
    expect(result.startsWith("  ")).toBe(true);
  });
});
