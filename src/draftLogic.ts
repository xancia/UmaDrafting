import type { DraftState, DraftPhase, Team, UmaMusume, Map } from "./types";
import { SAMPLE_UMAS, SAMPLE_MAPS } from "./data";

export const getInitialDraftState = (): DraftState => ({
  phase: "uma-pick",
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
});

export const getNextTeam = (current: Team): Team => {
  return current === "team1" ? "team2" : "team1";
};

export const getNextPhase = (state: DraftState): DraftPhase => {
  const { phase, team1, team2 } = state;

  if (phase === "uma-pick") {
    const totalPicks = team1.pickedUmas.length + team2.pickedUmas.length;
    if (totalPicks >= 12) return "uma-ban";
  } else if (phase === "uma-ban") {
    const totalBans = team1.bannedUmas.length + team2.bannedUmas.length;
    if (totalBans >= 2) return "map-pick";
  } else if (phase === "map-pick") {
    const totalPicks = team1.pickedMaps.length + team2.pickedMaps.length;
    if (totalPicks >= 8) return "map-ban";
  } else if (phase === "map-ban") {
    const totalBans = team1.bannedMaps.length + team2.bannedMaps.length;
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

export const selectUma = (state: DraftState, uma: UmaMusume): DraftState => {
  const { phase, currentTeam } = state;
  const newState = { ...state };

  if (phase === "uma-pick") {
    newState[currentTeam] = {
      ...newState[currentTeam],
      pickedUmas: [...newState[currentTeam].pickedUmas, uma],
    };
    newState.availableUmas = newState.availableUmas.filter(
      (u) => u.id !== uma.id
    );
  } else if (phase === "uma-ban") {
    // Remove from the opponent's picked umas and add to opponent team's banned list
    const opponentTeam = currentTeam === "team1" ? "team2" : "team1";
    newState[opponentTeam] = {
      ...newState[opponentTeam],
      pickedUmas: newState[opponentTeam].pickedUmas.filter(
        (u) => u.id !== uma.id
      ),
      bannedUmas: [...newState[opponentTeam].bannedUmas, uma],
    };
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

  // When transitioning to map-pick phase, set team2 first
  // When transitioning to map-ban phase, set team1 first
  if (phase === "uma-ban" && nextPhase === "map-pick") {
    newState.currentTeam = "team2";
  } else if (phase === "map-pick" && nextPhase === "map-ban") {
    newState.currentTeam = "team1";
  } else {
    newState.currentTeam = getNextTeam(currentTeam);
  }

  newState.phase = nextPhase;

  return newState;
};
