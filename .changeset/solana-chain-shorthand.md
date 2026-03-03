---
"@walletconnect/cli-sdk": patch
---

Fix shorthand chain name resolution (`--chain solana`, `--chain evm`) in WalletConnect connect. Chain aliases now resolve to CAIP-2 identifiers before building session namespaces. Expanded `evm` alias to top 20 EVM networks.
