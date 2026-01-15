import { useState, useCallback, useEffect, useRef } from "react";
import type { 
  PeerConnection,
  ConnectionType,
  NetworkMessage,
} from "../types/multiplayer";
import { 
  isConnectionActive,
  filterConnectionsByType,
} from "../utils/connectionManager";
import { deserializeMessage } from "../utils/messageSerializer";

/**
 * Connection event types
 */
export type ConnectionEvent = 
  | { type: "connected"; connection: PeerConnection }
  | { type: "disconnected"; peerId: string }
  | { type: "message"; peerId: string; message: NetworkMessage }
  | { type: "error"; peerId: string; error: Error };

/**
 * Return type for useMultiplayerConnections hook
 */
interface UseMultiplayerConnectionsResult {
  /** All active connections */
  connections: PeerConnection[];
  /** Subscribe to connection events */
  onConnectionEvent: (handler: (event: ConnectionEvent) => void) => () => void;
  /** Add a new connection */
  addConnection: (connection: PeerConnection) => void;
  /** Remove a connection by peer ID */
  removeConnection: (peerId: string) => void;
  /** Get connections by type */
  getConnectionsByType: (type: ConnectionType) => PeerConnection[];
  /** Get a specific connection by peer ID */
  getConnection: (peerId: string) => PeerConnection | undefined;
  /** Check if a peer is connected */
  isConnected: (peerId: string) => boolean;
  /** Get count of active connections by type */
  getConnectionCount: (type?: ConnectionType) => number;
}

/**
 * Custom hook for managing multiple peer connections
 * 
 * Tracks connection state, handles events, and provides utilities
 * for working with multiple connections.
 * 
 * @returns UseMultiplayerConnectionsResult with connection management methods
 * 
 * @example
 * const { 
 *   connections, 
 *   onConnectionEvent, 
 *   addConnection,
 *   getConnectionsByType 
 * } = useMultiplayerConnections();
 * 
 * // Subscribe to events
 * useEffect(() => {
 *   return onConnectionEvent((event) => {
 *     if (event.type === "message") {
 *       handleMessage(event.message);
 *     }
 *   });
 * }, []);
 * 
 * // Get all players
 * const players = getConnectionsByType("player");
 */
export function useMultiplayerConnections(): UseMultiplayerConnectionsResult {
  const [connections, setConnections] = useState<PeerConnection[]>([]);
  
  // Event handlers subscribers
  const eventHandlersRef = useRef<Set<(event: ConnectionEvent) => void>>(new Set());

  /**
   * Emits an event to all subscribers
   */
  const emitEvent = useCallback((event: ConnectionEvent) => {
    eventHandlersRef.current.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in connection event handler:", error);
      }
    });
  }, []);

  /**
   * Sets up event listeners for a connection
   */
  const setupConnectionListeners = useCallback((peerConn: PeerConnection) => {
    const { connection } = peerConn;

    connection.on("data", (data) => {
      try {
        const message = deserializeMessage(data as string);
        emitEvent({
          type: "message",
          peerId: peerConn.id,
          message,
        });
      } catch (error) {
        console.error("Error deserializing message:", error);
        emitEvent({
          type: "error",
          peerId: peerConn.id,
          error: error instanceof Error ? error : new Error("Unknown error"),
        });
      }
    });

    connection.on("close", () => {
      console.log("Connection closed:", peerConn.id);
      emitEvent({
        type: "disconnected",
        peerId: peerConn.id,
      });
      
      // Remove from connections
      setConnections((prev) => prev.filter((c) => c.id !== peerConn.id));
    });

    connection.on("error", (error) => {
      console.error("Connection error:", peerConn.id, error);
      emitEvent({
        type: "error",
        peerId: peerConn.id,
        error,
      });
    });
  }, [emitEvent]);

  /**
   * Subscribe to connection events
   */
  const onConnectionEvent = useCallback((
    handler: (event: ConnectionEvent) => void
  ): (() => void) => {
    eventHandlersRef.current.add(handler);
    
    // Return unsubscribe function
    return () => {
      eventHandlersRef.current.delete(handler);
    };
  }, []);

  /**
   * Adds a new connection and sets up listeners
   */
  const addConnection = useCallback((connection: PeerConnection) => {
    setConnections((prev) => {
      // Check if already exists
      if (prev.some((c) => c.id === connection.id)) {
        console.warn("Connection already exists:", connection.id);
        return prev;
      }

      // Set up listeners
      setupConnectionListeners(connection);

      // Emit connected event
      emitEvent({
        type: "connected",
        connection,
      });

      return [...prev, connection];
    });
  }, [setupConnectionListeners, emitEvent]);

  /**
   * Removes a connection by peer ID
   */
  const removeConnection = useCallback((peerId: string) => {
    setConnections((prev) => {
      const conn = prev.find((c) => c.id === peerId);
      
      if (conn) {
        // Close connection if still open
        if (conn.connection && conn.connection.open) {
          try {
            conn.connection.close();
          } catch (error) {
            console.error("Error closing connection:", error);
          }
        }

        // Emit disconnected event
        emitEvent({
          type: "disconnected",
          peerId,
        });
      }

      return prev.filter((c) => c.id !== peerId);
    });
  }, [emitEvent]);

  /**
   * Gets connections filtered by type
   */
  const getConnectionsByType = useCallback((
    type: ConnectionType
  ): PeerConnection[] => {
    return filterConnectionsByType(connections, type);
  }, [connections]);

  /**
   * Gets a specific connection by peer ID
   */
  const getConnection = useCallback((peerId: string): PeerConnection | undefined => {
    return connections.find((c) => c.id === peerId);
  }, [connections]);

  /**
   * Checks if a peer is connected
   */
  const isConnected = useCallback((peerId: string): boolean => {
    const conn = connections.find((c) => c.id === peerId);
    return conn ? isConnectionActive(conn) : false;
  }, [connections]);

  /**
   * Gets count of active connections, optionally filtered by type
   */
  const getConnectionCount = useCallback((type?: ConnectionType): number => {
    if (type) {
      return getConnectionsByType(type).filter(isConnectionActive).length;
    }
    return connections.filter(isConnectionActive).length;
  }, [connections, getConnectionsByType]);

  /**
   * Cleanup: close all connections on unmount
   */
  useEffect(() => {
    return () => {
      connections.forEach((conn) => {
        try {
          if (conn.connection && conn.connection.open) {
            conn.connection.close();
          }
        } catch (error) {
          console.error("Error closing connection on cleanup:", error);
        }
      });
    };
  }, []); // Empty dependency - only run on unmount

  return {
    connections,
    onConnectionEvent,
    addConnection,
    removeConnection,
    getConnectionsByType,
    getConnection,
    isConnected,
    getConnectionCount,
  };
}
