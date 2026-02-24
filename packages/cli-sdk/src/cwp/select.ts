import { createInterface } from "node:readline/promises";
import { discoverProviders, getProvider } from "./discovery.js";
import type { WalletProviderInfo } from "./discovery.js";

export interface SelectProviderOptions {
  /** Only show providers that support this capability (e.g. "send-transaction") */
  capability?: string;
  /** Only show providers that support this chain (e.g. "eip155:10") */
  chain?: string;
  /** Skip interactive selection — use this provider by name */
  wallet?: string;
}

/**
 * Interactive provider selection.
 *
 * - If `wallet` is set, looks up that provider directly.
 * - Otherwise discovers providers, filters by capability/chain,
 *   auto-selects if only one matches, or prompts the user.
 *
 * Prompts are written to stderr so stdout stays clean for JSON.
 * Returns null if no providers match or the user cancels.
 */
export async function selectProvider(
  options: SelectProviderOptions = {},
): Promise<WalletProviderInfo | null> {
  // Direct lookup by name
  if (options.wallet) {
    const provider = await getProvider(options.wallet);
    if (!provider || !provider.info) {
      process.stderr.write(
        `Wallet provider "${options.wallet}" not found or not responding.\n`,
      );
      return null;
    }
    return provider;
  }

  // Discover and filter
  const all = await discoverProviders();
  let candidates = all.filter((p) => p.info !== null);

  if (options.capability) {
    candidates = candidates.filter((p) =>
      p.info!.capabilities.includes(options.capability!),
    );
  }

  if (options.chain) {
    const namespace = options.chain.split(":")[0];
    candidates = candidates.filter((p) =>
      p.info!.chains.some(
        (c) => c === options.chain || c === namespace,
      ),
    );
  }

  if (candidates.length === 0) {
    process.stderr.write("No wallet providers found.\n");
    return null;
  }

  // Auto-select if only one
  if (candidates.length === 1) {
    process.stderr.write(`Using wallet: ${candidates[0].info!.name}\n`);
    return candidates[0];
  }

  // Interactive selection
  process.stderr.write("Select a wallet:\n");
  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    const chains = p.info!.chains.join(", ");
    process.stderr.write(`  ${i + 1}) ${p.info!.name} (${chains})\n`);
  }

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`Choice [1-${candidates.length}]: `);
    const idx = parseInt(answer, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      process.stderr.write("Invalid selection.\n");
      return null;
    }
    return candidates[idx];
  } finally {
    rl.close();
  }
}
