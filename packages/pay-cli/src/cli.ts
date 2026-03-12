import { Cli, z } from "incur";
import { resolveProjectId, createTelemetry } from "@walletconnect/cli-sdk";
import { createPayClient } from "./api.js";
import { createFrontendPayClient } from "./frontend-client.js";
import { PAY_FRONTEND_STAGING, PAY_FRONTEND_PROD } from "./constants.js";
import { formatAmount, formatStatus, label } from "./format.js";
import { selectPaymentWallet, getAllAccounts, sendTransaction } from "./wallet.js";
import type { PayClient } from "./api.js";
import type { WalletRpcAction, Action } from "./types.js";

declare const __VERSION__: string;

const sdkVersion = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

const telemetry = createTelemetry({
  binary: "walletconnect-pay",
  version: sdkVersion,
  projectId: resolveProjectId(),
});

/**
 * Resolve the PayClient to use. When `--proxy` is set (or no wallet API key
 * is available), routes through the frontend's TanStack Start server
 * functions — no API keys required.
 */
function resolveClient(opts: { staging?: boolean; proxy?: boolean }): PayClient {
  const walletApiKey = process.env.WC_PAY_WALLET_API_KEY;
  const useProxy = opts.proxy || !walletApiKey;

  if (useProxy) {
    const frontendUrl = opts.staging ? PAY_FRONTEND_STAGING : PAY_FRONTEND_PROD;
    console.log(label("Mode", `proxy via ${frontendUrl}`));
    return createFrontendPayClient({ frontendUrl });
  }

  const partnerApiKey = process.env.WC_PAY_PARTNER_API_KEY;
  const merchantId = process.env.WC_PAY_MERCHANT_ID;

  return createPayClient({
    staging: opts.staging,
    walletApiKey,
    sdkVersion,
    ...(partnerApiKey && merchantId ? { partnerApiKey, merchantId } : {}),
  });
}

const cli = Cli.create("walletconnect-pay", {
  version: sdkVersion,
  description: "WalletConnect Pay CLI — create and complete payments from the terminal",
});

// ── status ──────────────────────────────────────────────────────────

cli.command("status", {
  description: "Check the status of a payment",
  args: z.object({
    paymentId: z.string().describe("Payment ID to check"),
  }),
  options: z.object({
    staging: z.boolean().optional().describe("Use staging API"),
    proxy: z.boolean().optional().describe("Proxy through frontend (no API keys needed)"),
  }),
  async run(c) {
    telemetry.track("command_invoked", { command: "status" });
    const client = resolveClient(c.options);
    const payment = await client.getPayment(c.args.paymentId);

    console.log("\nPayment Details:");
    console.log(label("Merchant", payment.merchant.name));
    console.log(label("Amount", formatAmount(payment.amount)));
    console.log(label("Status", formatStatus(payment.status)));
    console.log(label("Expires", new Date(payment.expiresAt * 1000).toLocaleString()));
    console.log();

    telemetry.track("command_succeeded", { command: "status" });
    return {
      merchant: payment.merchant.name,
      amount: payment.amount,
      status: payment.status,
      expiresAt: payment.expiresAt,
    };
  },
});

// ── create ──────────────────────────────────────────────────────────

cli.command("create", {
  description: "Create a new payment",
  args: z.object({
    amount: z.string().describe("Payment amount in minor units (e.g. 1000 for $10.00)"),
  }),
  options: z.object({
    unit: z.string().default("iso4217/USD").describe("Currency unit (e.g. iso4217/USD)"),
    referenceId: z.string().optional().describe("Merchant/PSP order ID"),
    staging: z.boolean().optional().describe("Use staging API"),
    proxy: z.boolean().optional().describe("Proxy through frontend (no API keys needed)"),
  }),
  async run(c) {
    telemetry.track("command_invoked", { command: "create" });
    const client = resolveClient(c.options);

    const result = await client.createPayment({
      amount: { unit: c.options.unit, value: c.args.amount },
      referenceId: c.options.referenceId ?? `cli-${Date.now()}`,
    });

    console.log("\nPayment Created:");
    console.log(label("ID", result.paymentId));
    console.log(label("Status", formatStatus(result.status)));
    console.log(label("Gateway URL", result.gatewayUrl));
    console.log(label("Expires", new Date(result.expiresAt * 1000).toLocaleString()));
    console.log();

    telemetry.track("command_succeeded", { command: "create" });
    return {
      paymentId: result.paymentId,
      gatewayUrl: result.gatewayUrl,
      status: result.status,
    };
  },
});

// ── checkout ────────────────────────────────────────────────────────

cli.command("checkout", {
  description: "Complete a payment using a connected wallet",
  args: z.object({
    paymentId: z.string().describe("Payment ID to pay"),
  }),
  options: z.object({
    wallet: z.string().optional().describe("Use a specific wallet provider"),
    staging: z.boolean().optional().describe("Use staging API"),
    proxy: z.boolean().optional().describe("Proxy through frontend (no API keys needed)"),
    name: z.string().optional().describe("Full legal name (for Travel Rule compliance)"),
    dob: z.string().optional().describe("Date of birth YYYY-MM-DD (for Travel Rule compliance)"),
    pobCountry: z.string().optional().describe("Place of birth country code, e.g. US (ISO 3166-1 alpha-2)"),
    pobAddress: z.string().optional().describe("Place of birth city/state, e.g. 'New York, NY'"),
  }),
  async run(c) {
    telemetry.track("command_invoked", { command: "checkout" });
    const client = resolveClient(c.options);

    // 1. Fetch payment details
    console.log("\nFetching payment details...");
    const payment = await client.getPayment(c.args.paymentId);
    console.log(label("Merchant", payment.merchant.name));
    console.log(label("Amount", formatAmount(payment.amount)));

    if (payment.status !== "requires_action") {
      throw new Error(`Payment is ${formatStatus(payment.status)}, expected Requires Action`);
    }

    // 2. Connect wallet
    console.log("\nConnecting wallet...");
    const provider = await selectPaymentWallet("eip155:1", c.options.wallet);
    console.log(label("Wallet", provider.info?.name ?? "Unknown"));

    // Get wallet accounts
    const accounts = await getAllAccounts(provider.path);
    if (accounts.length === 0) {
      throw new Error("Wallet has no accounts");
    }
    console.log(label("Accounts", accounts.length.toString()));

    // 3. Get payment options for the wallet's accounts
    console.log("\nFetching payment options...");
    const optionsResponse = await client.getPaymentOptions(c.args.paymentId, { accounts });
    if (optionsResponse.options.length === 0) {
      throw new Error("No payment options available for this wallet");
    }

    const option = optionsResponse.options[0];
    console.log(label("Token", `${formatAmount(option.amount)}`));
    console.log(label("ETA", `~${option.etaS}s`));

    // 4. Execute wallet RPC actions
    console.log("\nExecuting wallet actions...");
    const results: string[] = [];
    for (const action of option.actions) {
      const rpc = resolveAction(action);
      console.log(label("Action", `${rpc.method} on ${rpc.chain_id}`));
      console.log("  Approve the request in your wallet app...");
      const result = await sendTransaction(provider.path, option.account, rpc.chain_id, rpc);
      telemetry.track("transaction_sent", { command: "checkout", chainId: rpc.chain_id });
      results.push(result);
    }

    // 5. Submit Information Capture data (Travel Rule compliance)
    const needsIC = option.collectData || optionsResponse.collectData;
    if (needsIC && client.submitInformationCapture) {
      const fullName = c.options.name || process.env.WC_PAY_NAME;
      const dob = c.options.dob || process.env.WC_PAY_DOB;
      const pobCountry = c.options.pobCountry || process.env.WC_PAY_POB_COUNTRY;
      const pobAddress = c.options.pobAddress || process.env.WC_PAY_POB_ADDRESS;

      if (!fullName || !dob || !pobCountry || !pobAddress) {
        throw new Error(
          "Travel Rule compliance requires: --name, --dob, --pob-country, --pob-address\n" +
            "  Or set: WC_PAY_NAME, WC_PAY_DOB, WC_PAY_POB_COUNTRY, WC_PAY_POB_ADDRESS",
        );
      }

      console.log("\nSubmitting compliance data...");
      console.log(label("IC", `${fullName} (${pobCountry})`));
      await client.submitInformationCapture(c.args.paymentId, {
        accounts,
        data: { fullName, dob, tosConfirmed: true, pobCountry, pobAddress },
      });
    }

    // 6. Confirm payment
    console.log("\nConfirming payment...");
    await client.confirmPayment(c.args.paymentId, {
      optionId: option.id,
      results: [{ type: "walletRpc", data: results }],
    });

    // 7. Poll for final status
    console.log("Waiting for confirmation...");
    const final = await client.pollStatus(c.args.paymentId);

    console.log("\n" + "=".repeat(40));
    if (final.status === "succeeded") {
      console.log("  PAYMENT SUCCEEDED");
    } else {
      console.log(`  PAYMENT ${final.status.toUpperCase()}`);
    }
    console.log("=".repeat(40));
    console.log(label("Payment", c.args.paymentId));
    console.log(label("Amount", formatAmount(payment.amount)));
    console.log(label("Merchant", payment.merchant.name));
    console.log(label("Token", formatAmount(option.amount)));
    console.log(label("Network", option.amount.display.networkName ?? option.account.split(":").slice(0, 2).join(":")));
    if (final.info?.txId) {
      console.log(label("Tx Hash", final.info.txId));
    }
    console.log();

    telemetry.track("command_succeeded", { command: "checkout" });
    return {
      paymentId: c.args.paymentId,
      status: final.status,
      txId: final.info?.txId,
    };
  },
});

/** Decode a payment action into a WalletRpcAction */
function resolveAction(action: Action): WalletRpcAction {
  if (action.type === "walletRpc") {
    return action.data;
  }
  // "build" actions contain hex-encoded WalletRpcAction JSON in data.data
  const json = Buffer.from(action.data.data, "hex").toString("utf-8");
  return JSON.parse(json) as WalletRpcAction;
}

cli.serve(undefined, {
  exit: (code: number) => {
    telemetry.flush().finally(() => process.exit(code));
  },
});

export default cli;
