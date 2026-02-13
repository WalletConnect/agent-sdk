/** Optimism chain ID */
export const CHAIN_ID = 10;
export const CAIP2_CHAIN_ID = "eip155:10";

/** Contract addresses on Optimism */
export const L2_WCT_ADDRESS = "0xeF4461891DfB3AC8572cCf7C794664A8DD927945";
export const STAKE_WEIGHT_ADDRESS = "0x521B4C065Bbdbe3E20B3727340730936912DfA46";
export const STAKING_REWARD_DISTRIBUTOR_ADDRESS = "0xF368F535e329c6d08DFf0d4b2dA961C4e7F3fCAF";

/** Public Optimism RPC endpoint */
export const OPTIMISM_RPC_URL = "https://mainnet.optimism.io";

/** Foundation API */
export const FOUNDATION_API_URL = "https://api.walletconnect.network";

/** Time constants */
export const ONE_WEEK_IN_SECONDS = 604800;

/** WCT token decimals */
export const WCT_DECIMALS = 18;

/** APY formula constants (from math.ts) */
export const APY_SLOPE = -0.06464;
export const APY_INTERCEPT = 12.0808;
export const APY_STAKE_WEIGHT_DIVISOR = 1_000_000;
export const MAX_LOCK_WEEKS = 104;

/** CLI metadata for WalletConnect pairing */
export const CLI_METADATA = {
  name: "walletconnect-staking",
  description: "WalletConnect WCT Staking CLI",
  url: "https://walletconnect.com",
  icons: [],
};
