/**
 * Minimal TSR (TanStack Router Seroval) serializer/deserializer.
 *
 * Handles the subset of seroval node types used in TanStack Start
 * server function requests and responses. No dependency on seroval itself.
 *
 * @see https://github.com/lxsmnsyc/seroval
 */

// ── Shared constants ────────────────────────────────────────────────

// SerovalConstant values (t:2)
const CONSTANT_VALUES: Record<number, unknown> = {
  0: null,
  1: undefined,
  2: true,
  3: false,
  4: -0,
  5: Infinity,
  6: -Infinity,
  7: NaN,
};

// Error constructors by index (t:13)
const ERROR_CTORS: Record<number, new (msg: string) => Error> = {
  0: Error,
  1: EvalError,
  2: RangeError,
  3: ReferenceError,
  4: SyntaxError,
  5: TypeError,
  6: URIError,
};

// Escape sequences used by seroval's string encoding
const ESCAPE_MAP: Record<string, string> = {
  "\\\\": "\\",
  '\\"': '"',
  "\\n": "\n",
  "\\r": "\r",
  "\\b": "\b",
  "\\t": "\t",
  "\\f": "\f",
  "\\u2028": "\u2028",
  "\\u2029": "\u2029",
  "\\x3C": "<",
};

function unescapeString(s: string): string {
  return s.replace(
    /(\\\\|\\"|\\n|\\r|\\b|\\t|\\f|\\u2028|\\u2029|\\x3C)/g,
    (m) => ESCAPE_MAP[m] ?? m,
  );
}

// ── Deserialization ─────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SerovalNode {
  t: number; // SerovalNodeType
  i?: number; // index for ref tracking
  s?: any; // string/number/constant value / plugin properties
  p?: { k: string[]; v: SerovalNode[] }; // properties (Object, NullConstructor)
  a?: SerovalNode[]; // array items (Array, Set)
  e?: { k: SerovalNode[]; v: SerovalNode[] }; // entries (Map)
  o?: number; // object flag
  c?: string; // constructor/source (RegExp, Error, Plugin tag)
  m?: string; // modifier/message (RegExp flags, Error message)
  f?: SerovalNode; // child node (Promise resolved value, TypedArray buffer)
}

function deserializeNode(node: SerovalNode, refs: Map<number, unknown>): unknown {
  switch (node.t) {
    // Number
    case 0:
      return Number(node.s);

    // String
    case 1:
      return unescapeString(String(node.s));

    // Constant (null, undefined, true, false, -0, Infinity, -Infinity, NaN)
    case 2:
      return CONSTANT_VALUES[node.s as number];

    // BigInt
    case 3:
      return BigInt(node.s);

    // IndexedValue (back-reference)
    case 4:
      return refs.get(node.i!);

    // Date
    case 5: {
      const d = new Date(node.s);
      if (node.i !== undefined) refs.set(node.i, d);
      return d;
    }

    // RegExp
    case 6: {
      const r = new RegExp(unescapeString(node.c!), node.m);
      if (node.i !== undefined) refs.set(node.i, r);
      return r;
    }

    // Set
    case 7: {
      const s = new Set();
      if (node.i !== undefined) refs.set(node.i, s);
      for (const item of node.a!) s.add(deserializeNode(item, refs));
      return s;
    }

    // Map
    case 8: {
      const m = new Map();
      if (node.i !== undefined) refs.set(node.i, m);
      for (let idx = 0; idx < node.e!.k.length; idx++)
        m.set(deserializeNode(node.e!.k[idx], refs), deserializeNode(node.e!.v[idx], refs));
      return m;
    }

    // Array
    case 9: {
      const arr: unknown[] = [];
      if (node.i !== undefined) refs.set(node.i, arr);
      for (let idx = 0; idx < node.a!.length; idx++) {
        if (node.a![idx]) arr[idx] = deserializeNode(node.a![idx], refs);
      }
      return arr;
    }

    // Object (10) and NullConstructor (11)
    case 10:
    case 11: {
      const obj: Record<string, unknown> = node.t === 11 ? Object.create(null) : {};
      if (node.i !== undefined) refs.set(node.i, obj);
      const { k, v } = node.p!;
      for (let idx = 0; idx < k.length; idx++) {
        obj[k[idx]] = deserializeNode(v[idx], refs);
      }
      return obj;
    }

    // Promise (resolved)
    case 12:
      return deserializeNode(node.f!, refs);

    // Error
    case 13: {
      const Ctor = ERROR_CTORS[node.s as number] ?? Error;
      const err = new Ctor(unescapeString(node.m!));
      if (node.i !== undefined) refs.set(node.i, err);
      if (node.p) {
        const { k, v } = node.p;
        for (let idx = 0; idx < k.length; idx++) {
          (err as any)[k[idx]] = deserializeNode(v[idx], refs);
        }
      }
      return err;
    }

    // Plugin (25) — handles TanStack's $TSR/Error and other plugins
    case 25: {
      // Plugin nodes have s: { prop: SerovalNode } and c: pluginTag
      const tag = node.c;
      if (tag === "$TSR/Error") {
        // $TSR/Error plugin: s contains { message: SerovalNode, ... }
        const props = node.s as Record<string, SerovalNode>;
        const message = props.message ? deserializeNode(props.message, refs) : "Unknown error";
        const err = new Error(String(message));
        if (node.i !== undefined) refs.set(node.i, err);
        return err;
      }
      // Generic plugin: deserialize all properties in s
      const result: Record<string, unknown> = {};
      if (node.s && typeof node.s === "object") {
        for (const [key, val] of Object.entries(node.s)) {
          result[key] =
            val && typeof val === "object" && "t" in (val as any)
              ? deserializeNode(val as SerovalNode, refs)
              : val;
        }
      }
      if (node.i !== undefined) refs.set(node.i, result);
      return result;
    }

    default:
      throw new Error(`Unsupported seroval node type: ${node.t}`);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Deserialize a TSR (seroval CrossJSON) node into a plain JS value.
 *
 * @example
 * ```ts
 * const raw = await res.json();
 * const value = deserializeTSR<{ result: T; error: unknown }>(raw);
 * ```
 */
export function deserializeTSR<T>(node: unknown): T {
  const refs = new Map<number, unknown>();
  return deserializeNode(node as SerovalNode, refs) as T;
}

// ── Serialization ───────────────────────────────────────────────────

/** SerovalJSON envelope expected by fromJSON() */
interface SerovalJSON {
  t: SerovalNode;
  f: number;
  m: number[];
}

class Serializer {
  private nextId = 0;

  serializeValue(value: unknown): SerovalNode {
    if (value === null) return { t: 2, s: 0 };
    if (value === undefined) return { t: 2, s: 1 };
    if (value === true) return { t: 2, s: 2 };
    if (value === false) return { t: 2, s: 3 };

    if (typeof value === "string") return { t: 1, s: value };
    if (typeof value === "number") return { t: 0, s: value };

    if (Array.isArray(value)) {
      const id = this.nextId++;
      const node: SerovalNode = { t: 9, i: id, a: [], o: 0 };
      node.a = value.map((item) => this.serializeValue(item));
      return node;
    }

    if (typeof value === "object") {
      const id = this.nextId++;
      const keys = Object.keys(value as Record<string, unknown>);
      const vals = keys.map((k) => this.serializeValue((value as Record<string, unknown>)[k]));
      return { t: 10, i: id, p: { k: keys, v: vals }, o: 0 };
    }

    // Fallback: convert to string
    return { t: 1, s: String(value) };
  }

  toJSON(value: unknown): SerovalJSON {
    const node = this.serializeValue(value);
    // m array length must be >= number of referenced nodes
    const markers = Array.from({ length: this.nextId }, (_, i) => i);
    return { t: node, f: 0, m: markers };
  }
}

/**
 * Serialize a plain JS value into a SerovalJSON envelope suitable for
 * TanStack Start server function payloads (parsed by seroval's fromJSON).
 *
 * Handles: string, number, boolean, null, undefined, plain objects, arrays.
 *
 * @example
 * ```ts
 * const payload = serializeTSR({ paymentId: "pay_123" });
 * formData.append("payload", JSON.stringify(payload));
 * ```
 */
export function serializeTSR(value: unknown): SerovalJSON {
  return new Serializer().toJSON(value);
}
