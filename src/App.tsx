import { useState } from "react";
import type { DraftState, UmaMusume, Map } from "./types";
import { getInitialDraftState, selectUma, selectMap } from "./draftLogic";
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
    }
  };

  const handleReset = () => {
    const initialState = getInitialDraftState();
    setDraftState(initialState);
    setHistory([initialState]);
    setSelectedTrack(null);
  };

  const isUmaPhase =
    draftState.phase === "uma-pick" || draftState.phase === "uma-ban";
  const isMapPhase =
    draftState.phase === "map-pick" || draftState.phase === "map-ban";
  const isComplete = draftState.phase === "complete";

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
                {draftState.phase === "uma-pick" && "Available Uma Musume"}
                {draftState.phase === "uma-ban" && "Ban Opponent's Uma Musume"}
                {draftState.phase === "map-pick" &&
                  !selectedTrack &&
                  "Select a Racecourse"}
                {draftState.phase === "map-pick" &&
                  selectedTrack &&
                  `Select Distance - ${selectedTrack}`}
                {draftState.phase === "map-ban" && "Ban Opponent's Map"}
              </h2>

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
                  getBannableUmas().map((uma) => (
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
                      className="p-6 bg-gray-700 border-2 border-gray-600 rounded-lg hover:border-gray-500 hover:shadow-lg transition-all"
                    >
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

          {isComplete && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-700">
              <h2 className="text-3xl font-bold text-gray-100 mb-4">
                Draft Complete!
              </h2>
              <p className="text-lg text-gray-300 mb-6">
                The draft has been completed successfully!
              </p>
              <button
                onClick={handleReset}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-bold py-3 px-6 rounded-lg transition-colors border border-gray-600"
              >
                Start New Draft
              </button>
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
