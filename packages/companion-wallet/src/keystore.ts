import { mkdirSync, writeFileSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { generateMnemonic, mnemonicToAccount, english } from "viem/accounts";
import { getAddress, type Hex } from "viem";
import type { WalletFile } from "./types.js";

const KEYS_DIR = join(homedir(), ".config", "wallet", "keys");

/**
 * Get the path to a key file by address.
 */
export function keyFilePath(address: string): string {
  return join(KEYS_DIR, `${getAddress(address)}.json`);
}

/**
 * Generate a new wallet (BIP-39 mnemonic) and save it to disk.
 * Returns the checksummed address and the mnemonic for backup.
 */
export function generateAndStore(): { address: string; mnemonic: string } {
  const mnemonic = generateMnemonic(english);
  const account = mnemonicToAccount(mnemonic);
  const address = getAddress(account.address);
  const filePath = keyFilePath(address);

  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });

  const walletFile: WalletFile = {
    version: 2,
    address,
    mnemonic,
  };
  atomicWrite(filePath, JSON.stringify(walletFile, null, 2));

  return { address, mnemonic };
}

/**
 * Load a private key from disk by deriving it from the stored mnemonic.
 */
export function loadKey(address: string): Hex {
  const filePath = keyFilePath(getAddress(address));
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as WalletFile;

  const hdKey = mnemonicToAccount(data.mnemonic).getHdKey();
  if (!hdKey.privateKey) {
    throw new Error("Failed to derive private key from mnemonic");
  }
  return `0x${Buffer.from(hdKey.privateKey).toString("hex")}` as Hex;
}

/**
 * Load the mnemonic for an address.
 */
export function loadMnemonic(address: string): string {
  const filePath = keyFilePath(getAddress(address));
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as WalletFile;
  return data.mnemonic;
}

/**
 * List all stored addresses.
 */
export function listAddresses(): string[] {
  try {
    const files = readdirSync(KEYS_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

/**
 * Resolve an account address: use the provided one, or fall back to the first stored address.
 */
export function resolveAccount(account?: string): string {
  if (account) return account;

  const addresses = listAddresses();
  if (addresses.length === 0) {
    throw new Error("No wallet found. Run 'companion-wallet generate' first.");
  }
  return addresses[0];
}

/**
 * Atomic write: write to .tmp file then rename.
 */
function atomicWrite(filePath: string, content: string): void {
  const tmpPath = filePath + ".tmp";
  writeFileSync(tmpPath, content, { mode: 0o600 });
  renameSync(tmpPath, filePath);
}
