#!/usr/bin/env node

import { program } from "commander";
import {
  discoverProviders,
  getProvider,
  getDefaultProvider,
  walletExec,
} from "@walletconnect/cli-sdk";
import { createCwpSigner } from "./cwp-signer.js";
import { initializeClient } from "./x402-client.js";
import { startProxy } from "./proxy.js";
import { logger } from "./logger.js";

const DEFAULT_PORT = 8402;
const DEFAULT_MAX_PAYMENT = BigInt("100000"); // 0.1 USDC (6 decimals)

function getDefaultPort(): number {
  const envPort = process.env.X402_PROXY_PORT;
  if (envPort) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return DEFAULT_PORT;
}

function getDefaultMaxPayment(): bigint {
  const envMax = process.env.X402_MAX_PAYMENT;
  if (envMax) {
    try {
      return BigInt(envMax);
    } catch {
      logger.warn(`Invalid X402_MAX_PAYMENT value "${envMax}", using default`);
    }
  }
  return DEFAULT_MAX_PAYMENT;
}

program
  .name("x402-browser-proxy")
  .description(
    "MITM proxy that intercepts HTTP 402 responses and auto-signs x402 payments via CWP",
  )
  .version("0.0.0");

program
  .command("start")
  .description("Start the x402 payment proxy")
  .option(
    "-p, --port <number>",
    "Proxy port",
    String(getDefaultPort()),
  )
  .option(
    "-m, --max-payment <amount>",
    "Maximum payment in smallest unit",
    getDefaultMaxPayment().toString(),
  )
  .option("--host <address>", "Host to bind to", "127.0.0.1")
  .option("-w, --wallet <name>", "CWP provider name (auto-discovers if omitted)")
  .option("-s, --session <id>", "Companion-wallet session ID for spending limits")
  .action(async (options) => {
    const port = parseInt(options.port, 10) || getDefaultPort();
    const maxPayment = BigInt(options.maxPayment || getDefaultMaxPayment());
    const host = options.host || "127.0.0.1";

    // Discover or select CWP provider
    let provider;
    if (options.wallet) {
      provider = await getProvider(options.wallet);
      if (!provider) {
        logger.error(`CWP provider "${options.wallet}" not found`);
        logger.info("Run 'x402-browser-proxy list-wallets' to see available providers");
        process.exit(1);
      }
    } else {
      provider = await getDefaultProvider();
      if (!provider) {
        logger.error("No CWP wallet providers found on PATH");
        logger.info(
          "Install a wallet provider (e.g., companion-wallet) and ensure wallet-<name> is on PATH",
        );
        process.exit(1);
      }
    }

    logger.info(`Using CWP provider: ${provider.info?.name || provider.shortName} (${provider.binary})`);

    // Get the wallet account address via CWP "accounts" operation
    let account: `0x${string}`;
    try {
      const result = (await walletExec(provider.path, "accounts", undefined, 5000)) as {
        accounts: Array<{ chain: string; address: `0x${string}` }>;
      };
      if (!result.accounts || result.accounts.length === 0) {
        logger.error("No accounts found in wallet. Run 'wallet-companion generate' first.");
        process.exit(1);
      }
      account = result.accounts[0].address;
    } catch (err) {
      logger.error(`Failed to get wallet accounts: ${err}`);
      process.exit(1);
    }

    logger.info(`Wallet address: ${account}`);

    // Create the CWP signer and initialize x402 client
    const signer = createCwpSigner({
      path: provider.path,
      account,
      sessionId: options.session,
    });

    const { httpClient, walletAddress } = initializeClient(signer);

    if (options.session) {
      logger.info(`Using session: ${options.session}`);
    }

    startProxy({ port, maxPayment, host, httpClient, walletAddress });
  });

program
  .command("list-wallets")
  .description("List available CWP wallet providers")
  .action(async () => {
    const providers = await discoverProviders();

    if (providers.length === 0) {
      console.log("No CWP wallet providers found on PATH.");
      console.log(
        "\nInstall a provider (e.g., companion-wallet) and ensure wallet-<name> is on PATH.",
      );
      return;
    }

    console.log("Available CWP wallet providers:\n");
    for (const p of providers) {
      const status = p.info
        ? `${p.info.name} v${p.info.version}`
        : `(error: ${p.error})`;
      const chains = p.info?.chains?.join(", ") || "unknown";
      const caps = p.info?.capabilities?.join(", ") || "unknown";
      console.log(`  ${p.shortName}`);
      console.log(`    Binary: ${p.path}`);
      console.log(`    Status: ${status}`);
      console.log(`    Chains: ${chains}`);
      console.log(`    Capabilities: ${caps}`);
      console.log("");
    }
  });

program.parse();
