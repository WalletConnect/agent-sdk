# @walletconnect/staking-cli

## 0.8.4

### Patch Changes

- Updated dependencies [[`d3f928d`](https://github.com/WalletConnect/agent-sdk/commit/d3f928d3769fa1cd3e8deb887e826399bab828ec)]:
  - @walletconnect/cli-sdk@0.8.4

## 0.8.3

### Patch Changes

- Updated dependencies [[`88b7bea`](https://github.com/WalletConnect/agent-sdk/commit/88b7bea75e7ae80339944afe93165091b3d8f179)]:
  - @walletconnect/cli-sdk@0.8.3

## 0.8.2

### Patch Changes

- Updated dependencies [[`f6c6025`](https://github.com/WalletConnect/agent-sdk/commit/f6c602542b3566b03bb2846968176aec0090a8e8)]:
  - @walletconnect/cli-sdk@0.8.2

## 0.8.1

### Patch Changes

- [#34](https://github.com/WalletConnect/agent-sdk/pull/34) [`6c8ed5f`](https://github.com/WalletConnect/agent-sdk/commit/6c8ed5f4602b40246860264cdc532e214da55f42) Thanks [@arein](https://github.com/arein)! - Fix balance display rounding up, causing full-balance stake to revert. `formatWCT` now truncates to 2 decimal places instead of rounding. `stake` checks on-chain balance before approving to avoid wasting gas.

- Updated dependencies []:
  - @walletconnect/cli-sdk@0.8.1

## 0.8.0

### Patch Changes

- Updated dependencies [[`79de3fe`](https://github.com/WalletConnect/agent-sdk/commit/79de3fe42f7678e895f17a72cb8b91e80a738397), [`7cc1cbe`](https://github.com/WalletConnect/agent-sdk/commit/7cc1cbe9b51ce5d94e81b632d1834d11e9c5c5ce)]:
  - @walletconnect/cli-sdk@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies []:
  - @walletconnect/cli-sdk@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies []:
  - @walletconnect/cli-sdk@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies [[`b8204f8`](https://github.com/WalletConnect/agent-sdk/commit/b8204f86d77a7b05f3d1f7e55522c0172949ac74)]:
  - @walletconnect/cli-sdk@0.5.1

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
