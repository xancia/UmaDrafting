import type { DraftState, DraftPhase, Team, UmaMusume, Map } from "./types";
import { SAMPLE_UMAS, SAMPLE_MAPS } from "./data";
import { generateTrackConditions } from "./utils/trackConditions";
import { findUmaVariations } from "./utils/umaUtils";

export const getInitialDraftState = (): DraftState => {
  // Generate wildcard map at initialization
  const randomMap = SAMPLE_MAPS[Math.floor(Math.random() * SAMPLE_MAPS.length)];
  const wildcardMapWithConditions: Map = {
    ...randomMap,
    conditions: generateTrackConditions(),
  };

  return {
    phase: "pre-draft-pause", // Start at pre-draft pause instead of map-pick
    currentTeam: "team1",
    team1: {
      pickedUmas: [],
      bannedUmas: [],
      pickedMaps: [],
      bannedMaps: [],
    },
    team2: {
      pickedUmas: [],
      bannedUmas: [],
      pickedMaps: [],
      bannedMaps: [],
    },
    availableUmas: [...SAMPLE_UMAS],
    availableMaps: [...SAMPLE_MAPS],
    wildcardMap: wildcardMapWithConditions,
  };
};

export const getNextTeam = (current: Team): Team => {
  return current === "team1" ? "team2" : "team1";
};

export const getNextPhase = (state: DraftState): DraftPhase => {
  const { phase, team1, team2 } = state;

  if (phase === "map-pick") {
    const totalPicks = team1.pickedMaps.length + team2.pickedMaps.length;
    if (totalPicks >= 8) return "map-ban";
  } else if (phase === "map-ban") {
    const totalBans = team1.bannedMaps.length + team2.bannedMaps.length;
    if (totalBans >= 2) return "post-map-pause"; // Pause after map bans
  } else if (phase === "uma-pick") {
    const totalPicks = team1.pickedUmas.length + team2.pickedUmas.length;
    if (totalPicks >= 12) return "uma-ban";
  } else if (phase === "uma-ban") {
    const totalBans = team1.bannedUmas.length + team2.bannedUmas.length;
    if (totalBans >= 2) {
      return "complete";
    }
  }

  return phase;
};

export const canTeamAct = (state: DraftState): boolean => {
  const { phase, currentTeam, team1, team2 } = state;
  const team = currentTeam === "team1" ? team1 : team2;

  if (phase === "uma-pick") {
    return team.pickedUmas.length < 6;
  } else if (phase === "uma-ban") {
    return team.bannedUmas.length < 1;
  } else if (phase === "map-pick") {
    return team.pickedMaps.length < 4;
  } else if (phase === "map-ban") {
    return team.bannedMaps.length < 1;
  }

  return false;
};

/**
 * Counts occurrences of each distance in a team's picked maps
 * @param maps - Array of picked maps
 * @returns Object mapping distance to count
 */
/**
 * Gets the distance category for a given distance
 * @param distance - The distance in meters
 * @returns Category: 'sprint' | 'mile' | 'medium' | 'long'
 */
export const getDistanceCategory = (distance: number): string => {
  if (distance <= 1400) return 'sprint';
  if (distance <= 1800) return 'mile';
  if (distance <= 2400) return 'medium';
  return 'long';
};

export const countDistances = (maps: Map[]): Record<string, number> => {
  return maps.reduce((acc, map) => {
    const category = getDistanceCategory(map.distance);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
};

/**
 * Checks if a team can pick a map with the given distance (max 2 per category)
 * @param maps - Team's currently picked maps
 * @param distance - Distance to check
 * @returns true if can pick (count < 2), false otherwise
 */
export const canPickDistance = (maps: Map[], distance: number): boolean => {
  const category = getDistanceCategory(distance);
  const counts = countDistances(maps);
  return (counts[category] || 0) < 2;
};

/**
 * Counts number of dirt surface maps in picked maps
 * @param maps - Array of picked maps
 * @returns Count of dirt tracks
 */
export const countDirtTracks = (maps: Map[]): number => {
  return maps.filter((m) => m.surface === "Dirt").length;
};

/**
 * Checks if a team can pick another dirt track (max 2 dirt tracks)
 * @param maps - Team's currently picked maps
 * @returns true if can pick (count < 2), false otherwise
 */
export const canPickDirt = (maps: Map[]): boolean => {
  return countDirtTracks(maps) < 2;
};

export const selectUma = (state: DraftState, uma: UmaMusume): DraftState => {
  const { phase, currentTeam } = state;
  const newState = { ...state };

  if (phase === "uma-pick") {
    newState[currentTeam] = {
      ...newState[currentTeam],
      pickedUmas: [...newState[currentTeam].pickedUmas, uma],
    };
    
    // Remove the picked uma and all its variations from available pool
    const variations = findUmaVariations(uma.name, newState.availableUmas);
    newState.availableUmas = newState.availableUmas.filter(
      (u) => !variations.some((v) => v.id === u.id)
    );
  } else if (phase === "uma-ban") {
    // Remove only the specific banned uma from opponent's picked list
    const opponentTeam = currentTeam === "team1" ? "team2" : "team1";
    
    // Check if opponent has this specific uma
    const bannedUma = newState[opponentTeam].pickedUmas.find(u => u.id === uma.id);
    
    if (bannedUma) {
      // Remove only this specific uma from opponent's picked list
      newState[opponentTeam] = {
        ...newState[opponentTeam],
        pickedUmas: newState[opponentTeam].pickedUmas.filter(
          (u) => u.id !== uma.id
        ),
        // Add only this uma to opponent's banned list
        bannedUmas: [...newState[opponentTeam].bannedUmas, bannedUma],
      };
    }
  }

  const nextPhase = getNextPhase(newState);

  // Handle uma-pick phase with snake draft pattern: T1(1), T2(2), T1(2), T2(2), T1(2), T2(2), T1(1)
  if (phase === "uma-pick" && nextPhase === "uma-pick") {
    const team1Picks = newState.team1.pickedUmas.length;
    const team2Picks = newState.team2.pickedUmas.length;

    // Determine next team based on snake draft pattern
    if (team1Picks === 1 && team2Picks === 0) {
      newState.currentTeam = "team2"; // After T1's 1st pick
    } else if (team1Picks === 1 && team2Picks === 1) {
      newState.currentTeam = "team2"; // After T2's 1st pick (T2 picks again)
    } else if (team1Picks === 1 && team2Picks === 2) {
      newState.currentTeam = "team1"; // After T2's 2nd pick
    } else if (team1Picks === 2 && team2Picks === 2) {
      newState.currentTeam = "team1"; // After T1's 2nd pick (T1 picks again)
    } else if (team1Picks === 3 && team2Picks === 2) {
      newState.currentTeam = "team2"; // After T1's 3rd pick
    } else if (team1Picks === 3 && team2Picks === 3) {
      newState.currentTeam = "team2"; // After T2's 3rd pick (T2 picks again)
    } else if (team1Picks === 3 && team2Picks === 4) {
      newState.currentTeam = "team1"; // After T2's 4th pick
    } else if (team1Picks === 4 && team2Picks === 4) {
      newState.currentTeam = "team1"; // After T1's 4th pick (T1 picks again)
    } else if (team1Picks === 5 && team2Picks === 4) {
      newState.currentTeam = "team2"; // After T1's 5th pick
    } else if (team1Picks === 5 && team2Picks === 5) {
      newState.currentTeam = "team2"; // After T2's 5th pick (T2 picks again)
    } else if (team1Picks === 5 && team2Picks === 6) {
      newState.currentTeam = "team1"; // After T2's 6th pick
    }
  } else if (phase === "uma-pick" && nextPhase === "uma-ban") {
    // When transitioning to uma-ban phase, team2 bans first
    newState.currentTeam = "team2";
  } else {
    // For all other phases, alternate teams normally
    newState.currentTeam = getNextTeam(currentTeam);
  }

  newState.phase = nextPhase;

  return newState;
};

export const selectMap = (state: DraftState, map: Map): DraftState => {
  const { phase, currentTeam } = state;
  const newState = { ...state };

  if (phase === "map-pick") {
    // Validate constraints before allowing pick
    const currentTeamMaps = newState[currentTeam].pickedMaps;
    
    // Check max 2 per distance constraint
    if (!canPickDistance(currentTeamMaps, map.distance)) {
      console.warn(`Cannot pick ${map.distance}m - already at maximum (2)`);
      return state; // Return unchanged state
    }
    
    // Check max 2 dirt tracks constraint
    if (map.surface === "Dirt" && !canPickDirt(currentTeamMaps)) {
      console.warn("Cannot pick dirt track - already at maximum (2)");
      return state; // Return unchanged state
    }
    
    newState[currentTeam] = {
      ...newState[currentTeam],
      pickedMaps: [...newState[currentTeam].pickedMaps, map],
    };
    newState.availableMaps = newState.availableMaps.filter(
      (m) => m.id !== map.id
    );
  } else if (phase === "map-ban") {
    // Remove from the opponent's picked maps and add to opponent team's banned list
    const opponentTeam = currentTeam === "team1" ? "team2" : "team1";
    newState[opponentTeam] = {
      ...newState[opponentTeam],
      pickedMaps: newState[opponentTeam].pickedMaps.filter(
        (m) => m.id !== map.id
      ),
      bannedMaps: [...newState[opponentTeam].bannedMaps, map],
    };
  }

  const nextPhase = getNextPhase(newState);

  // Map-pick → Map-ban: Team 1 bans first
  // Map-ban → Uma-pick: Team 1 picks first
  if (phase === "map-pick" && nextPhase === "map-ban") {
    newState.currentTeam = "team1";
  } else if (phase === "map-ban" && nextPhase === "post-map-pause") {
    // Maintain current team during pause (will be set to team1 when resuming)
    newState.currentTeam = currentTeam;
  } else {
    newState.currentTeam = getNextTeam(currentTeam);
  }

  newState.phase = nextPhase;

  return newState;
};

/**
 * Validates if the local team can perform an action in multiplayer mode
 * 
 * @param state - Current draft state
 * @param actionTeam - Team attempting to perform the action
 * @returns true if action is allowed, false otherwise
 */
export const validateLocalTeamAction = (
  state: DraftState,
  actionTeam: Team
): boolean => {
  // In local mode, all actions are allowed
  if (!state.multiplayer?.enabled) {
    return true;
  }

  // Spectators cannot perform actions
  if (state.multiplayer.connectionType === "spectator") {
    return false;
  }

  // Check if it's the local team's turn
  const isLocalTeamTurn = state.multiplayer.localTeam === actionTeam;
  const isCurrentTeamTurn = state.currentTeam === actionTeam;

  return isLocalTeamTurn && isCurrentTeamTurn;
};

/**
 * Wrapper for selectUma that validates multiplayer permissions
 * 
 * @param state - Current draft state
 * @param uma - Uma to select
 * @param team - Team making the selection
 * @returns New state if allowed, original state if not
 */
export const selectUmaMultiplayer = (
  state: DraftState,
  uma: UmaMusume,
  team: Team
): DraftState => {
  if (!validateLocalTeamAction(state, team)) {
    console.warn("Action not allowed: not your turn or team");
    return state;
  }

  return selectUma(state, uma);
};

/**
 * Wrapper for selectMap that validates multiplayer permissions
 * 
 * @param state - Current draft state
 * @param map - Map to select
 * @param team - Team making the selection
 * @returns New state if allowed, original state if not
 */
export const selectMapMultiplayer = (
  state: DraftState,
  map: Map,
  team: Team
): DraftState => {
  if (!validateLocalTeamAction(state, team)) {
    console.warn("Action not allowed: not your turn or team");
    return state;
  }

  return selectMap(state, map);
};

// ============================================================================
// Random Selection Functions (for turn timer timeout)
// ============================================================================

/**
 * Gets a random element from an array
 * @param arr - Array to pick from
 * @returns Random element or undefined if array is empty
 */
const getRandomElement = <T>(arr: T[]): T | undefined => {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * Gets a random available uma for picking during uma-pick phase
 * @param state - Current draft state
 * @returns Random available uma or undefined if none available
 */
export const getRandomAvailableUma = (state: DraftState): UmaMusume | undefined => {
  return getRandomElement(state.availableUmas);
};

/**
 * Gets a random uma from opponent's picked umas for banning during uma-ban phase
 * @param state - Current draft state
 * @returns Random bannable uma or undefined if none available
 */
export const getRandomBanUma = (state: DraftState): UmaMusume | undefined => {
  const opponentTeam = state.currentTeam === "team1" ? "team2" : "team1";
  const opponentUmas = state[opponentTeam].pickedUmas;
  return getRandomElement(opponentUmas);
};

/**
 * Gets a random available map for picking during map-pick phase
 * Respects distance and dirt track constraints
 * @param state - Current draft state
 * @returns Random valid map or undefined if none available
 */
export const getRandomAvailableMap = (state: DraftState): Map | undefined => {
  const currentTeamMaps = state[state.currentTeam].pickedMaps;
  
  // Filter available maps by constraints
  const validMaps = state.availableMaps.filter((map) => {
    // Check distance constraint (max 2 per category)
    if (!canPickDistance(currentTeamMaps, map.distance)) {
      return false;
    }
    // Check dirt constraint (max 2 dirt tracks)
    if (map.surface === "Dirt" && !canPickDirt(currentTeamMaps)) {
      return false;
    }
    return true;
  });
  
  return getRandomElement(validMaps);
};

/**
 * Gets a random map from opponent's picked maps for banning during map-ban phase
 * @param state - Current draft state
 * @returns Random bannable map or undefined if none available
 */
export const getRandomBanMap = (state: DraftState): Map | undefined => {
  const opponentTeam = state.currentTeam === "team1" ? "team2" : "team1";
  const opponentMaps = state[opponentTeam].pickedMaps;
  return getRandomElement(opponentMaps);
};

/**
 * Performs a random selection based on current phase
 * Used when turn timer expires
 * @param state - Current draft state
 * @returns Object with type and selected item, or undefined if no valid selection
 */
export const getRandomTimeoutSelection = (
  state: DraftState
): { type: "uma" | "map"; item: UmaMusume | Map } | undefined => {
  const { phase } = state;
  
  switch (phase) {
    case "uma-pick": {
      const uma = getRandomAvailableUma(state);
      if (uma) return { type: "uma", item: uma };
      break;
    }
    case "uma-ban": {
      const uma = getRandomBanUma(state);
      if (uma) return { type: "uma", item: uma };
      break;
    }
    case "map-pick": {
      const map = getRandomAvailableMap(state);
      if (map) return { type: "map", item: map };
      break;
    }
    case "map-ban": {
      const map = getRandomBanMap(state);
      if (map) return { type: "map", item: map };
      break;
    }
  }
  
  return undefined;
};
