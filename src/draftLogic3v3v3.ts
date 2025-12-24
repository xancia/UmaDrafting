import type { DraftState3v3v3, Team3v3v3 } from "./types3v3v3";
import { SAMPLE_UMAS } from "./data";
import { SAMPLE_CARDS } from "./cardData";

export function getInitialDraftState3v3v3(): DraftState3v3v3 {
  return {
    phase: "team-names",
    currentTeam: "team1",
    round: 1,
    turnInRound: 0,
    team1: {
      pickedUmas: [],
      bannedUmas: [],
    },
    team2: {
      pickedUmas: [],
      bannedUmas: [],
    },
    team3: {
      pickedUmas: [],
      bannedUmas: [],
    },
    availableUmas: [...SAMPLE_UMAS],
    preBannedCards: [],
    pickedCards: [],
    availableCards: [...SAMPLE_CARDS],
  };
}

// Get the turn order for current round and phase
export function getTurnOrder(
  round: number,
  phase: "uma-ban" | "uma-pick" | "card-pick"
): Team3v3v3[] {
  // Snake pattern: odd rounds go T1→T2→T3, even rounds go T3→T2→T1
  const isOddRound = round % 2 === 1;

  if (phase === "uma-ban" || phase === "uma-pick") {
    return isOddRound
      ? ["team1", "team2", "team3"]
      : ["team3", "team2", "team1"];
  }

  // Card pick follows same snake pattern
  return isOddRound ? ["team1", "team2", "team3"] : ["team3", "team2", "team1"];
}

export function getNextTeamAndPhase(state: DraftState3v3v3): {
  nextTeam: Team3v3v3;
  nextPhase: DraftState3v3v3["phase"];
  nextRound: number;
  nextTurnInRound: number;
} {
  const { phase, round, turnInRound } = state;

  if (phase === "uma-ban") {
    const turnOrder = getTurnOrder(round, "uma-ban");

    // If we've completed all 3 bans in this round
    if (turnInRound >= 2) {
      // Move to uma-pick phase
      const pickOrder = getTurnOrder(round, "uma-pick");
      return {
        nextTeam: pickOrder[0],
        nextPhase: "uma-pick",
        nextRound: round,
        nextTurnInRound: 0,
      };
    }

    // Continue with next ban
    return {
      nextTeam: turnOrder[turnInRound + 1],
      nextPhase: "uma-ban",
      nextRound: round,
      nextTurnInRound: turnInRound + 1,
    };
  }

  if (phase === "uma-pick") {
    const turnOrder = getTurnOrder(round, "uma-pick");

    // If we've completed all 3 picks in this round
    if (turnInRound >= 2) {
      // Check if we've done all 3 rounds
      if (round >= 3) {
        // Move to card-pick phase
        const cardOrder = getTurnOrder(1, "card-pick");
        return {
          nextTeam: cardOrder[0],
          nextPhase: "card-pick",
          nextRound: 1,
          nextTurnInRound: 0,
        };
      }

      // Start next round with bans
      const nextRound = round + 1;
      const nextBanOrder = getTurnOrder(nextRound, "uma-ban");
      return {
        nextTeam: nextBanOrder[0],
        nextPhase: "uma-ban",
        nextRound: nextRound,
        nextTurnInRound: 0,
      };
    }

    // Continue with next pick
    return {
      nextTeam: turnOrder[turnInRound + 1],
      nextPhase: "uma-pick",
      nextRound: round,
      nextTurnInRound: turnInRound + 1,
    };
  }

  if (phase === "card-pick") {
    const turnOrder = getTurnOrder(round, "card-pick");

    // If we've completed all 3 picks in this round
    if (turnInRound >= 2) {
      // Check if we've done all 5 rounds
      if (round >= 5) {
        return {
          nextTeam: state.currentTeam,
          nextPhase: "complete",
          nextRound: round,
          nextTurnInRound: turnInRound,
        };
      }

      // Start next round
      const nextRound = round + 1;
      const nextCardOrder = getTurnOrder(nextRound, "card-pick");
      return {
        nextTeam: nextCardOrder[0],
        nextPhase: "card-pick",
        nextRound: nextRound,
        nextTurnInRound: 0,
      };
    }

    // Continue with next pick
    return {
      nextTeam: turnOrder[turnInRound + 1],
      nextPhase: "card-pick",
      nextRound: round,
      nextTurnInRound: turnInRound + 1,
    };
  }

  // Default fallback
  return {
    nextTeam: state.currentTeam,
    nextPhase: state.phase,
    nextRound: round,
    nextTurnInRound: turnInRound,
  };
}
