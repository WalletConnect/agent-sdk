import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock viem clients before importing drain
const mockGetBalance = vi.fn();
const mockGetGasPrice = vi.fn();
const mockSendTransaction = vi.fn();
const mockReadContract = vi.fn();

vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createPublicClient: () => ({
      getBalance: mockGetBalance,
      getGasPrice: mockGetGasPrice,
      readContract: mockReadContract,
    }),
    createWalletClient: () => ({
      sendTransaction: mockSendTransaction,
    }),
  };
});

vi.mock("../src/keystore.js", () => ({
  loadKey: vi.fn().mockReturnValue(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  ),
  listAddresses: vi.fn().mockReturnValue(["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]),
  resolveAccount: vi.fn().mockImplementation((account?: string) => {
    if (account) return account;
    const addresses = ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"];
    if (addresses.length === 0) throw new Error("No wallet found. Run 'companion-wallet generate' first.");
    return addresses[0];
  }),
}));

import { drain } from "../src/drain.js";
import { listAddresses, resolveAccount } from "../src/keystore.js";

describe("drain", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset resolveAccount to default behavior
    vi.mocked(resolveAccount).mockImplementation((account?: string) => {
      if (account) return account;
      return "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    });
  });

  it("sweeps balance minus gas cost", async () => {
    const balance = 1000000000000000000n; // 1 ETH
    const gasPrice = 20000000000n; // 20 gwei
    const gasCost = 21000n * gasPrice; // 420000 gwei
    const expectedSend = balance - gasCost;

    mockGetBalance.mockResolvedValue(balance);
    mockGetGasPrice.mockResolvedValue(gasPrice);
    mockSendTransaction.mockResolvedValue("0xabcdef1234567890");

    const result = await drain({
      account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      chain: "eip155:1",
    });

    expect(result.transactionHash).toBe("0xabcdef1234567890");
    expect(result.from).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    expect(result.to).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    expect(result.amount).toBe(expectedSend.toString());
    expect(result.token).toBe("ETH");

    // Verify sendTransaction was called with correct params
    expect(mockSendTransaction).toHaveBeenCalledWith({
      to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      value: expectedSend,
      gas: 21000n,
    });
  });

  it("throws when balance is insufficient to cover gas", async () => {
    mockGetBalance.mockResolvedValue(100n); // tiny balance
    mockGetGasPrice.mockResolvedValue(20000000000n); // 20 gwei

    await expect(
      drain({
        account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        chain: "eip155:1",
      }),
    ).rejects.toThrow("Insufficient balance to cover gas");
  });

  it("throws when balance equals gas cost", async () => {
    const gasPrice = 20000000000n;
    const gasCost = 21000n * gasPrice;

    mockGetBalance.mockResolvedValue(gasCost); // exactly equals gas
    mockGetGasPrice.mockResolvedValue(gasPrice);

    await expect(
      drain({
        account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        chain: "eip155:1",
      }),
    ).rejects.toThrow("Insufficient balance to cover gas");
  });

  it("uses first stored address when account not provided", async () => {
    mockGetBalance.mockResolvedValue(1000000000000000000n);
    mockGetGasPrice.mockResolvedValue(20000000000n);
    mockSendTransaction.mockResolvedValue("0xabcdef");

    const result = await drain({
      to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      chain: "eip155:1",
    });

    expect(result.from).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });

  it("throws when no account and no stored addresses", async () => {
    vi.mocked(resolveAccount).mockImplementationOnce(() => {
      throw new Error("No wallet found. Run 'companion-wallet generate' first.");
    });

    await expect(
      drain({
        to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        chain: "eip155:1",
      }),
    ).rejects.toThrow("No wallet found");
  });

  it("drains USDC via ERC-20 transfer", async () => {
    const usdcBalance = 5000000n; // 5 USDC
    mockReadContract.mockResolvedValue(usdcBalance);
    mockSendTransaction.mockResolvedValue("0xusdc_drain_hash");

    const result = await drain({
      account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      chain: "eip155:1",
      token: "usdc",
    });

    expect(result.transactionHash).toBe("0xusdc_drain_hash");
    expect(result.token).toBe("USDC");
    expect(result.amount).toBe("5000000");

    // Verify tx was sent to USDC contract with value=0
    expect(mockSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        value: 0n,
      }),
    );

    // Verify data field present (ERC-20 transfer calldata)
    const callArgs = mockSendTransaction.mock.calls[0][0];
    expect(callArgs.data).toBeDefined();
    expect(callArgs.data).toMatch(/^0x/);
  });

  it("throws when USDC balance is zero", async () => {
    mockReadContract.mockResolvedValue(0n);

    await expect(
      drain({
        account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        chain: "eip155:1",
        token: "usdc",
      }),
    ).rejects.toThrow("No USDC balance to drain");
  });
});
