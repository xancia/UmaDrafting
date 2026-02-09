import type { DraftState } from "../types";
import type { DataConnection } from "peerjs";

/**
 * Connection type for a peer in the multiplayer session
 */
export type ConnectionType = "host" | "player" | "spectator";

/**
 * Represents a peer connection with metadata
 */
export interface PeerConnection {
  /** Unique peer ID */
  id: string;
  /** Type of connection (host, player, spectator) */
  type: ConnectionType;
  /** Display label for the peer */
  label: string;
  /** PeerJS DataConnection instance */
  connection: DataConnection;
}

/**
 * State of a multiplayer room
 */
export interface RoomState {
  /** Unique room identifier (6-character code) */
  roomId: string;
  /** Peer ID of the room host */
  hostId: string;
  /** List of all active peer connections */
  connections: PeerConnection[];
  /** Current draft state (synchronized across all peers) */
  draftState: DraftState;
  /** Draft format: 5v5 (2 players) or 3v3v3 (3 players) */
  draftFormat: "5v5" | "3v3v3";
  /** Current room status */
  status: "waiting" | "ready" | "in-progress" | "completed";
  /** State version number for conflict resolution */
  version: number;
}

/**
 * Types of messages that can be sent between peers
 */
export const MessageType = {
  // Connection management
  JOIN_REQUEST: "join-request",
  JOIN_ACCEPTED: "join-accepted",
  JOIN_REJECTED: "join-rejected",
  LEAVE_ROOM: "leave-room",

  // Draft actions
  SELECT_UMA: "select-uma",
  SELECT_MAP: "select-map",
  ADVANCE_PHASE: "advance-phase",

  // State synchronization
  STATE_SYNC: "state-sync",
  STATE_REQUEST: "state-request",

  // Lobby/reveal
  START_REVEAL: "start-reveal",
  REVEAL_COMPLETE: "reveal-complete",

  // Heartbeat
  PING: "ping",
  PONG: "pong",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/**
 * Message payload for join requests
 */
export interface JoinRequestPayload {
  connectionType: ConnectionType;
  label: string;
}

/**
 * Message payload for join accepted
 */
export interface JoinAcceptedPayload {
  roomState: RoomState;
  yourId: string;
}

/**
 * Message payload for join rejected
 */
export interface JoinRejectedPayload {
  reason: string;
}

/**
 * Message payload for draft actions
 */
export interface DraftActionPayload {
  action: "pick" | "ban" | "ready" | "team-name";
  itemType: "uma" | "map" | "control";
  itemId: string;
  phase?: string; // Optional phase parameter for control actions
}

/**
 * Message payload for state synchronization
 */
export interface StateSyncPayload {
  draftState: DraftState;
  version: number;
}

/**
 * Generic network message structure
 */
export interface NetworkMessage<T = unknown> {
  /** Type of message */
  type: MessageType;
  /** Message payload */
  payload: T;
  /** Timestamp when message was created */
  timestamp: number;
  /** ID of the peer who sent the message */
  senderId: string;
}

/**
 * Connection status for UI display
 */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * Error types for connection issues
 */
export const ConnectionError = {
  PEER_INIT_FAILED: "peer-init-failed",
  CONNECTION_TIMEOUT: "connection-timeout",
  INVALID_ROOM_CODE: "invalid-room-code",
  ROOM_FULL: "room-full",
  HOST_DISCONNECTED: "host-disconnected",
  NETWORK_ERROR: "network-error",
  INVALID_STATE: "invalid-state",
} as const;

export type ConnectionError =
  (typeof ConnectionError)[keyof typeof ConnectionError];

/**
 * Multiplayer configuration for a draft session
 */
export interface MultiplayerConfig {
  /** Whether multiplayer mode is enabled */
  enabled: boolean;
  /** Connection type for the local peer */
  connectionType: ConnectionType;
  /** Room ID to join/create */
  roomId?: string;
  /** Local team assignment (team1 or team2) */
  localTeam?: "team1" | "team2";
  /** Peer ID of this client */
  peerId?: string;
}
