---
"@walletconnect/staking-cli": patch
---

Fix balance display rounding up, causing full-balance stake to revert. `formatWCT` now truncates to 2 decimal places instead of rounding. `stake` checks on-chain balance before approving to avoid wasting gas.
