import { useState, useEffect } from "react";
import type { DraftState, UmaMusume, Map } from "./types";
import { getInitialDraftState, selectUma, selectMap } from "./draftLogic";
import { SAMPLE_MAPS } from "./data";
import DraftHeader from "./components/DraftHeader";
import TeamPanel from "./components/TeamPanel";
import UmaCard from "./components/UmaCard";
import MapCard from "./components/MapCard";

function App() {
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
    const initialState = getInitialDraftState();
    setDraftState(initialState);
    setHistory([initialState]);
    setSelectedTrack(null);
    setUmaSearch("");
    setRevealStarted(false);
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
          pickedUmas={draftState.team2.pickedUmas}
          bannedUmas={draftState.team2.bannedUmas}
          pickedMaps={draftState.team2.pickedMaps}
          bannedMaps={draftState.team2.bannedMaps}
        />
      </div>
    </div>
  );
}

export default App;
