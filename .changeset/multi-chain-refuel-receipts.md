---
"@walletconnect/cli-sdk": patch
---

Add multi-chain gas support, automatic refuel, and on-chain receipt verification

- Expand EVM chain support from 3 to 8 chains with per-chain gasToken and gasCost rankings
- Add automatic destination gas refuel before cross-chain bridges
- Add on-chain receipt verification after send-transaction (confirmed/reverted)
- Export rpcUrl, waitForReceipt, and TxReceipt for downstream CLI consumers
- Add Hyperliquid (HyperEVM) to default EVM chain aliases
