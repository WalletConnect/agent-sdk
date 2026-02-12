import { describe, it, expect, afterEach, vi } from "vitest";
import http from "http";
import { createBrowserUI } from "../src/browser-ui/server.js";

// Mock `open` so it doesn't actually open a browser
vi.mock("open", () => ({
  default: vi.fn(async () => {}),
}));

describe("BrowserUI", () => {
  let ui: ReturnType<typeof createBrowserUI>;

  afterEach(async () => {
    if (ui) await ui.stop();
  });

  it("starts server on a random port", async () => {
    ui = createBrowserUI();
    const { port, url } = await ui.start("wc:test@2");
    expect(port).toBeGreaterThan(0);
    expect(url).toBe(`http://127.0.0.1:${port}`);
  });

  it("serves HTML page on GET /", async () => {
    ui = createBrowserUI();
    const { url } = await ui.start("wc:test-uri@2?key=abc");

    const html = await fetchText(`${url}/`);
    expect(html).toContain("Connect Your Wallet");
    expect(html).toContain("wc:test-uri@2?key=abc");
    expect(html).toContain("qrcode");
  });

  it("serves SSE endpoint on GET /events", async () => {
    ui = createBrowserUI();
    const { url } = await ui.start("wc:test@2");

    const response = await fetch(`${url}/events`);
    expect(response.headers.get("content-type")).toBe("text/event-stream");

    // Read the initial event
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const { value } = await reader.read();
    const text = decoder.decode(value);
    expect(text).toContain('"status":"waiting"');

    reader.cancel();
  });

  it("pushes status updates to SSE clients", async () => {
    ui = createBrowserUI();
    const { url } = await ui.start("wc:test@2");

    const response = await fetch(`${url}/events`);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Read initial event
    await reader.read();

    // Push a connected status
    ui.updateStatus("connected", "Connected to MetaMask");

    const { value } = await reader.read();
    const text = decoder.decode(value);
    expect(text).toContain('"status":"connected"');
    expect(text).toContain("MetaMask");

    reader.cancel();
  });

  it("stop() shuts down the server", async () => {
    ui = createBrowserUI();
    const { url } = await ui.start("wc:test@2");

    await ui.stop();

    // Server should no longer accept connections
    await expect(fetch(url)).rejects.toThrow();
  });

  it("starts on preferred port when specified", async () => {
    // Find a free port first, then use it
    const freePort = await getRandomFreePort();
    ui = createBrowserUI(freePort);
    const { port } = await ui.start("wc:test@2");
    expect(port).toBe(freePort);
  });
});

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  return res.text();
}

function getRandomFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
  });
}
