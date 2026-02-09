/**
 * Session Storage for Draft Reconnection
 *
 * Persists draft session info to localStorage so players can reconnect
 * after a page refresh or temporary disconnection.
 */

const SESSION_KEY = "umadraft_session";

export interface DraftSession {
  roomCode: string;
  playerName: string;
  isHost: boolean;
  isSpectator: boolean;
  format: "5v5" | "3v3v3";
  joinedAt: number;
}

/**
 * Save the current draft session to localStorage
 */
export function saveDraftSession(session: DraftSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn("Failed to save draft session:", err);
  }
}

/**
 * Get the saved draft session from localStorage
 * Returns null if no session exists or it's invalid
 */
export function getDraftSession(): DraftSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored) as DraftSession;

    // Validate required fields
    if (
      !session.roomCode ||
      !session.playerName ||
      !session.format ||
      typeof session.isHost !== "boolean"
    ) {
      clearDraftSession();
      return null;
    }

    // Expire sessions older than 2 hours
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    if (Date.now() - session.joinedAt > TWO_HOURS) {
      clearDraftSession();
      return null;
    }

    return session;
  } catch (err) {
    console.warn("Failed to read draft session:", err);
    clearDraftSession();
    return null;
  }
}

/**
 * Clear the saved draft session
 * Call this when the user intentionally leaves or the draft completes
 */
export function clearDraftSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (err) {
    console.warn("Failed to clear draft session:", err);
  }
}

/**
 * Check if there's a valid session that can be reconnected
 */
export function hasValidSession(): boolean {
  return getDraftSession() !== null;
}
