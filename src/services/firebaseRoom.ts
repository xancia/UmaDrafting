/**
 * Firebase Room Service
 *
 * This service handles all Firebase Realtime Database operations for multiplayer rooms.
 * It provides functions to create, join, and manage draft rooms, as well as
 * real-time subscriptions for state synchronization.
 */

import {
  ref,
  set,
  get,
  update,
  remove,
  push,
  onValue,
  onDisconnect,
} from "firebase/database";
import type { Unsubscribe } from "firebase/database";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";

import { db, auth, buildPath } from "../config/firebase";
import { generateRoomCode, validateRoomCode } from "../utils/roomCode";
import { getInitialDraftState } from "../draftLogic";
import type { DraftState } from "../types";
import type { DraftActionPayload } from "../types/multiplayer";
import type {
  FirebaseRoom,
  FirebasePlayer,
  FirebasePendingAction,
  CreateRoomData,
  JoinRoomData,
  RoomOperationResult,
  RoomSubscriptionCallbacks,
} from "../types/firebase";

/**
 * Signs in anonymously and returns the user
 * Firebase anonymous auth provides a unique UID for each user
 */
export async function signInAnonymouslyIfNeeded(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const credential = await signInAnonymously(auth);
  return credential.user;
}

/**
 * Get the current user ID, or null if not signed in
 */
export function getCurrentUserId(): string | null {
  return auth.currentUser?.uid ?? null;
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthState(
  callback: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

/**
 * Normalizes draft state loaded from Firebase
 * Firebase doesn't store empty arrays, so we need to restore them
 */
function normalizeDraftState(state: Partial<DraftState>): DraftState {
  const defaultTeamData = {
    pickedUmas: [],
    bannedUmas: [],
    pickedMaps: [],
    bannedMaps: [],
  };

  return {
    ...getInitialDraftState(),
    ...state,
    team1: {
      ...defaultTeamData,
      ...(state.team1 || {}),
    },
    team2: {
      ...defaultTeamData,
      ...(state.team2 || {}),
    },
    availableUmas: state.availableUmas || [],
    availableMaps: state.availableMaps || [],
  } as DraftState;
}

/**
 * Creates a new multiplayer room
 *
 * @param data - Room creation data including format and host name
 * @returns Result with the room code if successful
 */
export async function createRoom(
  data: CreateRoomData,
): Promise<RoomOperationResult<string>> {
  try {
    // Ensure user is authenticated
    const user = await signInAnonymouslyIfNeeded();
    const roomCode = generateRoomCode();

    // Generate initial draft state
    const initialDraftState = data.initialDraftState ?? getInitialDraftState();

    // Create host player entry
    const hostPlayer: FirebasePlayer = {
      id: user.uid,
      name: data.hostName,
      type: "host",
      team: "team1",
      joinedAt: Date.now(),
      connected: true,
      lastSeen: Date.now(),
    };

    // Create room document
    const room: FirebaseRoom = {
      roomId: roomCode,
      hostId: user.uid,
      format: data.format,
      status: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      team1Name: data.team1Name ?? "Team 1",
      team2Name: data.team2Name ?? "Team 2",
      players: {
        [user.uid]: hostPlayer,
      },
      spectators: {},
      draftState: initialDraftState,
      version: 1,
    };

    // Write to database
    const roomRef = ref(db, buildPath.room(roomCode));
    await set(roomRef, room);

    // Set up presence for the host
    await setupPresence(roomCode, user.uid);

    return { success: true, data: roomCode };
  } catch (error) {
    console.error("Error creating room:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create room",
    };
  }
}

/**
 * Joins an existing room
 *
 * @param data - Join data including room code and player info
 * @returns Result indicating success or failure
 */
export async function joinRoom(
  data: JoinRoomData,
): Promise<RoomOperationResult> {
  try {
    // Validate room code format
    if (!validateRoomCode(data.roomCode)) {
      return { success: false, error: "Invalid room code format" };
    }

    // Ensure user is authenticated
    const user = await signInAnonymouslyIfNeeded();

    // Check if room exists
    const roomRef = ref(db, buildPath.room(data.roomCode));
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
      return { success: false, error: "Room not found" };
    }

    const room = snapshot.val() as FirebaseRoom;

    // Check room status
    if (room.status === "completed") {
      return { success: false, error: "This draft has already completed" };
    }

    // If trying to join as host, verify this is the original host
    if (data.connectionType === "host" && room.hostId !== user.uid) {
      return { success: false, error: "Not authorized as host" };
    }

    // Check if this user is already in the room
    const existingPlayer = room.players?.[user.uid];
    const existingSpectator = room.spectators?.[user.uid];

    if (existingPlayer || existingSpectator) {
      // Already in room with same UID (reconnection case)
      await setupPresence(data.roomCode, user.uid);
      return { success: true };
    }

    // Create player entry
    const player: FirebasePlayer = {
      id: user.uid,
      name: data.playerName,
      type: data.connectionType,
      team:
        data.connectionType === "player" || data.connectionType === "host"
          ? data.team
          : undefined,
      joinedAt: Date.now(),
      connected: true,
      lastSeen: Date.now(),
    };

    // Add to appropriate collection based on type
    const path =
      data.connectionType === "spectator"
        ? `${buildPath.spectators(data.roomCode)}/${user.uid}`
        : `${buildPath.players(data.roomCode)}/${user.uid}`;

    await set(ref(db, path), player);

    // Update room timestamp
    await update(roomRef, { updatedAt: Date.now() });

    // Set up presence
    await setupPresence(data.roomCode, user.uid);

    return { success: true };
  } catch (error) {
    console.error("Error joining room:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to join room",
    };
  }
}

/**
 * Leaves a room
 *
 * @param roomCode - Room to leave
 */
export async function leaveRoom(roomCode: string): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    // Remove from players or spectators
    await remove(ref(db, `${buildPath.players(roomCode)}/${userId}`));
    await remove(ref(db, `${buildPath.spectators(roomCode)}/${userId}`));
  } catch (error) {
    console.error("Error leaving room:", error);
  }
}

/**
 * Sets up presence tracking for a player
 * Automatically marks player as disconnected when they lose connection
 *
 * @param roomCode - Room the player is in
 * @param playerId - Player's Firebase UID
 */
export async function setupPresence(
  roomCode: string,
  playerId: string,
): Promise<void> {
  // Reference to this player's connected status
  const playerConnectedRef = ref(
    db,
    `${buildPath.players(roomCode)}/${playerId}/connected`,
  );
  const spectatorConnectedRef = ref(
    db,
    `${buildPath.spectators(roomCode)}/${playerId}/connected`,
  );

  // Reference to Firebase's special .info/connected path
  const connectedRef = ref(db, ".info/connected");

  onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() === true) {
      // We're connected, set up onDisconnect handlers
      await onDisconnect(playerConnectedRef).set(false);
      await onDisconnect(spectatorConnectedRef).set(false);

      // Also update lastSeen on disconnect
      const playerLastSeenRef = ref(
        db,
        `${buildPath.players(roomCode)}/${playerId}/lastSeen`,
      );
      const spectatorLastSeenRef = ref(
        db,
        `${buildPath.spectators(roomCode)}/${playerId}/lastSeen`,
      );
      await onDisconnect(playerLastSeenRef).set(Date.now());
      await onDisconnect(spectatorLastSeenRef).set(Date.now());

      // Set connected to true
      await set(playerConnectedRef, true);
    }
  });
}

/**
 * Subscribes to room updates
 *
 * @param roomCode - Room to subscribe to
 * @param callbacks - Callback functions for different update types
 * @returns Unsubscribe function
 */
export function subscribeToRoom(
  roomCode: string,
  callbacks: RoomSubscriptionCallbacks,
): Unsubscribe {
  const roomRef = ref(db, buildPath.room(roomCode));

  const unsubscribe = onValue(
    roomRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const room = snapshot.val() as FirebaseRoom;
        // Normalize draftState to restore empty arrays
        const normalizedRoom = {
          ...room,
          draftState: room.draftState
            ? normalizeDraftState(room.draftState)
            : room.draftState,
        };
        callbacks.onRoomUpdate?.(normalizedRoom);
        callbacks.onDraftStateUpdate?.(normalizedRoom.draftState);
        callbacks.onPlayersUpdate?.(room.players);
      }
    },
    (error) => {
      console.error("Room subscription error:", error);
      callbacks.onError?.(error);
    },
  );

  return unsubscribe;
}

/**
 * Subscribes only to draft state updates (more efficient than full room)
 *
 * @param roomCode - Room to subscribe to
 * @param callback - Callback for draft state updates
 * @returns Unsubscribe function
 */
export function subscribeToDraftState(
  roomCode: string,
  callback: (draftState: DraftState) => void,
): Unsubscribe {
  const draftStateRef = ref(db, buildPath.draftState(roomCode));

  return onValue(draftStateRef, (snapshot) => {
    if (snapshot.exists()) {
      // Normalize the state to restore empty arrays
      callback(normalizeDraftState(snapshot.val()));
    }
  });
}

/**
 * Updates the draft state (host only)
 *
 * @param roomCode - Room to update
 * @param newState - New draft state
 */
export async function updateDraftState(
  roomCode: string,
  newState: DraftState,
): Promise<void> {
  const roomRef = ref(db, buildPath.room(roomCode));

  // Atomic update of draft state and version
  await update(roomRef, {
    draftState: newState,
    version: (await get(roomRef)).val()?.version + 1 || 1,
    updatedAt: Date.now(),
  });
}

/**
 * Sends a draft action to the pending actions queue
 * Used by non-host players to send their actions to the host
 *
 * @param roomCode - Room to send action to
 * @param action - The action to send
 */
export async function sendAction(
  roomCode: string,
  action: DraftActionPayload,
): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const actionsRef = ref(db, buildPath.pendingActions(roomCode));
  const newActionRef = push(actionsRef);

  const pendingAction: Omit<FirebasePendingAction, "id"> = {
    senderId: userId,
    action,
    timestamp: Date.now(),
  };

  await set(newActionRef, { ...pendingAction, id: newActionRef.key });
}

/**
 * Subscribes to pending actions (host only)
 * Host should process actions and then delete them
 *
 * @param roomCode - Room to subscribe to
 * @param callback - Callback for each new action
 * @returns Unsubscribe function
 */
export function subscribeToPendingActions(
  roomCode: string,
  callback: (action: FirebasePendingAction) => void,
): Unsubscribe {
  const actionsRef = ref(db, buildPath.pendingActions(roomCode));

  return onValue(actionsRef, (snapshot) => {
    if (snapshot.exists()) {
      const actions = snapshot.val() as Record<string, FirebasePendingAction>;
      // Process each action
      Object.values(actions).forEach((action) => {
        callback(action);
      });
    }
  });
}

/**
 * Removes a processed action from the queue (host only)
 *
 * @param roomCode - Room the action is in
 * @param actionId - ID of the action to remove
 */
export async function removeProcessedAction(
  roomCode: string,
  actionId: string,
): Promise<void> {
  await remove(ref(db, `${buildPath.pendingActions(roomCode)}/${actionId}`));
}

/**
 * Gets the current room state (one-time read)
 *
 * @param roomCode - Room to get
 * @returns Room data or null if not found
 */
export async function getRoom(roomCode: string): Promise<FirebaseRoom | null> {
  const snapshot = await get(ref(db, buildPath.room(roomCode)));
  return snapshot.exists() ? (snapshot.val() as FirebaseRoom) : null;
}

/**
 * Updates player/spectator last seen timestamp
 *
 * @param roomCode - Room the player is in
 * @param playerId - Player's Firebase UID
 * @param isSpectator - Whether the user is a spectator
 */
export async function updateLastSeen(
  roomCode: string,
  playerId: string,
  isSpectator: boolean = false,
): Promise<void> {
  const path = isSpectator
    ? `${buildPath.spectators(roomCode)}/${playerId}/lastSeen`
    : `${buildPath.players(roomCode)}/${playerId}/lastSeen`;

  await set(ref(db, path), Date.now());
}

/**
 * Updates team names in the room
 *
 * @param roomCode - Room to update
 * @param team1Name - New team 1 name
 * @param team2Name - New team 2 name
 */
export async function updateTeamNames(
  roomCode: string,
  team1Name: string,
  team2Name: string,
): Promise<void> {
  await update(ref(db, buildPath.room(roomCode)), {
    team1Name,
    team2Name,
    updatedAt: Date.now(),
  });
}

/**
 * Updates room status
 *
 * @param roomCode - Room to update
 * @param status - New status
 */
export async function updateRoomStatus(
  roomCode: string,
  status: FirebaseRoom["status"],
): Promise<void> {
  await update(ref(db, buildPath.room(roomCode)), {
    status,
    updatedAt: Date.now(),
  });
}

/**
 * Checks if a room exists
 *
 * @param roomCode - Room code to check
 * @returns true if room exists
 */
export async function roomExists(roomCode: string): Promise<boolean> {
  const snapshot = await get(ref(db, buildPath.room(roomCode)));
  return snapshot.exists();
}

/**
 * Deletes a room (host only)
 *
 * @param roomCode - Room to delete
 */
export async function deleteRoom(roomCode: string): Promise<void> {
  await remove(ref(db, buildPath.room(roomCode)));
}
