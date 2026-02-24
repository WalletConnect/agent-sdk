import { selectProvider, walletExec } from "@walletconnect/cli-sdk";
import type { WalletProviderInfo } from "@walletconnect/cli-sdk";
import { CAIP2_CHAIN_ID } from "./constants.js";
import { stake, unstake, claim, status, balance } from "./commands.js";
import { createCwpSender } from "./wallet.js";

function usage(): void {
  console.log(`Usage: walletconnect-staking <command> [options]

Commands:
  stake <amount> <weeks>   Stake WCT (approve + createLock/updateLock)
  unstake                  Withdraw all staked WCT (after lock expires)
  claim                    Claim staking rewards
  status --address=0x...   Show staking position, rewards, and APY
  balance --address=0x...  Show WCT token balance

Options:
  --address=0x...          Address (required for status/balance, optional for wallet commands)
  --wallet <name>          Use a specific wallet provider
  --help                   Show this help message`);
}

function parseArgs(argv: string[]): {
  command: string | undefined;
  positional: string[];
  address: string | undefined;
  wallet: string | undefined;
} {
  let address: string | undefined;
  let wallet: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--address=")) {
      address = arg.slice("--address=".length);
    } else if (arg === "--wallet" && i + 1 < argv.length) {
      wallet = argv[++i];
    } else if (arg.startsWith("--wallet=")) {
      wallet = arg.slice("--wallet=".length);
    } else if (arg === "--help" || arg === "-h") {
      positional.unshift("--help");
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  return {
    command: positional[0],
    positional: positional.slice(1),
    address,
    wallet,
  };
}

/** Find an eip155:10 account from a CWP provider */
async function findOptimismAccount(provider: WalletProviderInfo): Promise<string | null> {
  const result = (await walletExec(provider.path, "accounts", undefined, 10000)) as {
    accounts: Array<{ address: string; chain: string }>;
  };

  const match = result.accounts.find((a) => a.chain === CAIP2_CHAIN_ID);
  return match ? match.address : null;
}

/** Select a provider and resolve the account address for wallet commands */
async function resolveWallet(
  walletName: string | undefined,
  addressOverride: string | undefined,
): Promise<{ address: string; providerPath: string }> {
  const provider = await selectProvider({
    wallet: walletName,
    capability: "send-transaction",
    chain: CAIP2_CHAIN_ID,
  });

  if (!provider) {
    console.error("Error: No compatible wallet provider found. Install a CWP wallet provider.");
    process.exit(1);
  }

  if (addressOverride) {
    return { address: addressOverride, providerPath: provider.path };
  }

  const address = await findOptimismAccount(provider);
  if (!address) {
    console.error(`Error: Wallet "${provider.info!.name}" has no Optimism account.`);
    process.exit(1);
  }

  console.log(`Account: ${address}`);

  return { address, providerPath: provider.path };
}

async function main(): Promise<void> {
  const { command, positional, address, wallet } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "stake": {
      const amount = positional[0];
      const weeks = positional[1];
      if (!amount || !weeks) {
        console.error("Usage: walletconnect-staking stake <amount> <weeks>");
        process.exit(1);
      }
      const weeksNum = parseInt(weeks, 10);
      if (isNaN(weeksNum) || weeksNum <= 0) {
        console.error("Error: <weeks> must be a positive integer.");
        process.exit(1);
      }
      const resolved = await resolveWallet(wallet, address);
      await stake(createCwpSender(resolved.providerPath), resolved.address, amount, weeksNum);
      break;
    }

    case "unstake": {
      const resolved = await resolveWallet(wallet, address);
      await unstake(createCwpSender(resolved.providerPath), resolved.address);
      break;
    }

    case "claim": {
      const resolved = await resolveWallet(wallet, address);
      await claim(createCwpSender(resolved.providerPath), resolved.address);
      break;
    }

    case "status": {
      if (!address) {
        console.error("Usage: walletconnect-staking status --address=0x...");
        process.exit(1);
      }
      await status(address);
      break;
    }

    case "balance": {
      if (!address) {
        console.error("Usage: walletconnect-staking balance --address=0x...");
        process.exit(1);
      }
      await balance(address);
      break;
    }

    case "--help":
    case "-h":
    case undefined:
      usage();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
