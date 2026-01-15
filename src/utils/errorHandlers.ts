/**
 * Error handling utilities for multiplayer functionality
 * 
 * Provides user-friendly error messages and retry logic for common
 * connection and network issues.
 */

import { CONNECTION_ERRORS, RETRY_CONFIG } from "../config/multiplayer";

/**
 * Error types for multiplayer operations
 */
export type MultiplayerErrorType =
  | "peer-init-failed"
  | "connection-timeout"
  | "room-not-found"
  | "room-full"
  | "invalid-room-code"
  | "network-error"
  | "state-sync-failed"
  | "permission-denied"
  | "unknown";

/**
 * Structured error information
 */
export interface MultiplayerError {
  type: MultiplayerErrorType;
  message: string;
  userMessage: string;
  isRecoverable: boolean;
  retryable: boolean;
  originalError?: Error;
}

/**
 * Parse an error and return structured error information
 */
export function parseError(error: unknown): MultiplayerError {
  if (!error) {
    return {
      type: "unknown",
      message: "Unknown error occurred",
      userMessage: "An unexpected error occurred. Please try again.",
      isRecoverable: false,
      retryable: true,
    };
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Peer initialization errors
  if (
    errorMessage.includes("Could not connect to peer") ||
    errorMessage.includes("PeerServer") ||
    errorMessage.includes("Failed to fetch")
  ) {
    return {
      type: "peer-init-failed",
      message: CONNECTION_ERRORS.PEER_INIT_FAILED,
      userMessage:
        "Failed to connect to the multiplayer server. Check your internet connection and try again.",
      isRecoverable: true,
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Connection timeout errors
  if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("timed out") ||
    errorMessage.toLowerCase().includes("timeout")
  ) {
    return {
      type: "connection-timeout",
      message: CONNECTION_ERRORS.CONNECTION_TIMEOUT,
      userMessage:
        "Connection timed out. The other player may be offline or have connection issues.",
      isRecoverable: true,
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Room not found errors
  if (errorMessage.includes("not found") || errorMessage.includes("404")) {
    return {
      type: "room-not-found",
      message: CONNECTION_ERRORS.ROOM_NOT_FOUND,
      userMessage:
        "Room not found. The room may have been closed or the code is incorrect.",
      isRecoverable: false,
      retryable: false,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Room full errors
  if (errorMessage.includes("full") || errorMessage.includes("capacity")) {
    return {
      type: "room-full",
      message: CONNECTION_ERRORS.ROOM_FULL,
      userMessage:
        "This room is full. Please try joining a different room or create your own.",
      isRecoverable: false,
      retryable: false,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Invalid room code errors
  if (
    errorMessage.includes("invalid") &&
    (errorMessage.includes("room") || errorMessage.includes("code"))
  ) {
    return {
      type: "invalid-room-code",
      message: CONNECTION_ERRORS.INVALID_ROOM_CODE,
      userMessage:
        "Invalid room code format. Room codes must be 6 characters (letters and numbers).",
      isRecoverable: false,
      retryable: false,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Network errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("offline") ||
    errorMessage.includes("ERR_INTERNET_DISCONNECTED")
  ) {
    return {
      type: "network-error",
      message: CONNECTION_ERRORS.NETWORK_ERROR,
      userMessage:
        "Network connection lost. Check your internet connection and try reconnecting.",
      isRecoverable: true,
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // State sync errors
  if (errorMessage.includes("sync") || errorMessage.includes("state")) {
    return {
      type: "state-sync-failed",
      message: CONNECTION_ERRORS.STATE_SYNC_FAILED,
      userMessage:
        "Failed to synchronize draft state. The connection may be unstable.",
      isRecoverable: true,
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Permission denied errors
  if (
    errorMessage.includes("permission") ||
    errorMessage.includes("not allowed") ||
    errorMessage.includes("unauthorized")
  ) {
    return {
      type: "permission-denied",
      message: CONNECTION_ERRORS.PERMISSION_DENIED,
      userMessage: "You don't have permission to perform this action.",
      isRecoverable: false,
      retryable: false,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Default unknown error
  return {
    type: "unknown",
    message: errorMessage,
    userMessage:
      "An unexpected error occurred. Please try again or refresh the page.",
    isRecoverable: true,
    retryable: true,
    originalError: error instanceof Error ? error : undefined,
  };
}

/**
 * Determine if an error should trigger a retry
 */
export function shouldRetry(error: MultiplayerError, attemptCount: number): boolean {
  if (!error.retryable) {
    return false;
  }

  if (attemptCount >= RETRY_CONFIG.MAX_RECONNECT_ATTEMPTS) {
    return false;
  }

  // Don't retry non-recoverable errors
  if (!error.isRecoverable) {
    return false;
  }

  return true;
}

/**
 * Calculate backoff delay for retry attempts
 */
export function getRetryDelay(attemptCount: number): number {
  const baseDelay = RETRY_CONFIG.INITIAL_BACKOFF_MS;
  const maxDelay = RETRY_CONFIG.MAX_BACKOFF_MS;
  const multiplier = RETRY_CONFIG.BACKOFF_MULTIPLIER;

  const delay = Math.min(baseDelay * Math.pow(multiplier, attemptCount), maxDelay);

  // Add jitter (±10%) to avoid thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Format an error for logging
 */
export function formatErrorForLogging(error: MultiplayerError): string {
  return `[${error.type}] ${error.message}${error.originalError ? ` (${error.originalError.message})` : ""}`;
}

/**
 * Create a user-facing error message with retry information
 */
export function getUserErrorMessage(
  error: MultiplayerError,
  attemptCount: number
): string {
  let message = error.userMessage;

  if (error.retryable && attemptCount > 0) {
    message += ` (Attempt ${attemptCount + 1}/${RETRY_CONFIG.MAX_RECONNECT_ATTEMPTS})`;
  }

  if (!error.retryable) {
    message += " This error cannot be automatically resolved.";
  }

  return message;
}

/**
 * Handle an error with automatic retry logic
 * 
 * @param error - The error to handle
 * @param attemptCount - Current retry attempt number
 * @param onRetry - Callback to execute retry logic
 * @param onError - Callback to handle final error
 * @returns Promise that resolves when retry completes or error is final
 */
export async function handleErrorWithRetry(
  error: unknown,
  attemptCount: number,
  onRetry: () => Promise<void>,
  onError: (error: MultiplayerError) => void
): Promise<void> {
  const parsedError = parseError(error);

  console.error(formatErrorForLogging(parsedError));

  if (shouldRetry(parsedError, attemptCount)) {
    const delay = getRetryDelay(attemptCount);
    console.log(`Retrying in ${delay}ms (attempt ${attemptCount + 1})`);

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await onRetry();
    } catch (retryError) {
      // Recursive retry
      await handleErrorWithRetry(retryError, attemptCount + 1, onRetry, onError);
    }
  } else {
    onError(parsedError);
  }
}

/**
 * Validate connection health
 */
export function validateConnectionHealth(
  lastHeartbeat: number,
  heartbeatInterval: number
): boolean {
  const now = Date.now();
  const timeSinceHeartbeat = now - lastHeartbeat;

  // Consider connection unhealthy if no heartbeat for 3x the interval
  return timeSinceHeartbeat < heartbeatInterval * 3;
}

/**
 * Create an error for display in UI
 */
export function createDisplayError(
  type: MultiplayerErrorType,
  customMessage?: string
): MultiplayerError {
  const baseError = parseError(new Error(type));
  
  if (customMessage) {
    baseError.userMessage = customMessage;
  }

  return baseError;
}
