import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateAndStore, loadKey, listAddresses } from "./keystore.js";
import { signMessage, signTypedData, signTransaction } from "./signer.js";
import { sendTransaction } from "./rpc.js";
import { SUPPORTED_CHAINS } from "./chains.js";
import { fund } from "./fund.js";
import { drain } from "./drain.js";
import { selectChain, selectToken, inputAmount, inputAddress } from "./prompt.js";
import {
  grantSession,
  revokeSession,
  loadSession,
  validateSession,
  recordSessionUsage,
  SessionError,
} from "./sessions.js";
import {
  ExitCode,
  type Operation,
  type InfoResponse,
  type AccountsResponse,
  type SignMessageInput,
  type SignTypedDataInput,
  type SignTransactionInput,
  type SendTransactionInput,
  type GrantSessionInput,
  type RevokeSessionInput,
  type GetSessionInput,
  type ErrorResponse,
} from "./types.js";

function getVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
    );
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

function respond(data: object): void {
  process.stdout.write(JSON.stringify(data) + "\n");
}

function respondError(error: string, code: string): void {
  const resp: ErrorResponse = { error, code };
  process.stdout.write(JSON.stringify(resp) + "\n");
}

async function parseInput<T>(): Promise<T | null> {
  const raw = await readStdin();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    respondError("Invalid JSON input", "INVALID_INPUT");
    process.exit(ExitCode.ERROR);
  }
}

async function handleInfo(): Promise<void> {
  const info: InfoResponse = {
    name: "companion-wallet",
    version: getVersion(),
    rdns: "com.walletconnect.companion-wallet",
    capabilities: [
      "accounts",
      "sign-message",
      "sign-typed-data",
      "sign-transaction",
      "send-transaction",
      "grant-session",
      "revoke-session",
      "get-session",
      "fund",
      "drain",
    ],
    chains: SUPPORTED_CHAINS,
  };
  respond(info);
}

async function handleGenerate(): Promise<void> {
  const existing = listAddresses();
  if (existing.length > 0) {
    respond({ address: existing[0] });
    return;
  }

  const { address, mnemonic } = generateAndStore();
  respond({ address, mnemonic });
  process.stderr.write(
    "\n⚠️  BACKUP YOUR SEED PHRASE — it will not be shown again.\n" +
    "   Anyone with this phrase can access your funds.\n\n",
  );
}

async function handleAccounts(): Promise<void> {
  const addresses = listAddresses();
  const accounts: AccountsResponse = {
    accounts: addresses.flatMap((address) =>
      SUPPORTED_CHAINS.map((chain) => ({ chain, address })),
    ),
  };
  respond(accounts);
}

async function handleSignMessage(): Promise<void> {
  const input = await parseInput<SignMessageInput>();
  if (!input?.account || !input?.message) {
    respondError("Missing account or message", "INVALID_INPUT");
    process.exit(ExitCode.ERROR);
  }

  if (input.sessionId) {
    validateSessionOrExit(input.sessionId, "sign-message", input);
  }

  const privateKey = loadKey(input.account);
  const signature = await signMessage(privateKey, input.message);

  if (input.sessionId) {
    recordSessionUsage(input.sessionId, "sign-message");
  }

  respond({ signature });
}

async function handleSignTypedData(): Promise<void> {
  const input = await parseInput<SignTypedDataInput>();
  if (!input?.account || !input?.typedData) {
    respondError("Missing account or typedData", "INVALID_INPUT");
    process.exit(ExitCode.ERROR);
  }

  if (input.sessionId) {
    validateSessionOrExit(input.sessionId, "sign-typed-data", input);
  }

  const privateKey = loadKey(input.account);
  const signature = await signTypedData(privateKey, input.typedData);

  if (input.sessionId) {
    recordSessionUsage(input.sessionId, "sign-typed-data");
  }

  respond({ signature });
}

async function handleSignTransaction(): Promise<void> {
  const input = await parseInput<SignTransactionInput>();
  if (!input?.account || !input?.transaction || !input?.chain) {
    respondError("Missing account, transaction, or chain", "INVALID_INPUT");
    process.exit(ExitCode.ERROR);
  }

  if (input.sessionId) {
    validateSessionOrExit(input.sessionId, "sign-transaction", input);
  }

  const privateKey = loadKey(input.account);
  const signedTransaction = await signTransaction(
    privateKey,
    input.transaction,
    input.chain,
  );

  if (input.sessionId) {
    recordSessionUsage(input.sessionId, "sign-transaction");
  }

  respond({ signedTransaction });
}

async function handleSendTransaction(): Promise<void> {
  const input = await parseInput<SendTransactionInput>();
  if (!input?.account || !input?.transaction || !input?.chain) {
    respondError("Missing account, transaction, or chain", "INVALID_INPUT");
    process.exit(ExitCode.ERROR);
  }

  if (input.sessionId) {
    validateSessionOrExit(input.sessionId, "send-transaction", input);
  }

  const privateKey = loadKey(input.account);
  const transactionHash = await sendTransaction(
    privateKey,
    input.transaction,
    input.chain,
  );

  if (input.sessionId) {
    recordSessionUsage(input.sessionId, "send-transaction", input);
  }

  respond({ transactionHash });
}

async function handleGrantSession(): Promise<void> {
  const input = await parseInput<GrantSessionInput>();
  if (!input?.account || !input?.chain || !input?.permissions || !input?.expiry) {
    respondError(
      "Missing account, chain, permissions, or expiry",
      "INVALID_INPUT",
    );
    process.exit(ExitCode.ERROR);
  }

  const session = grantSession(input);
  respond({
    sessionId: session.sessionId,
    permissions: session.permissions,
    expiry: session.expiry,
  });
}

async function handleRevokeSession(): Promise<void> {
  const input = await parseInput<RevokeSessionInput>();
  if (!input?.sessionId) {
    respondError("Missing sessionId", "INVALID_INPUT");
    process.exit(ExitCode.ERROR);
  }

  try {
    revokeSession(input.sessionId);
    respond({ revoked: true });
  } catch (err) {
    respondError(
      err instanceof Error ? err.message : "Failed to revoke session",
      "SESSION_ERROR",
    );
    process.exit(ExitCode.SESSION_ERROR);
  }
}

async function handleGetSession(): Promise<void> {
  const input = await parseInput<GetSessionInput>();
  if (!input?.sessionId) {
    respondError("Missing sessionId", "INVALID_INPUT");
    process.exit(ExitCode.ERROR);
  }

  try {
    const session = loadSession(input.sessionId);
    respond(session);
  } catch (err) {
    respondError(
      err instanceof Error ? err.message : "Session not found",
      "SESSION_ERROR",
    );
    process.exit(ExitCode.SESSION_ERROR);
  }
}

function parseCliArg(name: string): string | undefined {
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

function warnBeta(): void {
  process.stderr.write(
    "WARNING: companion-wallet is beta software. Do not use with real funds on mainnet.\n",
  );
}

async function handleFund(): Promise<void> {
  warnBeta();
  const account = parseCliArg("account");
  let amount = parseCliArg("amount");
  let chain = parseCliArg("chain");
  let token = parseCliArg("token");

  try {
    // Interactive prompts when flags are missing and stdin is a TTY
    if (process.stdin.isTTY) {
      if (!chain) chain = await selectChain();
      if (!token) token = await selectToken(chain);
      if (!amount) amount = await inputAmount(token);
    }

    if (!amount) {
      respondError("Missing --amount", "INVALID_INPUT");
      process.exit(ExitCode.ERROR);
    }

    chain = chain || "eip155:1";
    token = token || "eth";

    const result = await fund({ account, amount, chain, token });
    respond(result);
  } catch (err) {
    respondError(
      err instanceof Error ? err.message : "Fund failed",
      "FUND_ERROR",
    );
    process.exit(ExitCode.ERROR);
  }
}

async function handleDrain(): Promise<void> {
  warnBeta();
  const account = parseCliArg("account");
  let to = parseCliArg("to");
  let chain = parseCliArg("chain");
  let token = parseCliArg("token");

  try {
    // Interactive prompts when flags are missing and stdin is a TTY
    if (process.stdin.isTTY) {
      if (!chain) chain = await selectChain();
      if (!token) token = await selectToken(chain);
      if (!to) to = await inputAddress("Recipient address");
    }

    if (!to) {
      respondError("Missing --to", "INVALID_INPUT");
      process.exit(ExitCode.ERROR);
    }

    chain = chain || "eip155:1";
    token = token || "eth";

    const result = await drain({ account, to, chain, token });
    respond(result);
  } catch (err) {
    respondError(
      err instanceof Error ? err.message : "Drain failed",
      "DRAIN_ERROR",
    );
    process.exit(ExitCode.ERROR);
  }
}

function validateSessionOrExit(
  sessionId: string,
  operation: string,
  input: Record<string, unknown>,
): void {
  try {
    validateSession(sessionId, operation, input);
  } catch (err) {
    respondError(
      err instanceof Error ? err.message : "Session validation failed",
      "SESSION_ERROR",
    );
    process.exit(
      err instanceof SessionError
        ? ExitCode.SESSION_ERROR
        : ExitCode.ERROR,
    );
  }
}

const HANDLERS: Record<Operation, () => Promise<void>> = {
  info: handleInfo,
  generate: handleGenerate,
  accounts: handleAccounts,
  "sign-message": handleSignMessage,
  "sign-typed-data": handleSignTypedData,
  "sign-transaction": handleSignTransaction,
  "send-transaction": handleSendTransaction,
  "grant-session": handleGrantSession,
  "revoke-session": handleRevokeSession,
  "get-session": handleGetSession,
  fund: handleFund,
  drain: handleDrain,
};

async function main(): Promise<void> {
  const operation = process.argv[2] as Operation | undefined;

  if (!operation || !(operation in HANDLERS)) {
    respondError(
      `Unsupported operation: ${operation || "(none)"}`,
      "UNSUPPORTED_OPERATION",
    );
    process.exit(ExitCode.UNSUPPORTED);
  }

  try {
    await HANDLERS[operation]();
  } catch (err) {
    if (err instanceof SessionError) {
      respondError(err.message, "SESSION_ERROR");
      process.exit(ExitCode.SESSION_ERROR);
    }
    respondError(
      err instanceof Error ? err.message : "Internal error",
      "INTERNAL_ERROR",
    );
    process.exit(ExitCode.ERROR);
  }
}

main();
