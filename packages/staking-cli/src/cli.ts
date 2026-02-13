import { WalletConnectCLI, resolveProjectId } from "@walletconnect/cli-sdk";
import { CAIP2_CHAIN_ID, CLI_METADATA } from "./constants.js";
import { stake, unstake, claim, status, balance } from "./commands.js";

function usage(): void {
  console.log(`Usage: walletconnect-staking <command> [options]

Commands:
  stake <amount> <weeks>   Stake WCT (approve + createLock/updateLock)
  unstake                  Withdraw all staked WCT (after lock expires)
  claim                    Claim staking rewards
  status                   Show staking position, rewards, and APY
  balance                  Show WCT token balance

Options:
  --address=0x...          Use address directly (for read-only commands)
  --browser                Use browser UI for wallet connection
  --help                   Show this help message

Environment:
  WALLETCONNECT_PROJECT_ID   Overrides config project-id when set

Configure project ID globally with: walletconnect config set project-id <id>`);
}

function getProjectId(): string {
  const id = resolveProjectId();
  if (!id) {
    console.error("Error: No project ID found. Set via: walletconnect config set project-id <id>");
    process.exit(1);
  }
  return id;
}

function parseArgs(argv: string[]): {
  command: string | undefined;
  positional: string[];
  address: string | undefined;
  browser: boolean;
} {
  let address: string | undefined;
  let browser = false;
  const positional: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith("--address=")) {
      address = arg.slice("--address=".length);
    } else if (arg === "--browser") {
      browser = true;
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
    browser,
  };
}

function parseAccount(caip10: string): string {
  const lastColon = caip10.lastIndexOf(":");
  return caip10.slice(lastColon + 1);
}

/** Find an eip155:10 account in the session, or return null */
function findOptimismAccount(accounts: string[]): string | null {
  const match = accounts.find((a) => a.startsWith("eip155:10:"));
  return match ? parseAccount(match) : null;
}

async function resolveAddress(opts: {
  address?: string;
  requireWallet: boolean;
  browser: boolean;
}): Promise<{ address: string; wallet: WalletConnectCLI | null }> {
  if (opts.address) {
    return { address: opts.address, wallet: null };
  }

  const projectId = opts.requireWallet ? getProjectId() : (process.env.WALLETCONNECT_PROJECT_ID || "");
  const wallet = new WalletConnectCLI({
    projectId,
    metadata: CLI_METADATA,
    chains: [CAIP2_CHAIN_ID],
    ui: opts.browser ? "browser" : "terminal",
  });

  // Try restoring an existing session
  const existing = await wallet.tryRestore();
  if (existing) {
    const addr = findOptimismAccount(existing.accounts);
    if (addr) {
      return { address: addr, wallet };
    }
    // Session exists but doesn't have Optimism — need a new connection
    console.log("Existing session does not include Optimism. Requesting new connection...\n");
    await wallet.disconnect();
  }

  if (!opts.requireWallet) {
    await wallet.destroy();
    console.error("Error: No session with Optimism support found. Use --address=0x... or connect a wallet first.");
    process.exit(1);
  }

  // Connect fresh — autoConnect would reuse the old session, so bypass it
  console.log("Scan this QR code with your wallet app:\n");
  const result = await wallet.connect();
  console.log(`\nConnected to ${result.session.peer.metadata.name}\n`);

  const addr = findOptimismAccount(result.accounts);
  if (!addr) {
    await wallet.destroy();
    console.error("Error: Wallet did not approve Optimism (eip155:10). Please try again and approve the Optimism chain.");
    process.exit(1);
  }

  return { address: addr, wallet };
}

async function main(): Promise<void> {
  const { command, positional, address, browser } = parseArgs(process.argv.slice(2));

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
      const { address: addr, wallet } = await resolveAddress({
        address,
        requireWallet: true,
        browser,
      });
      try {
        await stake(wallet!, addr, amount, weeksNum);
      } finally {
        await wallet!.destroy();
      }
      break;
    }

    case "unstake": {
      const { address: addr, wallet } = await resolveAddress({
        address,
        requireWallet: true,
        browser,
      });
      try {
        await unstake(wallet!, addr);
      } finally {
        await wallet!.destroy();
      }
      break;
    }

    case "claim": {
      const { address: addr, wallet } = await resolveAddress({
        address,
        requireWallet: true,
        browser,
      });
      try {
        await claim(wallet!, addr);
      } finally {
        await wallet!.destroy();
      }
      break;
    }

    case "status": {
      const { address: addr, wallet } = await resolveAddress({
        address,
        requireWallet: false,
        browser,
      });
      try {
        await status(addr);
      } finally {
        if (wallet) await wallet.destroy();
      }
      break;
    }

    case "balance": {
      const { address: addr, wallet } = await resolveAddress({
        address,
        requireWallet: false,
        browser,
      });
      try {
        await balance(addr);
      } finally {
        if (wallet) await wallet.destroy();
      }
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
