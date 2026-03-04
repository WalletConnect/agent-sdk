import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const TEST_DIR = join(tmpdir(), `wallet-audit-test-${randomBytes(8).toString("hex")}`);

import { vi } from "vitest";
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    homedir: () => join(TEST_DIR, "home"),
  };
});

const { appendAuditEntry, readAuditLog } = await import("../src/audit.js");

const AUDIT_LOG = join(TEST_DIR, "home", ".config", "wallet", "audit.log");

describe("audit", () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, "home", ".config", "wallet"), { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("appendAuditEntry", () => {
    it("creates log file on first write", () => {
      appendAuditEntry({
        timestamp: "2025-01-01T00:00:00.000Z",
        operation: "info",
        input: undefined,
        output: { name: "companion-wallet" },
        success: true,
      });

      const content = readFileSync(AUDIT_LOG, "utf-8");
      const entry = JSON.parse(content.trim());
      expect(entry.operation).toBe("info");
      expect(entry.success).toBe(true);
    });

    it("appends multiple JSONL entries", () => {
      appendAuditEntry({
        timestamp: "2025-01-01T00:00:00.000Z",
        operation: "info",
        input: undefined,
        output: {},
        success: true,
      });
      appendAuditEntry({
        timestamp: "2025-01-01T00:01:00.000Z",
        operation: "accounts",
        input: undefined,
        output: { accounts: [] },
        success: true,
      });

      const lines = readFileSync(AUDIT_LOG, "utf-8").split("\n").filter(Boolean);
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).operation).toBe("info");
      expect(JSON.parse(lines[1]).operation).toBe("accounts");
    });
  });

  describe("readAuditLog", () => {
    it("returns empty array when log does not exist", () => {
      const entries = readAuditLog();
      expect(entries).toEqual([]);
    });

    it("skips malformed lines", () => {
      writeFileSync(
        AUDIT_LOG,
        '{"timestamp":"2025-01-01T00:00:00.000Z","operation":"info","input":null,"output":{},"success":true}\n' +
          "not-json\n" +
          '{"timestamp":"2025-01-01T00:01:00.000Z","operation":"accounts","input":null,"output":{},"success":true}\n',
      );

      const entries = readAuditLog();
      expect(entries).toHaveLength(2);
      expect(entries[0].operation).toBe("info");
      expect(entries[1].operation).toBe("accounts");
    });

    it("filters by operation", () => {
      appendAuditEntry({
        timestamp: "2025-01-01T00:00:00.000Z",
        operation: "info",
        input: undefined,
        output: {},
        success: true,
      });
      appendAuditEntry({
        timestamp: "2025-01-01T00:01:00.000Z",
        operation: "accounts",
        input: undefined,
        output: {},
        success: true,
      });

      const entries = readAuditLog({ operation: "info" });
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe("info");
    });

    it("filters by account (case-insensitive)", () => {
      appendAuditEntry({
        timestamp: "2025-01-01T00:00:00.000Z",
        operation: "sign-message",
        input: {},
        output: {},
        account: "0xAbC123",
        success: true,
      });
      appendAuditEntry({
        timestamp: "2025-01-01T00:01:00.000Z",
        operation: "sign-message",
        input: {},
        output: {},
        account: "0xDEF456",
        success: true,
      });

      const entries = readAuditLog({ account: "0xabc123" });
      expect(entries).toHaveLength(1);
      expect(entries[0].account).toBe("0xAbC123");
    });

    it("filters by chain", () => {
      appendAuditEntry({
        timestamp: "2025-01-01T00:00:00.000Z",
        operation: "send-transaction",
        input: {},
        output: {},
        chain: "eip155:1",
        success: true,
      });
      appendAuditEntry({
        timestamp: "2025-01-01T00:01:00.000Z",
        operation: "send-transaction",
        input: {},
        output: {},
        chain: "eip155:10",
        success: true,
      });

      const entries = readAuditLog({ chain: "eip155:1" });
      expect(entries).toHaveLength(1);
      expect(entries[0].chain).toBe("eip155:1");
    });

    it("filters by since", () => {
      appendAuditEntry({
        timestamp: "2025-01-01T00:00:00.000Z",
        operation: "info",
        input: undefined,
        output: {},
        success: true,
      });
      appendAuditEntry({
        timestamp: "2025-06-01T00:00:00.000Z",
        operation: "accounts",
        input: undefined,
        output: {},
        success: true,
      });

      const entries = readAuditLog({ since: "2025-03-01T00:00:00.000Z" });
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe("accounts");
    });

    it("returns last N entries", () => {
      for (let i = 0; i < 5; i++) {
        appendAuditEntry({
          timestamp: `2025-01-0${i + 1}T00:00:00.000Z`,
          operation: "info",
          input: undefined,
          output: { i },
          success: true,
        });
      }

      const entries = readAuditLog({ last: 2 });
      expect(entries).toHaveLength(2);
      expect((entries[0].output as { i: number }).i).toBe(3);
      expect((entries[1].output as { i: number }).i).toBe(4);
    });
  });
});
