import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  renameSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type {
  SessionState,
  SessionPolicy,
  GrantSessionInput,
  SendTransactionInput,
} from "./types.js";

const SESSIONS_DIR = join(homedir(), ".config", "wallet", "sessions");

function sessionFilePath(sessionId: string): string {
  return join(SESSIONS_DIR, `${sessionId}.json`);
}

function atomicWrite(filePath: string, content: string): void {
  const tmpPath = filePath + ".tmp";
  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  writeFileSync(tmpPath, content, { mode: 0o600 });
  renameSync(tmpPath, filePath);
}

/**
 * Create a new session.
 */
export function grantSession(input: GrantSessionInput): SessionState {
  const sessionId = randomBytes(16).toString("hex");

  const session: SessionState = {
    sessionId,
    account: input.account,
    chain: input.chain,
    permissions: input.permissions,
    expiry: input.expiry,
    revoked: false,
    callCounts: {},
    totalValue: {},
  };

  atomicWrite(sessionFilePath(sessionId), JSON.stringify(session, null, 2));
  return session;
}

/**
 * Revoke a session by ID.
 */
export function revokeSession(sessionId: string): void {
  const session = loadSession(sessionId);
  session.revoked = true;
  atomicWrite(
    sessionFilePath(sessionId),
    JSON.stringify(session, null, 2),
  );
}

/**
 * Load a session from disk.
 */
export function loadSession(sessionId: string): SessionState {
  const filePath = sessionFilePath(sessionId);
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SessionState;
  } catch {
    throw new Error(`Session not found: ${sessionId}`);
  }
}

/**
 * Validate a session for a given operation.
 * Throws on any validation failure.
 */
export function validateSession(
  sessionId: string,
  operation: string,
  input?: Record<string, unknown>,
): SessionState {
  const session = loadSession(sessionId);

  if (session.revoked) {
    throw new SessionError("Session has been revoked");
  }

  if (Date.now() > session.expiry) {
    throw new SessionError("Session has expired");
  }

  // Find permission for this operation
  const permission = session.permissions.find(
    (p) => p.operation === operation,
  );
  if (!permission) {
    throw new SessionError(
      `Session does not permit operation: ${operation}`,
    );
  }

  // Validate policies
  if (permission.policies) {
    for (const policy of permission.policies) {
      validatePolicy(policy, session, input);
    }
  }

  return session;
}

/**
 * Record a session operation (update call counts and value totals).
 */
export function recordSessionUsage(
  sessionId: string,
  operation: string,
  input?: SendTransactionInput,
): void {
  const session = loadSession(sessionId);

  // Increment call count
  const key = operation;
  session.callCounts[key] = (session.callCounts[key] || 0) + 1;

  // Track value for send-transaction
  if (input?.transaction?.value) {
    const chain = input.chain || "unknown";
    const currentTotal = BigInt(session.totalValue[chain] || "0");
    const txValue = BigInt(input.transaction.value as string | number);
    session.totalValue[chain] = (currentTotal + txValue).toString();
  }

  atomicWrite(
    sessionFilePath(sessionId),
    JSON.stringify(session, null, 2),
  );
}

function validatePolicy(
  policy: SessionPolicy,
  session: SessionState,
  input?: Record<string, unknown>,
): void {
  switch (policy.type) {
    case "value-limit": {
      if (!input) break;
      const tx = input.transaction as Record<string, unknown> | undefined;
      if (!tx?.value) break;

      const chain = (input.chain as string) || "unknown";
      const maxValue = BigInt(policy.params.maxValue as string);
      const currentTotal = BigInt(session.totalValue[chain] || "0");
      const txValue = BigInt(tx.value as string | number);

      if (currentTotal + txValue > maxValue) {
        throw new SessionError(
          `Value limit exceeded: ${(currentTotal + txValue).toString()} > ${maxValue.toString()}`,
        );
      }
      break;
    }

    case "recipient-allowlist": {
      if (!input) break;
      const tx = input.transaction as Record<string, unknown> | undefined;
      if (!tx?.to) break;

      const allowlist = (policy.params.addresses as string[]).map((a) =>
        a.toLowerCase(),
      );
      const to = (tx.to as string).toLowerCase();

      if (!allowlist.includes(to)) {
        throw new SessionError(
          `Recipient ${tx.to} not in allowlist`,
        );
      }
      break;
    }

    case "call-limit": {
      const maxCalls = policy.params.maxCalls as number;
      const operation = policy.params.operation as string;
      const currentCalls = session.callCounts[operation] || 0;

      if (currentCalls >= maxCalls) {
        throw new SessionError(
          `Call limit reached for ${operation}: ${currentCalls} >= ${maxCalls}`,
        );
      }
      break;
    }
  }
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}
