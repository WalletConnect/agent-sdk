import { walletExec } from "@walletconnect/cli-sdk";
import type { TxData } from "./contracts.js";
import { CAIP2_CHAIN_ID } from "./constants.js";
import { estimateGas } from "./rpc.js";

export interface WalletSender {
  sendTransaction(from: string, tx: TxData): Promise<string>;
}

/**
 * Create a WalletSender that delegates to a CWP provider binary.
 *
 * Handles gas estimation (with 20% buffer) and formats the
 * send-transaction call per the CWP protocol.
 */
export function createCwpSender(binaryPath: string): WalletSender {
  return {
    async sendTransaction(from: string, tx: TxData): Promise<string> {
      const gas = await estimateGas(from, tx);
      const result = (await walletExec(
        binaryPath,
        "send-transaction",
        {
          account: from,
          chain: CAIP2_CHAIN_ID,
          transaction: {
            to: tx.to,
            data: tx.data,
            value: "0x0",
            gas,
          },
        },
        180000, // 3 minute timeout for send-transaction
      )) as { transactionHash: string };
      return result.transactionHash;
    },
  };
}
