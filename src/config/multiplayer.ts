/**
 * Multiplayer configuration constants
 * 
 * These values control connection behavior, timeouts, and room settings.
 * Using environment variables where possible for flexibility.
 */

/**
 * PeerJS server configuration
 * Default uses PeerJS cloud server (free tier)
 */
export const PEER_SERVER_CONFIG = {
  host: import.meta.env.VITE_PEER_HOST || "0.peerjs.com",
  port: Number(import.meta.env.VITE_PEER_PORT) || 443,
  path: import.meta.env.VITE_PEER_PATH || "/",
  secure: import.meta.env.VITE_PEER_SECURE !== "false", // Default true
  debug: import.meta.env.DEV ? 2 : 0, // Debug level 2 in dev, 0 in prod
} as const;

/**
 * Connection timeout values (in milliseconds)
 */
export const CONNECTION_TIMEOUTS = {
  /** How long to wait for initial peer connection */
  PEER_INIT: 10000, // 10 seconds
  /** How long to wait for room join response */
  JOIN_RESPONSE: 15000, // 15 seconds
  /** How long to wait for data connection to establish */
  DATA_CONNECTION: 10000, // 10 seconds
  /** Interval for heartbeat/ping messages */
  HEARTBEAT_INTERVAL: 5000, // 5 seconds
  /** How long to wait for pong before considering connection dead */
  HEARTBEAT_TIMEOUT: 15000, // 15 seconds
} as const;

/**
 * Retry logic constants
 */
export const RETRY_CONFIG = {
  /** Maximum number of reconnection attempts */
  MAX_RECONNECT_ATTEMPTS: 5,
  /** Initial backoff delay in milliseconds */
  INITIAL_BACKOFF_MS: 1000,
  /** Maximum backoff delay in milliseconds */
  MAX_BACKOFF_MS: 30000,
  /** Multiplier for exponential backoff */
  BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * Room code generation parameters
 */
export const ROOM_CODE_CONFIG = {
  /** Length of generated room codes */
  LENGTH: 6,
  /** Character set for room codes (uppercase letters and numbers, excluding ambiguous chars) */
  CHARSET: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", // Excludes I, O, 0, 1
  /** Pattern for validating room codes */
  VALIDATION_PATTERN: /^[A-Z0-9]{6}$/,
} as const;

/**
 * Room capacity limits
 */
export const ROOM_LIMITS = {
  /** Maximum number of spectators per room */
  MAX_SPECTATORS: 50,
  /** Maximum number of players for 5v5 format */
  MAX_PLAYERS_5V5: 2,
  /** Maximum number of players for 3v3v3 format */
  MAX_PLAYERS_3V3V3: 3,
} as const;

/**
 * State synchronization settings
 */
export const SYNC_CONFIG = {
  /** Debounce delay for rapid state changes (ms) */
  STATE_DEBOUNCE_MS: 100,
  /** Interval for periodic state validation (ms) */
  VALIDATION_INTERVAL_MS: 30000, // 30 seconds
  /** Whether to compress large state updates */
  ENABLE_COMPRESSION: false, // Can enable if messages get large
} as const;

/**
 * Network optimization settings
 */
export const NETWORK_CONFIG = {
  /** Whether to send only state deltas instead of full state */
  USE_STATE_DELTAS: false, // Can enable later for optimization
  /** Batch multiple rapid updates */
  BATCH_UPDATES: true,
  /** Maximum batch window in milliseconds */
  BATCH_WINDOW_MS: 50,
  /** Reduce spectator update frequency (updates per second) */
  SPECTATOR_UPDATE_RATE: 10, // 10 updates/sec max
} as const;

/**
 * Draft format configuration
 */
export const DRAFT_FORMAT_CONFIG = {
  "5v5": {
    playerCount: 2,
    teamNames: ["team1", "team2"] as const,
    displayName: "5v5 (2 Players)",
  },
  "3v3v3": {
    playerCount: 3,
    teamNames: ["teamA", "teamB", "teamC"] as const,
    displayName: "3v3v3 (3 Players)",
  },
} as const;

/**
 * Error message templates
 */
export const ERROR_MESSAGES = {
  PEER_INIT_FAILED: "Failed to initialize connection. Please check your internet connection.",
  CONNECTION_TIMEOUT: "Connection timeout. Please try again.",
  INVALID_ROOM_CODE: "Invalid room code. Please check and try again.",
  ROOM_FULL: "Room is full. Cannot join.",
  ROOM_NOT_FOUND: "Room not found. The room may have been closed.",
  HOST_DISCONNECTED: "Host has disconnected. Draft session ended.",
  NETWORK_ERROR: "Network error occurred. Attempting to reconnect...",
  INVALID_STATE: "Invalid state update received. Synchronization failed.",
  STATE_SYNC_FAILED: "Failed to synchronize draft state.",
  PERMISSION_DENIED: "You don't have permission to perform this action.",
} as const;

/**
 * Connection error constants (same as ERROR_MESSAGES but exported separately)
 */
export const CONNECTION_ERRORS = ERROR_MESSAGES;
