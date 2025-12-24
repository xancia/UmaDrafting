import type { DraftPhase, Team } from "../types";

interface DraftHeaderProps {
  phase: DraftPhase;
  currentTeam: Team;
  onUndo: () => void;
  onReset: () => void;
  canUndo: boolean;
}

export default function DraftHeader({
  phase,
  currentTeam,
  onUndo,
  onReset,
  canUndo,
}: DraftHeaderProps) {
  const getPhaseText = () => {
    switch (phase) {
      case "uma-pick":
        return "Uma Musume Picking Phase";
      case "uma-ban":
        return "Uma Musume Banning Phase";
      case "map-pick":
        return "Map Picking Phase";
      case "map-ban":
        return "Map Banning Phase";
      case "complete":
        return "Draft Complete!";
      default:
        return "";
    }
  };

  const getTeamColor = (team: Team) => {
    return team === "team1" ? "text-blue-500" : "text-red-500";
  };

  return (
    <div className="bg-gray-800 text-gray-100 p-6 rounded-lg shadow-lg border border-gray-700">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">Terumi's Wild Ride</h1>
          <p className="text-xl mb-1 text-gray-300">{getPhaseText()}</p>
          {phase !== "complete" && (
            <p className="text-lg text-gray-300">
              Current Turn:{" "}
              <span className={`font-bold ${getTeamColor(currentTeam)}`}>
                {currentTeam === "team1" ? "Team 1" : "Team 2"}
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="bg-gray-700 text-gray-100 font-semibold py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700 border border-gray-600"
          >
            ← Undo
          </button>
          <button
            onClick={onReset}
            className="bg-gray-700 text-gray-100 font-semibold py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
