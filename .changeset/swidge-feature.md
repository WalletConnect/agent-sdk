---
"@walletconnect/companion-wallet": minor
"@walletconnect/cli-sdk": minor
---

feat: add swidge (swap/bridge) functionality via LI.FI SDK

Companion wallet now auto-detects insufficient funds before sending transactions
and seamlessly bridges from another chain using LI.FI. In TTY mode, prompts for
confirmation. In pipe/agent mode, auto-bridges.

New CLI operation: `companion-wallet swidge` for manual cross-chain bridging.
WalletConnect CLI now warns when target account has insufficient funds.
