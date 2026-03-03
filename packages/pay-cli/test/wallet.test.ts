import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@walletconnect/cli-sdk", () => ({
  selectProvider: vi.fn(),
  walletExec: vi.fn(),
}));

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

import { selectProvider, walletExec } from "@walletconnect/cli-sdk";
import { spawn } from "child_process";
import { selectPaymentWallet, findAccount, sendTransaction } from "../src/wallet.js";
import type { WalletProviderInfo } from "@walletconnect/cli-sdk";
import { EventEmitter } from "events";

const mockedSelectProvider = vi.mocked(selectProvider);
const mockedWalletExec = vi.mocked(walletExec);
const mockedSpawn = vi.mocked(spawn);

const MOCK_PROVIDER: WalletProviderInfo = {
  path: "/usr/local/bin/test-wallet",
  info: {
    name: "TestWallet",
    icon: "",
    rdns: "com.test.wallet",
    uuid: "test-uuid",
  },
};

/** Create a mock child process for spawn */
function createMockProc(stdout: string, exitCode: number) {
  const proc = new EventEmitter() as ReturnType<typeof spawn>;
  const stdoutEmitter = new EventEmitter();
  const stderrEmitter = new EventEmitter();
  const stdinMock = { end: vi.fn() };
  Object.assign(proc, {
    stdout: stdoutEmitter,
    stderr: stderrEmitter,
    stdin: stdinMock,
  });
  // Emit stdout data and close on next tick
  setTimeout(() => {
    stdoutEmitter.emit("data", Buffer.from(stdout));
    proc.emit("close", exitCode);
  }, 0);
  return proc;
}

beforeEach(() => {
  mockedSelectProvider.mockReset();
  mockedWalletExec.mockReset();
  mockedSpawn.mockReset();
});

describe("selectPaymentWallet", () => {
  it("returns provider when found", async () => {
    mockedSelectProvider.mockResolvedValueOnce(MOCK_PROVIDER);

    const result = await selectPaymentWallet("eip155:1");

    expect(result).toEqual(MOCK_PROVIDER);
    expect(mockedSelectProvider).toHaveBeenCalledWith({
      wallet: undefined,
      capability: "send-transaction",
      chain: "eip155:1",
    });
  });

  it("passes wallet name filter", async () => {
    mockedSelectProvider.mockResolvedValueOnce(MOCK_PROVIDER);

    await selectPaymentWallet("eip155:1", "TestWallet");

    expect(mockedSelectProvider).toHaveBeenCalledWith({
      wallet: "TestWallet",
      capability: "send-transaction",
      chain: "eip155:1",
    });
  });

  it("throws when no provider found", async () => {
    mockedSelectProvider.mockResolvedValueOnce(null as unknown as WalletProviderInfo);

    await expect(selectPaymentWallet("eip155:1")).rejects.toThrow(
      "No compatible wallet provider found",
    );
  });
});

describe("findAccount", () => {
  it("returns matching account address", async () => {
    mockedWalletExec.mockResolvedValueOnce({
      accounts: [
        { address: "0xabc", chain: "eip155:1" },
        { address: "0xdef", chain: "eip155:10" },
      ],
    });

    const address = await findAccount(MOCK_PROVIDER, "eip155:1");

    expect(address).toBe("0xabc");
  });

  it("throws when no matching chain account", async () => {
    mockedWalletExec.mockResolvedValueOnce({
      accounts: [{ address: "0xdef", chain: "eip155:10" }],
    });

    await expect(findAccount(MOCK_PROVIDER, "eip155:1")).rejects.toThrow(
      'Wallet "TestWallet" has no account for chain eip155:1',
    );
  });
});

describe("sendTransaction", () => {
  it("uses walletconnect CLI directly for eth_signTypedData_v4", async () => {
    const proc = createMockProc('{"address":"0xabc","signature":"0xsig123"}', 0);
    mockedSpawn.mockReturnValueOnce(proc);

    const typedData = { types: {}, primaryType: "Test", domain: {}, message: {} };
    const result = await sendTransaction(
      "/usr/local/bin/test-wallet",
      "0xabc",
      "eip155:8453",
      { chain_id: "eip155:8453", method: "eth_signTypedData_v4", params: ["0xabc", typedData] },
    );

    expect(result).toBe("0xsig123");
    expect(mockedSpawn).toHaveBeenCalledWith(
      "walletconnect",
      ["sign-typed-data", JSON.stringify(typedData)],
      expect.objectContaining({ timeout: 180000 }),
    );
  });

  it("handles JSON string typed data params", async () => {
    const proc = createMockProc('{"signature":"0xsig789"}', 0);
    mockedSpawn.mockReturnValueOnce(proc);

    const typedData = { types: {}, primaryType: "Test", domain: {}, message: {} };
    const result = await sendTransaction(
      "/usr/local/bin/test-wallet",
      "0xabc",
      "eip155:8453",
      { chain_id: "eip155:8453", method: "eth_signTypedData_v4", params: ["0xabc", JSON.stringify(typedData)] },
    );

    expect(result).toBe("0xsig789");
    // When params[1] is already a string, pass it directly
    expect(mockedSpawn).toHaveBeenCalledWith(
      "walletconnect",
      ["sign-typed-data", JSON.stringify(typedData)],
      expect.objectContaining({ timeout: 180000 }),
    );
  });

  it("uses walletconnect CLI for eth_sendTransaction", async () => {
    const proc = createMockProc('{"transactionHash":"0xtx123"}', 0);
    mockedSpawn.mockReturnValueOnce(proc);

    const tx = { to: "0xrecipient", data: "0x", value: "0x0" };
    const result = await sendTransaction(
      "/usr/local/bin/test-wallet",
      "0xabc",
      "eip155:1",
      { chain_id: "eip155:1", method: "eth_sendTransaction", params: [tx] },
    );

    expect(result).toBe("0xtx123");
    expect(mockedSpawn).toHaveBeenCalledWith(
      "walletconnect",
      ["send-transaction", expect.stringContaining('"chainId":"eip155:1"')],
      expect.objectContaining({ timeout: 180000 }),
    );
  });

  it("falls back to CWP for unknown methods", async () => {
    mockedWalletExec.mockResolvedValueOnce({ result: "0xresult" });

    const result = await sendTransaction(
      "/usr/local/bin/test-wallet",
      "0xabc",
      "eip155:1",
      { chain_id: "eip155:1", method: "custom_method", params: ["arg1"] },
    );

    expect(result).toBe("0xresult");
    expect(mockedWalletExec).toHaveBeenCalled();
  });

  it("propagates wallet errors", async () => {
    const proc = createMockProc("Signing failed", 1);
    mockedSpawn.mockReturnValueOnce(proc);

    await expect(
      sendTransaction("/usr/local/bin/test-wallet", "0xabc", "eip155:1", {
        chain_id: "eip155:1",
        method: "eth_signTypedData_v4",
        params: ["0xabc", "{}"],
      }),
    ).rejects.toThrow("Wallet operation failed");
  });
});
