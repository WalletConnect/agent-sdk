// x402 proxy test script
// Tests a local mock 402 server and optionally a real x402 endpoint
//
// Usage:
//   node test-server.mjs              # Run local mock server only
//   node test-server.mjs --test       # Run full test suite against running proxy
//   node test-server.mjs --test-real  # Test only the real endpoint against running proxy

import http from "http";

const PORT = 3402;
const PROXY_PORT = 8402;
const REAL_ENDPOINT = "https://x402.payai.network/api/base/paid-content";

// --- Test runner ---

const args = process.argv.slice(2);
const testMode = args.includes("--test");
const testRealOnly = args.includes("--test-real");

if (testMode || testRealOnly) {
  runTests(testRealOnly).then((passed) => {
    process.exit(passed ? 0 : 1);
  });
} else {
  startMockServer();
}

async function runTests(realOnly) {
  console.log("=== x402 Proxy Test Suite ===\n");

  let allPassed = true;

  if (!realOnly) {
    console.log("--- Test 1: Local mock endpoint (HTTP) ---");
    const mockResult = await testEndpoint(
      `http://127.0.0.1:${PORT}/paid-content`,
      false,
    );
    allPassed = allPassed && mockResult;
  }

  console.log(
    `--- Test ${realOnly ? "1" : "2"}: Real endpoint (${REAL_ENDPOINT}) ---`,
  );
  const realResult = await testEndpoint(REAL_ENDPOINT, true);
  allPassed = allPassed && realResult;

  console.log("\n=== Results ===");
  console.log(allPassed ? "All tests passed" : "Some tests failed");
  return allPassed;
}

function testEndpoint(url, isHttps) {
  return new Promise((resolve) => {
    console.log(`  [1/2] Direct request (expect 402)...`);
    directRequest(url, isHttps)
      .then((directStatus) => {
        if (directStatus === 402) {
          console.log(`    OK: Got 402 Payment Required`);
        } else {
          console.log(`    FAIL: Expected 402, got ${directStatus}`);
          resolve(false);
          return;
        }

        console.log(`  [2/2] Request through proxy (expect 200)...`);
        proxyRequest(url)
          .then(({ status, body }) => {
            if (status === 200) {
              console.log(`    OK: Got 200 OK`);
              try {
                const data = JSON.parse(body);
                if (data.premiumContent) {
                  console.log(`    Content: "${data.premiumContent}"`);
                } else if (data.message) {
                  console.log(`    Content: "${data.message}"`);
                }
                if (data.payer) {
                  console.log(`    Payer: ${data.payer}`);
                }
              } catch {
                /* not JSON, that's ok */
              }
              resolve(true);
            } else {
              console.log(`    FAIL: Expected 200, got ${status}`);
              console.log(`    Body: ${body.substring(0, 200)}`);
              resolve(false);
            }
          })
          .catch((err) => {
            console.log(`    FAIL: Proxy request failed: ${err.message}`);
            resolve(false);
          });
      })
      .catch((err) => {
        console.log(`    FAIL: Direct request failed: ${err.message}`);
        resolve(false);
      });
  });
}

async function directRequest(url, isHttps) {
  const mod = isHttps ? (await import("https")).default : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(url, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
}

function proxyRequest(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === "https:";

    if (isHttps) {
      const connectReq = http.request({
        hostname: "127.0.0.1",
        port: PROXY_PORT,
        method: "CONNECT",
        path: `${parsed.hostname}:${parsed.port || 443}`,
      });

      connectReq.on("connect", (_res, socket) => {
        import("https").then(({ default: httpsModule }) => {
          const req = httpsModule.request(
            {
              hostname: parsed.hostname,
              path: parsed.pathname + parsed.search,
              method: "GET",
              socket: socket,
              agent: false,
              rejectUnauthorized: false,
            },
            (res) => {
              let body = "";
              res.on("data", (chunk) => (body += chunk));
              res.on("end", () =>
                resolve({ status: res.statusCode, body }),
              );
            },
          );
          req.on("error", reject);
          req.end();
        });
      });

      connectReq.on("error", reject);
      connectReq.end();
    } else {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: PROXY_PORT,
          path: targetUrl,
          method: "GET",
          headers: { Host: parsed.host },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve({ status: res.statusCode, body }));
        },
      );
      req.on("error", reject);
      req.end();
    }
  });
}

// --- Mock server ---

const paymentRequired = {
  x402Version: 2,
  accepts: [
    {
      scheme: "exact",
      network: "eip155:8453",
      amount: "1000", // 0.001 USDC
      payTo: "0x0000000000000000000000000000000000000001",
      maxTimeoutSeconds: 300,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      extra: {
        name: "USD Coin",
        version: "2",
        description: "Test x402 endpoint",
        mimeType: "application/json",
        resource: `http://localhost:${PORT}/paid-content`,
      },
    },
  ],
  resource: {
    url: `http://localhost:${PORT}/paid-content`,
    description: "Test x402 endpoint",
    mimeType: "application/json",
  },
};

function startMockServer() {
  const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);

    const paymentSig =
      req.headers["payment-signature"] || req.headers["x-payment"];

    if (req.url === "/paid-content") {
      if (paymentSig) {
        console.log("  Payment signature received, accepting payment...");
        try {
          const decoded = JSON.parse(
            Buffer.from(paymentSig, "base64").toString("utf-8"),
          );
          console.log(
            `  Payer: ${decoded.payload?.authorization?.from}`,
          );
          console.log(`  Amount: ${decoded.accepted?.amount}`);

          res.writeHead(200, {
            "Content-Type": "application/json",
            "Payment-Response": Buffer.from(
              JSON.stringify({
                success: true,
                message:
                  "Payment accepted (test mode - no actual payment processed)",
              }),
            ).toString("base64"),
          });
          res.end(
            JSON.stringify(
              {
                message:
                  "Payment successful! This is the paid content.",
                payer: decoded.payload?.authorization?.from,
                amount: decoded.accepted?.amount,
                note: "This is a test server - no actual payment was processed",
              },
              null,
              2,
            ),
          );
          return;
        } catch {
          console.log("  Invalid payment signature format");
        }
      }

      console.log("  No payment, returning 402...");
      const paymentHeader = Buffer.from(
        JSON.stringify(paymentRequired),
      ).toString("base64");
      res.writeHead(402, {
        "Content-Type": "application/json",
        "Payment-Required": paymentHeader,
      });
      res.end(JSON.stringify(paymentRequired, null, 2));
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", x402: true }));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found. Try /paid-content or /health");
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`x402 test server running on http://127.0.0.1:${PORT}`);
    console.log("");
    console.log("Endpoints:");
    console.log(
      `  GET http://127.0.0.1:${PORT}/paid-content - Returns 402, then 200 with payment`,
    );
    console.log(
      `  GET http://127.0.0.1:${PORT}/health - Health check`,
    );
    console.log("");
    console.log("Test commands (with proxy running on :8402):");
    console.log(
      "  node test-server.mjs --test       # Full test suite (mock + real)",
    );
    console.log(
      "  node test-server.mjs --test-real   # Real endpoint only",
    );
    console.log("");
  });
}
