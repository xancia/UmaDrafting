import { useState, useEffect, useCallback, useRef } from "react";
import Peer from "peerjs";
import type { ConnectionStatus } from "../types/multiplayer";
import { ConnectionError } from "../types/multiplayer";
import { 
  createPeerConnection, 
  cleanupConnection,
  reconnectWithBackoff 
} from "../utils/connectionManager";

/**
 * Return type for usePeer hook
 */
interface UsePeerResult {
  /** PeerJS instance (null if not initialized) */
  peer: Peer | null;
  /** Local peer ID (undefined until connected) */
  peerId: string | undefined;
  /** Current connection status */
  status: ConnectionStatus;
  /** Current error (null if none) */
  error: ConnectionError | null;
  /** Error message for display */
  errorMessage: string | null;
  /** Initializes the peer connection */
  initialize: (customPeerId?: string) => Promise<void>;
  /** Disconnects and cleans up the peer */
  disconnect: () => void;
  /** Attempts to reconnect */
  reconnect: () => Promise<void>;
}

/**
 * Custom hook for managing PeerJS connection lifecycle
 * 
 * Handles peer initialization, status tracking, error handling, and cleanup.
 * Follows React best practices for resource management.
 * 
 * @returns UsePeerResult object with peer instance, status, and control methods
 * 
 * @example
 * const { peer, peerId, status, initialize, disconnect } = usePeer();
 * 
 * useEffect(() => {
 *   initialize();
 *   return () => disconnect();
 * }, []);
 * 
 * if (status === "connected") {
 *   // Use peer.connect() etc.
 * }
 */
export function usePeer(): UsePeerResult {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<ConnectionError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Use ref to track if we're currently initializing to prevent double-init
  const isInitializing = useRef(false);
  const customPeerIdRef = useRef<string | undefined>(undefined);

  /**
   * Initializes the peer connection
   */
  const initialize = useCallback(async (customPeerId?: string) => {
    // Prevent double initialization
    if (isInitializing.current) {
      console.warn("Peer already initializing, skipping duplicate call");
      return;
    }
    
    if (peer && !peer.destroyed) {
      console.warn("Peer already initialized");
      return;
    }

    isInitializing.current = true;
    customPeerIdRef.current = customPeerId;
    setStatus("connecting");
    setError(null);
    setErrorMessage(null);

    console.log("Initializing peer connection...");

    try {
      // createPeerConnection already waits for 'open' event before resolving
      const newPeer = await createPeerConnection(customPeerId);
      
      // The peer is already open since createPeerConnection resolves on 'open'
      console.log("Peer connection opened:", newPeer.id);
      setPeerId(newPeer.id);
      setStatus("connected");
      isInitializing.current = false;

      // Set up event listeners for future events (disconnect, close, error)
      newPeer.on("disconnected", () => {
        console.log("Peer disconnected");
        setStatus("disconnected");
      });

      newPeer.on("close", () => {
        console.log("Peer connection closed");
        setStatus("disconnected");
        setPeerId(undefined);
      });

      newPeer.on("error", (err) => {
        console.error("Peer error:", err);
        setError("network-error");
        setErrorMessage(err.message || "An unknown error occurred");
        setStatus("error");
        isInitializing.current = false;
      });

      setPeer(newPeer);
    } catch (err) {
      console.error("Failed to initialize peer:", err);
      setError(ConnectionError.PEER_INIT_FAILED);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to initialize connection"
      );
      setStatus("error");
      isInitializing.current = false;
    }
  }, [peer]);

  /**
   * Disconnects and cleans up the peer
   */
  const disconnect = useCallback(() => {
    if (peer) {
      cleanupConnection(peer);
      setPeer(null);
      setPeerId(undefined);
      setStatus("disconnected");
      setError(null);
      setErrorMessage(null);
    }
  }, [peer]);

  /**
   * Attempts to reconnect using exponential backoff
   */
  const reconnect = useCallback(async () => {
    setStatus("reconnecting");
    setError(null);
    setErrorMessage(null);

    try {
      // Clean up old peer first
      if (peer) {
        cleanupConnection(peer);
        setPeer(null);
      }

      // Reconnect with backoff - createPeerConnection resolves when 'open' fires
      const newPeer = await reconnectWithBackoff(() => 
        createPeerConnection(customPeerIdRef.current)
      );

      // The peer is already open since createPeerConnection resolves on 'open'
      console.log("Peer reconnected:", newPeer.id);
      setPeerId(newPeer.id);
      setStatus("connected");

      // Set up event listeners for future events
      newPeer.on("disconnected", () => {
        setStatus("disconnected");
      });

      newPeer.on("close", () => {
        setStatus("disconnected");
        setPeerId(undefined);
      });

      newPeer.on("error", (err) => {
        console.error("Peer error:", err);
        setError(ConnectionError.NETWORK_ERROR);
        setErrorMessage(err.message || "An unknown error occurred");
        setStatus("error");
      });

      setPeer(newPeer);
    } catch (err) {
      console.error("Failed to reconnect:", err);
      setError(ConnectionError.NETWORK_ERROR);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to reconnect"
      );
      setStatus("error");
    }
  }, [peer]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (peer && !peer.destroyed) {
        cleanupConnection(peer);
      }
    };
  }, [peer]);

  return {
    peer,
    peerId,
    status,
    error,
    errorMessage,
    initialize,
    disconnect,
    reconnect,
  };
}
