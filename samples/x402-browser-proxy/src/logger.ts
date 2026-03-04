const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
};

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.cyan}INFO${COLORS.reset}  ${message}`,
      ...args,
    );
  },

  warn(message: string, ...args: unknown[]): void {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.yellow}WARN${COLORS.reset}  ${message}`,
      ...args,
    );
  },

  error(message: string, ...args: unknown[]): void {
    console.error(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.red}ERROR${COLORS.reset} ${message}`,
      ...args,
    );
  },

  success(message: string, ...args: unknown[]): void {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.green}OK${COLORS.reset}    ${message}`,
      ...args,
    );
  },

  payment(message: string, ...args: unknown[]): void {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.magenta}PAY${COLORS.reset}   ${message}`,
      ...args,
    );
  },

  debug(message: string, ...args: unknown[]): void {
    if (process.env.DEBUG) {
      console.log(
        `${COLORS.dim}[${timestamp()}] DEBUG ${message}${COLORS.reset}`,
        ...args,
      );
    }
  },
};
