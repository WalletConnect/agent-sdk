import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSession } from "./mocks/sign-client.js";

// Mock external dependencies
vi.mock("qrcode-terminal", () => ({
  generate: vi.fn(),
}));

vi.mock("open", () => ({
  default: vi.fn(async () => {}),
}));

const mockSession = createMockSession();
const mockSignClient = {
  core: {
    relayer: {
      on: vi.fn(),
      off: vi.fn(),
      transportClose: vi.fn(async () => {}),
    },
  },
  session: {
    getAll: vi.fn(() => [mockSession]),
    get: vi.fn(() => mockSession),
  },
  connect: vi.fn(async () => ({
    uri: "wc:mock@2",
    approval: vi.fn(async () => mockSession),
  })),
  request: vi.fn(async () => "0xhash"),
  disconnect: vi.fn(async () => {}),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock("@walletconnect/sign-client", () => ({
  SignClient: {
    init: vi.fn(async () => mockSignClient),
  },
}));

vi.mock("@walletconnect/keyvaluestorage", () => ({
  KeyValueStorage: vi.fn(),
}));

import { withWallet } from "../src/index.js";

const TEST_OPTIONS = {
  projectId: "test-project-id",
  metadata: {
    name: "Test App",
    description: "Test",
    url: "https://test.com",
    icons: [],
  },
};

describe("withWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("calls connect → callback → disconnect → destroy", async () => {
    const callbackSpy = vi.fn(async () => {});

    await withWallet(TEST_OPTIONS, callbackSpy);

    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(callbackSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ topic: "mock-topic-abc123" }),
    );
    expect(mockSignClient.disconnect).toHaveBeenCalled();
  });

  it("skips disconnect when disconnectAfter is false", async () => {
    const callbackSpy = vi.fn(async () => {});

    await withWallet({ ...TEST_OPTIONS, disconnectAfter: false }, callbackSpy);

    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(mockSignClient.disconnect).not.toHaveBeenCalled();
  });

  it("propagates callback errors and still calls destroy", async () => {
    const error = new Error("Callback failed");

    await expect(
      withWallet(TEST_OPTIONS, async () => {
        throw error;
      }),
    ).rejects.toThrow("Callback failed");
  });

  it("provides wallet and connect result to callback", async () => {
    let receivedAccounts: string[] = [];

    await withWallet(TEST_OPTIONS, async (wallet, result) => {
      receivedAccounts = result.accounts;
      expect(wallet.isConnected()).toBe(true);
    });

    expect(receivedAccounts).toContain("eip155:1:0xABCDEF1234567890abcdef1234567890ABCDEF12");
  });
});
