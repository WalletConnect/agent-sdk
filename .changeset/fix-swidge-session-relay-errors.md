---
"@walletconnect/cli-sdk": patch
---

Fix swidge NO_MATCHING_KEY error by only requiring source chain in session namespaces, and prevent unhandled relay errors from crashing Node during wallet request rejection/timeout
