import type { ConnectionStatus, ConnectionError } from "../types/multiplayer";
import { ConnectionError as ErrorType } from "../types/multiplayer";
import { formatRoomCode } from "../utils/roomCode";

interface ConnectionStatusProps {
  /** Current connection status */
  status: ConnectionStatus;
  /** Room code to display (if hosting or joined) */
  roomCode?: string;
  /** Number of connected players */
  playerCount: number;
  /** Number of connected spectators */
  spectatorCount: number;
  /** Current error (if any) */
  error?: ConnectionError | null;
  /** Error message */
  errorMessage?: string | null;
  /** Whether the local peer is the host */
  isHost: boolean;
}

/**
 * Displays the current multiplayer connection status
 * 
 * Shows connection state, room code, player/spectator counts, and errors.
 * Uses color indicators for quick status recognition.
 */
export default function ConnectionStatus({
  status,
  roomCode,
  playerCount,
  spectatorCount,
  error,
  errorMessage,
  isHost,
}: ConnectionStatusProps) {
  /**
   * Gets the color class for the connection status
   */
  const getStatusColor = (): string => {
    switch (status) {
      case "connected":
        return "text-green-400";
      case "connecting":
      case "reconnecting":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      case "disconnected":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  /**
   * Gets the status text to display
   */
  const getStatusText = (): string => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "reconnecting":
        return "Reconnecting...";
      case "error":
        return "Connection Error";
      case "disconnected":
        return "Disconnected";
      default:
        return "Unknown";
    }
  };

  /**
   * Gets the status indicator (dot)
   */
  const getStatusIndicator = () => {
    const baseClass = "inline-block w-2 h-2 rounded-full mr-2";
    switch (status) {
      case "connected":
        return <span className={`${baseClass} bg-green-400 animate-pulse`} />;
      case "connecting":
      case "reconnecting":
        return <span className={`${baseClass} bg-yellow-400 animate-pulse`} />;
      case "error":
        return <span className={`${baseClass} bg-red-400`} />;
      case "disconnected":
        return <span className={`${baseClass} bg-gray-400`} />;
      default:
        return null;
    }
  };

  /**
   * Copies room code to clipboard
   */
  const handleCopyRoomCode = async () => {
    if (!roomCode) return;
    
    try {
      await navigator.clipboard.writeText(roomCode);
      // Could add a toast notification here in the future
      console.log("Room code copied to clipboard");
    } catch (error) {
      console.error("Failed to copy room code:", error);
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700">
      {/* Status Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          {getStatusIndicator()}
          <span className={`font-semibold ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {/* Room Code Display - show even while connecting so host can share */}
        {roomCode && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Room Code:</span>
            <button
              onClick={handleCopyRoomCode}
              className="font-mono text-lg font-bold text-blue-400 hover:text-blue-300 transition-colors px-3 py-1 bg-gray-700/50 rounded hover:bg-gray-700"
              title="Click to copy"
            >
              {formatRoomCode(roomCode)}
            </button>
          </div>
        )}
      </div>

      {/* Player/Spectator Counts */}
      {status === "connected" && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-gray-400">Players:</span>
            <span className="font-semibold text-white">{playerCount}</span>
          </div>
          {spectatorCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">Spectators:</span>
              <span className="font-semibold text-white">{spectatorCount}</span>
            </div>
          )}
          {isHost && (
            <div className="ml-auto">
              <span className="text-xs font-semibold text-purple-400 bg-purple-900/30 px-2 py-1 rounded">
                HOST
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && errorMessage && (
        <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded text-sm">
          <div className="flex items-start gap-2">
            <span className="text-red-400 font-semibold">Error:</span>
            <span className="text-red-300 flex-1">{errorMessage}</span>
          </div>
          {error === ErrorType.HOST_DISCONNECTED && (
            <div className="mt-2 text-xs text-red-400">
              The host has left the session. Please return to the menu.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
