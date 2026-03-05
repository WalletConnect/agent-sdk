import { describe, it, expect } from "vitest";
import { parseAmount, formatAmount } from "../src/swidge.js";

describe("parseAmount", () => {
  it("parses whole number with 18 decimals", () => {
    expect(parseAmount("1", 18)).toBe(1_000_000_000_000_000_000n);
  });

  it("parses fractional amount with 18 decimals", () => {
    expect(parseAmount("0.5", 18)).toBe(500_000_000_000_000_000n);
  });

  it("parses amount with 6 decimals (USDC)", () => {
    expect(parseAmount("10", 6)).toBe(10_000_000n);
  });

  it("parses fractional USDC amount", () => {
    expect(parseAmount("1.5", 6)).toBe(1_500_000n);
  });

  it("truncates excess decimal places", () => {
    expect(parseAmount("1.1234567890", 6)).toBe(1_123_456n);
  });

  it("handles zero", () => {
    expect(parseAmount("0", 18)).toBe(0n);
  });

  it("handles small amounts", () => {
    expect(parseAmount("0.0001", 18)).toBe(100_000_000_000_000n);
  });

  it("rejects empty string", () => {
    expect(() => parseAmount("", 18)).toThrow("Invalid amount");
  });

  it("rejects negative numbers", () => {
    expect(() => parseAmount("-1", 18)).toThrow("Invalid amount");
  });

  it("rejects non-numeric strings", () => {
    expect(() => parseAmount("abc", 18)).toThrow("Invalid amount");
  });
});

describe("formatAmount", () => {
  it("formats 1 ETH", () => {
    expect(formatAmount(1_000_000_000_000_000_000n, 18)).toBe("1");
  });

  it("formats 0.5 ETH", () => {
    expect(formatAmount(500_000_000_000_000_000n, 18)).toBe("0.5");
  });

  it("formats 10 USDC", () => {
    expect(formatAmount(10_000_000n, 6)).toBe("10");
  });

  it("formats 1.5 USDC", () => {
    expect(formatAmount(1_500_000n, 6)).toBe("1.5");
  });

  it("formats zero", () => {
    expect(formatAmount(0n, 18)).toBe("0");
  });

  it("formats small amounts without trailing zeros", () => {
    expect(formatAmount(100_000_000_000_000n, 18)).toBe("0.0001");
  });

  it("roundtrips with parseAmount", () => {
    const original = "3.14";
    const parsed = parseAmount(original, 18);
    const formatted = formatAmount(parsed, 18);
    expect(formatted).toBe("3.14");
  });
});
