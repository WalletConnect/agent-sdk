import { describe, it, expect } from "vitest";
import { createSessionManager } from "../src/session.js";
import { createMockSession, createMockSignClient } from "./mocks/sign-client.js";

describe("SessionManager", () => {
  const sessionManager = createSessionManager();

  describe("getExistingSession", () => {
    it("returns null when no sessions exist", () => {
      const client = createMockSignClient([]);
      const result = sessionManager.getExistingSession(client as any);
      expect(result).toBeNull();
    });

    it("returns valid session when one exists", () => {
      const session = createMockSession();
      const client = createMockSignClient([session]);
      const result = sessionManager.getExistingSession(client as any);
      expect(result).toBe(session);
      expect(result!.topic).toBe("mock-topic-abc123");
    });

    it("filters out expired sessions", () => {
      const expired = createMockSession({
        topic: "expired-topic",
        expiry: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      });
      const client = createMockSignClient([expired]);
      const result = sessionManager.getExistingSession(client as any);
      expect(result).toBeNull();
    });

    it("returns most recent valid session when multiple exist", () => {
      const older = createMockSession({
        topic: "older-topic",
        expiry: Math.floor(Date.now() / 1000) + 3600, // 1h
      });
      const newer = createMockSession({
        topic: "newer-topic",
        expiry: Math.floor(Date.now() / 1000) + 86400, // 24h
      });
      const client = createMockSignClient([older, newer]);
      const result = sessionManager.getExistingSession(client as any);
      expect(result!.topic).toBe("newer-topic");
    });

    it("filters expired and returns valid from mixed set", () => {
      const expired = createMockSession({
        topic: "expired",
        expiry: Math.floor(Date.now() / 1000) - 100,
      });
      const valid = createMockSession({
        topic: "valid",
        expiry: Math.floor(Date.now() / 1000) + 86400,
      });
      const client = createMockSignClient([expired, valid]);
      const result = sessionManager.getExistingSession(client as any);
      expect(result!.topic).toBe("valid");
    });
  });

  describe("isSessionValid", () => {
    it("returns true for non-expired session", () => {
      const session = createMockSession({
        expiry: Math.floor(Date.now() / 1000) + 86400,
      });
      expect(sessionManager.isSessionValid(session)).toBe(true);
    });

    it("returns false for expired session", () => {
      const session = createMockSession({
        expiry: Math.floor(Date.now() / 1000) - 100,
      });
      expect(sessionManager.isSessionValid(session)).toBe(false);
    });
  });
});
