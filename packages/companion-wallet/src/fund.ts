import { parseEther, type Hex } from "viem";
import { withWallet, resolveProjectId } from "@walletconnect/cli-sdk";
import { listAddresses } from "./keystore.js";
import { getToken, parseTokenAmount, buildErc20Transfer } from "./tokens.js";

export interface FundOptions {
  account?: string;
  amount: string;
  chain: string;
  token?: string; // "eth" | "usdc", defaults to "eth"
}

export interface FundResult {
  transactionHash: string;
  from: string;
  to: string;
  amount: string;
  token: string;
}

/**
 * Fund the companion wallet by connecting an external wallet via WalletConnect
 * and sending tokens (native ETH or ERC-20) to the local address.
 */
export async function fund(options: FundOptions): Promise<FundResult> {
  const { amount, chain, token: tokenSymbol = "eth" } = options;

  // Resolve the embedded wallet address
  const embeddedAddress = resolveAccount(options.account);
  const tokenInfo = getToken(tokenSymbol, chain);

  // Resolve WalletConnect project ID
  const projectId = resolveProjectId();
  if (!projectId) {
    throw new Error(
      "WalletConnect project ID not found. Set WALLETCONNECT_PROJECT_ID env var.",
    );
  }

  let result: FundResult | undefined;

  await withWallet(
    {
      projectId,
      metadata: {
        name: "companion-wallet",
        description: "Fund companion wallet",
        url: "https://walletconnect.com",
        icons: [],
      },
      chains: [chain],
      methods: ["eth_sendTransaction"],
      events: [],
    },
    async (wallet, { accounts }) => {
      // Find an account on the target chain
      const caip10Account = accounts.find((a) => a.startsWith(`${chain}:`));
      if (!caip10Account) {
        throw new Error(
          `No account found on chain ${chain}. Connected accounts: ${accounts.join(", ")}`,
        );
      }

      // Extract the address from CAIP-10 (e.g. "eip155:1:0xABC..." → "0xABC...")
      const externalAddress = caip10Account.split(":").slice(2).join(":") as Hex;

      let tx: Record<string, Hex>;

      if (tokenInfo.address) {
        // ERC-20 transfer (e.g. USDC)
        const rawAmount = parseTokenAmount(amount, tokenInfo.decimals);
        const erc20Tx = buildErc20Transfer(
          tokenInfo.address,
          embeddedAddress as Hex,
          rawAmount,
        );
        tx = { from: externalAddress, ...erc20Tx };
      } else {
        // Native ETH transfer
        const amountWei = parseEther(amount);
        const valueHex = `0x${amountWei.toString(16)}` as Hex;
        tx = {
          from: externalAddress,
          to: embeddedAddress as Hex,
          value: valueHex,
          gas: `0x${(21000).toString(16)}` as Hex,
        };
      }

      const transactionHash = await wallet.request<string>({
        chainId: chain,
        request: {
          method: "eth_sendTransaction",
          params: [tx],
        },
      });

      result = {
        transactionHash,
        from: externalAddress,
        to: embeddedAddress,
        amount,
        token: tokenInfo.symbol,
      };
    },
  );

  if (!result) {
    throw new Error("Fund operation completed without a result");
  }

  return result;
}

function resolveAccount(account?: string): string {
  if (account) return account;

  const addresses = listAddresses();
  if (addresses.length === 0) {
    throw new Error("No wallet found. Run 'companion-wallet generate' first.");
  }
  return addresses[0];
}
