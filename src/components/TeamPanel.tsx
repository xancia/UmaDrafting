import type { Team, UmaMusume, Map } from "../types";

interface TeamPanelProps {
  team: Team;
  teamName?: string;
  pickedUmas: UmaMusume[];
  bannedUmas: UmaMusume[];
  pickedMaps: Map[];
  bannedMaps: Map[];
  isCurrentTurn?: boolean;
}

export default function TeamPanel({
  team,
  teamName,
  pickedUmas,
  bannedUmas,
  pickedMaps,
  bannedMaps,
  isCurrentTurn = false,
}: TeamPanelProps) {
  const isTeam1 = team === "team1";
  const teamColor = isTeam1 ? "text-blue-500" : "text-red-500";

  const borderColor = isCurrentTurn
    ? isTeam1
      ? "border-blue-500 shadow-blue-500/50"
      : "border-red-500 shadow-red-500/50"
    : "border-gray-700";

  const defaultTeamName = isTeam1 ? "Team 1" : "Team 2";
  const displayName = teamName || defaultTeamName;

  const allUmas = [...pickedUmas, ...bannedUmas];
  const allMaps = [...pickedMaps, ...bannedMaps];

  return (
    <div
      className={`bg-linear-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-gray-100 h-full flex flex-col border-2 transition-all overflow-y-auto ${borderColor} ${
        isCurrentTurn ? "shadow-lg" : "shadow-2xl"
      }`}
    >
      <div className="text-center mb-6 pb-4 border-b-2 border-gray-700 shrink-0">
        <h2 className={`text-3xl font-bold tracking-wide ${teamColor}`}>
          {displayName}
        </h2>
      </div>

      <div className="mb-6 shrink-0">
        <h3 className="text-lg font-bold mb-3 text-gray-300 uppercase tracking-wider">
          Umamusume <span className="text-sm">({allUmas.length}/6)</span>
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, index) => {
            const uma = allUmas[index];
            const isBanned = uma && bannedUmas.some((b) => b.id === uma.id);
            return (
              <div
                key={index}
                className={`aspect-square rounded-lg border-3 overflow-hidden ${
                  uma
                    ? "border-gray-600 bg-gray-600 shadow-lg"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                {uma ? (
                  <div className="relative w-full h-full group">
                    <img
                      src={uma.imageUrl}
                      alt={uma.name}
                      className={`w-full h-full object-cover ${
                        isBanned ? "grayscale opacity-30" : ""
                      }`}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        target.nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                    <div className="hidden text-xl text-gray-400 w-full h-full items-center justify-center">
                      ?
                    </div>
                    {isBanned && (
                      <div className="absolute inset-0 flex items-center justify-center text-red-500 text-4xl font-bold">
                        ✕
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                      <span className="text-sm font-semibold text-center wrap-break-word text-white">
                        {uma.name}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-xl shrink-0">
                    ?
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 shrink-0 min-w-0">
        <h3 className="text-lg font-bold mb-3 text-gray-300 uppercase tracking-wider">
          Maps <span className="text-sm">({allMaps.length}/4)</span>
        </h3>
        <div className="space-y-2.5">
          {[...Array(4)].map((_, index) => {
            const map = allMaps[index];
            const isBanned = map && bannedMaps.some((b) => b.id === map.id);
            const surfaceColor = map
              ? map.surface.toLowerCase() === "turf"
                ? "bg-green-700"
                : "bg-amber-800"
              : "";
            return map ? (
              <div
                key={map.id}
                className={`px-4 py-3 rounded-lg border min-w-0 relative ${
                  isBanned
                    ? `${surfaceColor}/30 border-gray-700`
                    : `${surfaceColor} border-gray-700`
                }`}
              >
                <div
                  className={`text-base font-semibold truncate ${
                    isBanned ? "text-gray-400 line-through" : "text-white"
                  }`}
                >
                  {map.track}
                </div>
                <div
                  className={`text-sm truncate ${
                    isBanned ? "text-gray-500 line-through" : "text-gray-100"
                  }`}
                >
                  {map.distance} • {map.surface}
                  {map.variant && ` • ${map.variant}`}
                </div>
                {isBanned && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 text-2xl font-bold">
                    ✕
                  </div>
                )}
              </div>
            ) : (
              <div
                key={`empty-${index}`}
                className="bg-gray-800/50 px-4 py-3 rounded-lg border border-gray-700"
              >
                <div className="text-sm text-gray-600">Empty slot</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
