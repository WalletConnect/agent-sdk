import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSession, createMockSignClient } from "./mocks/sign-client.js";

// Mock external dependencies
vi.mock("qrcode-terminal", () => ({
  default: { generate: vi.fn() },
}));

vi.mock("open", () => ({
  default: vi.fn(async () => {}),
}));

// Hoist the mock client so we can control it from tests
const mockSignClient = createMockSignClient();
vi.mock("@walletconnect/sign-client", () => ({
  SignClient: {
    init: vi.fn(async () => mockSignClient),
  },
}));

vi.mock("@walletconnect/keyvaluestorage", () => ({
  KeyValueStorage: vi.fn(),
}));

import { WalletConnectCLI } from "../src/client.js";

const TEST_OPTIONS = {
  projectId: "test-project-id",
  metadata: {
    name: "Test App",
    description: "A test application",
    url: "https://test.com",
    icons: [],
  },
};

describe("WalletConnectCLI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Reset session store
    mockSignClient.session.getAll.mockReturnValue([]);
  });

  describe("connect()", () => {
    it("returns existing session without showing QR", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      const result = await wc.connect();

      expect(result.topic).toBe("mock-topic-abc123");
      expect(result.accounts).toContain("eip155:1:0xABCDEF1234567890abcdef1234567890ABCDEF12");
      expect(mockSignClient.connect).not.toHaveBeenCalled();

      await wc.destroy();
    });

    it("generates URI and shows QR when no session exists", async () => {
      const newSession = createMockSession({ topic: "new-topic" });
      mockSignClient.connect.mockResolvedValue({
        uri: "wc:new-uri@2?relay-protocol=irn",
        approval: vi.fn(async () => newSession),
      });

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      const result = await wc.connect();

      expect(mockSignClient.connect).toHaveBeenCalled();
      expect(result.topic).toBe("new-topic");

      await wc.destroy();
    });

    it("skips session restoration when autoConnect is false", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);

      const newSession = createMockSession({ topic: "fresh-topic" });
      mockSignClient.connect.mockResolvedValue({
        uri: "wc:fresh@2",
        approval: vi.fn(async () => newSession),
      });

      const wc = new WalletConnectCLI({ ...TEST_OPTIONS, autoConnect: false });
      const result = await wc.connect();

      expect(mockSignClient.connect).toHaveBeenCalled();
      expect(result.topic).toBe("fresh-topic");

      await wc.destroy();
    });

    it("throws when URI generation fails", async () => {
      mockSignClient.connect.mockResolvedValue({
        uri: undefined,
        approval: vi.fn(),
      });

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await expect(wc.connect()).rejects.toThrow("Failed to generate WalletConnect URI");

      await wc.destroy();
    });

    it("emits connect event", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      const connectSpy = vi.fn();
      wc.on("connect", connectSpy);

      await wc.connect();

      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(connectSpy).toHaveBeenCalledWith(expect.objectContaining({ topic: "mock-topic-abc123" }));

      await wc.destroy();
    });
  });

  describe("request()", () => {
    it("delegates to signClient.request()", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);
      mockSignClient.request.mockResolvedValue("0xresulthash");

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await wc.connect();

      const result = await wc.request({
        chainId: "eip155:1",
        request: { method: "eth_sendTransaction", params: [{ from: "0x1", to: "0x2", value: "0x0" }] },
      });

      expect(result).toBe("0xresulthash");
      expect(mockSignClient.request).toHaveBeenCalledWith({
        topic: "mock-topic-abc123",
        chainId: "eip155:1",
        request: { method: "eth_sendTransaction", params: [{ from: "0x1", to: "0x2", value: "0x0" }] },
      });

      await wc.destroy();
    });

    it("throws when no session is active", async () => {
      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await expect(
        wc.request({
          chainId: "eip155:1",
          request: { method: "personal_sign", params: [] },
        }),
      ).rejects.toThrow("No active session");

      await wc.destroy();
    });

    it("wraps rejection errors", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);
      mockSignClient.request.mockRejectedValue(new Error("User rejected the request"));

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await wc.connect();

      await expect(
        wc.request({
          chainId: "eip155:1",
          request: { method: "personal_sign", params: [] },
        }),
      ).rejects.toThrow("Request rejected by user");

      await wc.destroy();
    });
  });

  describe("disconnect()", () => {
    it("calls signClient.disconnect()", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await wc.connect();
      await wc.disconnect();

      expect(mockSignClient.disconnect).toHaveBeenCalledWith({
        topic: "mock-topic-abc123",
        reason: { code: 6000, message: "User disconnected" },
      });
    });

    it("emits disconnect event", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await wc.connect();

      const disconnectSpy = vi.fn();
      wc.on("disconnect", disconnectSpy);
      await wc.disconnect();

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      await wc.destroy();
    });

    it("silently succeeds when no session is active", async () => {
      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await expect(wc.disconnect()).resolves.toBeUndefined();
      await wc.destroy();
    });

    it("ignores errors from signClient.disconnect()", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);
      mockSignClient.disconnect.mockRejectedValue(new Error("Session already expired"));

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await wc.connect();
      await expect(wc.disconnect()).resolves.toBeUndefined();
      await wc.destroy();
    });
  });

  describe("isConnected()", () => {
    it("returns false when no session", () => {
      const wc = new WalletConnectCLI(TEST_OPTIONS);
      expect(wc.isConnected()).toBe(false);
    });

    it("returns true when session is valid", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await wc.connect();
      expect(wc.isConnected()).toBe(true);
      await wc.destroy();
    });
  });

  describe("getAccounts()", () => {
    it("returns empty array when no session", () => {
      const wc = new WalletConnectCLI(TEST_OPTIONS);
      expect(wc.getAccounts()).toEqual([]);
    });

    it("returns CAIP-10 accounts from session", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await wc.connect();
      const accounts = wc.getAccounts();
      expect(accounts).toContain("eip155:1:0xABCDEF1234567890abcdef1234567890ABCDEF12");
      await wc.destroy();
    });
  });

  describe("getSession()", () => {
    it("returns null when no session", () => {
      const wc = new WalletConnectCLI(TEST_OPTIONS);
      expect(wc.getSession()).toBeNull();
    });

    it("returns current session", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await wc.connect();
      expect(wc.getSession()!.topic).toBe("mock-topic-abc123");
      await wc.destroy();
    });
  });

  describe("event forwarding", () => {
    it("forwards session_delete as disconnect", async () => {
      const session = createMockSession();
      mockSignClient.session.getAll.mockReturnValue([session]);

      const wc = new WalletConnectCLI(TEST_OPTIONS);
      await wc.connect();

      const disconnectSpy = vi.fn();
      wc.on("disconnect", disconnectSpy);

      // Simulate session_delete from sign-client
      mockSignClient._emit("session_delete", { topic: "mock-topic-abc123" });

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      expect(wc.getSession()).toBeNull();
      await wc.destroy();
    });
  });
});
