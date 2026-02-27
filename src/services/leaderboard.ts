import { onValue, ref } from "firebase/database";
import type { Unsubscribe } from "firebase/database";
import { buildPath, db } from "../config/firebase";

export interface LeaderboardEntry {
  discordUserId: string;
  rating: number;
  rd: number;
  wins: number;
  losses: number;
  displayName: string;
  lastMatchAt: string;
}

interface RawLeaderboardEntry {
  rating?: unknown;
  rd?: unknown;
  wins?: unknown;
  losses?: unknown;
  displayName?: unknown;
  lastMatchAt?: unknown;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function conservativeScore(entry: LeaderboardEntry): number {
  return entry.rating - 2 * entry.rd;
}

export function subscribeToLeaderboard(
  callback: (entries: LeaderboardEntry[]) => void,
): Unsubscribe {
  const leaderboardRef = ref(db, buildPath.leaderboard());

  return onValue(leaderboardRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const payload = snapshot.val() as Record<string, RawLeaderboardEntry>;
    const entries = Object.entries(payload).map(([discordUserId, raw]) => ({
      discordUserId,
      rating: toNumber(raw.rating, 1500),
      rd: toNumber(raw.rd, 350),
      wins: toNumber(raw.wins, 0),
      losses: toNumber(raw.losses, 0),
      displayName: toString(raw.displayName, discordUserId),
      lastMatchAt: toString(raw.lastMatchAt, ""),
    }));

    entries.sort((a, b) => conservativeScore(b) - conservativeScore(a));
    callback(entries);
  });
}
