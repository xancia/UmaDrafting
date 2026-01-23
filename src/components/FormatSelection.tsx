import { useState } from "react";
import RoomSetup from "./RoomSetup";

interface FormatSelectionProps {
  onSelectFormat: (format: "5v5" | "3v3v3", multiplayerConfig?: {
    roomCode: string;
    playerName: string;
    isHost: boolean;
    isSpectator: boolean;
  }) => void;
}

export default function FormatSelection({
  onSelectFormat,
}: FormatSelectionProps) {
  const [showRoomSetup, setShowRoomSetup] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<"5v5" | "3v3v3" | null>(null);

  const handleLocalMode = (format: "5v5" | "3v3v3") => {
    onSelectFormat(format);
  };

  const handleMultiplayerMode = (format: "5v5" | "3v3v3") => {
    setSelectedFormat(format);
    setShowRoomSetup(true);
  };

  const handleRoomCreated = (roomCode: string, format: "5v5" | "3v3v3") => {
    onSelectFormat(format, {
      roomCode,
      playerName: "Host",
      isHost: true,
      isSpectator: false,
    });
  };

  const handleJoinRoom = (roomCode: string, playerName: string) => {
    if (selectedFormat) {
      onSelectFormat(selectedFormat, {
        roomCode,
        playerName,
        isHost: false,
        isSpectator: false,
      });
    }
  };

  const handleJoinAsSpectator = (roomCode: string, spectatorName: string) => {
    if (selectedFormat) {
      onSelectFormat(selectedFormat, {
        roomCode,
        playerName: spectatorName,
        isHost: false,
        isSpectator: true,
      });
    }
  };

  if (showRoomSetup) {
    return (
      <RoomSetup
        onRoomCreated={handleRoomCreated}
        onJoinRoom={handleJoinRoom}
        onJoinAsSpectator={handleJoinAsSpectator}
        onBack={() => {
          setShowRoomSetup(false);
          setSelectedFormat(null);
        }}
      />
    );
  }

  return (
    <div className="flex-1 bg-linear-to-br from-gray-950 to-gray-900 flex items-center justify-center px-4 lg:px-6 overflow-hidden">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 lg:p-8 xl:p-12 border-2 border-gray-700 max-w-3xl w-full">
        <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-center mb-2 lg:mb-4 text-gray-100">
          Uma Drafter
        </h1>
        <p className="text-center text-gray-400 mb-6 lg:mb-8 xl:mb-12 text-sm lg:text-base xl:text-lg">
          Select your draft format to begin
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 xl:gap-8 mb-4 lg:mb-6 xl:mb-8">
          <div className="space-y-3 lg:space-y-4">
            <button
              onClick={() => handleLocalMode("5v5")}
              className="w-full group bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-blue-500 rounded-xl p-4 lg:p-5 xl:p-6 transition-all transform hover:scale-105 shadow-lg"
            >
              <div className="text-2xl lg:text-3xl xl:text-4xl font-bold text-blue-500 mb-1 lg:mb-2">5v5</div>
              <p className="text-gray-400 text-xs lg:text-sm mb-1 lg:mb-2">2 Teams • Local Draft</p>
              <p className="text-xs text-gray-500">Single Device</p>
            </button>
          </div>

          <div className="space-y-3 lg:space-y-4">
            <button
              onClick={() => handleLocalMode("3v3v3")}
              className="w-full group bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-purple-500 rounded-xl p-4 lg:p-5 xl:p-6 transition-all transform hover:scale-105 shadow-lg"
            >
              <div className="text-2xl lg:text-3xl xl:text-4xl font-bold text-purple-500 mb-1 lg:mb-2">3v3v3</div>
              <p className="text-gray-400 text-xs lg:text-sm mb-1 lg:mb-2">3 Teams • Local Draft</p>
              <p className="text-xs text-gray-500">Single Device</p>
            </button>
          </div>
        </div>

        <div className="mt-4 lg:mt-6">
          <button
            onClick={() => handleMultiplayerMode("5v5")}
            className="w-full group bg-purple-900/30 hover:bg-purple-900/50 border-2 border-purple-700 hover:border-purple-500 rounded-xl p-4 lg:p-5 xl:p-6 transition-all transform hover:scale-105 shadow-lg"
          >
            <div className="text-xl lg:text-2xl font-bold text-purple-400 mb-1 lg:mb-2">Multiplayer</div>
            <p className="text-gray-400 text-xs lg:text-sm">Host or Join Online (5v5)</p>
          </button>
        </div>

        <div className="mt-4 lg:mt-6 xl:mt-8 text-center text-xs text-gray-500">
          Made by{" "}
          <a
            href="https://github.com/xancia"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Terumi (xancia)
          </a>{" "}
          and{" "}
          <a
            href="https://discord.gg/CWEgfQBRSK"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Umamusume Tournaments Discord
          </a>
        </div>
      </div>
    </div>
  );
}
