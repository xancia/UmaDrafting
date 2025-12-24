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

  // Switch teams normally, but when transitioning to uma-ban phase, set team2 first
  if (phase === "uma-pick" && nextPhase === "uma-ban") {
    newState.currentTeam = "team2";
  } else {
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
