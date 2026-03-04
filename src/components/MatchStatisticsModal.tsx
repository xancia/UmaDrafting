import type { Map } from "../types";
import { formatUmaNameFromParts } from "../utils/umaDisplay";
import {
  getRaceScore,
  type DraftedUmaWithTeam,
  type MatchResultLike,
  type UmaMatchStats,
} from "../utils/matchStats";

interface MatchStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  team1Name: string;
  team2Name: string;
  team1Roster: DraftedUmaWithTeam[];
  team2Roster: DraftedUmaWithTeam[];
  statsByUmaId: Record<string, UmaMatchStats>;
  mvpUmaIds: string[];
  topPoints: number;
  raceResults: MatchResultLike[];
  mapSchedule: { map: Map; team: string; index: number }[];
}

function sortRosterByImpact(
  roster: DraftedUmaWithTeam[],
  statsByUmaId: Record<string, UmaMatchStats>,
): DraftedUmaWithTeam[] {
  return [...roster].sort((left, right) => {
    const leftStats = statsByUmaId[left.id.toString()];
    const rightStats = statsByUmaId[right.id.toString()];
    const pointsDiff =
      (rightStats?.totalPoints || 0) - (leftStats?.totalPoints || 0);
    if (pointsDiff !== 0) return pointsDiff;
    const firstDiff = (rightStats?.firsts || 0) - (leftStats?.firsts || 0);
    if (firstDiff !== 0) return firstDiff;
    const secondDiff = (rightStats?.seconds || 0) - (leftStats?.seconds || 0);
    if (secondDiff !== 0) return secondDiff;
    const thirdDiff = (rightStats?.thirds || 0) - (leftStats?.thirds || 0);
    if (thirdDiff !== 0) return thirdDiff;
    return left.name.localeCompare(right.name);
  });
}

export default function MatchStatisticsModal({
  isOpen,
  onClose,
  team1Name,
  team2Name,
  team1Roster,
  team2Roster,
  statsByUmaId,
  mvpUmaIds,
  topPoints,
  raceResults,
  mapSchedule,
}: MatchStatisticsModalProps) {
  if (!isOpen) return null;

  const mvpSet = new Set(mvpUmaIds);
  const allRoster = [...team1Roster, ...team2Roster];
  const team1TotalPoints = team1Roster.reduce(
    (sum, uma) => sum + (statsByUmaId[uma.id.toString()]?.totalPoints || 0),
    0,
  );
  const team2TotalPoints = team2Roster.reduce(
    (sum, uma) => sum + (statsByUmaId[uma.id.toString()]?.totalPoints || 0),
    0,
  );
  const mvpNames = mvpUmaIds
    .map((umaId) => allRoster.find((uma) => uma.id.toString() === umaId))
    .filter((uma): uma is DraftedUmaWithTeam => Boolean(uma))
    .map((uma) => uma.name);
  const sortedResults = [...raceResults].sort(
    (left, right) => left.raceIndex - right.raceIndex,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-800 bg-gray-900/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-gray-500">
              Match Statistics
            </p>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-100">
              Full Series Breakdown
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-gray-700"
          >
            Close
          </button>
        </div>

        <div className="p-5 lg:p-6 space-y-6">
          {mvpNames.length > 0 && (
            <div className="rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/80">
                {mvpNames.length > 1 ? "Co-MVPs" : "Series MVP"}
              </p>
              <p className="mt-1 text-lg font-bold text-amber-200">
                {mvpNames.join(" / ")}
              </p>
              <p className="text-sm text-amber-100/75">
                {topPoints} point{topPoints !== 1 ? "s" : ""} earned
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              {
                teamName: team1Name,
                roster: sortRosterByImpact(team1Roster, statsByUmaId),
                accentBorder: "border-blue-500/25",
                accentText: "text-blue-300",
                accentBadge: "bg-blue-500/15 text-blue-200",
                totalPoints: team1TotalPoints,
              },
              {
                teamName: team2Name,
                roster: sortRosterByImpact(team2Roster, statsByUmaId),
                accentBorder: "border-red-500/25",
                accentText: "text-red-300",
                accentBadge: "bg-red-500/15 text-red-200",
                totalPoints: team2TotalPoints,
              },
            ].map((team) => (
              <section
                key={team.teamName}
                className={`rounded-xl border ${team.accentBorder} bg-gray-800/60 p-4`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3
                    className={`text-sm font-bold uppercase tracking-[0.2em] ${team.accentText}`}
                  >
                    {team.teamName}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${team.accentBadge}`}
                  >
                    {team.totalPoints} pts
                  </span>
                </div>

                <div className="space-y-2">
                  {team.roster.map((uma) => {
                    const stats = statsByUmaId[uma.id.toString()];
                    const isMvp = mvpSet.has(uma.id.toString());

                    return (
                      <div
                        key={uma.id}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                          isMvp
                            ? "border-amber-300/60 bg-amber-400/10"
                            : "border-gray-700 bg-gray-900/45"
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div
                            className={`h-12 w-12 overflow-hidden rounded-lg border bg-gray-700 ${
                              isMvp
                                ? "border-amber-300"
                                : "border-gray-600/70"
                            }`}
                          >
                            {uma.imageUrl && (
                              <img
                                src={uma.imageUrl}
                                alt={uma.name}
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          {isMvp && (
                            <span className="absolute -top-1 -right-1 rounded-full bg-amber-300 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-amber-950">
                              MVP
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-100">
                            {uma.name}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            1st x{stats?.firsts || 0} | 2nd x{stats?.seconds || 0}{" "}
                            | 3rd x{stats?.thirds || 0}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-black text-gray-100">
                            {stats?.totalPoints || 0}
                          </p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                            Points
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <section className="rounded-xl border border-gray-800 bg-gray-800/45 p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-gray-300">
              Race Breakdown
            </h3>
            <div className="space-y-2">
              {sortedResults.map((result) => {
                const scheduleEntry = mapSchedule[result.raceIndex];
                const { team1Points, team2Points } = getRaceScore(result);

                return (
                  <div
                    key={result.raceIndex}
                    className="rounded-lg border border-gray-800 bg-gray-950/55 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-gray-500">
                        Race {result.raceIndex + 1}
                      </span>
                      <span className="text-gray-200">
                        {scheduleEntry
                          ? `${scheduleEntry.map.track} ${scheduleEntry.map.distance}m`
                          : `Map ${result.raceIndex + 1}`}
                      </span>
                      <span className="ml-auto text-gray-500">
                        <span className="text-blue-400">{team1Points}</span>-
                        <span className="text-red-400">{team2Points}</span>
                      </span>
                    </div>
                    <div className="mt-2 flex flex-col gap-1 text-xs text-gray-300">
                      {result.placements.map((placement) => (
                        <div key={`${result.raceIndex}-${placement.position}`}>
                          <span
                            className={
                              placement.position === 1
                                ? "text-yellow-400"
                                : placement.position === 2
                                  ? "text-gray-300"
                                  : "text-amber-500"
                            }
                          >
                            {placement.position === 1
                              ? "1st"
                              : placement.position === 2
                                ? "2nd"
                                : "3rd"}
                          </span>
                          <span className="mx-2 text-gray-600">|</span>
                          <span
                            className={
                              placement.team === "team1"
                                ? "text-blue-300"
                                : "text-red-300"
                            }
                          >
                            {formatUmaNameFromParts(
                              placement.umaName,
                              placement.umaTitle,
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
