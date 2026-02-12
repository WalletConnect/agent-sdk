import http from "http";
import type { AddressInfo } from "net";
import type { BrowserUI } from "../types.js";

interface SSEClient {
  res: http.ServerResponse;
}

const SCRIPT_CLOSE = "</script>";

function buildHTML(uri: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WalletConnect — Connect Wallet</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 420px;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #fff; }
    .subtitle { color: #8888aa; margin-bottom: 2rem; }
    #qr-container {
      background: #fff;
      border-radius: 16px;
      padding: 24px;
      display: inline-block;
      margin-bottom: 1.5rem;
    }
    #qr-container canvas { display: block; }
    .uri-box {
      background: #16213e;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 12px;
      word-break: break-all;
      font-size: 0.75rem;
      color: #8888aa;
      margin-bottom: 1.5rem;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .uri-box:hover { border-color: #5566ff; }
    .uri-box:active { border-color: #3344dd; }
    #status {
      font-size: 0.9rem;
      padding: 8px 16px;
      border-radius: 8px;
      display: inline-block;
    }
    .status-waiting { background: #16213e; color: #8888aa; }
    .status-connected { background: #0a3d2a; color: #4ade80; }
    .status-error { background: #3d0a0a; color: #f87171; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Connect Your Wallet</h1>
    <p class="subtitle">Scan the QR code with your mobile wallet</p>
    <div id="qr-container"><canvas id="qr"></canvas></div>
    <div class="uri-box" onclick="navigator.clipboard.writeText('${uri}').then(()=>this.textContent='Copied!').catch(()=>{})">
      ${uri}
    </div>
    <div id="status" class="status-waiting">Waiting for connection...</div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1/build/qrcode.min.js">${SCRIPT_CLOSE}
  <script>
    QRCode.toCanvas(document.getElementById("qr"), "${uri}", {
      width: 280,
      margin: 0,
      color: { dark: "#1a1a2e", light: "#ffffff" }
    });

    const evtSource = new EventSource("/events");
    evtSource.onmessage = function(event) {
      const data = JSON.parse(event.data);
      const el = document.getElementById("status");
      el.className = "status-" + data.status;
      el.textContent = data.message || data.status;
      if (data.status === "connected") {
        evtSource.close();
        setTimeout(() => window.close(), 2000);
      }
    };
  ${SCRIPT_CLOSE}
</body>
</html>`;
}

export function createBrowserUI(preferredPort?: number): BrowserUI {
  let server: http.Server | null = null;
  const sseClients: SSEClient[] = [];

  return {
    async start(uri: string): Promise<{ port: number; url: string }> {
      const html = buildHTML(uri);

      server = http.createServer((req, res) => {
        if (req.url === "/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          res.write(`data: ${JSON.stringify({ status: "waiting", message: "Waiting for connection..." })}\n\n`);
          const client: SSEClient = { res };
          sseClients.push(client);
          req.on("close", () => {
            const idx = sseClients.indexOf(client);
            if (idx !== -1) sseClients.splice(idx, 1);
          });
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      });

      const port = await new Promise<number>((resolve, reject) => {
        server!.listen(preferredPort || 0, "127.0.0.1", () => {
          const addr = server!.address() as AddressInfo;
          resolve(addr.port);
        });
        server!.on("error", reject);
      });

      const url = `http://127.0.0.1:${port}`;

      // Dynamic import for ESM-only `open` package
      try {
        const { default: open } = await import("open");
        await open(url);
      } catch {
        console.log(`Open your browser at: ${url}`);
      }

      return { port, url };
    },

    updateStatus(status: "waiting" | "connected" | "error", message?: string) {
      const payload = JSON.stringify({
        status,
        message: message || status,
      });
      for (const client of sseClients) {
        try {
          client.res.write(`data: ${payload}\n\n`);
        } catch {
          // Client disconnected — ignore
        }
      }
    },

    async stop() {
      for (const client of sseClients) {
        try {
          client.res.end();
        } catch {
          // Ignore
        }
      }
      sseClients.length = 0;

      if (server) {
        await new Promise<void>((resolve) => {
          server!.close(() => resolve());
        });
        server = null;
      }
    },
  };
}
