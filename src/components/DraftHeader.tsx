import type { DraftPhase, Team, Map } from "../types";
import type { ConnectionStatus } from "../types/multiplayer";
import { formatRoomCode } from "../utils/roomCode";

interface DraftHeaderProps {
  phase: DraftPhase;
  currentTeam: Team;
  onUndo: () => void;
  onReset: () => void;
  onBackToMenu: () => void;
  canUndo: boolean;
  team1Name?: string;
  team2Name?: string;
  wildcardMap?: Map;
  // Multiplayer props
  isMultiplayer?: boolean;
  connectionStatus?: ConnectionStatus;
  roomCode?: string;
  playerCount?: number;
  isHost?: boolean;
  isSpectator?: boolean;
  // Timer props
  timeRemaining?: number;
  timerEnabled?: boolean;
}

export default function DraftHeader({
  phase,
  currentTeam,
  onUndo,
  onReset,
  onBackToMenu,
  canUndo,
  team1Name = "Team 1",
  team2Name = "Team 2",
  wildcardMap,
  isMultiplayer = false,
  connectionStatus = "disconnected",
  roomCode,
  playerCount = 0,
  isHost = false,
  isSpectator = false,
  timeRemaining,
  timerEnabled = true,
}: DraftHeaderProps) {
  // Timer display helpers
  const isTimerActive = timerEnabled && 
    timeRemaining !== undefined && 
    ["map-pick", "map-ban", "uma-pick", "uma-ban"].includes(phase);
  const isWarning = isTimerActive && timeRemaining <= 10 && timeRemaining > 5;
  const isCritical = isTimerActive && timeRemaining <= 5;
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };
  const getPhaseText = () => {
    switch (phase) {
      case "lobby":
        return "Waiting for Players";
      case "wildcard-reveal":
        return "Revealing Tiebreaker Map";
      case "pre-draft-pause":
        return "Ready to Start";
      case "uma-pick":
        return "Umamusume Picking Phase";
      case "uma-ban":
        return "Umamusume Banning Phase";
      case "map-pick":
        return "Map Picking Phase";
      case "map-ban":
        return "Map Banning Phase";
      case "post-map-pause":
        return "Map Draft Complete";
      case "complete":
        return "Draft Complete!";
      default:
        return "";
    }
  };

  const getTeamColor = (team: Team) => {
    return team === "team1" ? "text-blue-500" : "text-red-500";
  };

  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case "connected":
        return <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />;
      case "connecting":
      case "reconnecting":
        return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />;
      case "error":
        return <span className="inline-block w-2 h-2 rounded-full bg-red-400" />;
      default:
        return <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />;
    }
  };

  const handleCopyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch (err) {
      console.error("Failed to copy room code:", err);
    }
  };

  return (
    <div className="bg-gray-800 text-gray-100 p-3 lg:p-4 xl:p-6 rounded-lg shadow-lg border border-gray-700">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold mb-1 lg:mb-2">Uma Drafting</h1>
          <p className="text-base lg:text-lg xl:text-xl mb-0.5 lg:mb-1 text-gray-300">{getPhaseText()}</p>
          {phase !== "complete" && phase !== "pre-draft-pause" && phase !== "post-map-pause" && (
            <p className="text-sm lg:text-base xl:text-lg text-gray-300">
              Current Turn:{" "}
              <span className={`font-bold ${getTeamColor(currentTeam)}`}>
                {currentTeam === "team1" ? team1Name : team2Name}
              </span>
            </p>
          )}
          {wildcardMap && (
            <p className="text-sm text-gray-400 mt-1">
              Tiebreaker: <span className={`font-semibold ${wildcardMap.surface?.toLowerCase() === 'turf' ? 'text-green-400' : 'text-amber-500'}`}>{wildcardMap.track} ({wildcardMap.distance}m)</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 lg:gap-3">
          <div className="flex gap-1.5 lg:gap-2 xl:gap-3">
            {!isSpectator && (
              <>
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="bg-gray-700 text-gray-100 font-semibold py-1.5 lg:py-2 px-3 lg:px-4 xl:px-6 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700 border border-gray-600 text-xs lg:text-sm xl:text-base"
                >
                  ← Undo
                </button>
                <button
                  onClick={onReset}
                  className="bg-gray-700 text-gray-100 font-semibold py-1.5 lg:py-2 px-3 lg:px-4 xl:px-6 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600 text-xs lg:text-sm xl:text-base"
                >
                  Reset
                </button>
              </>
            )}
            <button
              onClick={onBackToMenu}
              className="bg-gray-700 text-gray-100 font-semibold py-1.5 lg:py-2 px-3 lg:px-4 xl:px-6 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600 text-xs lg:text-sm xl:text-base"
            >
              {isSpectator ? "Leave" : "Format Selection"}
            </button>
          </div>
          {isMultiplayer && roomCode && (
            <div className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg ${isSpectator ? 'bg-purple-900/30 border border-purple-700/50' : 'bg-gray-700/50'}`}>
              {isSpectator ? (
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              ) : (
                getStatusIndicator()
              )}
              <span className={`text-sm ${isSpectator ? 'text-purple-300' : 'text-gray-300'}`}>
                {isSpectator ? "Spectating" : isHost ? "Hosting" : "Room"}:
              </span>
              <button
                onClick={handleCopyRoomCode}
                className={`font-mono text-sm transition-all duration-200 blur-sm group-hover:blur-none ${isSpectator ? 'text-purple-400 hover:text-purple-300' : 'text-blue-400 hover:text-blue-300'}`}
                title="Hover to reveal, click to copy"
              >
                {formatRoomCode(roomCode)}
              </button>
              {!isSpectator && (
                <span className="text-xs text-gray-400">({playerCount} player{playerCount !== 1 ? "s" : ""})</span>
              )}
            </div>
          )}
          {/* Timer display - bottom right */}
          {isTimerActive && timeRemaining !== undefined && (
            <div
              className={`px-4 py-2 rounded-lg font-mono text-xl font-bold transition-colors ${
                isCritical
                  ? "bg-red-900/50 text-red-400 animate-pulse"
                  : isWarning
                  ? "bg-yellow-900/50 text-yellow-400"
                  : "bg-gray-700/50 text-gray-300"
              }`}
            >
              ⏱ {formatTime(timeRemaining)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
