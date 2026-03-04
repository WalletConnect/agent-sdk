import { appendFileSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { AuditEntry, HistoryInput } from "./types.js";

const AUDIT_LOG = join(homedir(), ".config", "wallet", "audit.log");

/** Append an audit entry as a JSONL line. Never throws. */
export function appendAuditEntry(entry: AuditEntry): void {
  try {
    mkdirSync(dirname(AUDIT_LOG), { recursive: true, mode: 0o700 });
    appendFileSync(AUDIT_LOG, JSON.stringify(entry) + "\n", {
      mode: 0o600,
    });
  } catch {
    // Audit must never crash the wallet
  }
}

/** Read audit log with optional filters. Returns [] if log doesn't exist. */
export function readAuditLog(filters: HistoryInput = {}): AuditEntry[] {
  let lines: string[];
  try {
    lines = readFileSync(AUDIT_LOG, "utf-8").split("\n").filter(Boolean);
  } catch {
    return [];
  }

  let entries: AuditEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as AuditEntry);
    } catch {
      // Skip malformed lines
    }
  }

  if (filters.operation) {
    const op = filters.operation.toLowerCase();
    entries = entries.filter((e) => e.operation.toLowerCase() === op);
  }

  if (filters.chain) {
    const ch = filters.chain.toLowerCase();
    entries = entries.filter((e) => e.chain?.toLowerCase() === ch);
  }

  if (filters.account) {
    const acc = filters.account.toLowerCase();
    entries = entries.filter((e) => e.account?.toLowerCase() === acc);
  }

  if (filters.since) {
    const sinceDate = new Date(filters.since).getTime();
    if (!Number.isNaN(sinceDate)) {
      entries = entries.filter((e) => new Date(e.timestamp).getTime() >= sinceDate);
    }
  }

  if (filters.last !== undefined && filters.last > 0) {
    entries = entries.slice(-filters.last);
  }

  return entries;
}
