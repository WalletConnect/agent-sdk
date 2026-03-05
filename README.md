# 🔗 WalletConnect Agent SDK

> **Beta (v0.1.x)** — This project is under active development. APIs and CLI interfaces may change between releases. Not yet recommended for production use.

Monorepo for WalletConnect agent tooling — CLI tools and libraries for wallet connection, message signing, cross-chain bridging, and WCT staking from the terminal.

### 🤖 Agent Skills

Install the accompanying Claude Code / agent skills:

```bash
npx skills add WalletConnect/agent-sdk
```

## 📦 Packages

| Package | Binary | Description |
|---------|--------|-------------|
| [`@walletconnect/cli-sdk`](packages/cli-sdk/) | `walletconnect` | 🔑 Wallet connection, signing, and cross-chain swidge for terminal apps |
| [`@walletconnect/staking-cli`](packages/staking-cli/) | `walletconnect-staking` | 📈 WCT staking on Optimism (stake, unstake, claim rewards) |
| [`@walletconnect/pay-cli`](packages/pay-cli/) | `walletconnect-pay` | 💳 **Experimental** — WalletConnect Pay payments from the terminal |

## 🚀 Quick Start

### Install globally

```bash
npm install -g @walletconnect/cli-sdk @walletconnect/staking-cli
```

### Configure your project ID

Get a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com), then:

```bash
walletconnect config set project-id <your-project-id>
```

Or set the environment variable:

```bash
export WALLETCONNECT_PROJECT_ID=<your-project-id>
```

## 🔑 `walletconnect` CLI

Connect a wallet, sign messages, send transactions, and bridge tokens across chains.

```
Usage: walletconnect <command> [options]

Commands:
  connect                       Connect to a wallet via QR code
  whoami                        Show current session info
  sign <message>                Sign a message with the connected wallet
  sign-typed-data <json>        Sign EIP-712 typed data (JSON string)
  send-transaction <json>       Send a transaction (EVM or Solana)
  swidge                        Bridge/swap tokens across chains via LI.FI
  disconnect                    Disconnect the current session
  config set <k> <v>            Set a config value (e.g. project-id)
  config get <k>                Get a config value

Options:
  --browser            Use browser UI instead of terminal QR code
  --json               Output as JSON (for whoami)
  --chain <id>         Specify chain (e.g. evm, solana, eip155:10) for connect
  --version            Show version number
  --help               Show this help message
```

### 💬 Examples

```bash
# Connect a wallet (shows QR code in terminal)
walletconnect connect

# Connect using a browser-based QR code
walletconnect connect --browser

# Sign a message
walletconnect sign "Hello from the terminal"

# Check connected wallet
walletconnect whoami

# Send a transaction on Optimism
walletconnect send-transaction '{"to":"0x...","value":"0x0","chainId":"eip155:10"}'

# Disconnect
walletconnect disconnect
```

## 🔀 Swidge (Cross-Chain Bridge/Swap)

Bridge or swap tokens across EVM chains, powered by [LI.FI](https://li.fi). The connected wallet approves and executes each transaction.

```
Swidge options:
  --from-chain <id>    Source chain (e.g. eip155:8453)
  --to-chain <id>      Destination chain (e.g. eip155:10)
  --from-token <sym>   Source token symbol (e.g. ETH, USDC)
  --to-token <sym>     Destination token symbol (e.g. ETH, WCT)
  --amount <n>         Amount to bridge (human-readable)
```

### 🌉 Swidge examples

```bash
# Bridge 5 WCT from Optimism to Ethereum mainnet
walletconnect swidge --from-chain eip155:10 --to-chain eip155:1 \
  --from-token WCT --to-token WCT --amount 5

# Swap USDC on Base to ETH on Optimism
walletconnect swidge --from-chain eip155:8453 --to-chain eip155:10 \
  --from-token USDC --to-token ETH --amount 10

# Bridge ETH from Ethereum to Base
walletconnect swidge --from-chain eip155:1 --to-chain eip155:8453 \
  --amount 0.01
```

### ⚡ Auto-bridge in `send-transaction`

When sending a transaction, the CLI automatically checks if the connected wallet has sufficient ETH on the target chain. If funds are insufficient:

- **Interactive (TTY)**: Prompts you to bridge from another chain
- **Pipe/agent mode**: Auto-bridges from the chain with the most funds

This means agents can seamlessly execute transactions across chains without worrying about which chain has funds.

## 📈 `walletconnect-staking` CLI

Stake WCT tokens on Optimism, check staking positions, and claim rewards.

```
Usage: walletconnect-staking <command> [options]

Commands:
  stake <amount> <weeks>   Stake WCT (approve + createLock/updateLock)
  unstake                  Withdraw all staked WCT (after lock expires)
  claim                    Claim staking rewards
  status                   Show staking position, rewards, and APY
  balance                  Show WCT token balance

Options:
  --address=0x...          Use address directly (for read-only commands)
  --browser                Use browser UI for wallet connection
  --help                   Show this help message
```

### 💰 Examples

```bash
# Stake 1000 WCT for 52 weeks
walletconnect-staking stake 1000 52

# Check staking position and rewards (read-only, no wallet needed)
walletconnect-staking status --address=0x...

# Check WCT balance
walletconnect-staking balance --address=0x...

# Claim staking rewards (requires wallet)
walletconnect-staking claim

# Withdraw all staked WCT (after lock expires)
walletconnect-staking unstake
```

## 💳 `walletconnect-pay` CLI (Experimental)

> **⚠️ Experimental** — This package is under active development. APIs, commands, and behavior may change significantly between releases.

Create and complete WalletConnect Pay payments from the terminal. Supports proxy mode (no API keys needed) and direct API mode.

```
Usage: walletconnect-pay <command> [options]

Commands:
  status <paymentId>     Check the status of a payment
  create <amount>        Create a new payment (merchant credentials required)
  checkout <paymentId>   Complete a payment using a connected wallet

Options:
  --staging              Use the staging API
  --proxy                Proxy through frontend (no API keys needed)
  --help                 Show this help message
```

### 🔐 Authentication

By default, the CLI proxies through the WalletConnect Pay frontend — no API keys needed. For direct API access, set environment variables:

```bash
# Required for direct API calls
export WC_PAY_WALLET_API_KEY=<wallet-api-key>

# Required for merchant operations (create)
export WC_PAY_PARTNER_API_KEY=<partner-api-key>
export WC_PAY_MERCHANT_ID=<merchant-id>
```

### 🛂 Travel Rule compliance

Some payments require Information Capture data. Provide via CLI flags or environment variables:

```bash
# Via CLI flags
walletconnect-pay checkout <id> --name "John Doe" --dob "1990-01-15" \
  --pob-country "US" --pob-address "New York, NY"

# Or via environment variables
export WC_PAY_NAME="John Doe"
export WC_PAY_DOB="1990-01-15"
export WC_PAY_POB_COUNTRY="US"
export WC_PAY_POB_ADDRESS="New York, NY"
```

### 💳 Examples

```bash
# Check a payment's status
walletconnect-pay status pay_abc123 --staging

# Create a $10 payment (1000 = minor units / cents)
walletconnect-pay create 1000 --staging

# Complete a payment with a connected wallet
walletconnect-pay checkout pay_abc123 --staging
```

## 🧑‍💻 Programmatic Usage

### `@walletconnect/cli-sdk`

```typescript
import { WalletConnectCLI, withWallet } from "@walletconnect/cli-sdk";

// Option 1: High-level helper (connect → use → cleanup)
await withWallet(
  {
    projectId: "your-project-id",
    metadata: { name: "My App", description: "...", url: "...", icons: [] },
  },
  async (wallet, { accounts }) => {
    const txHash = await wallet.request({
      chainId: "eip155:1",
      request: {
        method: "eth_sendTransaction",
        params: [{ from: accounts[0].split(":").pop(), to: "0x...", value: "0x0" }],
      },
    });
  },
);

// Option 2: Direct client usage
const wallet = new WalletConnectCLI({
  projectId: "your-project-id",
  metadata: { name: "My App", description: "...", url: "...", icons: [] },
  chains: ["eip155:1", "eip155:10"],
  ui: "browser", // or "terminal" (default)
});

const { accounts, topic } = await wallet.connect();
const signature = await wallet.request({
  chainId: "eip155:1",
  request: { method: "personal_sign", params: ["0x48656c6c6f", accounts[0]] },
});
await wallet.disconnect();
await wallet.destroy();
```

### `@walletconnect/staking-cli`

```typescript
import { stake, status, balance, fetchStaking, formatWCT } from "@walletconnect/staking-cli";
```

The staking package exports transaction builders, formatting utilities, and API helpers for building custom staking integrations.

### `@walletconnect/pay-cli` (Experimental)

```typescript
import { createPayClient, createFrontendPayClient } from "@walletconnect/pay-cli";

// Direct API client
const client = createPayClient({
  walletApiKey: "your-wallet-api-key",
  sdkVersion: "0.5.0",
  staging: true,
});

// Or proxy through the frontend (no API keys needed)
const proxyClient = createFrontendPayClient({
  frontendUrl: "https://staging.pay.walletconnect.com",
});

const payment = await client.getPayment("pay_abc123");
```

> **⚠️ Experimental** — The `@walletconnect/pay-cli` programmatic API is not yet stable.

## 🛠️ Development

```bash
npm install
npm run build          # Build all packages (via Turborepo)
npm run test           # Run all tests
npm run lint           # Lint all packages
```

### 📝 Contributing

Every PR that changes package behavior must include a **changeset**:

```bash
npm run changeset      # Interactive — select packages, bump type, description
```

This creates a `.changeset/<name>.md` file. Commit it with your PR. On merge, the [changesets action](https://github.com/changesets/changesets/tree/main/packages/action) opens a version PR, and merging that publishes to npm.

## 📄 License

[WalletConnect Community License](LICENSE.md)
