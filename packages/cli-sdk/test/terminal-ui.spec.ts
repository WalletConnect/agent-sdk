import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock qrcode-terminal before importing
const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
}));
vi.mock("qrcode-terminal", () => ({
  default: { generate: mockGenerate },
}));
import { createTerminalUI } from "../src/terminal-ui.js";

describe("TerminalUI", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  describe("displayQR", () => {
    it("calls qrcode.generate with the URI and small option", () => {
      const ui = createTerminalUI();
      const uri = "wc:test-uri@2?relay-protocol=irn";
      ui.displayQR(uri);

      expect(mockGenerate).toHaveBeenCalledWith(uri, { small: true });
    });

    it("displays the URI as copy-paste text", () => {
      const ui = createTerminalUI();
      const uri = "wc:test-uri@2?relay-protocol=irn";
      ui.displayQR(uri);

      expect(consoleSpy).toHaveBeenCalledWith("\nOr copy this URI:", uri);
    });
  });

  describe("showStatus", () => {
    it("prints formatted status message", () => {
      const ui = createTerminalUI();
      ui.showStatus("Connecting...");
      expect(consoleSpy).toHaveBeenCalledWith("[WalletConnect] Connecting...");
    });
  });

  describe("showError", () => {
    it("prints formatted error message", () => {
      const ui = createTerminalUI();
      ui.showError("Connection failed");
      expect(consoleErrorSpy).toHaveBeenCalledWith("[WalletConnect] Error: Connection failed");
    });
  });

  describe("showSuccess", () => {
    it("prints formatted success message", () => {
      const ui = createTerminalUI();
      ui.showSuccess("Connected!");
      expect(consoleSpy).toHaveBeenCalledWith("[WalletConnect] Connected!");
    });
  });
});
