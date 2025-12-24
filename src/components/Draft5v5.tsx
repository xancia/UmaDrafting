import { useState, useEffect } from "react";
import type { DraftState, UmaMusume, Map } from "../types";
import { getInitialDraftState, selectUma, selectMap } from "../draftLogic";
import { SAMPLE_MAPS } from "../data";
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
  const [cyclingMap, setCyclingMap] = useState<Map | null>(null);
  const [revealStarted, setRevealStarted] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showMenuConfirm, setShowMenuConfirm] = useState<boolean>(false);
  const [showTeamNameModal, setShowTeamNameModal] = useState<boolean>(true);
  const [team1Name, setTeam1Name] = useState<string>("Team 1");
  const [team2Name, setTeam2Name] = useState<string>("Team 2");
  const [tempTeam1Name, setTempTeam1Name] = useState<string>("Team 1");
  const [tempTeam2Name, setTempTeam2Name] = useState<string>("Team 2");

  const isUmaPhase =
    draftState.phase === "uma-pick" || draftState.phase === "uma-ban";
  const isComplete = draftState.phase === "complete";

  // Generate wildcard map when draft completes
  useEffect(() => {
    if (draftState.phase === "complete" && !draftState.wildcardMap) {
      // Use a timeout to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        // Collect all selected maps (picked and banned from both teams)
        const allSelectedMaps = [
          ...draftState.team1.pickedMaps,
          ...draftState.team1.bannedMaps,
          ...draftState.team2.pickedMaps,
          ...draftState.team2.bannedMaps,
        ];
        const selectedMapIds = new Set(allSelectedMaps.map((m) => m.id));

        // Filter available maps that weren't selected
        const availableMaps = SAMPLE_MAPS.filter(
          (m) => !selectedMapIds.has(m.id)
        );

        const randomMap =
          availableMaps[Math.floor(Math.random() * availableMaps.length)];
        setDraftState((prev) => ({ ...prev, wildcardMap: randomMap }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [draftState]);

  // Cycle through random maps during wildcard reveal animation
  useEffect(() => {
    if (isComplete && draftState.wildcardMap && revealStarted) {
      // Collect all selected maps
      const allSelectedMaps = [
        ...draftState.team1.pickedMaps,
        ...draftState.team1.bannedMaps,
        ...draftState.team2.pickedMaps,
        ...draftState.team2.bannedMaps,
      ];
      const selectedMapIds = new Set(allSelectedMaps.map((m) => m.id));
      const availableMaps = SAMPLE_MAPS.filter(
        (m) => !selectedMapIds.has(m.id)
      );

      const interval = setInterval(() => {
        const randomMap =
          availableMaps[Math.floor(Math.random() * availableMaps.length)];
        setCyclingMap(randomMap);
      }, 150); // Change map every 150ms

      // Stop cycling after 3 seconds and show final wildcard
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setCyclingMap(null);
      }, 3000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isComplete, revealStarted, draftState]);

  const handleUmaSelect = (uma: UmaMusume) => {
    const newState = selectUma(draftState, uma);
    setDraftState(newState);
    setHistory([...history, newState]);
  };

  const handleMapSelect = (map: Map) => {
    const newState = selectMap(draftState, map);
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
      setRevealStarted(false);
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
    setRevealStarted(false);
    setShowResetConfirm(false);
  };

  const handleBackToMenu = () => {
    setShowMenuConfirm(true);
  };

  const confirmBackToMenu = () => {
    onBackToMenu();
  };

  const confirmTeamNames = () => {
    setTeam1Name(tempTeam1Name || "Team 1");
    setTeam2Name(tempTeam2Name || "Team 2");
    setShowTeamNameModal(false);
  };

  // Get opponent's picked items for ban phase
  const getOpponentTeam = () => {
    return draftState.currentTeam === "team1" ? "team2" : "team1";
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
      <div className="w-96 shrink-0 overflow-y-auto">
        <TeamPanel
          team="team1"
          teamName={team1Name}
          pickedUmas={draftState.team1.pickedUmas}
          bannedUmas={draftState.team1.bannedUmas}
          pickedMaps={draftState.team1.pickedMaps}
          bannedMaps={draftState.team1.bannedMaps}
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

          {isComplete && draftState.wildcardMap && !revealStarted && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-700">
              <h2 className="text-4xl font-bold text-gray-100 mb-8">
                Final Map Reveal!
              </h2>
              <div className="flex justify-center mb-8">
                <div className="bg-gray-700 border-4 border-gray-600 rounded-xl p-8 max-w-md">
                  <div className="flex items-center justify-center h-full mb-4">
                    <button
                      onClick={() => setRevealStarted(true)}
                      className="bg-gray-800 hover:bg-gray-900 text-white font-bold text-2xl py-8 px-12 rounded-xl shadow-2xl transition-all transform hover:scale-105 border-2 border-gray-700"
                    >
                      Reveal
                    </button>
                  </div>
                  <div className="text-center">
                    <div className="h-10 mb-2"></div>
                    <div className="h-8 mb-2"></div>
                    <div className="h-7"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isComplete && draftState.wildcardMap && revealStarted && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-700">
              <h2 className="text-4xl font-bold text-gray-100 mb-8">
                Final Map Reveal!
              </h2>
              <div className="flex justify-center mb-8 relative">
                {/* Invisible placeholder to reserve space */}
                <div className="bg-gray-700 border-4 border-transparent rounded-xl p-8 max-w-md opacity-0 pointer-events-none">
                  <div className="aspect-video bg-gray-600 rounded-lg mb-4"></div>
                  <h3 className="text-3xl font-bold mb-2">Placeholder</h3>
                  <div className="inline-block px-4 py-2 rounded-lg mb-2">
                    <span className="text-lg font-semibold">Surface</span>
                  </div>
                  <p className="text-xl">1000m</p>
                </div>
                {/* Actual card with absolute positioning */}
                <div className="wildcard-reveal bg-gray-700 border-4 border-blue-500 rounded-xl p-8 max-w-md absolute top-0 left-1/2 -translate-x-1/2">
                  <div className="aspect-video bg-gray-600 rounded-lg mb-4 overflow-hidden">
                    <img
                      src={`./racetrack-portraits/${(
                        cyclingMap || draftState.wildcardMap
                      ).track.toLowerCase()}.png`}
                      alt={(cyclingMap || draftState.wildcardMap).track}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-2">
                    {(cyclingMap || draftState.wildcardMap).track}
                  </h3>
                  <div
                    className={`inline-block px-4 py-2 rounded-lg mb-2 ${
                      (
                        cyclingMap || draftState.wildcardMap
                      ).surface.toLowerCase() === "turf"
                        ? "bg-green-700"
                        : "bg-amber-800"
                    }`}
                  >
                    <span className="text-lg font-semibold text-white">
                      {(cyclingMap || draftState.wildcardMap).surface}
                    </span>
                  </div>
                  <p className="text-xl text-gray-200">
                    {(cyclingMap || draftState.wildcardMap).distance}m
                    {(cyclingMap || draftState.wildcardMap).variant &&
                      ` (${(cyclingMap || draftState.wildcardMap).variant})`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-96 shrink-0 overflow-y-auto">
        <TeamPanel
          team="team2"
          teamName={team2Name}
          pickedUmas={draftState.team2.pickedUmas}
          bannedUmas={draftState.team2.bannedUmas}
          pickedMaps={draftState.team2.pickedMaps}
          bannedMaps={draftState.team2.bannedMaps}
        />
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
