---
"@walletconnect/cli-sdk": patch
---

Fix disconnect and whoami commands failing with "WebSocket Unauthorized: invalid key" by passing the configured project ID to the SDK instead of an empty string
