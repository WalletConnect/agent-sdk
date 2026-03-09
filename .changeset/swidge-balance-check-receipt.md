---
"@walletconnect/cli-sdk": patch
---

Add pre-flight balance check before swidge (errors early with "Insufficient balance: have X, need Y") and on-chain tx receipt confirmation (polls eth_getTransactionReceipt instead of treating submission as confirmation)
