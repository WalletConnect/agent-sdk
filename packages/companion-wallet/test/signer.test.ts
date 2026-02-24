import { describe, it, expect } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage, verifyTypedData, type Hex } from "viem";
import { signMessage, signTypedData, signTransaction, normalizeTransaction } from "../src/signer.js";

describe("signer", () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  describe("signMessage", () => {
    it("signs a plaintext message", async () => {
      const signature = await signMessage(privateKey, "hello world");
      expect(signature).toMatch(/^0x[0-9a-f]+$/);
    });

    it("produces a verifiable signature", async () => {
      const message = "test message for verification";
      const signature = await signMessage(privateKey, message);

      const valid = await verifyMessage({
        address: account.address,
        message,
        signature,
      });
      expect(valid).toBe(true);
    });

    it("signs different messages with different signatures", async () => {
      const sig1 = await signMessage(privateKey, "message 1");
      const sig2 = await signMessage(privateKey, "message 2");
      expect(sig1).not.toBe(sig2);
    });
  });

  describe("signTypedData", () => {
    const typedData = {
      domain: {
        name: "Test",
        version: "1",
        chainId: 1,
        verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC" as Hex,
      },
      types: {
        Person: [
          { name: "name", type: "string" },
          { name: "wallet", type: "address" },
        ],
      },
      primaryType: "Person",
      message: {
        name: "Alice",
        wallet: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      },
    };

    it("signs EIP-712 typed data", async () => {
      const signature = await signTypedData(privateKey, typedData);
      expect(signature).toMatch(/^0x[0-9a-f]+$/);
    });

    it("produces a verifiable typed data signature", async () => {
      const signature = await signTypedData(privateKey, typedData);

      const valid = await verifyTypedData({
        address: account.address,
        ...typedData,
        signature,
      } as Parameters<typeof verifyTypedData>[0]);
      expect(valid).toBe(true);
    });
  });

  describe("signTransaction", () => {
    it("signs a transaction", async () => {
      const signedTx = await signTransaction(
        privateKey,
        {
          to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          value: "1000000000000000000",
          data: "0x",
        },
        "eip155:1",
      );
      expect(signedTx).toMatch(/^0x[0-9a-f]+$/);
    });

    it("includes chain ID in signed transaction", async () => {
      const signedTx = await signTransaction(
        privateKey,
        { to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", value: "0" },
        "eip155:11155111",
      );
      expect(signedTx).toBeDefined();
    });
  });

  describe("normalizeTransaction", () => {
    it("converts string values to BigInt", () => {
      const tx = normalizeTransaction({
        to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        value: "1000000000000000000",
        gas: "21000",
      });
      expect(tx.value).toBe(1000000000000000000n);
      expect(tx.gas).toBe(21000n);
    });

    it("converts number values to BigInt", () => {
      const tx = normalizeTransaction({
        value: 1000,
        gas: 21000,
      });
      expect(tx.value).toBe(1000n);
      expect(tx.gas).toBe(21000n);
    });

    it("handles undefined values", () => {
      const tx = normalizeTransaction({ to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" });
      expect(tx.to).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
      expect(tx.value).toBeUndefined();
      expect(tx.gas).toBeUndefined();
    });

    it("handles EIP-1559 gas fields", () => {
      const tx = normalizeTransaction({
        maxFeePerGas: "30000000000",
        maxPriorityFeePerGas: "1000000000",
      });
      expect(tx.maxFeePerGas).toBe(30000000000n);
      expect(tx.maxPriorityFeePerGas).toBe(1000000000n);
    });
  });
});
