import { useState } from "react";
import { normalizeRoomCode, validateRoomCode } from "../utils/roomCode";

type RoomMode = "local" | "host" | "join" | "spectate";

interface RoomSetupProps {
  /** Callback when room is created (host mode) */
  onRoomCreated: (roomCode: string, format: "5v5" | "3v3v3") => void;
  /** Callback when joining a room (player mode) */
  onJoinRoom: (roomCode: string, playerName: string) => void;
  /** Callback when joining as spectator */
  onJoinAsSpectator: (roomCode: string, spectatorName: string) => void;
  /** Callback to go back/cancel */
  onBack?: () => void;
  /** Whether currently processing */
  isProcessing?: boolean;
}

/**
 * Room setup modal for multiplayer mode selection
 * 
 * Allows users to:
 * - Play locally (single device)
 * - Host a multiplayer room
 * - Join an existing room as player
 * - Join as spectator
 */
export default function RoomSetup({
  onRoomCreated,
  onJoinRoom,
  onJoinAsSpectator,
  onBack,
  isProcessing = false,
}: RoomSetupProps) {
  const [mode, setMode] = useState<RoomMode | null>(null);
  const [format, setFormat] = useState<"5v5" | "3v3v3">("5v5");
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles creating a new room
   */
  const handleCreateRoom = () => {
    setError(null);
    onRoomCreated(roomCode, format);
  };

  /**
   * Handles joining a room
   */
  const handleJoinRoom = () => {
    setError(null);

    const normalized = normalizeRoomCode(roomCode);
    
    if (!validateRoomCode(normalized)) {
      setError("Invalid room code. Must be 6 characters (letters and numbers).");
      return;
    }

    if (!playerName.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (mode === "join") {
      onJoinRoom(normalized, playerName.trim());
    } else if (mode === "spectate") {
      onJoinAsSpectator(normalized, playerName.trim());
    }
  };

  /**
   * Renders mode selection buttons
   */
  const renderModeSelection = () => (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold text-center mb-8 text-gray-100">Multiplayer Mode</h2>

      <button
        onClick={() => setMode("host")}
        className="w-full py-5 px-6 bg-purple-600/90 hover:bg-purple-600 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg border border-purple-500/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-lg">Host Room</span>
          <span className="text-sm text-purple-200 bg-purple-700/40 px-3 py-1 rounded-full">Create Multiplayer</span>
        </div>
      </button>

      <button
        onClick={() => setMode("join")}
        className="w-full py-5 px-6 bg-green-600/90 hover:bg-green-600 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg border border-green-500/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-lg">Join Room</span>
          <span className="text-sm text-green-200 bg-green-700/40 px-3 py-1 rounded-full">Play as Player</span>
        </div>
      </button>

      <button
        onClick={() => setMode("spectate")}
        className="w-full py-5 px-6 bg-gray-600/90 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg border border-gray-500/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-lg">Spectate</span>
          <span className="text-sm text-gray-300 bg-gray-700/40 px-3 py-1 rounded-full">Watch Only</span>
        </div>
      </button>

      {onBack && (
        <button
          onClick={onBack}
          className="w-full mt-6 py-3 px-4 text-gray-400 hover:text-gray-200 transition-colors text-sm"
        >
          ← Back to Format Selection
        </button>
      )}
    </div>
  );

  /**
   * Renders host setup form
   */
  const renderHostSetup = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center mb-6 text-white">Host Room</h2>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Draft Format
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setFormat("5v5")}
            className={`py-3 px-4 rounded-lg font-semibold transition-colors ${
              format === "5v5"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            5v5
            <div className="text-xs mt-1 opacity-80">2 Players</div>
          </button>
          <button
            disabled
            className="py-3 px-4 rounded-lg font-semibold transition-colors bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
          >
            3v3v3
            <div className="text-xs mt-1 opacity-80">Coming Soon</div>
          </button>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <p className="text-sm text-gray-300">
          You will receive a room code to share with other players after creating the room.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setMode(null)}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={handleCreateRoom}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? "Creating..." : "Create Room"}
        </button>
      </div>
    </div>
  );

  /**
   * Renders join/spectate form
   */
  const renderJoinSetup = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center mb-6 text-white">
        {mode === "join" ? "Join Room" : "Spectate Room"}
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Room Code
        </label>
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          className="w-full py-3 px-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-lg text-center"
          disabled={isProcessing}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Your Name
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder={mode === "join" ? "Player 1" : "Spectator"}
          maxLength={20}
          className="w-full py-3 px-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          disabled={isProcessing}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => {
            setMode(null);
            setError(null);
            setRoomCode("");
            setPlayerName("");
          }}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={handleJoinRoom}
          disabled={isProcessing}
          className={`flex-1 py-3 px-4 ${
            mode === "join"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-gray-600 hover:bg-gray-700"
          } text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isProcessing ? "Joining..." : mode === "join" ? "Join" : "Spectate"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-10 max-w-md w-full border-2 border-gray-700 shadow-2xl">
        {!mode && renderModeSelection()}
        {mode === "host" && renderHostSetup()}
        {(mode === "join" || mode === "spectate") && renderJoinSetup()}
      </div>
    </div>
  );
}
