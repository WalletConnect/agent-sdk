import { vi } from "vitest";
import type { SessionTypes } from "@walletconnect/types";

export function createMockSession(overrides: Partial<SessionTypes.Struct> = {}): SessionTypes.Struct {
  return {
    topic: "mock-topic-abc123",
    pairingTopic: "mock-pairing-xyz",
    relay: { protocol: "irn" },
    expiry: Math.floor(Date.now() / 1000) + 86400, // 24h from now
    acknowledged: true,
    controller: "did:key:mock",
    namespaces: {
      eip155: {
        chains: ["eip155:1"],
        accounts: ["eip155:1:0xABCDEF1234567890abcdef1234567890ABCDEF12"],
        methods: [
          "eth_sendTransaction",
          "eth_signTransaction",
          "personal_sign",
          "eth_sign",
          "eth_signTypedData",
          "eth_signTypedData_v4",
        ],
        events: ["chainChanged", "accountsChanged"],
      },
    },
    requiredNamespaces: {},
    optionalNamespaces: {},
    self: {
      publicKey: "mock-self-key",
      metadata: {
        name: "Test CLI",
        description: "Test",
        url: "https://test.com",
        icons: [],
      },
    },
    peer: {
      publicKey: "mock-peer-key",
      metadata: {
        name: "Mock Wallet",
        description: "A mock wallet for testing",
        url: "https://mockwallet.com",
        icons: [],
      },
    },
    ...overrides,
  } as SessionTypes.Struct;
}

export function createMockSignClient(sessions: SessionTypes.Struct[] = []) {
  const eventListeners = new Map<string, Function[]>();

  const mockClient = {
    core: {
      relayer: {
        on: vi.fn(),
        off: vi.fn(),
        transportClose: vi.fn(async () => {}),
      },
    },
    session: {
      getAll: vi.fn(() => sessions),
      get: vi.fn((topic: string) => sessions.find((s) => s.topic === topic) || null),
    },
    connect: vi.fn(async () => ({
      uri: "wc:mock-uri@2?relay-protocol=irn&symKey=mockkey",
      approval: vi.fn(async () => sessions[0] || createMockSession()),
    })),
    request: vi.fn(async () => "0xmocktxhash"),
    disconnect: vi.fn(async () => {}),
    on: vi.fn((event: string, listener: Function) => {
      const listeners = eventListeners.get(event) || [];
      listeners.push(listener);
      eventListeners.set(event, listeners);
    }),
    off: vi.fn(),
    _emit(event: string, data: unknown) {
      const listeners = eventListeners.get(event) || [];
      for (const listener of listeners) {
        listener(data);
      }
    },
  };

  return mockClient;
}
