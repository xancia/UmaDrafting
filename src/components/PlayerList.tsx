import type { PeerConnection } from "../types/multiplayer";
import { isConnectionActive } from "../utils/connectionManager";

interface PlayerListProps {
  /** All peer connections */
  connections: PeerConnection[];
  /** Local peer ID */
  localPeerId?: string;
  /** Draft format */
  format: "5v5" | "3v3v3";
  /** Team assignments (peerId -> team) */
  teamAssignments?: Record<string, "team1" | "team2" | "teamA" | "teamB" | "teamC">;
}

/**
 * Displays list of all players and spectators in the room
 * 
 * Shows:
 * - Player connections with team assignments
 * - Spectators (collapsible if many)
 * - Connection quality indicators
 * - Which player is the local user
 */
export default function PlayerList({
  connections,
  localPeerId,
  format,
  teamAssignments = {},
}: PlayerListProps) {
  const players = connections.filter((c) => c.type === "player" && isConnectionActive(c));
  const spectators = connections.filter((c) => c.type === "spectator" && isConnectionActive(c));

  /**
   * Gets team color class
   */
  const getTeamColor = (team?: string): string => {
    switch (team) {
      case "team1":
      case "teamA":
        return "text-blue-400 bg-blue-900/30";
      case "team2":
      case "teamB":
        return "text-red-400 bg-red-900/30";
      case "teamC":
        return "text-green-400 bg-green-900/30";
      default:
        return "text-gray-400 bg-gray-800/30";
    }
  };

  /**
   * Gets team display name
   */
  const getTeamName = (team?: string): string => {
    switch (team) {
      case "team1":
        return "Team 1";
      case "team2":
        return "Team 2";
      case "teamA":
        return "Team A";
      case "teamB":
        return "Team B";
      case "teamC":
        return "Team C";
      default:
        return "Unassigned";
    }
  };

  /**
   * Gets expected player count for format
   */
  const getExpectedPlayerCount = (): number => {
    return format === "5v5" ? 2 : 3;
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold mb-3">
        Players ({players.length}/{getExpectedPlayerCount()})
      </h3>

      {/* Player List */}
      <div className="space-y-2 mb-4">
        {players.map((player) => {
          const team = teamAssignments[player.id];
          const isLocal = player.id === localPeerId;

          return (
            <div
              key={player.id}
              className={`p-3 rounded-lg border ${
                isLocal
                  ? "bg-purple-900/20 border-purple-700"
                  : "bg-gray-700/30 border-gray-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Connection Indicator */}
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  
                  {/* Player Name */}
                  <span className="font-semibold">
                    {player.label}
                    {isLocal && (
                      <span className="ml-2 text-xs text-purple-400">(You)</span>
                    )}
                  </span>
                </div>

                {/* Team Assignment */}
                {team && (
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${getTeamColor(
                      team
                    )}`}
                  >
                    {getTeamName(team)}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Waiting for Players Placeholders */}
        {Array.from({ length: getExpectedPlayerCount() - players.length }).map(
          (_, index) => (
            <div
              key={`waiting-${index}`}
              className="p-3 rounded-lg border border-dashed border-gray-600 bg-gray-800/20"
            >
              <div className="flex items-center gap-2 text-gray-500">
                <span className="w-2 h-2 rounded-full bg-gray-600" />
                <span className="text-sm italic">Waiting for player...</span>
              </div>
            </div>
          )
        )}
      </div>

      {/* Spectators */}
      {spectators.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mb-3">
            Spectators ({spectators.length})
          </h3>
          <div className="space-y-1.5">
            {spectators.map((spectator) => {
              const isLocal = spectator.id === localPeerId;

              return (
                <div
                  key={spectator.id}
                  className={`p-2 rounded-lg ${
                    isLocal
                      ? "bg-purple-900/20 border border-purple-700"
                      : "bg-gray-700/20"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <span className="text-gray-300">
                      {spectator.label}
                      {isLocal && (
                        <span className="ml-2 text-xs text-purple-400">(You)</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Empty States */}
      {players.length === 0 && spectators.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          <p className="text-sm italic">No players connected yet</p>
        </div>
      )}
    </div>
  );
}
