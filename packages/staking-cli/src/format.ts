import { formatUnits } from "viem";
import {
  WCT_DECIMALS,
  APY_SLOPE,
  APY_INTERCEPT,
  APY_STAKE_WEIGHT_DIVISOR,
  MAX_LOCK_WEEKS,
} from "./constants.js";

/** Format a bigint WCT amount as a human-readable string with 2 decimals */
export function formatWCT(amount: bigint): string {
  const raw = formatUnits(amount, WCT_DECIMALS);
  const num = parseFloat(raw);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a unix timestamp as a locale date string */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Calculate base APY from total stake weight (from math.ts) */
export function calculateAPY(stakeWeight: number): number {
  return Math.max(
    (stakeWeight / APY_STAKE_WEIGHT_DIVISOR) * APY_SLOPE + APY_INTERCEPT,
    0,
  );
}

/** Calculate weekly APY adjusted for lock duration */
export function calculateWeeklyAPY(baseAPY: number, weeks: number): number {
  return baseAPY * (Math.min(weeks, MAX_LOCK_WEEKS) / 52);
}

/** Print a labeled key-value pair */
export function label(key: string, value: string): string {
  return `  ${key.padEnd(12)} ${value}`;
}
