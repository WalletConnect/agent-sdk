import { describe, it, expect } from "vitest";
import { formatWCT, formatDate, calculateAPY, calculateWeeklyAPY, label } from "../src/format.js";

describe("formatWCT", () => {
  it("formats zero", () => {
    expect(formatWCT(0n)).toBe("0.00");
  });

  it("formats whole tokens", () => {
    expect(formatWCT(1000000000000000000n)).toBe("1.00");
  });

  it("formats large amounts with commas", () => {
    // 1,234,567 WCT
    expect(formatWCT(1234567000000000000000000n)).toBe("1,234,567.00");
  });

  it("formats fractional amounts", () => {
    // 1.5 WCT
    expect(formatWCT(1500000000000000000n)).toBe("1.50");
  });
});

describe("formatDate", () => {
  it("formats a unix timestamp", () => {
    // Jan 1, 2025 00:00:00 UTC
    const result = formatDate(1735689600);
    expect(result).toContain("2025");
    expect(result).toContain("Jan");
  });
});

describe("calculateAPY", () => {
  it("returns positive APY for low stake weight", () => {
    const apy = calculateAPY(0);
    expect(apy).toBeCloseTo(12.0808, 2);
  });

  it("returns lower APY for higher stake weight", () => {
    const apy = calculateAPY(100_000_000);
    expect(apy).toBeCloseTo(Math.max(100 * -0.06464 + 12.0808, 0), 2);
  });

  it("never returns negative APY", () => {
    const apy = calculateAPY(1_000_000_000);
    expect(apy).toBe(0);
  });
});

describe("calculateWeeklyAPY", () => {
  it("scales APY by lock duration", () => {
    expect(calculateWeeklyAPY(10, 52)).toBeCloseTo(10, 2);
  });

  it("caps at 104 weeks", () => {
    expect(calculateWeeklyAPY(10, 200)).toBeCloseTo(10 * (104 / 52), 2);
  });

  it("returns lower APY for shorter locks", () => {
    expect(calculateWeeklyAPY(10, 26)).toBeCloseTo(5, 2);
  });
});

describe("label", () => {
  it("pads the key", () => {
    const result = label("Key", "Value");
    expect(result).toContain("Key");
    expect(result).toContain("Value");
    expect(result.startsWith("  ")).toBe(true);
  });
});
