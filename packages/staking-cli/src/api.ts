import { FOUNDATION_API_URL } from "./constants.js";

export interface StakingPosition {
  isPermanent: boolean;
  amount: string;
  createdAt: string;
  unlocksAt?: string;
  duration?: string;
}

export interface StakingRewards {
  amount: string;
}

export interface StakingResponse {
  position: StakingPosition | null;
  rewards: StakingRewards | null;
}

export interface StakeWeightResponse {
  stakeWeight: string;
}

function getBaseUrl(): string {
  return process.env.FOUNDATION_API_URL || FOUNDATION_API_URL;
}

export async function fetchStaking(address: string): Promise<StakingResponse> {
  const url = `${getBaseUrl()}/staking?address=${address}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Foundation API error: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as StakingResponse;
}

export async function fetchStakeWeight(): Promise<StakeWeightResponse> {
  const url = `${getBaseUrl()}/stake-weight`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Foundation API error: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as StakeWeightResponse;
}
