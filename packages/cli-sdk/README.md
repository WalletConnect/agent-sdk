# @walletconnect/cli-sdk

Wallet connection and transaction signing for CLI applications, powered by the WalletConnect protocol.

## Quick Start

```typescript
import { WalletConnectCLI } from "@walletconnect/cli-sdk";

const wc = new WalletConnectCLI({
  projectId: "your-walletconnect-cloud-project-id",
  metadata: {
    name: "My CLI Tool",
    description: "A command-line DeFi tool",
    url: "https://example.com",
    icons: [],
  },
});

// Connect — shows QR in terminal (instant if session exists)
const { accounts } = await wc.connect();
const address = accounts[0].split(":")[2];

// Request signature
const txHash = await wc.request({
  chainId: "eip155:1",
  request: {
    method: "eth_sendTransaction",
    params: [{ from: address, to: "0x...", value: "0x0", data: "0x..." }],
  },
});

// Disconnect when done
await wc.disconnect();
```

## `withWallet` Helper

For the common connect → do work → cleanup pattern:

```typescript
import { withWallet } from "@walletconnect/cli-sdk";

await withWallet({ projectId: "...", metadata: { ... } }, async (wallet, { accounts }) => {
  const address = accounts[0].split(":")[2];
  const txHash = await wallet.request({
    chainId: "eip155:1",
    request: {
      method: "eth_sendTransaction",
      params: [{ from: address, to: "0x...", value: "0x0" }],
    },
  });
  console.log("TX:", txHash);
});
// Automatically disconnects and cleans up
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectId` | `string` | **required** | WalletConnect Cloud project ID |
| `metadata` | `Metadata` | **required** | App metadata (name, description, url, icons) |
| `chains` | `string[]` | `['eip155:1']` | CAIP-2 chain IDs to request |
| `methods` | `string[]` | EVM defaults | JSON-RPC methods to request |
| `events` | `string[]` | `['chainChanged', 'accountsChanged']` | Events to subscribe to |
| `ui` | `'terminal' \| 'browser'` | `'terminal'` | Connection UI mode |
| `port` | `number` | auto | Port for browser UI server |
| `storagePath` | `string` | `~/.walletconnect-cli/` | Session storage directory |
| `autoConnect` | `boolean` | `true` | Auto-restore previous session |
| `logger` | `'info' \| 'debug' \| 'silent'` | `'silent'` | Log verbosity |

## Browser UI Mode

For a richer connection experience, use browser mode:

```typescript
const wc = new WalletConnectCLI({
  projectId: "...",
  metadata: { ... },
  ui: "browser",
});

// Opens http://localhost:<port> with styled QR code
const { accounts } = await wc.connect();
```

The browser page displays a QR code, updates via SSE when connected, and auto-closes.

## Events

```typescript
wc.on("connect", ({ session, accounts, topic }) => { ... });
wc.on("disconnect", () => { ... });
wc.on("session_update", (session) => { ... });
wc.on("session_delete", ({ topic }) => { ... });
```

## API

### `new WalletConnectCLI(options)`

Creates a new CLI SDK instance. No async work happens in the constructor.

### `wc.connect(options?): Promise<ConnectResult>`

Connects to a wallet. If a valid session exists, returns immediately. Otherwise displays QR code and waits for wallet approval.

### `wc.request<T>(options): Promise<T>`

Sends a JSON-RPC request to the connected wallet.

### `wc.disconnect(): Promise<void>`

Disconnects the current session. Silently succeeds if no session is active.

### `wc.isConnected(): boolean`

Returns whether a valid session is active.

### `wc.getAccounts(): string[]`

Returns CAIP-10 account IDs from the current session.

### `wc.getSession(): SessionTypes.Struct | null`

Returns the raw session object.

### `wc.destroy(): Promise<void>`

Cleans up all resources (browser server, listeners, client references).
