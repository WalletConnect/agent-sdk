import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFrontendPayClient } from "../src/frontend-client.js";
import { deserializeTSR } from "../src/tsr.js";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

/** Build a TSR-encoded success envelope */
function tsrSuccess(data: unknown) {
  return {
    t: 10,
    i: 0,
    p: {
      k: ["result", "error", "context"],
      v: [
        {
          t: 10,
          i: 1,
          p: {
            k: ["status", "data"],
            v: [{ t: 1, s: "success" }, jsonToTsr(data, 2)],
          },
          o: 0,
        },
        { t: 2, s: 1 }, // undefined
        { t: 11, i: 99, p: { k: [], v: [] }, o: 0 },
      ],
    },
    o: 0,
  };
}

/** Build a TSR-encoded error envelope */
function tsrError(code: string, message: string) {
  return {
    t: 10,
    i: 0,
    p: {
      k: ["result", "error", "context"],
      v: [
        {
          t: 10,
          i: 1,
          p: {
            k: ["status", "error"],
            v: [
              { t: 1, s: "error" },
              {
                t: 10,
                i: 2,
                p: {
                  k: ["code", "message"],
                  v: [
                    { t: 1, s: code },
                    { t: 1, s: message },
                  ],
                },
                o: 0,
              },
            ],
          },
          o: 0,
        },
        { t: 2, s: 1 },
        { t: 11, i: 3, p: { k: [], v: [] }, o: 0 },
      ],
    },
    o: 0,
  };
}

let nextId = 10;

/** Convert a plain JS value to a TSR node (minimal, for test fixtures) */
function jsonToTsr(value: unknown, startId?: number): ReturnType<typeof _jsonToTsr> {
  nextId = startId ?? nextId;
  return _jsonToTsr(value);
}

function _jsonToTsr(value: unknown): { t: number; [k: string]: unknown } {
  if (value === null) return { t: 2, s: 0 };
  if (value === undefined) return { t: 2, s: 1 };
  if (value === true) return { t: 2, s: 2 };
  if (value === false) return { t: 2, s: 3 };
  if (typeof value === "string") return { t: 1, s: value };
  if (typeof value === "number") return { t: 0, s: value };
  if (Array.isArray(value)) {
    const id = nextId++;
    return { t: 9, i: id, a: value.map(_jsonToTsr), o: 0 };
  }
  if (typeof value === "object") {
    const id = nextId++;
    const keys = Object.keys(value as Record<string, unknown>);
    const vals = keys.map((k) => _jsonToTsr((value as Record<string, unknown>)[k]));
    return { t: 10, i: id, p: { k: keys, v: vals }, o: 0 };
  }
  return { t: 1, s: String(value) };
}

function jsonResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

function errorResponse(status: number, statusText: string) {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
  });
}

/** Extract the deserialized data from the seroval-encoded JSON body */
function extractPayloadData(body: string): unknown {
  const parsed = JSON.parse(body);
  // parsed is a SerovalJSON envelope { t, f, m }
  // deserialize the node to get the original { data: ... } wrapper
  const deserialized = deserializeTSR<{ data: unknown }>(parsed.t);
  return deserialized.data;
}

describe("createFrontendPayClient", () => {
  const client = createFrontendPayClient({
    frontendUrl: "https://staging.pay.walletconnect.com",
  });

  describe("getPayment", () => {
    it("calls the correct server function with paymentId", async () => {
      const paymentData = {
        amount: {
          display: { assetName: "US Dollar", assetSymbol: "USD", decimals: 2 },
          unit: "iso4217/USD",
          value: "1000",
        },
        merchant: { name: "Test Merchant", iconUrl: null },
        status: "requires_action",
        expiresAt: 1735689600,
      };

      fetchMock.mockReturnValueOnce(jsonResponse(tsrSuccess(paymentData)));

      const result = await client.getPayment("pay_123");

      expect(result.merchant.name).toBe("Test Merchant");
      expect(result.status).toBe("requires_action");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        "https://staging.pay.walletconnect.com/_serverFn/getPaymentFn_createServerFn_handler",
      );
      expect(init.method).toBe("POST");
      expect(init.headers["x-tsr-serverFn"]).toBe("true");
      expect(init.headers["Content-Type"]).toBe("application/json");
    });

    it("sends seroval-encoded payload with data wrapper", async () => {
      fetchMock.mockReturnValueOnce(
        jsonResponse(
          tsrSuccess({
            amount: {
              display: { assetName: "USD", assetSymbol: "USD", decimals: 2 },
              unit: "iso4217/USD",
              value: "500",
            },
            merchant: { name: "M", iconUrl: null },
            status: "succeeded",
            expiresAt: 0,
          }),
        ),
      );

      await client.getPayment("pay_456");

      const body = fetchMock.mock.calls[0][1].body as string;
      const payload = JSON.parse(body);
      // Payload should be a SerovalJSON envelope with { t, f, m }
      expect(payload).toHaveProperty("t");
      expect(payload).toHaveProperty("f", 0);
      expect(payload).toHaveProperty("m");

      // The deserialized data should contain { data: { paymentId: "pay_456" } }
      const data = extractPayloadData(body);
      expect(data).toEqual({ paymentId: "pay_456" });
    });
  });

  describe("createPayment", () => {
    it("wraps input in body field for server function", async () => {
      const createData = {
        paymentId: "pay_new",
        gatewayUrl: "https://pay.walletconnect.org/pay_new",
        status: "requires_action",
        expiresAt: 1735689600,
        isFinal: false,
        pollInMs: 1000,
      };

      fetchMock.mockReturnValueOnce(jsonResponse(tsrSuccess(createData)));

      const result = await client.createPayment({
        amount: { unit: "iso4217/USD", value: "1000" },
        referenceId: "ORDER-1",
      });

      expect(result.paymentId).toBe("pay_new");

      const data = extractPayloadData(fetchMock.mock.calls[0][1].body as string);
      expect(data).toEqual({
        body: {
          amount: { unit: "iso4217/USD", value: "1000" },
          referenceId: "ORDER-1",
        },
      });
    });
  });

  describe("getPaymentOptions", () => {
    it("passes paymentId and request in payload", async () => {
      const optionsData = {
        options: [
          {
            id: "opt_1",
            account: "eip155:8453:0xabc",
            amount: {
              display: { assetName: "USDC", assetSymbol: "USDC", decimals: 6 },
              unit: "caip19/eip155:8453/erc20:0xUSDC",
              value: "10000000",
            },
            actions: [],
            etaS: 5,
          },
        ],
      };

      fetchMock.mockReturnValueOnce(jsonResponse(tsrSuccess(optionsData)));

      const result = await client.getPaymentOptions("pay_123", {
        accounts: ["eip155:8453:0xabc"],
      });

      expect(result.options).toHaveLength(1);

      const data = extractPayloadData(fetchMock.mock.calls[0][1].body as string);
      expect(data).toEqual({
        paymentId: "pay_123",
        request: { accounts: ["eip155:8453:0xabc"] },
      });
    });
  });

  describe("confirmPayment", () => {
    it("passes paymentId and request in payload", async () => {
      const confirmData = { status: "processing" };

      fetchMock.mockReturnValueOnce(jsonResponse(tsrSuccess(confirmData)));

      await client.confirmPayment("pay_123", {
        optionId: "opt_1",
        results: [{ type: "walletRpc", data: ["0xsig1"] }],
      });

      const data = extractPayloadData(fetchMock.mock.calls[0][1].body as string);
      expect(data).toEqual({
        paymentId: "pay_123",
        request: {
          optionId: "opt_1",
          results: [{ type: "walletRpc", data: ["0xsig1"] }],
        },
      });
    });
  });

  describe("error handling", () => {
    it("throws on engine error response", async () => {
      fetchMock.mockReturnValueOnce(jsonResponse(tsrError("PAYMENT_NOT_FOUND", "Not found")));

      await expect(client.getPayment("invalid")).rejects.toThrow("PAYMENT_NOT_FOUND: Not found");
    });

    it("throws on HTTP error", async () => {
      fetchMock.mockReturnValueOnce(errorResponse(500, "Internal Server Error"));

      await expect(client.getPayment("pay_123")).rejects.toThrow(
        "Server function error: 500 Internal Server Error",
      );
    });
  });
});
