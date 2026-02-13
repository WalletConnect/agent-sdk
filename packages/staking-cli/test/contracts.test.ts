import { describe, it, expect } from "vitest";
import {
  buildApprove,
  buildCreateLock,
  buildUpdateLock,
  buildWithdrawAll,
  buildClaim,
  buildBalanceOfCallData,
  buildAllowanceCallData,
  buildLocksCallData,
} from "../src/contracts.js";
import {
  L2_WCT_ADDRESS,
  STAKE_WEIGHT_ADDRESS,
  STAKING_REWARD_DISTRIBUTOR_ADDRESS,
} from "../src/constants.js";

const TEST_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const TEST_SPENDER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

describe("transaction builders", () => {
  it("buildApprove targets WCT contract", () => {
    const tx = buildApprove(TEST_SPENDER, 1000n);
    expect(tx.to).toBe(L2_WCT_ADDRESS);
    expect(tx.data).toMatch(/^0x/);
    // approve(address,uint256) selector: 0x095ea7b3
    expect(tx.data.startsWith("0x095ea7b3")).toBe(true);
  });

  it("buildCreateLock targets StakeWeight contract", () => {
    const tx = buildCreateLock(1000n, 1700000000n);
    expect(tx.to).toBe(STAKE_WEIGHT_ADDRESS);
    expect(tx.data).toMatch(/^0x/);
  });

  it("buildUpdateLock targets StakeWeight contract", () => {
    const tx = buildUpdateLock(1000n, 1700000000n);
    expect(tx.to).toBe(STAKE_WEIGHT_ADDRESS);
    expect(tx.data).toMatch(/^0x/);
  });

  it("buildWithdrawAll targets StakeWeight contract", () => {
    const tx = buildWithdrawAll();
    expect(tx.to).toBe(STAKE_WEIGHT_ADDRESS);
    expect(tx.data).toMatch(/^0x/);
  });

  it("buildClaim targets StakingRewardDistributor", () => {
    const tx = buildClaim(TEST_ADDRESS);
    expect(tx.to).toBe(STAKING_REWARD_DISTRIBUTOR_ADDRESS);
    expect(tx.data).toMatch(/^0x/);
  });
});

describe("call data builders", () => {
  it("buildBalanceOfCallData targets WCT contract", () => {
    const tx = buildBalanceOfCallData(TEST_ADDRESS);
    expect(tx.to).toBe(L2_WCT_ADDRESS);
    // balanceOf(address) selector: 0x70a08231
    expect(tx.data.startsWith("0x70a08231")).toBe(true);
  });

  it("buildAllowanceCallData targets WCT contract", () => {
    const tx = buildAllowanceCallData(TEST_ADDRESS, TEST_SPENDER);
    expect(tx.to).toBe(L2_WCT_ADDRESS);
    // allowance(address,address) selector: 0xdd62ed3e
    expect(tx.data.startsWith("0xdd62ed3e")).toBe(true);
  });

  it("buildLocksCallData targets StakeWeight contract", () => {
    const tx = buildLocksCallData(TEST_ADDRESS);
    expect(tx.to).toBe(STAKE_WEIGHT_ADDRESS);
    expect(tx.data).toMatch(/^0x/);
  });
});
