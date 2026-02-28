# @walletconnect/companion-wallet

## 0.5.0

### Patch Changes

- Updated dependencies [[`48eb0f5`](https://github.com/WalletConnect/agent-sdk/commit/48eb0f587221b4f87e7fa41e39e4e598dfd09d92), [`d8ebd99`](https://github.com/WalletConnect/agent-sdk/commit/d8ebd993ba2107f6df7ee3652f771c1240157a88)]:
  - @walletconnect/cli-sdk@0.5.0

## 0.4.0

### Minor Changes

- [#16](https://github.com/WalletConnect/agent-sdk/pull/16) [`f14eb4d`](https://github.com/WalletConnect/agent-sdk/commit/f14eb4dbc93efdf24a0e38d6866616187c8e25d0) Thanks [@arein](https://github.com/arein)! - Add WCT token to companion-wallet registry, balance CWP operation, and fix disconnect timeout.

  **companion-wallet**: Add WCT token on Optimism (eip155:10), add `balance` operation that returns native ETH + registered ERC-20 balances, export new `getTokenBalance`/`getBalances` functions and balance types.

  **cli-sdk**: Time-box relay disconnect (5s) and transport close (3s) to prevent 30s+ hangs after transactions complete.

### Patch Changes

- Updated dependencies [[`f14eb4d`](https://github.com/WalletConnect/agent-sdk/commit/f14eb4dbc93efdf24a0e38d6866616187c8e25d0)]:
  - @walletconnect/cli-sdk@0.4.0

## 0.3.0

### Minor Changes

- [#13](https://github.com/WalletConnect/agent-sdk/pull/13) [`b292a59`](https://github.com/WalletConnect/agent-sdk/commit/b292a59109cd4c45835929be8f68747c0013ad75) Thanks [@arein](https://github.com/arein)! - Add companion wallet (beta) CWP provider with local key generation, AES-256-GCM encryption, signing (message, typed data, transaction), transaction broadcast via viem, session management with policy enforcement, fund command (transfer ETH from external wallet via WalletConnect), and drain command (sweep native tokens to destination)

### Patch Changes

- Updated dependencies [[`b292a59`](https://github.com/WalletConnect/agent-sdk/commit/b292a59109cd4c45835929be8f68747c0013ad75)]:
  - @walletconnect/cli-sdk@0.3.0
