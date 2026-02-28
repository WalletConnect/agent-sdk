# @walletconnect/staking-cli

## 0.5.0

### Patch Changes

- [#20](https://github.com/WalletConnect/agent-sdk/pull/20) [`48eb0f5`](https://github.com/WalletConnect/agent-sdk/commit/48eb0f587221b4f87e7fa41e39e4e598dfd09d92) Thanks [@arein](https://github.com/arein)! - Add --version flag to all CLIs (walletconnect, wallet, walletconnect-staking)

- Updated dependencies [[`48eb0f5`](https://github.com/WalletConnect/agent-sdk/commit/48eb0f587221b4f87e7fa41e39e4e598dfd09d92), [`d8ebd99`](https://github.com/WalletConnect/agent-sdk/commit/d8ebd993ba2107f6df7ee3652f771c1240157a88)]:
  - @walletconnect/cli-sdk@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [[`f14eb4d`](https://github.com/WalletConnect/agent-sdk/commit/f14eb4dbc93efdf24a0e38d6866616187c8e25d0)]:
  - @walletconnect/cli-sdk@0.4.0

## 0.3.0

### Minor Changes

- [#13](https://github.com/WalletConnect/agent-sdk/pull/13) [`b292a59`](https://github.com/WalletConnect/agent-sdk/commit/b292a59109cd4c45835929be8f68747c0013ad75) Thanks [@arein](https://github.com/arein)! - Migrate staking-cli from WalletConnect SDK to CLI Wallet Protocol (CWP).

  **cli-sdk**: Add send-transaction command, --chain flag for connect, --json flag for whoami, wallet-walletconnect CWP adapter binary, move log output to stderr for protocol cleanliness, and absorb CWP discovery/exec/select modules (previously @anthropic-ai/wallet-cli) under src/cwp/.

  **staking-cli** (BREAKING): Replace WalletConnectCLI dependency with CWP-based wallet discovery via @walletconnect/cli-sdk. Commands stake/unstake/claim now accept WalletSender interface instead of WalletConnectCLI. Remove --browser flag, add --wallet flag. status/balance now require --address flag. Remove CLI_METADATA export.

### Patch Changes

- Updated dependencies [[`b292a59`](https://github.com/WalletConnect/agent-sdk/commit/b292a59109cd4c45835929be8f68747c0013ad75)]:
  - @walletconnect/cli-sdk@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [[`45b8345`](https://github.com/WalletConnect/agent-sdk/commit/45b83452d5647790dd90b601a9f48c7e705de102)]:
  - @walletconnect/cli-sdk@0.2.0

## 0.1.2

### Patch Changes

- [#9](https://github.com/WalletConnect/agent-sdk/pull/9) [`f9eed1c`](https://github.com/WalletConnect/agent-sdk/commit/f9eed1c78d8b7aebee386ca322ae1b3179982e54) Thanks [@arein](https://github.com/arein)! - Validate remaining lock time before calling increaseLockAmount — shows a clear error when lock expires in less than 1 week instead of sending a transaction that reverts on-chain

- Updated dependencies []:
  - @walletconnect/cli-sdk@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [[`899efda`](https://github.com/WalletConnect/agent-sdk/commit/899efda8f7cc5d78f226a699c5f6ba7ed6ff8686)]:
  - @walletconnect/cli-sdk@0.1.1
