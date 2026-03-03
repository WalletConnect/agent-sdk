import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPayClient } from "../src/api.js";
import type { GetPaymentResponse, CreatePaymentResponse, GetPaymentOptionsResponse, GetPaymentStatusResponse } from "../src/types.js";

const mockPayment: GetPaymentResponse = {
  amount: {
    display: { assetName: "US Dollar", assetSymbol: "USD", decimals: 2 },
    unit: "iso4217/USD",
    value: "1000",
  },
  merchant: { name: "Test Merchant", iconUrl: null },
  status: "requires_action",
  expiresAt: 1735689600,
};

const mockCreateResponse: CreatePaymentResponse = {
  paymentId: "pay_123",
  gatewayUrl: "https://pay.walletconnect.org/pay_123",
  status: "requires_action",
  expiresAt: 1735689600,
  isFinal: false,
  pollInMs: 1000,
};

const mockOptions: GetPaymentOptionsResponse = {
  options: [
    {
      id: "opt_1",
      account: "eip155:8453:0xabc",
      amount: {
        display: { assetName: "USD Coin", assetSymbol: "USDC", decimals: 6, networkName: "Base" },
        unit: "caip19/eip155:8453/erc20:0xUSDC",
        value: "10000000",
      },
      actions: [
        {
          type: "walletRpc",
          data: { chain_id: "eip155:8453", method: "eth_signTypedData_v4", params: ["0xabc", "{}"] },
        },
      ],
      etaS: 5,
    },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Bad Request",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Map(),
  });
}

describe("createPayClient", () => {
  const client = createPayClient({
    staging: true,
    walletApiKey: "wallet-key",
    partnerApiKey: "partner-key",
    merchantId: "merchant_456",
    sdkVersion: "0.1.0",
  });

  describe("getPayment", () => {
    it("fetches payment via gateway endpoint", async () => {
      fetchMock.mockReturnValueOnce(jsonResponse(mockPayment));

      const result = await client.getPayment("pay_123");

      expect(result).toEqual(mockPayment);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://staging.api.pay.walletconnect.org/v1/gateway/payment/pay_123",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Api-Key": "wallet-key",
            "Wcp-Version": "2026-02-19.preview",
            "Sdk-Name": "@walletconnect/pay-cli",
          }),
        }),
      );
    });

    it("does not send Merchant-Id for gateway requests", async () => {
      fetchMock.mockReturnValueOnce(jsonResponse(mockPayment));

      await client.getPayment("pay_123");

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers["Merchant-Id"]).toBeUndefined();
    });

    it("throws on API error", async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ code: "payment_not_found", message: "Not found" }, 404));

      await expect(client.getPayment("invalid")).rejects.toThrow("payment_not_found: Not found");
    });
  });

  describe("createPayment", () => {
    it("creates payment via merchant endpoint", async () => {
      fetchMock.mockReturnValueOnce(jsonResponse(mockCreateResponse));

      const result = await client.createPayment({
        amount: { unit: "iso4217/USD", value: "1000" },
        referenceId: "ORDER-123",
      });

      expect(result.paymentId).toBe("pay_123");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://staging.api.pay.walletconnect.org/v1/merchant/payment",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Api-Key": "partner-key",
            "Merchant-Id": "merchant_456",
          }),
        }),
      );
    });
  });

  describe("getPaymentOptions", () => {
    it("fetches options via POST with accounts", async () => {
      fetchMock.mockReturnValueOnce(jsonResponse(mockOptions));

      const result = await client.getPaymentOptions("pay_123", {
        accounts: ["eip155:8453:0xabc"],
      });

      expect(result.options).toHaveLength(1);
      expect(result.options[0].id).toBe("opt_1");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://staging.api.pay.walletconnect.org/v1/gateway/payment/pay_123/options",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ accounts: ["eip155:8453:0xabc"] }),
          headers: expect.objectContaining({ "Api-Key": "wallet-key" }),
        }),
      );
    });
  });

  describe("confirmPayment", () => {
    it("confirms with results via gateway", async () => {
      const confirmResponse = { status: "processing" as const, isFinal: false, pollInMs: 1000 };
      fetchMock.mockReturnValueOnce(jsonResponse(confirmResponse));

      const result = await client.confirmPayment("pay_123", {
        optionId: "opt_1",
        results: [{ type: "walletRpc", data: ["0xsig1"] }],
      });

      expect(result.status).toBe("processing");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://staging.api.pay.walletconnect.org/v1/gateway/payment/pay_123/confirm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ optionId: "opt_1", results: [{ type: "walletRpc", data: ["0xsig1"] }] }),
        }),
      );
    });
  });

  describe("pollStatus", () => {
    it("polls until isFinal is true", async () => {
      const processing: GetPaymentStatusResponse = { status: "processing", isFinal: false, pollInMs: 10 };
      const succeeded: GetPaymentStatusResponse = {
        status: "succeeded",
        isFinal: true,
        info: {
          optionAmount: {
            display: { assetName: "USDC", assetSymbol: "USDC", decimals: 6 },
            unit: "caip19/eip155:8453/erc20:0x",
            value: "10000000",
          },
          txId: "0xtxhash",
        },
      };

      fetchMock
        .mockReturnValueOnce(jsonResponse(processing))
        .mockReturnValueOnce(jsonResponse(succeeded));

      const result = await client.pollStatus("pay_123");

      expect(result.status).toBe("succeeded");
      expect(result.info?.txId).toBe("0xtxhash");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("returns immediately for final statuses", async () => {
      const failed: GetPaymentStatusResponse = { status: "failed", isFinal: true };
      fetchMock.mockReturnValueOnce(jsonResponse(failed));

      const result = await client.pollStatus("pay_123");

      expect(result.status).toBe("failed");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe("createPayClient without merchant keys", () => {
  const client = createPayClient({
    staging: true,
    walletApiKey: "wallet-key",
    sdkVersion: "0.1.0",
  });

  it("throws when trying to create payment without merchant keys", async () => {
    await expect(
      client.createPayment({
        amount: { unit: "iso4217/USD", value: "1000" },
        referenceId: "ORDER-123",
      }),
    ).rejects.toThrow("Partner API key and Merchant ID are required");
  });

  it("gateway operations work without merchant keys", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse(mockPayment));
    const result = await client.getPayment("pay_123");
    expect(result.status).toBe("requires_action");
  });
});

describe("createPayClient with prod URL", () => {
  it("uses production URL when staging is false", async () => {
    const client = createPayClient({ staging: false, walletApiKey: "key", sdkVersion: "0.1.0" });
    fetchMock.mockReturnValueOnce(jsonResponse(mockPayment));

    await client.getPayment("pay_123");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.pay.walletconnect.org/v1/gateway/payment/pay_123",
      expect.anything(),
    );
  });
});
