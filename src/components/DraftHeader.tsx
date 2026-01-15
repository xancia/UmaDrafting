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
}: DraftHeaderProps) {
  const getPhaseText = () => {
    switch (phase) {
      case "lobby":
        return "Waiting for Players";
      case "wildcard-reveal":
        return "Revealing Tiebreaker Map";
      case "uma-pick":
        return "Umamusume Picking Phase";
      case "uma-ban":
        return "Umamusume Banning Phase";
      case "map-pick":
        return "Map Picking Phase";
      case "map-ban":
        return "Map Banning Phase";
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
    <div className="bg-gray-800 text-gray-100 p-6 rounded-lg shadow-lg border border-gray-700">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">Uma Drafting</h1>
          <p className="text-xl mb-1 text-gray-300">{getPhaseText()}</p>
          {phase !== "complete" && (
            <p className="text-lg text-gray-300">
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
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-3">
            {!isSpectator && (
              <>
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="bg-gray-700 text-gray-100 font-semibold py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700 border border-gray-600"
                >
                  ← Undo
                </button>
                <button
                  onClick={onReset}
                  className="bg-gray-700 text-gray-100 font-semibold py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
                >
                  Reset
                </button>
              </>
            )}
            <button
              onClick={onBackToMenu}
              className="bg-gray-700 text-gray-100 font-semibold py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
            >
              {isSpectator ? "Leave" : "Format Selection"}
            </button>
          </div>
          {isMultiplayer && roomCode && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isSpectator ? 'bg-purple-900/30 border border-purple-700/50' : 'bg-gray-700/50'}`}>
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
                className={`font-mono text-sm transition-colors ${isSpectator ? 'text-purple-400 hover:text-purple-300' : 'text-blue-400 hover:text-blue-300'}`}
                title="Click to copy"
              >
                {formatRoomCode(roomCode)}
              </button>
              {!isSpectator && (
                <span className="text-xs text-gray-400">({playerCount} player{playerCount !== 1 ? "s" : ""})</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
