---
name: walletconnect
description: Manages the walletconnect CLI for wallet connection, session management, message signing, transaction sending, and cross-chain bridging (swidge). Use when the user wants to connect a wallet, check session status, sign messages, send transactions, bridge tokens across chains, or disconnect.
---

# WalletConnect CLI

## Goal

Operate the `walletconnect` CLI binary to connect wallets via QR code, inspect sessions, sign messages, send transactions, bridge/swap tokens across chains (swidge), and disconnect.

## When to use

- User asks to connect a wallet or scan a QR code
- User asks to check which wallet is connected (`whoami`)
- User asks to sign a message with their wallet
- User asks to sign EIP-712 typed data
- User asks to send a transaction with their wallet
- User asks to bridge or swap tokens across chains
- User asks to disconnect their wallet session
- User mentions `walletconnect` CLI in context of wallet operations

## When not to use

- User wants to stake, unstake, or claim WCT rewards (use `walletconnect-staking` skill)
- User wants to create or checkout WalletConnect Pay payments (use `walletconnect-pay` skill)
- User is working on the SDK source code itself (just edit normally)

## Prerequisites

- Project ID must be configured (see below) for `connect`, `sign`, `send-transaction`, and `swidge` commands
- Binary is at `packages/cli-sdk/dist/cli.js` (or globally linked as `walletconnect`)
- Build first if needed: `npm run build -w @walletconnect/cli-sdk`

## Project ID configuration

The project ID is resolved in this order: `WALLETCONNECT_PROJECT_ID` env var > `~/.walletconnect-cli/config.json`.

```bash
# Set globally (persists across sessions)
walletconnect config set project-id <id>

# Check current value
walletconnect config get project-id

# Or override per-command via env var
WALLETCONNECT_PROJECT_ID=<id> walletconnect connect
```

## Commands

```bash
# Connect a wallet (displays QR code in terminal)
walletconnect connect

# Connect via browser UI instead of terminal QR
walletconnect connect --browser

# Connect with specific chain
walletconnect connect --chain eip155:10

# Check current session
walletconnect whoami
walletconnect whoami --json

# Sign a message
walletconnect sign "Hello, World!"

# Sign EIP-712 typed data
walletconnect sign-typed-data '{"types":...}'

# Send a transaction (EVM)
walletconnect send-transaction '{"to":"0x...","value":"0x...","data":"0x..."}'

# Send a transaction on a specific chain
walletconnect send-transaction '{"to":"0x...","value":"0x...","chainId":"eip155:10"}'

# Send a Solana transaction
walletconnect send-transaction '{"transaction":"base64...","chainId":"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"}'

# Bridge/swap tokens across chains (swidge)
walletconnect swidge --from-chain eip155:10 --to-chain eip155:1 --from-token WCT --to-token WCT --amount 5

# Disconnect
walletconnect disconnect

# Manage config
walletconnect config set project-id <value>
walletconnect config get project-id
```

## Swidge (cross-chain bridge/swap)

The `swidge` command bridges or swaps tokens across chains via [LI.FI](https://li.fi). It uses the connected wallet to approve and execute the bridge transaction.

### Required flags
- `--from-chain <id>` — Source chain (CAIP-2, e.g. `eip155:8453`)
- `--to-chain <id>` — Destination chain (CAIP-2, e.g. `eip155:10`)
- `--amount <n>` — Amount to bridge (human-readable, e.g. `5`, `0.1`)

### Optional flags
- `--from-token <sym>` — Source token symbol (default: `ETH`)
- `--to-token <sym>` — Destination token symbol (default: `ETH`)

### Auto-bridge in send-transaction

When using `send-transaction`, the CLI automatically checks if the connected wallet has sufficient ETH on the target chain. If insufficient, it:
- In TTY mode: prompts the user to bridge from another chain
- In pipe/agent mode: auto-bridges from the chain with the most funds

### Swidge examples

```bash
# Bridge 5 WCT from Optimism to Ethereum mainnet
walletconnect swidge --from-chain eip155:10 --to-chain eip155:1 --from-token WCT --to-token WCT --amount 5

# Swap USDC on Base to ETH on Optimism
walletconnect swidge --from-chain eip155:8453 --to-chain eip155:10 --from-token USDC --to-token ETH --amount 10

# Bridge ETH from Ethereum to Base
walletconnect swidge --from-chain eip155:1 --to-chain eip155:8453 --amount 0.01
```

## Default workflow

1. Check project ID is configured: `walletconnect config get project-id`
2. Check if a session exists: `walletconnect whoami`
3. If not connected, connect: `walletconnect connect`
4. Perform the requested operation (sign, send-transaction, swidge, etc.)
5. If done, optionally disconnect: `walletconnect disconnect`

## Important notes

- The `connect` and `sign` commands require a project ID — set it with `walletconnect config set project-id <id>` if not configured
- Sessions persist across invocations in `~/.walletconnect-cli/`
- `sign`, `send-transaction`, and `swidge` auto-connect if no session exists
- The `--browser` flag opens a local web page with the QR code instead of rendering in terminal
- Always use a 60s+ timeout for commands that require wallet interaction (QR scan, signing, bridging)
- `connect` defaults to all EVM chains when no `--chain` flag is specified
- `swidge` requires token approval for ERC-20 tokens (handled automatically — user confirms in wallet)
- Cross-chain bridges typically take 1-5 minutes for funds to arrive on the destination chain
- `send-transaction` output goes to stdout as JSON; status/progress goes to stderr

## Validation checklist

- [ ] Project ID is configured (`walletconnect config get project-id`)
- [ ] Binary is built and linked (`walletconnect --help` works)
- [ ] Command output is shown to the user
- [ ] Timeouts are sufficient for wallet interaction (60s+)
- [ ] For swidge: `--from-chain`, `--to-chain`, and `--amount` are all provided

## Examples

### Check session status
```
User: "Am I connected to a wallet?"
Action: Run `walletconnect whoami`
```

### Sign a message
```
User: "Sign the message 'verify-ownership' with my wallet"
Action: Run `walletconnect sign "verify-ownership"`
Note: Inform user to confirm in their wallet app
```

### Send a transaction
```
User: "Send 0.01 ETH to 0xABC... on Optimism"
Action: Run `walletconnect send-transaction '{"to":"0xABC...","value":"0x2386F26FC10000","chainId":"eip155:10"}'`
Note: Inform user to confirm in their wallet app. Auto-bridges ETH if insufficient.
```

### Bridge tokens
```
User: "Bridge 5 WCT from Optimism to mainnet"
Action: Run `walletconnect swidge --from-chain eip155:10 --to-chain eip155:1 --from-token WCT --to-token WCT --amount 5`
Note: May send 2 transactions (approve + bridge). Inform user to confirm each. Funds arrive in 1-5 min.
```
