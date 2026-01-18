import { useState } from "react";
import { formatRoomCode } from "../utils/roomCode";

interface WaitingRoomProps {
  /** Room code to display */
  roomCode: string;
  /** Team 1 name */
  team1Name: string;
  /** Team 2 name */
  team2Name: string;
  /** Whether the local player is the host */
  isHost: boolean;
  /** Number of players connected (including host) */
  playerCount: number;
  /** Number of spectators connected */
  spectatorCount: number;
  /** Callback when host clicks Start Draft */
  onStartDraft: () => void;
  /** Callback to leave/cancel */
  onLeave?: () => void;
}

/**
 * Waiting room component shown after team names are set
 * Displays room code and waits for players to join before starting
 */
export default function WaitingRoom({
  roomCode,
  team1Name,
  team2Name,
  isHost,
  playerCount,
  spectatorCount,
  onStartDraft,
  onLeave,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const canStart = playerCount >= 2;

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy room code:", err);
    }
  };

  return (
    <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex items-center justify-center px-6">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-10 border-2 border-gray-700 max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold mb-2 text-gray-100">Waiting Room</h1>
        <p className="text-gray-400 mb-8">Share the room code with your opponent</p>

        {/* Room Code Display */}
        <div className="bg-gray-900 rounded-xl p-6 mb-8 border border-gray-700">
          <p className="text-sm text-gray-400 mb-2">Room Code</p>
          <button
            onClick={handleCopyRoomCode}
            className={`text-5xl font-mono font-bold transition-colors tracking-wider ${
              copied ? 'text-green-400' : 'text-blue-400 hover:text-blue-300'
            }`}
            title="Click to copy"
          >
            {formatRoomCode(roomCode)}
          </button>
          <p className={`text-xs mt-2 transition-colors ${copied ? 'text-green-400' : 'text-gray-500'}`}>
            {copied ? '✓ Copied!' : 'Click to copy'}
          </p>
        </div>

        {/* Team Names */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <p className="text-xs text-blue-400 mb-1">Team 1</p>
            <p className="font-semibold text-blue-300">{team1Name}</p>
          </div>
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
            <p className="text-xs text-red-400 mb-1">Team 2</p>
            <p className="font-semibold text-red-300">{team2Name}</p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-gray-900/50 rounded-lg p-4 mb-8 border border-gray-700">
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${playerCount >= 2 ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
              <span className="text-gray-300">
                {playerCount}/2 Players
              </span>
            </div>
            {spectatorCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-400" />
                <span className="text-gray-300">
                  {spectatorCount} Spectator{spectatorCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
          {playerCount < 2 && (
            <p className="text-sm text-yellow-400/80 mt-3">
              Waiting for opponent to join...
            </p>
          )}
        </div>

        {/* Action Buttons */}
        {isHost ? (
          <div className="space-y-3">
            <button
              onClick={onStartDraft}
              disabled={!canStart}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all transform ${
                canStart
                  ? 'bg-green-600 hover:bg-green-500 text-white hover:scale-[1.02] shadow-lg'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {canStart ? 'Start Draft' : 'Waiting for Players...'}
            </button>
            {onLeave && (
              <button
                onClick={onLeave}
                className="w-full py-3 px-4 text-gray-400 hover:text-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-gray-700/50 rounded-xl p-4">
              <p className="text-gray-300">
                Waiting for host to start the draft...
              </p>
            </div>
            {onLeave && (
              <button
                onClick={onLeave}
                className="w-full py-3 px-4 text-gray-400 hover:text-gray-200 transition-colors text-sm"
              >
                Leave Room
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
