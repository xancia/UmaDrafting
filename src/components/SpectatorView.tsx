import { useState, useMemo } from "react";
import type { DraftState } from "../types";
import type { ConnectionStatus } from "../types/multiplayer";
import DraftHeader from "./DraftHeader";
import TeamPanel from "./TeamPanel";
import PhaseAnnouncement from "./PhaseAnnouncement";
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
  /** Timer remaining seconds */
  timeRemaining?: number;
}

/**
 * Read-only spectator view of an ongoing draft.
 *
 * Shows both team panels, the draft header with timeline, phase announcements,
 * and a read-only view of available umas/maps so spectators can follow along.
 */
export default function SpectatorView({
  draftState,
  roomCode,
  team1Name = "Team 1",
  team2Name = "Team 2",
  connectionStatus = "connected",
  onBackToMenu,
  timeRemaining,
}: SpectatorViewProps) {
  const {
    phase,
    currentTeam,
    team1,
    team2,
    wildcardMap,
    availableUmas,
    availableMaps,
  } = draftState;
  const [umaSearch, setUmaSearch] = useState("");

  const isUmaPhase = phase === "uma-pick" || phase === "uma-ban";
  const isMapPhase = phase === "map-pick" || phase === "map-ban";
  const isComplete = phase === "complete";
  const isPause = phase === "pre-draft-pause" || phase === "post-map-pause";
  const isWildcard = phase === "wildcard-reveal";
  const isLobby = phase === "lobby";

  // Compute completed actions for timeline
  const completedActions = useMemo(() => {
    const t1 = draftState.team1;
    const t2 = draftState.team2;
    if (phase === "map-pick") {
      return (t1.pickedMaps?.length || 0) + (t2.pickedMaps?.length || 0);
    }
    if (phase === "map-ban") {
      return (t1.bannedMaps?.length || 0) + (t2.bannedMaps?.length || 0);
    }
    if (phase === "uma-pick") {
      const totalPicked =
        (t1.pickedUmas?.length || 0) + (t2.pickedUmas?.length || 0);
      const totalBanned =
        (t1.bannedUmas?.length || 0) + (t2.bannedUmas?.length || 0);
      return totalBanned > 0 ? totalPicked - totalBanned : totalPicked;
    }
    if (phase === "uma-ban") {
      return (t1.bannedUmas?.length || 0) + (t2.bannedUmas?.length || 0);
    }
    return 0;
  }, [phase, draftState.team1, draftState.team2]);

  // Filtered umas for spectator grid
  const filteredUmas = useMemo(() => {
    if (!availableUmas) return [];
    if (!umaSearch.trim()) return availableUmas;
    const q = umaSearch.toLowerCase();
    return availableUmas.filter((u) => u.name.toLowerCase().includes(q));
  }, [availableUmas, umaSearch]);

  // Group available maps by track for the map grid
  const trackGroups = useMemo(() => {
    if (!availableMaps) return [];
    const groups = new Map<string, typeof availableMaps>();
    for (const map of availableMaps) {
      const existing = groups.get(map.track) || [];
      existing.push(map);
      groups.set(map.track, existing);
    }
    return Array.from(groups.entries());
  }, [availableMaps]);

  // Distance/dirt constraint indicators
  const team1DistanceCounts = countDistances(team1.pickedMaps);
  const team2DistanceCounts = countDistances(team2.pickedMaps);

  const activeSection = isMapPhase
    ? ("maps" as const)
    : isUmaPhase
      ? ("umas" as const)
      : null;

  return (
    <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex gap-2 lg:gap-4 px-2 lg:px-4 py-2 lg:py-4 overflow-hidden">
      <PhaseAnnouncement phase={phase} />

      {/* Team 1 Panel */}
      <div className="w-56 lg:w-72 xl:w-96 shrink-0 flex flex-col px-1 lg:px-2 min-h-0">
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
          activeSection={activeSection}
          pulsingBorder={true}
          showMapOrder={
            phase === "post-map-pause" ||
            phase === "uma-pick" ||
            phase === "uma-ban" ||
            phase === "complete"
          }
        />
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col gap-2 lg:gap-4 overflow-hidden">
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
            timeRemaining={timeRemaining}
            timerEnabled={true}
            completedActions={completedActions}
          />
        </div>

        {/* Main center area — changes based on phase */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Lobby / Wildcard / Pause: tiebreaker card centered */}
          {(isLobby || isWildcard || isPause) && (
            <div className="flex-1 flex items-center justify-center">
              {wildcardMap ? (
                <div className="bg-gray-800/90 rounded-lg shadow-lg p-6 lg:p-8 text-center border border-gray-700/60">
                  <h2 className="text-xl lg:text-2xl font-bold text-gray-100 mb-4 lg:mb-6">
                    Tiebreaker Map
                  </h2>
                  <div className="flex justify-center">
                    <div className="bg-gray-700 border-4 border-blue-500 rounded-xl p-4 lg:p-6 max-w-sm">
                      <div className="aspect-video bg-gray-600 rounded-lg mb-3 lg:mb-4 overflow-hidden">
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
                      <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">
                        {wildcardMap.track}
                      </h3>
                      <div
                        className={`inline-block px-3 py-1.5 rounded-lg mb-2 ${
                          wildcardMap.surface?.toLowerCase() === "turf"
                            ? "bg-green-700"
                            : "bg-amber-800"
                        }`}
                      >
                        <span className="text-base lg:text-lg font-semibold text-white">
                          {wildcardMap.surface}
                        </span>
                      </div>
                      <p className="text-lg lg:text-xl text-gray-200">
                        {wildcardMap.distance}m
                        {wildcardMap.variant && ` (${wildcardMap.variant})`}
                      </p>
                      {wildcardMap.conditions && (
                        <p className="text-sm lg:text-base text-gray-300 mt-2">
                          {wildcardMap.conditions.season} /{" "}
                          {wildcardMap.conditions.ground} /{" "}
                          {wildcardMap.conditions.weather}
                        </p>
                      )}
                    </div>
                  </div>
                  {isPause && (
                    <p className="text-sm text-gray-400 mt-4">
                      Players are strategizing...
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
                  <p className="text-gray-400">Waiting for draft to start...</p>
                </div>
              )}
            </div>
          )}

          {/* Uma phases: read-only uma grid */}
          {isUmaPhase && (
            <div className="flex-1 flex flex-col min-h-0 bg-gray-800/60 rounded-lg border border-gray-700/40 p-3 lg:p-4">
              <div className="flex items-center gap-3 mb-3 shrink-0">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={umaSearch}
                    onChange={(e) => setUmaSearch(e.target.value)}
                    placeholder="Search Umamusume..."
                    className="w-full bg-gray-700/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    readOnly={false}
                  />
                  {umaSearch && (
                    <button
                      onClick={() => setUmaSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm"
                    >
                      x
                    </button>
                  )}
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {filteredUmas.length} avail.
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5 lg:gap-2">
                  {filteredUmas.map((uma) => (
                    <div
                      key={uma.id}
                      className="p-1.5 lg:p-2 bg-gray-700/80 border-2 border-gray-600/60 rounded-lg"
                    >
                      <div className="aspect-square bg-gray-600/60 rounded mb-0.5 lg:mb-1 flex items-center justify-center overflow-hidden">
                        {uma.imageUrl ? (
                          <img
                            src={uma.imageUrl}
                            alt={uma.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl text-gray-400">?</span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-gray-100 text-center whitespace-pre-line leading-tight break-words">
                        {uma.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Map phases: read-only track/map grid */}
          {isMapPhase && (
            <div className="flex-1 flex flex-col min-h-0 bg-gray-800/60 rounded-lg border border-gray-700/40 p-3 lg:p-4">
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 shrink-0">
                Available Racecourses ({trackGroups.length})
              </h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 lg:gap-3">
                  {trackGroups.map(([trackName, maps]) => {
                    const hasTurf = maps.some(
                      (m) => m.surface.toLowerCase() === "turf",
                    );
                    const hasDirt = maps.some(
                      (m) => m.surface.toLowerCase() === "dirt",
                    );
                    return (
                      <div
                        key={trackName}
                        className="bg-gray-700/80 border-2 border-gray-600/60 rounded-lg p-2 lg:p-3"
                      >
                        <div className="aspect-video bg-gray-600/60 rounded mb-1.5 overflow-hidden">
                          <img
                            src={`./racetrack-portraits/${trackName.toLowerCase()}.png`}
                            alt={trackName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                            }}
                          />
                        </div>
                        <p className="text-sm font-bold text-white text-center mb-1">
                          {trackName}
                        </p>
                        <div className="flex items-center justify-center gap-1.5">
                          {hasTurf && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-700/80 text-green-200 font-medium">
                              Turf
                            </span>
                          )}
                          {hasDirt && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-800/80 text-amber-200 font-medium">
                              Dirt
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400">
                            {maps.length} map{maps.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Draft complete */}
          {isComplete && (
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-gray-800/90 rounded-lg shadow-lg p-6 lg:p-8 border border-gray-700/60 text-center max-w-lg">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-100 mb-4">
                  Draft Complete
                </h2>
                <p className="text-gray-400 text-sm">
                  The draft has finished. Review the final rosters on each team
                  panel.
                </p>
                {wildcardMap && (
                  <p className="text-gray-500 text-xs mt-3">
                    Tiebreaker: {wildcardMap.track} {wildcardMap.distance}m (
                    {wildcardMap.surface})
                    {wildcardMap.conditions &&
                      ` -- ${wildcardMap.conditions.season} / ${wildcardMap.conditions.ground} / ${wildcardMap.conditions.weather}`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Team 2 Panel */}
      <div className="w-56 lg:w-72 xl:w-96 shrink-0 flex flex-col px-1 lg:px-2 min-h-0">
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
          activeSection={activeSection}
          pulsingBorder={true}
          showMapOrder={
            phase === "post-map-pause" ||
            phase === "uma-pick" ||
            phase === "uma-ban" ||
            phase === "complete"
          }
        />
      </div>
    </div>
  );
}
