# @walletconnect/companion-wallet

## 0.8.1

### Patch Changes

- Updated dependencies []:
  - @walletconnect/cli-sdk@0.8.1

## 0.8.0

### Minor Changes

- [#30](https://github.com/WalletConnect/agent-sdk/pull/30) [`7cc1cbe`](https://github.com/WalletConnect/agent-sdk/commit/7cc1cbe9b51ce5d94e81b632d1834d11e9c5c5ce) Thanks [@arein](https://github.com/arein)! - feat: add swidge (swap/bridge) functionality via LI.FI SDK

  Companion wallet now auto-detects insufficient funds before sending transactions
  and seamlessly bridges from another chain using LI.FI. In TTY mode, prompts for
  confirmation. In pipe/agent mode, auto-bridges.

  New CLI operation: `companion-wallet swidge` for manual cross-chain bridging.
  WalletConnect CLI now warns when target account has insufficient funds.

### Patch Changes

- Updated dependencies [[`79de3fe`](https://github.com/WalletConnect/agent-sdk/commit/79de3fe42f7678e895f17a72cb8b91e80a738397), [`7cc1cbe`](https://github.com/WalletConnect/agent-sdk/commit/7cc1cbe9b51ce5d94e81b632d1834d11e9c5c5ce)]:
  - @walletconnect/cli-sdk@0.8.0

## 0.7.0

### Minor Changes

- [#27](https://github.com/WalletConnect/agent-sdk/pull/27) [`b596c82`](https://github.com/WalletConnect/agent-sdk/commit/b596c82cb0feeda02aa6dcf5bbe8ea6a46c16ea5) Thanks [@arein](https://github.com/arein)! - Add audit log and history operation for companion wallet

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
