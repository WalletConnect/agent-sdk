import { describe, it, expect } from "vitest";
import { deserializeTSR, serializeTSR } from "../src/tsr.js";

describe("deserializeTSR", () => {
  it("deserializes strings (t:1)", () => {
    expect(deserializeTSR({ t: 1, s: "hello" })).toBe("hello");
  });

  it("deserializes numbers (t:0)", () => {
    expect(deserializeTSR({ t: 0, s: 42 })).toBe(42);
  });

  it("deserializes constants (t:2)", () => {
    expect(deserializeTSR({ t: 2, s: 0 })).toBeNull();
    expect(deserializeTSR({ t: 2, s: 1 })).toBeUndefined();
    expect(deserializeTSR({ t: 2, s: 2 })).toBe(true);
    expect(deserializeTSR({ t: 2, s: 3 })).toBe(false);
  });

  it("deserializes plain objects (t:10)", () => {
    const node = {
      t: 10,
      i: 0,
      p: {
        k: ["name", "age"],
        v: [
          { t: 1, s: "Alice" },
          { t: 0, s: 30 },
        ],
      },
      o: 0,
    };
    expect(deserializeTSR(node)).toEqual({ name: "Alice", age: 30 });
  });

  it("deserializes null-prototype objects (t:11)", () => {
    const node = {
      t: 11,
      i: 0,
      p: { k: ["key"], v: [{ t: 1, s: "value" }] },
      o: 0,
    };
    const result = deserializeTSR<Record<string, string>>(node);
    expect(result.key).toBe("value");
    expect(Object.getPrototypeOf(result)).toBeNull();
  });

  it("deserializes nested objects", () => {
    const node = {
      t: 10,
      i: 0,
      p: {
        k: ["outer"],
        v: [
          {
            t: 10,
            i: 1,
            p: {
              k: ["inner"],
              v: [{ t: 1, s: "deep" }],
            },
            o: 0,
          },
        ],
      },
      o: 0,
    };
    expect(deserializeTSR(node)).toEqual({ outer: { inner: "deep" } });
  });

  it("deserializes arrays (t:9)", () => {
    const node = {
      t: 9,
      i: 0,
      a: [
        { t: 0, s: 1 },
        { t: 0, s: 2 },
        { t: 0, s: 3 },
      ],
      o: 0,
    };
    expect(deserializeTSR(node)).toEqual([1, 2, 3]);
  });

  it("handles back-references (t:4)", () => {
    // Object referenced twice via IndexedValue
    const shared = { t: 10, i: 1, p: { k: ["x"], v: [{ t: 0, s: 1 }] }, o: 0 };
    const node = {
      t: 9,
      i: 0,
      a: [shared, { t: 4, i: 1 }],
      o: 0,
    };
    const result = deserializeTSR<[{ x: number }, { x: number }]>(node);
    expect(result[0]).toBe(result[1]); // same reference
  });

  it("deserializes a real TanStack Start error response", () => {
    const raw = JSON.parse(
      '{"t":10,"i":0,"p":{"k":["result","error","context"],"v":[{"t":10,"i":1,"p":{"k":["status","error"],"v":[{"t":1,"s":"error"},{"t":10,"i":2,"p":{"k":["code","message"],"v":[{"t":1,"s":"NETWORK_ERROR"},{"t":1,"s":"HTTP 404: Not Found"}]},"o":0}]},"o":0},{"t":2,"s":1},{"t":11,"i":3,"p":{"k":[],"v":[]},"o":0}]},"o":0}',
    );

    const result = deserializeTSR<{
      result: { status: string; error: { code: string; message: string } };
      error: undefined;
    }>(raw);

    expect(result.result.status).toBe("error");
    expect(result.result.error.code).toBe("NETWORK_ERROR");
    expect(result.result.error.message).toBe("HTTP 404: Not Found");
    expect(result.error).toBeUndefined();
  });

  it("deserializes a success response envelope", () => {
    // Simulates a successful getPayment response
    const raw = {
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
              v: [
                { t: 1, s: "success" },
                {
                  t: 10,
                  i: 2,
                  p: {
                    k: ["status", "merchant"],
                    v: [
                      { t: 1, s: "requires_action" },
                      {
                        t: 10,
                        i: 3,
                        p: {
                          k: ["name"],
                          v: [{ t: 1, s: "Test Merchant" }],
                        },
                        o: 0,
                      },
                    ],
                  },
                  o: 0,
                },
              ],
            },
            o: 0,
          },
          { t: 2, s: 1 },
          { t: 11, i: 4, p: { k: [], v: [] }, o: 0 },
        ],
      },
      o: 0,
    };

    const result = deserializeTSR<{
      result: { status: string; data: { status: string; merchant: { name: string } } };
      error: undefined;
    }>(raw);

    expect(result.result.status).toBe("success");
    expect(result.result.data.status).toBe("requires_action");
    expect(result.result.data.merchant.name).toBe("Test Merchant");
  });

  it("deserializes escaped strings", () => {
    expect(deserializeTSR({ t: 1, s: "line1\\nline2" })).toBe("line1\nline2");
    expect(deserializeTSR({ t: 1, s: "tab\\there" })).toBe("tab\there");
  });

  it("deserializes $TSR/Error plugin (t:25)", () => {
    const node = {
      t: 25,
      i: 1,
      s: {
        message: { t: 1, s: "Something went wrong" },
      },
      c: "$TSR/Error",
    };
    const result = deserializeTSR<Error>(node);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("Something went wrong");
  });

  it("throws on unsupported node types", () => {
    expect(() => deserializeTSR({ t: 99 })).toThrow("Unsupported seroval node type: 99");
  });
});

describe("serializeTSR", () => {
  it("serializes strings", () => {
    const json = serializeTSR("hello");
    expect(json.t).toEqual({ t: 1, s: "hello" });
    expect(json.f).toBe(0);
  });

  it("serializes numbers", () => {
    const json = serializeTSR(42);
    expect(json.t).toEqual({ t: 0, s: 42 });
  });

  it("serializes null and undefined", () => {
    expect(serializeTSR(null).t).toEqual({ t: 2, s: 0 });
    expect(serializeTSR(undefined).t).toEqual({ t: 2, s: 1 });
  });

  it("serializes booleans", () => {
    expect(serializeTSR(true).t).toEqual({ t: 2, s: 2 });
    expect(serializeTSR(false).t).toEqual({ t: 2, s: 3 });
  });

  it("serializes plain objects", () => {
    const json = serializeTSR({ name: "Alice", age: 30 });
    expect(json.t.t).toBe(10);
    expect(json.t.p).toEqual({
      k: ["name", "age"],
      v: [
        { t: 1, s: "Alice" },
        { t: 0, s: 30 },
      ],
    });
    expect(json.m).toHaveLength(1);
  });

  it("serializes arrays", () => {
    const json = serializeTSR([1, "two", true]);
    expect(json.t.t).toBe(9);
    expect(json.t.a).toEqual([
      { t: 0, s: 1 },
      { t: 1, s: "two" },
      { t: 2, s: 2 },
    ]);
  });

  it("round-trips through deserialize", () => {
    const input = {
      body: {
        amount: { unit: "iso4217/USD", value: "1000" },
        referenceId: "cli-test",
      },
    };
    const serialized = serializeTSR(input);
    const deserialized = deserializeTSR<typeof input>(serialized.t);
    expect(deserialized).toEqual(input);
  });

  it("round-trips nested arrays and objects", () => {
    const input = {
      accounts: ["eip155:1:0xabc", "eip155:8453:0xdef"],
      options: { refresh: null },
    };
    const serialized = serializeTSR(input);
    const deserialized = deserializeTSR<typeof input>(serialized.t);
    expect(deserialized).toEqual(input);
  });
});
