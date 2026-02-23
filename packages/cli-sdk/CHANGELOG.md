# @walletconnect/cli-sdk

## 0.2.0

### Minor Changes

- [#11](https://github.com/WalletConnect/agent-sdk/pull/11) [`45b8345`](https://github.com/WalletConnect/agent-sdk/commit/45b83452d5647790dd90b601a9f48c7e705de102) Thanks [@arein](https://github.com/arein)! - Add sign-typed-data command for EIP-712 signing, --json flag for whoami, and move status messages to stderr

## 0.1.2

## 0.1.1

### Patch Changes

- [#6](https://github.com/WalletConnect/agent-sdk/pull/6) [`899efda`](https://github.com/WalletConnect/agent-sdk/commit/899efda8f7cc5d78f226a699c5f6ba7ed6ff8686) Thanks [@arein](https://github.com/arein)! - Fix disconnect and whoami commands failing with "WebSocket Unauthorized: invalid key" by passing the configured project ID to the SDK instead of an empty string
