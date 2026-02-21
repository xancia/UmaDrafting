import { useState } from "react";
import RoomSetup from "./RoomSetup";

interface FormatSelectionProps {
  onSelectFormat: (
    format: "5v5" | "3v3v3",
    multiplayerConfig?: {
      roomCode: string;
      playerName: string;
      isHost: boolean;
      isSpectator: boolean;
    },
  ) => void;
}

export default function FormatSelection({
  onSelectFormat,
}: FormatSelectionProps) {
  const [showRoomSetup, setShowRoomSetup] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<"5v5" | "3v3v3" | null>(
    null,
  );

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
          <button
            onClick={() => handleLocalMode("5v5")}
            className="w-full group bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-blue-500 rounded-xl p-4 lg:p-5 xl:p-6 transition-all transform hover:scale-105 shadow-lg"
          >
            <div className="text-2xl lg:text-3xl xl:text-4xl font-bold text-blue-500 mb-1 lg:mb-2">
              5v5
            </div>
            <p className="text-gray-400 text-xs lg:text-sm mb-1 lg:mb-2">
              2 Teams • Local Draft
            </p>
            <p className="text-xs text-gray-500">Single Device</p>
          </button>

          <button
            onClick={() => handleMultiplayerMode("5v5")}
            className="w-full group bg-purple-900/30 hover:bg-purple-900/50 border-2 border-purple-700 hover:border-purple-500 rounded-xl p-4 lg:p-5 xl:p-6 transition-all transform hover:scale-105 shadow-lg"
          >
            <div className="text-2xl lg:text-3xl xl:text-4xl font-bold text-purple-400 mb-1 lg:mb-2">
              5v5
            </div>
            <p className="text-gray-400 text-xs lg:text-sm mb-1 lg:mb-2">
              2 Teams • Online
            </p>
            <p className="text-xs text-gray-500">Multiplayer</p>
          </button>
        </div>

        <div className="mt-4 lg:mt-6">
          <button
            onClick={() => setShowHowToPlay(true)}
            className="w-full group bg-gray-700/50 hover:bg-gray-700 border-2 border-gray-600 hover:border-gray-500 rounded-xl p-3 lg:p-4 transition-all shadow-lg"
          >
            <div className="text-lg lg:text-xl font-bold text-gray-300 mb-0.5 lg:mb-1">
              How To Play
            </div>
            <p className="text-gray-500 text-xs lg:text-sm">
              Rules and draft order
            </p>
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

      {/* How To Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl mt-10 p-6 lg:p-8 border-2 border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-4 lg:mb-6">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-100">
                How To Play
              </h2>
              <button
                onClick={() => setShowHowToPlay(false)}
                className="text-gray-400 hover:text-gray-200 text-2xl"
              >
                X
              </button>
            </div>

            <div className="text-gray-300 space-y-6 text-sm lg:text-base">
              {/* Draft Order */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 mb-2">
                  Draft Order
                </h3>
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                  <p className="text-center text-gray-200">
                    Wildcard Reveal → Strategy Phase → Map Draft → Strategy
                    Phase → Uma Pre-Ban → Uma Draft
                  </p>
                </div>
              </div>

              {/* Drafting Rules */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 mb-2">
                  Drafting Rules
                </h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex gap-2">
                    <span className="text-blue-400">•</span>
                    <span>
                      <strong>Map Draft:</strong> Pick 4, Ban 1
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-400">•</span>
                    <span>
                      <strong>Uma Pre-Ban:</strong> Each team bans 1 uma from
                      the full pool (removed for both teams)
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-400">•</span>
                    <span>
                      <strong>Uma Draft:</strong> Pick 5, Ban 1, Pick 2
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-400">•</span>
                    <span>
                      <strong>Turn Timer:</strong> 60 seconds per selection
                    </span>
                  </li>
                </ul>
              </div>

              {/* Strategy Phase */}
              <div>
                <h3 className="text-lg font-bold text-purple-400 mb-2">
                  Strategy Phase
                </h3>
                <p className="text-gray-300">
                  After the wildcard map is revealed and after map selection is
                  complete, each team has{" "}
                  <strong className="text-purple-300">4 minutes</strong> to
                  discuss strategy. Ready up promptly when finished. If your
                  team needs more time, notify a tournament moderator.
                </p>
              </div>

              {/* Disconnection */}
              <div>
                <h3 className="text-lg font-bold text-yellow-400 mb-2">
                  Disconnection
                </h3>
                <p className="text-gray-300">
                  If you disconnect, you can reconnect immediately. If the
                  disconnection lasts for an extended period, please notify a
                  tournament moderator.
                </p>
              </div>

              {/* Racing Procedure */}
              <div>
                <h3 className="text-lg font-bold text-green-400 mb-2">
                  Racing Procedure
                </h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex gap-2">
                    <span className="text-green-400">•</span>
                    <span>After map draft, proceed to races</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-400">•</span>
                    <span>
                      <strong>Team 1 Captain:</strong> Creates first 5 races
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-400">•</span>
                    <span>
                      <strong>Team 2 Captain:</strong> Creates remaining 2 races
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-400">•</span>
                    <span>
                      Set time limit to <strong>maximum</strong>
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-400">•</span>
                    <span>All players must join rooms before racing</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-400">•</span>
                    <span>If racing on stream, wait for spectator to join</span>
                  </li>
                </ul>
              </div>

              {/* Match Reporting */}
              <div>
                <h3 className="text-lg font-bold text-purple-400 mb-2">
                  Match Reporting
                </h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex gap-2">
                    <span className="text-purple-400">•</span>
                    <span>
                      <strong>Scoring:</strong> 1st = 4 pts, 2nd = 2 pts, 3rd =
                      1 pt. First to 25 points wins.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-400">•</span>
                    <span>
                      After draft, the host clicks <strong>Report Race</strong>{" "}
                      and selects the top 3 finishers.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-400">•</span>
                    <span>
                      In multiplayer, Team 2 must <strong>Confirm</strong> or{" "}
                      <strong>Dispute</strong> each result.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-400">•</span>
                    <span>
                      Scores update live on the summary screen scoreboard.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 lg:mt-8 flex justify-end">
              <button
                onClick={() => setShowHowToPlay(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
