import { parseUnits } from "viem";
import {
  STAKE_WEIGHT_ADDRESS,
  ONE_WEEK_IN_SECONDS,
  MIN_REMAINING_LOCK_SECONDS,
  WCT_DECIMALS,
} from "./constants.js";
import {
  buildApprove,
  buildCreateLock,
  buildUpdateLock,
  buildIncreaseLockAmount,
  buildWithdrawAll,
  buildClaim,
  buildBalanceOfCallData,
  buildAllowanceCallData,
  buildLocksCallData,
} from "./contracts.js";
import { readUint256, readLocks, waitForTx } from "./rpc.js";
import { fetchStaking, fetchStakeWeight } from "./api.js";
import { formatWCT, formatDate, calculateAPY, calculateWeeklyAPY, label } from "./format.js";
import type { WalletSender } from "./wallet.js";

// ---- Helpers ---------------------------------------------------------- //

function computeUnlockTime(weeks: number): bigint {
  const now = Math.floor(Date.now() / 1000);
  return (BigInt(Math.floor((now + weeks * ONE_WEEK_IN_SECONDS) / ONE_WEEK_IN_SECONDS)) *
    BigInt(ONE_WEEK_IN_SECONDS));
}

// ---- Commands --------------------------------------------------------- //

export async function stake(
  wallet: WalletSender,
  address: string,
  amount: string,
  weeks: number,
): Promise<void> {
  const amountWei = parseUnits(amount, WCT_DECIMALS);
  const requestedUnlockTime = computeUnlockTime(weeks);

  // Read on-chain position to determine the right action
  const lock = await readLocks(buildLocksCallData(address));
  const hasPosition = lock.amount > 0n;

  if (hasPosition) {
    console.log("\nExisting staking position:");
    console.log(label("Staked", `${formatWCT(BigInt(lock.amount))} WCT`));
    console.log(label("Unlocks", formatDate(Number(lock.end))));
  }

  // Determine effective unlock time — never shorten an existing lock
  let effectiveUnlockTime = requestedUnlockTime;
  const extendingTime = !hasPosition || requestedUnlockTime > lock.end;

  if (hasPosition && requestedUnlockTime <= lock.end) {
    effectiveUnlockTime = lock.end;
    console.log(`\nRequested unlock (${formatDate(Number(requestedUnlockTime))}) is before existing lock end.`);
    console.log(`Keeping current unlock date: ${formatDate(Number(lock.end))}`);
  }

  console.log(`\nAdding ${amount} WCT${extendingTime ? `, extending lock to ${formatDate(Number(effectiveUnlockTime))}` : ""}...`);

  // Check allowance and approve if needed
  const allowance = await readUint256(buildAllowanceCallData(address, STAKE_WEIGHT_ADDRESS));
  if (allowance < amountWei) {
    console.log("\nApproving WCT spend...");
    const approveTxHash = await wallet.sendTransaction(address, buildApprove(STAKE_WEIGHT_ADDRESS, amountWei));
    console.log(label("Approve tx", approveTxHash));
    console.log("Waiting for confirmation...");
    await waitForTx(approveTxHash);
  }

  let txHash: string;

  if (!hasPosition) {
    console.log("\nCreating new lock...");
    txHash = await wallet.sendTransaction(address, buildCreateLock(amountWei, effectiveUnlockTime));
  } else if (extendingTime) {
    console.log("\nUpdating lock (amount + time)...");
    txHash = await wallet.sendTransaction(address, buildUpdateLock(amountWei, effectiveUnlockTime));
  } else {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const remaining = lock.end - now;

    if (remaining < BigInt(MIN_REMAINING_LOCK_SECONDS)) {
      const days = Number(remaining) / 86400;
      console.error(
        `\nCannot add to position: lock expires in ~${Math.ceil(days)} day(s), ` +
        `which is below the minimum remaining period of 1 week.\n` +
        `Re-run with a longer --weeks value to extend your lock.`,
      );
      return;
    }

    console.log("\nIncreasing lock amount...");
    txHash = await wallet.sendTransaction(address, buildIncreaseLockAmount(amountWei));
  }

  console.log(label("Tx hash", txHash));
  console.log("\nStake submitted successfully.");
}

export async function unstake(
  wallet: WalletSender,
  address: string,
): Promise<void> {
  const staking = await fetchStaking(address);

  if (!staking.position) {
    console.log("\nNo staking position found.");
    return;
  }

  if (staking.position.unlocksAt) {
    const unlocksAt = new Date(staking.position.unlocksAt).getTime() / 1000;
    const now = Math.floor(Date.now() / 1000);
    if (unlocksAt > now) {
      console.log(`\nLock has not expired yet. Unlocks ${formatDate(unlocksAt)}.`);
      return;
    }
  }

  console.log("\nWithdrawing all staked WCT...");
  const txHash = await wallet.sendTransaction(address, buildWithdrawAll());
  console.log(label("Tx hash", txHash));
  console.log("\nUnstake submitted successfully.");
}

export async function claim(
  wallet: WalletSender,
  address: string,
): Promise<void> {
  const staking = await fetchStaking(address);

  if (!staking.rewards || staking.rewards.amount === "0") {
    console.log("\nNo rewards to claim.");
    return;
  }

  console.log(`\nClaiming ${staking.rewards.amount} WCT in rewards...`);
  const txHash = await wallet.sendTransaction(address, buildClaim(address));
  console.log(label("Tx hash", txHash));
  console.log("\nClaim submitted successfully.");
}

export async function status(address: string): Promise<void> {
  const [staking, stakeWeightRes] = await Promise.all([
    fetchStaking(address),
    fetchStakeWeight(),
  ]);

  console.log(`\nStaking status for ${address}\n`);

  if (!staking.position) {
    console.log("  No staking position found.\n");
  } else {
    const pos = staking.position;
    console.log(label("Amount", `${pos.amount} WCT`));
    console.log(label("Permanent", pos.isPermanent ? "Yes" : "No"));
    console.log(label("Created", new Date(pos.createdAt).toLocaleDateString("en-US")));
    if (pos.unlocksAt) {
      console.log(label("Unlocks", new Date(pos.unlocksAt).toLocaleDateString("en-US")));
    }
    if (pos.duration) {
      const durationWeeks = Math.round(parseInt(pos.duration, 10) / ONE_WEEK_IN_SECONDS);
      console.log(label("Duration", `${durationWeeks} week(s)`));
    }
    console.log();
  }

  if (staking.rewards) {
    console.log(label("Rewards", `${staking.rewards.amount} WCT`));
  }

  const stakeWeight = parseFloat(stakeWeightRes.stakeWeight);
  const baseAPY = calculateAPY(stakeWeight);
  console.log(label("Base APY", `${baseAPY.toFixed(2)}%`));

  if (staking.position?.duration) {
    const weeks = Math.round(parseInt(staking.position.duration, 10) / ONE_WEEK_IN_SECONDS);
    const weeklyAPY = calculateWeeklyAPY(baseAPY, weeks);
    console.log(label("Your APY", `${weeklyAPY.toFixed(2)}%`));
  }

  console.log();
}

export async function balance(address: string): Promise<void> {
  const bal = await readUint256(buildBalanceOfCallData(address));
  console.log(`\n${label("WCT balance", `${formatWCT(bal)} WCT`)}\n`);
}
