import type { DraftState } from "../types";
import type { ConnectionStatus } from "../types/multiplayer";
import DraftHeader from "./DraftHeader";
import TeamPanel from "./TeamPanel";
import { countDistances, countDirtTracks } from "../draftLogic";

interface SpectatorViewProps {
  /** Current draft state to display */
  draftState: DraftState;
  /** Room code for reference */
  roomCode?: string;
  /** Team names */
  team1Name?: string;
  team2Name?: string;
  /** Connection status */
  connectionStatus?: ConnectionStatus;
  /** Callback to leave spectating */
  onBackToMenu?: () => void;
}

/**
 * Read-only spectator view of an ongoing draft
 * 
 * Displays the full draft state without any interactive elements.
 * Shows both teams' picks and bans, available pools, and current phase.
 */
export default function SpectatorView({
  draftState,
  roomCode,
  team1Name = "Team 1",
  team2Name = "Team 2",
  connectionStatus = "connected",
  onBackToMenu,
}: SpectatorViewProps) {
  const { phase, currentTeam, team1, team2, wildcardMap } = draftState;

  // Calculate distance counts for constraint indicators
  const team1DistanceCounts = countDistances(team1.pickedMaps);
  const team2DistanceCounts = countDistances(team2.pickedMaps);

  return (
    <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex gap-6 px-6 py-6 overflow-hidden">
      {/* Team 1 Panel */}
      <div className="w-96 shrink-0 flex flex-col min-h-0">
        <TeamPanel
          team="team1"
          teamName={team1Name}
          pickedUmas={team1.pickedUmas}
          bannedUmas={team1.bannedUmas}
          pickedMaps={team1.pickedMaps}
          bannedMaps={team1.bannedMaps}
          distanceCounts={team1DistanceCounts}
          dirtCount={countDirtTracks(team1.pickedMaps)}
          isCurrentTurn={phase !== "complete" && currentTeam === "team1"}
          pulsingBorder={true}
        />
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="shrink-0">
          <DraftHeader
            phase={phase}
            currentTeam={currentTeam}
            onUndo={() => {}}
            onReset={() => {}}
            onBackToMenu={onBackToMenu || (() => {})}
            canUndo={false}
            team1Name={team1Name}
            team2Name={team2Name}
            wildcardMap={wildcardMap}
            isMultiplayer={true}
            connectionStatus={connectionStatus}
            roomCode={roomCode}
            playerCount={2}
            isHost={false}
            isSpectator={true}
          />
        </div>

        {/* Wildcard Map Display */}
        <div className="flex-1 flex items-center justify-center">
          {wildcardMap ? (
            <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-700">
              <h2 className="text-2xl font-bold text-gray-100 mb-6">
                Tiebreaker Map
              </h2>
              <div className="flex justify-center">
                <div className="bg-gray-700 border-4 border-blue-500 rounded-xl p-6 max-w-sm">
                  <div className="aspect-video bg-gray-600 rounded-lg mb-4 overflow-hidden">
                    <img
                      src={`./racetrack-portraits/${wildcardMap.track?.toLowerCase()}.png`}
                      alt={wildcardMap.track}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {wildcardMap.track}
                  </h3>
                  <div
                    className={`inline-block px-4 py-2 rounded-lg mb-2 ${
                      wildcardMap.surface?.toLowerCase() === "turf"
                        ? "bg-green-700"
                        : "bg-amber-800"
                    }`}
                  >
                    <span className="text-lg font-semibold text-white">
                      {wildcardMap.surface}
                    </span>
                  </div>
                  <p className="text-xl text-gray-200">
                    {wildcardMap.distance}m
                    {wildcardMap.variant && ` (${wildcardMap.variant})`}
                  </p>
                  {wildcardMap.conditions && (
                    <p className="text-lg text-gray-300 mt-2">
                      {wildcardMap.conditions.season} •{" "}
                      {wildcardMap.conditions.ground} •{" "}
                      {wildcardMap.conditions.weather}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-400">Waiting for draft to start...</p>
            </div>
          )}
        </div>
      </div>

      {/* Team 2 Panel */}
      <div className="w-96 shrink-0 flex flex-col min-h-0">
        <TeamPanel
          team="team2"
          teamName={team2Name}
          pickedUmas={team2.pickedUmas}
          bannedUmas={team2.bannedUmas}
          pickedMaps={team2.pickedMaps}
          bannedMaps={team2.bannedMaps}
          distanceCounts={team2DistanceCounts}
          dirtCount={countDirtTracks(team2.pickedMaps)}
          isCurrentTurn={phase !== "complete" && currentTeam === "team2"}
          pulsingBorder={true}
        />
      </div>
    </div>
  );
}
