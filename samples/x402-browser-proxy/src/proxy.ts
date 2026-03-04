import { Proxy } from "http-mitm-proxy";
import type { x402HTTPClient } from "@x402/core/client";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logger } from "./logger.js";
import { parsePaymentHeader, signPayment } from "./x402-client.js";
import type { PaymentRequirements } from "@x402/core/types";

const CERT_DIR = path.join(os.homedir(), ".x402-browser-proxy", "certs");

export interface ProxyOptions {
  port: number;
  maxPayment: bigint;
  host?: string;
  httpClient: x402HTTPClient;
  walletAddress: string;
}

export function startProxy(options: ProxyOptions): void {
  const { port, maxPayment, host = "127.0.0.1", httpClient, walletAddress } = options;

  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
    logger.info(`Created certificate directory: ${CERT_DIR}`);
  }

  const proxy = new Proxy();
  proxy.sslCaDir = CERT_DIR;

  proxy.onError((_ctx, err) => {
    if (err) {
      logger.error(`Proxy error: ${err.message}`);
    }
  });

  proxy.onRequest((ctx, callback) => {
    if (process.env.DEBUG) {
      const { clientToProxyRequest: req } = ctx;
      const url = `${ctx.isSSL ? "https" : "http"}://${req.headers.host}${req.url}`;
      logger.debug(`Request: ${req.method} ${url}`);
    }
    callback();
  });

  proxy.onResponse((ctx, callback) => {
    const {
      clientToProxyRequest: req,
      serverToProxyResponse: serverRes,
      proxyToClientResponse: clientRes,
    } = ctx;

    if (!serverRes) {
      callback();
      return;
    }

    const statusCode = serverRes.statusCode || 0;
    const url = `${ctx.isSSL ? "https" : "http"}://${req.headers.host}${req.url}`;

    if (statusCode === 402) {
      logger.payment(`402 Payment Required: ${url}`);

      const paymentHeader = (serverRes.headers["x-payment"] ||
        serverRes.headers["payment-required"]) as string | undefined;

      if (!paymentHeader) {
        logger.warn(
          "No X-Payment or Payment-Required header found in 402 response",
        );
        callback();
        return;
      }

      const paymentRequired = parsePaymentHeader(paymentHeader);
      if (!paymentRequired) {
        logger.error("Failed to parse payment requirements");
        callback();
        return;
      }

      const accepts = paymentRequired.accepts || [];
      if (accepts.length > 0) {
        const paymentReq = accepts[0] as PaymentRequirements;
        logger.payment(
          `Payment details: scheme=${paymentReq.scheme}, network=${paymentReq.network}, amount=${paymentReq.amount}`,
        );
      }

      signPayment(httpClient, paymentRequired, maxPayment)
        .then((paymentHeaders) => {
          if (!paymentHeaders) {
            logger.warn("Payment rejected or signing failed");
            callback();
            return;
          }

          logger.payment(`Payment signed, retrying request...`);

          retryWithPayment(ctx, paymentHeaders, url)
            .then((retryRes) => {
              if (retryRes) {
                const retryStatus = retryRes.statusCode ?? 0;
                if (retryStatus === 402) {
                  logger.warn(
                    `Retry still got 402 - payment may have been rejected: ${url}`,
                  );
                } else if (retryStatus >= 200 && retryStatus < 300) {
                  logger.success(
                    `Paid request successful: ${retryStatus} ${url}`,
                  );
                } else {
                  logger.info(
                    `Retry response: ${retryStatus} ${url}`,
                  );
                }
                clientRes.writeHead(retryStatus, retryRes.headers);
                retryRes.pipe(clientRes);
              } else {
                callback();
              }
            })
            .catch((err) => {
              logger.error(`Retry failed: ${err.message}`);
              callback();
            });
        })
        .catch((err) => {
          logger.error(`Payment signing failed: ${err.message}`);
          callback();
        });
    } else {
      if (process.env.DEBUG) {
        logger.debug(`Response: ${statusCode} ${url}`);
      }
      callback();
    }
  });

  proxy.listen({ port, host }, () => {
    logger.info(`x402 proxy started on ${host}:${port}`);
    logger.info(`Wallet address: ${walletAddress}`);
    logger.info(`Max payment: ${maxPayment.toString()}`);
    logger.info(
      `CA certificate: ${path.join(CERT_DIR, "certs", "ca.pem")}`,
    );
    console.log("");
    console.log("Usage with agent-browser:");
    console.log(`  export AGENT_BROWSER_PROXY="http://${host}:${port}"`);
    console.log("  export AGENT_BROWSER_IGNORE_HTTPS_ERRORS=1");
    console.log("");
  });
}

type ProxyResponseContext = Parameters<Parameters<Proxy["onResponse"]>[0]>[0];

async function retryWithPayment(
  ctx: ProxyResponseContext,
  paymentHeaders: Record<string, string>,
  url: string,
): Promise<http.IncomingMessage | null> {
  return new Promise((resolve, reject) => {
    const { clientToProxyRequest: originalReq } = ctx;
    const parsedUrl = new URL(url);

    const isHttps = parsedUrl.protocol === "https:";
    const requestModule = isHttps ? https : http;

    const headers: Record<string, string | string[] | undefined> = {
      ...originalReq.headers,
    };

    for (const [key, value] of Object.entries(paymentHeaders)) {
      headers[key.toLowerCase()] = value;
    }

    // Remove hop-by-hop headers
    delete headers["proxy-connection"];
    delete headers["connection"];
    delete headers["keep-alive"];
    delete headers["transfer-encoding"];

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: originalReq.method,
      headers,
    };

    if (process.env.DEBUG) {
      logger.debug(`Retry request headers: ${JSON.stringify(headers)}`);
    }

    const retryReq = requestModule.request(options, (res) => {
      const paymentResponse =
        res.headers["payment-response"] || res.headers["x-payment-response"];
      if (paymentResponse && process.env.DEBUG) {
        try {
          const decoded = Buffer.from(
            paymentResponse as string,
            "base64",
          ).toString("utf-8");
          logger.debug(`Payment response: ${decoded}`);
        } catch {
          logger.debug(`Payment response (raw): ${paymentResponse}`);
        }
      }
      resolve(res);
    });

    retryReq.on("error", (err) => {
      reject(err);
    });

    // Note: body is not forwarded on retry (x402 payments are typically GET requests)
    retryReq.end();
  });
}
