import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { getAddress } from "viem";

// We test the internal functions by importing them,
// but use a temp directory to avoid touching real keystore
const TEST_DIR = join(tmpdir(), `wallet-test-${randomBytes(8).toString("hex")}`);

// Override the KEYS_DIR by mocking the homedir
import { vi } from "vitest";
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    homedir: () => join(TEST_DIR, "home"),
  };
});

// Must import after mock setup
const { generateAndStore, loadKey, loadMnemonic, listAddresses, keyFilePath } = await import("../src/keystore.js");

describe("keystore", () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, "home", ".config", "wallet", "keys"), { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("generateAndStore", () => {
    it("generates a wallet file with mnemonic", () => {
      const { address, mnemonic } = generateAndStore();

      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(mnemonic.split(" ")).toHaveLength(12);

      const filePath = keyFilePath(address);
      expect(existsSync(filePath)).toBe(true);

      const walletFile = JSON.parse(readFileSync(filePath, "utf-8"));
      expect(walletFile.version).toBe(2);
      expect(walletFile.address).toBe(getAddress(address));
      expect(walletFile.mnemonic).toBe(mnemonic);
    });

    it("generates unique addresses each time", () => {
      const { address: addr1 } = generateAndStore();
      const { address: addr2 } = generateAndStore();
      expect(addr1).not.toBe(addr2);
    });
  });

  describe("loadKey", () => {
    it("loads a private key derived from the mnemonic", () => {
      const { address } = generateAndStore();
      const privateKey = loadKey(address);

      expect(privateKey).toMatch(/^0x[0-9a-f]{64}$/);

      // Verify the key corresponds to the address
      const account = privateKeyToAccount(privateKey);
      expect(getAddress(account.address)).toBe(getAddress(address));
    });

    it("throws for non-existent address", () => {
      expect(() => loadKey("0x0000000000000000000000000000000000000001"))
        .toThrow();
    });
  });

  describe("loadMnemonic", () => {
    it("loads the stored mnemonic", () => {
      const { address, mnemonic } = generateAndStore();
      const loaded = loadMnemonic(address);
      expect(loaded).toBe(mnemonic);
    });
  });

  describe("listAddresses", () => {
    it("returns empty array when no keys exist", () => {
      const addresses = listAddresses();
      expect(addresses).toEqual([]);
    });

    it("returns addresses of stored keys", () => {
      const { address: addr1 } = generateAndStore();
      const { address: addr2 } = generateAndStore();

      const addresses = listAddresses();
      expect(addresses).toHaveLength(2);
      expect(addresses).toContain(getAddress(addr1));
      expect(addresses).toContain(getAddress(addr2));
    });
  });

  describe("keyFilePath", () => {
    it("returns checksummed path ending in .json", () => {
      const path = keyFilePath("0xabcdef0123456789abcdef0123456789abcdef01");
      // Should contain checksummed address (mixed-case)
      expect(path).toMatch(/0x[0-9a-fA-F]{40}\.json$/);
      // Should not be all-lowercase
      expect(path).not.toContain("0xabcdef0123456789abcdef0123456789abcdef01.json");
    });
  });
});
