/**
 * Firebase-specific types for real-time multiplayer
 *
 * These types define the data structures stored in Firebase Realtime Database
 * and are designed to map closely to the existing multiplayer types while
 * removing PeerJS-specific dependencies.
 */

import type { DraftState, Team } from "../types";
import type { ConnectionType, DraftActionPayload } from "./multiplayer";

/**
 * Player entry stored in Firebase
 * Represents a connected player or spectator in a room
 */
export interface FirebasePlayer {
  /** Firebase Auth UID of the player */
  id: string;
  /** Display name for the player */
  name: string;
  /** Connection type (host, player, spectator) */
  type: ConnectionType;
  /** Team assignment for players (undefined for spectators) */
  team?: Team;
  /** Timestamp when player joined */
  joinedAt: number;
  /** Whether player is currently connected (managed by presence system) */
  connected: boolean;
  /** Last activity timestamp */
  lastSeen: number;
}

/**
 * Room document structure in Firebase
 * This is the root document for each draft room
 */
export interface FirebaseRoom {
  /** Unique room identifier (6-character code) */
  roomId: string;
  /** Firebase Auth UID of the room host */
  hostId: string;
  /** Draft format: 5v5 (2 players) or 3v3v3 (3 players) */
  format: "5v5" | "3v3v3";
  /** Current room status */
  status: "waiting" | "ready" | "in-progress" | "completed";
  /** When the room was created */
  createdAt: number;
  /** When the room was last updated */
  updatedAt: number;
  /** Team names */
  team1Name: string;
  team2Name: string;
  /** Connected players (keyed by Firebase UID) */
  players: Record<string, FirebasePlayer>;
  /** Connected spectators (keyed by Firebase UID) */
  spectators: Record<string, FirebasePlayer>;
  /** Current draft state */
  draftState: DraftState;
  /** State version for conflict resolution */
  version: number;
}

/**
 * Pending action in the action queue
 * Players write actions here, host processes and removes them
 */
export interface FirebasePendingAction {
  /** Unique action ID (Firebase push key) */
  id: string;
  /** Firebase UID of the player who sent the action */
  senderId: string;
  /** The action payload */
  action: DraftActionPayload;
  /** When the action was created */
  timestamp: number;
}

/**
 * Data for creating a new room
 */
/**
 * Pending selection data written to Firebase
 * Represents what a player is hovering before locking in
 */
export interface FirebasePendingSelection {
  /** Type of selection */
  type: "uma" | "map";
  /** Uma ID or map name */
  id: string;
  /** Display name for ghost preview */
  name: string;
  /** Image URL (for uma) */
  imageUrl?: string;
  /** Map details (for map ghost) */
  track?: string;
  distance?: number;
  surface?: string;
  /** Timestamp */
  updatedAt: number;
}

/**
 * Both teams' pending selections
 */
export type PendingSelections = {
  team1?: FirebasePendingSelection | null;
  team2?: FirebasePendingSelection | null;
};

/**
 * Data for creating a new room
 */
export interface CreateRoomData {
  /** Draft format */
  format: "5v5" | "3v3v3";
  /** Host's display name */
  hostName: string;
  /** Initial team names */
  team1Name?: string;
  team2Name?: string;
  /** Initial draft state (generated if not provided) */
  initialDraftState?: DraftState;
}

/**
 * Data for joining an existing room
 */
export interface JoinRoomData {
  /** Room code to join */
  roomCode: string;
  /** Player's display name */
  playerName: string;
  /** Type of connection (player, spectator, or host for reconnection) */
  connectionType: ConnectionType;
  /** Team to join (required for players/host, ignored for spectators) */
  team?: Team;
}

/**
 * Firebase connection state
 */
export type FirebaseConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * Result of a room operation
 */
export interface RoomOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Callback types for room subscriptions
 */
export interface RoomSubscriptionCallbacks {
  /** Called when room data changes */
  onRoomUpdate?: (room: FirebaseRoom) => void;
  /** Called when draft state changes */
  onDraftStateUpdate?: (draftState: DraftState) => void;
  /** Called when a player joins or leaves */
  onPlayersUpdate?: (players: Record<string, FirebasePlayer>) => void;
  /** Called on connection errors */
  onError?: (error: Error) => void;
}

/**
 * Return type for useFirebaseRoom hook
 */
export interface UseFirebaseRoomReturn {
  // Room management
  createRoom: (data: CreateRoomData) => Promise<RoomOperationResult<string>>;
  joinRoom: (data: JoinRoomData) => Promise<RoomOperationResult>;
  leaveRoom: () => Promise<void>;

  // State
  room: FirebaseRoom | null;
  draftState: DraftState | null;
  isHost: boolean;
  isConnected: boolean;
  connectionState: FirebaseConnectionState;
  players: FirebasePlayer[];
  spectators: FirebasePlayer[];
  error: Error | null;

  // User info
  userId: string | null;
  roomCode: string | null;

  // Actions
  updateDraftState: (newState: DraftState) => Promise<void>;
  sendAction: (action: DraftActionPayload) => Promise<void>;
  /** Set a handler for incoming pending actions (host only) */
  setPendingActionHandler: (
    handler: ((action: FirebasePendingAction) => void) | null,
  ) => void;
  /** Update the ghost hover selection for a team */
  updatePendingSelection: (
    team: "team1" | "team2",
    selection: FirebasePendingSelection | null,
  ) => Promise<void>;
  /** Current pending (ghost) selections from both teams */
  pendingSelections: PendingSelections;
}
