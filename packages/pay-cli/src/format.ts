import type { Amount, PaymentStatus } from "./types.js";

const STATUS_LABELS: Record<PaymentStatus, string> = {
  requires_action: "Requires Action",
  processing: "Processing",
  succeeded: "Succeeded",
  failed: "Failed",
  expired: "Expired",
};

export function formatStatus(status: PaymentStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatAmount(amount: Amount): string {
  const { display, value } = amount;
  const num = Number(value) / 10 ** display.decimals;
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.min(display.decimals, 6),
  });
  return `${formatted} ${display.assetSymbol}`;
}

export function formatFiatAmount(value: string, unit: string): string {
  // unit format: "iso4217/USD"
  const currency = unit.replace("iso4217/", "");
  const minor = parseInt(value, 10);
  // Most fiat currencies have 2 decimal places
  const num = minor / 100;
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function label(key: string, value: string): string {
  return `  ${key.padEnd(14)} ${value}`;
}
