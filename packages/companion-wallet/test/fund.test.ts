import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseEther } from "viem";

// Mock cli-sdk before importing fund
const mockRequest = vi.fn();
const mockWithWallet = vi.fn();

vi.mock("@walletconnect/cli-sdk", () => ({
  withWallet: (...args: unknown[]) => mockWithWallet(...args),
  resolveProjectId: vi.fn().mockReturnValue("test-project-id"),
}));

vi.mock("../src/keystore.js", () => ({
  listAddresses: vi.fn().mockReturnValue(["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]),
}));

import { fund } from "../src/fund.js";
import { resolveProjectId } from "@walletconnect/cli-sdk";
import { listAddresses } from "../src/keystore.js";

describe("fund", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: withWallet calls callback with mock wallet and accounts
    mockWithWallet.mockImplementation(
      async (
        _options: unknown,
        callback: (
          wallet: { request: typeof mockRequest },
          result: { accounts: string[] },
        ) => Promise<void>,
      ) => {
        mockRequest.mockResolvedValue("0xtxhash123");
        await callback(
          { request: mockRequest },
          { accounts: ["eip155:1:0x70997970C51812dc3A010C7d01b50e0d17dc79C8"] },
        );
      },
    );
  });

  it("sends ETH from external wallet to embedded address", async () => {
    const result = await fund({
      account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: "0.1",
      chain: "eip155:1",
    });

    expect(result.transactionHash).toBe("0xtxhash123");
    expect(result.from).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    expect(result.to).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    expect(result.amount).toBe("0.1");
    expect(result.token).toBe("ETH");

    // Verify withWallet was called with correct options
    expect(mockWithWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "test-project-id",
        chains: ["eip155:1"],
        methods: ["eth_sendTransaction"],
      }),
      expect.any(Function),
    );

    // Verify the request sent to the wallet
    expect(mockRequest).toHaveBeenCalledWith({
      chainId: "eip155:1",
      request: {
        method: "eth_sendTransaction",
        params: [
          expect.objectContaining({
            from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          }),
        ],
      },
    });
  });

  it("sends USDC via ERC-20 transfer", async () => {
    const result = await fund({
      account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: "10",
      chain: "eip155:1",
      token: "usdc",
    });

    expect(result.transactionHash).toBe("0xtxhash123");
    expect(result.token).toBe("USDC");
    expect(result.amount).toBe("10");

    // Verify the tx was sent to the USDC contract, not the embedded address
    expect(mockRequest).toHaveBeenCalledWith({
      chainId: "eip155:1",
      request: {
        method: "eth_sendTransaction",
        params: [
          expect.objectContaining({
            from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC contract
            value: "0x0",
          }),
        ],
      },
    });

    // Verify data field is present (ERC-20 transfer calldata)
    const callArgs = mockRequest.mock.calls[0][0];
    expect(callArgs.request.params[0].data).toBeDefined();
    expect(callArgs.request.params[0].data).toMatch(/^0x/);
  });

  it("uses first stored address when account not provided", async () => {
    const result = await fund({
      amount: "0.5",
      chain: "eip155:1",
    });

    expect(result.to).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });

  it("throws when no project ID is set", async () => {
    vi.mocked(resolveProjectId).mockReturnValueOnce(undefined);

    await expect(
      fund({
        account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        amount: "0.1",
        chain: "eip155:1",
      }),
    ).rejects.toThrow("WalletConnect project ID not found");
  });

  it("throws when no account found on target chain", async () => {
    mockWithWallet.mockImplementation(
      async (
        _options: unknown,
        callback: (
          wallet: { request: typeof mockRequest },
          result: { accounts: string[] },
        ) => Promise<void>,
      ) => {
        await callback(
          { request: mockRequest },
          { accounts: ["eip155:137:0xABC"] }, // Polygon, not eip155:1
        );
      },
    );

    await expect(
      fund({
        account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        amount: "0.1",
        chain: "eip155:1",
      }),
    ).rejects.toThrow("No account found on chain eip155:1");
  });

  it("throws when no stored addresses and no account provided", async () => {
    vi.mocked(listAddresses).mockReturnValueOnce([]);

    await expect(
      fund({
        amount: "0.1",
        chain: "eip155:1",
      }),
    ).rejects.toThrow("No wallet found");
  });
});
