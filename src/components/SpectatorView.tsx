import { useState, useMemo } from "react";
import type { DraftState, Map } from "../types";
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
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="bg-gray-800/90 rounded-lg shadow-lg p-4 lg:p-6 xl:p-8 border border-gray-700/60">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-100 mb-4 lg:mb-6 text-center">
                  Draft Complete
                </h2>

                {/* Team Rosters Side by Side */}
                <div className="grid grid-cols-2 gap-4 lg:gap-6 mb-6">
                  {/* Team 1 Roster */}
                  <div className="bg-gray-900/60 rounded-lg p-3 lg:p-4 border border-blue-500/20">
                    <h3 className="text-blue-400 font-bold text-sm lg:text-base mb-2 text-center uppercase tracking-wider">
                      {team1Name}
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5 lg:gap-2 mb-2">
                      {team1.pickedUmas.map((uma, i) => (
                        <div
                          key={i}
                          className="flex flex-col items-center gap-0.5"
                        >
                          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg overflow-hidden border border-blue-500/30 bg-gray-700">
                            {uma.imageUrl && (
                              <img
                                src={uma.imageUrl}
                                alt={uma.name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <span className="text-[9px] lg:text-[10px] text-gray-300 text-center leading-tight">
                            {uma.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    {team1.bannedUmas.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-gray-700/50">
                        <span className="text-[9px] text-red-400/70 uppercase">
                          Banned:{" "}
                        </span>
                        <span className="text-[9px] text-gray-500">
                          {team1.bannedUmas.map((u) => u.name).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Team 2 Roster */}
                  <div className="bg-gray-900/60 rounded-lg p-3 lg:p-4 border border-red-500/20">
                    <h3 className="text-red-400 font-bold text-sm lg:text-base mb-2 text-center uppercase tracking-wider">
                      {team2Name}
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5 lg:gap-2 mb-2">
                      {team2.pickedUmas.map((uma, i) => (
                        <div
                          key={i}
                          className="flex flex-col items-center gap-0.5"
                        >
                          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg overflow-hidden border border-red-500/30 bg-gray-700">
                            {uma.imageUrl && (
                              <img
                                src={uma.imageUrl}
                                alt={uma.name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <span className="text-[9px] lg:text-[10px] text-gray-300 text-center leading-tight">
                            {uma.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    {team2.bannedUmas.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-gray-700/50">
                        <span className="text-[9px] text-red-400/70 uppercase">
                          Banned:{" "}
                        </span>
                        <span className="text-[9px] text-gray-500">
                          {team2.bannedUmas.map((u) => u.name).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Map Schedule */}
                <div className="mb-4 lg:mb-6">
                  <h3 className="text-gray-300 font-bold text-sm lg:text-base mb-2 uppercase tracking-wider text-center">
                    Map Schedule
                  </h3>
                  <div className="space-y-1">
                    {(() => {
                      const t1Maps = team1.pickedMaps;
                      const t2Maps = team2.pickedMaps;
                      const schedule: {
                        map: Map;
                        team: string;
                        index: number;
                      }[] = [];
                      const maxLen = Math.max(t1Maps.length, t2Maps.length);
                      for (let i = 0; i < maxLen; i++) {
                        if (i < t1Maps.length)
                          schedule.push({
                            map: t1Maps[i],
                            team: team1Name,
                            index: schedule.length + 1,
                          });
                        if (i < t2Maps.length)
                          schedule.push({
                            map: t2Maps[i],
                            team: team2Name,
                            index: schedule.length + 1,
                          });
                      }
                      return schedule.map((s) => (
                        <div
                          key={s.index}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/40 rounded-lg text-sm"
                        >
                          <span className="text-gray-500 font-mono text-xs w-5">
                            {s.index}.
                          </span>
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${s.team === team1Name ? "bg-blue-500" : "bg-red-500"}`}
                          />
                          <span className="text-gray-200 font-medium">
                            {s.map.track}
                          </span>
                          <span className="text-gray-500">
                            {s.map.distance}m
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${s.map.surface?.toLowerCase() === "turf" ? "bg-green-900/40 text-green-400" : "bg-amber-900/40 text-amber-400"}`}
                          >
                            {s.map.surface}
                          </span>
                          {s.map.conditions && (
                            <span className="text-gray-500 text-xs ml-auto">
                              {s.map.conditions.season} /{" "}
                              {s.map.conditions.ground} /{" "}
                              {s.map.conditions.weather}
                            </span>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Tiebreaker */}
                <div className="bg-gray-900/40 rounded-lg p-3 lg:p-4 border border-gray-700/40 text-center mb-4">
                  <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-2">
                    Tiebreaker Map
                  </h3>
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-16 h-10 rounded overflow-hidden bg-gray-700">
                      <img
                        src={`./racetrack-portraits/${wildcardMap.track?.toLowerCase()}.png`}
                        alt={wildcardMap.track}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div className="text-left">
                      <span className="text-white font-bold text-sm">
                        {wildcardMap.track}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        {wildcardMap.distance}m
                      </span>
                      <span
                        className={`text-xs ml-2 ${wildcardMap.surface?.toLowerCase() === "turf" ? "text-green-400" : "text-amber-400"}`}
                      >
                        {wildcardMap.surface}
                      </span>
                      {wildcardMap.conditions && (
                        <span className="text-gray-500 text-xs ml-2">
                          {wildcardMap.conditions.season} /{" "}
                          {wildcardMap.conditions.ground} /{" "}
                          {wildcardMap.conditions.weather}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Copy Results */}
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      const t1Umas = team1.pickedUmas
                        .map((u) => u.name)
                        .join(", ");
                      const t2Umas = team2.pickedUmas
                        .map((u) => u.name)
                        .join(", ");
                      const t1Bans = team1.bannedUmas
                        .map((u) => u.name)
                        .join(", ");
                      const t2Bans = team2.bannedUmas
                        .map((u) => u.name)
                        .join(", ");
                      const maps = [...team1.pickedMaps, ...team2.pickedMaps]
                        .map(
                          (m, i) =>
                            `${i + 1}. ${m.track} ${m.distance}m (${m.surface})`,
                        )
                        .join("\n");
                      const text = `=== DRAFT RESULTS ===\n\n${team1Name}: ${t1Umas}\nBanned: ${t1Bans || "None"}\n\n${team2Name}: ${t2Umas}\nBanned: ${t2Bans || "None"}\n\nMap Schedule:\n${maps}\n\nTiebreaker: ${wildcardMap.track} ${wildcardMap.distance}m (${wildcardMap.surface})`;
                      navigator.clipboard.writeText(text);
                    }}
                    className="bg-gray-700/80 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600/50 text-sm"
                  >
                    Copy Draft Results
                  </button>
                </div>
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
