# Agent SDK

## Monorepo Structure

```
packages/
  cli-sdk/       → @walletconnect/cli-sdk (wallet connection + signing for CLI apps)
  staking-cli/   → @walletconnect/staking-cli (WCT staking CLI, depends on cli-sdk)
```

Both packages are ESM (`"type": "module"`), built with **tsup**, tested with **vitest**, linted with **ESLint v9** (flat config at root `eslint.config.mjs`).

**Turborepo** orchestrates build/test/lint. Build order: `cli-sdk` first (staking-cli depends on it).

## Commands

```bash
npm run build          # Build all packages
npm run test           # Run all tests (61 total)
npm run lint           # Lint all packages
npm run changeset      # Create a new changeset (interactive)
npm run changeset:version   # Apply changesets to bump versions
npm run changeset:publish   # Publish to npm
```

## Changesets (Required for Every PR)

This repo uses [changesets](https://github.com/changesets/changesets) for versioning and releases. **Every PR that changes package behavior must include a changeset file.**

### How to add a changeset

```bash
npm run changeset
```

This interactively asks:
1. Which packages changed (both are in a fixed group — they version together)
2. Bump type: `patch` (fixes), `minor` (features), `major` (breaking)
3. A summary of the change

It creates a `.changeset/<random-name>.md` file. **Commit this file with your PR.**

### What happens on merge

1. PR merges to `main` → the `changesets/action` opens a "chore: version packages" PR with bumped versions + updated CHANGELOGs
2. That version PR merges → packages publish to npm + GitHub releases are created

### Fixed versioning

Both packages always version together (fixed group). A changeset touching either package bumps both.

## CI Workflows

- **CI** (`.github/workflows/ci.yml`): Runs on PRs to `main` — build, lint, test
- **Publish** (`.github/workflows/publish.yml`): Runs on push to `main` — builds, then uses `changesets/action` to either open a version PR or publish

## Key Files

| File | Purpose |
|------|---------|
| `turbo.json` | Task pipeline: build → test, build → lint |
| `tsconfig.base.json` | Shared TS config (ES2020, ESNext modules, strict) |
| `eslint.config.mjs` | ESLint v9 flat config (typescript-eslint + node globals) |
| `.changeset/config.json` | Changesets config (fixed group, public access, GitHub changelog) |
| `packages/*/tsup.config.ts` | Per-package build config |

## Testing

Tests live in `packages/*/test/`. Both packages use vitest with `--reporter=verbose`.

- **cli-sdk**: 41 tests (client, helpers, session, terminal-ui, browser-ui)
- **staking-cli**: 20 tests (contracts, format utilities)

Mocks for WalletConnect SignClient are in `packages/cli-sdk/test/mocks/sign-client.ts`.

## Required Secrets (GitHub)

- `NPM_TOKEN`: npm automation token for the `@walletconnect` scope (add in repo Settings > Secrets > Actions)
- `GITHUB_TOKEN`: Provided automatically by GitHub Actions
