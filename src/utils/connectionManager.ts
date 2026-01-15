import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import type { PeerConnection } from "../types/multiplayer";
import { 
  PEER_SERVER_CONFIG, 
  CONNECTION_TIMEOUTS, 
  RETRY_CONFIG 
} from "../config/multiplayer";

/**
 * Creates a new PeerJS connection with error handling
 * 
 * Initializes a Peer instance with the configured server settings.
 * Implements timeout handling for initialization.
 * 
 * @param peerId - Optional specific peer ID (auto-generated if not provided)
 * @returns Promise that resolves to initialized Peer instance
 * @throws Error if initialization fails or times out
 * 
 * @example
 * const peer = await createPeerConnection();
 * console.log("My peer ID:", peer.id);
 */
export async function createPeerConnection(peerId?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = peerId ? new Peer(peerId, {
      host: PEER_SERVER_CONFIG.host,
      port: PEER_SERVER_CONFIG.port,
      path: PEER_SERVER_CONFIG.path,
      secure: PEER_SERVER_CONFIG.secure,
      debug: PEER_SERVER_CONFIG.debug,
    }) : new Peer({
      host: PEER_SERVER_CONFIG.host,
      port: PEER_SERVER_CONFIG.port,
      path: PEER_SERVER_CONFIG.path,
      secure: PEER_SERVER_CONFIG.secure,
      debug: PEER_SERVER_CONFIG.debug,
    });

    // Timeout for initialization
    const timeout = setTimeout(() => {
      peer.destroy();
      reject(new Error("Peer initialization timeout"));
    }, CONNECTION_TIMEOUTS.PEER_INIT);

    peer.on("open", () => {
      clearTimeout(timeout);
      resolve(peer);
    });

    peer.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Properly cleans up and closes a peer connection
 * 
 * Closes all data connections and destroys the peer instance.
 * Safe to call multiple times.
 * 
 * @param peer - The Peer instance to cleanup
 * @param connections - Optional array of DataConnections to close first
 * 
 * @example
 * cleanupConnection(myPeer, myConnections);
 */
export function cleanupConnection(
  peer: Peer | null,
  connections?: DataConnection[]
): void {
  // Close all data connections first
  if (connections && connections.length > 0) {
    connections.forEach((conn) => {
      if (conn && !conn.peerConnection) {
        try {
          conn.close();
        } catch (error) {
          console.error("Error closing connection:", error);
        }
      }
    });
  }

  // Destroy the peer
  if (peer && !peer.destroyed) {
    try {
      peer.destroy();
    } catch (error) {
      console.error("Error destroying peer:", error);
    }
  }
}

/**
 * Reconnects to a peer with exponential backoff
 * 
 * Attempts to reconnect with increasing delays between attempts.
 * Useful for handling temporary network issues.
 * 
 * @param connectFn - Function that attempts the connection
 * @param attempt - Current attempt number (used internally for recursion)
 * @returns Promise that resolves when connection succeeds
 * @throws Error if max attempts exceeded
 * 
 * @example
 * await reconnectWithBackoff(async () => {
 *   return await createPeerConnection("my-peer-id");
 * });
 */
export async function reconnectWithBackoff<T>(
  connectFn: () => Promise<T>,
  attempt: number = 1
): Promise<T> {
  try {
    return await connectFn();
  } catch (error) {
    if (attempt >= RETRY_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      throw new Error(
        `Failed to reconnect after ${RETRY_CONFIG.MAX_RECONNECT_ATTEMPTS} attempts`
      );
    }

    // Calculate backoff delay with exponential increase
    const baseDelay = RETRY_CONFIG.INITIAL_BACKOFF_MS;
    const multiplier = Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
    const delay = Math.min(
      baseDelay * multiplier,
      RETRY_CONFIG.MAX_BACKOFF_MS
    );

    console.log(
      `Reconnection attempt ${attempt} failed. Retrying in ${delay}ms...`,
      error
    );

    // Wait for backoff delay
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Retry with incremented attempt counter
    return reconnectWithBackoff(connectFn, attempt + 1);
  }
}

/**
 * Broadcasts a message to multiple peer connections
 * 
 * Sends the same data to all provided connections efficiently.
 * Handles individual connection failures gracefully without stopping.
 * 
 * @param connections - Array of PeerConnection objects to broadcast to
 * @param data - Data to send (must be JSON-serializable)
 * @returns Array of peer IDs that failed to receive the message
 * 
 * @example
 * const failedPeers = broadcastToConnections(spectators, stateUpdate);
 * if (failedPeers.length > 0) {
 *   console.log("Failed to send to:", failedPeers);
 * }
 */
export function broadcastToConnections(
  connections: PeerConnection[],
  data: unknown
): string[] {
  const failedPeers: string[] = [];

  connections.forEach((peerConn) => {
    try {
      if (peerConn.connection && peerConn.connection.open) {
        peerConn.connection.send(data);
      } else {
        failedPeers.push(peerConn.id);
      }
    } catch (error) {
      console.error(`Failed to send to peer ${peerConn.id}:`, error);
      failedPeers.push(peerConn.id);
    }
  });

  return failedPeers;
}

/**
 * Waits for a data connection to fully open
 * 
 * DataConnections may not be immediately ready after creation.
 * This function waits for the 'open' event or times out.
 * 
 * @param connection - The DataConnection to wait for
 * @param timeout - Maximum time to wait in milliseconds
 * @returns Promise that resolves when connection opens
 * @throws Error if connection fails or times out
 * 
 * @example
 * const conn = peer.connect(remotePeerId);
 * await waitForConnectionOpen(conn);
 * conn.send({ hello: "world" });
 */
export async function waitForConnectionOpen(
  connection: DataConnection,
  timeout: number = CONNECTION_TIMEOUTS.DATA_CONNECTION
): Promise<void> {
  if (connection.open) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Connection open timeout"));
    }, timeout);

    connection.on("open", () => {
      clearTimeout(timeoutId);
      resolve();
    });

    connection.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Filters peer connections by connection type
 * 
 * Helper to get specific types of connections (e.g., all spectators).
 * 
 * @param connections - Array of PeerConnection objects
 * @param type - Connection type to filter by
 * @returns Filtered array of connections
 * 
 * @example
 * const spectators = filterConnectionsByType(allConnections, "spectator");
 * const players = filterConnectionsByType(allConnections, "player");
 */
export function filterConnectionsByType(
  connections: PeerConnection[],
  type: "host" | "player" | "spectator"
): PeerConnection[] {
  return connections.filter((conn) => conn.type === type);
}

/**
 * Checks if a connection is still active
 * 
 * Verifies both the connection object and the underlying peer connection.
 * 
 * @param connection - PeerConnection to check
 * @returns true if connection is active and open
 * 
 * @example
 * if (!isConnectionActive(peerConn)) {
 *   // Remove from active connections list
 * }
 */
export function isConnectionActive(connection: PeerConnection): boolean {
  return (
    connection.connection !== null &&
    connection.connection !== undefined &&
    connection.connection.open === true
  );
}
