import { describe, it, expect, vi } from "vitest";
import { createCwpSender } from "../src/wallet.js";

// Mock wallet-cli's walletExec
vi.mock("@walletconnect/cli-sdk", () => ({
  walletExec: vi.fn(),
}));

// Mock rpc.ts estimateGas
vi.mock("../src/rpc.js", () => ({
  estimateGas: vi.fn().mockResolvedValue("0x5208"),
}));

import { walletExec } from "@walletconnect/cli-sdk";
import { estimateGas } from "../src/rpc.js";

const mockedWalletExec = vi.mocked(walletExec);
const mockedEstimateGas = vi.mocked(estimateGas);

describe("createCwpSender", () => {
  const BINARY_PATH = "/usr/local/bin/wallet-companion";
  const FROM = "0x1234567890abcdef1234567890abcdef12345678";
  const TX = {
    to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    data: "0x095ea7b3",
  };

  it("returns an object with sendTransaction method", () => {
    const sender = createCwpSender(BINARY_PATH);
    expect(sender).toHaveProperty("sendTransaction");
    expect(typeof sender.sendTransaction).toBe("function");
  });

  it("sendTransaction calls estimateGas and walletExec", async () => {
    const txHash = "0xabc123";
    mockedWalletExec.mockResolvedValueOnce({ transactionHash: txHash });

    const sender = createCwpSender(BINARY_PATH);
    const result = await sender.sendTransaction(FROM, TX);

    expect(result).toBe(txHash);
    expect(mockedEstimateGas).toHaveBeenCalledWith(FROM, TX);
    expect(mockedWalletExec).toHaveBeenCalledWith(
      BINARY_PATH,
      "send-transaction",
      {
        account: FROM,
        chain: "eip155:10",
        transaction: {
          to: TX.to,
          data: TX.data,
          value: "0x0",
          gas: "0x5208",
        },
      },
      180000,
    );
  });

  it("propagates walletExec errors", async () => {
    mockedWalletExec.mockRejectedValueOnce(new Error("User rejected"));

    const sender = createCwpSender(BINARY_PATH);
    await expect(sender.sendTransaction(FROM, TX)).rejects.toThrow("User rejected");
  });

  it("propagates estimateGas errors", async () => {
    mockedEstimateGas.mockRejectedValueOnce(new Error("RPC error"));

    const sender = createCwpSender(BINARY_PATH);
    await expect(sender.sendTransaction(FROM, TX)).rejects.toThrow("RPC error");
  });
});
