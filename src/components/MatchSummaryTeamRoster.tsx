import type { UmaMusume } from "../types";
import { formatUmaName } from "../utils/umaDisplay";
import type { UmaMatchStats } from "../utils/matchStats";

interface MatchSummaryTeamRosterProps {
  teamName: string;
  accent: "blue" | "red";
  pickedUmas: UmaMusume[];
  preBannedUmas?: UmaMusume[];
  bannedUmas: UmaMusume[];
  statsByUmaId: Record<string, UmaMatchStats>;
  mvpUmaIds: string[];
}

export default function MatchSummaryTeamRoster({
  teamName,
  accent,
  pickedUmas,
  preBannedUmas = [],
  bannedUmas,
  statsByUmaId,
  mvpUmaIds,
}: MatchSummaryTeamRosterProps) {
  const mvpSet = new Set(mvpUmaIds);
  const isBlue = accent === "blue";
  const containerBorder = isBlue ? "border-blue-500/20" : "border-red-500/20";
  const headingColor = isBlue ? "text-blue-400" : "text-red-400";
  const imageBorder = isBlue ? "border-blue-500/30" : "border-red-500/30";

  return (
    <div
      className={`bg-gray-900/60 rounded-lg p-3 lg:p-4 border ${containerBorder}`}
    >
      <h3
        className={`${headingColor} font-bold text-sm lg:text-base mb-2 text-center uppercase tracking-wider`}
      >
        {teamName}
      </h3>
      <div className="grid grid-cols-3 gap-1.5 lg:gap-2 mb-2">
        {pickedUmas.map((uma) => {
          const umaId = uma.id.toString();
          const stats = statsByUmaId[umaId];
          const isMvp = mvpSet.has(umaId);

          return (
            <div
              key={umaId}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-1 ${
                isMvp
                  ? "bg-amber-400/10 ring-1 ring-amber-300/60 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
                  : ""
              }`}
              title={
                stats && stats.totalPoints > 0
                  ? `${formatUmaName(uma)} earned ${stats.totalPoints} point${stats.totalPoints !== 1 ? "s" : ""}`
                  : undefined
              }
            >
              {isMvp && (
                <span className="absolute -top-1 -right-1 rounded-full border border-amber-200/80 bg-amber-300 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-amber-950">
                  MVP
                </span>
              )}
              <div
                className={`w-10 h-10 lg:w-12 lg:h-12 rounded-lg overflow-hidden border bg-gray-700 ${
                  isMvp ? "border-amber-300" : imageBorder
                }`}
              >
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
          );
        })}
      </div>
      {preBannedUmas.length > 0 && (
        <div className="mt-1 pt-1 border-t border-gray-700/50">
          <span className="text-[10px] lg:text-xs text-orange-300 uppercase font-semibold">
            Pre-Banned:{" "}
          </span>
          <span className="text-[10px] lg:text-xs text-gray-300">
            {preBannedUmas.map((uma) => formatUmaName(uma)).join(", ")}
          </span>
        </div>
      )}
      {bannedUmas.length > 0 && (
        <div className="mt-1 pt-1 border-t border-gray-700/50">
          <span className="text-[10px] lg:text-xs text-red-300 uppercase font-semibold">
            Vetoed By Enemy Team:{" "}
          </span>
          <span className="text-[10px] lg:text-xs text-gray-300">
            {bannedUmas.map((uma) => formatUmaName(uma)).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
