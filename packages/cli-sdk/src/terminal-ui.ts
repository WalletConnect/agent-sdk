import qrcodeModule from "qrcode-terminal";
import type { TerminalUI } from "./types.js";

export function createTerminalUI(): TerminalUI {
  return {
    displayQR(uri: string) {
      console.log("\nScan this QR code with your wallet app:\n");
      qrcodeModule.generate(uri, { small: true });
      console.log("\nOr copy this URI:", uri);
      console.log("\nWaiting for wallet connection...\n");
    },

    showStatus(message: string) {
      console.log(`[WalletConnect] ${message}`);
    },

    showError(message: string) {
      console.error(`[WalletConnect] Error: ${message}`);
    },

    showSuccess(message: string) {
      console.log(`[WalletConnect] ${message}`);
    },
  };
}
