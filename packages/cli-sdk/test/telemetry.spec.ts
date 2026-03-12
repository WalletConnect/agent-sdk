import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config before importing telemetry
vi.mock("../src/config.js", () => ({
  getConfigValue: vi.fn(() => undefined),
}));

import { createTelemetry, trackCommand } from "../src/telemetry.js";
import { getConfigValue } from "../src/config.js";

const mockedGetConfigValue = vi.mocked(getConfigValue);

describe("createTelemetry", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const originalEnv = process.env.WALLETCONNECT_TELEMETRY;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedGetConfigValue.mockReturnValue(undefined);
    delete process.env.WALLETCONNECT_TELEMETRY;
    fetchSpy = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.WALLETCONNECT_TELEMETRY = originalEnv;
    } else {
      delete process.env.WALLETCONNECT_TELEMETRY;
    }
    vi.unstubAllGlobals();
  });

  it("returns no-op client when WALLETCONNECT_TELEMETRY=0", () => {
    process.env.WALLETCONNECT_TELEMETRY = "0";
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    client.track("test_event");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns no-op client when config telemetry is false", () => {
    mockedGetConfigValue.mockReturnValue("false");
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    client.track("test_event");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns no-op client when no projectId", () => {
    const client = createTelemetry({ binary: "test", version: "1.0.0" });
    client.track("test_event");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends correct payload shape", () => {
    const client = createTelemetry({ binary: "walletconnect", version: "1.2.3", projectId: "proj-123" });
    client.track("command_invoked", { command: "connect" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/^https:\/\/pulse\.walletconnect\.(com|org)\/e$/);
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-project-id"]).toBe("proj-123");
    expect(opts.headers["x-sdk-type"]).toBe("walletconnect-cli");
    expect(opts.headers["x-sdk-version"]).toBe("1.2.3");

    const body = JSON.parse(opts.body);
    expect(body.eventId).toBeDefined();
    expect(body.timestamp).toBeTypeOf("number");
    expect(body.props.event).toBe("command_invoked");
    expect(body.props.binary).toBe("walletconnect");
    expect(body.props.os).toBe(process.platform);
    expect(body.props.nodeVersion).toBe(process.version);
    expect(body.props.command).toBe("connect");
  });

  it("uses .com endpoint by default", () => {
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    client.track("test_event");

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://pulse.walletconnect.com/e");
  });

  it("flush resolves even when no events tracked", async () => {
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    await expect(client.flush()).resolves.toBeUndefined();
  });

  it("flush waits for pending events", async () => {
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    client.track("event_1");
    client.track("event_2");
    await client.flush();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("flush clears pending array", async () => {
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    client.track("event_1");
    await client.flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Second flush should be a no-op (pending was cleared)
    await client.flush();
    // fetch count should not increase
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("flush does not throw on fetch failures", async () => {
    fetchSpy.mockRejectedValue(new Error("network error"));
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    client.track("test_event");
    await expect(client.flush()).resolves.toBeUndefined();
  });

  it("track silently catches fetch errors", () => {
    fetchSpy.mockRejectedValue(new Error("network error"));
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    // Should not throw
    expect(() => client.track("test_event")).not.toThrow();
  });

  it("no-op flush resolves immediately", async () => {
    process.env.WALLETCONNECT_TELEMETRY = "0";
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    await expect(client.flush()).resolves.toBeUndefined();
  });
});

describe("trackCommand", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedGetConfigValue.mockReturnValue(undefined);
    delete process.env.WALLETCONNECT_TELEMETRY;
    fetchSpy = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tracks invoked and succeeded on success", async () => {
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    await trackCommand(client, "connect", async () => {});

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const events = fetchSpy.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as { body: string }).body).props.event);
    expect(events).toEqual(["command_invoked", "command_succeeded"]);
  });

  it("tracks invoked and failed on error, then rethrows", async () => {
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });

    await expect(
      trackCommand(client, "sign", async () => { throw new Error("boom"); }),
    ).rejects.toThrow("boom");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const calls = fetchSpy.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as { body: string }).body).props);
    expect(calls[0].event).toBe("command_invoked");
    expect(calls[1].event).toBe("command_failed");
    expect(calls[1].error).toBe("boom");
  });

  it("sanitizes wallet addresses from error messages", async () => {
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });

    await expect(
      trackCommand(client, "send", async () => {
        throw new Error("insufficient funds for 0xABCDEF1234567890abcdef1234567890ABCDEF12");
      }),
    ).rejects.toThrow();

    const calls = fetchSpy.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as { body: string }).body).props);
    expect(calls[1].error).toBe("insufficient funds for 0x***");
    expect(calls[1].error).not.toContain("ABCDEF");
  });

  it("includes command name in all events", async () => {
    const client = createTelemetry({ binary: "test", version: "1.0.0", projectId: "abc" });
    await trackCommand(client, "stake", async () => {});

    const commands = fetchSpy.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as { body: string }).body).props.command);
    expect(commands).toEqual(["stake", "stake"]);
  });
});
