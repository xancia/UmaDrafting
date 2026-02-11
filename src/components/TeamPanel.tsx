import type { Team, UmaMusume, Map } from "../types";
import type { FirebasePendingSelection } from "../types/firebase";

interface TeamPanelProps {
  team: Team;
  teamName?: string;
  pickedUmas: UmaMusume[];
  bannedUmas: UmaMusume[];
  pickedMaps: Map[];
  bannedMaps: Map[];
  isCurrentTurn?: boolean;
  activeSection?: "maps" | "umas" | null;
  distanceCounts?: Record<string, number>;
  dirtCount?: number;
  pulsingBorder?: boolean;
  showMapOrder?: boolean;
  ghostSelection?: FirebasePendingSelection | null;
}

export default function TeamPanel({
  team,
  teamName,
  pickedUmas,
  bannedUmas,
  pickedMaps,
  bannedMaps,
  isCurrentTurn = false,
  activeSection = null,
  distanceCounts = {},
  dirtCount = 0,
  pulsingBorder = false,
  showMapOrder = false,
  ghostSelection = null,
}: TeamPanelProps) {
  const isTeam1 = team === "team1";
  const teamColor = isTeam1 ? "text-blue-500" : "text-red-500";

  const borderColor = isCurrentTurn
    ? isTeam1
      ? "border-blue-500 shadow-blue-500/50"
      : "border-red-500 shadow-red-500/50"
    : "border-gray-700";

  const pulseClass =
    pulsingBorder && isCurrentTurn
      ? isTeam1
        ? "animate-pulse-blue"
        : "animate-pulse-red"
      : "";

  const defaultTeamName = isTeam1 ? "Team 1" : "Team 2";
  const displayName = teamName || defaultTeamName;

  const allMaps = [...pickedMaps, ...bannedMaps];

  /** Opacity class: dim the panel when it's NOT the active team's turn (if any turn is active) */
  const inactiveOpacity =
    !isCurrentTurn && !pulsingBorder ? "" : !isCurrentTurn ? "opacity-60" : "";

  return (
    <div
      className={`bg-linear-to-br from-gray-900 to-gray-800 rounded-xl p-2 lg:p-3 xl:p-4 text-gray-100 h-full flex flex-col border-2 transition-all duration-300 overflow-y-auto hide-scrollbar ${borderColor} ${pulseClass} ${inactiveOpacity} ${
        isCurrentTurn ? "shadow-lg" : "shadow-2xl"
      }`}
    >
      <div
        className={`text-center mb-2 lg:mb-3 xl:mb-4 pb-1.5 lg:pb-2 xl:pb-3 border-b-2 shrink-0 ${isCurrentTurn ? (isTeam1 ? "border-blue-500/40" : "border-red-500/40") : "border-gray-700"}`}
      >
        <h2
          className={`text-lg lg:text-xl xl:text-2xl font-bold tracking-wide ${teamColor}`}
        >
          {displayName}
        </h2>
      </div>

      <div className="mb-2 lg:mb-3 xl:mb-4 shrink-0 min-w-0">
        <h3 className="text-xs lg:text-sm xl:text-base font-bold mb-1 text-gray-300 uppercase tracking-wider">
          Maps <span className="text-xs">({allMaps.length}/4)</span>
        </h3>

        {/* Constraint Indicators */}
        {(Object.keys(distanceCounts).length > 0 || dirtCount > 0) && (
          <div className="mb-2 p-1.5 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-xs font-semibold text-gray-400 mb-0.5">
              CONSTRAINTS:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["sprint", "mile", "medium", "long"].map((category) => {
                const count = distanceCounts[category] || 0;
                if (count === 0) return null;
                return (
                  <span
                    key={category}
                    className={`text-xs px-2 py-1 rounded capitalize ${
                      count >= 2
                        ? "bg-red-900/50 text-red-300 font-bold"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {category}: {count}/2
                  </span>
                );
              })}
              {dirtCount > 0 && (
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    dirtCount >= 2
                      ? "bg-red-900/50 text-red-300 font-bold"
                      : "bg-gray-700 text-gray-300"
                  }`}
                >
                  Dirt: {dirtCount}/2
                </span>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {[...Array(4)].map((_, index) => {
            const map = allMaps[index];
            const isBanned = map && bannedMaps.some((b) => b.id === map.id);
            // Calculate play order: Team1 picks odd positions (1,3,5,7), Team2 picks even (2,4,6,8)
            // Only picked (non-banned) maps get numbers
            const pickIndex = pickedMaps.findIndex(
              (m) => map && m.id === map.id,
            );
            const playOrder =
              pickIndex !== -1
                ? isTeam1
                  ? pickIndex * 2 + 1
                  : pickIndex * 2 + 2
                : null;
            const surfaceColor = map
              ? map.surface.toLowerCase() === "turf"
                ? "bg-green-700"
                : "bg-amber-800"
              : "";
            return map ? (
              <div
                key={map.id}
                className={`px-3 py-2 rounded-lg border min-w-0 relative flex gap-3 items-center ${
                  isBanned
                    ? `${surfaceColor}/30 border-gray-700`
                    : `${surfaceColor} border-gray-700`
                }`}
              >
                {/* Play order number badge */}
                {showMapOrder && !isBanned && (
                  <div className="w-7 h-7 shrink-0 bg-black/30 rounded-md flex items-center justify-center border border-white/20">
                    <span className="text-sm font-bold text-white">
                      {playOrder}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold truncate ${
                      isBanned ? "text-gray-400 line-through" : "text-white"
                    }`}
                  >
                    {map.track}
                  </div>
                  <div
                    className={`text-xs truncate ${
                      isBanned ? "text-gray-500 line-through" : "text-gray-100"
                    }`}
                  >
                    {map.distance} • {map.surface}
                    {map.variant && ` • ${map.variant}`}
                  </div>
                  {map.conditions && (
                    <div
                      className={`text-xs truncate ${
                        isBanned
                          ? "text-gray-500 line-through"
                          : "text-gray-300"
                      }`}
                    >
                      {map.conditions.season} • {map.conditions.ground} •{" "}
                      {map.conditions.weather}
                    </div>
                  )}
                </div>
                {isBanned && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-xl font-bold">
                    X
                  </div>
                )}
              </div>
            ) : (
              <div
                key={`empty-${index}`}
                className={`px-3 py-2 rounded-lg border transition-all duration-300 ${
                  activeSection === "maps" &&
                  index === allMaps.length &&
                  isCurrentTurn
                    ? isTeam1
                      ? "bg-gray-800/80 border-blue-500/40 border-dashed"
                      : "bg-gray-800/80 border-red-500/40 border-dashed"
                    : "bg-gray-800/50 border-gray-700"
                }`}
              >
                {/* Ghost map preview */}
                {ghostSelection?.type === "map" &&
                activeSection === "maps" &&
                index === allMaps.length &&
                isCurrentTurn ? (
                  <div className="opacity-35 animate-pulse">
                    <div className="text-sm font-semibold text-white truncate">
                      {ghostSelection.track || ghostSelection.name}
                    </div>
                    <div className="text-xs text-gray-200 truncate">
                      {ghostSelection.distance} • {ghostSelection.surface}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-600">Empty slot</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 lg:mt-3 shrink-0">
        <h3 className="text-sm lg:text-base xl:text-lg font-bold mb-1 lg:mb-2 text-gray-300 uppercase tracking-wider">
          Umamusume <span className="text-sm">({pickedUmas.length}/6)</span>
        </h3>
        <div className="grid grid-cols-3 gap-1.5 lg:gap-2 xl:gap-3">
          {[...Array(6)].map((_, index) => {
            const uma = pickedUmas[index];
            const isNextEmptySlot =
              !uma &&
              index === pickedUmas.length &&
              isCurrentTurn &&
              activeSection === "umas";
            return (
              <div
                key={index}
                className={`aspect-square rounded-lg border-3 overflow-hidden transition-all duration-300 ${
                  uma
                    ? "border-gray-600 bg-gray-600 shadow-lg"
                    : isNextEmptySlot
                      ? isTeam1
                        ? "bg-gray-800/80 border-blue-500/40 border-dashed"
                        : "bg-gray-800/80 border-red-500/40 border-dashed"
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
                      <span className="text-sm font-semibold text-center whitespace-pre-line leading-tight break-words text-white">
                        {uma.name}
                      </span>
                    </div>
                  </div>
                ) : ghostSelection?.type === "uma" &&
                  activeSection === "umas" &&
                  isNextEmptySlot ? (
                  <div className="relative w-full h-full opacity-35 animate-pulse">
                    {ghostSelection.imageUrl && (
                      <img
                        src={ghostSelection.imageUrl}
                        alt={ghostSelection.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                      <span className="text-[8px] text-gray-200 text-center block truncate">
                        {ghostSelection.name}
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

        {/* Banned Uma Section */}
        {bannedUmas.length > 0 && (
          <div className="mt-2 lg:mt-3">
            <h4 className="text-xs lg:text-sm font-semibold mb-1 text-red-400 uppercase tracking-wider">
              Banned
            </h4>
            <div className="flex gap-1.5 lg:gap-2">
              {bannedUmas.map((uma) => (
                <div
                  key={uma.id}
                  className="w-12 h-12 lg:w-14 lg:h-14 rounded-lg border-2 border-red-500/50 overflow-hidden relative"
                >
                  <img
                    src={uma.imageUrl}
                    alt={uma.name}
                    className="w-full h-full object-cover grayscale opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-red-500 text-2xl font-bold">
                    X
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
