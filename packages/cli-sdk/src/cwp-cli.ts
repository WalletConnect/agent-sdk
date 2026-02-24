import { discoverProviders, getProvider, getDefaultProvider } from "./cwp/discovery.js";
import { walletExec, WalletExecError, ExitCode } from "./cwp/exec.js";

const OPERATIONS = [
  "accounts",
  "sign-message",
  "sign-typed-data",
  "sign-transaction",
  "send-transaction",
] as const;

type Operation = (typeof OPERATIONS)[number];

function usage(): void {
  console.log(`Usage: wallet <command> [options]

Commands:
  list                         Discover wallet providers on PATH
  accounts                     List accounts from wallet provider
  sign-message                 Sign a plaintext message (JSON on stdin)
  sign-typed-data              Sign EIP-712 typed data (JSON on stdin)
  sign-transaction             Sign a transaction (JSON on stdin)
  send-transaction             Sign and send a transaction (JSON on stdin)

Options:
  --wallet <name>              Use a specific wallet provider
  --json                       Output as JSON (default)
  --help                       Show this help message`);
}

function parseArgs(argv: string[]): {
  command: string | null;
  wallet: string | null;
} {
  let command: string | null = null;
  let wallet: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--wallet" && i + 1 < argv.length) {
      wallet = argv[++i];
    } else if (arg === "--help") {
      usage();
      process.exit(0);
    } else if (!arg.startsWith("--") && !command) {
      command = arg;
    }
  }

  return { command, wallet };
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

async function handleList(): Promise<void> {
  const providers = await discoverProviders();

  if (providers.length === 0) {
    console.log(
      JSON.stringify({ providers: [], message: "No wallet providers found on PATH" }),
    );
    return;
  }

  const output = providers.map((p) => ({
    name: p.shortName,
    binary: p.binary,
    path: p.path,
    ...(p.info || {}),
    ...(p.error ? { error: p.error } : {}),
  }));

  console.log(JSON.stringify({ providers: output }, null, 2));
}

async function handleOperation(
  operation: Operation,
  walletName: string | null,
): Promise<void> {
  // Resolve the provider
  const provider = walletName
    ? await getProvider(walletName)
    : await getDefaultProvider();

  if (!provider) {
    const msg = walletName
      ? `Wallet provider "${walletName}" not found on PATH`
      : "No wallet providers found on PATH";
    console.error(msg);
    process.exit(ExitCode.GENERAL_ERROR);
  }

  if (!provider.info) {
    console.error(
      `Wallet provider "${provider.shortName}" failed to respond: ${provider.error}`,
    );
    process.exit(ExitCode.GENERAL_ERROR);
  }

  // Check capability
  if (!provider.info.capabilities.includes(operation)) {
    console.error(
      `Wallet provider "${provider.shortName}" does not support "${operation}". Capabilities: ${provider.info.capabilities.join(", ")}`,
    );
    process.exit(ExitCode.UNSUPPORTED);
  }

  // Read stdin for input
  const stdinData = await readStdin();
  let input: object | undefined;
  if (stdinData) {
    try {
      input = JSON.parse(stdinData);
    } catch {
      console.error("Invalid JSON on stdin");
      process.exit(ExitCode.GENERAL_ERROR);
    }
  }

  // Determine timeout based on operation
  const timeouts: Record<Operation, number> = {
    accounts: 10000,
    "sign-message": 120000,
    "sign-typed-data": 120000,
    "sign-transaction": 120000,
    "send-transaction": 180000,
  };

  try {
    const result = await walletExec(
      provider.path,
      operation,
      input,
      timeouts[operation],
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    if (err instanceof WalletExecError) {
      console.error(err.message);
      process.exit(err.exitCode);
    }
    throw err;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, wallet } = parseArgs(args);

  if (!command) {
    usage();
    process.exit(ExitCode.GENERAL_ERROR);
  }

  if (command === "list") {
    await handleList();
    return;
  }

  if (OPERATIONS.includes(command as Operation)) {
    await handleOperation(command as Operation, wallet);
    return;
  }

  console.error(`Unknown command: ${command}`);
  usage();
  process.exit(ExitCode.GENERAL_ERROR);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(ExitCode.GENERAL_ERROR);
});
