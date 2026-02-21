import type { DraftPhase, Team, Map } from "../types";
import type { ConnectionStatus } from "../types/multiplayer";
import { formatRoomCode } from "../utils/roomCode";
import DraftTimeline from "./DraftTimeline";

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
  // Timeline props
  completedActions?: number;
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
  completedActions = 0,
}: DraftHeaderProps) {
  // Timer display helpers
  const isTimerActive =
    timerEnabled &&
    timeRemaining !== undefined &&
    ["map-pick", "map-ban", "uma-pick", "uma-ban", "uma-pre-ban"].includes(
      phase,
    );
  const isWarning = isTimerActive && timeRemaining <= 10 && timeRemaining > 5;
  const isCritical = isTimerActive && timeRemaining <= 5;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0
      ? `${mins}:${secs.toString().padStart(2, "0")}`
      : `${secs}s`;
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
      case "uma-pre-ban":
        return "Umamusume Pre-Ban Phase";
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
        return (
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        );
      case "connecting":
      case "reconnecting":
        return (
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        );
      case "error":
        return (
          <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
        );
      default:
        return (
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
        );
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
    <div className="bg-gray-800/80 backdrop-blur-sm text-gray-100 p-3 lg:p-4 rounded-lg shadow-lg border border-gray-700/60">
      {/* Top row: title / timer / buttons */}
      <div className="flex justify-between items-center gap-2 mb-1">
        {/* Left: title + phase */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 lg:gap-3">
            <h1 className="text-lg lg:text-xl xl:text-2xl font-bold whitespace-nowrap">
              Uma Drafting
            </h1>
            <span className="text-xs lg:text-sm text-gray-400 font-medium">
              {getPhaseText()}
            </span>
          </div>
        </div>

        {/* Center: Prominent Timer */}
        {isTimerActive && timeRemaining !== undefined && (
          <div className="flex flex-col items-center">
            <div
              className={`
                px-5 py-1.5 rounded-full font-mono text-2xl lg:text-3xl font-black tracking-tight
                transition-all duration-300
                ${
                  isCritical
                    ? "bg-red-900/60 text-red-400 timer-critical border border-red-500/40"
                    : isWarning
                      ? "bg-yellow-900/40 text-yellow-400 border border-yellow-600/30"
                      : "bg-gray-700/60 text-gray-200 border border-gray-600/30"
                }
              `}
            >
              {formatTime(timeRemaining)}
            </div>
          </div>
        )}

        {/* Right: buttons + multiplayer info */}
        <div className="flex-1 flex justify-end items-center gap-2 lg:gap-3">
          {!isSpectator && (
            <>
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`bg-gray-700/80 text-gray-100 font-semibold py-1.5 px-3 lg:px-4 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-gray-600/50 text-xs lg:text-sm ${isMultiplayer ? "hidden" : ""}`}
              >
                Undo
              </button>
              <button
                onClick={onReset}
                className={`bg-gray-700/80 text-gray-100 font-semibold py-1.5 px-3 lg:px-4 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600/50 text-xs lg:text-sm ${isMultiplayer ? "hidden" : ""}`}
              >
                Reset
              </button>
            </>
          )}
          <button
            onClick={onBackToMenu}
            className="bg-gray-700/80 text-gray-100 font-semibold py-1.5 px-3 lg:px-4 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600/50 text-xs lg:text-sm"
          >
            {isSpectator ? "Leave" : "Menu"}
          </button>
        </div>
      </div>

      {/* Second row: current turn + multiplayer info + tiebreaker */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {phase !== "complete" &&
            phase !== "pre-draft-pause" &&
            phase !== "post-map-pause" && (
              <span className="text-gray-400">
                Turn:{" "}
                <span className={`font-bold ${getTeamColor(currentTeam)}`}>
                  {currentTeam === "team1" ? team1Name : team2Name}
                </span>
              </span>
            )}
          {wildcardMap && (
            <span className="text-gray-500 text-xs truncate">
              Tiebreaker:{" "}
              <span
                className={`font-semibold ${wildcardMap.surface?.toLowerCase() === "turf" ? "text-green-400" : "text-amber-500"}`}
              >
                {wildcardMap.track} ({wildcardMap.distance}m{" "}
                {wildcardMap.surface})
              </span>
              {wildcardMap.conditions && (
                <span className="text-gray-400 ml-1">
                  -- {wildcardMap.conditions.season} /{" "}
                  {wildcardMap.conditions.ground} /{" "}
                  {wildcardMap.conditions.weather}
                </span>
              )}
            </span>
          )}
        </div>
        {isMultiplayer && roomCode && (
          <div
            className={`group flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs ${isSpectator ? "bg-purple-900/20 border border-purple-700/30" : "bg-gray-700/40"}`}
          >
            {isSpectator ? (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            ) : (
              getStatusIndicator()
            )}
            <span className={isSpectator ? "text-purple-300" : "text-gray-400"}>
              {isSpectator ? "Spectating" : isHost ? "Host" : "Room"}
            </span>
            <button
              onClick={handleCopyRoomCode}
              className={`font-mono transition-all duration-200 blur-sm group-hover:blur-none ${isSpectator ? "text-purple-400 hover:text-purple-300" : "text-blue-400 hover:text-blue-300"}`}
              title="Hover to reveal, click to copy"
            >
              {formatRoomCode(roomCode)}
            </button>
            {!isSpectator && (
              <span className="text-gray-500">{playerCount}p</span>
            )}
          </div>
        )}
      </div>

      {/* Third row: Draft Order Timeline */}
      {["map-pick", "map-ban", "uma-pick", "uma-ban"].includes(phase) && (
        <div className="mt-2">
          <DraftTimeline
            phase={phase}
            currentTeam={currentTeam}
            completedActions={completedActions}
            team1Name={team1Name}
            team2Name={team2Name}
          />
        </div>
      )}
    </div>
  );
}
