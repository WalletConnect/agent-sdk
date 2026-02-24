import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const TEST_DIR = join(tmpdir(), `wallet-cli-test-${randomBytes(8).toString("hex")}`);
const CLI_PATH = join(__dirname, "..", "dist", "cli.js");

function runCli(
  operation: string,
  input?: object,
  extraArgs: string[] = [],
  env: Record<string, string> = {},
): { stdout: string; exitCode: number } {
  try {
    const result = execFileSync("node", [CLI_PATH, operation, ...extraArgs], {
      input: input ? JSON.stringify(input) : undefined,
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: join(TEST_DIR, "home"),
        XDG_CONFIG_HOME: join(TEST_DIR, "home", ".config"),
        ...env,
      },
      timeout: 30000,
    });
    return { stdout: result.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const error = err as { stdout?: string; status?: number };
    return {
      stdout: (error.stdout || "").trim(),
      exitCode: error.status || 1,
    };
  }
}

describe("cli", () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, "home", ".config", "wallet", "keys"), { recursive: true });
    mkdirSync(join(TEST_DIR, "home", ".config", "wallet", "sessions"), { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("info", () => {
    it("returns provider info", () => {
      const { stdout, exitCode } = runCli("info");
      expect(exitCode).toBe(0);

      const info = JSON.parse(stdout);
      expect(info.name).toBe("companion-wallet");
      expect(info.rdns).toBe("com.walletconnect.companion-wallet");
      expect(info.capabilities).toContain("accounts");
      expect(info.capabilities).toContain("sign-message");
      expect(info.capabilities).toContain("sign-typed-data");
      expect(info.capabilities).toContain("sign-transaction");
      expect(info.capabilities).toContain("send-transaction");
      expect(info.capabilities).toContain("grant-session");
      expect(info.chains).toContain("eip155:1");
      expect(info.chains).toContain("eip155:8453");
    });
  });

  describe("unsupported operation", () => {
    it("returns exit code 2 for unknown operation", () => {
      const { stdout, exitCode } = runCli("unknown-op");
      expect(exitCode).toBe(2);

      const output = JSON.parse(stdout);
      expect(output.code).toBe("UNSUPPORTED_OPERATION");
    });

    it("returns exit code 2 for no operation", () => {
      const { exitCode } = runCli("");
      expect(exitCode).toBe(2);
    });
  });

  describe("generate + accounts", () => {
    it("generates a wallet and lists accounts", () => {
      const genResult = runCli("generate");
      expect(genResult.exitCode).toBe(0);

      const { address, mnemonic } = JSON.parse(genResult.stdout);
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(mnemonic.split(" ")).toHaveLength(12);

      // List accounts
      const accResult = runCli("accounts");
      expect(accResult.exitCode).toBe(0);

      const { accounts } = JSON.parse(accResult.stdout);
      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts.some((a: { address: string }) => a.address === address)).toBe(true);
    });

    it("returns existing wallet on second generate call", () => {
      const first = runCli("generate");
      const { address: addr1, mnemonic } = JSON.parse(first.stdout);
      expect(mnemonic).toBeDefined();

      const second = runCli("generate");
      const parsed = JSON.parse(second.stdout);
      expect(parsed.address).toBe(addr1);
      expect(parsed.mnemonic).toBeUndefined();
    });
  });

  describe("sign-message", () => {
    it("signs a message with a generated key", () => {
      // Generate key
      const genResult = runCli("generate");
      const { address } = JSON.parse(genResult.stdout);

      // Sign message
      const signResult = runCli("sign-message", {
        account: address,
        message: "hello world",
      });
      expect(signResult.exitCode).toBe(0);

      const { signature } = JSON.parse(signResult.stdout);
      expect(signature).toMatch(/^0x[0-9a-f]+$/);
    });

    it("returns error for missing input", () => {
      const { stdout, exitCode } = runCli("sign-message");
      expect(exitCode).toBe(1);

      const output = JSON.parse(stdout);
      expect(output.code).toBe("INVALID_INPUT");
    });
  });

  describe("sign-typed-data", () => {
    it("signs EIP-712 typed data", () => {
      const genResult = runCli("generate");
      const { address } = JSON.parse(genResult.stdout);

      const signResult = runCli("sign-typed-data", {
        account: address,
        typedData: {
          domain: {
            name: "Test",
            version: "1",
            chainId: 1,
            verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
          },
          types: {
            Person: [
              { name: "name", type: "string" },
              { name: "wallet", type: "address" },
            ],
          },
          primaryType: "Person",
          message: {
            name: "Alice",
            wallet: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
          },
        },
      });
      expect(signResult.exitCode).toBe(0);

      const { signature } = JSON.parse(signResult.stdout);
      expect(signature).toMatch(/^0x[0-9a-f]+$/);
    });
  });

  describe("sign-transaction", () => {
    it("signs a transaction", () => {
      const genResult = runCli("generate");
      const { address } = JSON.parse(genResult.stdout);

      const signResult = runCli("sign-transaction", {
        account: address,
        transaction: {
          to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          value: "1000000000000000000",
        },
        chain: "eip155:1",
      });
      expect(signResult.exitCode).toBe(0);

      const { signedTransaction } = JSON.parse(signResult.stdout);
      expect(signedTransaction).toMatch(/^0x[0-9a-f]+$/);
    });
  });

  describe("sessions via CLI", () => {
    it("grant, get, and revoke session lifecycle", () => {
      const genResult = runCli("generate");
      const { address } = JSON.parse(genResult.stdout);

      // Grant session
      const grantResult = runCli("grant-session", {
        account: address,
        chain: "eip155:1",
        permissions: [{ operation: "sign-message" }],
        expiry: Date.now() + 3600000,
      });
      expect(grantResult.exitCode).toBe(0);

      const { sessionId } = JSON.parse(grantResult.stdout);
      expect(sessionId).toMatch(/^[0-9a-f]{32}$/);

      // Get session
      const getResult = runCli("get-session", { sessionId });
      expect(getResult.exitCode).toBe(0);

      const session = JSON.parse(getResult.stdout);
      expect(session.sessionId).toBe(sessionId);
      expect(session.revoked).toBe(false);

      // Revoke session
      const revokeResult = runCli("revoke-session", { sessionId });
      expect(revokeResult.exitCode).toBe(0);
      expect(JSON.parse(revokeResult.stdout).revoked).toBe(true);

      // Verify revoked
      const getResult2 = runCli("get-session", { sessionId });
      expect(JSON.parse(getResult2.stdout).revoked).toBe(true);
    });

    it("enforces session on sign-message", () => {
      const genResult = runCli("generate");
      const { address } = JSON.parse(genResult.stdout);

      // Grant session that only allows sign-typed-data
      const grantResult = runCli("grant-session", {
        account: address,
        chain: "eip155:1",
        permissions: [{ operation: "sign-typed-data" }],
        expiry: Date.now() + 3600000,
      });
      const { sessionId } = JSON.parse(grantResult.stdout);

      // Try sign-message with session that doesn't permit it
      const signResult = runCli("sign-message", {
        account: address,
        message: "hello",
        sessionId,
      });
      expect(signResult.exitCode).toBe(6); // SESSION_ERROR
    });
  });
});
