import { PRE_BANS_PER_TEAM } from "../draftLogic";
import type { DraftPhase, Team, UmaMusume, Map } from "../types";
import type { FirebasePendingSelection } from "../types/firebase";

interface TeamPanelProps {
  team: Team;
  teamName?: string;
  pickedUmas: UmaMusume[];
  bannedUmas: UmaMusume[];
  preBannedUmas?: UmaMusume[];
  pickedMaps: Map[];
  bannedMaps: Map[];
  isCurrentTurn?: boolean;
  activeSection?: "maps" | "umas" | null;
  distanceCounts?: Record<string, number>;
  dirtCount?: number;
  pulsingBorder?: boolean;
  showMapOrder?: boolean;
  phase?: DraftPhase;
  ghostSelection?: FirebasePendingSelection | null;
  incomingVetoSelection?: FirebasePendingSelection | null;
  /** How many consecutive picks this team has in a row (for snake draft slot highlighting) */
  consecutivePicks?: number;
}

export default function TeamPanel({
  team,
  teamName,
  pickedUmas,
  bannedUmas,
  preBannedUmas = [],
  pickedMaps,
  bannedMaps,
  isCurrentTurn = false,
  activeSection = null,
  distanceCounts = {},
  dirtCount = 0,
  pulsingBorder = false,
  showMapOrder = false,
  phase = "pre-draft-pause",
  ghostSelection = null,
  incomingVetoSelection = null,
  consecutivePicks = 1,
}: TeamPanelProps) {
  const isTeam1 = team === "team1";
  const teamColor = isTeam1 ? "text-blue-500" : "text-red-500";
  const pendingUmaGhost =
    ghostSelection?.type === "uma" ? ghostSelection : null;
  const pendingPreBanGhost =
    phase === "uma-pre-ban" &&
    activeSection === "umas" &&
    isCurrentTurn &&
    pendingUmaGhost
      ? pendingUmaGhost
      : null;
  const pendingPickGhost =
    phase === "uma-pick" &&
    activeSection === "umas" &&
    isCurrentTurn &&
    pendingUmaGhost
      ? pendingUmaGhost
      : null;
  const pendingVetoGhost =
    phase === "uma-ban" && incomingVetoSelection?.type === "uma"
      ? incomingVetoSelection
      : null;
  const pendingMapBanGhost =
    phase === "map-ban" && incomingVetoSelection?.type === "map"
      ? incomingVetoSelection
      : null;
  const showBanSummary =
    preBannedUmas.length > 0 ||
    bannedUmas.length > 0 ||
    phase === "uma-pre-ban" ||
    phase === "uma-pick" ||
    phase === "uma-ban" ||
    phase === "complete";

  const borderColor = isCurrentTurn
    ? isTeam1
      ? "border-blue-500"
      : "border-red-500"
    : "border-gray-700";

  // Always glow when it's this team's turn, use stronger animation for active turn
  const glowClass = isCurrentTurn
    ? isTeam1
      ? "animate-glow-blue"
      : "animate-glow-red"
    : pulsingBorder
      ? ""
      : "";

  const defaultTeamName = isTeam1 ? "Team 1" : "Team 2";
  const displayName = teamName || defaultTeamName;

  const allMaps = [...pickedMaps, ...bannedMaps];

  /** Opacity class: dim the panel when it's NOT the active team's turn (if any turn is active) */
  const inactiveOpacity =
    !isCurrentTurn && !pulsingBorder ? "" : !isCurrentTurn ? "opacity-60" : "";

  return (
    <div
      className={`bg-linear-to-br from-gray-900 to-gray-800 rounded-xl p-2 lg:p-3 xl:p-4 text-gray-100 h-full flex flex-col border-2 transition-all duration-300 overflow-y-auto hide-scrollbar ${borderColor} ${glowClass} ${inactiveOpacity} ${
        isCurrentTurn ? "shadow-lg" : "shadow-2xl"
      }`}
    >
      <div
        className={`text-center mb-1.5 lg:mb-2 xl:mb-4 pb-1 lg:pb-1.5 xl:pb-3 border-b-2 shrink-0 ${isCurrentTurn ? (isTeam1 ? "border-blue-500/40" : "border-red-500/40") : "border-gray-700"}`}
      >
        <h2
          className={`text-lg lg:text-xl xl:text-2xl font-bold tracking-wide ${teamColor}`}
        >
          {displayName}
        </h2>
      </div>

      <div className="mb-1.5 lg:mb-2 xl:mb-4 shrink-0 min-w-0">
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

        <div className="space-y-1 lg:space-y-1">
          {[...Array(4)].map((_, index) => {
            const map = allMaps[index];
            const isBanned = map && bannedMaps.some((b) => b.id === map.id);
            const isPendingMapBanTarget =
              !!map &&
              !isBanned &&
              !!pendingMapBanGhost &&
              map.name === pendingMapBanGhost.id;
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
                className={`px-2.5 py-1.5 lg:py-1.5 rounded-lg border min-w-0 relative flex gap-3 items-center ${
                  isPendingMapBanTarget
                    ? `${surfaceColor} border-red-400/80 ring-2 ring-red-500/40 shadow-lg`
                    : isBanned
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
                      isBanned ? "text-gray-500 line-through" : "text-gray-200"
                    }`}
                  >
                    <span className={isBanned ? "" : "text-gray-50 font-semibold"}>
                      {map.distance}
                    </span>{" "}
                    • {map.surface} •{" "}
                    {map.direction === "right"
                      ? "Right"
                      : map.direction === "left"
                        ? "Left"
                        : "Straight"}
                    {map.variant && ` • ${map.variant}`}
                  </div>
                  {map.conditions && (
                    <div
                      className={`text-xs truncate ${
                        isBanned
                          ? "text-gray-500 line-through"
                        : "text-gray-100"
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
                {isPendingMapBanTarget && (
                  <>
                    <div className="absolute inset-0 border-2 border-red-400/70 animate-pulse pointer-events-none rounded-lg" />
                    <div className="absolute right-2 top-1.5 bg-red-900/80 text-red-100 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded">
                      Pending ban
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div
                key={`empty-${index}`}
                className={`px-2.5 py-1.5 lg:py-1.5 rounded-lg border transition-all duration-300 ${
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

      <div className="mt-0.5 lg:mt-1 shrink-0">
        <h3 className="text-sm lg:text-base xl:text-lg font-bold text-gray-300 uppercase tracking-wider mb-1 lg:mb-2">
          Umamusume <span className="text-sm">({pickedUmas.length}/6)</span>
        </h3>

        <div className="grid grid-cols-3 gap-1 lg:gap-1.5">
          {[...Array(6)].map((_, index) => {
            const uma = pickedUmas[index];
            const isPendingVetoTarget =
              !!uma && pendingVetoGhost?.id === uma.id.toString();
            // Highlight empty slots that will be filled in current turn sequence
            const slotOffset = index - pickedUmas.length;
            const isActiveSlot =
              !uma &&
              slotOffset >= 0 &&
              slotOffset < consecutivePicks &&
              isCurrentTurn &&
              activeSection === "umas" &&
              phase === "uma-pick";
            const isNextEmptySlot = isActiveSlot && slotOffset === 0;
            return (
              <div
                key={index}
                className={`aspect-square rounded-lg border-2 overflow-hidden transition-all duration-300 ${
                  uma
                    ? isPendingVetoTarget
                      ? "border-red-400/80 bg-gray-600 shadow-lg ring-2 ring-red-500/50"
                      : "border-gray-600 bg-gray-600 shadow-lg"
                    : isActiveSlot
                      ? isTeam1
                        ? "bg-gray-800/80 border-blue-500/40 border-dashed animate-slot-pulse-blue"
                        : "bg-gray-800/80 border-red-500/40 border-dashed animate-slot-pulse-red"
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
                    {isPendingVetoTarget && (
                      <div className="absolute inset-0 border-2 border-red-400/70 animate-pulse pointer-events-none" />
                    )}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                      <span className="text-xs font-semibold text-center whitespace-pre-line leading-tight break-words text-white">
                        {uma.name}
                      </span>
                    </div>
                    {isPendingVetoTarget && (
                      <div className="absolute bottom-0 inset-x-0 bg-red-900/75 px-1 py-0.5">
                        <span className="text-[8px] text-red-100 font-semibold text-center block truncate">
                          Pending veto
                        </span>
                      </div>
                    )}
                  </div>
                ) : pendingPickGhost && isNextEmptySlot ? (
                  <div className="relative w-full h-full opacity-35 animate-pulse">
                    {pendingPickGhost.imageUrl && (
                      <img
                        src={pendingPickGhost.imageUrl}
                        alt={pendingPickGhost.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                      <span className="text-[8px] text-gray-200 text-center block truncate">
                        {pendingPickGhost.name}
                      </span>
                    </div>
                  </div>
                ) : isActiveSlot ? (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <span
                      className={`text-lg font-bold ${isTeam1 ? "text-blue-500/60" : "text-red-500/60"}`}
                    >
                      ?
                    </span>
                    {consecutivePicks > 1 && (
                      <span
                        className={`text-[9px] font-semibold ${isTeam1 ? "text-blue-400/50" : "text-red-400/50"}`}
                      >
                        Pick {slotOffset + 1}
                      </span>
                    )}
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

        {/* Banned & Vetoed row */}
        {showBanSummary && (
          <div className="mt-1.5 pt-1.5 border-t border-gray-700/50 flex justify-between gap-2">
            <div>
              <p className="text-[10px] text-orange-300/80 uppercase tracking-wider font-semibold mb-1">
                Banned:
              </p>
              <div className="flex gap-1">
                {Array.from({ length: PRE_BANS_PER_TEAM }).map((_, index) => {
                  const uma = preBannedUmas[index];
                  const isGhostSlot =
                    !uma &&
                    index === preBannedUmas.length &&
                    !!pendingPreBanGhost;
                  return (
                    <div
                      key={uma ? `preban-${uma.id}` : `preban-empty-${index}`}
                      className={`w-[60px] h-[60px] rounded-md border shadow-md overflow-hidden relative shrink-0 ${
                        uma || isGhostSlot
                          ? "border-orange-500/50 bg-gray-600/90"
                          : "border-orange-500/20 bg-gray-800/60 border-dashed"
                      }`}
                    >
                      {uma ? (
                        <div className="relative w-full h-full group">
                          <img
                            src={uma.imageUrl}
                            alt={uma.name}
                            className="w-full h-full object-cover grayscale opacity-50"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-orange-500 text-xl font-bold drop-shadow-lg">
                            X
                          </div>
                          <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                            <span className="text-[10px] font-semibold text-center whitespace-pre-line leading-tight break-words text-white">
                              {uma.name}
                            </span>
                          </div>
                        </div>
                      ) : isGhostSlot ? (
                        <div className="relative w-full h-full opacity-40 animate-pulse">
                          {pendingPreBanGhost.imageUrl && (
                            <img
                              src={pendingPreBanGhost.imageUrl}
                              alt={pendingPreBanGhost.name}
                              className="w-full h-full object-cover grayscale"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center text-orange-400 text-xl font-bold drop-shadow-lg">
                            X
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-px">
                            <span className="text-[7px] text-orange-200 text-center block truncate">
                              {pendingPreBanGhost.name}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full" />
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-orange-900/80 py-px">
                        <span className="text-[6px] text-orange-300 font-bold uppercase text-center block tracking-wider">
                          Banned
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="ml-auto">
              <p className="text-[10px] text-red-300/80 uppercase tracking-wider font-semibold mb-1 text-right">
                Vetoed by Enemy Team:
              </p>
              <div className="flex gap-1 justify-end">
                {Array.from({ length: 1 }).map((_, index) => {
                  const uma = bannedUmas[index];
                  const isGhostSlot =
                    !uma && index === bannedUmas.length && !!pendingVetoGhost;
                  return (
                    <div
                      key={uma ? `veto-${uma.id}` : `veto-empty-${index}`}
                      className={`w-[60px] h-[60px] rounded-md border shadow-md overflow-hidden relative shrink-0 ${
                        uma || isGhostSlot
                          ? "border-red-500/50 bg-gray-600/90"
                          : "border-red-500/20 bg-gray-800/60 border-dashed"
                      }`}
                    >
                      {uma ? (
                        <div className="relative w-full h-full group">
                          <img
                            src={uma.imageUrl}
                            alt={uma.name}
                            className="w-full h-full object-cover grayscale opacity-50"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xl font-bold drop-shadow-lg">
                            X
                          </div>
                          <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                            <span className="text-[10px] font-semibold text-center whitespace-pre-line leading-tight break-words text-white">
                              {uma.name}
                            </span>
                          </div>
                        </div>
                      ) : isGhostSlot ? (
                        <div className="relative w-full h-full opacity-40 animate-pulse">
                          {pendingVetoGhost.imageUrl && (
                            <img
                              src={pendingVetoGhost.imageUrl}
                              alt={pendingVetoGhost.name}
                              className="w-full h-full object-cover grayscale"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center text-red-400 text-xl font-bold drop-shadow-lg">
                            X
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-px">
                            <span className="text-[7px] text-red-200 text-center block truncate">
                              {pendingVetoGhost.name}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full" />
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-red-900/80 py-px">
                        <span className="text-[6px] text-red-300 font-bold uppercase text-center block tracking-wider">
                          Vetoed
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
