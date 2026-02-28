import {
  createWalletClient,
  createPublicClient,
  formatEther,
  encodeFunctionData,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadKey, resolveAccount } from "./keystore.js";
import { resolveChain, getTransport } from "./chains.js";
import { getToken } from "./tokens.js";

export interface DrainOptions {
  account?: string;
  to: string;
  chain: string;
  token?: string; // "eth" | "usdc", defaults to "eth"
}

export interface DrainResult {
  transactionHash: string;
  from: string;
  to: string;
  amount: string;
  token: string;
}

const NATIVE_TRANSFER_GAS = 21000n;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * Sweep all tokens from the companion wallet to a destination address.
 * For native ETH: sends balance minus gas cost.
 * For ERC-20 (e.g. USDC): sends full token balance (gas paid in ETH).
 */
export async function drain(options: DrainOptions): Promise<DrainResult> {
  const { to, chain, token: tokenSymbol = "eth" } = options;
  const tokenInfo = getToken(tokenSymbol, chain);

  // Resolve the embedded wallet address
  const account = resolveAccount(options.account);

  // Load private key
  const privateKey = loadKey(account);
  const viemAccount = privateKeyToAccount(privateKey);

  // Create clients
  const viemChain = resolveChain(chain);
  const transport = getTransport(chain);
  const publicClient = createPublicClient({ chain: viemChain, transport });
  const walletClient = createWalletClient({
    account: viemAccount,
    chain: viemChain,
    transport,
  });

  let transactionHash: string;
  let amount: string;

  if (tokenInfo.address) {
    // ERC-20 drain: read balance, transfer all
    const balance = await publicClient.readContract({
      address: tokenInfo.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [viemAccount.address],
    });

    if (balance === 0n) {
      throw new Error(`No ${tokenInfo.symbol} balance to drain`);
    }

    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to as Hex, balance],
    });

    transactionHash = await walletClient.sendTransaction({
      to: tokenInfo.address,
      data,
      value: 0n,
    });

    amount = balance.toString();
  } else {
    // Native ETH drain: send balance minus gas
    const balance = await publicClient.getBalance({ address: viemAccount.address });
    const gasPrice = await publicClient.getGasPrice();
    const gasCost = NATIVE_TRANSFER_GAS * gasPrice;
    const maxSend = balance - gasCost;

    if (maxSend <= 0n) {
      throw new Error(
        `Insufficient balance to cover gas. Balance: ${formatEther(balance)} ETH, gas cost: ${formatEther(gasCost)} ETH`,
      );
    }

    transactionHash = await walletClient.sendTransaction({
      to: to as Hex,
      value: maxSend,
      gas: NATIVE_TRANSFER_GAS,
    });

    amount = maxSend.toString();
  }

  return {
    transactionHash,
    from: viemAccount.address,
    to,
    amount,
    token: tokenInfo.symbol,
  };
}
