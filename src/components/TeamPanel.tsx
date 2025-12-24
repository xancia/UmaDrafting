import type { Team, UmaMusume, Map } from "../types";

interface TeamPanelProps {
  team: Team;
  pickedUmas: UmaMusume[];
  bannedUmas: UmaMusume[];
  pickedMaps: Map[];
  bannedMaps: Map[];
}

export default function TeamPanel({
  team,
  pickedUmas,
  bannedUmas,
  pickedMaps,
  bannedMaps,
}: TeamPanelProps) {
  const isTeam1 = team === "team1";
  const teamColor = isTeam1 ? "text-blue-500" : "text-red-500";
  const teamName = isTeam1 ? "Team 1" : "Team 2";

  return (
    <div className="bg-linear-to-br from-gray-900 to-gray-800 rounded-xl shadow-2xl p-6 text-gray-100 h-full flex flex-col">
      <div className="text-center mb-6 pb-4 border-b-2 border-gray-700 shrink-0">
        <h2 className={`text-3xl font-bold tracking-wide ${teamColor}`}>
          {teamName}
        </h2>
      </div>

      <div className="mb-6 shrink-0">
        <h3 className="text-lg font-bold mb-3 text-gray-300 uppercase tracking-wider">
          Uma Musume <span className="text-sm">({pickedUmas.length}/6)</span>
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, index) => {
            const uma = pickedUmas[index];
            return (
              <div
                key={index}
                className={`aspect-square rounded-lg border-2 overflow-hidden ${
                  uma
                    ? "border-gray-600 bg-white shadow-lg"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                {uma ? (
                  <div className="relative w-full h-full group">
                    <img
                      src={uma.imageUrl}
                      alt={uma.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        target.nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                    <div className="hidden text-xl text-gray-400 w-full h-full items-center justify-center">
                      ?
                    </div>
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                      <span className="text-xs font-semibold text-center wrap-break-word text-white">
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

      {bannedUmas.length > 0 && (
        <div className="mb-6 shrink-0">
          <h3 className="text-sm font-bold mb-2 text-gray-300 uppercase tracking-wider">
            Banned Uma
          </h3>
          <div className="flex gap-2">
            {bannedUmas.map((uma) => (
              <div
                key={uma.id}
                className="w-16 h-16 rounded-lg border-2 border-gray-600 bg-gray-800 overflow-hidden relative shrink-0"
              >
                <img
                  src={uma.imageUrl}
                  alt={uma.name}
                  className="w-full h-full object-cover grayscale opacity-30"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-red-500 text-3xl font-bold">
                  ✕
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto shrink-0 min-w-0">
        <h3 className="text-lg font-bold mb-3 text-gray-300 uppercase tracking-wider">
          Maps <span className="text-sm">({pickedMaps.length}/4)</span>
        </h3>
        <div className="space-y-2">
          {pickedMaps.map((map) => (
            <div
              key={map.id}
              className="bg-gray-800 px-3 py-2 rounded-lg border border-gray-700 min-w-0"
            >
              <div className="text-sm font-semibold truncate text-gray-200">
                {map.track}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {map.distance} • {map.surface}
                {map.variant && ` • ${map.variant}`}
              </div>
            </div>
          ))}
          {[...Array(Math.max(0, 4 - pickedMaps.length))].map((_, index) => (
            <div
              key={`empty-${index}`}
              className="bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-700"
            >
              <div className="text-xs text-gray-600">Empty slot</div>
            </div>
          ))}
        </div>

        {bannedMaps.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold mb-2 text-gray-300 uppercase tracking-wider">
              Banned Maps
            </h3>
            {bannedMaps.map((map) => (
              <div
                key={map.id}
                className="bg-gray-800/30 px-3 py-2 rounded-lg border border-gray-700 min-w-0"
              >
                <div className="text-sm font-semibold line-through truncate text-gray-400">
                  {map.track}
                </div>
                <div className="text-xs text-gray-500 line-through truncate">
                  {map.distance} • {map.surface}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
