import { WalletConnectCLI } from "./client.js";
import { resolveProjectId, setConfigValue, getConfigValue } from "./config.js";

const METADATA = {
  name: "walletconnect",
  description: "WalletConnect CLI",
  url: "https://github.com/ARI/walletconnect-cli-sdk",
  icons: [],
};

function usage(): void {
  console.log(`Usage: walletconnect <command> [options]

Commands:
  connect              Connect to a wallet via QR code
  whoami               Show current session info
  sign <message>       Sign a message with the connected wallet
  disconnect           Disconnect the current session
  config set <k> <v>   Set a config value (e.g. project-id)
  config get <k>       Get a config value

Options:
  --browser        Use browser UI instead of terminal QR code
  --help           Show this help message

Config keys:
  project-id       WalletConnect Cloud project ID

Environment:
  WALLETCONNECT_PROJECT_ID   Overrides config project-id when set`);
}

function getProjectId(): string {
  const id = resolveProjectId();
  if (!id) {
    console.error("Error: No project ID found. Set via: walletconnect config set project-id <id>");
    process.exit(1);
  }
  return id;
}

function createSDK(options: { projectId?: string; browser?: boolean }): WalletConnectCLI {
  return new WalletConnectCLI({
    projectId: options.projectId || "",
    metadata: METADATA,
    ui: options.browser ? "browser" : "terminal",
  });
}

function parseAccount(caip10: string): { chain: string; address: string } {
  // CAIP-10 format: namespace:chainId:address → e.g. eip155:1:0xABC
  const lastColon = caip10.lastIndexOf(":");
  return {
    chain: caip10.slice(0, lastColon),
    address: caip10.slice(lastColon + 1),
  };
}

async function cmdConnect(browser: boolean): Promise<void> {
  const projectId = getProjectId();
  const sdk = createSDK({ projectId, browser });

  try {
    console.log("Scan this QR code with your wallet app:\n");
    const result = await sdk.connect();
    console.log("\nConnected!");
    for (const account of result.accounts) {
      const { chain, address } = parseAccount(account);
      console.log(`  Chain:   ${chain}`);
      console.log(`  Address: ${address}`);
    }
  } finally {
    await sdk.destroy();
  }
}

async function cmdWhoami(): Promise<void> {
  const projectId = getProjectId();
  const sdk = createSDK({ projectId });
  try {
    const result = await sdk.tryRestore();
    if (!result) {
      console.log("Not connected.");
      process.exit(1);
    }
    const walletName = result.session.peer.metadata.name;
    console.log(`  Wallet:  ${walletName}`);
    for (const account of result.accounts) {
      const { chain, address } = parseAccount(account);
      console.log(`  Chain:   ${chain}`);
      console.log(`  Address: ${address}`);
    }
    const expiry = new Date(result.session.expiry * 1000);
    console.log(`  Expires: ${expiry.toLocaleString()}`);
  } finally {
    await sdk.destroy();
  }
}

async function cmdSign(message: string, browser: boolean): Promise<void> {
  const projectId = getProjectId();
  const sdk = createSDK({ projectId, browser });

  try {
    let result = await sdk.tryRestore();
    if (!result) {
      console.log("No existing session. Connecting...\n");
      result = await sdk.connect();
      console.log();
    }

    const { chain, address } = parseAccount(result.accounts[0]);
    const hexMessage = "0x" + Buffer.from(message, "utf8").toString("hex");

    const signature = await sdk.request<string>({
      chainId: chain,
      request: {
        method: "personal_sign",
        params: [hexMessage, address],
      },
    });

    console.log(`  Message:   ${message}`);
    console.log(`  Signature: ${signature}`);
  } finally {
    await sdk.destroy();
  }
}

async function cmdDisconnect(): Promise<void> {
  const projectId = getProjectId();
  const sdk = createSDK({ projectId });
  try {
    const result = await sdk.tryRestore();
    if (!result) {
      console.log("Not connected.");
      return;
    }
    await sdk.disconnect();
    console.log("Disconnected.");
  } finally {
    await sdk.destroy();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const browser = args.includes("--browser");
  const filtered = args.filter((a) => a !== "--browser");
  const command = filtered[0];

  switch (command) {
    case "connect":
      await cmdConnect(browser);
      break;
    case "whoami":
      await cmdWhoami();
      break;
    case "sign": {
      const message = filtered[1];
      if (!message) {
        console.error("Usage: walletconnect sign <message>");
        process.exit(1);
      }
      await cmdSign(message, browser);
      break;
    }
    case "disconnect":
      await cmdDisconnect();
      break;
    case "config": {
      const action = filtered[1];
      const key = filtered[2];
      if (action === "set") {
        const value = filtered[3];
        if (key === "project-id" && value) {
          setConfigValue("projectId", value);
          console.log(`Saved project-id to ~/.walletconnect-cli/config.json`);
        } else {
          console.error("Usage: walletconnect config set project-id <value>");
          process.exit(1);
        }
      } else if (action === "get") {
        if (key === "project-id") {
          const value = getConfigValue("projectId");
          console.log(value || "(not set)");
        } else {
          console.error("Usage: walletconnect config get project-id");
          process.exit(1);
        }
      } else {
        console.error("Usage: walletconnect config <set|get> <key> [value]");
        process.exit(1);
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
