import { useState, useCallback, useEffect, useRef } from "react";
import type { DraftState } from "../types";
import type {
  RoomState,
  PeerConnection,
  MessageType,
  NetworkMessage,
  StateSyncPayload,
  DraftActionPayload,
} from "../types/multiplayer";
import {
  createMessage,
  serializeMessage,
  isStateSyncPayload,
  isDraftActionPayload,
} from "../utils/messageSerializer";
import { broadcastToConnections } from "../utils/connectionManager";
import { SYNC_CONFIG } from "../config/multiplayer";
import { parseError, formatErrorForLogging } from "../utils/errorHandlers";

/**
 * Validates draft state structure
 */
function validateDraftState(state: DraftState): boolean {
  if (!state || typeof state !== "object") {
    return false;
  }

  // Check required fields
  if (!state.phase || !state.currentTeam) {
    return false;
  }

  // Check teams structure
  if (!state.team1 || !state.team2) {
    return false;
  }

  // Check team structure
  const validateTeam = (team: any): boolean => {
    return (
      Array.isArray(team.pickedUmas) &&
      Array.isArray(team.bannedUmas) &&
      Array.isArray(team.pickedMaps) &&
      Array.isArray(team.bannedMaps)
    );
  };

  if (!validateTeam(state.team1) || !validateTeam(state.team2)) {
    return false;
  }

  return true;
}

/**
 * Calculates a simple checksum for state validation
 */
function calculateStateChecksum(state: DraftState): string {
  const stateString = JSON.stringify({
    phase: state.phase,
    currentTeam: state.currentTeam,
    team1Picks: state.team1.pickedUmas.length,
    team1Bans: state.team1.bannedUmas.length,
    team2Picks: state.team2.pickedUmas.length,
    team2Bans: state.team2.bannedUmas.length,
  });

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < stateString.length; i++) {
    const char = stateString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString(36);
}

/**
 * Return type for useDraftSync hook
 */
interface UseDraftSyncResult {
  /** Synchronized draft state */
  draftState: DraftState;
  /** Updates draft state and syncs to all peers */
  updateDraftState: (newState: DraftState) => void;
  /** Sends a draft action to the host (non-host only) */
  sendDraftAction: (action: DraftActionPayload) => void;
  /** Forces a state sync from host to all peers */
  forceSync: () => void;
  /** Current state version number */
  version: number;
  /** Whether there's a pending state update */
  isSyncing: boolean;
  /** Count of sync errors encountered */
  syncErrorCount: number;
  /** Subscribe to incoming draft actions (host only - to process client actions) */
  onDraftAction: (
    handler: (action: DraftActionPayload, senderId: string) => void,
  ) => () => void;
}

/**
 * Custom hook for synchronizing draft state across multiplayer connections
 *
 * Handles state updates, broadcasting, conflict resolution, and debouncing.
 * Host is always the source of truth for state.
 *
 * @param roomState - Current room state from useRoom
 * @param isHost - Whether the local peer is the host
 * @param connections - All peer connections
 * @param peerId - Local peer ID
 * @param onMessage - Message handler from useMultiplayerConnections
 * @returns UseDraftSyncResult with synchronized state and control methods
 *
 * @example
 * const { draftState, updateDraftState } = useDraftSync(
 *   roomState,
 *   isHost,
 *   connections,
 *   peerId,
 *   onRoomMessage
 * );
 *
 * // Update state (host only)
 * if (isHost) {
 *   updateDraftState(newState);
 * }
 */
export function useDraftSync(
  roomState: RoomState | null,
  isHost: boolean,
  getConnections: () => PeerConnection[],
  peerId: string | undefined,
  onMessage: (
    handler: (message: NetworkMessage, senderId: string) => void,
  ) => () => void,
  sendToHost?: (message: string) => boolean,
): UseDraftSyncResult {
  const [draftState, setDraftState] = useState<DraftState>(
    () =>
      roomState?.draftState || {
        phase: "map-pick",
        currentTeam: "team1",
        team1: {
          pickedUmas: [],
          bannedUmas: [],
          pickedMaps: [],
          bannedMaps: [],
        },
        team2: {
          pickedUmas: [],
          bannedUmas: [],
          pickedMaps: [],
          bannedMaps: [],
        },
        availableUmas: [],
        availableMaps: [],
        wildcardMap: {} as any,
      },
  );
  const [version, setVersion] = useState<number>(roomState?.version || 1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastValidatedChecksum, setLastValidatedChecksum] =
    useState<string>("");
  const [syncErrorCount, setSyncErrorCount] = useState<number>(0);

  // Debounce timer for state updates
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the last broadcasted state to avoid duplicate syncs
  const lastBroadcastedStateRef = useRef<string>("");

  // Use ref for version to avoid stale closures in debounced callbacks
  const versionRef = useRef<number>(roomState?.version || 1);

  // Periodic validation timer
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draft action handlers (for host to receive client actions)
  const draftActionHandlersRef = useRef<
    Set<(action: DraftActionPayload, senderId: string) => void>
  >(new Set());

  /**
   * Subscribe to incoming draft actions (host only)
   */
  const onDraftAction = useCallback(
    (
      handler: (action: DraftActionPayload, senderId: string) => void,
    ): (() => void) => {
      draftActionHandlersRef.current.add(handler);
      return () => {
        draftActionHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  /**
   * Broadcasts current state to all connections
   */
  const broadcastState = useCallback(
    (state: DraftState, currentVersion: number) => {
      const connections = getConnections();
      console.log(
        "broadcastState called, connections:",
        connections.length,
        "peerId:",
        peerId,
      );
      if (!peerId || connections.length === 0) {
        console.log(
          "broadcastState early return - no peerId or no connections",
        );
        return;
      }

      const stateString = JSON.stringify(state);

      // Skip if state hasn't changed
      if (stateString === lastBroadcastedStateRef.current) {
        console.log("broadcastState skipped - state unchanged");
        return;
      }

      const syncMessage = createMessage(
        "state-sync" as MessageType,
        {
          draftState: state,
          version: currentVersion,
        } as StateSyncPayload,
        peerId,
      );

      const serialized = serializeMessage(syncMessage);
      const failedPeers = broadcastToConnections(connections, serialized);

      if (failedPeers.length > 0) {
        console.warn("Failed to sync state to peers:", failedPeers);
      } else {
        console.log("broadcastState success, version:", currentVersion);
      }

      lastBroadcastedStateRef.current = stateString;
    },
    [peerId, getConnections],
  );

  /**
   * Updates draft state and syncs to all peers (host only)
   */
  const updateDraftState = useCallback(
    (newState: DraftState) => {
      if (!isHost) {
        console.warn("Non-host attempted to update draft state");
        return;
      }

      setIsSyncing(true);
      setDraftState(newState);
      versionRef.current = versionRef.current + 1;
      const newVersion = versionRef.current;
      setVersion(newVersion);

      // Debounce rapid updates
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Broadcast immediately instead of debouncing to avoid stale closure issues
      const connections = getConnections();
      console.log("updateDraftState called, connections:", connections.length);

      if (peerId && connections.length > 0) {
        const stateString = JSON.stringify(newState);

        if (stateString !== lastBroadcastedStateRef.current) {
          const syncMessage = createMessage(
            "state-sync" as MessageType,
            {
              draftState: newState,
              version: newVersion,
            } as StateSyncPayload,
            peerId,
          );

          const serialized = serializeMessage(syncMessage);
          const failedPeers = broadcastToConnections(connections, serialized);

          if (failedPeers.length > 0) {
            console.warn("Failed to sync state to peers:", failedPeers);
          } else {
            console.log("Broadcast success, version:", newVersion);
          }

          lastBroadcastedStateRef.current = stateString;
        }
      }

      setIsSyncing(false);
    },
    [isHost, getConnections, peerId],
  );

  /**
   * Sends a draft action to the host (non-host only)
   */
  const sendDraftAction = useCallback(
    (action: DraftActionPayload) => {
      if (isHost) {
        console.warn("Host should update state directly, not send actions");
        return;
      }

      if (!peerId) {
        console.error("Cannot send action: no peer ID");
        return;
      }

      if (!sendToHost) {
        console.error("Cannot send action: sendToHost not available");
        return;
      }

      // Determine message type based on action
      let messageType: string;
      if (action.itemType === "uma") {
        messageType = "select-uma";
      } else if (action.itemType === "control") {
        messageType = "advance-phase";
      } else {
        messageType = "select-map";
      }

      const actionMessage = createMessage(
        messageType as MessageType,
        action,
        peerId,
      );

      const success = sendToHost(serializeMessage(actionMessage));
      if (success) {
        console.log("Sent draft action to host:", action);
      } else {
        console.error("Failed to send draft action to host");
      }
    },
    [isHost, peerId, sendToHost],
  );

  /**
   * Forces immediate state sync (host only)
   */
  const forceSync = useCallback(() => {
    if (!isHost) {
      return;
    }

    // Clear any pending debounced sync
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    broadcastState(draftState, version);
  }, [isHost, draftState, version, broadcastState]);

  /**
   * Handles incoming state sync messages (non-host only)
   */
  const handleStateSyncMessage = useCallback(
    (message: NetworkMessage) => {
      if (isHost) {
        // Host ignores incoming state syncs (host is source of truth)
        return;
      }

      if (!isStateSyncPayload(message.payload)) {
        console.error("Invalid state sync payload");
        setSyncErrorCount((prev) => prev + 1);
        return;
      }

      const { draftState: newState, version: newVersion } = message.payload;

      // Validate state structure
      if (!validateDraftState(newState)) {
        const error = parseError(new Error("Invalid state structure received"));
        console.error(formatErrorForLogging(error));
        setSyncErrorCount((prev) => prev + 1);
        return;
      }

      // Only apply if version is newer
      if (newVersion > version) {
        const checksum = calculateStateChecksum(newState);
        setDraftState(newState);
        setVersion(newVersion);
        setLastValidatedChecksum(checksum);
        setSyncErrorCount(0); // Reset error count on successful sync
        console.log(
          "State synced from host, version:",
          newVersion,
          "checksum:",
          checksum,
        );
      } else if (newVersion < version) {
        console.warn(
          "Received older state version, ignoring. Current:",
          version,
          "Received:",
          newVersion,
        );
      }
    },
    [isHost, version],
  );

  /**
   * Handles incoming draft action messages (host only)
   */
  const handleDraftActionMessage = useCallback(
    (message: NetworkMessage) => {
      if (!isHost) {
        // Non-host ignores draft actions (should go to host)
        return;
      }

      if (!isDraftActionPayload(message.payload)) {
        console.error("Invalid draft action payload");
        return;
      }

      console.log(
        "Received draft action from",
        message.senderId,
        message.payload,
      );

      // Emit to all registered handlers so Draft5v5 can process the action
      draftActionHandlersRef.current.forEach((handler) => {
        try {
          handler(message.payload as DraftActionPayload, message.senderId);
        } catch (error) {
          console.error("Error in draft action handler:", error);
        }
      });
    },
    [isHost],
  );

  /**
   * Subscribe to messages
   */
  useEffect(() => {
    return onMessage((message, senderId) => {
      console.log("Received message:", message.type, "from:", senderId);

      if (message.type === "state-sync") {
        handleStateSyncMessage(message);
      } else if (
        message.type === "select-uma" ||
        message.type === "select-map" ||
        message.type === "advance-phase"
      ) {
        handleDraftActionMessage(message);
      }
    });
  }, [onMessage, handleStateSyncMessage, handleDraftActionMessage]);

  /**
   * Initialize state from room state
   */
  useEffect(() => {
    if (roomState?.draftState) {
      setDraftState(roomState.draftState);
      setVersion(roomState.version);
    }
  }, [roomState?.draftState, roomState?.version]);

  /**
   * Cleanup debounce timer on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, []);

  /**
   * Periodic state validation (host only)
   */
  useEffect(() => {
    const connections = getConnections();
    if (!isHost || connections.length === 0) {
      return;
    }

    const runPeriodicValidation = () => {
      const currentChecksum = calculateStateChecksum(draftState);

      if (currentChecksum !== lastValidatedChecksum) {
        console.log("Periodic validation: state changed, forcing sync");
        forceSync();
        setLastValidatedChecksum(currentChecksum);
      }

      validationTimerRef.current = setTimeout(
        runPeriodicValidation,
        SYNC_CONFIG.VALIDATION_INTERVAL_MS,
      );
    };

    validationTimerRef.current = setTimeout(
      runPeriodicValidation,
      SYNC_CONFIG.VALIDATION_INTERVAL_MS,
    );

    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, [isHost, getConnections, draftState, lastValidatedChecksum, forceSync]);

  return {
    draftState,
    updateDraftState,
    sendDraftAction,
    forceSync,
    version,
    isSyncing,
    syncErrorCount,
    onDraftAction,
  };
}
