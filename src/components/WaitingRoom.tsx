import { useState, useEffect } from "react";
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
  /** Local team for non-host players */
  localTeam?: "team1" | "team2";
  /** Number of players connected (including host) */
  playerCount: number;
  /** Number of spectators connected */
  spectatorCount: number;
  /** Callback when host clicks Start Draft */
  onStartDraft: () => void;
  /** Callback to leave/cancel */
  onLeave?: () => void;
  /** Callback when team name is changed */
  onTeamNameChange?: (team: "team1" | "team2", name: string) => void;
}

/**
 * Waiting room component shown after room is created
 * Displays room code and allows players to set their team names
 */
export default function WaitingRoom({
  roomCode,
  team1Name,
  team2Name,
  isHost,
  localTeam = "team1",
  playerCount,
  spectatorCount,
  onStartDraft,
  onLeave,
  onTeamNameChange,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const [editingTeam1, setEditingTeam1] = useState(false);
  const [editingTeam2, setEditingTeam2] = useState(false);
  const [tempTeam1Name, setTempTeam1Name] = useState(team1Name);
  const [tempTeam2Name, setTempTeam2Name] = useState(team2Name);
  const canStart = playerCount >= 2;

  // Sync temp names when props change (from other player's edits)
  useEffect(() => {
    if (!editingTeam1) setTempTeam1Name(team1Name);
  }, [team1Name, editingTeam1]);

  useEffect(() => {
    if (!editingTeam2) setTempTeam2Name(team2Name);
  }, [team2Name, editingTeam2]);

  // Host can edit team1, player 2 can edit team2
  const canEditTeam1 = isHost;
  const canEditTeam2 = !isHost && localTeam === "team2";

  const handleTeam1Submit = () => {
    const name = tempTeam1Name.trim() || "Team 1";
    setTempTeam1Name(name);
    setEditingTeam1(false);
    onTeamNameChange?.("team1", name);
  };

  const handleTeam2Submit = () => {
    const name = tempTeam2Name.trim() || "Team 2";
    setTempTeam2Name(name);
    setEditingTeam2(false);
    onTeamNameChange?.("team2", name);
  };

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
    <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex items-center justify-center px-4 lg:px-6">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 lg:p-8 xl:p-10 border-2 border-gray-700 max-w-lg w-full text-center">
        <h1 className="text-2xl lg:text-3xl font-bold mb-1 lg:mb-2 text-gray-100">
          Waiting Room
        </h1>
        <p className="text-sm lg:text-base text-gray-400 mb-4 lg:mb-6 xl:mb-8">
          Share the room code with your opponent
        </p>

        {/* Room Code Display */}
        <div className="bg-gray-900 rounded-xl p-4 lg:p-6 mb-4 lg:mb-6 xl:mb-8 border border-gray-700">
          <p className="text-xs lg:text-sm text-gray-400 mb-1 lg:mb-2">
            Room Code
          </p>
          <button
            onClick={handleCopyRoomCode}
            className={`text-3xl lg:text-4xl xl:text-5xl font-mono font-bold transition-colors tracking-wider ${
              copied ? "text-green-400" : "text-blue-400 hover:text-blue-300"
            }`}
            title="Click to copy"
          >
            {formatRoomCode(roomCode)}
          </button>
          <p
            className={`text-xs mt-1 lg:mt-2 transition-colors ${copied ? "text-green-400" : "text-gray-500"}`}
          >
            {copied ? "Copied!" : "Click to copy"}
          </p>
        </div>

        {/* Team Names */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4 mb-4 lg:mb-6 xl:mb-8">
          {/* Team 1 */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 lg:p-4">
            <p className="text-xs text-blue-400 mb-0.5 lg:mb-1">
              Team 1 {canEditTeam1 && "(You)"}
            </p>
            {editingTeam1 ? (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={tempTeam1Name}
                  onChange={(e) => setTempTeam1Name(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTeam1Submit()}
                  onBlur={handleTeam1Submit}
                  maxLength={20}
                  autoFocus
                  className="w-full px-2 py-1 bg-gray-700 border border-blue-500 rounded text-sm text-blue-300 focus:outline-none"
                />
              </div>
            ) : (
              <p
                onClick={() => canEditTeam1 && setEditingTeam1(true)}
                className={`font-semibold text-sm lg:text-base text-blue-300 ${
                  canEditTeam1 ? "cursor-pointer hover:text-blue-200" : ""
                }`}
                title={canEditTeam1 ? "Click to edit" : undefined}
              >
                {team1Name}
                {canEditTeam1 && (
                  <span className="text-blue-500 ml-1 text-xs">[edit]</span>
                )}
              </p>
            )}
          </div>
          {/* Team 2 */}
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 lg:p-4">
            <p className="text-xs text-red-400 mb-0.5 lg:mb-1">
              Team 2 {canEditTeam2 && "(You)"}
            </p>
            {editingTeam2 ? (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={tempTeam2Name}
                  onChange={(e) => setTempTeam2Name(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTeam2Submit()}
                  onBlur={handleTeam2Submit}
                  maxLength={20}
                  autoFocus
                  className="w-full px-2 py-1 bg-gray-700 border border-red-500 rounded text-sm text-red-300 focus:outline-none"
                />
              </div>
            ) : (
              <p
                onClick={() => canEditTeam2 && setEditingTeam2(true)}
                className={`font-semibold text-sm lg:text-base text-red-300 ${
                  canEditTeam2 ? "cursor-pointer hover:text-red-200" : ""
                }`}
                title={canEditTeam2 ? "Click to edit" : undefined}
              >
                {team2Name}
                {canEditTeam2 && (
                  <span className="text-red-500 ml-1 text-xs">[edit]</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-gray-900/50 rounded-lg p-3 lg:p-4 mb-4 lg:mb-6 xl:mb-8 border border-gray-700">
          <div className="flex items-center justify-center gap-4 lg:gap-6">
            <div className="flex items-center gap-1.5 lg:gap-2">
              <span
                className={`w-2.5 lg:w-3 h-2.5 lg:h-3 rounded-full ${playerCount >= 2 ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`}
              />
              <span className="text-sm lg:text-base text-gray-300">
                {playerCount}/2 Players
              </span>
            </div>
            {spectatorCount > 0 && (
              <div className="flex items-center gap-1.5 lg:gap-2">
                <span className="w-2.5 lg:w-3 h-2.5 lg:h-3 rounded-full bg-purple-400" />
                <span className="text-sm lg:text-base text-gray-300">
                  {spectatorCount} Spectator{spectatorCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
          {playerCount < 2 && (
            <p className="text-xs lg:text-sm text-yellow-400/80 mt-2 lg:mt-3">
              Waiting for opponent to join...
            </p>
          )}
        </div>

        {/* Action Buttons */}
        {isHost ? (
          <div className="space-y-2 lg:space-y-3">
            <button
              onClick={onStartDraft}
              disabled={!canStart}
              className={`w-full py-3 lg:py-4 px-4 lg:px-6 rounded-xl font-bold text-base lg:text-lg transition-all transform ${
                canStart
                  ? "bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] shadow-lg"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed border-2 border-gray-700"
              }`}
            >
              {canStart ? "Start Draft" : "Waiting for Players..."}
            </button>
            {onLeave && (
              <button
                onClick={onLeave}
                className="w-full py-2 lg:py-3 px-3 lg:px-4 text-gray-400 hover:text-gray-200 transition-colors text-xs lg:text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 lg:space-y-3">
            <div className="bg-gray-700/50 rounded-xl p-3 lg:p-4">
              <p className="text-sm lg:text-base text-gray-300">
                Waiting for host to start the draft...
              </p>
            </div>
            {onLeave && (
              <button
                onClick={onLeave}
                className="w-full py-2 lg:py-3 px-3 lg:px-4 text-gray-400 hover:text-gray-200 transition-colors text-xs lg:text-sm"
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
