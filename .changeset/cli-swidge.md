---
"@walletconnect/cli-sdk": minor
---

feat: add swidge (swap/bridge) command to WalletConnect CLI via LI.FI

New `walletconnect swidge` command for cross-chain bridging through the connected wallet.
Enhanced `send-transaction` to auto-detect insufficient ETH and offer to bridge from another chain.
Uses LI.FI REST API for quoting with zero new dependencies — transactions are sent through WalletConnect.
