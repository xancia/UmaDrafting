import type { Team, UmaMusume } from "../types";

export const MATCH_POINT_VALUES = { 1: 4, 2: 2, 3: 1 } as const;

export interface MatchPlacement {
  position: number;
  umaId: string;
  umaName: string;
  umaTitle?: string;
  team: Team;
}

export interface MatchResultLike {
  raceIndex: number;
  placements: MatchPlacement[];
}

export type DraftedUmaWithTeam = UmaMusume & { team: Team };

export interface UmaMatchStats {
  umaId: string;
  team: Team;
  totalPoints: number;
  firsts: number;
  seconds: number;
  thirds: number;
  podiums: number;
}

export function getPlacementPoints(position: number): number {
  if (position === 1 || position === 2 || position === 3) {
    return MATCH_POINT_VALUES[position];
  }
  return 0;
}

export function getRaceScore(result: MatchResultLike): {
  team1Points: number;
  team2Points: number;
} {
  let team1Points = 0;
  let team2Points = 0;

  for (const placement of result.placements) {
    const points = getPlacementPoints(placement.position);
    if (placement.team === "team1") {
      team1Points += points;
    } else {
      team2Points += points;
    }
  }

  return { team1Points, team2Points };
}

export function buildUmaMatchStats(
  draftedUmas: DraftedUmaWithTeam[],
  results: MatchResultLike[],
): {
  statsByUmaId: Record<string, UmaMatchStats>;
  mvpUmaIds: string[];
  topPoints: number;
} {
  const statsByUmaId: Record<string, UmaMatchStats> = {};

  for (const uma of draftedUmas) {
    const umaId = uma.id.toString();
    statsByUmaId[umaId] = {
      umaId,
      team: uma.team,
      totalPoints: 0,
      firsts: 0,
      seconds: 0,
      thirds: 0,
      podiums: 0,
    };
  }

  for (const result of results) {
    for (const placement of result.placements) {
      const umaId = placement.umaId.toString();
      const stats = statsByUmaId[umaId] || {
        umaId,
        team: placement.team,
        totalPoints: 0,
        firsts: 0,
        seconds: 0,
        thirds: 0,
        podiums: 0,
      };

      stats.totalPoints += getPlacementPoints(placement.position);
      stats.podiums += 1;

      if (placement.position === 1) stats.firsts += 1;
      if (placement.position === 2) stats.seconds += 1;
      if (placement.position === 3) stats.thirds += 1;

      statsByUmaId[umaId] = stats;
    }
  }

  const allStats = Object.values(statsByUmaId);
  const topPoints = allStats.reduce(
    (currentTop, stats) => Math.max(currentTop, stats.totalPoints),
    0,
  );
  const mvpUmaIds =
    topPoints > 0
      ? allStats
          .filter((stats) => stats.totalPoints === topPoints)
          .map((stats) => stats.umaId)
      : [];

  return { statsByUmaId, mvpUmaIds, topPoints };
}
