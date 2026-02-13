import { encodeFunctionData, parseAbi } from "viem";
import {
  L2_WCT_ADDRESS,
  STAKE_WEIGHT_ADDRESS,
  STAKING_REWARD_DISTRIBUTOR_ADDRESS,
} from "./constants.js";

// ---- ABI fragments ---------------------------------------------------- //

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const stakeWeightAbi = parseAbi([
  "function createLock(uint256 amount, uint256 unlockTime)",
  "function updateLock(uint256 amount, uint256 unlockTime)",
  "function increaseLockAmount(uint256 amount)",
  "function increaseUnlockTime(uint256 newUnlockTime)",
  "function withdrawAll()",
  "function locks(address) view returns (int128 amount, uint256 end, uint256 transferredAmount)",
]);

const stakingRewardDistributorAbi = parseAbi([
  "function claim(address user) returns (uint256)",
]);

// ---- Transaction builders --------------------------------------------- //

export interface TxData {
  to: string;
  data: string;
}

export function buildApprove(spender: string, amount: bigint): TxData {
  return {
    to: L2_WCT_ADDRESS,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spender as `0x${string}`, amount],
    }),
  };
}

export function buildCreateLock(amount: bigint, unlockTime: bigint): TxData {
  return {
    to: STAKE_WEIGHT_ADDRESS,
    data: encodeFunctionData({
      abi: stakeWeightAbi,
      functionName: "createLock",
      args: [amount, unlockTime],
    }),
  };
}

export function buildUpdateLock(amount: bigint, unlockTime: bigint): TxData {
  return {
    to: STAKE_WEIGHT_ADDRESS,
    data: encodeFunctionData({
      abi: stakeWeightAbi,
      functionName: "updateLock",
      args: [amount, unlockTime],
    }),
  };
}

export function buildIncreaseLockAmount(amount: bigint): TxData {
  return {
    to: STAKE_WEIGHT_ADDRESS,
    data: encodeFunctionData({
      abi: stakeWeightAbi,
      functionName: "increaseLockAmount",
      args: [amount],
    }),
  };
}

export function buildIncreaseUnlockTime(newUnlockTime: bigint): TxData {
  return {
    to: STAKE_WEIGHT_ADDRESS,
    data: encodeFunctionData({
      abi: stakeWeightAbi,
      functionName: "increaseUnlockTime",
      args: [newUnlockTime],
    }),
  };
}

export function buildWithdrawAll(): TxData {
  return {
    to: STAKE_WEIGHT_ADDRESS,
    data: encodeFunctionData({
      abi: stakeWeightAbi,
      functionName: "withdrawAll",
    }),
  };
}

export function buildClaim(user: string): TxData {
  return {
    to: STAKING_REWARD_DISTRIBUTOR_ADDRESS,
    data: encodeFunctionData({
      abi: stakingRewardDistributorAbi,
      functionName: "claim",
      args: [user as `0x${string}`],
    }),
  };
}

// ---- Call data builders (for eth_call) -------------------------------- //

export function buildBalanceOfCallData(account: string): TxData {
  return {
    to: L2_WCT_ADDRESS,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account as `0x${string}`],
    }),
  };
}

export function buildAllowanceCallData(owner: string, spender: string): TxData {
  return {
    to: L2_WCT_ADDRESS,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner as `0x${string}`, spender as `0x${string}`],
    }),
  };
}

export function buildLocksCallData(account: string): TxData {
  return {
    to: STAKE_WEIGHT_ADDRESS,
    data: encodeFunctionData({
      abi: stakeWeightAbi,
      functionName: "locks",
      args: [account as `0x${string}`],
    }),
  };
}
