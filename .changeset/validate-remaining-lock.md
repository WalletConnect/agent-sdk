---
"@walletconnect/staking-cli": patch
---

Validate remaining lock time before calling increaseLockAmount — shows a clear error when lock expires in less than 1 week instead of sending a transaction that reverts on-chain
