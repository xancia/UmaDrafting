/**
 * Firebase configuration and initialization
 *
 * This module sets up Firebase Realtime Database and Authentication
 * for real-time multiplayer functionality.
 */

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import type { Database } from "firebase/database";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";

/**
 * Firebase project configuration
 *
 * These values are loaded from environment variables.
 * Note: Firebase client config is safe to expose (security is via Firebase rules),
 * but using env vars allows different configs for dev/staging/prod.
 *
 * Create a .env file with these values (see .env.example)
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Initialize Firebase app instance
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase Realtime Database instance
 * Use this for all database operations
 */
export const db: Database = getDatabase(app);

/**
 * Firebase Auth instance
 * Use this for anonymous authentication
 */
export const auth: Auth = getAuth(app);

/**
 * Database path constants for consistent path usage
 */
export const DB_PATHS = {
  /** Root path for all rooms */
  ROOMS: "rooms",
  /** Path to room's draft state (relative to room) */
  DRAFT_STATE: "draftState",
  /** Path to room's players (relative to room) */
  PLAYERS: "players",
  /** Path to room's spectators (relative to room) */
  SPECTATORS: "spectators",
  /** Path to pending actions queue (relative to room) */
  PENDING_ACTIONS: "pendingActions",
} as const;

/**
 * Helper to build database paths
 */
export const buildPath = {
  /** Get path to a specific room */
  room: (roomId: string) => `${DB_PATHS.ROOMS}/${roomId}`,
  /** Get path to room's draft state */
  draftState: (roomId: string) =>
    `${DB_PATHS.ROOMS}/${roomId}/${DB_PATHS.DRAFT_STATE}`,
  /** Get path to room's players */
  players: (roomId: string) =>
    `${DB_PATHS.ROOMS}/${roomId}/${DB_PATHS.PLAYERS}`,
  /** Get path to a specific player in a room */
  player: (roomId: string, playerId: string) =>
    `${DB_PATHS.ROOMS}/${roomId}/${DB_PATHS.PLAYERS}/${playerId}`,
  /** Get path to room's spectators */
  spectators: (roomId: string) =>
    `${DB_PATHS.ROOMS}/${roomId}/${DB_PATHS.SPECTATORS}`,
  /** Get path to pending actions */
  pendingActions: (roomId: string) =>
    `${DB_PATHS.ROOMS}/${roomId}/${DB_PATHS.PENDING_ACTIONS}`,
} as const;
