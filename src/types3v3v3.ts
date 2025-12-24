import type { UmaMusume } from "./types";

export interface Card {
  id: string;
  name: string;
  rarity: "SSR" | "SR" | "R";
  type?: "speed" | "stamina" | "power" | "guts" | "wit" | "friend";
  imageUrl?: string;
}

export type Team3v3v3 = "team1" | "team2" | "team3";

export type Draft3v3v3Phase =
  | "team-names"
  | "card-preban"
  | "uma-ban"
  | "uma-pick"
  | "card-pick"
  | "complete";

export interface TeamData3v3v3 {
  pickedUmas: UmaMusume[];
  bannedUmas: UmaMusume[];
  pickedCards: Card[];
}

export interface DraftState3v3v3 {
  phase: Draft3v3v3Phase;
  currentTeam: Team3v3v3;
  round: number; // Track which round we're in
  turnInRound: number; // Track position within the round (0-5 for ban+pick)
  team1: TeamData3v3v3;
  team2: TeamData3v3v3;
  team3: TeamData3v3v3;
  availableUmas: UmaMusume[];
  preBannedCards: Card[];
  pickedCards: Card[]; // All picked cards (shared pool)
  availableCards: Card[];
}
