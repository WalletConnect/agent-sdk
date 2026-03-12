import { randomUUID } from "node:crypto";
import { getConfigValue } from "./config.js";

export interface TelemetryOptions {
  binary: string;
  version: string;
  projectId?: string;
}

export interface TelemetryClient {
  track(event: string, props?: Record<string, unknown>): void;
  flush(): Promise<void>;
}

const NOOP_CLIENT: TelemetryClient = {
  track() {},
  async flush() {},
};

function resolveEndpoint(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Shanghai" || tz === "Asia/Hong_Kong") {
      return "https://pulse.walletconnect.org/e";
    }
  } catch {
    // default to .com
  }
  return "https://pulse.walletconnect.com/e";
}

export function createTelemetry(options: TelemetryOptions): TelemetryClient {
  if (process.env.WALLETCONNECT_TELEMETRY === "0") return NOOP_CLIENT;
  if (getConfigValue("telemetry") === "false") return NOOP_CLIENT;
  if (!options.projectId) return NOOP_CLIENT;

  const projectId = options.projectId;
  const endpoint = resolveEndpoint();
  const pending: Promise<unknown>[] = [];

  return {
    track(event: string, props?: Record<string, unknown>): void {
      const payload = {
        eventId: randomUUID(),
        timestamp: Date.now(),
        props: {
          event,
          binary: options.binary,
          os: process.platform,
          nodeVersion: process.version,
          ...props,
        },
      };

      const p = fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-project-id": projectId,
          "x-sdk-type": "walletconnect-cli",
          "x-sdk-version": options.version,
        },
        body: JSON.stringify(payload),
      }).catch(() => {});

      pending.push(p);
    },

    async flush(): Promise<void> {
      const batch = pending.splice(0);
      if (batch.length === 0) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, 2000); });
      await Promise.race([Promise.allSettled(batch), timeout]);
      if (timer) clearTimeout(timer);
    },
  };
}

/** Sanitize error message for telemetry — strip addresses, truncate length */
function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/0x[a-fA-F0-9]{40}/g, "0x***").slice(0, 256);
}

/**
 * Wraps a command execution with telemetry lifecycle tracking.
 * Tracks command_invoked before, command_succeeded/command_failed after.
 */
export async function trackCommand(
  telemetry: TelemetryClient,
  command: string,
  fn: () => Promise<void>,
): Promise<void> {
  telemetry.track("command_invoked", { command });
  try {
    await fn();
    telemetry.track("command_succeeded", { command });
  } catch (err) {
    telemetry.track("command_failed", { command, error: sanitizeError(err) });
    throw err;
  }
}
