import { useState, useEffect } from "react";
import type { DraftState, UmaMusume, Map } from "../types";
import {
  getInitialDraftState,
  selectUma,
  selectMap,
  canPickDistance,
  canPickDirt,
  countDistances,
  countDirtTracks,
} from "../draftLogic";
import { SAMPLE_MAPS } from "../data";
import { generateTrackConditions } from "../utils/trackConditions";
import DraftHeader from "./DraftHeader";
import TeamPanel from "./TeamPanel";
import UmaCard from "./UmaCard";
import MapCard from "./MapCard";

interface Draft5v5Props {
  onBackToMenu: () => void;
}

export default function Draft5v5({ onBackToMenu }: Draft5v5Props) {
  const [draftState, setDraftState] = useState<DraftState>(
    getInitialDraftState()
  );
  const [history, setHistory] = useState<DraftState[]>([
    getInitialDraftState(),
  ]);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [umaSearch, setUmaSearch] = useState<string>("");
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showMenuConfirm, setShowMenuConfirm] = useState<boolean>(false);
  const [showWildcardModal, setShowWildcardModal] = useState<boolean>(false);
  const [showTeamNameModal, setShowTeamNameModal] = useState<boolean>(true);
  const [cyclingMap, setCyclingMap] = useState<Map | null>(null);
  const [revealStarted, setRevealStarted] = useState<boolean>(false);
  const [team1Name, setTeam1Name] = useState<string>("Team 1");
  const [team2Name, setTeam2Name] = useState<string>("Team 2");
  const [tempTeam1Name, setTempTeam1Name] = useState<string>("Team 1");
  const [tempTeam2Name, setTempTeam2Name] = useState<string>("Team 2");

  const isUmaPhase =
    draftState.phase === "uma-pick" || draftState.phase === "uma-ban";
  const isComplete = draftState.phase === "complete";

  const handleUmaSelect = (uma: UmaMusume) => {
    const newState = selectUma(draftState, uma);
    setDraftState(newState);
    setHistory([...history, newState]);
  };

  const handleMapSelect = (map: Map) => {
    // Generate random track conditions
    const mapWithConditions: Map = {
      ...map,
      conditions: generateTrackConditions(),
    };
    const newState = selectMap(draftState, mapWithConditions);
    setDraftState(newState);
    setHistory([...history, newState]);
    setSelectedTrack(null); // Reset track selection after picking
  };

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setDraftState(newHistory[newHistory.length - 1]);
      setSelectedTrack(null);
      setUmaSearch("");
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    const initialState = getInitialDraftState();
    setDraftState(initialState);
    setHistory([initialState]);
    setSelectedTrack(null);
    setUmaSearch("");
    setShowResetConfirm(false);
    setShowWildcardModal(false);
    setShowTeamNameModal(true);
    setRevealStarted(false);
    setCyclingMap(null);
  };

  const handleBackToMenu = () => {
    setShowMenuConfirm(true);
  };

  const confirmBackToMenu = () => {
    onBackToMenu();
  };

  const startReveal = () => {
    setRevealStarted(true);
  };

  const acknowledgeDraft = () => {
    setShowWildcardModal(false);
  };

  // Cycling animation effect for wildcard reveal
  useEffect(() => {
    if (!showWildcardModal || !revealStarted) {
      return;
    }

    let cycleCount = 0;
    const fastCycles = 20; // Fast spin for ~1.5 seconds
    const slowCycles = 8; // Slowdown for ~1.0 seconds
    const totalCycles = fastCycles + slowCycles;
    let timeoutId: number;

    const animate = () => {
      if (cycleCount >= totalCycles) {
        // Show final map
        setCyclingMap(draftState.wildcardMap);
        timeoutId = window.setTimeout(() => {
          setCyclingMap(null);
        }, 500);
        return;
      }

      const randomMap = SAMPLE_MAPS[Math.floor(Math.random() * SAMPLE_MAPS.length)];
      const conditions = generateTrackConditions();
      setCyclingMap({ ...randomMap, conditions });

      // Calculate delay - fast at first, then slow down
      let delay = 75;
      if (cycleCount > fastCycles) {
        const slowdownProgress = (cycleCount - fastCycles) / slowCycles;
        delay = 75 + (slowdownProgress * 175); // Gradually slow from 75ms to 250ms
      }

      cycleCount++;
      timeoutId = window.setTimeout(animate, delay);
    };

    animate();

    // Cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [showWildcardModal, revealStarted, draftState.wildcardMap]);

  const confirmTeamNames = () => {
    setTeam1Name(tempTeam1Name || "Team 1");
    setTeam2Name(tempTeam2Name || "Team 2");
    setShowTeamNameModal(false);
    setShowWildcardModal(true);
  };

  // Get opponent's picked items for ban phase
  const getOpponentTeam = () => {
    return draftState.currentTeam === "team1" ? "team2" : "team1";
  };

  // Check if a map can be picked based on distance and surface constraints
  const canSelectMap = (map: Map): boolean => {
    if (draftState.phase !== "map-pick") return true;
    
    const currentTeam = draftState.currentTeam;
    const currentTeamMaps = draftState[currentTeam].pickedMaps;
    
    // Check distance constraint
    if (!canPickDistance(currentTeamMaps, map.distance)) {
      return false;
    }
    
    // Check dirt surface constraint
    if (map.surface === "Dirt" && !canPickDirt(currentTeamMaps)) {
      return false;
    }
    
    return true;
  };

  const getBannableUmas = () => {
    if (draftState.phase === "uma-ban") {
      const opponentTeam = getOpponentTeam();
      return draftState[opponentTeam].pickedUmas;
    }
    return draftState.availableUmas;
  };

  const getFilteredUmas = () => {
    const umas = getBannableUmas();
    if (!umaSearch.trim()) return umas;
    return umas.filter((uma) =>
      uma.name.toLowerCase().includes(umaSearch.toLowerCase())
    );
  };

  const getBannableMaps = () => {
    if (draftState.phase === "map-ban") {
      const opponentTeam = getOpponentTeam();
      return draftState[opponentTeam].pickedMaps;
    }
    return draftState.availableMaps;
  };

  // Get unique tracks for selection
  const getAvailableTracks = () => {
    const maps = getBannableMaps();
    const tracks = Array.from(new Set(maps.map((m) => m.track)));
    return tracks.sort();
  };

  // Get maps for selected track
  const getMapsForTrack = (track: string) => {
    return getBannableMaps().filter((m) => m.track === track);
  };

  return (
    <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex gap-4 px-6 py-6 overflow-hidden">
      <div className="w-96 shrink-0 flex flex-col px-2 min-h-0">
        <TeamPanel
          team="team1"
          teamName={team1Name}
          pickedUmas={draftState.team1.pickedUmas}
          bannedUmas={draftState.team1.bannedUmas}
          pickedMaps={draftState.team1.pickedMaps}
          bannedMaps={draftState.team1.bannedMaps}
          isCurrentTurn={
            draftState.phase !== "complete" &&
            draftState.currentTeam === "team1"
          }
          distanceCounts={countDistances(draftState.team1.pickedMaps)}
          dirtCount={countDirtTracks(draftState.team1.pickedMaps)}
        />
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="shrink-0">
          <DraftHeader
            phase={draftState.phase}
            currentTeam={draftState.currentTeam}
            onUndo={handleUndo}
            onReset={handleReset}
            onBackToMenu={handleBackToMenu}
            team1Name={team1Name}
            team2Name={team2Name}
            canUndo={history.length > 1}
            wildcardMap={draftState.wildcardMap}
          />
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {!isComplete && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-bold mb-4 text-gray-100">
                {draftState.phase === "uma-pick" && "Available Umamusume"}
                {draftState.phase === "uma-ban" && "Ban Opponent's Umamusume"}
                {draftState.phase === "map-pick" &&
                  !selectedTrack &&
                  "Select a Racecourse"}
                {draftState.phase === "map-pick" &&
                  selectedTrack &&
                  `Select Distance - ${selectedTrack}`}
                {draftState.phase === "map-ban" && "Ban Opponent's Map"}
              </h2>

              {isUmaPhase && (
                <input
                  type="text"
                  placeholder="Search Umamusume..."
                  value={umaSearch}
                  onChange={(e) => setUmaSearch(e.target.value)}
                  className="w-full mb-4 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:border-gray-500"
                />
              )}

              {draftState.phase === "map-pick" && selectedTrack && (
                <button
                  onClick={() => setSelectedTrack(null)}
                  className="mb-4 bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-2 px-4 rounded-lg transition-colors border border-gray-600"
                >
                  ← Back to Racecourses
                </button>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {isUmaPhase &&
                  getFilteredUmas().map((uma) => (
                    <UmaCard
                      key={uma.id}
                      uma={uma}
                      onSelect={handleUmaSelect}
                    />
                  ))}

                {draftState.phase === "map-pick" &&
                  !selectedTrack &&
                  getAvailableTracks().map((track) => (
                    <button
                      key={track}
                      onClick={() => setSelectedTrack(track)}
                      className="p-4 bg-gray-700 border-2 border-gray-600 rounded-lg hover:border-gray-500 hover:shadow-lg transition-all overflow-hidden"
                    >
                      <div className="aspect-video bg-gray-600 rounded mb-2 flex items-center justify-center overflow-hidden">
                        <img
                          src={`./racetrack-portraits/${track.toLowerCase()}.png`}
                          alt={track}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-100">
                          {track}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {getMapsForTrack(track).length} options
                        </p>
                      </div>
                    </button>
                  ))}

                {draftState.phase === "map-pick" &&
                  selectedTrack &&
                  getMapsForTrack(selectedTrack).map((map) => (
                    <MapCard
                      key={map.id}
                      map={map}
                      onSelect={handleMapSelect}
                      disabled={!canSelectMap(map)}
                    />
                  ))}

                {draftState.phase === "map-ban" &&
                  getBannableMaps().map((map) => (
                    <MapCard
                      key={map.id}
                      map={map}
                      onSelect={handleMapSelect}
                    />
                  ))}
              </div>
            </div>
          )}

          {isComplete && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-700">
              <h2 className="text-4xl font-bold text-gray-100 mb-8">
                Tiebreaker Map
              </h2>
              <div className="flex justify-center mb-8">
                <div className="bg-gray-700 border-4 border-blue-500 rounded-xl p-8 max-w-md">
                  <div className="aspect-video bg-gray-600 rounded-lg mb-4 overflow-hidden">
                    <img
                      src={`./racetrack-portraits/${draftState.wildcardMap.track.toLowerCase()}.png`}
                      alt={draftState.wildcardMap.track}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-2">
                    {draftState.wildcardMap.track}
                  </h3>
                  <div
                    className={`inline-block px-4 py-2 rounded-lg mb-2 ${
                      draftState.wildcardMap.surface.toLowerCase() === "turf"
                        ? "bg-green-700"
                        : "bg-amber-800"
                    }`}
                  >
                    <span className="text-lg font-semibold text-white">
                      {draftState.wildcardMap.surface}
                    </span>
                  </div>
                  <p className="text-xl text-gray-200">
                    {draftState.wildcardMap.distance}m
                    {draftState.wildcardMap.variant &&
                      ` (${draftState.wildcardMap.variant})`}
                  </p>
                  {draftState.wildcardMap.conditions && (
                    <p className="text-lg text-gray-300 mt-2">
                      {draftState.wildcardMap.conditions.season} •{" "}
                      {draftState.wildcardMap.conditions.ground} •{" "}
                      {draftState.wildcardMap.conditions.weather}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-96 shrink-0 flex flex-col px-2 min-h-0">
        <TeamPanel
          team="team2"
          teamName={team2Name}
          pickedUmas={draftState.team2.pickedUmas}
          bannedUmas={draftState.team2.bannedUmas}
          pickedMaps={draftState.team2.pickedMaps}
          bannedMaps={draftState.team2.bannedMaps}
          isCurrentTurn={
            draftState.phase !== "complete" &&
            draftState.currentTeam === "team2"
          }          distanceCounts={countDistances(draftState.team2.pickedMaps)}
          dirtCount={countDirtTracks(draftState.team2.pickedMaps)}        />
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border-2 border-gray-700 max-w-md">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">
              Reset Draft?
            </h2>
            <p className="text-gray-400 mb-6">
              Are you sure you want to reset the draft? All current progress
              will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back to Menu Confirmation Modal */}
      {showMenuConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border-2 border-gray-700 max-w-md">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">
              Return to Menu?
            </h2>
            <p className="text-gray-400 mb-6">
              Are you sure you want to return to the format selection menu?
              Current draft progress will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowMenuConfirm(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmBackToMenu}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Return to Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wildcard Map Reveal Modal */}
      {showWildcardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border-2 border-gray-700 max-w-2xl w-full">
            <h2 className="text-4xl font-bold text-gray-100 mb-4 text-center">
              {!revealStarted ? "Wildcard Tiebreaker Map" : "Tiebreaker Map Revealed!"}
            </h2>
            <p className="text-gray-400 mb-8 text-center text-lg">
              {!revealStarted 
                ? "This map will be used as the tiebreaker for the draft" 
                : "This map will be used if the draft results in a tie"}
            </p>
            <div className="flex justify-center mb-8 relative" style={{ perspective: '1000px', height: '350px' }}>
              <div 
                className={`bg-gray-700 border-4 ${revealStarted && !cyclingMap ? 'border-blue-500' : 'border-gray-600'} rounded-xl p-8 max-w-md transition-all duration-300`}
                style={cyclingMap ? {
                  position: 'absolute',
                  animation: 'spin3d 0.6s linear infinite',
                  transformStyle: 'preserve-3d'
                } : { position: 'absolute' }}
              >
                {!revealStarted ? (
                  <div className="flex flex-col items-center justify-center" style={{ height: '280px', width: '240px' }}>
                    <div className="text-8xl text-gray-400">?</div>
                  </div>
                ) : cyclingMap ? (
                  <>
                    <div className="aspect-video bg-gray-600 rounded-lg mb-4 overflow-hidden">
                      <img
                        src={`./racetrack-portraits/${cyclingMap.track.toLowerCase()}.png`}
                        alt={cyclingMap.track}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-2 text-center">
                      {cyclingMap.track}
                    </h3>
                    <div
                      className={`inline-block px-4 py-2 rounded-lg mb-2 ${
                        cyclingMap.surface.toLowerCase() === "turf"
                          ? "bg-green-700"
                          : "bg-amber-800"
                      } w-full text-center`}
                    >
                      <span className="text-lg font-semibold text-white">
                        {cyclingMap.surface}
                      </span>
                    </div>
                    <p className="text-xl text-gray-200 text-center">
                      {cyclingMap.distance}m
                      {cyclingMap.variant && ` (${cyclingMap.variant})`}
                    </p>
                    {cyclingMap.conditions && (
                      <p className="text-lg text-gray-300 mt-2 text-center">
                        {cyclingMap.conditions.season} •{" "}
                        {cyclingMap.conditions.ground} •{" "}
                        {cyclingMap.conditions.weather}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="aspect-video bg-gray-600 rounded-lg mb-4 overflow-hidden">
                      <img
                        src={`./racetrack-portraits/${draftState.wildcardMap.track.toLowerCase()}.png`}
                        alt={draftState.wildcardMap.track}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-2 text-center">
                      {draftState.wildcardMap.track}
                    </h3>
                    <div
                      className={`inline-block px-4 py-2 rounded-lg mb-2 ${
                        draftState.wildcardMap.surface.toLowerCase() === "turf"
                          ? "bg-green-700"
                          : "bg-amber-800"
                      } w-full text-center`}
                    >
                      <span className="text-lg font-semibold text-white">
                        {draftState.wildcardMap.surface}
                      </span>
                    </div>
                    <p className="text-xl text-gray-200 text-center">
                      {draftState.wildcardMap.distance}m
                      {draftState.wildcardMap.variant && ` (${draftState.wildcardMap.variant})`}
                    </p>
                    {draftState.wildcardMap.conditions && (
                      <p className="text-lg text-gray-300 mt-2 text-center">
                        {draftState.wildcardMap.conditions.season} •{" "}
                        {draftState.wildcardMap.conditions.ground} •{" "}
                        {draftState.wildcardMap.conditions.weather}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-center">
              {!revealStarted ? (
                <button
                  onClick={startReveal}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-12 rounded-lg text-xl transition-colors shadow-lg"
                >
                  Reveal Wildcard Map
                </button>
              ) : cyclingMap ? (
                <div className="text-gray-400 text-lg">Revealing...</div>
              ) : (
                <button
                  onClick={acknowledgeDraft}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-12 rounded-lg text-xl transition-colors shadow-lg"
                >
                  Start Draft
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team Name Input Modal */}
      {showTeamNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border-2 border-gray-700 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">
              Enter Team Names
            </h2>
            <p className="text-gray-400 mb-6">
              Give your teams custom names for this draft
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-blue-400 mb-2">
                  Team 1 Name
                </label>
                <input
                  type="text"
                  value={tempTeam1Name}
                  onChange={(e) => setTempTeam1Name(e.target.value)}
                  placeholder="Team 1"
                  maxLength={30}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-red-400 mb-2">
                  Team 2 Name
                </label>
                <input
                  type="text"
                  value={tempTeam2Name}
                  onChange={(e) => setTempTeam2Name(e.target.value)}
                  placeholder="Team 2"
                  maxLength={30}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={confirmTeamNames}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-8 rounded-lg transition-colors"
              >
                Start Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
