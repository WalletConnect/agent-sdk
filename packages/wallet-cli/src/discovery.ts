import { readdirSync, accessSync, constants, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { walletExec, WalletExecError } from "./exec.js";

export interface WalletProviderInfo {
  /** Binary name (e.g., "wallet-walletconnect") */
  binary: string;
  /** Provider short name (e.g., "walletconnect") */
  shortName: string;
  /** Full path to the binary */
  path: string;
  /** Info returned by `wallet-<name> info` */
  info: {
    name: string;
    version: string;
    rdns?: string;
    capabilities: string[];
    chains: string[];
  } | null;
  /** Error if info call failed */
  error?: string;
}

export interface WalletConfig {
  default?: string;
  disabled?: string[];
  priority?: string[];
}

/**
 * Find all wallet-* executables on PATH.
 * Returns deduped list of { binary, shortName, path }.
 */
function findWalletBinaries(): Array<{
  binary: string;
  shortName: string;
  path: string;
}> {
  const pathDirs = (process.env.PATH || "").split(":");
  const seen = new Set<string>();
  const results: Array<{ binary: string; shortName: string; path: string }> =
    [];

  for (const dir of pathDirs) {
    if (!dir) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue; // Directory doesn't exist or no permissions
    }

    for (const entry of entries) {
      if (!entry.startsWith("wallet-")) continue;
      if (seen.has(entry)) continue; // First on PATH wins

      const fullPath = join(dir, entry);
      try {
        accessSync(fullPath, constants.X_OK);
      } catch {
        continue; // Not executable
      }

      const shortName = entry.slice("wallet-".length);
      seen.add(entry);
      results.push({ binary: entry, shortName, path: fullPath });
    }
  }

  return results;
}

/**
 * Load user config from ~/.config/wallet/config.json.
 */
function loadConfig(): WalletConfig {
  try {
    const configPath = join(homedir(), ".config", "wallet", "config.json");
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Discover all wallet providers on PATH.
 *
 * 1. Scans PATH for wallet-* executables
 * 2. Calls `wallet-<name> info` on each (3s timeout, in parallel)
 * 3. Deduplicates by name (first on PATH wins)
 * 4. Reads ~/.config/wallet/config.json for priority/default/disabled
 * 5. Returns sorted list
 */
export async function discoverProviders(): Promise<WalletProviderInfo[]> {
  const binaries = findWalletBinaries();
  const config = loadConfig();

  // Filter disabled providers
  const disabled = new Set(config.disabled || []);
  const active = binaries.filter((b) => !disabled.has(b.shortName));

  // Call info on each provider in parallel
  const providers = await Promise.all(
    active.map(async (b) => {
      const provider: WalletProviderInfo = {
        binary: b.binary,
        shortName: b.shortName,
        path: b.path,
        info: null,
      };

      try {
        const result = (await walletExec(b.path, "info", undefined, 3000)) as {
          name: string;
          version: string;
          rdns?: string;
          capabilities: string[];
          chains: string[];
        };
        provider.info = result;
      } catch (err) {
        provider.error =
          err instanceof WalletExecError ? err.message : String(err);
      }

      return provider;
    }),
  );

  // Sort: priority list first, then alphabetical
  const priority = config.priority || [];
  providers.sort((a, b) => {
    const aIdx = priority.indexOf(a.shortName);
    const bIdx = priority.indexOf(b.shortName);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.shortName.localeCompare(b.shortName);
  });

  return providers;
}

/**
 * Get the default provider name from config, or first available.
 */
export async function getDefaultProvider(): Promise<WalletProviderInfo | null> {
  const providers = await discoverProviders();
  const config = loadConfig();

  if (config.default) {
    const found = providers.find((p) => p.shortName === config.default);
    if (found?.info) return found;
  }

  // First provider with successful info
  return providers.find((p) => p.info !== null) || null;
}

/**
 * Get a specific provider by name.
 */
export async function getProvider(
  name: string,
): Promise<WalletProviderInfo | null> {
  const providers = await discoverProviders();
  return providers.find((p) => p.shortName === name) || null;
}
