import { WalletConnectCLI } from "./client.js";
import type { WithWalletOptions, ConnectResult } from "./types.js";

export { WalletConnectCLI } from "./client.js";
export { createSessionManager } from "./session.js";
export { createTerminalUI } from "./terminal-ui.js";
export { createBrowserUI } from "./browser-ui/server.js";
export { getConfigValue, setConfigValue, resolveProjectId } from "./config.js";

// CWP (CLI Wallet Protocol) — provider discovery, execution, and selection
export {
  walletExec,
  WalletExecError,
  ExitCode,
  discoverProviders,
  getDefaultProvider,
  getProvider,
  selectProvider,
} from "./cwp/index.js";
export type {
  WalletErrorCode,
  WalletProviderInfo,
  WalletConfig,
  SelectProviderOptions,
} from "./cwp/index.js";

export type {
  WalletConnectCLIOptions,
  ConnectOptions,
  ConnectResult,
  RequestOptions,
  WalletConnectCLIEvents,
  WithWalletOptions,
  TerminalUI,
  BrowserUI,
} from "./types.js";

/**
 * Higher-level helper that wraps the connect → callback → cleanup pattern.
 *
 * @example
 * ```ts
 * await withWallet({ projectId, metadata }, async (wallet, { accounts }) => {
 *   const txHash = await wallet.request({
 *     chainId: 'eip155:1',
 *     request: { method: 'eth_sendTransaction', params: [tx] }
 *   });
 * });
 * ```
 */
export async function withWallet(
  options: WithWalletOptions,
  callback: (wallet: WalletConnectCLI, result: ConnectResult) => Promise<void>,
): Promise<void> {
  const wallet = new WalletConnectCLI(options);
  try {
    const result = await wallet.connect(options.connectOptions);
    await callback(wallet, result);
    if (options.disconnectAfter !== false) {
      await wallet.disconnect();
    }
  } finally {
    await wallet.destroy();
  }
}
