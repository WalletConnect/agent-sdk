import { EventEmitter } from "events";
import { homedir } from "os";
import { join } from "path";
import { KeyValueStorage } from "@walletconnect/keyvaluestorage";
import { SignClient } from "@walletconnect/sign-client";
import type { SessionTypes } from "@walletconnect/types";
import { createBrowserUI } from "./browser-ui/server.js";
import { createSessionManager } from "./session.js";
import { createTerminalUI } from "./terminal-ui.js";
import type {
  BrowserUI,
  ConnectOptions,
  ConnectResult,
  RequestOptions,
  WalletConnectCLIEvents,
  WalletConnectCLIOptions,
} from "./types.js";

const DEFAULT_METHODS = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v4",
];

const DEFAULT_EVENTS = ["chainChanged", "accountsChanged"];
const DEFAULT_CHAINS = ["eip155:1"];
const DEFAULT_STORAGE_PATH = join(homedir(), ".walletconnect-cli");

export class WalletConnectCLI extends EventEmitter {
  private readonly options: WalletConnectCLIOptions;
  private signClient: InstanceType<typeof SignClient> | null = null;
  private currentSession: SessionTypes.Struct | null = null;
  private browserUI: BrowserUI | null = null;
  private readonly sessionManager = createSessionManager();

  constructor(options: WalletConnectCLIOptions) {
    super();
    this.options = options;
  }

  // ---------- Public API ----------------------------------------------- //

  async tryRestore(): Promise<ConnectResult | null> {
    const client = await this.ensureClient();
    const existing = this.sessionManager.getExistingSession(client);
    if (!existing) return null;
    this.currentSession = existing;
    return this.buildConnectResult(existing);
  }

  async connect(connectOptions?: ConnectOptions): Promise<ConnectResult> {
    const client = await this.ensureClient();

    // Check for existing valid session
    if (this.options.autoConnect !== false) {
      const existing = this.sessionManager.getExistingSession(client);
      if (existing) {
        this.currentSession = existing;
        const result = this.buildConnectResult(existing);
        this.emit("connect", result);
        return result;
      }
    }

    // Build namespaces
    const chains = this.options.chains || DEFAULT_CHAINS;
    const methods = this.options.methods || DEFAULT_METHODS;
    const events = this.options.events || DEFAULT_EVENTS;

    const optionalNamespaces = connectOptions?.optionalNamespaces || {
      eip155: { chains, methods, events },
    };

    // Initiate connection
    const { uri, approval } = await client.connect({ optionalNamespaces });

    if (!uri) {
      throw new Error("Failed to generate WalletConnect URI");
    }

    // Display connection UI
    if (this.options.ui === "browser") {
      await this.showBrowserUI(uri);
    } else {
      const terminalUI = createTerminalUI();
      terminalUI.displayQR(uri);
    }

    // Wait for wallet approval
    const session = await approval();
    this.currentSession = session;

    // Update browser UI if active
    if (this.browserUI) {
      this.browserUI.updateStatus("connected", `Connected to ${session.peer.metadata.name}`);
      // Give browser time to show success, then shut down
      setTimeout(() => this.browserUI?.stop(), 3000);
    }

    const result = this.buildConnectResult(session);
    this.emit("connect", result);
    return result;
  }

  async request<T = unknown>(options: RequestOptions): Promise<T> {
    const client = await this.ensureClient();
    const topic = options.topic || this.currentSession?.topic;

    if (!topic) {
      throw new Error("No active session. Call connect() first.");
    }

    try {
      return await client.request<T>({
        topic,
        chainId: options.chainId,
        request: options.request,
      });
    } catch (error: unknown) {
      const message = this.extractErrorMessage(error);

      if (message.includes("rejected") || message.includes("denied") || message.includes("cancelled")) {
        throw new Error("Request rejected by user");
      }

      if (typeof error === "object" && error !== null) {
        const errObj = error as { code?: number; message?: string };
        if (errObj.code === 0 && !errObj.message) {
          throw new Error("Request rejected or timed out in wallet");
        }
      }

      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const client = await this.ensureClient();
      await client.disconnect({
        topic: this.currentSession.topic,
        reason: { code: 6000, message: "User disconnected" },
      });
    } catch {
      // Ignore disconnect errors — session may have already expired
    }

    this.currentSession = null;
    this.emit("disconnect");
  }

  isConnected(): boolean {
    if (!this.currentSession) return false;
    return this.sessionManager.isSessionValid(this.currentSession);
  }

  getAccounts(): string[] {
    if (!this.currentSession) return [];
    return Object.values(this.currentSession.namespaces)
      .flatMap((ns) => ns.accounts || []);
  }

  getSession(): SessionTypes.Struct | null {
    return this.currentSession;
  }

  async destroy(): Promise<void> {
    if (this.browserUI) {
      await this.browserUI.stop();
      this.browserUI = null;
    }
    this.removeAllListeners();
    this.signClient = null;
    this.currentSession = null;
  }

  // Type-safe event emitter overrides
  override on<K extends keyof WalletConnectCLIEvents>(event: K, listener: WalletConnectCLIEvents[K]): this {
    return super.on(event, listener);
  }

  override once<K extends keyof WalletConnectCLIEvents>(event: K, listener: WalletConnectCLIEvents[K]): this {
    return super.once(event, listener);
  }

  override off<K extends keyof WalletConnectCLIEvents>(event: K, listener: WalletConnectCLIEvents[K]): this {
    return super.off(event, listener);
  }

  override emit<K extends keyof WalletConnectCLIEvents>(
    event: K,
    ...args: Parameters<WalletConnectCLIEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  // ---------- Private -------------------------------------------------- //

  private async ensureClient(): Promise<InstanceType<typeof SignClient>> {
    if (this.signClient) return this.signClient;

    const storagePath = this.options.storagePath || DEFAULT_STORAGE_PATH;
    const storage = new KeyValueStorage({ database: storagePath });

    this.signClient = await SignClient.init({
      projectId: this.options.projectId,
      metadata: this.options.metadata,
      storage,
      logger: this.options.logger || "silent",
    });

    // Forward sign-client events
    this.signClient.on("session_update", ({ topic }) => {
      const session = this.signClient?.session.get(topic);
      if (session) {
        this.currentSession = session;
        this.emit("session_update", session);
      }
    });

    this.signClient.on("session_delete", ({ topic }) => {
      if (this.currentSession?.topic === topic) {
        this.currentSession = null;
      }
      this.emit("session_delete", { topic });
      this.emit("disconnect");
    });

    return this.signClient;
  }

  private async showBrowserUI(uri: string): Promise<void> {
    this.browserUI = createBrowserUI(this.options.port);
    try {
      const { url } = await this.browserUI.start(uri);
      console.log(`\nConnect your wallet at: ${url}\n`);
    } catch {
      // Fall back to terminal QR if browser fails
      console.log("Could not open browser, falling back to terminal QR code.");
      const terminalUI = createTerminalUI();
      terminalUI.displayQR(uri);
      this.browserUI = null;
    }
  }

  private buildConnectResult(session: SessionTypes.Struct): ConnectResult {
    const accounts = Object.values(session.namespaces)
      .flatMap((ns) => ns.accounts || []);
    return {
      session,
      accounts,
      topic: session.topic,
    };
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null) {
      const errObj = error as { message?: string };
      if (errObj.message) return errObj.message;
      return JSON.stringify(error);
    }
    return String(error);
  }
}
