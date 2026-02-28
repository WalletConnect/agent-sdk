import { WalletConnectCLI } from "./client.js";
import { resolveProjectId, setConfigValue, getConfigValue } from "./config.js";

const METADATA = {
  name: "WalletConnect Agent SDK",
  description: "WalletConnect CLI",
  url: "https://walletconnect.network",
  icons: [],
};

function usage(): void {
  console.log(`Usage: walletconnect <command> [options]

Commands:
  connect                       Connect to a wallet via QR code
  whoami                        Show current session info
  sign <message>                Sign a message with the connected wallet
  sign-typed-data <json>        Sign EIP-712 typed data (JSON string)
  send-transaction <json>       Send a transaction (EVM: to, data, value, gas; Solana: transaction, chainId)
  disconnect                    Disconnect the current session
  config set <k> <v>            Set a config value (e.g. project-id)
  config get <k>                Get a config value

Options:
  --browser        Use browser UI instead of terminal QR code
  --json           Output as JSON (for whoami)
  --chain <id>     Specify chain (e.g. eip155:10, solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp) for connect
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

function createSDK(options: { projectId?: string; browser?: boolean; chains?: string[] }): WalletConnectCLI {
  return new WalletConnectCLI({
    projectId: options.projectId || "",
    metadata: METADATA,
    ui: options.browser ? "browser" : "terminal",
    ...(options.chains ? { chains: options.chains } : {}),
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

function getNamespace(chainId: string): string {
  const colonIndex = chainId.indexOf(":");
  return colonIndex >= 0 ? chainId.slice(0, colonIndex) : chainId;
}

async function cmdConnect(browser: boolean, chains?: string[]): Promise<void> {
  const projectId = getProjectId();
  const sdk = createSDK({ projectId, browser, chains });

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

async function cmdWhoami(json: boolean): Promise<void> {
  const projectId = getProjectId();
  const sdk = createSDK({ projectId });
  try {
    const result = await sdk.tryRestore();
    if (!result) {
      if (json) {
        console.log(JSON.stringify({ connected: false }));
      } else {
        console.log("Not connected.");
      }
      process.exit(1);
    }
    const walletName = result.session.peer.metadata.name;
    const accounts = result.accounts.map((a) => parseAccount(a));
    const expiry = new Date(result.session.expiry * 1000);

    if (json) {
      console.log(JSON.stringify({
        wallet: walletName,
        accounts,
        expires: expiry.toISOString(),
      }));
    } else {
      console.log(`  Wallet:  ${walletName}`);
      for (const { chain, address } of accounts) {
        console.log(`  Chain:   ${chain}`);
        console.log(`  Address: ${address}`);
      }
      console.log(`  Expires: ${expiry.toLocaleString()}`);
    }
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

async function cmdSignTypedData(typedDataJson: string, browser: boolean): Promise<void> {
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

    // Validate JSON before sending
    try {
      JSON.parse(typedDataJson);
    } catch {
      console.error("Error: Invalid JSON for typed data. Provide a valid EIP-712 JSON string.");
      process.exit(1);
    }

    const signature = await sdk.request<string>({
      chainId: chain,
      request: {
        method: "eth_signTypedData_v4",
        params: [address, typedDataJson],
      },
    });

    console.log(JSON.stringify({ address, signature }));
  } finally {
    await sdk.destroy();
  }
}

async function cmdSendTransaction(jsonInput: string, browser: boolean): Promise<void> {
  const projectId = getProjectId();
  const tx = JSON.parse(jsonInput);
  const targetChain = tx.chainId;
  const sdk = createSDK({ projectId, browser, ...(targetChain ? { chains: [targetChain] } : {}) });

  try {
    let result = await sdk.tryRestore();
    if (!result) {
      process.stderr.write("No existing session. Connecting...\n\n");
      result = await sdk.connect();
    }

    const chainId = targetChain || parseAccount(result.accounts[0]).chain;
    const namespace = getNamespace(chainId);

    if (namespace === "solana") {
      // Solana: use solana_signTransaction with object params
      const response = await sdk.request<{ signature?: string; signedTransaction?: string } | string>({
        chainId,
        request: {
          method: "solana_signTransaction",
          params: { transaction: tx.transaction } as unknown as Record<string, unknown>,
        },
      });

      // Wallet may return { signature } or { signedTransaction } or a string
      const output = typeof response === "string"
        ? { signedTransaction: response }
        : response.signedTransaction
          ? { signedTransaction: response.signedTransaction }
          : response.signature
            ? { signature: response.signature }
            : response;
      process.stdout.write(JSON.stringify(output));
    } else {
      // EVM: existing eth_sendTransaction flow
      const from = tx.from || parseAccount(result.accounts[0]).address;

      const txHash = await sdk.request<string>({
        chainId,
        request: {
          method: "eth_sendTransaction",
          params: [{ from, to: tx.to, data: tx.data, value: tx.value || "0x0", gas: tx.gas }],
        },
      });

      process.stdout.write(JSON.stringify({ transactionHash: txHash }));
    }
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
  const json = args.includes("--json");
  const chains: string[] = [];
  const filtered: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--browser" || arg === "--json") continue;
    if (arg === "--chain" && i + 1 < args.length) {
      chains.push(args[++i]);
    } else if (arg.startsWith("--chain=")) {
      chains.push(arg.slice("--chain=".length));
    } else {
      filtered.push(arg);
    }
  }
  const command = filtered[0];

  switch (command) {
    case "connect":
      await cmdConnect(browser, chains.length > 0 ? chains : undefined);
      break;
    case "whoami":
      await cmdWhoami(json);
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
    case "sign-typed-data": {
      const typedData = filtered[1];
      if (!typedData) {
        console.error("Usage: walletconnect sign-typed-data <json>");
        process.exit(1);
      }
      await cmdSignTypedData(typedData, browser);
      break;
    }
    case "send-transaction": {
      const txJson = filtered[1];
      if (!txJson) {
        console.error("Usage: walletconnect send-transaction '<json>'");
        process.exit(1);
      }
      await cmdSendTransaction(txJson, browser);
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
