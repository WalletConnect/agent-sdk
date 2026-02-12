import { WalletConnectCLI } from "./client.js";
import type { WithWalletOptions, ConnectResult } from "./types.js";

export { WalletConnectCLI } from "./client.js";
export { createSessionManager } from "./session.js";
export { createTerminalUI } from "./terminal-ui.js";
export { createBrowserUI } from "./browser-ui/server.js";

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
