import { spawn } from "child_process";

/** Standard CWP exit codes */
export const ExitCode = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  UNSUPPORTED: 2,
  REJECTED: 3,
  TIMEOUT: 4,
  NOT_CONNECTED: 5,
} as const;

/** Standard CWP error codes */
export type WalletErrorCode =
  | "UNSUPPORTED_OPERATION"
  | "USER_REJECTED"
  | "TIMEOUT"
  | "NOT_CONNECTED"
  | "ACCOUNT_NOT_FOUND"
  | "INVALID_INPUT"
  | "INTERNAL_ERROR";

export class WalletExecError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly errorCode?: WalletErrorCode,
  ) {
    super(message);
    this.name = "WalletExecError";
  }
}

const EXIT_CODE_MESSAGES: Record<number, string> = {
  [ExitCode.UNSUPPORTED]: "Operation not supported",
  [ExitCode.REJECTED]: "User rejected the request",
  [ExitCode.TIMEOUT]: "Operation timed out",
  [ExitCode.NOT_CONNECTED]: "No wallet connection active",
};

/**
 * Execute a wallet-<name> operation.
 *
 * Spawns the binary, writes JSON to stdin, reads JSON from stdout.
 * Maps exit codes to WalletExecError.
 */
export async function walletExec(
  binary: string,
  operation: string,
  input?: object,
  timeoutMs = 10000,
): Promise<object> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, [operation], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs,
    });

    let stdout = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", () => {
      // drain stderr to prevent blocking
    });

    proc.on("error", (err: Error & { code?: string }) => {
      const message = err.code === "ENOENT"
        ? `Wallet provider not found: ${binary}`
        : err.message;
      reject(new WalletExecError(message, ExitCode.GENERAL_ERROR, "INTERNAL_ERROR"));
    });

    proc.on("close", (code) => {
      const exitCode = code ?? ExitCode.GENERAL_ERROR;

      if (exitCode === ExitCode.SUCCESS) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(
            new WalletExecError(
              `Invalid JSON from ${binary}: ${stdout.slice(0, 200)}`,
              ExitCode.GENERAL_ERROR,
              "INTERNAL_ERROR",
            ),
          );
        }
        return;
      }

      // Non-zero exit — try to parse error JSON from stdout
      let errorCode: WalletErrorCode = "INTERNAL_ERROR";
      let errorMessage =
        EXIT_CODE_MESSAGES[exitCode] || `${binary} exited with code ${exitCode}`;

      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) errorMessage = parsed.error;
        if (parsed.code) errorCode = parsed.code as WalletErrorCode;
      } catch {
        // No valid error JSON — use default message
      }

      reject(new WalletExecError(errorMessage, exitCode, errorCode));
    });

    // Write input to stdin
    if (input !== undefined) {
      proc.stdin.write(JSON.stringify(input));
    }
    proc.stdin.end();
  });
}
