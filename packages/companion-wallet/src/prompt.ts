import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { SUPPORTED_CHAINS, getChainName } from "./chains.js";
import { getTokenSymbols } from "./tokens.js";

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

function printOptions(items: { label: string; value: string }[]): void {
  for (let i = 0; i < items.length; i++) {
    process.stderr.write(`  ${i + 1}. ${items[i].label}\n`);
  }
}

/**
 * Prompt user to select a chain. Returns CAIP-2 identifier.
 */
export async function selectChain(): Promise<string> {
  const options = SUPPORTED_CHAINS.map((caip2) => ({
    label: getChainName(caip2),
    value: caip2,
  }));

  process.stderr.write("\nSelect chain:\n");
  printOptions(options);

  const input = await ask("> ");
  const idx = parseInt(input, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= options.length) {
    throw new Error(`Invalid selection: ${input}`);
  }

  return options[idx].value;
}

/**
 * Prompt user to select a token on the given chain. Returns lowercase symbol.
 */
export async function selectToken(chain: string): Promise<string> {
  const symbols = getTokenSymbols(chain);
  const options = symbols.map((s) => ({
    label: s.toUpperCase(),
    value: s,
  }));

  process.stderr.write("\nSelect token:\n");
  printOptions(options);

  const input = await ask("> ");
  const idx = parseInt(input, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= options.length) {
    throw new Error(`Invalid selection: ${input}`);
  }

  return options[idx].value;
}

/**
 * Prompt user for a token amount.
 */
export async function inputAmount(symbol: string): Promise<string> {
  const input = await ask(`\nAmount (${symbol.toUpperCase()}): `);
  const num = parseFloat(input);

  if (isNaN(num) || num <= 0) {
    throw new Error(`Invalid amount: ${input}`);
  }

  return input;
}

/**
 * Prompt user for an Ethereum address.
 */
export async function inputAddress(label: string): Promise<string> {
  const input = await ask(`\n${label}: `);

  if (!/^0x[0-9a-fA-F]{40}$/.test(input)) {
    throw new Error(`Invalid address: ${input}`);
  }

  return input;
}
