# WalletConnect Agent SDK

> **Beta (v0.1.x)** — This project is under active development. APIs and CLI interfaces may change between releases. Not yet recommended for production use.

Monorepo for WalletConnect agent tooling — CLI tools and libraries for wallet connection, message signing, and WCT staking from the terminal.

## Packages

| Package | Binary | Description |
|---------|--------|-------------|
| [`@walletconnect/cli-sdk`](packages/cli-sdk/) | `walletconnect` | Wallet connection and signing for terminal applications |
| [`@walletconnect/staking-cli`](packages/staking-cli/) | `walletconnect-staking` | WCT staking on Optimism (stake, unstake, claim rewards) |

## Quick Start

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

## `walletconnect` CLI

Connect a wallet, sign messages, and manage sessions.

```
Usage: walletconnect <command> [options]

Commands:
  connect              Connect to a wallet via QR code
  whoami               Show current session info
  sign <message>       Sign a message with the connected wallet
  disconnect           Disconnect the current session
  config set <k> <v>   Set a config value (e.g. project-id)
  config get <k>       Get a config value

Options:
  --browser            Use browser UI instead of terminal QR code
  --help               Show this help message
```

### Examples

```bash
# Connect a wallet (shows QR code in terminal)
walletconnect connect

# Connect using a browser-based QR code
walletconnect connect --browser

# Sign a message
walletconnect sign "Hello from the terminal"

# Check connected wallet
walletconnect whoami

# Disconnect
walletconnect disconnect
```

## `walletconnect-staking` CLI

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

### Examples

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

## Programmatic Usage

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

## Agent Skills

Install the accompanying Claude Code / agent skills for interactive wallet and staking workflows:

```bash
npx skills add WalletConnect/agent-sdk
```

## Development

```bash
npm install
npm run build          # Build all packages (via Turborepo)
npm run test           # Run all tests (61 total)
npm run lint           # Lint all packages
```

### Contributing

Every PR that changes package behavior must include a **changeset**:

```bash
npm run changeset      # Interactive — select packages, bump type, description
```

This creates a `.changeset/<name>.md` file. Commit it with your PR. On merge, the [changesets action](https://github.com/changesets/changesets/tree/main/packages/action) opens a version PR, and merging that publishes to npm.

## License

[WalletConnect Community License](LICENSE.md)
