export interface UmaMusume {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface Map {
  id: string;
  track: string;
  distance: number;
  surface: "Turf" | "Dirt";
  variant?: string;
  name: string; // computed: "Track - Distance Surface (Variant)"
}

export type DraftPhase =
  | "uma-pick"
  | "uma-ban"
  | "map-pick"
  | "map-ban"
  | "complete";

export type Team = "team1" | "team2";

export interface DraftState {
  phase: DraftPhase;
  currentTeam: Team;
  team1: {
    pickedUmas: UmaMusume[];
    bannedUmas: UmaMusume[];
    pickedMaps: Map[];
    bannedMaps: Map[];
  };
  team2: {
    pickedUmas: UmaMusume[];
    bannedUmas: UmaMusume[];
    pickedMaps: Map[];
    bannedMaps: Map[];
  };
  availableUmas: UmaMusume[];
  availableMaps: Map[];
}
