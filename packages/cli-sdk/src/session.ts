import type { SignClient } from "@walletconnect/sign-client";
import type { SessionTypes } from "@walletconnect/types";

export interface SessionManager {
  /** Returns the most recent valid (non-expired) session, or null */
  getExistingSession(client: InstanceType<typeof SignClient>): SessionTypes.Struct | null;
  /** Checks if a session has not expired */
  isSessionValid(session: SessionTypes.Struct): boolean;
}

export function createSessionManager(): SessionManager {
  return {
    getExistingSession(client: InstanceType<typeof SignClient>): SessionTypes.Struct | null {
      const sessions = client.session.getAll();
      if (sessions.length === 0) return null;

      const now = Math.floor(Date.now() / 1000);
      const valid = sessions
        .filter((s) => s.expiry > now)
        .sort((a, b) => b.expiry - a.expiry);

      return valid.length > 0 ? valid[0] : null;
    },

    isSessionValid(session: SessionTypes.Struct): boolean {
      const now = Math.floor(Date.now() / 1000);
      return session.expiry > now;
    },
  };
}
