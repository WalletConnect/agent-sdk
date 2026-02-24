---
"@walletconnect/cli-sdk": minor
"@walletconnect/staking-cli": major
"@anthropic-ai/wallet-cli": minor
---

Migrate staking-cli from WalletConnect SDK to CLI Wallet Protocol (CWP).

**cli-sdk**: Add send-transaction command, --chain flag for connect, --json flag for whoami, wallet-walletconnect CWP adapter binary, and move log output to stderr for protocol cleanliness.

**staking-cli** (BREAKING): Replace WalletConnectCLI dependency with CWP-based wallet discovery via @anthropic-ai/wallet-cli. Commands stake/unstake/claim now accept WalletSender interface instead of WalletConnectCLI. Remove --browser flag, add --wallet flag. status/balance now require --address flag. Remove CLI_METADATA export.

**wallet-cli**: Add selectProvider() for interactive wallet selection with capability/chain filtering and namespace-level chain matching.
