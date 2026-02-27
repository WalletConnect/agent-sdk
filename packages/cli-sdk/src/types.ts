import type { SessionTypes, SignClientTypes } from "@walletconnect/types";

export interface WalletConnectCLIOptions {
  /** WalletConnect Cloud project ID (required) */
  projectId: string;
  /** App metadata shown to wallet during pairing */
  metadata: SignClientTypes.Metadata;
  /** Directory path for persistent session storage. Default: ~/.walletconnect-cli/ */
  storagePath?: string;
  /** Connection UI mode. Default: 'terminal' */
  ui?: "terminal" | "browser";
  /** CAIP-2 chain IDs to request. Default: ['eip155:1'] */
  chains?: string[];
  /** JSON-RPC methods to request. Default: common EVM signing methods */
  methods?: string[];
  /** Events to subscribe to. Default: ['chainChanged', 'accountsChanged'] */
  events?: string[];
  /** Port for browser UI server. Default: auto-assigned */
  port?: number;
  /** Auto-restore previous session on connect(). Default: true */
  autoConnect?: boolean;
  /** Log verbosity level. Default: 'silent' */
  logger?: "info" | "debug" | "silent";
}

export interface ConnectOptions {
  /** Override the namespaces for this connection attempt */
  optionalNamespaces?: Record<string, {
    chains: string[];
    methods: string[];
    events: string[];
  }>;
}

export interface ConnectResult {
  /** The approved session */
  session: SessionTypes.Struct;
  /** CAIP-10 account IDs (e.g. 'eip155:1:0xABC...') */
  accounts: string[];
  /** Session topic for subsequent requests */
  topic: string;
}

export interface RequestOptions {
  /** Session topic. If omitted, uses the current active session topic */
  topic?: string;
  /** CAIP-2 chain ID (e.g. 'eip155:1') */
  chainId: string;
  /** JSON-RPC request */
  request: {
    method: string;
    params: unknown[] | Record<string, unknown>;
  };
}

export interface WalletConnectCLIEvents {
  connect: (result: ConnectResult) => void;
  disconnect: () => void;
  session_update: (session: SessionTypes.Struct) => void;
  session_delete: (event: { topic: string }) => void;
}

export interface WithWalletOptions extends WalletConnectCLIOptions {
  /** Options to pass to connect() */
  connectOptions?: ConnectOptions;
  /** If false, skip disconnect after callback completes. Default: true */
  disconnectAfter?: boolean;
}

export interface TerminalUI {
  displayQR(uri: string): void;
  showStatus(message: string): void;
  showError(message: string): void;
  showSuccess(message: string): void;
}

export interface BrowserUI {
  start(uri: string): Promise<{ port: number; url: string }>;
  updateStatus(status: "waiting" | "connected" | "error", message?: string): void;
  stop(): Promise<void>;
}
