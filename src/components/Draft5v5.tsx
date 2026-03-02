import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { DraftState, UmaMusume, Map } from "../types";
import {
  getInitialDraftState,
  selectUma,
  selectMap,
  selectUmaMultiplayer,
  selectMapMultiplayer,
  canPickDistance,
  canPickDirt,
  countDistances,
  countDirtTracks,
  getRandomTimeoutSelection,
} from "../draftLogic";
import { SAMPLE_MAPS } from "../data";
import { generateTrackConditions } from "../utils/trackConditions";
import {
  saveDraftSession,
  clearDraftSession,
  getDraftSession,
} from "../utils/sessionStorage";
import { formatRoomCode } from "../utils/roomCode";
import { roomExists } from "../services/firebaseRoom";
import DraftHeader from "./DraftHeader";
import { getTimelineForPhase } from "./DraftTimeline";
import TeamPanel from "./TeamPanel";
import UmaCard from "./UmaCard";
import MapCard from "./MapCard";
import SpectatorView from "./SpectatorView";
import WaitingRoom from "./WaitingRoom";
import PhaseAnnouncement from "./PhaseAnnouncement";
import {
  compareUmasByRelease,
  formatUmaName,
  formatUmaNameFromParts,
  getUmaVariantNickname,
} from "../utils/umaDisplay";
import { useFirebaseRoom } from "../hooks/useFirebaseRoom";
import { useTurnTimer, DEFAULT_TURN_DURATION } from "../hooks/useTurnTimer";
import type {
  FirebasePendingAction,
  FirebasePendingSelection,
} from "../types/firebase";

// ─── Match Reporting Config ───────────────────────────────────────────
// Toggle between "points" and "wins" scoring systems
type ScoringMode = "points" | "wins";
const SCORING_MODE: ScoringMode = "points";

// Points awarded per placement (only used in "points" mode)
const POINT_VALUES = { 1: 4, 2: 2, 3: 1 } as const;
const POINTS_TO_WIN = 25;

// In "wins" mode, how many race wins to win the series
const WINS_TO_WIN = 4;

/** Check if the match series is over (winner determined) */
function isMatchSeriesOver(results: RaceResult[]): boolean {
  let team1Points = 0;
  let team2Points = 0;
  let team1Wins = 0;
  let team2Wins = 0;

  for (const result of results) {
    let raceT1 = 0;
    let raceT2 = 0;
    for (const p of result.placements) {
      const pts = POINT_VALUES[p.position as keyof typeof POINT_VALUES] || 0;
      if (p.team === "team1") raceT1 += pts;
      else raceT2 += pts;
    }
    team1Points += raceT1;
    team2Points += raceT2;
    if (raceT1 > raceT2) team1Wins++;
    else if (raceT2 > raceT1) team2Wins++;
  }

  if (SCORING_MODE === "points") {
    return team1Points >= POINTS_TO_WIN || team2Points >= POINTS_TO_WIN;
  }
  return team1Wins >= WINS_TO_WIN || team2Wins >= WINS_TO_WIN;
}

function buildPickOrderHistoryText(
  history: DraftState[],
  team1Name: string,
  team2Name: string,
): string {
  const umaLabel = (u: { id: string | number; name: string; title?: string }) =>
    formatUmaName(u);
  const formatVariant = (m: { variant?: string }) =>
    m.variant ? ` (${m.variant})` : "";

  const t1n = team1Name || "Team 1";
  const t2n = team2Name || "Team 2";
  const pickOrder: string[] = [];

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];

    // Pre-bans
    if (
      (curr.team1.preBannedUmas?.length || 0) >
      (prev.team1.preBannedUmas?.length || 0)
    ) {
      const newBans = (curr.team1.preBannedUmas || []).slice(
        prev.team1.preBannedUmas?.length || 0,
      );
      newBans.forEach((u) => pickOrder.push(`${t1n} pre-ban: ${umaLabel(u)}`));
    }
    if (
      (curr.team2.preBannedUmas?.length || 0) >
      (prev.team2.preBannedUmas?.length || 0)
    ) {
      const newBans = (curr.team2.preBannedUmas || []).slice(
        prev.team2.preBannedUmas?.length || 0,
      );
      newBans.forEach((u) => pickOrder.push(`${t2n} pre-ban: ${umaLabel(u)}`));
    }

    // Uma picks
    if (curr.team1.pickedUmas.length > prev.team1.pickedUmas.length) {
      const newPicks = curr.team1.pickedUmas.slice(
        prev.team1.pickedUmas.length,
      );
      newPicks.forEach((u) => pickOrder.push(`${t1n} pick: ${umaLabel(u)}`));
    }
    if (curr.team2.pickedUmas.length > prev.team2.pickedUmas.length) {
      const newPicks = curr.team2.pickedUmas.slice(
        prev.team2.pickedUmas.length,
      );
      newPicks.forEach((u) => pickOrder.push(`${t2n} pick: ${umaLabel(u)}`));
    }

    // Uma bans (veto) - opposing team performs the veto
    if (curr.team1.bannedUmas.length > prev.team1.bannedUmas.length) {
      const newBans = curr.team1.bannedUmas.slice(prev.team1.bannedUmas.length);
      newBans.forEach((u) => pickOrder.push(`${t2n} veto: ${umaLabel(u)}`));
    }
    if (curr.team2.bannedUmas.length > prev.team2.bannedUmas.length) {
      const newBans = curr.team2.bannedUmas.slice(prev.team2.bannedUmas.length);
      newBans.forEach((u) => pickOrder.push(`${t1n} veto: ${umaLabel(u)}`));
    }

    // Map picks
    if (curr.team1.pickedMaps.length > prev.team1.pickedMaps.length) {
      const newPicks = curr.team1.pickedMaps.slice(
        prev.team1.pickedMaps.length,
      );
      newPicks.forEach((m) =>
        pickOrder.push(
          `${t1n} map pick: ${m.track}${formatVariant(m)} ${m.distance}m`,
        ),
      );
    }
    if (curr.team2.pickedMaps.length > prev.team2.pickedMaps.length) {
      const newPicks = curr.team2.pickedMaps.slice(
        prev.team2.pickedMaps.length,
      );
      newPicks.forEach((m) =>
        pickOrder.push(
          `${t2n} map pick: ${m.track}${formatVariant(m)} ${m.distance}m`,
        ),
      );
    }

    // Map bans - opposing team performs the ban
    if (curr.team1.bannedMaps.length > prev.team1.bannedMaps.length) {
      const newBans = curr.team1.bannedMaps.slice(prev.team1.bannedMaps.length);
      newBans.forEach((m) =>
        pickOrder.push(
          `${t2n} map ban: ${m.track}${formatVariant(m)} ${m.distance}m`,
        ),
      );
    }
    if (curr.team2.bannedMaps.length > prev.team2.bannedMaps.length) {
      const newBans = curr.team2.bannedMaps.slice(prev.team2.bannedMaps.length);
      newBans.forEach((m) =>
        pickOrder.push(
          `${t1n} map ban: ${m.track}${formatVariant(m)} ${m.distance}m`,
        ),
      );
    }
  }

  return pickOrder.length > 0
    ? `=== PICK ORDER ===\n\n${pickOrder.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    : "No pick order history available.";
}

// ─── Match Result Types ──────────────────────────────────────────────
interface RacePlacement {
  position: 1 | 2 | 3;
  umaId: string;
  umaName: string;
  umaTitle?: string;
  team: "team1" | "team2";
}

interface RaceResult {
  raceIndex: number; // 0-based index into the map schedule
  placements: RacePlacement[]; // top 3
  confirmed: boolean; // team 2 agreed
}

interface PendingReport {
  raceIndex: number;
  placements: RacePlacement[];
  awaitingConfirm: boolean; // waiting for team 2
  submissionId?: number; // unique id to distinguish resubmissions
}

interface MultiplayerConfig {
  roomCode: string;
  playerName: string;
  isHost: boolean;
  isSpectator: boolean;
}

interface Draft5v5Props {
  onBackToMenu: () => void;
  multiplayerConfig?: MultiplayerConfig;
}

type SfxKey =
  | "banButtonHover"
  | "banButtonClick"
  | "lockInButtonHover"
  | "lockInButtonClick"
  | "timerTickSmall"
  | "timerTick";

const SFX_BASE_VOLUMES: Record<SfxKey, number> = {
  banButtonHover: 0.7,
  banButtonClick: 0.8,
  lockInButtonHover: 0.7,
  lockInButtonClick: 0.8,
  timerTickSmall: 0.65,
  timerTick: 0.75,
};

export default function Draft5v5({
  onBackToMenu,
  multiplayerConfig,
}: Draft5v5Props) {
  // Multiplayer setup
  const isMultiplayer = !!multiplayerConfig;

  // Firebase multiplayer hook
  const {
    room: firebaseRoom,
    draftState: syncedDraftState,
    isHost,
    isConnected,
    players: firebasePlayers,
    spectators: firebaseSpectators,
    roomCode: firebaseRoomCode,
    createRoom: firebaseCreateRoom,
    joinRoom: firebaseJoinRoom,
    updateDraftState: syncUpdateDraftState,
    sendAction: sendDraftAction,
    setPendingActionHandler,
    updatePendingSelection,
    pendingSelections,
    firebaseRoomCodes,
    updateRoomCodes: firebaseUpdateRoomCodes,
  } = useFirebaseRoom();

  // Use Firebase room code, or fallback to config for joiners
  const roomCode = firebaseRoomCode || multiplayerConfig?.roomCode || "";

  // Guard against double room creation (React 18 StrictMode)
  const roomSetupAttempted = useRef(false);

  const [draftState, setDraftState] = useState<DraftState>(() => {
    const initialState = getInitialDraftState();

    // Add multiplayer state if in multiplayer mode
    if (isMultiplayer && multiplayerConfig) {
      // Detect reconnection: host with existing room code, or non-host rejoining
      const isReconnect =
        getDraftSession() !== null && multiplayerConfig.roomCode;
      // Fresh start → lobby (waiting room); Reconnect → reconnecting (loading spinner)
      initialState.phase = isReconnect ? "reconnecting" : "lobby";
      initialState.multiplayer = {
        enabled: true,
        connectionType: multiplayerConfig.isHost
          ? "host"
          : multiplayerConfig.isSpectator
            ? "spectator"
            : "player",
        localTeam: multiplayerConfig.isHost ? "team1" : "team2", // Default assignments
        roomId: multiplayerConfig.roomCode,
        team1Name: multiplayerConfig.isHost
          ? multiplayerConfig.playerName
          : "Team 1",
        team2Name: multiplayerConfig.isHost
          ? "Team 2"
          : multiplayerConfig.playerName,
        turnDuration: DEFAULT_TURN_DURATION,
      };
    }

    return initialState;
  });
  // Ref always holds the latest draftState — survives between React batched
  // state updates, preventing stale-closure reads in Firebase callbacks and
  // the turn-timeout handler that can fire before React re-renders.
  const draftStateRef = useRef(draftState);
  draftStateRef.current = draftState;
  const [history, setHistory] = useState<DraftState[]>([
    getInitialDraftState(),
  ]);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [umaSearch, setUmaSearch] = useState<string>("");
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showMenuConfirm, setShowMenuConfirm] = useState<boolean>(false);
  const [showWildcardModal, setShowWildcardModal] = useState<boolean>(false);
  // For multiplayer, skip team name modal - names are set in waiting room
  // Only show for local/solo drafts
  const [showTeamNameModal, setShowTeamNameModal] =
    useState<boolean>(!isMultiplayer);
  const [cyclingMap, setCyclingMap] = useState<Map | null>(null);
  const [revealStarted, setRevealStarted] = useState<boolean>(false);
  const [wildcardAcknowledged, setWildcardAcknowledged] =
    useState<boolean>(false);
  const [team1Name, setTeam1Name] = useState<string>("Team 1");
  const [team2Name, setTeam2Name] = useState<string>("Team 2");
  const [tempTeam1Name, setTempTeam1Name] = useState<string>("Team 1");
  const [tempTeam2Name, setTempTeam2Name] = useState<string>("Team 2");

  // Turn timer duration (seconds) — configurable before draft starts
  const [turnDuration, setTurnDuration] = useState<number>(
    DEFAULT_TURN_DURATION,
  );

  // Pending selection state for lock-in system
  const [pendingUma, setPendingUma] = useState<UmaMusume | null>(null);
  const [pendingMap, setPendingMap] = useState<Map | null>(null);
  const [sfxVolume, setSfxVolume] = useState<number>(() => {
    const saved = localStorage.getItem("draft5v5SfxVolume");
    if (!saved) return 70;
    const parsed = Number(saved);
    if (Number.isNaN(parsed)) return 70;
    return Math.min(100, Math.max(0, parsed));
  });
  const [voicelineVolume, setVoicelineVolume] = useState<number>(() => {
    const saved = localStorage.getItem("draft5v5VoicelineVolume");
    if (!saved) return 70;
    const parsed = Number(saved);
    if (Number.isNaN(parsed)) return 70;
    return Math.min(100, Math.max(0, parsed));
  });

  // Ready-up timer (5 minutes = 300 seconds)
  const [readyUpTime, setReadyUpTime] = useState<number>(300);

  // Join/connection error state for waiting room feedback
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isRetryingJoin, setIsRetryingJoin] = useState<boolean>(false);

  // Match reporting state
  // In multiplayer, room codes are synced via Firebase; in local mode, use local state
  const [localRoomCodes, setLocalRoomCodes] = useState<Record<string, string>>(
    {},
  );
  const roomCodes = isMultiplayer ? firebaseRoomCodes : localRoomCodes;
  const setRoomCodes = isMultiplayer
    ? (
        updater:
          | Record<string, string>
          | ((prev: Record<string, string>) => Record<string, string>),
      ) => {
        const newCodes =
          typeof updater === "function" ? updater(firebaseRoomCodes) : updater;
        firebaseUpdateRoomCodes(newCodes);
      }
    : setLocalRoomCodes;
  const [copiedRoomCodeKey, setCopiedRoomCodeKey] = useState<string | null>(
    null,
  );
  const [matchResults, setMatchResults] = useState<RaceResult[]>([]);
  const [showMatchReporting, setShowMatchReporting] = useState<boolean>(false);
  const [pendingReport, setPendingReport] = useState<PendingReport | null>(
    null,
  );
  // Keep a ref in sync so the action handler (which doesn't have pendingReport
  // in its dependency array) can read the current value.
  const pendingReportRef = useRef<PendingReport | null>(null);
  // Track the raceIndex that team 2 has already responded to, to prevent
  // the sync effect from re-setting pendingReport from stale synced state.
  const respondedReportRef = useRef<number | null>(null);
  // Keep pendingReportRef in sync with state
  useEffect(() => {
    pendingReportRef.current = pendingReport;
  }, [pendingReport]);
  const [reportRaceIndex, setReportRaceIndex] = useState<number>(0);
  const [reportPlacements, setReportPlacements] = useState<{
    first: string;
    second: string;
    third: string;
  }>({ first: "", second: "", third: "" });

  // Auto-confirm countdown for player 2 (60s)
  const CONFIRM_TIMEOUT_SECONDS = 60;
  const [confirmCountdown, setConfirmCountdown] = useState<number | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Start countdown when player 2 sees a pending report awaiting confirm
    if (pendingReport?.awaitingConfirm && isMultiplayer && !isHost) {
      setConfirmCountdown(CONFIRM_TIMEOUT_SECONDS);
      confirmTimerRef.current = setInterval(() => {
        setConfirmCountdown((prev) => {
          if (prev === null) return null;
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    } else {
      setConfirmCountdown(null);
      if (confirmTimerRef.current) {
        clearInterval(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
    }
    return () => {
      if (confirmTimerRef.current) {
        clearInterval(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
    };
  }, [
    pendingReport?.awaitingConfirm,
    pendingReport?.submissionId,
    isMultiplayer,
    isHost,
  ]);

  // Auto-confirm when countdown reaches 0
  useEffect(() => {
    if (confirmCountdown === 0 && pendingReport?.awaitingConfirm && !isHost) {
      confirmMatchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmCountdown]);

  const isUmaPhase =
    draftState.phase === "uma-pick" ||
    draftState.phase === "uma-ban" ||
    draftState.phase === "uma-pre-ban";
  const isComplete = draftState.phase === "complete";

  // Clear session only when the match series is fully over (not just draft complete)
  const seriesOver = isComplete && isMatchSeriesOver(matchResults);
  useEffect(() => {
    if (seriesOver && isMultiplayer) {
      clearDraftSession();
    }
  }, [seriesOver, isMultiplayer]);

  const finalizeDraftStateForSync = useCallback(
    (state: DraftState, historyOverride?: DraftState[]) => {
      if (
        !isMultiplayer ||
        !isHost ||
        state.phase !== "complete" ||
        state.pickOrderHistoryText
      ) {
        return state;
      }

      const draftHistory =
        historyOverride ||
        (history[history.length - 1] === state ? history : [...history, state]);

      return {
        ...state,
        pickOrderHistoryText: buildPickOrderHistoryText(
          draftHistory,
          team1Name,
          team2Name,
        ),
      };
    },
    [history, isHost, isMultiplayer, team1Name, team2Name],
  );

  const persistDraftState = useCallback(
    (state: DraftState, historyOverride?: DraftState[]) => {
      const finalizedState = finalizeDraftStateForSync(state, historyOverride);
      syncUpdateDraftState(finalizedState);
      return finalizedState;
    },
    [finalizeDraftStateForSync, syncUpdateDraftState],
  );

  // Host emits finalized pick-order text exactly once when draft completes.
  useEffect(() => {
    if (!isMultiplayer || !isHost || draftState.phase !== "complete") return;
    if (draftState.pickOrderHistoryText) return;

    const draftHistory =
      history[history.length - 1] === draftState
        ? history
        : [...history, draftState];
    const pickOrderHistoryText = buildPickOrderHistoryText(
      draftHistory,
      team1Name,
      team2Name,
    );
    const newState: DraftState = {
      ...draftState,
      pickOrderHistoryText,
    };

    draftStateRef.current = newState;
    setDraftState(newState);
    persistDraftState(newState, draftHistory);
  }, [
    isMultiplayer,
    isHost,
    draftState,
    history,
    team1Name,
    team2Name,
    persistDraftState,
  ]);

  // Clear pending selection when phase or turn changes
  useEffect(() => {
    setPendingUma(null);
    setPendingMap(null);
    // Clear ghost from Firebase too
    if (isMultiplayer) {
      updatePendingSelection("team1", null);
      updatePendingSelection("team2", null);
    }
  }, [draftState.phase, draftState.currentTeam]);

  // Keyboard navigation: Enter to lock in, Escape to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Enter" && (pendingUma || pendingMap)) {
        e.preventDefault();
        const isMyTurn = !isMultiplayer || draftState.currentTeam === localTeam;
        if (isMyTurn) {
          handleLockIn();
        }
      } else if (e.key === "Escape") {
        setPendingUma(null);
        setPendingMap(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingUma, pendingMap, isMultiplayer, draftState.currentTeam]);

  // Ready-up timer countdown (resets on pause phase entry)
  useEffect(() => {
    if (
      draftState.phase === "pre-draft-pause" ||
      draftState.phase === "post-map-pause"
    ) {
      // Reset timer when entering a pause phase
      setReadyUpTime(245);

      const interval = setInterval(() => {
        setReadyUpTime((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [draftState.phase]);

  // Determine local team for multiplayer
  const localTeam =
    draftState.multiplayer?.localTeam ||
    (multiplayerConfig?.isHost ? "team1" : "team2");

  const sfxRefs = useRef<Record<SfxKey, HTMLAudioElement | null>>({
    banButtonHover: null,
    banButtonClick: null,
    lockInButtonHover: null,
    lockInButtonClick: null,
    timerTickSmall: null,
    timerTick: null,
  });
  const lastTimerSecondSfxRef = useRef<number | null>(null);

  useEffect(() => {
    const buildSfx = (filename: string, volume: number) => {
      const audio = new Audio(
        `${import.meta.env.BASE_URL}sound-effects/${filename}`,
      );
      audio.preload = "auto";
      audio.volume = volume;
      return audio;
    };

    sfxRefs.current.banButtonHover = buildSfx("sfx-ban-button-hover.ogg", 0.7);
    sfxRefs.current.banButtonClick = buildSfx("sfx-ban-button-click.ogg", 0.8);
    sfxRefs.current.lockInButtonHover = buildSfx(
      "sfx-lockin-button-hover.ogg",
      0.7,
    );
    sfxRefs.current.lockInButtonClick = buildSfx(
      "sfx-lockin-button-click.ogg",
      0.8,
    );
    sfxRefs.current.timerTickSmall = buildSfx("sfx-timer-tick-small.ogg", 0.65);
    sfxRefs.current.timerTick = buildSfx("sfx-timer-tick.ogg", 0.75);

    return () => {
      Object.values(sfxRefs.current).forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.src = "";
      });
    };
  }, []);

  useEffect(() => {
    Object.entries(sfxRefs.current).forEach(([key, audio]) => {
      if (!audio) return;
      const sfxKey = key as SfxKey;
      audio.volume = SFX_BASE_VOLUMES[sfxKey] * (sfxVolume / 100);
    });
    localStorage.setItem("draft5v5SfxVolume", String(sfxVolume));
  }, [sfxVolume]);

  useEffect(() => {
    localStorage.setItem("draft5v5VoicelineVolume", String(voicelineVolume));
  }, [voicelineVolume]);

  const playSfx = useCallback((key: SfxKey) => {
    const audio = sfxRefs.current[key];
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Ignore browser autoplay restrictions or decode errors.
    });
  }, []);

  const activeVoicelineRef = useRef<HTMLAudioElement | null>(null);
  const voicelineTokenRef = useRef(0);

  const playUmaVoiceline = useCallback(
    (uma: UmaMusume, type: "picked" | "banned") => {
      // Keep only one active voiceline so rapid picks don't overlap audio.
      voicelineTokenRef.current += 1;
      const token = voicelineTokenRef.current;

      const previousVoiceline = activeVoicelineRef.current;
      if (previousVoiceline) {
        previousVoiceline.pause();
        previousVoiceline.currentTime = 0;
        previousVoiceline.src = "";
        activeVoicelineRef.current = null;
      }

      const umaId = uma.id.toString();
      const audio = new Audio(
        `${import.meta.env.BASE_URL}Voicelines/${umaId}/${umaId}-${type}.wav`,
      );
      audio.volume = 0.9 * (voicelineVolume / 100);
      activeVoicelineRef.current = audio;
      audio.onended = () => {
        if (voicelineTokenRef.current === token) {
          activeVoicelineRef.current = null;
        }
      };
      void audio.play().catch(() => {
        // File may not exist yet for all cards, or playback may be blocked.
        if (voicelineTokenRef.current === token) {
          activeVoicelineRef.current = null;
        }
      });
    },
    [voicelineVolume],
  );

  useEffect(() => {
    return () => {
      if (!activeVoicelineRef.current) return;
      activeVoicelineRef.current.pause();
      activeVoicelineRef.current.src = "";
      activeVoicelineRef.current = null;
    };
  }, []);

  // Timer authority: you control timer when it's your turn (or always in local mode)
  const isTimerAuthority =
    !isMultiplayer || draftState.currentTeam === localTeam;

  // Processing lock — prevents overlapping timeout/action processing.
  // Set true before processing, cleared after state is committed (ref + setDraftState).
  const processingLockRef = useRef(false);

  // Per-turn action-committed guard.  Records the turnKey for which an
  // action (manual lock-in OR timeout) has already been sent.  Prevents
  // the classic race where a lock-in click and a timeout fire back-to-back
  // in the same JS task, each sending a Firebase action for the same turn.
  // Cleared automatically when the turnKey advances (see useEffect below).
  const actionCommittedForKeyRef = useRef<string | null>(null);

  // Handle turn timeout - lock in pending selection or make random selection
  const handleTurnTimeout = useCallback(() => {
    // Read from ref to always get the latest state, even if React hasn't
    // re-rendered yet after a prior setDraftState call.
    const currentState = draftStateRef.current;

    // HARD GUARD 1: Processing lock — another timeout or action is mid-flight.
    if (processingLockRef.current) {
      console.log("Ignoring timeout — processing lock active");
      return;
    }

    // HARD GUARD 2: verify this timeout is genuinely for our turn.
    const currentLocalTeam =
      currentState.multiplayer?.localTeam || (isHost ? "team1" : "team2");
    if (isMultiplayer && currentState.currentTeam !== currentLocalTeam) {
      console.log("Ignoring stale timeout — not our turn anymore");
      return;
    }

    // HARD GUARD 3: If phase is not an active pick/ban phase, ignore.
    const activePhases = [
      "uma-pick",
      "uma-ban",
      "uma-pre-ban",
      "map-pick",
      "map-ban",
    ];
    if (!activePhases.includes(currentState.phase)) {
      console.log(
        "Ignoring timeout — not in active phase:",
        currentState.phase,
      );
      return;
    }

    // HARD GUARD 4: If we already committed an action for this turn
    // (e.g. user clicked lock-in right before timer fired), bail out.
    const turnKey = `${currentState.phase}-${currentState.currentTeam}-${
      currentState.phase === "uma-pick" ||
      currentState.phase === "uma-ban" ||
      currentState.phase === "uma-pre-ban"
        ? (currentState.team1?.pickedUmas?.length || 0) +
          (currentState.team2?.pickedUmas?.length || 0) +
          (currentState.team1?.bannedUmas?.length || 0) +
          (currentState.team2?.bannedUmas?.length || 0) +
          (currentState.team1?.preBannedUmas?.length || 0) +
          (currentState.team2?.preBannedUmas?.length || 0)
        : (currentState.team1?.pickedMaps?.length || 0) +
          (currentState.team2?.pickedMaps?.length || 0) +
          (currentState.team1?.bannedMaps?.length || 0) +
          (currentState.team2?.bannedMaps?.length || 0)
    }`;
    if (actionCommittedForKeyRef.current === turnKey) {
      console.log(
        "Ignoring timeout — action already committed for turn:",
        turnKey,
      );
      return;
    }

    // Acquire processing lock — released in .finally() after React commits.
    processingLockRef.current = true;
    actionCommittedForKeyRef.current = turnKey;

    // Wrap all processing in a Promise so .finally() guarantees lock release
    // regardless of which code path (early return, error, normal exit).
    // The actual state mutations are synchronous, but we await the next
    // animation frame before releasing so React's render cycle and timer
    // reset effects have committed — no arbitrary timeout guesses.
    const processAction = new Promise<void>((resolve) => {
      console.log("Turn timeout triggered, current phase:", currentState.phase);
      const timeoutClickSfxKey: SfxKey =
        currentState.phase === "uma-ban" ||
        currentState.phase === "uma-pre-ban" ||
        currentState.phase === "map-ban"
          ? "banButtonClick"
          : "lockInButtonClick";

      // Determine if we're in a uma or map phase
      const isUmaPhaseNow =
        currentState.phase === "uma-pick" ||
        currentState.phase === "uma-ban" ||
        currentState.phase === "uma-pre-ban";
      const isMapPhaseNow =
        currentState.phase === "map-pick" || currentState.phase === "map-ban";

      // Helper to handle local state update (for host or non-multiplayer)
      const updateLocalState = (
        newState: DraftState,
        clearTrack: boolean = false,
      ) => {
        if (newState !== currentState) {
          // Update ref synchronously BEFORE setDraftState so any Firebase
          // callback that fires before React re-renders sees the new state.
          const historyForState = [...history, newState];
          const finalizedState =
            isMultiplayer && isHost
              ? persistDraftState(newState, historyForState)
              : newState;
          draftStateRef.current = finalizedState;
          setDraftState(finalizedState);
          setHistory(historyForState);
          if (clearTrack) {
            setSelectedTrack(null);
          }
        }
      };

      // Helper to send action for non-host multiplayer
      const sendAction = (
        itemId: string,
        itemType: "uma" | "map",
        action: "pick" | "ban",
      ) => {
        sendDraftAction({
          action,
          itemId,
          itemType,
        });
        // Non-host: don't update local state - wait for Firebase sync
        // Just reset track selection for map picks
        if (itemType === "map") {
          setSelectedTrack(null);
        }
      };

      // If user has a pending selection, lock it in
      if (pendingUma && isUmaPhaseNow) {
        console.log("Locking in pending uma:", pendingUma.name);
        playSfx(timeoutClickSfxKey);
        playUmaVoiceline(
          pendingUma,
          currentState.phase === "uma-pick" ? "picked" : "banned",
        );
        if (isMultiplayer && !isHost) {
          sendAction(
            pendingUma.id.toString(),
            "uma",
            currentState.phase === "uma-pick" ? "pick" : "ban",
          );
        } else {
          const newState = selectUma(currentState, pendingUma);
          updateLocalState(newState);
        }
        setPendingUma(null);
        setUmaSearch("");
        resolve();
        return;
      }

      if (pendingMap && isMapPhaseNow) {
        console.log("Locking in pending map:", pendingMap.name);
        playSfx(timeoutClickSfxKey);
        if (isMultiplayer && !isHost) {
          sendAction(
            pendingMap.name,
            "map",
            currentState.phase === "map-pick" ? "pick" : "ban",
          );
        } else {
          const mapWithConditions: Map = {
            ...pendingMap,
            conditions: pendingMap.conditions || generateTrackConditions(),
          };
          const newState = selectMap(currentState, mapWithConditions);
          updateLocalState(newState, true);
        }
        setPendingMap(null);
        resolve();
        return;
      }

      // No pending selection - make random selection
      console.log("No pending selection, making random selection");

      const selection = getRandomTimeoutSelection(currentState);
      if (!selection) {
        console.warn("No valid random selection available for timeout");
        resolve();
        return;
      }

      console.log("Auto-selecting:", selection.type, selection.item);
      playSfx(timeoutClickSfxKey);

      if (selection.type === "uma") {
        const uma = selection.item as UmaMusume;
        playUmaVoiceline(
          uma,
          currentState.phase === "uma-pick" ? "picked" : "banned",
        );
        if (isMultiplayer && !isHost) {
          sendAction(
            uma.id.toString(),
            "uma",
            currentState.phase === "uma-pick" ? "pick" : "ban",
          );
        } else {
          const newState = selectUma(currentState, uma);
          updateLocalState(newState);
        }
        setUmaSearch("");
      } else {
        const map = selection.item as Map;
        if (isMultiplayer && !isHost) {
          sendAction(
            map.name,
            "map",
            currentState.phase === "map-pick" ? "pick" : "ban",
          );
        } else {
          const mapWithConditions: Map = {
            ...map,
            conditions: map.conditions || generateTrackConditions(),
          };
          const newState = selectMap(currentState, mapWithConditions);
          updateLocalState(newState, true);
        }
      }

      resolve();
    });

    // .finally() guarantees lock release whether the promise resolved or
    // rejected.  We wait one animation frame so React's commit phase and
    // timer-reset effects have fired before any new timeout can acquire
    // the lock.
    processAction.finally(() => {
      // Use rAF so React's commit + effect cycle finishes first.  Add a
      // setTimeout fallback (50ms) in case rAF is frozen (background tab).
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        processingLockRef.current = false;
      };
      requestAnimationFrame(release);
      setTimeout(release, 50);
    });
  }, [
    isMultiplayer,
    isHost,
    syncUpdateDraftState,
    sendDraftAction,
    pendingUma,
    pendingMap,
    playSfx,
    playUmaVoiceline,
  ]);

  // Calculate total picks for turn key - ensures timer resets after each pick in double-pick scenarios
  // Guard against undefined arrays (Firebase doesn't store empty arrays)
  const totalPicks =
    draftState.phase === "uma-pick" ||
    draftState.phase === "uma-ban" ||
    draftState.phase === "uma-pre-ban"
      ? (draftState.team1?.pickedUmas?.length || 0) +
        (draftState.team2?.pickedUmas?.length || 0) +
        (draftState.team1?.bannedUmas?.length || 0) +
        (draftState.team2?.bannedUmas?.length || 0) +
        (draftState.team1?.preBannedUmas?.length || 0) +
        (draftState.team2?.preBannedUmas?.length || 0)
      : (draftState.team1?.pickedMaps?.length || 0) +
        (draftState.team2?.pickedMaps?.length || 0) +
        (draftState.team1?.bannedMaps?.length || 0) +
        (draftState.team2?.bannedMaps?.length || 0);

  // Stable turn key used by the timer AND the action-committed guard
  const currentTurnKey = `${draftState.phase}-${draftState.currentTeam}-${totalPicks}`;

  // Clear the action-committed flag whenever the turn key advances so the
  // new turn can accept actions again.
  useEffect(() => {
    actionCommittedForKeyRef.current = null;
  }, [currentTurnKey]);

  // Turn timer hook
  const { timeRemaining } = useTurnTimer({
    duration: turnDuration,
    enabled: true,
    onTimeout: handleTurnTimeout,
    phase: draftState.phase,
    currentTurnKey,
    isTimerAuthority,
  });

  useEffect(() => {
    const isActiveDraftPhase =
      draftState.phase === "map-pick" ||
      draftState.phase === "map-ban" ||
      draftState.phase === "uma-pick" ||
      draftState.phase === "uma-ban" ||
      draftState.phase === "uma-pre-ban";

    if (!isActiveDraftPhase || !isTimerAuthority) {
      lastTimerSecondSfxRef.current = null;
      return;
    }

    if (timeRemaining <= 0 || timeRemaining > 10) {
      lastTimerSecondSfxRef.current = null;
      return;
    }

    if (lastTimerSecondSfxRef.current === timeRemaining) return;
    lastTimerSecondSfxRef.current = timeRemaining;

    if (timeRemaining >= 6) {
      playSfx("timerTickSmall");
    } else {
      playSfx("timerTick");
    }
  }, [timeRemaining, draftState.phase, isTimerAuthority, playSfx]);

  // Initialize Firebase room (create or join)
  useEffect(() => {
    if (!isMultiplayer || !multiplayerConfig) return;
    if (firebaseRoom) return; // Already in a room
    if (roomSetupAttempted.current) return; // Prevent double creation in StrictMode
    roomSetupAttempted.current = true;

    const setupRoom = async () => {
      try {
        if (multiplayerConfig.isHost) {
          // Check if this is a reconnection (has existing room code)
          if (multiplayerConfig.roomCode) {
            const exists = await roomExists(multiplayerConfig.roomCode);
            if (exists) {
              // Reconnect to existing room as host
              const result = await firebaseJoinRoom({
                roomCode: multiplayerConfig.roomCode,
                playerName: multiplayerConfig.playerName,
                connectionType: "host",
                team: "team1",
              });
              if (result.success) {
                setJoinError(null);
                return; // Successfully reconnected
              }
              // Failed to reconnect (e.g., UID changed) - clear session and create new room
              console.warn(
                "Failed to rejoin room as host, creating new room:",
                result.error,
              );
              clearDraftSession();
              // Fall through to create new room — reset phase from "reconnecting" to "lobby"
              setDraftState((prev) => ({ ...prev, phase: "lobby" }));
            }
          } else {
            // Room no longer exists — reset phase and create fresh
            clearDraftSession();
            setDraftState((prev) => ({ ...prev, phase: "lobby" }));
          }
          // Host creates a new room (fresh start or room no longer exists)
          const result = await firebaseCreateRoom({
            format: "5v5",
            hostName: multiplayerConfig.playerName,
            team1Name: multiplayerConfig.playerName,
            team2Name: "Team 2",
            initialDraftState: draftState,
          });
          if (!result.success) {
            console.error("Failed to create room:", result.error);
            setJoinError(
              result.error ||
                "Failed to create room. Check your connection and try again.",
            );
          } else {
            setJoinError(null);
          }
        } else if (!multiplayerConfig.isSpectator) {
          // Player joins existing room
          const result = await firebaseJoinRoom({
            roomCode: multiplayerConfig.roomCode,
            playerName: multiplayerConfig.playerName,
            connectionType: "player",
            team: "team2",
          });
          if (!result.success) {
            console.error("Failed to join room:", result.error);
            setJoinError(
              result.error ||
                "Failed to join room. Check the room code and try again.",
            );
          } else {
            setJoinError(null);
          }
        } else {
          // Spectator joins existing room
          const result = await firebaseJoinRoom({
            roomCode: multiplayerConfig.roomCode,
            playerName: multiplayerConfig.playerName,
            connectionType: "spectator",
          });
          if (!result.success) {
            console.error("Failed to join as spectator:", result.error);
            setJoinError(
              result.error ||
                "Failed to join as spectator. Check the room code and try again.",
            );
          } else {
            setJoinError(null);
          }
        }
      } catch (err) {
        console.error("Failed to setup room:", err);
        setJoinError(
          "Connection failed. Please check your internet and try again.",
        );
      }
    };

    setupRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isMultiplayer,
    multiplayerConfig,
    firebaseRoom,
    firebaseCreateRoom,
    firebaseJoinRoom,
    // Note: draftState intentionally excluded to prevent duplicate join calls
  ]);

  // Save session to localStorage for reconnection after page refresh
  useEffect(() => {
    if (!isMultiplayer || !multiplayerConfig || !firebaseRoomCode) return;

    saveDraftSession({
      roomCode: firebaseRoomCode,
      playerName: multiplayerConfig.playerName,
      isHost: multiplayerConfig.isHost,
      isSpectator: multiplayerConfig.isSpectator,
      format: "5v5",
      joinedAt: Date.now(),
    });
  }, [isMultiplayer, multiplayerConfig, firebaseRoomCode]);

  // Sync local draft state with network state in multiplayer mode
  useEffect(() => {
    if (isMultiplayer && syncedDraftState) {
      console.log("[SYNC EFFECT] Starting sync", {
        syncedDraftState_phase: syncedDraftState.phase,
        syncedDraftState_currentTeam: syncedDraftState.currentTeam,
        syncedDraftState_multiplayer: syncedDraftState.multiplayer,
        isHost: multiplayerConfig?.isHost,
      });

      // Host is the authority — it already sets local state directly in every
      // handler via setDraftState. Applying the same state again from Firebase
      // causes a redundant re-render (the "stutter"). The host only needs the
      // sync effect for metadata (team names, turn duration, wildcard modal,
      // match reports) — NOT the main draft state overwrite.
      // Exception: on reconnect (phase === "reconnecting"), host MUST apply
      // the Firebase state once to restore where the draft left off.
      if (!multiplayerConfig?.isHost) {
        // Non-host: always apply the full synced state
        setDraftState((prevState) => {
          const localTeam =
            prevState.multiplayer?.localTeam ||
            (multiplayerConfig?.isSpectator ? "team1" : "team2");
          const connectionType =
            prevState.multiplayer?.connectionType ||
            (multiplayerConfig?.isSpectator ? "spectator" : "player");

          // If user has acknowledged wildcard, don't let sync revert to wildcard-reveal phase
          let phase = syncedDraftState.phase;
          if (
            wildcardAcknowledged &&
            syncedDraftState.phase === "wildcard-reveal"
          ) {
            phase =
              prevState.phase === "map-pick"
                ? "map-pick"
                : syncedDraftState.phase;
          }

          return {
            ...syncedDraftState,
            phase,
            multiplayer: {
              enabled: true,
              connectionType,
              localTeam,
              roomId:
                syncedDraftState.multiplayer?.roomId ||
                multiplayerConfig?.roomCode ||
                "",
              team1Name: syncedDraftState.multiplayer?.team1Name || "Team 1",
              team2Name: syncedDraftState.multiplayer?.team2Name || "Team 2",
              turnDuration:
                syncedDraftState.multiplayer?.turnDuration ??
                DEFAULT_TURN_DURATION,
            },
          };
        });
      } else {
        // Host: only apply synced state when reconnecting (to restore draft)
        setDraftState((prevState) => {
          if (prevState.phase !== "reconnecting") return prevState; // Skip — host is authority
          return {
            ...syncedDraftState,
            multiplayer: {
              enabled: true,
              connectionType: "host",
              localTeam: "team1",
              roomId:
                syncedDraftState.multiplayer?.roomId ||
                multiplayerConfig?.roomCode ||
                "",
              team1Name: syncedDraftState.multiplayer?.team1Name || "Team 1",
              team2Name: syncedDraftState.multiplayer?.team2Name || "Team 2",
              turnDuration:
                syncedDraftState.multiplayer?.turnDuration ??
                DEFAULT_TURN_DURATION,
            },
          };
        });
      }

      // Also update local team name state from synced multiplayer state
      if (syncedDraftState.multiplayer?.team1Name) {
        setTeam1Name(syncedDraftState.multiplayer.team1Name);
      }
      if (syncedDraftState.multiplayer?.team2Name) {
        setTeam2Name(syncedDraftState.multiplayer.team2Name);
      }
      // Sync turn duration from host
      if (syncedDraftState.multiplayer?.turnDuration) {
        setTurnDuration(syncedDraftState.multiplayer.turnDuration);
      }

      // Trigger wildcard reveal modal when phase changes to wildcard-reveal
      // Only open if user hasn't already acknowledged it
      if (
        syncedDraftState.phase === "wildcard-reveal" &&
        !showWildcardModal &&
        !wildcardAcknowledged
      ) {
        setShowWildcardModal(true);
        // Auto-start reveal for non-host players so animation syncs
        if (!multiplayerConfig?.isHost) {
          setRevealStarted(true);
        }
      }

      // Close wildcard modal when phase transitions to pre-draft-pause
      if (syncedDraftState.phase === "pre-draft-pause" && showWildcardModal) {
        setShowWildcardModal(false);
        setWildcardAcknowledged(true);
      }

      // Sync pending match report and confirmed results from Firebase
      const synced = syncedDraftState as DraftState & {
        pendingMatchReport?: {
          raceIndex: number;
          placements: RacePlacement[];
          submissionId?: number;
        };
        confirmedMatchResults?: RaceResult[];
      };

      // Restore confirmed match results (e.g. on reconnect)
      if (
        synced.confirmedMatchResults &&
        synced.confirmedMatchResults.length > 0
      ) {
        setMatchResults((prev) => {
          // Only update if Firebase has more results than local state
          if (synced.confirmedMatchResults!.length > prev.length) {
            return synced.confirmedMatchResults!;
          }
          return prev;
        });
      }
      if (synced.pendingMatchReport && !multiplayerConfig?.isHost) {
        // Only set if team 2 hasn't already responded to this exact submission
        const subId =
          synced.pendingMatchReport.submissionId ??
          synced.pendingMatchReport.raceIndex;
        if (respondedReportRef.current !== subId) {
          setPendingReport({
            raceIndex: synced.pendingMatchReport.raceIndex,
            placements: synced.pendingMatchReport.placements,
            awaitingConfirm: true,
            submissionId: subId,
          });
        }
      } else if (!synced.pendingMatchReport && !multiplayerConfig?.isHost) {
        // Host cleared it
        setPendingReport(null);
        respondedReportRef.current = null;
      }
    }
  }, [
    isMultiplayer,
    syncedDraftState,
    multiplayerConfig,
    showWildcardModal,
    wildcardAcknowledged,
  ]);

  // Handle incoming draft actions from clients (host only)
  // Uses draftStateRef to always read the latest state, avoiding stale closures
  // when Firebase callbacks fire between setDraftState and React re-rendering.
  useEffect(() => {
    if (!isMultiplayer || !isHost) return;

    // Helper: read latest state from ref, apply update, sync to Firebase,
    // and update the ref synchronously so the next action in the same tick
    // also sees the latest state.
    const applyState = (newState: DraftState, addHistory = true) => {
      const historyForState = addHistory ? [...history, newState] : history;
      const finalizedState = persistDraftState(newState, historyForState);
      draftStateRef.current = finalizedState;
      setDraftState(finalizedState);
      if (addHistory) setHistory(historyForState);
    };

    // Set up handler for pending actions from Firebase
    const handlePendingAction = (pendingAction: FirebasePendingAction) => {
      const action = pendingAction.action;
      const senderId = pendingAction.senderId;

      // Always read from ref — closure may be stale after a rapid state update.
      const state = draftStateRef.current;

      // Don't process actions while host is still restoring state from Firebase.
      if (state.phase === "reconnecting") {
        console.log("Skipping pending action while reconnecting:", action);
        return;
      }

      // HARD GUARD: If the processing lock is held (timeout in progress),
      // defer this action by a short delay so the timeout finishes first.
      if (processingLockRef.current && action.itemType !== "control") {
        console.warn(
          "Processing lock held — deferring pending action by 300ms",
          action,
        );
        setTimeout(() => handlePendingAction(pendingAction), 300);
        return;
      }

      console.log("Host received action from client:", action, senderId);
      console.log(
        "Current phase:",
        state.phase,
        "Current team:",
        state.currentTeam,
      );

      // Handle control actions (phase transitions and ready state)
      if (action.itemType === "control") {
        // Handle team name change
        if (action.action === "team-name") {
          const team = action.itemId as "team1" | "team2";
          const name = action.phase || (team === "team1" ? "Team 1" : "Team 2");

          if (team === "team1") {
            setTeam1Name(name);
          } else {
            setTeam2Name(name);
          }

          const newState = {
            ...state,
            multiplayer: {
              ...state.multiplayer,
              enabled: true,
              connectionType: state.multiplayer?.connectionType || "host",
              localTeam: state.multiplayer?.localTeam || "team1",
              roomId: state.multiplayer?.roomId || "",
              team1Name:
                team === "team1"
                  ? name
                  : state.multiplayer?.team1Name || team1Name,
              team2Name:
                team === "team2"
                  ? name
                  : state.multiplayer?.team2Name || team2Name,
            },
          };
          applyState(newState, false);
          return;
        }

        // Handle ready action
        if (action.action === "ready") {
          const team = action.itemId as "team1" | "team2";
          const newState = {
            ...state,
            [team === "team1" ? "team1Ready" : "team2Ready"]: true,
          };
          applyState(newState, false);
          return;
        }

        // Handle match result confirmation from team 2
        if (action.action === "match-confirm") {
          try {
            const confirmed: RaceResult = JSON.parse(action.itemId);
            setMatchResults((results) => {
              if (results.some((r) => r.raceIndex === confirmed.raceIndex)) {
                return results;
              }
              const updated = [...results, confirmed];
              // Persist confirmed results to Firebase so both players can
              // restore them on reconnect
              setDraftState((current) => {
                const synced = {
                  ...current,
                  pendingMatchReport: null,
                  confirmedMatchResults: updated,
                } as DraftState;
                persistDraftState(synced);
                return current;
              });
              return updated;
            });
          } catch (e) {
            console.error("Failed to parse match-confirm data:", e);
          }
          setPendingReport(null);
          pendingReportRef.current = null;
          return;
        }

        // Handle match result rejection from team 2
        if (action.action === "match-reject") {
          setPendingReport(null);
          pendingReportRef.current = null;
          setDraftState((current) => {
            const cleared = {
              ...current,
              pendingMatchReport: null,
            } as DraftState;
            persistDraftState(cleared);
            return current;
          });
          return;
        }

        if (action.phase === "map-pick" && state.phase === "pre-draft-pause") {
          const newState = {
            ...state,
            phase: "map-pick" as const,
            currentTeam: "team1" as const,
            team1Ready: false,
            team2Ready: false,
          };
          applyState(newState);
          return;
        } else if (
          action.phase === "uma-pre-ban" &&
          state.phase === "post-map-pause"
        ) {
          const newState = {
            ...state,
            phase: "uma-pre-ban" as const,
            currentTeam: "team1" as const,
            team1Ready: false,
            team2Ready: false,
          };
          applyState(newState);
          return;
        }
      }

      // Process the action based on type
      if (action.itemType === "map") {
        let map: Map | undefined;
        if (state.phase === "map-ban") {
          const opponentTeam =
            state.currentTeam === "team1" ? "team2" : "team1";
          map = state[opponentTeam].pickedMaps.find(
            (m) => m.name === action.itemId,
          );
        } else {
          map = state.availableMaps.find((m) => m.name === action.itemId);
        }
        console.log(
          "Looking for map:",
          action.itemId,
          "Phase:",
          state.phase,
          "Found:",
          !!map,
        );
        if (map) {
          const mapWithConditions: Map = {
            ...map,
            conditions: map.conditions || generateTrackConditions(),
          };
          const newState = selectMap(state, mapWithConditions);
          console.log(
            "State changed:",
            newState !== state,
            "New phase:",
            newState.phase,
          );
          if (newState !== state) {
            applyState(newState);
          }
        } else {
          console.error("Map not found:", action.itemId, "Phase:", state.phase);
          if (state.phase === "map-ban") {
            const opponentTeam =
              state.currentTeam === "team1" ? "team2" : "team1";
            console.log(
              "Opponent picked maps:",
              state[opponentTeam].pickedMaps.map((m) => m.name),
            );
          } else {
            console.log(
              "Available maps:",
              state.availableMaps.map((m) => m.name),
            );
          }
        }
      } else if (action.itemType === "uma") {
        let uma: UmaMusume | undefined;
        if (state.phase === "uma-ban") {
          const opponentTeam =
            state.currentTeam === "team1" ? "team2" : "team1";
          uma = state[opponentTeam].pickedUmas.find(
            (u) => u.id.toString() === action.itemId,
          );
        } else {
          uma = state.availableUmas.find(
            (u) => u.id.toString() === action.itemId,
          );
        }
        console.log(
          "Looking for uma:",
          action.itemId,
          "Phase:",
          state.phase,
          "Found:",
          !!uma,
        );
        if (uma) {
          const newState = selectUma(state, uma);
          console.log(
            "State changed:",
            newState !== state,
            "New phase:",
            newState.phase,
          );
          if (newState !== state) {
            applyState(newState);
          }
        } else {
          console.error("Uma not found:", action.itemId, "Phase:", state.phase);
          if (state.phase === "uma-ban") {
            const opponentTeam =
              state.currentTeam === "team1" ? "team2" : "team1";
            console.log(
              "Opponent picked umas:",
              state[opponentTeam].pickedUmas.map((u) => u.id),
            );
          } else {
            console.log("Available umas count:", state.availableUmas.length);
          }
        }
      }
    };

    setPendingActionHandler(handlePendingAction);

    return () => {
      setPendingActionHandler(null);
    };
  }, [isMultiplayer, isHost, setPendingActionHandler, syncUpdateDraftState]);

  // Handle connection events (disconnections)
  useEffect(() => {
    if (!isMultiplayer || isHost) return;

    // For clients: check if we got disconnected or host left
    if (!isConnected && firebaseRoom) {
      // We lost connection
      const shouldReturn = window.confirm("Connection lost. Return to menu?");
      if (shouldReturn) {
        onBackToMenu();
      }
    }
  }, [isMultiplayer, isHost, isConnected, firebaseRoom, onBackToMenu]);

  // Set pending uma selection (click on card)
  const handleUmaClick = (uma: UmaMusume) => {
    setPendingUma(uma);
    setPendingMap(null); // Clear any pending map
  };

  // Set pending map selection (click on card)
  const handleMapClick = (map: Map) => {
    setPendingMap(map);
    setPendingUma(null); // Clear any pending uma
  };

  // Confirm and lock in the pending selection
  const handleLockIn = () => {
    // GUARD: If a timeout is mid-flight, don't also send a lock-in.
    if (processingLockRef.current) {
      console.log("Lock-in blocked — timeout processing in progress");
      return;
    }

    // GUARD: If we already committed an action for this turn (timeout just
    // fired), block the redundant lock-in.  Uses the same turnKey format as
    // the timer so they share a single gate.
    const turnKey = `${draftState.phase}-${draftState.currentTeam}-${totalPicks}`;
    if (actionCommittedForKeyRef.current === turnKey) {
      console.log(
        "Lock-in blocked — action already committed for turn:",
        turnKey,
      );
      return;
    }
    // Mark this turn as committed so a racing timeout is blocked.
    actionCommittedForKeyRef.current = turnKey;

    const isBanPhaseNow =
      draftState.phase === "uma-ban" ||
      draftState.phase === "map-ban" ||
      draftState.phase === "uma-pre-ban";
    playSfx(isBanPhaseNow ? "banButtonClick" : "lockInButtonClick");

    if (pendingUma) {
      confirmUmaSelect(pendingUma);
      setPendingUma(null);
    } else if (pendingMap) {
      confirmMapSelect(pendingMap);
      setPendingMap(null);
    }
    // Clear ghost from Firebase on lock-in
    if (isMultiplayer) {
      const team = draftState.currentTeam;
      updatePendingSelection(team, null);
    }
  };

  // Sync pending selection to Firebase (debounced) so others see ghost
  const pendingSelectionTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    if (!isMultiplayer) return;
    const team = draftState.currentTeam;
    const myTeam =
      draftState.multiplayer?.localTeam ||
      (multiplayerConfig?.isHost ? "team1" : "team2");
    // Only send if it's our turn
    if (team !== myTeam) return;

    if (pendingSelectionTimer.current)
      clearTimeout(pendingSelectionTimer.current);

    pendingSelectionTimer.current = setTimeout(() => {
      let selection: FirebasePendingSelection | null = null;
      if (pendingUma) {
        selection = {
          type: "uma",
          id: pendingUma.id.toString(),
          name: pendingUma.name,
          imageUrl: pendingUma.imageUrl,
          updatedAt: Date.now(),
        };
      } else if (pendingMap) {
        selection = {
          type: "map",
          id: pendingMap.name,
          name: pendingMap.name,
          track: pendingMap.track,
          distance: pendingMap.distance,
          surface: pendingMap.surface,
          updatedAt: Date.now(),
        };
      }
      updatePendingSelection(team, selection);
    }, 200);

    return () => {
      if (pendingSelectionTimer.current)
        clearTimeout(pendingSelectionTimer.current);
    };
  }, [pendingUma, pendingMap, isMultiplayer, draftState.currentTeam]);

  const confirmUmaSelect = (uma: UmaMusume) => {
    const team = draftState.currentTeam;

    // Debug logging for selection issues
    console.log("confirmUmaSelect called:", {
      currentTeam: team,
      localTeam: draftState.multiplayer?.localTeam,
      connectionType: draftState.multiplayer?.connectionType,
      phase: draftState.phase,
      isMultiplayer,
      isHost,
    });

    // Use multiplayer-aware select function
    const newState = isMultiplayer
      ? selectUmaMultiplayer(draftState, uma, team)
      : selectUma(draftState, uma);

    // Only update if state changed (permission check passed)
    if (newState !== draftState) {
      console.log("Selection allowed, updating state");
      playUmaVoiceline(
        uma,
        draftState.phase === "uma-pick" ? "picked" : "banned",
      );
      setUmaSearch("");
      if (isMultiplayer && isHost) {
        // Host broadcasts state to all peers and updates local state
        const historyForState = [...history, newState];
        const finalizedState = persistDraftState(newState, historyForState);
        setDraftState(finalizedState);
        setHistory(historyForState);
      } else if (isMultiplayer) {
        // Non-host sends action request to host - wait for Firebase sync (no optimistic update)
        sendDraftAction({
          action: draftState.phase === "uma-pick" ? "pick" : "ban",
          itemId: uma.id.toString(),
          itemType: "uma",
        });
        // Don't update local state - wait for confirmed state from Firebase
      } else {
        // Local mode - just update state
        setDraftState(newState);
        setHistory([...history, newState]);
      }
    } else {
      console.log("[confirmUmaSelect] Selection DENIED - state unchanged");
    }
  };

  const confirmMapSelect = (map: Map) => {
    const team = draftState.currentTeam;

    console.log("[confirmMapSelect] Called", {
      team,
      currentTeam: draftState.currentTeam,
      localTeam: draftState.multiplayer?.localTeam,
      connectionType: draftState.multiplayer?.connectionType,
      phase: draftState.phase,
      isMultiplayer,
      isHost,
    });

    // Use the map's pre-generated conditions (fallback just in case)
    const mapWithConditions: Map = {
      ...map,
      conditions: map.conditions || generateTrackConditions(),
    };

    // Use multiplayer-aware select function
    const newState = isMultiplayer
      ? selectMapMultiplayer(draftState, mapWithConditions, team)
      : selectMap(draftState, mapWithConditions);

    // Only update if state changed (permission check passed)
    if (newState !== draftState) {
      console.log("[confirmMapSelect] Selection allowed, updating state");
      if (isMultiplayer && isHost) {
        // Host broadcasts state to all peers and updates local state
        const historyForState = [...history, newState];
        const finalizedState = persistDraftState(newState, historyForState);
        setDraftState(finalizedState);
        setHistory(historyForState);
        setSelectedTrack(null); // Reset track selection after picking
      } else if (isMultiplayer) {
        // Non-host sends action request to host - wait for Firebase sync (no optimistic update)
        sendDraftAction({
          action: draftState.phase === "map-pick" ? "pick" : "ban",
          itemId: map.name,
          itemType: "map",
        });
        // Don't update local state - wait for confirmed state from Firebase
        // But do reset track selection so UI is ready for next pick
        setSelectedTrack(null);
      } else {
        // Local mode - just update state
        setDraftState(newState);
        setHistory([...history, newState]);
        setSelectedTrack(null); // Reset track selection after picking
      }
    } else {
      console.log("[confirmMapSelect] Selection DENIED - state unchanged");
    }
  };

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setDraftState(newHistory[newHistory.length - 1]);
      setSelectedTrack(null);
      setUmaSearch("");
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    const initialState = getInitialDraftState();
    setDraftState(initialState);
    setHistory([initialState]);
    setSelectedTrack(null);
    setUmaSearch("");
    setShowResetConfirm(false);
    setShowWildcardModal(false);
    // Only show team name modal for local mode
    if (!isMultiplayer) {
      setShowTeamNameModal(true);
    }
    setRevealStarted(false);
    setCyclingMap(null);
  };

  const handleBackToMenu = () => {
    setShowMenuConfirm(true);
  };

  const confirmBackToMenu = () => {
    // Clear session so user doesn't get prompted to rejoin
    clearDraftSession();
    onBackToMenu();
  };

  const startReveal = () => {
    setRevealStarted(true);
  };

  const acknowledgeDraft = () => {
    setShowWildcardModal(false);
    setWildcardAcknowledged(true);

    // Everyone transitions to pre-draft-pause locally after acknowledging wildcard
    // This applies for wildcard-reveal phase OR lobby phase (spectator edge case)
    if (
      draftState.phase === "wildcard-reveal" ||
      draftState.phase === "lobby"
    ) {
      const newState = {
        ...draftState,
        phase: "pre-draft-pause" as const,
      };
      setDraftState(newState);

      // Only host syncs the phase change
      if (isMultiplayer && isHost) {
        persistDraftState(newState);
      }
    }
  };

  // Handle player ready up
  const handleReady = () => {
    const localTeam =
      draftState.multiplayer?.localTeam || (isHost ? "team1" : "team2");

    if (isMultiplayer && isHost) {
      // Host sets their own ready state and syncs
      const newState = {
        ...draftState,
        team1Ready: true,
      };
      persistDraftState(newState);
      setDraftState(newState);
    } else if (isMultiplayer) {
      // Non-host sends ready action to host — don't update local state
      // Wait for Firebase sync confirmation to avoid double-render
      sendDraftAction({
        action: "ready",
        itemType: "control",
        itemId: localTeam,
      });
    }
  };

  // Handle starting the map draft (from pre-draft-pause to map-pick)
  const handleStartMapDraft = () => {
    const newState = {
      ...draftState,
      phase: "map-pick" as const,
      currentTeam: "team1" as const,
      team1Ready: false,
      team2Ready: false,
    };

    setDraftState(newState);

    // Sync to all clients in multiplayer
    if (isMultiplayer && isHost) {
      persistDraftState(newState);
    } else if (isMultiplayer && !isHost) {
      // Non-host players send action to host
      sendDraftAction({
        action: "pick",
        itemType: "control",
        itemId: "start-map-draft",
        phase: "map-pick",
      });
    }
  };

  // Handle continuing to uma draft (from post-map-pause to uma-pre-ban)
  const handleContinueToUma = () => {
    const newState = {
      ...draftState,
      phase: "uma-pre-ban" as const,
      currentTeam: "team1" as const,
      team1Ready: false,
      team2Ready: false,
    };

    setDraftState(newState);

    // Sync to all clients in multiplayer
    if (isMultiplayer && isHost) {
      persistDraftState(newState);
    } else if (isMultiplayer && !isHost) {
      // Non-host players send action to host
      sendDraftAction({
        action: "ban",
        itemType: "control",
        itemId: "continue-to-uma",
        phase: "uma-pre-ban",
      });
    }
  };

  // Cycling animation effect for wildcard reveal
  useEffect(() => {
    if (!showWildcardModal || !revealStarted) {
      return;
    }

    let cycleCount = 0;
    const fastCycles = 20; // Fast spin for ~1.5 seconds
    const slowCycles = 8; // Slowdown for ~1.0 seconds
    const totalCycles = fastCycles + slowCycles;
    let timeoutId: number;

    const animate = () => {
      if (cycleCount >= totalCycles) {
        // Show final map
        setCyclingMap(draftState.wildcardMap);
        timeoutId = window.setTimeout(() => {
          setCyclingMap(null);
        }, 500);
        return;
      }

      const randomMap =
        SAMPLE_MAPS[Math.floor(Math.random() * SAMPLE_MAPS.length)];
      const conditions = generateTrackConditions();
      setCyclingMap({ ...randomMap, conditions });

      // Calculate delay - fast at first, then slow down
      let delay = 75;
      if (cycleCount > fastCycles) {
        const slowdownProgress = (cycleCount - fastCycles) / slowCycles;
        delay = 75 + slowdownProgress * 175; // Gradually slow from 75ms to 250ms
      }

      cycleCount++;
      timeoutId = window.setTimeout(animate, delay);
    };

    animate();

    // Cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [showWildcardModal, revealStarted, draftState.wildcardMap]);

  const confirmTeamNames = () => {
    const name1 = tempTeam1Name || "Team 1";
    const name2 = tempTeam2Name || "Team 2";
    setTeam1Name(name1);
    setTeam2Name(name2);
    setShowTeamNameModal(false);

    // For local mode, show wildcard modal immediately
    // (Multiplayer now uses waiting room for team names, this modal is skipped)
    setShowWildcardModal(true);
  };

  // Handle team name change from waiting room
  const handleTeamNameChange = (team: "team1" | "team2", name: string) => {
    if (team === "team1") {
      setTeam1Name(name);
    } else {
      setTeam2Name(name);
    }

    // Update draft state and sync to other players
    const newState: DraftState = {
      ...draftState,
      multiplayer: {
        ...draftState.multiplayer,
        enabled: true,
        connectionType: draftState.multiplayer?.connectionType || "host",
        localTeam: draftState.multiplayer?.localTeam || "team1",
        roomId: draftState.multiplayer?.roomId || "",
        team1Name: team === "team1" ? name : team1Name,
        team2Name: team === "team2" ? name : team2Name,
      },
    };
    setDraftState(newState);

    if (isMultiplayer) {
      // Use multiplayerConfig?.isHost for reliability during lobby phase
      // (isHost from useFirebaseRoom may not be set yet before room subscription fires)
      if (multiplayerConfig?.isHost) {
        // Host directly updates Firebase
        persistDraftState(newState);
      } else {
        // Non-host sends action to host
        sendDraftAction({
          action: "team-name",
          itemType: "control",
          itemId: team,
          phase: name, // Reuse phase field to carry the name
        });
      }
    }
  };

  // Handle turn duration change from waiting room (host only)
  const handleTurnDurationChange = (duration: number) => {
    setTurnDuration(duration);

    // Sync to Firebase so other players see the setting
    if (isMultiplayer) {
      const newState: DraftState = {
        ...draftState,
        multiplayer: {
          ...draftState.multiplayer,
          enabled: true,
          connectionType: draftState.multiplayer?.connectionType || "host",
          localTeam: draftState.multiplayer?.localTeam || "team1",
          roomId: draftState.multiplayer?.roomId || "",
          team1Name: draftState.multiplayer?.team1Name || team1Name,
          team2Name: draftState.multiplayer?.team2Name || team2Name,
          turnDuration: duration,
        },
      };
      setDraftState(newState);
      persistDraftState(newState);
    }
  };

  // Handle starting the draft from lobby (host only)
  const handleStartDraft = () => {
    if (!isHost) return;

    // Set phase to wildcard-reveal and sync to all clients
    const newState = {
      ...draftState,
      phase: "wildcard-reveal" as const,
    };

    setDraftState(newState);

    // Broadcast to all clients
    if (isMultiplayer) {
      persistDraftState(newState);
    }

    // Start the reveal animation
    setShowWildcardModal(true);
  };

  // Get opponent's picked items for ban phase
  const getOpponentTeam = () => {
    return draftState.currentTeam === "team1" ? "team2" : "team1";
  };

  // ─── Match Reporting Helpers ─────────────────────────────────────────
  // Build the interleaved map schedule (same logic as render)
  const getMapSchedule = useCallback(() => {
    const t1Maps = draftState.team1.pickedMaps;
    const t2Maps = draftState.team2.pickedMaps;
    const schedule: { map: Map; team: string; index: number }[] = [];
    const maxLen = Math.max(t1Maps.length, t2Maps.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < t1Maps.length)
        schedule.push({
          map: t1Maps[i],
          team: team1Name,
          index: schedule.length + 1,
        });
      if (i < t2Maps.length)
        schedule.push({
          map: t2Maps[i],
          team: team2Name,
          index: schedule.length + 1,
        });
    }
    // Add tiebreaker (wildcard map) as the final race
    schedule.push({
      map: draftState.wildcardMap,
      team: "Tiebreaker",
      index: schedule.length + 1,
    });
    return schedule;
  }, [
    draftState.team1.pickedMaps,
    draftState.team2.pickedMaps,
    draftState.wildcardMap,
    team1Name,
    team2Name,
  ]);

  // All drafted uma from both teams (for match reporting dropdowns)
  const allDraftedUmas = useMemo(() => {
    return [
      ...draftState.team1.pickedUmas.map((u) => ({
        ...u,
        team: "team1" as const,
      })),
      ...draftState.team2.pickedUmas.map((u) => ({
        ...u,
        team: "team2" as const,
      })),
    ];
  }, [draftState.team1.pickedUmas, draftState.team2.pickedUmas]);

  // Compute current scores from confirmed results
  const scores = useMemo(() => {
    let team1Points = 0;
    let team2Points = 0;
    let team1Wins = 0;
    let team2Wins = 0;

    for (const result of matchResults) {
      let raceT1 = 0;
      let raceT2 = 0;
      for (const p of result.placements) {
        const pts = POINT_VALUES[p.position] || 0;
        if (p.team === "team1") {
          raceT1 += pts;
        } else {
          raceT2 += pts;
        }
      }
      team1Points += raceT1;
      team2Points += raceT2;
      if (raceT1 > raceT2) team1Wins++;
      else if (raceT2 > raceT1) team2Wins++;
    }

    return { team1Points, team2Points, team1Wins, team2Wins };
  }, [matchResults]);

  // Determine next unreported race index
  const nextRaceIndex = useMemo(() => {
    const reportedIndices = new Set(matchResults.map((r) => r.raceIndex));
    const schedule = getMapSchedule();
    for (let i = 0; i < schedule.length; i++) {
      if (!reportedIndices.has(i)) return i;
    }
    return schedule.length; // all reported
  }, [matchResults, getMapSchedule]);

  // Open reporting modal for the next race
  const openMatchReporting = () => {
    setReportRaceIndex(nextRaceIndex);
    setReportPlacements({ first: "", second: "", third: "" });
    setShowMatchReporting(true);
  };

  // Find uma info by id from all drafted umas
  const findDraftedUma = (id: string) =>
    allDraftedUmas.find((u) => u.id.toString() === id);

  // Submit race result (host)
  const submitRaceReport = () => {
    const first = findDraftedUma(reportPlacements.first);
    const second = findDraftedUma(reportPlacements.second);
    const third = findDraftedUma(reportPlacements.third);
    if (!first || !second || !third) return;

    const placements: RacePlacement[] = [
      {
        position: 1,
        umaId: first.id.toString(),
        umaName: first.name,
        umaTitle: getUmaVariantNickname(first.id),
        team: first.team,
      },
      {
        position: 2,
        umaId: second.id.toString(),
        umaName: second.name,
        umaTitle: getUmaVariantNickname(second.id),
        team: second.team,
      },
      {
        position: 3,
        umaId: third.id.toString(),
        umaName: third.name,
        umaTitle: getUmaVariantNickname(third.id),
        team: third.team,
      },
    ];

    if (isMultiplayer) {
      // Host sets pending report, waits for team 2 to confirm
      const report: PendingReport = {
        raceIndex: reportRaceIndex,
        placements,
        awaitingConfirm: true,
      };
      setPendingReport(report);
      // Sync pending report via draft state so team 2 can see it
      // Include a unique submissionId so resubmissions are distinguishable
      persistDraftState({
        ...draftState,
        pendingMatchReport: {
          raceIndex: reportRaceIndex,
          placements,
          submissionId: Date.now(),
        },
      } as DraftState);
      setShowMatchReporting(false);
    } else {
      // Local mode: auto-confirm
      const result: RaceResult = {
        raceIndex: reportRaceIndex,
        placements,
        confirmed: true,
      };
      setMatchResults((prev) => [...prev, result]);
      setShowMatchReporting(false);
    }
  };

  // Team 2 confirms the pending report
  const confirmMatchReport = () => {
    if (!pendingReport) return;

    const result: RaceResult = {
      raceIndex: pendingReport.raceIndex,
      placements: pendingReport.placements,
      confirmed: true,
    };

    if (isMultiplayer && !isHost) {
      // Send confirmation to host WITH the result data so host doesn't
      // need to look up pendingReport (which may be stale in closures)
      sendDraftAction({
        action: "match-confirm",
        itemType: "control",
        itemId: JSON.stringify(result),
      });
    }
    // Apply locally and mark as responded so sync effect won't re-set it
    respondedReportRef.current =
      pendingReport.submissionId ?? pendingReport.raceIndex;
    setMatchResults((prev) => [...prev, result]);
    setPendingReport(null);
  };

  // Team 2 rejects the pending report
  const rejectMatchReport = () => {
    if (pendingReport) {
      respondedReportRef.current =
        pendingReport.submissionId ?? pendingReport.raceIndex;
    }
    if (isMultiplayer && !isHost) {
      // Send rejection to host
      sendDraftAction({
        action: "match-reject",
        itemType: "control",
        itemId: "reject",
      });
    }
    setPendingReport(null);
  };

  // Check if a map can be picked based on distance and surface constraints
  const canSelectMap = (map: Map): boolean => {
    if (draftState.phase !== "map-pick") return true;

    const currentTeam = draftState.currentTeam;
    const currentTeamMaps = draftState[currentTeam].pickedMaps;

    // Check distance constraint
    if (!canPickDistance(currentTeamMaps, map.distance)) {
      return false;
    }

    // Check dirt surface constraint
    if (map.surface === "Dirt" && !canPickDirt(currentTeamMaps)) {
      return false;
    }

    return true;
  };

  const getBannableUmas = () => {
    if (draftState.phase === "uma-ban") {
      const opponentTeam = getOpponentTeam();
      return draftState[opponentTeam].pickedUmas;
    }
    if (draftState.phase === "uma-pre-ban") {
      return draftState.availableUmas;
    }
    return draftState.availableUmas;
  };

  const getFilteredUmas = () => {
    const sortedUmas = [...getBannableUmas()].sort(compareUmasByRelease);
    if (!umaSearch.trim()) return sortedUmas;
    const q = umaSearch.toLowerCase();
    return sortedUmas.filter((uma) =>
      formatUmaName(uma).toLowerCase().includes(q),
    );
  };

  const getBannableMaps = () => {
    if (draftState.phase === "map-ban") {
      const opponentTeam = getOpponentTeam();
      return draftState[opponentTeam].pickedMaps;
    }
    return draftState.availableMaps;
  };

  // Get unique tracks for selection
  const getAvailableTracks = () => {
    const maps = getBannableMaps();
    const tracks = Array.from(new Set(maps.map((m) => m.track)));
    return tracks.sort();
  };

  // Get maps for selected track
  const getMapsForTrack = (track: string) => {
    return getBannableMaps().filter((m) => m.track === track);
  };

  // Handle leaving from waiting room (clears session)
  const handleWaitingRoomLeave = () => {
    clearDraftSession();
    onBackToMenu();
  };

  // Handle retrying a failed join/create from waiting room
  const handleRetryConnection = async () => {
    if (!multiplayerConfig) return;
    setIsRetryingJoin(true);
    setJoinError(null);

    try {
      if (multiplayerConfig.isHost) {
        const result = await firebaseCreateRoom({
          format: "5v5",
          hostName: multiplayerConfig.playerName,
          team1Name: multiplayerConfig.playerName,
          team2Name: "Team 2",
          initialDraftState: draftState,
        });
        if (!result.success) {
          setJoinError(
            result.error ||
              "Failed to create room. Check your connection and try again.",
          );
        }
      } else if (!multiplayerConfig.isSpectator) {
        const result = await firebaseJoinRoom({
          roomCode: multiplayerConfig.roomCode,
          playerName: multiplayerConfig.playerName,
          connectionType: "player",
          team: "team2",
        });
        if (!result.success) {
          setJoinError(
            result.error ||
              "Failed to join room. Check the room code and try again.",
          );
        }
      } else {
        const result = await firebaseJoinRoom({
          roomCode: multiplayerConfig.roomCode,
          playerName: multiplayerConfig.playerName,
          connectionType: "spectator",
        });
        if (!result.success) {
          setJoinError(
            result.error ||
              "Failed to join as spectator. Check the room code and try again.",
          );
        }
      }
    } catch (err) {
      console.error("Retry failed:", err);
      setJoinError(
        "Connection failed. Please check your internet and try again.",
      );
    } finally {
      setIsRetryingJoin(false);
    }
  };

  // Compute completed actions count for the draft timeline
  const completedActions = (() => {
    const { phase } = draftState;
    const t1 = draftState.team1;
    const t2 = draftState.team2;

    if (phase === "map-pick") {
      return (t1.pickedMaps?.length || 0) + (t2.pickedMaps?.length || 0);
    }
    if (phase === "map-ban") {
      return (t1.bannedMaps?.length || 0) + (t2.bannedMaps?.length || 0);
    }
    if (phase === "uma-pick") {
      const totalPicked =
        (t1.pickedUmas?.length || 0) + (t2.pickedUmas?.length || 0);
      const totalBanned =
        (t1.bannedUmas?.length || 0) + (t2.bannedUmas?.length || 0);
      // Each ban removed one uma from pickedUmas and added it to bannedUmas,
      // so total uma-pick actions ever taken = current picks + bans.
      if (totalBanned > 0) {
        return totalPicked + totalBanned;
      }
      return totalPicked;
    }
    if (phase === "uma-ban") {
      return (t1.bannedUmas?.length || 0) + (t2.bannedUmas?.length || 0);
    }
    return 0;
  })();

  // Compute how many consecutive picks the current team has (for snake draft highlighting)
  const consecutivePicks = useMemo(() => {
    if (draftState.phase !== "uma-pick") return 1;
    const timeline = getTimelineForPhase(draftState.phase, completedActions);
    if (!timeline) return 1;
    const { steps, currentIndex } = timeline;
    if (currentIndex >= steps.length) return 1;
    const currentTeam = steps[currentIndex].team;
    let count = 0;
    for (let i = currentIndex; i < steps.length; i++) {
      if (steps[i].team === currentTeam && steps[i].label === "P") count++;
      else break;
    }
    return Math.max(count, 1);
  }, [draftState.phase, completedActions]);

  const localGhostSelection: FirebasePendingSelection | null = pendingUma
    ? {
        type: "uma",
        id: pendingUma.id.toString(),
        name: pendingUma.name,
        imageUrl: pendingUma.imageUrl,
        updatedAt: 0,
      }
    : pendingMap
      ? {
          type: "map",
          id: pendingMap.name,
          name: pendingMap.name,
          track: pendingMap.track,
          distance: pendingMap.distance,
          surface: pendingMap.surface,
          updatedAt: 0,
        }
      : null;
  const team1GhostSelection = isMultiplayer
    ? (pendingSelections.team1 ?? null)
    : draftState.currentTeam === "team1"
      ? localGhostSelection
      : null;
  const team2GhostSelection = isMultiplayer
    ? (pendingSelections.team2 ?? null)
    : draftState.currentTeam === "team2"
      ? localGhostSelection
      : null;
  const team1IncomingVetoSelection =
    draftState.phase === "uma-ban" || draftState.phase === "map-ban"
      ? isMultiplayer
        ? draftState.currentTeam === "team2"
          ? (pendingSelections.team2 ?? null)
          : null
        : draftState.currentTeam === "team2"
          ? localGhostSelection
          : null
      : null;
  const team2IncomingVetoSelection =
    draftState.phase === "uma-ban" || draftState.phase === "map-ban"
      ? isMultiplayer
        ? draftState.currentTeam === "team1"
          ? (pendingSelections.team1 ?? null)
          : null
        : draftState.currentTeam === "team1"
          ? localGhostSelection
          : null
      : null;

  // Reconnecting view — show loading spinner while waiting for Firebase state
  if (isMultiplayer && draftState.phase === "reconnecting") {
    return (
      <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          {joinError ? (
            <>
              <h2 className="text-xl font-bold text-red-400 mb-2">
                Reconnection Failed
              </h2>
              <p className="text-gray-400 mb-4">{joinError}</p>
              {onBackToMenu && (
                <button
                  onClick={() => {
                    clearDraftSession();
                    onBackToMenu();
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
                >
                  Back to Menu
                </button>
              )}
            </>
          ) : (
            <>
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-100 mb-2">
                Reconnecting...
              </h2>
              <p className="text-gray-400">Restoring draft state</p>
              {onBackToMenu && (
                <button
                  onClick={() => {
                    clearDraftSession();
                    onBackToMenu();
                  }}
                  className="mt-6 px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Cancel &amp; Return to Menu
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Waiting room view for multiplayer lobby phase
  if (isMultiplayer && draftState.phase === "lobby") {
    // Host is already counted in firebasePlayers
    const playerCount = firebasePlayers.length || 1;
    const spectatorCount = firebaseSpectators.length;

    // Spectators see a minimal waiting view — they can't edit names or start
    if (multiplayerConfig?.isSpectator) {
      return (
        <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex items-center justify-center px-4 lg:px-6">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-6 lg:p-8 xl:p-10 border-2 border-gray-700 max-w-lg w-full text-center">
            <h1 className="text-2xl lg:text-3xl font-bold mb-1 lg:mb-2 text-gray-100">
              Spectating
            </h1>
            <p className="text-sm lg:text-base text-gray-400 mb-4 lg:mb-6">
              Waiting for the host to start the draft...
            </p>

            {/* Room Code */}
            <div className="bg-gray-900 rounded-xl p-4 lg:p-6 mb-4 lg:mb-6 border border-gray-700">
              <p className="text-xs lg:text-sm text-gray-400 mb-1">Room Code</p>
              <p className="text-3xl lg:text-4xl font-mono font-bold text-purple-400 tracking-wider">
                {formatRoomCode(roomCode)}
              </p>
            </div>

            {/* Connection Status */}
            <div className="bg-gray-900/50 rounded-lg p-3 lg:p-4 mb-4 lg:mb-6 border border-gray-700">
              <div className="flex items-center justify-center gap-4 lg:gap-6">
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <span
                    className={`w-2.5 lg:w-3 h-2.5 lg:h-3 rounded-full ${playerCount >= 2 ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`}
                  />
                  <span className="text-sm lg:text-base text-gray-300">
                    {playerCount}/2 Players
                  </span>
                </div>
                {spectatorCount > 0 && (
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <span className="w-2.5 lg:w-3 h-2.5 lg:h-3 rounded-full bg-purple-400" />
                    <span className="text-sm lg:text-base text-gray-300">
                      {spectatorCount} Spectator
                      {spectatorCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {onBackToMenu && (
              <button
                onClick={() => {
                  clearDraftSession();
                  onBackToMenu();
                }}
                className="w-full py-2 lg:py-3 px-3 lg:px-4 text-gray-400 hover:text-gray-200 transition-colors text-xs lg:text-sm"
              >
                Leave Room
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <WaitingRoom
        roomCode={roomCode}
        team1Name={team1Name}
        team2Name={team2Name}
        isHost={multiplayerConfig?.isHost || false}
        localTeam={
          draftState.multiplayer?.localTeam || (isHost ? "team1" : "team2")
        }
        playerCount={playerCount}
        spectatorCount={spectatorCount}
        onStartDraft={handleStartDraft}
        onLeave={handleWaitingRoomLeave}
        onTeamNameChange={handleTeamNameChange}
        turnDuration={turnDuration}
        onTurnDurationChange={handleTurnDurationChange}
        connectionError={joinError}
        onRetryConnection={handleRetryConnection}
        isRetrying={isRetryingJoin}
      />
    );
  }

  // Spectator view for multiplayer spectators (after wildcard reveal is complete)
  if (
    isMultiplayer &&
    multiplayerConfig?.isSpectator &&
    draftState.phase !== "wildcard-reveal" &&
    draftState.phase !== "lobby"
  ) {
    return (
      <SpectatorView
        draftState={draftState}
        roomCode={multiplayerConfig.roomCode}
        team1Name={team1Name}
        team2Name={team2Name}
        connectionStatus={isConnected ? "connected" : "disconnected"}
        onBackToMenu={onBackToMenu}
        timeRemaining={timeRemaining}
        pendingSelections={pendingSelections}
        roomCodes={roomCodes}
        scores={scores}
        racesReported={matchResults.length}
        raceResults={matchResults}
      />
    );
  }

  return (
    <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex gap-2 lg:gap-4 px-2 lg:px-4 xl:px-6 py-2 lg:py-4 xl:py-6 overflow-hidden">
      {/* Phase Transition Announcement Overlay */}
      <PhaseAnnouncement phase={draftState.phase} />

      <div className="w-56 lg:w-72 xl:w-96 shrink-0 flex flex-col px-1 lg:px-2 min-h-0">
        <TeamPanel
          team="team1"
          teamName={team1Name}
          pickedUmas={draftState.team1.pickedUmas}
          bannedUmas={draftState.team1.bannedUmas}
          preBannedUmas={draftState.team1.preBannedUmas}
          pickedMaps={draftState.team1.pickedMaps}
          bannedMaps={draftState.team1.bannedMaps}
          isCurrentTurn={
            draftState.phase !== "complete" &&
            draftState.currentTeam === "team1"
          }
          activeSection={
            draftState.phase === "map-pick" || draftState.phase === "map-ban"
              ? "maps"
              : draftState.phase === "uma-pick" ||
                  draftState.phase === "uma-ban" ||
                  draftState.phase === "uma-pre-ban"
                ? "umas"
                : null
          }
          distanceCounts={countDistances(draftState.team1.pickedMaps)}
          dirtCount={countDirtTracks(draftState.team1.pickedMaps)}
          phase={draftState.phase}
          showMapOrder={
            draftState.phase === "post-map-pause" ||
            draftState.phase === "uma-pick" ||
            draftState.phase === "uma-ban" ||
            draftState.phase === "uma-pre-ban" ||
            draftState.phase === "complete"
          }
          ghostSelection={team1GhostSelection}
          incomingVetoSelection={team1IncomingVetoSelection}
          consecutivePicks={
            draftState.currentTeam === "team1" ? consecutivePicks : 1
          }
        />
      </div>

      <div className="flex-1 flex flex-col gap-2 lg:gap-4 overflow-hidden">
        <div className="shrink-0">
          <DraftHeader
            phase={draftState.phase}
            currentTeam={draftState.currentTeam}
            onUndo={handleUndo}
            onReset={handleReset}
            onBackToMenu={handleBackToMenu}
            team1Name={team1Name}
            team2Name={team2Name}
            canUndo={history.length > 1}
            wildcardMap={draftState.wildcardMap}
            isMultiplayer={isMultiplayer}
            connectionStatus={isConnected ? "connected" : "disconnected"}
            roomCode={roomCode}
            playerCount={firebasePlayers.length || 1}
            isHost={multiplayerConfig?.isHost || false}
            timeRemaining={timeRemaining}
            timerEnabled={true}
            completedActions={completedActions}
            sfxVolume={sfxVolume}
            onSfxVolumeChange={setSfxVolume}
            voicelineVolume={voicelineVolume}
            onVoicelineVolumeChange={setVoicelineVolume}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Pre-draft pause phase (before starting map draft) */}
          {draftState.phase === "pre-draft-pause" && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 lg:p-8 xl:p-10 text-center border border-gray-700">
              <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-100 mb-4 lg:mb-6">
                Ready to Start Draft?
              </h2>
              <p className="text-base lg:text-lg xl:text-xl text-gray-300 mb-6 lg:mb-8">
                Take your time to discuss strategy with your team.
              </p>
              <p className="text-sm lg:text-base text-gray-400 mb-4">
                The draft will begin with map selection when you're ready.
              </p>

              {/* Timer display */}
              <div className="mb-6 lg:mb-8">
                <span className="text-3xl lg:text-4xl font-mono font-bold text-yellow-400">
                  {Math.floor(readyUpTime / 60)}:
                  {(readyUpTime % 60).toString().padStart(2, "0")}
                </span>
              </div>

              {/* Multiplayer ready-up system */}
              {isMultiplayer && (
                <div className="mb-6 lg:mb-8">
                  <div className="flex justify-center gap-8 mb-6">
                    <div
                      className={`px-6 py-3 rounded-lg border-2 ${draftState.team1Ready ? "border-green-500 bg-green-900/30" : "border-gray-600 bg-gray-700/50"}`}
                    >
                      <p className="text-sm text-gray-400 mb-1">{team1Name}</p>
                      <p
                        className={`font-bold ${draftState.team1Ready ? "text-green-400" : "text-gray-500"}`}
                      >
                        {draftState.team1Ready ? "READY" : "Not Ready"}
                      </p>
                    </div>
                    <div
                      className={`px-6 py-3 rounded-lg border-2 ${draftState.team2Ready ? "border-green-500 bg-green-900/30" : "border-gray-600 bg-gray-700/50"}`}
                    >
                      <p className="text-sm text-gray-400 mb-1">{team2Name}</p>
                      <p
                        className={`font-bold ${draftState.team2Ready ? "text-green-400" : "text-gray-500"}`}
                      >
                        {draftState.team2Ready ? "READY" : "Not Ready"}
                      </p>
                    </div>
                  </div>

                  {/* Show Ready button if local player hasn't readied up */}
                  {(() => {
                    const localTeam =
                      draftState.multiplayer?.localTeam ||
                      (isHost ? "team1" : "team2");
                    const isLocalReady =
                      localTeam === "team1"
                        ? draftState.team1Ready
                        : draftState.team2Ready;
                    const bothReady =
                      draftState.team1Ready && draftState.team2Ready;

                    if (!isLocalReady) {
                      return (
                        <button
                          onClick={handleReady}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 lg:py-4 px-8 lg:px-12 rounded-lg transition-colors text-lg lg:text-xl shadow-lg"
                        >
                          Ready Up
                        </button>
                      );
                    } else if (isHost && bothReady) {
                      return (
                        <button
                          onClick={handleStartMapDraft}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 lg:py-4 px-8 lg:px-12 rounded-lg transition-colors text-lg lg:text-xl shadow-lg"
                        >
                          Start Draft
                        </button>
                      );
                    } else {
                      return (
                        <p className="text-gray-400 text-lg">
                          Waiting for other player to ready up...
                        </p>
                      );
                    }
                  })()}
                </div>
              )}

              {/* Local mode - simple start button */}
              {!isMultiplayer && (
                <button
                  onClick={handleStartMapDraft}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 lg:py-4 px-8 lg:px-12 rounded-lg transition-colors text-lg lg:text-xl shadow-lg"
                >
                  Start Draft
                </button>
              )}
            </div>
          )}

          {/* Post-map pause phase (after map bans, before uma picks) */}
          {draftState.phase === "post-map-pause" && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 lg:p-8 xl:p-10 text-center border border-gray-700">
              <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-100 mb-4 lg:mb-6">
                Map Draft Complete
              </h2>
              <p className="text-base lg:text-lg xl:text-xl text-gray-300 mb-6 lg:mb-8">
                All maps have been selected. Take time to review and strategize.
              </p>
              <p className="text-sm lg:text-base text-gray-400 mb-4">
                The draft will continue with Uma Musume selection when you're
                ready.
              </p>

              {/* Timer display */}
              <div className="mb-6 lg:mb-8">
                <span className="text-3xl lg:text-4xl font-mono font-bold text-yellow-400">
                  {Math.floor(readyUpTime / 60)}:
                  {(readyUpTime % 60).toString().padStart(2, "0")}
                </span>
              </div>

              {/* Multiplayer ready-up system */}
              {isMultiplayer && (
                <div className="mb-6 lg:mb-8">
                  <div className="flex justify-center gap-8 mb-6">
                    <div
                      className={`px-6 py-3 rounded-lg border-2 ${draftState.team1Ready ? "border-green-500 bg-green-900/30" : "border-gray-600 bg-gray-700/50"}`}
                    >
                      <p className="text-sm text-gray-400 mb-1">{team1Name}</p>
                      <p
                        className={`font-bold ${draftState.team1Ready ? "text-green-400" : "text-gray-500"}`}
                      >
                        {draftState.team1Ready ? "READY" : "Not Ready"}
                      </p>
                    </div>
                    <div
                      className={`px-6 py-3 rounded-lg border-2 ${draftState.team2Ready ? "border-green-500 bg-green-900/30" : "border-gray-600 bg-gray-700/50"}`}
                    >
                      <p className="text-sm text-gray-400 mb-1">{team2Name}</p>
                      <p
                        className={`font-bold ${draftState.team2Ready ? "text-green-400" : "text-gray-500"}`}
                      >
                        {draftState.team2Ready ? "READY" : "Not Ready"}
                      </p>
                    </div>
                  </div>

                  {/* Show Ready button if local player hasn't readied up */}
                  {(() => {
                    const localTeam =
                      draftState.multiplayer?.localTeam ||
                      (isHost ? "team1" : "team2");
                    const isLocalReady =
                      localTeam === "team1"
                        ? draftState.team1Ready
                        : draftState.team2Ready;
                    const bothReady =
                      draftState.team1Ready && draftState.team2Ready;

                    if (!isLocalReady) {
                      return (
                        <button
                          onClick={handleReady}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 lg:py-4 px-8 lg:px-12 rounded-lg transition-colors text-lg lg:text-xl shadow-lg"
                        >
                          Ready Up
                        </button>
                      );
                    } else if (isHost && bothReady) {
                      return (
                        <button
                          onClick={handleContinueToUma}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 lg:py-4 px-8 lg:px-12 rounded-lg transition-colors text-lg lg:text-xl shadow-lg"
                        >
                          Continue Draft
                        </button>
                      );
                    } else {
                      return (
                        <p className="text-gray-400 text-lg">
                          Waiting for other player to ready up...
                        </p>
                      );
                    }
                  })()}
                </div>
              )}

              {/* Local mode - simple continue button */}
              {!isMultiplayer && (
                <button
                  onClick={handleContinueToUma}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 lg:py-4 px-8 lg:px-12 rounded-lg transition-colors text-lg lg:text-xl shadow-lg"
                >
                  Continue Draft
                </button>
              )}
            </div>
          )}

          {!isComplete &&
            draftState.phase !== "pre-draft-pause" &&
            draftState.phase !== "post-map-pause" && (
              <div className="bg-gray-800 rounded-lg shadow-lg p-3 lg:p-4 xl:p-6 border border-gray-700 flex flex-col h-full">
                <div className="shrink-0">
                  <h2 className="text-lg lg:text-xl xl:text-2xl font-bold mb-2 lg:mb-4 text-gray-100">
                    {draftState.phase === "uma-pick" && "Available Umamusume"}
                    {draftState.phase === "uma-pre-ban" && "Pre-Ban Umamusume"}
                    {draftState.phase === "uma-ban" &&
                      "Veto Opponent's Umamusume"}
                    {draftState.phase === "map-pick" &&
                      !selectedTrack &&
                      "Select a Racecourse"}
                    {draftState.phase === "map-pick" &&
                      selectedTrack &&
                      `Select Distance - ${selectedTrack}`}
                    {draftState.phase === "map-ban" && "Veto Opponent's Map"}
                  </h2>

                  {isUmaPhase && (
                    <div className="relative mb-2 lg:mb-4">
                      <input
                        type="text"
                        placeholder="Search Umamusume..."
                        value={umaSearch}
                        onChange={(e) => setUmaSearch(e.target.value)}
                        className="w-full px-3 lg:px-4 py-1.5 lg:py-2 bg-gray-700/80 border border-gray-600/60 rounded-lg text-sm lg:text-base text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 pr-20"
                      />
                      {umaSearch && (
                        <button
                          onClick={() => setUmaSearch("")}
                          className="absolute right-14 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-sm px-1"
                          title="Clear search"
                        >
                          x
                        </button>
                      )}
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                        {getFilteredUmas().length} avail.
                      </span>
                    </div>
                  )}

                  {draftState.phase === "map-pick" && selectedTrack && (
                    <button
                      onClick={() => {
                        setSelectedTrack(null);
                        setPendingMap(null);
                      }}
                      className="mb-2 lg:mb-4 bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-1.5 lg:py-2 px-3 lg:px-4 rounded-lg transition-colors border border-gray-600 text-sm lg:text-base"
                    >
                      ← Back to Racecourses
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-3 xl:gap-4">
                    {isUmaPhase &&
                      getFilteredUmas().map((uma) => (
                        <UmaCard
                          key={uma.id}
                          uma={uma}
                          onSelect={handleUmaClick}
                          isSelected={pendingUma?.id === uma.id}
                        />
                      ))}

                    {draftState.phase === "map-pick" &&
                      !selectedTrack &&
                      getAvailableTracks().map((track) => (
                        <button
                          key={track}
                          onClick={() => setSelectedTrack(track)}
                          className="p-2 lg:p-3 xl:p-4 bg-gray-700 border-2 border-gray-600 rounded-lg hover:border-gray-500 hover:shadow-lg transition-all overflow-hidden"
                        >
                          <div className="aspect-video bg-gray-600 rounded mb-1 lg:mb-2 flex items-center justify-center overflow-hidden">
                            <img
                              src={`./racetrack-portraits/${track.toLowerCase()}.png`}
                              alt={track}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                              }}
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-sm lg:text-base xl:text-lg font-bold text-gray-100">
                              {track}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 lg:mt-1">
                              {getMapsForTrack(track).length} options
                            </p>
                          </div>
                        </button>
                      ))}

                    {draftState.phase === "map-pick" &&
                      selectedTrack &&
                      getMapsForTrack(selectedTrack).map((map) => (
                        <MapCard
                          key={map.id}
                          map={map}
                          onSelect={handleMapClick}
                          disabled={!canSelectMap(map)}
                          isSelected={pendingMap?.id === map.id}
                        />
                      ))}

                    {draftState.phase === "map-ban" &&
                      getBannableMaps().map((map) => (
                        <MapCard
                          key={map.id}
                          map={map}
                          onSelect={handleMapClick}
                          isSelected={pendingMap?.id === map.id}
                        />
                      ))}
                  </div>
                </div>
              </div>
            )}

          {isComplete && (
            <div className="bg-gray-800/90 rounded-lg shadow-lg p-4 lg:p-6 xl:p-8 border border-gray-700/60 overflow-y-auto custom-scrollbar">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-100 mb-4 lg:mb-6 text-center">
                Draft Complete
              </h2>

              {/* Scoreboard */}
              <div className="mb-4 lg:mb-6">
                <div className="bg-gray-900/70 rounded-xl p-3 lg:p-4 border border-gray-600/40 flex items-center justify-center gap-6 lg:gap-10">
                  <div className="flex-1 text-center min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5 break-words">
                      {team1Name}
                    </p>
                    <p className="text-3xl lg:text-4xl font-bold text-blue-400 font-mono">
                      {SCORING_MODE === "points"
                        ? scores.team1Points
                        : scores.team1Wins}
                    </p>
                  </div>
                  <div className="shrink-0 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">
                      {SCORING_MODE === "points"
                        ? `First to ${POINTS_TO_WIN}`
                        : `Best of ${WINS_TO_WIN * 2 - 1}`}
                    </p>
                    <p className="text-lg text-gray-500 font-bold">vs</p>
                    <p className="text-[10px] text-gray-600">
                      {matchResults.length} race
                      {matchResults.length !== 1 ? "s" : ""} reported
                    </p>
                  </div>
                  <div className="flex-1 text-center min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5 break-words">
                      {team2Name}
                    </p>
                    <p className="text-3xl lg:text-4xl font-bold text-red-400 font-mono">
                      {SCORING_MODE === "points"
                        ? scores.team2Points
                        : scores.team2Wins}
                    </p>
                  </div>
                </div>
                {/* Series winner announcement */}
                {((SCORING_MODE === "points" &&
                  (scores.team1Points >= POINTS_TO_WIN ||
                    scores.team2Points >= POINTS_TO_WIN)) ||
                  (SCORING_MODE === "wins" &&
                    (scores.team1Wins >= WINS_TO_WIN ||
                      scores.team2Wins >= WINS_TO_WIN))) && (
                  <div className="mt-3 bg-yellow-900/30 border border-yellow-600/40 rounded-lg p-3 text-center">
                    <p className="text-yellow-400 font-bold text-lg">
                      {SCORING_MODE === "points"
                        ? scores.team1Points >= POINTS_TO_WIN
                          ? team1Name
                          : team2Name
                        : scores.team1Wins >= WINS_TO_WIN
                          ? team1Name
                          : team2Name}{" "}
                      wins the series!
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      Final score:{" "}
                      {SCORING_MODE === "points"
                        ? `${scores.team1Points} - ${scores.team2Points}`
                        : `${scores.team1Wins} - ${scores.team2Wins}`}{" "}
                      after {matchResults.length} race
                      {matchResults.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
                {/* Race-by-race breakdown */}
                {matchResults.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {matchResults.map((result) => {
                      const schedule = getMapSchedule();
                      const raceMap = schedule[result.raceIndex];
                      const raceT1 = result.placements
                        .filter((p) => p.team === "team1")
                        .reduce(
                          (sum, p) => sum + (POINT_VALUES[p.position] || 0),
                          0,
                        );
                      const raceT2 = result.placements
                        .filter((p) => p.team === "team2")
                        .reduce(
                          (sum, p) => sum + (POINT_VALUES[p.position] || 0),
                          0,
                        );
                      return (
                        <div
                          key={result.raceIndex}
                          className="flex items-center gap-2 px-3 py-1 bg-gray-900/30 rounded text-xs"
                        >
                          <span className="text-gray-500 font-mono w-5">
                            {result.raceIndex + 1}.
                          </span>
                          <span className="text-gray-300 flex-1">
                            {raceMap?.map.track} {raceMap?.map.distance}m
                          </span>
                          <span className="text-gray-400">
                            {result.placements.map((p) => (
                              <span
                                key={p.position}
                                className={`mx-0.5 ${p.team === "team1" ? "text-blue-400" : "text-red-400"}`}
                              >
                                {p.position === 1
                                  ? "1st "
                                  : p.position === 2
                                    ? "2nd "
                                    : "3rd "}
                                {formatUmaNameFromParts(p.umaName, p.umaTitle)}
                              </span>
                            ))}
                          </span>
                          {SCORING_MODE === "points" && (
                            <span className="text-gray-500 ml-2">
                              <span className="text-blue-400">{raceT1}</span>-
                              <span className="text-red-400">{raceT2}</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pending match report confirmation (shown to team 2) */}
              {pendingReport?.awaitingConfirm && !isHost && (
                <div className="mb-4 bg-emerald-900/20 border border-emerald-600/35 rounded-lg p-3 lg:p-4">
                  <h3 className="text-emerald-400 font-bold text-sm mb-2 text-center">
                    Confirm Race Result
                  </h3>
                  <div className="text-center text-sm text-gray-200 mb-3">
                    {(() => {
                      const schedule = getMapSchedule();
                      const raceMap = schedule[pendingReport.raceIndex];
                      return (
                        <p>
                          Race {pendingReport.raceIndex + 1}:{" "}
                          {raceMap?.map.track} {raceMap?.map.distance}m
                        </p>
                      );
                    })()}
                    <div className="mt-2 space-y-1">
                      {pendingReport.placements.map((p) => (
                        <div key={p.position} className="text-gray-300">
                          {p.position === 1
                            ? "1st"
                            : p.position === 2
                              ? "2nd"
                              : "3rd"}
                          : {formatUmaNameFromParts(p.umaName, p.umaTitle)}
                          <span
                            className={`ml-1 text-xs ${p.team === "team1" ? "text-blue-400" : "text-red-400"}`}
                          >
                            ({p.team === "team1" ? team1Name : team2Name})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {confirmCountdown !== null && (
                    <p className="text-center text-xs text-emerald-300/80 mb-2">
                      Auto-confirming in {confirmCountdown}s
                    </p>
                  )}
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={rejectMatchReport}
                      className="bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-1.5 px-5 rounded-lg text-sm border border-gray-600"
                    >
                      Dispute
                    </button>
                    <button
                      onClick={confirmMatchReport}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 px-5 rounded-lg text-sm"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}

              {/* Pending confirmation notice for host */}
              {pendingReport?.awaitingConfirm && isHost && (
                <div className="mb-4 bg-emerald-900/15 border border-emerald-700/25 rounded-lg p-3 text-center">
                  <p className="text-emerald-400 text-sm">
                    Waiting for {team2Name} to confirm race{" "}
                    {pendingReport.raceIndex + 1} result...
                  </p>
                </div>
              )}

              {/* Team Rosters Side by Side */}
              <div className="grid grid-cols-2 gap-4 lg:gap-6 mb-6">
                {/* Team 1 Roster */}
                <div className="bg-gray-900/60 rounded-lg p-3 lg:p-4 border border-blue-500/20">
                  <h3 className="text-blue-400 font-bold text-sm lg:text-base mb-2 text-center uppercase tracking-wider">
                    {team1Name}
                  </h3>
                  <div className="grid grid-cols-3 gap-1.5 lg:gap-2 mb-2">
                    {draftState.team1.pickedUmas.map((uma, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg overflow-hidden border border-blue-500/30 bg-gray-700">
                          {uma.imageUrl && (
                            <img
                              src={uma.imageUrl}
                              alt={uma.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <span className="text-[9px] lg:text-[10px] text-gray-300 text-center leading-tight">
                          {uma.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  {draftState.team1.preBannedUmas?.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-gray-700/50">
                      <span className="text-[10px] lg:text-xs text-orange-300 uppercase font-semibold">
                        Pre-Banned:{" "}
                      </span>
                      <span className="text-[10px] lg:text-xs text-gray-300">
                        {draftState.team1.preBannedUmas
                          .map((u) => formatUmaName(u))
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {draftState.team1.bannedUmas.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-gray-700/50">
                      <span className="text-[10px] lg:text-xs text-red-300 uppercase font-semibold">
                        Veoted By Enemy Team:{" "}
                      </span>
                      <span className="text-[10px] lg:text-xs text-gray-300">
                        {draftState.team1.bannedUmas
                          .map((u) => formatUmaName(u))
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Team 2 Roster */}
                <div className="bg-gray-900/60 rounded-lg p-3 lg:p-4 border border-red-500/20">
                  <h3 className="text-red-400 font-bold text-sm lg:text-base mb-2 text-center uppercase tracking-wider">
                    {team2Name}
                  </h3>
                  <div className="grid grid-cols-3 gap-1.5 lg:gap-2 mb-2">
                    {draftState.team2.pickedUmas.map((uma, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg overflow-hidden border border-red-500/30 bg-gray-700">
                          {uma.imageUrl && (
                            <img
                              src={uma.imageUrl}
                              alt={uma.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <span className="text-[9px] lg:text-[10px] text-gray-300 text-center leading-tight">
                          {uma.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  {draftState.team2.preBannedUmas?.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-gray-700/50">
                      <span className="text-[10px] lg:text-xs text-orange-300 uppercase font-semibold">
                        Pre-Banned:{" "}
                      </span>
                      <span className="text-[10px] lg:text-xs text-gray-300">
                        {draftState.team2.preBannedUmas
                          .map((u) => formatUmaName(u))
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {draftState.team2.bannedUmas.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-gray-700/50">
                      <span className="text-[10px] lg:text-xs text-red-300 uppercase font-semibold">
                        Veoted By Enemy Team:{" "}
                      </span>
                      <span className="text-[10px] lg:text-xs text-gray-300">
                        {draftState.team2.bannedUmas
                          .map((u) => formatUmaName(u))
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Map Schedule */}
              <div className="mb-4 lg:mb-6">
                <h3 className="text-gray-300 font-bold text-sm lg:text-base mb-2 uppercase tracking-wider text-center">
                  Map Schedule
                </h3>
                <div className="space-y-1">
                  {(() => {
                    const schedule = getMapSchedule();
                    return schedule.map((s) => {
                      const roomCodeKey =
                        s.team === "Tiebreaker"
                          ? "tiebreaker"
                          : `map-${s.index}`;
                      const dotClass =
                        s.team === team1Name
                          ? "bg-blue-500"
                          : s.team === team2Name
                            ? "bg-red-500"
                            : "bg-yellow-400";
                      return (
                        <div
                          key={s.index}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/40 rounded-lg text-sm"
                        >
                          <span className="text-gray-500 font-mono text-xs w-5">
                            {s.index}.
                          </span>
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`}
                          />
                          <span className="text-gray-200 font-medium">
                            {s.map.track}
                          </span>
                          {s.map.variant && (
                            <span className="text-gray-400 text-xs">
                              ({s.map.variant})
                            </span>
                          )}
                          <span className="text-gray-100 font-semibold">
                            {s.map.distance}m
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${s.map.surface?.toLowerCase() === "turf" ? "bg-green-900/40 text-green-400" : "bg-amber-900/40 text-amber-400"}`}
                          >
                            {s.map.surface}
                          </span>
                          <span className="text-gray-300 text-xs ml-auto">
                            {s.map.direction === "right"
                              ? "Right"
                              : s.map.direction === "left"
                                ? "Left"
                                : "Straight"}
                            {s.map.conditions &&
                              ` / ${s.map.conditions.season} / ${s.map.conditions.ground} / ${s.map.conditions.weather}`}
                          </span>
                          <div className="flex items-center gap-1 ml-2">
                            <input
                              type="text"
                              placeholder="Room code"
                              value={roomCodes[roomCodeKey] || ""}
                              onChange={(e) =>
                                setRoomCodes((prev) => ({
                                  ...prev,
                                  [roomCodeKey]: e.target.value,
                                }))
                              }
                              className="w-24 px-2 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded text-gray-200 placeholder-gray-600 focus:border-gray-400 focus:outline-none"
                            />
                            {roomCodes[roomCodeKey] && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    roomCodes[roomCodeKey],
                                  );
                                  setCopiedRoomCodeKey(roomCodeKey);
                                  setTimeout(
                                    () => setCopiedRoomCodeKey(null),
                                    2000,
                                  );
                                }}
                                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${copiedRoomCodeKey === roomCodeKey ? "bg-green-700 text-green-200" : "bg-gray-700 hover:bg-gray-600 text-gray-300"}`}
                                title="Copy room code"
                              >
                                {copiedRoomCodeKey === roomCodeKey
                                  ? "Copied!"
                                  : "Copy"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Copy Results & Match Reporting Buttons */}
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={() => {
                    const umaLabel = (u: {
                      id: string | number;
                      name: string;
                      title?: string;
                    }) => formatUmaName(u);
                    const t1Umas = draftState.team1.pickedUmas
                      .map(umaLabel)
                      .join(", ");
                    const t2Umas = draftState.team2.pickedUmas
                      .map(umaLabel)
                      .join(", ");
                    const t1PreBans = (draftState.team1.preBannedUmas || [])
                      .map(umaLabel)
                      .join(", ");
                    const t2PreBans = (draftState.team2.preBannedUmas || [])
                      .map(umaLabel)
                      .join(", ");
                    const t1Bans = draftState.team1.bannedUmas
                      .map(umaLabel)
                      .join(", ");
                    const t2Bans = draftState.team2.bannedUmas
                      .map(umaLabel)
                      .join(", ");
                    const formatConditions = (m: Map) =>
                      m.conditions
                        ? ` [${m.conditions.season} / ${m.conditions.weather} / ${m.conditions.ground}]`
                        : "";
                    const formatVariant = (m: Map) =>
                      m.variant ? ` (${m.variant})` : "";
                    const maps = getMapSchedule()
                      .map(
                        (entry) =>
                          `${entry.index}. ${entry.map.track}${formatVariant(entry.map)} ${entry.map.distance}m (${entry.map.surface})${formatConditions(entry.map)}`,
                      )
                      .join("\n");

                    let text = `=== DRAFT RESULTS ===\n\n${team1Name}: ${t1Umas}\nPre-Banned: ${t1PreBans || "None"}\nVeoted By Enemy Team: ${t1Bans || "None"}\n\n${team2Name}: ${t2Umas}\nPre-Banned: ${t2PreBans || "None"}\nVeoted By Enemy Team: ${t2Bans || "None"}\n\nMap Schedule:\n${maps}`;

                    if (matchResults.length > 0) {
                      const schedule = getMapSchedule();
                      let t1Total = 0;
                      let t2Total = 0;
                      const raceLines = matchResults
                        .slice()
                        .sort((a, b) => a.raceIndex - b.raceIndex)
                        .map((result) => {
                          const raceMap = schedule[result.raceIndex];
                          const mapLabel = raceMap
                            ? `${raceMap.map.track} ${raceMap.map.distance}m`
                            : `Race ${result.raceIndex + 1}`;
                          const placements = result.placements
                            .map((p) => {
                              const pos =
                                p.position === 1
                                  ? "1st"
                                  : p.position === 2
                                    ? "2nd"
                                    : "3rd";
                              return `${pos}: ${formatUmaNameFromParts(
                                p.umaName,
                                p.umaTitle,
                              )}`;
                            })
                            .join(", ");
                          const raceT1 = result.placements
                            .filter((p) => p.team === "team1")
                            .reduce(
                              (s, p) => s + (POINT_VALUES[p.position] || 0),
                              0,
                            );
                          const raceT2 = result.placements
                            .filter((p) => p.team === "team2")
                            .reduce(
                              (s, p) => s + (POINT_VALUES[p.position] || 0),
                              0,
                            );
                          t1Total += raceT1;
                          t2Total += raceT2;
                          return `${result.raceIndex + 1}. ${mapLabel} — ${placements} (${raceT1}-${raceT2})`;
                        })
                        .join("\n");
                      text += `\n\n=== MATCH RESULTS ===\n${raceLines}\n\nScore: ${team1Name} ${t1Total} - ${t2Total} ${team2Name}`;
                    }

                    navigator.clipboard.writeText(text);
                  }}
                  className="bg-gray-700/80 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600/50 text-sm"
                >
                  Copy Draft Results
                </button>
                <button
                  onClick={() => {
                    const text =
                      draftState.pickOrderHistoryText ||
                      buildPickOrderHistoryText(
                        history[history.length - 1] === draftState
                          ? history
                          : [...history, draftState],
                        team1Name,
                        team2Name,
                      );
                    navigator.clipboard.writeText(text);
                  }}
                  className="bg-gray-700/80 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600/50 text-sm"
                >
                  Copy Pick Order
                </button>
                {(!isMultiplayer || isHost) && !pendingReport && (
                  <button
                    onClick={openMatchReporting}
                    disabled={
                      nextRaceIndex >= getMapSchedule().length ||
                      (SCORING_MODE === "points" &&
                        (scores.team1Points >= POINTS_TO_WIN ||
                          scores.team2Points >= POINTS_TO_WIN)) ||
                      (SCORING_MODE === "wins" &&
                        (scores.team1Wins >= WINS_TO_WIN ||
                          scores.team2Wins >= WINS_TO_WIN))
                    }
                    className="bg-emerald-600/80 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors border border-emerald-500/50 disabled:border-gray-600 text-sm"
                  >
                    {(SCORING_MODE === "points" &&
                      (scores.team1Points >= POINTS_TO_WIN ||
                        scores.team2Points >= POINTS_TO_WIN)) ||
                    (SCORING_MODE === "wins" &&
                      (scores.team1Wins >= WINS_TO_WIN ||
                        scores.team2Wins >= WINS_TO_WIN))
                      ? "Series Complete"
                      : nextRaceIndex >= getMapSchedule().length
                        ? "All Races Reported"
                        : `Submit Results: Race ${nextRaceIndex + 1}`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Lock In Button - Fixed at bottom */}
        {(pendingUma || pendingMap) &&
          (() => {
            const isMyTurn =
              !isMultiplayer || draftState.currentTeam === localTeam;
            const isPreBanPhase = draftState.phase === "uma-pre-ban";
            const isVetoPhase =
              draftState.phase === "uma-ban" || draftState.phase === "map-ban";
            const isBanPhase = isPreBanPhase || isVetoPhase;

            return (
              <div className="shrink-0 py-3 lg:py-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700/50">
                <div className="flex flex-col items-center gap-1">
                  {(() => {
                    const label = isPreBanPhase
                      ? "BAN"
                      : isVetoPhase
                        ? "VETO"
                        : "LOCK IN";
                    const glowClass = isBanPhase
                      ? "ban-btn-glow"
                      : "lockin-btn-glow";
                    const bgClass = isBanPhase
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700";
                    return (
                      <>
                        <button
                          onMouseEnter={() => {
                            if (!isMyTurn) return;
                            playSfx(
                              isBanPhase
                                ? "banButtonHover"
                                : "lockInButtonHover",
                            );
                          }}
                          onClick={
                            isMyTurn
                              ? () => {
                                  handleLockIn();
                                }
                              : undefined
                          }
                          disabled={!isMyTurn}
                          className={`${
                            !isMyTurn
                              ? "bg-gray-600 cursor-not-allowed opacity-40"
                              : `${bgClass} ${glowClass}`
                          } text-white font-bold py-3 lg:py-4 px-12 lg:px-16 rounded-lg transition-all text-lg lg:text-xl`}
                        >
                          {label}{" "}
                          {pendingUma ? pendingUma.name : pendingMap?.name}
                          {!isMyTurn && " (waiting for turn)"}
                        </button>
                        {isMyTurn && (
                          <span className="text-[10px] text-gray-500 tracking-wider">
                            Press ENTER to confirm
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })()}
      </div>

      <div className="w-56 lg:w-72 xl:w-96 shrink-0 flex flex-col px-1 lg:px-2 min-h-0">
        <TeamPanel
          team="team2"
          teamName={team2Name}
          pickedUmas={draftState.team2.pickedUmas}
          bannedUmas={draftState.team2.bannedUmas}
          preBannedUmas={draftState.team2.preBannedUmas}
          pickedMaps={draftState.team2.pickedMaps}
          bannedMaps={draftState.team2.bannedMaps}
          isCurrentTurn={
            draftState.phase !== "complete" &&
            draftState.currentTeam === "team2"
          }
          activeSection={
            draftState.phase === "map-pick" || draftState.phase === "map-ban"
              ? "maps"
              : draftState.phase === "uma-pick" ||
                  draftState.phase === "uma-ban" ||
                  draftState.phase === "uma-pre-ban"
                ? "umas"
                : null
          }
          distanceCounts={countDistances(draftState.team2.pickedMaps)}
          dirtCount={countDirtTracks(draftState.team2.pickedMaps)}
          phase={draftState.phase}
          showMapOrder={
            draftState.phase === "post-map-pause" ||
            draftState.phase === "uma-pick" ||
            draftState.phase === "uma-ban" ||
            draftState.phase === "uma-pre-ban" ||
            draftState.phase === "complete"
          }
          ghostSelection={team2GhostSelection}
          incomingVetoSelection={team2IncomingVetoSelection}
          consecutivePicks={
            draftState.currentTeam === "team2" ? consecutivePicks : 1
          }
        />
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-4 lg:p-6 xl:p-8 border-2 border-gray-700 max-w-md w-full">
            <h2 className="text-xl lg:text-2xl font-bold text-gray-100 mb-2 lg:mb-4">
              Reset Draft?
            </h2>
            <p className="text-sm lg:text-base text-gray-400 mb-4 lg:mb-6">
              Are you sure you want to reset the draft? All current progress
              will be lost.
            </p>
            <div className="flex gap-2 lg:gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-1.5 lg:py-2 px-4 lg:px-6 rounded-lg transition-colors border border-gray-600 text-sm lg:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 lg:py-2 px-4 lg:px-6 rounded-lg transition-colors text-sm lg:text-base"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back to Menu Confirmation Modal */}
      {showMenuConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-4 lg:p-6 xl:p-8 border-2 border-gray-700 max-w-md w-full">
            <h2 className="text-xl lg:text-2xl font-bold text-gray-100 mb-2 lg:mb-4">
              Return to Menu?
            </h2>
            <p className="text-sm lg:text-base text-gray-400 mb-4 lg:mb-6">
              Are you sure you want to return to the format selection menu?
              Current draft progress will be lost.
            </p>
            <div className="flex gap-2 lg:gap-3 justify-end">
              <button
                onClick={() => setShowMenuConfirm(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-1.5 lg:py-2 px-4 lg:px-6 rounded-lg transition-colors border border-gray-600 text-sm lg:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmBackToMenu}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 lg:py-2 px-4 lg:px-6 rounded-lg transition-colors text-sm lg:text-base"
              >
                Return to Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wildcard Map Reveal Modal */}
      {showWildcardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-4 lg:p-6 xl:p-8 border-2 border-gray-700 max-w-2xl w-full">
            <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-100 mb-2 lg:mb-4 text-center">
              {!revealStarted
                ? "Wildcard Tiebreaker Map"
                : "Tiebreaker Map Revealed!"}
            </h2>
            <div
              className="flex justify-center mb-4 lg:mb-14 xl:mb-22 relative"
              style={{ perspective: "1000px", height: "280px" }}
            >
              <div
                className={`bg-gray-700 border-4 ${revealStarted && !cyclingMap ? "border-blue-500" : "border-gray-600"} rounded-xl p-4 lg:p-6 xl:p-8 max-w-md transition-all duration-300`}
                style={
                  cyclingMap
                    ? {
                        position: "absolute",
                        animation: "spin3d 0.6s linear infinite",
                        transformStyle: "preserve-3d",
                      }
                    : { position: "absolute" }
                }
              >
                {!revealStarted ? (
                  <div
                    className="flex flex-col items-center justify-center"
                    style={{ height: "250px", width: "200px" }}
                  >
                    <div className="text-6xl lg:text-8xl text-gray-400">?</div>
                  </div>
                ) : cyclingMap ? (
                  <>
                    <div className="aspect-video bg-gray-600 rounded-lg mb-2 lg:mb-4 overflow-hidden">
                      <img
                        src={`./racetrack-portraits/${cyclingMap.track?.toLowerCase()}.png`}
                        alt={cyclingMap.track}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </div>
                    <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-white mb-1 lg:mb-2 text-center">
                      {cyclingMap.track}
                    </h3>
                    <div
                      className={`inline-block px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg mb-1 lg:mb-2 ${
                        cyclingMap.surface?.toLowerCase() === "turf"
                          ? "bg-green-700"
                          : "bg-amber-800"
                      } w-full text-center`}
                    >
                      <span className="text-sm lg:text-base xl:text-lg font-semibold text-white">
                        {cyclingMap.surface}
                      </span>
                    </div>
                    <p className="text-base lg:text-lg xl:text-xl text-gray-200 text-center">
                      {cyclingMap.distance}m
                      {cyclingMap.variant && ` (${cyclingMap.variant})`}
                    </p>
                    {cyclingMap.conditions && (
                      <p className="text-sm lg:text-base xl:text-lg text-gray-300 mt-1 lg:mt-2 text-center">
                        {cyclingMap.conditions.season} •{" "}
                        {cyclingMap.conditions.ground} •{" "}
                        {cyclingMap.conditions.weather}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="aspect-video bg-gray-600 rounded-lg mb-2 lg:mb-4 overflow-hidden">
                      <img
                        src={`./racetrack-portraits/${draftState.wildcardMap.track?.toLowerCase()}.png`}
                        alt={draftState.wildcardMap.track}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </div>
                    <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-white mb-1 lg:mb-2 text-center">
                      {draftState.wildcardMap.track}
                    </h3>
                    <div
                      className={`inline-block px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg mb-1 lg:mb-2 ${
                        draftState.wildcardMap.surface?.toLowerCase() === "turf"
                          ? "bg-green-700"
                          : "bg-amber-800"
                      } w-full text-center`}
                    >
                      <span className="text-sm lg:text-base xl:text-lg font-semibold text-white">
                        {draftState.wildcardMap.surface}
                      </span>
                    </div>
                    <p className="text-base lg:text-lg xl:text-xl text-gray-200 text-center">
                      {draftState.wildcardMap.distance}m
                      {draftState.wildcardMap.variant &&
                        ` (${draftState.wildcardMap.variant})`}
                    </p>
                    {draftState.wildcardMap.conditions && (
                      <p className="text-sm lg:text-base xl:text-lg text-gray-300 mt-1 lg:mt-2 text-center">
                        {draftState.wildcardMap.conditions.season} •{" "}
                        {draftState.wildcardMap.conditions.ground} •{" "}
                        {draftState.wildcardMap.conditions.weather}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-center">
              {!revealStarted ? (
                <button
                  onClick={startReveal}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 lg:py-3 px-8 lg:px-12 rounded-lg text-base lg:text-lg xl:text-xl transition-colors shadow-lg"
                >
                  Reveal Wildcard Map
                </button>
              ) : cyclingMap ? (
                <div className="text-gray-400 text-base lg:text-lg">
                  Revealing...
                </div>
              ) : (
                <button
                  onClick={acknowledgeDraft}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 lg:py-3 px-8 lg:px-12 rounded-lg text-base lg:text-lg xl:text-xl transition-colors shadow-lg"
                >
                  {isMultiplayer && isHost
                    ? "Start Draft"
                    : isMultiplayer
                      ? "Continue"
                      : "Start Draft"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team Name Input Modal */}
      {showTeamNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-4 lg:p-6 xl:p-8 border-2 border-gray-700 max-w-md w-full">
            <h2 className="text-xl lg:text-2xl font-bold text-gray-100 mb-2 lg:mb-4">
              Enter Team Names
            </h2>
            <p className="text-sm lg:text-base text-gray-400 mb-4 lg:mb-6">
              Give your teams custom names for this draft
            </p>
            <div className="space-y-3 lg:space-y-4 mb-4 lg:mb-6">
              <div>
                <label className="block text-xs lg:text-sm font-semibold text-blue-400 mb-1 lg:mb-2">
                  Team 1 Name
                </label>
                <input
                  type="text"
                  value={tempTeam1Name}
                  onChange={(e) => setTempTeam1Name(e.target.value)}
                  placeholder="Team 1"
                  maxLength={30}
                  className="w-full px-3 lg:px-4 py-1.5 lg:py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm lg:text-base text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-semibold text-red-400 mb-1 lg:mb-2">
                  Team 2 Name
                </label>
                <input
                  type="text"
                  value={tempTeam2Name}
                  onChange={(e) => setTempTeam2Name(e.target.value)}
                  placeholder="Team 2"
                  maxLength={30}
                  className="w-full px-3 lg:px-4 py-1.5 lg:py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm lg:text-base text-gray-100 placeholder-gray-400 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
            {/* Turn Timer */}
            <div className="mb-4 lg:mb-6">
              <label className="block text-xs lg:text-sm font-semibold text-gray-400 mb-1.5 lg:mb-2">
                Turn Timer
              </label>
              <div className="flex items-center gap-2">
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTurnDuration(d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      turnDuration === d
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={turnDuration}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return;
                    const v = parseInt(raw);
                    if (!isNaN(v)) setTurnDuration(v);
                  }}
                  onBlur={() => {
                    setTurnDuration(Math.min(300, Math.max(10, turnDuration)));
                  }}
                  className="w-20 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 text-center focus:outline-none focus:border-blue-500 no-spinner"
                />
                <span className="text-xs text-gray-400">sec</span>
              </div>
            </div>
            <div className="flex justify-between">
              <button
                onClick={onBackToMenu}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-1.5 lg:py-2 px-6 lg:px-8 rounded-lg transition-colors text-sm lg:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmTeamNames}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 lg:py-2 px-6 lg:px-8 rounded-lg transition-colors text-sm lg:text-base"
              >
                Start Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Reporting Modal */}
      {showMatchReporting &&
        (() => {
          const schedule = getMapSchedule();
          const raceMap = schedule[reportRaceIndex];
          const positionSlots = [
            {
              key: "first" as const,
              label: "1st Place",
              points: POINT_VALUES[1],
              color: "text-yellow-400",
              ring: "ring-yellow-500",
              bg: "bg-yellow-500/20",
            },
            {
              key: "second" as const,
              label: "2nd Place",
              points: POINT_VALUES[2],
              color: "text-gray-300",
              ring: "ring-gray-400",
              bg: "bg-gray-400/20",
            },
            {
              key: "third" as const,
              label: "3rd Place",
              points: POINT_VALUES[3],
              color: "text-amber-600",
              ring: "ring-amber-600",
              bg: "bg-amber-600/20",
            },
          ];
          const selectedIds = [
            reportPlacements.first,
            reportPlacements.second,
            reportPlacements.third,
          ].filter(Boolean);

          const handleUmaClick = (umaId: string) => {
            const id = umaId;
            // If already selected somewhere, remove it
            if (reportPlacements.first === id) {
              setReportPlacements((prev) => ({ ...prev, first: "" }));
              return;
            }
            if (reportPlacements.second === id) {
              setReportPlacements((prev) => ({ ...prev, second: "" }));
              return;
            }
            if (reportPlacements.third === id) {
              setReportPlacements((prev) => ({ ...prev, third: "" }));
              return;
            }
            // Place in first empty slot
            if (!reportPlacements.first) {
              setReportPlacements((prev) => ({ ...prev, first: id }));
            } else if (!reportPlacements.second) {
              setReportPlacements((prev) => ({ ...prev, second: id }));
            } else if (!reportPlacements.third) {
              setReportPlacements((prev) => ({ ...prev, third: id }));
            }
          };

          const getSlotForUma = (umaId: string): number | null => {
            if (reportPlacements.first === umaId) return 1;
            if (reportPlacements.second === umaId) return 2;
            if (reportPlacements.third === umaId) return 3;
            return null;
          };

          const slotColors: Record<number, string> = {
            1: "ring-yellow-500 bg-yellow-500/20",
            2: "ring-gray-400 bg-gray-400/20",
            3: "ring-amber-600 bg-amber-600/20",
          };

          const slotBadgeColors: Record<number, string> = {
            1: "bg-yellow-500 text-black",
            2: "bg-gray-400 text-black",
            3: "bg-amber-600 text-white",
          };

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gray-800 rounded-xl shadow-2xl p-5 lg:p-7 border-2 border-gray-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="mb-4">
                  <h2 className="text-xl lg:text-2xl font-bold text-gray-100 mb-1">
                    Report Race {reportRaceIndex + 1}
                  </h2>
                  {raceMap && (
                    <p className="text-sm text-gray-400">
                      {raceMap.map.track} {raceMap.map.distance}m (
                      {raceMap.map.surface})
                      {raceMap.map.conditions && (
                        <span className="ml-1 text-gray-500">
                          — {raceMap.map.conditions.season} /{" "}
                          {raceMap.map.conditions.ground} /{" "}
                          {raceMap.map.conditions.weather}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Placement Slots */}
                <div className="flex gap-3 mb-5">
                  {positionSlots.map(({ key, label, points, color, bg }) => {
                    const selectedUma = reportPlacements[key]
                      ? allDraftedUmas.find(
                          (u) => u.id.toString() === reportPlacements[key],
                        )
                      : null;
                    return (
                      <div
                        key={key}
                        className={`flex-1 rounded-lg border-2 border-dashed p-2 text-center transition-all ${
                          selectedUma
                            ? `border-solid ${key === "first" ? "border-yellow-500/60" : key === "second" ? "border-gray-400/60" : "border-amber-600/60"} bg-gray-700/60`
                            : "border-gray-600/40 bg-gray-900/30"
                        }`}
                      >
                        <div className={`text-xs font-bold ${color} mb-1`}>
                          {label}
                          {SCORING_MODE === "points" && (
                            <span className="text-gray-500 font-normal ml-1">
                              ({points} pts)
                            </span>
                          )}
                        </div>
                        {selectedUma ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-600 bg-gray-700">
                              {selectedUma.imageUrl && (
                                <img
                                  src={selectedUma.imageUrl}
                                  alt={selectedUma.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <span className="text-[10px] text-gray-200 leading-tight text-center">
                              {selectedUma.name}
                            </span>
                            <span
                              className={`text-[9px] ${selectedUma.team === "team1" ? "text-blue-400" : "text-red-400"}`}
                            >
                              {selectedUma.team === "team1"
                                ? team1Name
                                : team2Name}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`w-10 h-10 mx-auto rounded-lg border-2 border-dashed border-gray-600/40 ${bg} flex items-center justify-center`}
                          >
                            <span className="text-gray-600 text-lg">?</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Instruction */}
                <p className="text-xs text-gray-500 text-center mb-3">
                  Click a character to assign them to the next open placement
                  slot. Click again to remove.
                </p>

                {/* Team Grids */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Team 1 */}
                  <div className="bg-gray-900/60 rounded-lg p-3 border border-blue-500/20">
                    <h3 className="text-blue-400 font-bold text-xs uppercase tracking-wider mb-2 text-center">
                      {team1Name}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {draftState.team1.pickedUmas.map((uma) => {
                        const slot = getSlotForUma(uma.id.toString());
                        const isSelected = slot !== null;
                        return (
                          <button
                            key={uma.id}
                            onClick={() => handleUmaClick(uma.id.toString())}
                            className={`relative flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all cursor-pointer ${
                              isSelected
                                ? `ring-2 ${slotColors[slot!]}`
                                : "hover:bg-gray-700/60 bg-gray-800/40"
                            }`}
                          >
                            {isSelected && (
                              <div
                                className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full ${slotBadgeColors[slot!]} text-[10px] font-bold flex items-center justify-center z-10`}
                              >
                                {slot}
                              </div>
                            )}
                            <div
                              className={`w-12 h-12 lg:w-14 lg:h-14 rounded-lg overflow-hidden border-2 bg-gray-700 transition-all ${
                                isSelected
                                  ? "border-blue-400/60"
                                  : "border-blue-500/30"
                              } ${!isSelected && selectedIds.length >= 3 ? "opacity-40" : ""}`}
                            >
                              {uma.imageUrl ? (
                                <img
                                  src={uma.imageUrl}
                                  alt={uma.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                  ?
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] lg:text-[10px] text-gray-300 text-center leading-tight">
                              {uma.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Team 2 */}
                  <div className="bg-gray-900/60 rounded-lg p-3 border border-red-500/20">
                    <h3 className="text-red-400 font-bold text-xs uppercase tracking-wider mb-2 text-center">
                      {team2Name}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {draftState.team2.pickedUmas.map((uma) => {
                        const slot = getSlotForUma(uma.id.toString());
                        const isSelected = slot !== null;
                        return (
                          <button
                            key={uma.id}
                            onClick={() => handleUmaClick(uma.id.toString())}
                            className={`relative flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all cursor-pointer ${
                              isSelected
                                ? `ring-2 ${slotColors[slot!]}`
                                : "hover:bg-gray-700/60 bg-gray-800/40"
                            }`}
                          >
                            {isSelected && (
                              <div
                                className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full ${slotBadgeColors[slot!]} text-[10px] font-bold flex items-center justify-center z-10`}
                              >
                                {slot}
                              </div>
                            )}
                            <div
                              className={`w-12 h-12 lg:w-14 lg:h-14 rounded-lg overflow-hidden border-2 bg-gray-700 transition-all ${
                                isSelected
                                  ? "border-red-400/60"
                                  : "border-red-500/30"
                              } ${!isSelected && selectedIds.length >= 3 ? "opacity-40" : ""}`}
                            >
                              {uma.imageUrl ? (
                                <img
                                  src={uma.imageUrl}
                                  alt={uma.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                  ?
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] lg:text-[10px] text-gray-300 text-center leading-tight">
                              {uma.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowMatchReporting(false)}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitRaceReport}
                    disabled={
                      !reportPlacements.first ||
                      !reportPlacements.second ||
                      !reportPlacements.third
                    }
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm"
                  >
                    {isMultiplayer
                      ? "Submit for Confirmation"
                      : "Confirm Result"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
