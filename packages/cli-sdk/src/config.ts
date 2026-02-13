import { homedir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const CONFIG_DIR = join(homedir(), ".walletconnect-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface Config {
  projectId?: string;
}

function readConfig(): Config {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as Config;
  } catch {
    return {};
  }
}

function writeConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

/** Get a config value */
export function getConfigValue(key: keyof Config): string | undefined {
  return readConfig()[key];
}

/** Set a config value */
export function setConfigValue(key: keyof Config, value: string): void {
  const config = readConfig();
  config[key] = value;
  writeConfig(config);
}

/** Resolve project ID: env var > config file. Returns undefined if neither is set. */
export function resolveProjectId(): string | undefined {
  return process.env.WALLETCONNECT_PROJECT_ID || getConfigValue("projectId");
}
