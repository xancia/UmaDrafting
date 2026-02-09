import { useState, useEffect } from "react";
import FormatSelection from "./components/FormatSelection";
import Draft5v5 from "./components/Draft5v5";
import Draft3v3v3 from "./components/Draft3v3v3";
import UnifiedTopBar from "./components/UnifiedTopBar";
import {
  getDraftSession,
  clearDraftSession,
  type DraftSession,
} from "./utils/sessionStorage";

type DraftFormat = "5v5" | "3v3v3" | null;

interface MultiplayerConfig {
  roomCode: string;
  playerName: string;
  isHost: boolean;
  isSpectator: boolean;
}

function App() {
  const [selectedFormat, setSelectedFormat] = useState<DraftFormat>(null);
  const [multiplayerConfig, setMultiplayerConfig] = useState<
    MultiplayerConfig | undefined
  >(undefined);
  const [pendingSession, setPendingSession] = useState<DraftSession | null>(
    null,
  );

  // Check for saved session on mount
  useEffect(() => {
    const session = getDraftSession();
    if (session) {
      setPendingSession(session);
    }
  }, []);

  // Handle reconnecting to a saved session
  const handleReconnect = () => {
    if (!pendingSession) return;

    setMultiplayerConfig({
      roomCode: pendingSession.roomCode,
      playerName: pendingSession.playerName,
      isHost: pendingSession.isHost,
      isSpectator: pendingSession.isSpectator,
    });
    setSelectedFormat(pendingSession.format);
    setPendingSession(null);
  };

  // Handle declining to reconnect
  const handleDeclineReconnect = () => {
    clearDraftSession();
    setPendingSession(null);
  };

  const handleSelectFormat = (
    format: "5v5" | "3v3v3",
    config?: MultiplayerConfig,
  ) => {
    setSelectedFormat(format);
    setMultiplayerConfig(config);
    // Clear any pending session when starting fresh
    setPendingSession(null);
  };

  const handleBackToMenu = () => {
    setSelectedFormat(null);
    setMultiplayerConfig(undefined);
  };

  if (selectedFormat === "5v5") {
    return (
      <Draft5v5
        onBackToMenu={handleBackToMenu}
        multiplayerConfig={multiplayerConfig}
      />
    );
  }

  if (selectedFormat === "3v3v3") {
    return (
      <Draft3v3v3
        onBackToMenu={handleBackToMenu}
        multiplayerConfig={multiplayerConfig}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <UnifiedTopBar currentApp="drafter" />
      {pendingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-6 border-2 border-gray-700 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-100 mb-4">
              Reconnect to Draft?
            </h2>
            <p className="text-gray-300 mb-2">
              You were in a draft session. Would you like to rejoin?
            </p>
            <div className="text-sm text-gray-400 mb-6 space-y-1">
              <p>
                <span className="text-gray-500">Room:</span>{" "}
                {pendingSession.roomCode}
              </p>
              <p>
                <span className="text-gray-500">Name:</span>{" "}
                {pendingSession.playerName}
              </p>
              <p>
                <span className="text-gray-500">Role:</span>{" "}
                {pendingSession.isHost
                  ? "Host"
                  : pendingSession.isSpectator
                    ? "Spectator"
                    : "Player 2"}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReconnect}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Rejoin
              </button>
              <button
                onClick={handleDeclineReconnect}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                New Draft
              </button>
            </div>
          </div>
        </div>
      )}
      <FormatSelection onSelectFormat={handleSelectFormat} />
    </div>
  );
}

export default App;
