/**
 * useFirebaseRoom Hook
 *
 * A React hook that manages Firebase-based multiplayer room functionality.
 * Replaces the PeerJS-based usePeer + useRoom + useDraftSync hooks with
 * a single, simpler Firebase implementation.
 *
 * Features:
 * - Room creation and joining
 * - Real-time state synchronization
 * - Automatic presence management
 * - Host authority for state updates
 * - Pending action queue for player actions
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { User } from "firebase/auth";
import type { Unsubscribe } from "firebase/database";

import * as firebaseRoom from "../services/firebaseRoom";
import type { DraftState } from "../types";
import type { DraftActionPayload } from "../types/multiplayer";
import type {
  FirebaseRoom,
  FirebasePlayer,
  FirebasePendingAction,
  CreateRoomData,
  JoinRoomData,
  FirebaseConnectionState,
  RoomOperationResult,
  UseFirebaseRoomReturn,
} from "../types/firebase";

/**
 * Hook for managing Firebase multiplayer room state
 *
 * @returns UseFirebaseRoomReturn with room state and control methods
 *
 * @example
 * const {
 *   createRoom,
 *   joinRoom,
 *   leaveRoom,
 *   room,
 *   draftState,
 *   isHost,
 *   updateDraftState,
 *   sendAction,
 * } = useFirebaseRoom();
 *
 * // Host creates room
 * const result = await createRoom({ format: "5v5", hostName: "Host" });
 * if (result.success) {
 *   console.log("Room code:", result.data);
 * }
 *
 * // Player joins room
 * await joinRoom({ roomCode: "ABC123", playerName: "Player 1", connectionType: "player" });
 */
export function useFirebaseRoom(): UseFirebaseRoomReturn {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [connectionState, setConnectionState] =
    useState<FirebaseConnectionState>("disconnected");
  const [error, setError] = useState<Error | null>(null);

  // Room state
  const [room, setRoom] = useState<FirebaseRoom | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  // Refs for cleanup
  const unsubscribeRoomRef = useRef<Unsubscribe | null>(null);
  const unsubscribeActionsRef = useRef<Unsubscribe | null>(null);
  const unsubscribeAuthRef = useRef<Unsubscribe | null>(null);

  // Derived state
  const userId = user?.uid ?? null;
  const isHost = room?.hostId === userId;
  const isConnected = connectionState === "connected" && room !== null;
  const draftState = room?.draftState ?? null;

  // Get players and spectators as arrays
  const players: FirebasePlayer[] = room?.players
    ? Object.values(room.players)
    : [];
  const spectators: FirebasePlayer[] = room?.spectators
    ? Object.values(room.spectators)
    : [];

  /**
   * Initialize auth state listener on mount
   */
  useEffect(() => {
    setConnectionState("connecting");

    unsubscribeAuthRef.current = firebaseRoom.subscribeToAuthState((user) => {
      setUser(user);
      if (user) {
        setConnectionState("connected");
      } else {
        setConnectionState("disconnected");
      }
    });

    // Sign in anonymously on mount
    firebaseRoom.signInAnonymouslyIfNeeded().catch((err) => {
      console.error("Auth error:", err);
      setError(err instanceof Error ? err : new Error("Authentication failed"));
      setConnectionState("error");
    });

    return () => {
      unsubscribeAuthRef.current?.();
    };
  }, []);

  /**
   * Cleanup subscriptions on unmount
   */
  useEffect(() => {
    return () => {
      unsubscribeRoomRef.current?.();
      unsubscribeActionsRef.current?.();
    };
  }, []);

  /**
   * Handler for pending actions (host only)
   * Ref to avoid stale closure on room state
   */
  const pendingActionHandlerRef = useRef<
    ((action: FirebasePendingAction) => void) | null
  >(null);

  /**
   * Set external handler for pending actions
   * The Draft component should set this to process actions
   */
  const handlePendingAction = useCallback(
    (action: FirebasePendingAction) => {
      if (pendingActionHandlerRef.current) {
        pendingActionHandlerRef.current(action);
      }

      // Auto-delete processed action
      if (roomCode) {
        firebaseRoom.removeProcessedAction(roomCode, action.id).catch((err) => {
          console.error("Error removing processed action:", err);
        });
      }
    },
    [roomCode],
  );

  /**
   * Allows components to set a handler for pending actions
   * This is used by the Draft component to process player actions
   */
  const setPendingActionHandler = useCallback(
    (handler: ((action: FirebasePendingAction) => void) | null) => {
      pendingActionHandlerRef.current = handler;
    },
    [],
  );

  /**
   * Creates a new room
   */
  const createRoom = useCallback(
    async (data: CreateRoomData): Promise<RoomOperationResult<string>> => {
      setError(null);

      const result = await firebaseRoom.createRoom(data);

      if (result.success && result.data) {
        setRoomCode(result.data);

        // Subscribe to room updates
        unsubscribeRoomRef.current = firebaseRoom.subscribeToRoom(result.data, {
          onRoomUpdate: (room) => {
            console.log("[useFirebaseRoom] Room update (create)", {
              roomCode: result.data,
              draftState_phase: room?.draftState?.phase,
              draftState_currentTeam: room?.draftState?.currentTeam,
              draftState_multiplayer: room?.draftState?.multiplayer,
            });
            setRoom(room);
          },
          onError: (err) => {
            console.error("Room subscription error:", err);
            setError(err);
          },
        });

        // Host subscribes to pending actions
        unsubscribeActionsRef.current = firebaseRoom.subscribeToPendingActions(
          result.data,
          handlePendingAction,
        );
      } else {
        setError(new Error(result.error ?? "Failed to create room"));
      }

      return result;
    },
    [],
  );

  /**
   * Joins an existing room
   */
  const joinRoom = useCallback(
    async (data: JoinRoomData): Promise<RoomOperationResult> => {
      setError(null);

      const result = await firebaseRoom.joinRoom(data);

      if (result.success) {
        setRoomCode(data.roomCode);

        // Subscribe to room updates
        unsubscribeRoomRef.current = firebaseRoom.subscribeToRoom(
          data.roomCode,
          {
            onRoomUpdate: (room) => {
              console.log("[useFirebaseRoom] Room update (join)", {
                roomCode: data.roomCode,
                draftState_phase: room?.draftState?.phase,
                draftState_currentTeam: room?.draftState?.currentTeam,
                draftState_multiplayer: room?.draftState?.multiplayer,
              });
              setRoom(room);
            },
            onError: (err) => {
              console.error("Room subscription error:", err);
              setError(err);
            },
          },
        );

        // Host also subscribes to pending actions (important for reconnection)
        if (data.connectionType === "host") {
          console.log(
            "[useFirebaseRoom] Host rejoining - subscribing to pending actions",
          );
          unsubscribeActionsRef.current =
            firebaseRoom.subscribeToPendingActions(
              data.roomCode,
              handlePendingAction,
            );
        }
      } else {
        console.error("Failed to join room:", result.error);
        setError(new Error(result.error ?? "Failed to join room"));
      }

      return result;
    },
    [],
  );

  /**
   * Leaves the current room
   */
  const leaveRoom = useCallback(async (): Promise<void> => {
    if (roomCode) {
      await firebaseRoom.leaveRoom(roomCode);
    }

    // Cleanup subscriptions
    unsubscribeRoomRef.current?.();
    unsubscribeActionsRef.current?.();
    unsubscribeRoomRef.current = null;
    unsubscribeActionsRef.current = null;

    // Reset state
    setRoom(null);
    setRoomCode(null);
    setError(null);
  }, [roomCode]);

  /**
   * Updates the draft state (host only)
   */
  const updateDraftState = useCallback(
    async (newState: DraftState): Promise<void> => {
      if (!roomCode) {
        console.error("Cannot update draft state: not in a room");
        return;
      }

      if (!isHost) {
        console.error("Cannot update draft state: not the host");
        return;
      }

      try {
        await firebaseRoom.updateDraftState(roomCode, newState);
      } catch (err) {
        console.error("Error updating draft state:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to update state"),
        );
      }
    },
    [roomCode, isHost],
  );

  /**
   * Sends an action to the host (for non-host players)
   */
  const sendAction = useCallback(
    async (action: DraftActionPayload): Promise<void> => {
      if (!roomCode) {
        console.error("Cannot send action: not in a room");
        return;
      }

      try {
        await firebaseRoom.sendAction(roomCode, action);
      } catch (err) {
        console.error("Error sending action:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to send action"),
        );
      }
    },
    [roomCode],
  );

  return {
    // Room management
    createRoom,
    joinRoom,
    leaveRoom,

    // State
    room,
    draftState,
    isHost,
    isConnected,
    connectionState,
    players,
    spectators,
    error,

    // User info
    userId,
    roomCode,

    // Actions
    updateDraftState,
    sendAction,
    setPendingActionHandler,
  };
}

export default useFirebaseRoom;
