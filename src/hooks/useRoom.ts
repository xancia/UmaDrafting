import { useState, useCallback, useRef, useEffect } from "react";
import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import type { 
  RoomState, 
  PeerConnection,
  ConnectionType,
  MessageType,
} from "../types/multiplayer";
import { getInitialDraftState } from "../draftLogic";
import { generateRoomCode, validateRoomCode, normalizeRoomCode } from "../utils/roomCode";
import { 
  waitForConnectionOpen,
  filterConnectionsByType,
  isConnectionActive,
} from "../utils/connectionManager";
import { CONNECTION_TIMEOUTS, ROOM_LIMITS } from "../config/multiplayer";
import { 
  createMessage, 
  serializeMessage, 
  deserializeMessage,
  isJoinRequestPayload,
  isJoinAcceptedPayload,
  isJoinRejectedPayload,
} from "../utils/messageSerializer";

/**
 * Return type for useRoom hook
 */
interface UseRoomResult {
  /** Current room state (null if not in a room) */
  roomState: RoomState | null;
  /** Whether this peer is the host */
  isHost: boolean;
  /** Local peer's connection type */
  connectionType: ConnectionType | null;
  /** Creates a new room as host, optionally with initial draft state */
  createRoom: (format: "5v5" | "3v3v3", initialDraftState?: ReturnType<typeof getInitialDraftState>) => Promise<string>;
  /** Joins an existing room */
  joinRoom: (roomCode: string, label: string, asSpectator?: boolean) => Promise<void>;
  /** Leaves the current room */
  leaveRoom: () => void;
  /** Gets all active player connections */
  getPlayers: () => PeerConnection[];
  /** Gets all active spectator connections */
  getSpectators: () => PeerConnection[];
  /** Subscribe to room messages (for both host and client) */
  onRoomMessage: (handler: (message: any, senderId: string) => void) => () => void;
  /** Send a message to the host (for non-host clients) */
  sendToHost: (message: string) => boolean;
  /** Updates the room's draft state (host only) */
  updateRoomDraftState: (newDraftState: any) => void;
  /** Gets all active connections with DataConnection objects (for broadcasting) */
  getAllConnections: () => PeerConnection[];
}

/**
 * Custom hook for managing room lifecycle (create, join, leave)
 * 
 * Handles host and client logic for multiplayer rooms.
 * Must be used together with usePeer hook.
 * 
 * @param peer - PeerJS instance from usePeer hook
 * @param peerId - Local peer ID from usePeer hook
 * @returns UseRoomResult with room state and control methods
 * 
 * @example
 * const { peer, peerId } = usePeer();
 * const { roomState, createRoom, joinRoom, leaveRoom } = useRoom(peer, peerId);
 * 
 * // Host creates room
 * const code = await createRoom("5v5");
 * 
 * // Player joins room
 * await joinRoom(code, "Player 1");
 */
export function useRoom(
  peer: Peer | null,
  peerId: string | undefined
): UseRoomResult {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType | null>(null);
  
  // Keep a ref to roomState for use in connection handlers (avoids stale closures)
  const roomStateRef = useRef<RoomState | null>(null);
  
  // Track all peer connections
  const connectionsRef = useRef<PeerConnection[]>([]);
  
  // Track host connection (for non-host clients)
  const hostConnectionRef = useRef<DataConnection | null>(null);

  // Message handlers for room events
  const messageHandlersRef = useRef<Set<(message: any, senderId: string) => void>>(new Set());

  /**
   * Emit a message to all handlers
   */
  const emitMessage = useCallback((message: any, senderId: string) => {
    messageHandlersRef.current.forEach((handler) => {
      try {
        handler(message, senderId);
      } catch (error) {
        console.error("Error in room message handler:", error);
      }
    });
  }, []);

  /**
   * Subscribe to room messages
   */
  const onRoomMessage = useCallback((handler: (message: any, senderId: string) => void): (() => void) => {
    messageHandlersRef.current.add(handler);
    return () => {
      messageHandlersRef.current.delete(handler);
    };
  }, []);

  // Sync roomStateRef with roomState
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  /**
   * Updates the room's draft state (host only)
   * This ensures new joiners receive the current draft state
   */
  const updateRoomDraftState = useCallback((newDraftState: any) => {
    if (roomStateRef.current) {
      roomStateRef.current = {
        ...roomStateRef.current,
        draftState: newDraftState,
      };
      setRoomState(roomStateRef.current);
    }
  }, []);

  /**
   * Creates a new room as host
   */
  const createRoom = useCallback(async (
    format: "5v5" | "3v3v3",
    initialDraftState?: ReturnType<typeof getInitialDraftState>
  ): Promise<string> => {
    if (!peer) {
      throw new Error("Peer not initialized");
    }

    // Use the peer ID as the room code (it's already set when peer opens)
    const roomCode = peerId || generateRoomCode();
    // Use provided draft state or generate new one
    const initialState = initialDraftState || getInitialDraftState();

    const newRoomState: RoomState = {
      roomId: roomCode,
      hostId: roomCode,
      connections: [],
      draftState: initialState,
      draftFormat: format,
      status: "waiting",
      version: 1,
    };

    setRoomState(newRoomState);
    setConnectionType("host");
    
    // Set up listener for incoming connections - use a wrapper to get current state
    peer.on("connection", (conn) => {
      // Use roomStateRef.current to always get the latest state
      const currentState = roomStateRef.current || newRoomState;
      handleIncomingConnection(conn, currentState);
    });
    
    // Also update the ref immediately
    roomStateRef.current = newRoomState;

    console.log("Room created:", roomCode);
    return roomCode;
  }, [peer, peerId]);

  /**
   * Handles incoming peer connections (host only)
   */
  const handleIncomingConnection = useCallback((
    conn: DataConnection,
    currentRoomState: RoomState
  ) => {
    console.log("Incoming connection from:", conn.peer);

    conn.on("open", () => {
      console.log("Connection opened with:", conn.peer);
    });

    conn.on("data", (data) => {
      try {
        const message = deserializeMessage(data as string);
        console.log("Host received message:", message.type, "from:", conn.peer);
        
        if (message.type === "join-request") {
          console.log("Processing join request:", message.payload);
          if (!isJoinRequestPayload(message.payload)) {
            conn.send(serializeMessage(createMessage(
              "join-rejected" as MessageType,
              { reason: "Invalid join request" },
              peerId || ""
            )));
            conn.close();
            return;
          }

          const { connectionType: reqType, label } = message.payload;
          
          // Check capacity
          const players = filterConnectionsByType(connectionsRef.current, "player");
          const spectators = filterConnectionsByType(connectionsRef.current, "spectator");
          
          const maxPlayers = currentRoomState.draftFormat === "5v5" 
            ? ROOM_LIMITS.MAX_PLAYERS_5V5 
            : ROOM_LIMITS.MAX_PLAYERS_3V3V3;
          
          if (reqType === "player" && players.length >= maxPlayers) {
            conn.send(serializeMessage(createMessage(
              "join-rejected" as MessageType,
              { reason: "Room is full (players)" },
              peerId || ""
            )));
            conn.close();
            return;
          }
          
          if (reqType === "spectator" && spectators.length >= ROOM_LIMITS.MAX_SPECTATORS) {
            conn.send(serializeMessage(createMessage(
              "join-rejected" as MessageType,
              { reason: "Too many spectators" },
              peerId || ""
            )));
            conn.close();
            return;
          }

          // Accept connection
          const newConnection: PeerConnection = {
            id: conn.peer,
            type: reqType,
            label,
            connection: conn,
          };

          connectionsRef.current.push(newConnection);

          // Create serializable room state (exclude connection objects)
          const serializableRoomState = {
            ...currentRoomState,
            connections: connectionsRef.current.map(c => ({
              id: c.id,
              type: c.type,
              label: c.label,
              // Exclude the actual DataConnection object
            })),
          };

          // Send acceptance with current room state
          conn.send(serializeMessage(createMessage(
            "join-accepted" as MessageType,
            {
              roomState: serializableRoomState,
              yourId: conn.peer,
            },
            peerId || ""
          )));

          // Update room state with new connection
          setRoomState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              connections: [...connectionsRef.current],
            };
          });

          console.log(`${reqType} joined:`, label);
        } else {
          // Emit other messages (like draft actions from clients)
          emitMessage(message, conn.peer);
        }
      } catch (error) {
        console.error("Error handling incoming data:", error);
      }
    });

    conn.on("close", () => {
      console.log("Connection closed:", conn.peer);
      // Remove from connections
      connectionsRef.current = connectionsRef.current.filter(
        (c) => c.id !== conn.peer
      );
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          connections: [...connectionsRef.current],
        };
      });
    });

    conn.on("error", (error) => {
      console.error("Connection error:", conn.peer, error);
    });
  }, [peerId]);

  /**
   * Joins an existing room as player or spectator
   */
  const joinRoom = useCallback(async (
    roomCode: string,
    label: string,
    asSpectator: boolean = false
  ): Promise<void> => {
    if (!peer || !peerId) {
      throw new Error("Peer not initialized");
    }

    console.log(`Joining room ${roomCode} as ${asSpectator ? "spectator" : "player"} with label: ${label}`);

    const normalizedCode = normalizeRoomCode(roomCode);
    
    if (!validateRoomCode(normalizedCode)) {
      throw new Error("Invalid room code format");
    }

    // Connect to host (room code = host peer ID)
    const conn = peer.connect(normalizedCode);
    hostConnectionRef.current = conn;

    // Wait for connection to open
    await waitForConnectionOpen(conn);

    // Send join request
    const joinRequest = createMessage(
      "join-request" as MessageType,
      {
        connectionType: asSpectator ? "spectator" : "player",
        label,
      },
      peerId
    );

    conn.send(serializeMessage(joinRequest));

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        conn.close();
        reject(new Error("Join request timeout"));
      }, CONNECTION_TIMEOUTS.JOIN_RESPONSE);

      let hasJoined = false;

      conn.on("data", (data) => {
        try {
          const message = deserializeMessage(data as string);
          
          if (message.type === "join-accepted") {
            clearTimeout(timeout);
            
            if (!isJoinAcceptedPayload(message.payload)) {
              reject(new Error("Invalid join accepted payload"));
              return;
            }

            const { roomState: receivedRoomState } = message.payload;
            setRoomState(receivedRoomState);
            setConnectionType(asSpectator ? "spectator" : "player");
            hasJoined = true;
            
            console.log("Joined room:", normalizedCode);
            resolve();
          } else if (message.type === "join-rejected") {
            clearTimeout(timeout);
            
            if (!isJoinRejectedPayload(message.payload)) {
              reject(new Error("Join rejected"));
              return;
            }

            conn.close();
            reject(new Error(message.payload.reason));
          } else if (hasJoined) {
            // After joining, emit all other messages (like state-sync)
            emitMessage(message, message.senderId || normalizedCode);
          }
        } catch (error) {
          if (!hasJoined) {
            clearTimeout(timeout);
            conn.close();
            reject(error);
          } else {
            console.error("Error handling message after join:", error);
          }
        }
      });

      conn.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      conn.on("close", () => {
        if (!hasJoined) {
          clearTimeout(timeout);
          reject(new Error("Connection closed unexpectedly"));
        } else {
          console.log("Host connection closed");
        }
      });
    });
  }, [peer, peerId, emitMessage]);

  /**
   * Leaves the current room
   */
  const leaveRoom = useCallback(() => {
    // Close all connections
    if (connectionType === "host") {
      // Host closes all client connections
      connectionsRef.current.forEach((peerConn) => {
        try {
          peerConn.connection.close();
        } catch (error) {
          console.error("Error closing connection:", error);
        }
      });
      connectionsRef.current = [];
    } else {
      // Client closes connection to host
      if (hostConnectionRef.current) {
        try {
          hostConnectionRef.current.close();
        } catch (error) {
          console.error("Error closing host connection:", error);
        }
        hostConnectionRef.current = null;
      }
    }

    // Only log if we were actually in a room
    if (roomState) {
      setRoomState(null);
      setConnectionType(null);
      console.log("Left room");
    }
  }, [roomState, connectionType]);

  /**
   * Gets all active player connections
   */
  const getPlayers = useCallback((): PeerConnection[] => {
    if (!roomState) return [];
    return filterConnectionsByType(connectionsRef.current, "player").filter(isConnectionActive);
  }, [roomState]);

  /**
   * Gets all active spectator connections
   */
  const getSpectators = useCallback((): PeerConnection[] => {
    if (!roomState) return [];
    return filterConnectionsByType(connectionsRef.current, "spectator").filter(isConnectionActive);
  }, [roomState]);

  /**
   * Gets all active connections (players and spectators) with DataConnection objects
   */
  const getAllConnections = useCallback((): PeerConnection[] => {
    return connectionsRef.current.filter(isConnectionActive);
  }, []);

  /**
   * Send a message to the host (for non-host clients)
   */
  const sendToHost = useCallback((message: string): boolean => {
    if (connectionType === "host") {
      console.warn("Host cannot send to itself");
      return false;
    }

    if (!hostConnectionRef.current || !hostConnectionRef.current.open) {
      console.error("Cannot send to host: no connection");
      return false;
    }

    try {
      hostConnectionRef.current.send(message);
      return true;
    } catch (error) {
      console.error("Failed to send to host:", error);
      return false;
    }
  }, [connectionType]);

  /**
   * Cleanup on unmount only
   */
  useEffect(() => {
    // Capture the cleanup function at mount time
    // Use refs to access current values without dependencies
    return () => {
      // Close all connections on unmount
      connectionsRef.current.forEach((peerConn) => {
        try {
          peerConn.connection.close();
        } catch (error) {
          console.error("Error closing connection:", error);
        }
      });
      connectionsRef.current = [];
      
      if (hostConnectionRef.current) {
        try {
          hostConnectionRef.current.close();
        } catch (error) {
          console.error("Error closing host connection:", error);
        }
        hostConnectionRef.current = null;
      }
    };
  }, []); // Empty deps - only run on mount/unmount

  return {
    roomState,
    isHost: connectionType === "host",
    connectionType,
    createRoom,
    joinRoom,
    leaveRoom,
    getPlayers,
    getSpectators,
    getAllConnections,
    onRoomMessage,
    sendToHost,
    updateRoomDraftState,
  };
}
