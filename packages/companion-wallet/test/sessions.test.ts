import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { vi } from "vitest";

const TEST_DIR = join(tmpdir(), `wallet-sessions-test-${randomBytes(8).toString("hex")}`);

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    homedir: () => join(TEST_DIR, "home"),
  };
});

const { grantSession, revokeSession, loadSession, validateSession, recordSessionUsage, SessionError } = await import("../src/sessions.js");

describe("sessions", () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, "home", ".config", "wallet", "sessions"), { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("grantSession", () => {
    it("creates a session with correct fields", () => {
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{ operation: "sign-message" }],
        expiry: Date.now() + 3600000,
      });

      expect(session.sessionId).toMatch(/^[0-9a-f]{32}$/);
      expect(session.account).toBe("0x1234567890abcdef1234567890abcdef12345678");
      expect(session.chain).toBe("eip155:1");
      expect(session.permissions).toHaveLength(1);
      expect(session.revoked).toBe(false);
      expect(session.callCounts).toEqual({});
      expect(session.totalValue).toEqual({});
    });

    it("creates unique session IDs", () => {
      const input = {
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{ operation: "sign-message" }],
        expiry: Date.now() + 3600000,
      };
      const s1 = grantSession(input);
      const s2 = grantSession(input);
      expect(s1.sessionId).not.toBe(s2.sessionId);
    });
  });

  describe("loadSession", () => {
    it("loads a previously granted session", () => {
      const original = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{ operation: "sign-message" }],
        expiry: Date.now() + 3600000,
      });

      const loaded = loadSession(original.sessionId);
      expect(loaded.sessionId).toBe(original.sessionId);
      expect(loaded.account).toBe(original.account);
    });

    it("throws for non-existent session", () => {
      expect(() => loadSession("nonexistent")).toThrow("Session not found");
    });
  });

  describe("revokeSession", () => {
    it("marks a session as revoked", () => {
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{ operation: "sign-message" }],
        expiry: Date.now() + 3600000,
      });

      revokeSession(session.sessionId);

      const loaded = loadSession(session.sessionId);
      expect(loaded.revoked).toBe(true);
    });
  });

  describe("validateSession", () => {
    it("passes for valid session and operation", () => {
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{ operation: "sign-message" }],
        expiry: Date.now() + 3600000,
      });

      expect(() => validateSession(session.sessionId, "sign-message")).not.toThrow();
    });

    it("throws for revoked session", () => {
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{ operation: "sign-message" }],
        expiry: Date.now() + 3600000,
      });
      revokeSession(session.sessionId);

      expect(() => validateSession(session.sessionId, "sign-message"))
        .toThrow("Session has been revoked");
    });

    it("throws for expired session", () => {
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{ operation: "sign-message" }],
        expiry: Date.now() - 1000, // Already expired
      });

      expect(() => validateSession(session.sessionId, "sign-message"))
        .toThrow("Session has expired");
    });

    it("throws for unpermitted operation", () => {
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{ operation: "sign-message" }],
        expiry: Date.now() + 3600000,
      });

      expect(() => validateSession(session.sessionId, "send-transaction"))
        .toThrow("Session does not permit operation: send-transaction");
    });

    it("enforces value-limit policy", () => {
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{
          operation: "send-transaction",
          policies: [{
            type: "value-limit",
            params: { maxValue: "1000000000000000000" }, // 1 ETH
          }],
        }],
        expiry: Date.now() + 3600000,
      });

      // Under limit — should pass
      expect(() => validateSession(session.sessionId, "send-transaction", {
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        transaction: { to: "0x0000000000000000000000000000000000000001", value: "500000000000000000" },
      })).not.toThrow();

      // Over limit — should fail
      expect(() => validateSession(session.sessionId, "send-transaction", {
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        transaction: { to: "0x0000000000000000000000000000000000000001", value: "2000000000000000000" },
      })).toThrow("Value limit exceeded");
    });

    it("enforces recipient-allowlist policy", () => {
      const allowedAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{
          operation: "send-transaction",
          policies: [{
            type: "recipient-allowlist",
            params: { addresses: [allowedAddress] },
          }],
        }],
        expiry: Date.now() + 3600000,
      });

      // Allowed recipient
      expect(() => validateSession(session.sessionId, "send-transaction", {
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        transaction: { to: allowedAddress, value: "0" },
      })).not.toThrow();

      // Disallowed recipient
      expect(() => validateSession(session.sessionId, "send-transaction", {
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        transaction: { to: "0x0000000000000000000000000000000000000001", value: "0" },
      })).toThrow("not in allowlist");
    });

    it("enforces call-limit policy", () => {
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{
          operation: "sign-message",
          policies: [{
            type: "call-limit",
            params: { maxCalls: 2, operation: "sign-message" },
          }],
        }],
        expiry: Date.now() + 3600000,
      });

      // First two calls should pass
      validateSession(session.sessionId, "sign-message");
      recordSessionUsage(session.sessionId, "sign-message");

      validateSession(session.sessionId, "sign-message");
      recordSessionUsage(session.sessionId, "sign-message");

      // Third call should fail
      expect(() => validateSession(session.sessionId, "sign-message"))
        .toThrow("Call limit reached");
    });
  });

  describe("recordSessionUsage", () => {
    it("increments call count", () => {
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{ operation: "sign-message" }],
        expiry: Date.now() + 3600000,
      });

      recordSessionUsage(session.sessionId, "sign-message");
      const loaded = loadSession(session.sessionId);
      expect(loaded.callCounts["sign-message"]).toBe(1);
    });

    it("tracks transaction value", () => {
      const session = grantSession({
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        permissions: [{ operation: "send-transaction" }],
        expiry: Date.now() + 3600000,
      });

      recordSessionUsage(session.sessionId, "send-transaction", {
        account: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "eip155:1",
        transaction: { to: "0x0000000000000000000000000000000000000001", value: "1000000000000000000" },
      });

      const loaded = loadSession(session.sessionId);
      expect(loaded.totalValue["eip155:1"]).toBe("1000000000000000000");
    });
  });
});
