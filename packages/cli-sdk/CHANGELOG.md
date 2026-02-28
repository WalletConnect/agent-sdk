# @walletconnect/cli-sdk

## 0.5.0

### Minor Changes

- [#18](https://github.com/WalletConnect/agent-sdk/pull/18) [`d8ebd99`](https://github.com/WalletConnect/agent-sdk/commit/d8ebd993ba2107f6df7ee3652f771c1240157a88) Thanks [@arein](https://github.com/arein)! - Add Solana chain support: multi-namespace connect, solana_signTransaction, and companion wallet Solana transaction handling

### Patch Changes

- [#20](https://github.com/WalletConnect/agent-sdk/pull/20) [`48eb0f5`](https://github.com/WalletConnect/agent-sdk/commit/48eb0f587221b4f87e7fa41e39e4e598dfd09d92) Thanks [@arein](https://github.com/arein)! - Add --version flag to all CLIs (walletconnect, wallet, walletconnect-staking)

## 0.4.0

### Patch Changes

- [#16](https://github.com/WalletConnect/agent-sdk/pull/16) [`f14eb4d`](https://github.com/WalletConnect/agent-sdk/commit/f14eb4dbc93efdf24a0e38d6866616187c8e25d0) Thanks [@arein](https://github.com/arein)! - Add WCT token to companion-wallet registry, balance CWP operation, and fix disconnect timeout.

  **companion-wallet**: Add WCT token on Optimism (eip155:10), add `balance` operation that returns native ETH + registered ERC-20 balances, export new `getTokenBalance`/`getBalances` functions and balance types.

  **cli-sdk**: Time-box relay disconnect (5s) and transport close (3s) to prevent 30s+ hangs after transactions complete.

## 0.3.0

### Minor Changes

- [#13](https://github.com/WalletConnect/agent-sdk/pull/13) [`b292a59`](https://github.com/WalletConnect/agent-sdk/commit/b292a59109cd4c45835929be8f68747c0013ad75) Thanks [@arein](https://github.com/arein)! - Migrate staking-cli from WalletConnect SDK to CLI Wallet Protocol (CWP).

  **cli-sdk**: Add send-transaction command, --chain flag for connect, --json flag for whoami, wallet-walletconnect CWP adapter binary, move log output to stderr for protocol cleanliness, and absorb CWP discovery/exec/select modules (previously @anthropic-ai/wallet-cli) under src/cwp/.

  **staking-cli** (BREAKING): Replace WalletConnectCLI dependency with CWP-based wallet discovery via @walletconnect/cli-sdk. Commands stake/unstake/claim now accept WalletSender interface instead of WalletConnectCLI. Remove --browser flag, add --wallet flag. status/balance now require --address flag. Remove CLI_METADATA export.

## 0.2.0

### Minor Changes

- [#11](https://github.com/WalletConnect/agent-sdk/pull/11) [`45b8345`](https://github.com/WalletConnect/agent-sdk/commit/45b83452d5647790dd90b601a9f48c7e705de102) Thanks [@arein](https://github.com/arein)! - Add sign-typed-data command for EIP-712 signing, --json flag for whoami, and move status messages to stderr

## 0.1.2

## 0.1.1

### Patch Changes

- [#6](https://github.com/WalletConnect/agent-sdk/pull/6) [`899efda`](https://github.com/WalletConnect/agent-sdk/commit/899efda8f7cc5d78f226a699c5f6ba7ed6ff8686) Thanks [@arein](https://github.com/arein)! - Fix disconnect and whoami commands failing with "WebSocket Unauthorized: invalid key" by passing the configured project ID to the SDK instead of an empty string
