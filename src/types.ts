export interface UmaMusume {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface TrackConditions {
  season: "Spring" | "Summer" | "Fall" | "Winter";
  ground: "Firm" | "Good" | "Soft" | "Heavy";
  weather: "Sunny" | "Cloudy" | "Rainy" | "Snowy";
}

export interface Map {
  id: string;
  track: string;
  distance: number;
  surface: "Turf" | "Dirt";
  variant?: string;
  conditions?: TrackConditions;
  name: string; // computed: "Track - Distance Surface (Variant)"
}

export type DraftPhase =
  | "lobby"
  | "wildcard-reveal"
  | "pre-draft-pause" // Pause before starting map draft (after wildcard)
  | "uma-pick"
  | "uma-ban"
  | "uma-pre-ban" // Pre-bans from available pool before uma picks
  | "map-pick"
  | "map-ban"
  | "post-map-pause" // Pause after map bans, before uma picks
  | "complete";

export type Team = "team1" | "team2";

/**
 * Optional multiplayer configuration for a draft session
 */
export interface MultiplayerState {
  /** Whether multiplayer mode is enabled */
  enabled: boolean;
  /** Connection type for the local peer */
  connectionType: "host" | "player" | "spectator";
  /** Local team assignment (which team this player controls) */
  localTeam: Team;
  /** Room ID for this multiplayer session */
  roomId: string;
  /** Team names from room setup */
  team1Name?: string;
  team2Name?: string;
}

export interface DraftState {
  phase: DraftPhase;
  currentTeam: Team;
  team1: {
    pickedUmas: UmaMusume[];
    bannedUmas: UmaMusume[];
    preBannedUmas: UmaMusume[];
    pickedMaps: Map[];
    bannedMaps: Map[];
  };
  team2: {
    pickedUmas: UmaMusume[];
    bannedUmas: UmaMusume[];
    preBannedUmas: UmaMusume[];
    pickedMaps: Map[];
    bannedMaps: Map[];
  };
  availableUmas: UmaMusume[];
  availableMaps: Map[];
  wildcardMap: Map;
  /** Optional multiplayer state - undefined means local mode */
  multiplayer?: MultiplayerState;
  /** Ready state for pause phases (multiplayer) */
  team1Ready?: boolean;
  team2Ready?: boolean;
}
