# x402 Browser Proxy

A local MITM proxy that intercepts HTTP 402 (Payment Required) responses and automatically signs [x402](https://www.x402.org/) payments using a CWP (CLI Wallet Protocol) wallet provider.

## How It Works

```
Any HTTP client → MITM proxy (port 8402) → origin server
                        ↓ (on 402)
                  parse x402 payment header
                        ↓
                  CWP sign-typed-data → wallet provider (e.g., companion-wallet)
                        ↓
                  retry request with payment signature
                        ↓
                  return 200 to client
```

The proxy sits between any HTTP client and the internet. When a server responds with `402 Payment Required` and an x402 payment header, the proxy automatically:

1. Parses the payment requirements (amount, network, asset)
2. Signs the payment via CWP (`wallet-companion sign-typed-data`)
3. Retries the request with the payment signature
4. Returns the paid response to the client

No code changes needed in the client — just point it at the proxy.

## Prerequisites

- A CWP wallet provider installed and on PATH (e.g., `companion-wallet`)
- The wallet must have an EVM account with funds on the target network
- To install companion-wallet: `npm install -g @walletconnect/companion-wallet` (or `npm link` from `packages/companion-wallet`)

## Quick Start

```bash
# From the repo root
npm run build

# Start the proxy (auto-discovers wallet-companion)
cd samples/x402-browser-proxy
npm run dev start
```

## Consuming the Proxy

Any HTTP client can use the proxy. The key idea: route your traffic through `http://127.0.0.1:8402` and the proxy handles payments transparently.

### curl

```bash
# Direct request — gets 402
curl https://x402.payai.network/api/base/paid-content
# → 402 Payment Required

# Through proxy — gets 200 (proxy pays automatically)
curl -x http://127.0.0.1:8402 https://x402.payai.network/api/base/paid-content
# → 200 OK with paid content
```

### agent-browser

```bash
export AGENT_BROWSER_PROXY="http://127.0.0.1:8402"
export AGENT_BROWSER_IGNORE_HTTPS_ERRORS=1
agent-browser open "https://x402.payai.network/api/base/paid-content"
```

### Node.js / fetch

```javascript
import { ProxyAgent } from 'undici';

const agent = new ProxyAgent('http://127.0.0.1:8402');
const res = await fetch('https://x402.payai.network/api/base/paid-content', {
  dispatcher: agent,
});
// res.status === 200 — proxy handled the 402 + payment
```

### Environment variables (system-wide)

```bash
export HTTP_PROXY="http://127.0.0.1:8402"
export HTTPS_PROXY="http://127.0.0.1:8402"
export NODE_TLS_REJECT_UNAUTHORIZED=0  # needed for HTTPS MITM

# Now any tool that respects HTTP_PROXY will auto-pay x402 endpoints
curl https://x402.payai.network/api/base/paid-content
```

### Python / requests

```python
import requests

proxies = {"http": "http://127.0.0.1:8402", "https": "http://127.0.0.1:8402"}
r = requests.get("https://x402.payai.network/api/base/paid-content",
                  proxies=proxies, verify=False)
# r.status_code == 200
```

## CLI Reference

```bash
# Start proxy with auto-discovered CWP provider
npm run dev start

# Start with a specific provider
npm run dev start -- --wallet companion

# Start with session-constrained signing (companion-wallet spending limits)
npm run dev start -- --session <session-id>

# Start with custom options
npm run dev start -- --port 8402 --max-payment 100000 --host 127.0.0.1

# List available CWP providers
npm run dev list-wallets
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `-p, --port` | `8402` | Proxy listen port (env: `X402_PROXY_PORT`) |
| `-m, --max-payment` | `100000` | Max payment in smallest unit (env: `X402_MAX_PAYMENT`) |
| `--host` | `127.0.0.1` | Host to bind to |
| `-w, --wallet` | auto | CWP provider name |
| `-s, --session` | none | Companion-wallet session ID |

## Testing

### With the mock server

```bash
# Terminal 1: Start the mock x402 server
node test-server.mjs

# Terminal 2: Start the proxy
npm run dev start

# Terminal 3: Run tests
node test-server.mjs --test
```

The test suite verifies:
1. Direct request to mock server returns 402
2. Same request through proxy returns 200 (payment signed and accepted)
3. Same flow against the real PayAI endpoint (`x402.payai.network`)

## How the CWP Bridge Works

The core innovation is `cwp-signer.ts` — an adapter that implements the `ClientEvmSigner` interface (from `@x402/evm`) by delegating to `walletExec` from `@walletconnect/cli-sdk`:

```typescript
// @x402/evm expects: { address, signTypedData({domain, types, primaryType, message}) }
// CWP provides:      wallet-companion sign-typed-data < {account, typedData: {...}}

function createCwpSigner({ path, account, sessionId }): ClientEvmSigner {
  return {
    address: account,
    async signTypedData({ domain, types, primaryType, message }) {
      const result = await walletExec(path, "sign-typed-data", {
        account,
        typedData: { domain, types, primaryType, message },
        ...(sessionId && { sessionId }),
      });
      return result.signature;
    },
  };
}
```

This means any CWP-compatible wallet can sign x402 payments — not just `companion-wallet`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `X402_PROXY_PORT` | Default proxy port |
| `X402_MAX_PAYMENT` | Default max payment amount |
| `DEBUG` | Enable debug logging (verbose proxy + payment details) |
