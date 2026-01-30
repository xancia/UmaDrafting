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
    <div className="space-y-3 lg:space-y-4">
      <h2 className="text-2xl lg:text-3xl font-bold text-center mb-4 lg:mb-6 text-gray-100">Multiplayer Mode</h2>

      <button
        onClick={() => setMode("host")}
        className="w-full group bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-purple-500 rounded-xl p-4 lg:p-5 transition-all transform hover:scale-105 shadow-lg"
      >
        <div className="text-xl lg:text-2xl font-bold text-purple-400 mb-1">Host Room</div>
        <p className="text-gray-400 text-xs lg:text-sm">Create a new multiplayer room</p>
      </button>

      <button
        onClick={() => setMode("join")}
        className="w-full group bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-green-500 rounded-xl p-4 lg:p-5 transition-all transform hover:scale-105 shadow-lg"
      >
        <div className="text-xl lg:text-2xl font-bold text-green-400 mb-1">Join Room</div>
        <p className="text-gray-400 text-xs lg:text-sm">Join as a player</p>
      </button>

      <button
        onClick={() => setMode("spectate")}
        className="w-full group bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-gray-500 rounded-xl p-4 lg:p-5 transition-all transform hover:scale-105 shadow-lg"
      >
        <div className="text-xl lg:text-2xl font-bold text-gray-300 mb-1">Spectate</div>
        <p className="text-gray-400 text-xs lg:text-sm">Watch the draft</p>
      </button>

      {onBack && (
        <button
          onClick={onBack}
          className="w-full mt-4 lg:mt-6 py-2 lg:py-3 px-4 text-gray-400 hover:text-gray-200 transition-colors text-xs lg:text-sm"
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
    <div className="space-y-3 lg:space-y-4">
      <h2 className="text-xl lg:text-2xl font-bold text-center mb-4 lg:mb-6 text-gray-100">Host Room</h2>

      <div>
        <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
          Draft Format
        </label>
        <div className="grid grid-cols-2 gap-2 lg:gap-3">
          <button
            onClick={() => setFormat("5v5")}
            className={`py-2 lg:py-3 px-3 lg:px-4 rounded-xl font-semibold transition-all border-2 ${
              format === "5v5"
                ? "bg-purple-600 text-white border-purple-500"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600"
            }`}
          >
            <div className="text-lg lg:text-xl font-bold">5v5</div>
            <div className="text-xs mt-0.5 opacity-80">2 Players</div>
          </button>
          <button
            disabled
            className="py-2 lg:py-3 px-3 lg:px-4 rounded-xl font-semibold bg-gray-800 text-gray-500 cursor-not-allowed opacity-50 border-2 border-gray-700"
          >
            <div className="text-lg lg:text-xl font-bold">3v3v3</div>
            <div className="text-xs mt-0.5 opacity-80">Coming Soon</div>
          </button>
        </div>
      </div>

      <div className="bg-gray-900/50 rounded-lg p-3 lg:p-4 border border-gray-700">
        <p className="text-xs lg:text-sm text-gray-400">
          You will receive a room code to share with other players after creating the room.
        </p>
      </div>

      {error && (
        <div className="p-2 lg:p-3 bg-red-900/20 border border-red-800 rounded-lg text-xs lg:text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-2 lg:gap-3 mt-4 lg:mt-6">
        <button
          onClick={() => setMode(null)}
          disabled={isProcessing}
          className="flex-1 py-2 lg:py-3 px-3 lg:px-4 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-xl transition-colors border-2 border-gray-600 text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={handleCreateRoom}
          disabled={isProcessing}
          className="flex-1 py-2 lg:py-3 px-3 lg:px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors border-2 border-blue-500 text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="space-y-3 lg:space-y-4">
      <h2 className="text-xl lg:text-2xl font-bold text-center mb-4 lg:mb-6 text-gray-100">
        {mode === "join" ? "Join Room" : "Spectate Room"}
      </h2>

      <div>
        <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-1.5 lg:mb-2">
          Room Code
        </label>
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          className="w-full py-2 lg:py-3 px-3 lg:px-4 bg-gray-700 text-gray-100 rounded-xl border-2 border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-base lg:text-lg text-center"
          disabled={isProcessing}
        />
      </div>

      <div>
        <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-1.5 lg:mb-2">
          Your Name
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder={mode === "join" ? "Player 1" : "Spectator"}
          maxLength={20}
          className="w-full py-2 lg:py-3 px-3 lg:px-4 bg-gray-700 text-gray-100 rounded-xl border-2 border-gray-600 focus:border-blue-500 focus:outline-none text-sm lg:text-base"
          disabled={isProcessing}
        />
      </div>

      {error && (
        <div className="p-2 lg:p-3 bg-red-900/20 border border-red-800 rounded-lg text-xs lg:text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-2 lg:gap-3 mt-4 lg:mt-6">
        <button
          onClick={() => {
            setMode(null);
            setError(null);
            setRoomCode("");
            setPlayerName("");
          }}
          disabled={isProcessing}
          className="flex-1 py-2 lg:py-3 px-3 lg:px-4 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-xl transition-colors border-2 border-gray-600 text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={handleJoinRoom}
          disabled={isProcessing}
          className="flex-1 py-2 lg:py-3 px-3 lg:px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors border-2 border-blue-500 text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? "Joining..." : mode === "join" ? "Join" : "Spectate"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-linear-to-br from-gray-950 to-gray-900 flex items-center justify-center z-50 px-4 lg:px-6">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 lg:p-8 xl:p-10 border-2 border-gray-700 max-w-md w-full">
        {!mode && renderModeSelection()}
        {mode === "host" && renderHostSetup()}
        {(mode === "join" || mode === "spectate") && renderJoinSetup()}
      </div>
    </div>
  );
}
