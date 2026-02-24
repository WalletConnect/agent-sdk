---
"@walletconnect/companion-wallet": minor
"@walletconnect/cli-sdk": patch
---

Add WCT token to companion-wallet registry, balance CWP operation, and fix disconnect timeout.

**companion-wallet**: Add WCT token on Optimism (eip155:10), add `balance` operation that returns native ETH + registered ERC-20 balances, export new `getTokenBalance`/`getBalances` functions and balance types.

**cli-sdk**: Time-box relay disconnect (5s) and transport close (3s) to prevent 30s+ hangs after transactions complete.
