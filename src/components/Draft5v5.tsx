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
import { saveDraftSession, clearDraftSession } from "../utils/sessionStorage";
import { formatRoomCode } from "../utils/roomCode";
import { roomExists } from "../services/firebaseRoom";
import DraftHeader from "./DraftHeader";
import TeamPanel from "./TeamPanel";
import UmaCard from "./UmaCard";
import MapCard from "./MapCard";
import SpectatorView from "./SpectatorView";
import WaitingRoom from "./WaitingRoom";
import PhaseAnnouncement from "./PhaseAnnouncement";
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

// ─── Match Result Types ──────────────────────────────────────────────
interface RacePlacement {
  position: 1 | 2 | 3;
  umaId: string;
  umaName: string;
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
  } = useFirebaseRoom();

  // Use Firebase room code, or fallback to config for joiners
  const roomCode = firebaseRoomCode || multiplayerConfig?.roomCode || "";

  // Guard against double room creation (React 18 StrictMode)
  const roomSetupAttempted = useRef(false);

  const [draftState, setDraftState] = useState<DraftState>(() => {
    const initialState = getInitialDraftState();

    // Add multiplayer state if in multiplayer mode
    if (isMultiplayer && multiplayerConfig) {
      // All multiplayer players start in lobby phase (waiting room)
      initialState.phase = "lobby";
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
      };
    }

    return initialState;
  });
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

  // Pending selection state for lock-in system
  const [pendingUma, setPendingUma] = useState<UmaMusume | null>(null);
  const [pendingMap, setPendingMap] = useState<Map | null>(null);

  // Ready-up timer (5 minutes = 300 seconds)
  const [readyUpTime, setReadyUpTime] = useState<number>(300);

  // Match reporting state
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

  const isUmaPhase =
    draftState.phase === "uma-pick" ||
    draftState.phase === "uma-ban" ||
    draftState.phase === "uma-pre-ban";
  const isComplete = draftState.phase === "complete";

  // Clear session when draft completes
  useEffect(() => {
    if (isComplete && isMultiplayer) {
      clearDraftSession();
    }
  }, [isComplete, isMultiplayer]);

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

  // Timer authority: you control timer when it's your turn (or always in local mode)
  const isTimerAuthority =
    !isMultiplayer || draftState.currentTeam === localTeam;

  // Handle turn timeout - lock in pending selection or make random selection
  const handleTurnTimeout = useCallback(() => {
    console.log("Turn timeout triggered, current phase:", draftState.phase);

    // Determine if we're in a uma or map phase
    const isUmaPhaseNow =
      draftState.phase === "uma-pick" ||
      draftState.phase === "uma-ban" ||
      draftState.phase === "uma-pre-ban";
    const isMapPhaseNow =
      draftState.phase === "map-pick" || draftState.phase === "map-ban";

    // Helper to handle local state update (for host or non-multiplayer)
    const updateLocalState = (
      newState: DraftState,
      clearTrack: boolean = false,
    ) => {
      if (newState !== draftState) {
        if (isMultiplayer && isHost) {
          syncUpdateDraftState(newState);
        }
        setDraftState(newState);
        setHistory((prev) => [...prev, newState]);
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
      if (isMultiplayer && !isHost) {
        // Non-host sends action to Firebase
        sendAction(
          pendingUma.id.toString(),
          "uma",
          draftState.phase === "uma-pick" ? "pick" : "ban",
        );
      } else {
        const newState = selectUma(draftState, pendingUma);
        updateLocalState(newState);
      }
      setPendingUma(null);
      return;
    }

    if (pendingMap && isMapPhaseNow) {
      console.log("Locking in pending map:", pendingMap.name);
      if (isMultiplayer && !isHost) {
        // Non-host sends action to Firebase
        sendAction(
          pendingMap.name,
          "map",
          draftState.phase === "map-pick" ? "pick" : "ban",
        );
      } else {
        const mapWithConditions: Map = {
          ...pendingMap,
          conditions: pendingMap.conditions || generateTrackConditions(),
        };
        const newState = selectMap(draftState, mapWithConditions);
        updateLocalState(newState, true);
      }
      setPendingMap(null);
      return;
    }

    // No pending selection - make random selection
    console.log("No pending selection, making random selection");

    const selection = getRandomTimeoutSelection(draftState);
    if (!selection) {
      console.warn("No valid random selection available for timeout");
      return;
    }

    console.log("Auto-selecting:", selection.type, selection.item);

    if (selection.type === "uma") {
      const uma = selection.item as UmaMusume;
      if (isMultiplayer && !isHost) {
        // Non-host sends action to Firebase
        sendAction(
          uma.id.toString(),
          "uma",
          draftState.phase === "uma-pick" ? "pick" : "ban",
        );
      } else {
        const newState = selectUma(draftState, uma);
        updateLocalState(newState);
      }
    } else {
      const map = selection.item as Map;
      if (isMultiplayer && !isHost) {
        // Non-host sends action to Firebase
        sendAction(
          map.name,
          "map",
          draftState.phase === "map-pick" ? "pick" : "ban",
        );
      } else {
        // Add conditions for picked maps
        const mapWithConditions: Map = {
          ...map,
          conditions: map.conditions || generateTrackConditions(),
        };
        const newState = selectMap(draftState, mapWithConditions);
        updateLocalState(newState, true);
      }
    }
  }, [
    draftState,
    isMultiplayer,
    isHost,
    syncUpdateDraftState,
    sendDraftAction,
    pendingUma,
    pendingMap,
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

  // Turn timer hook
  const { timeRemaining } = useTurnTimer({
    duration: DEFAULT_TURN_DURATION,
    enabled: true,
    onTimeout: handleTurnTimeout,
    phase: draftState.phase,
    currentTurnKey: `${draftState.phase}-${draftState.currentTeam}-${totalPicks}`,
    isTimerAuthority,
  });

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
                return; // Successfully reconnected
              }
              // Failed to reconnect (e.g., UID changed) - clear session and create new room
              console.warn(
                "Failed to rejoin room as host, creating new room:",
                result.error,
              );
              clearDraftSession();
            }
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
          }
        }
      } catch (err) {
        console.error("Failed to setup room:", err);
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
      // Preserve local multiplayer settings when syncing
      setDraftState((prevState) => {
        const localTeam =
          prevState.multiplayer?.localTeam ||
          (multiplayerConfig?.isHost ? "team1" : "team2");
        const connectionType =
          prevState.multiplayer?.connectionType ||
          (multiplayerConfig?.isHost
            ? "host"
            : multiplayerConfig?.isSpectator
              ? "spectator"
              : "player");

        // If user has acknowledged wildcard, don't let sync revert to wildcard-reveal phase
        // They should stay at map-pick until they receive actual draft updates
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

        console.log("[SYNC EFFECT] Returning state", {
          prevState_localTeam: prevState.multiplayer?.localTeam,
          computed_localTeam: localTeam,
          computed_connectionType: connectionType,
          phase,
          syncedCurrentTeam: syncedDraftState.currentTeam,
        });

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
          },
        };
      });

      // Also update local team name state from synced multiplayer state
      if (syncedDraftState.multiplayer?.team1Name) {
        setTeam1Name(syncedDraftState.multiplayer.team1Name);
      }
      if (syncedDraftState.multiplayer?.team2Name) {
        setTeam2Name(syncedDraftState.multiplayer.team2Name);
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

      // Sync pending match report from host to team 2
      const synced = syncedDraftState as DraftState & {
        pendingMatchReport?: {
          raceIndex: number;
          placements: RacePlacement[];
          submissionId?: number;
        };
      };
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
  useEffect(() => {
    if (!isMultiplayer || !isHost) return;

    // Set up handler for pending actions from Firebase
    const handlePendingAction = (pendingAction: FirebasePendingAction) => {
      const action = pendingAction.action;
      const senderId = pendingAction.senderId;

      console.log("Host received action from client:", action, senderId);
      console.log(
        "Current phase:",
        draftState.phase,
        "Current team:",
        draftState.currentTeam,
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
            ...draftState,
            multiplayer: {
              ...draftState.multiplayer,
              enabled: true,
              connectionType: draftState.multiplayer?.connectionType || "host",
              localTeam: draftState.multiplayer?.localTeam || "team1",
              roomId: draftState.multiplayer?.roomId || "",
              team1Name:
                team === "team1"
                  ? name
                  : draftState.multiplayer?.team1Name || team1Name,
              team2Name:
                team === "team2"
                  ? name
                  : draftState.multiplayer?.team2Name || team2Name,
            },
          };
          syncUpdateDraftState(newState);
          setDraftState(newState);
          return;
        }

        // Handle ready action
        if (action.action === "ready") {
          const team = action.itemId as "team1" | "team2";
          const newState = {
            ...draftState,
            [team === "team1" ? "team1Ready" : "team2Ready"]: true,
          };
          syncUpdateDraftState(newState);
          setDraftState(newState);
          return;
        }

        // Handle match result confirmation from team 2
        if (action.action === "match-confirm") {
          // Parse the result data sent by team 2 (no need to look up local state)
          try {
            const confirmed: RaceResult = JSON.parse(action.itemId);
            // Deduplicate: only add if this raceIndex hasn't been recorded yet
            setMatchResults((results) => {
              if (results.some((r) => r.raceIndex === confirmed.raceIndex)) {
                return results;
              }
              return [...results, confirmed];
            });
          } catch (e) {
            console.error("Failed to parse match-confirm data:", e);
          }
          setPendingReport(null);
          pendingReportRef.current = null;
          // Clear pending report from synced state using functional updater
          // to avoid stale draftState closure
          setDraftState((current) => {
            const cleared = {
              ...current,
              pendingMatchReport: null,
            } as DraftState;
            syncUpdateDraftState(cleared);
            return current;
          });
          return;
        }

        // Handle match result rejection from team 2
        if (action.action === "match-reject") {
          setPendingReport(null);
          pendingReportRef.current = null;
          // Clear pending report from synced state
          setDraftState((current) => {
            const cleared = {
              ...current,
              pendingMatchReport: null,
            } as DraftState;
            syncUpdateDraftState(cleared);
            return current;
          });
          return;
        }

        if (
          action.phase === "map-pick" &&
          draftState.phase === "pre-draft-pause"
        ) {
          const newState = {
            ...draftState,
            phase: "map-pick" as const,
            currentTeam: "team1" as const,
            team1Ready: false,
            team2Ready: false,
          };
          syncUpdateDraftState(newState);
          setDraftState(newState);
          setHistory((prev) => [...prev, newState]);
          return;
        } else if (
          action.phase === "uma-pre-ban" &&
          draftState.phase === "post-map-pause"
        ) {
          const newState = {
            ...draftState,
            phase: "uma-pre-ban" as const,
            currentTeam: "team1" as const,
            team1Ready: false,
            team2Ready: false,
          };
          syncUpdateDraftState(newState);
          setDraftState(newState);
          setHistory((prev) => [...prev, newState]);
          return;
        }
      }

      // Process the action based on type
      if (action.itemType === "map") {
        // Find the map - during ban phase it's in opponent's picked maps, during pick phase it's in available maps
        let map: Map | undefined;
        if (draftState.phase === "map-ban") {
          // During ban phase, look in the opponent's picked maps
          const opponentTeam =
            draftState.currentTeam === "team1" ? "team2" : "team1";
          map = draftState[opponentTeam].pickedMaps.find(
            (m) => m.name === action.itemId,
          );
        } else {
          // During pick phase, look in available maps
          map = draftState.availableMaps.find((m) => m.name === action.itemId);
        }
        console.log(
          "Looking for map:",
          action.itemId,
          "Phase:",
          draftState.phase,
          "Found:",
          !!map,
        );
        if (map) {
          // Apply the action
          const mapWithConditions: Map = {
            ...map,
            conditions: map.conditions || generateTrackConditions(),
          };
          const newState = selectMap(draftState, mapWithConditions);
          console.log(
            "State changed:",
            newState !== draftState,
            "New phase:",
            newState.phase,
          );
          if (newState !== draftState) {
            syncUpdateDraftState(newState);
            setDraftState(newState);
            setHistory((prev) => [...prev, newState]);
          }
        } else {
          console.error(
            "Map not found:",
            action.itemId,
            "Phase:",
            draftState.phase,
          );
          if (draftState.phase === "map-ban") {
            const opponentTeam =
              draftState.currentTeam === "team1" ? "team2" : "team1";
            console.log(
              "Opponent picked maps:",
              draftState[opponentTeam].pickedMaps.map((m) => m.name),
            );
          } else {
            console.log(
              "Available maps:",
              draftState.availableMaps.map((m) => m.name),
            );
          }
        }
      } else if (action.itemType === "uma") {
        // Find the uma - during ban phase it's in opponent's picked umas, during pick phase it's in available umas
        let uma: UmaMusume | undefined;
        if (draftState.phase === "uma-ban") {
          // During ban phase, look in the opponent's picked umas
          const opponentTeam =
            draftState.currentTeam === "team1" ? "team2" : "team1";
          uma = draftState[opponentTeam].pickedUmas.find(
            (u) => u.id.toString() === action.itemId,
          );
        } else {
          // During pick phase, look in available umas
          uma = draftState.availableUmas.find(
            (u) => u.id.toString() === action.itemId,
          );
        }
        console.log(
          "Looking for uma:",
          action.itemId,
          "Phase:",
          draftState.phase,
          "Found:",
          !!uma,
        );
        if (uma) {
          const newState = selectUma(draftState, uma);
          console.log(
            "State changed:",
            newState !== draftState,
            "New phase:",
            newState.phase,
          );
          if (newState !== draftState) {
            syncUpdateDraftState(newState);
            setDraftState(newState);
            setHistory((prev) => [...prev, newState]);
          }
        } else {
          console.error(
            "Uma not found:",
            action.itemId,
            "Phase:",
            draftState.phase,
          );
          if (draftState.phase === "uma-ban") {
            const opponentTeam =
              draftState.currentTeam === "team1" ? "team2" : "team1";
            console.log(
              "Opponent picked umas:",
              draftState[opponentTeam].pickedUmas.map((u) => u.id),
            );
          } else {
            console.log(
              "Available umas count:",
              draftState.availableUmas.length,
            );
          }
        }
      }
    };

    setPendingActionHandler(handlePendingAction);

    return () => {
      setPendingActionHandler(null);
    };
  }, [
    isMultiplayer,
    isHost,
    setPendingActionHandler,
    draftState,
    syncUpdateDraftState,
  ]);

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
      if (isMultiplayer && isHost) {
        // Host broadcasts state to all peers and updates local state
        syncUpdateDraftState(newState);
        setDraftState(newState);
        setHistory([...history, newState]);
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
        syncUpdateDraftState(newState);
        setDraftState(newState);
        setHistory([...history, newState]);
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
        syncUpdateDraftState(newState);
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
      syncUpdateDraftState(newState);
      setDraftState(newState);
    } else if (isMultiplayer) {
      // Non-host sends ready action to host
      sendDraftAction({
        action: "ready",
        itemType: "control",
        itemId: localTeam,
      });
      // Optimistic update
      setDraftState((prev) => ({
        ...prev,
        [localTeam === "team1" ? "team1Ready" : "team2Ready"]: true,
      }));
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
      syncUpdateDraftState(newState);
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
      syncUpdateDraftState(newState);
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
        syncUpdateDraftState(newState);
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
      syncUpdateDraftState(newState);
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
        team: first.team,
      },
      {
        position: 2,
        umaId: second.id.toString(),
        umaName: second.name,
        team: second.team,
      },
      {
        position: 3,
        umaId: third.id.toString(),
        umaName: third.name,
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
      syncUpdateDraftState({
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
    const umas = getBannableUmas();
    if (!umaSearch.trim()) return umas;
    return umas.filter((uma) =>
      uma.name.toLowerCase().includes(umaSearch.toLowerCase()),
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
      if (totalBanned > 0) {
        return totalPicked - totalBanned;
      }
      return totalPicked;
    }
    if (phase === "uma-ban") {
      return (t1.bannedUmas?.length || 0) + (t2.bannedUmas?.length || 0);
    }
    return 0;
  })();

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
          showMapOrder={
            draftState.phase === "post-map-pause" ||
            draftState.phase === "uma-pick" ||
            draftState.phase === "uma-ban" ||
            draftState.phase === "uma-pre-ban" ||
            draftState.phase === "complete"
          }
          ghostSelection={
            isMultiplayer ? (pendingSelections.team1 ?? null) : null
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
                      "Ban Opponent's Umamusume"}
                    {draftState.phase === "map-pick" &&
                      !selectedTrack &&
                      "Select a Racecourse"}
                    {draftState.phase === "map-pick" &&
                      selectedTrack &&
                      `Select Distance - ${selectedTrack}`}
                    {draftState.phase === "map-ban" && "Ban Opponent's Map"}
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
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
                      {team1Name}
                    </p>
                    <p className="text-3xl lg:text-4xl font-bold text-blue-400 font-mono">
                      {SCORING_MODE === "points"
                        ? scores.team1Points
                        : scores.team1Wins}
                    </p>
                  </div>
                  <div className="text-center">
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
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
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
                                {p.umaName}
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
                <div className="mb-4 bg-yellow-900/30 border border-yellow-600/40 rounded-lg p-3 lg:p-4">
                  <h3 className="text-yellow-400 font-bold text-sm mb-2 text-center">
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
                          : {p.umaName}
                          <span
                            className={`ml-1 text-xs ${p.team === "team1" ? "text-blue-400" : "text-red-400"}`}
                          >
                            ({p.team === "team1" ? team1Name : team2Name})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
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
                <div className="mb-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 text-center">
                  <p className="text-yellow-400 text-sm">
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
                      <span className="text-[9px] text-orange-400/70 uppercase">
                        Pre-Banned:{" "}
                      </span>
                      <span className="text-[9px] text-gray-500">
                        {draftState.team1.preBannedUmas
                          .map((u) => u.name)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {draftState.team1.bannedUmas.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-gray-700/50">
                      <span className="text-[9px] text-red-400/70 uppercase">
                        Banned:{" "}
                      </span>
                      <span className="text-[9px] text-gray-500">
                        {draftState.team1.bannedUmas
                          .map((u) => u.name)
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
                      <span className="text-[9px] text-orange-400/70 uppercase">
                        Pre-Banned:{" "}
                      </span>
                      <span className="text-[9px] text-gray-500">
                        {draftState.team2.preBannedUmas
                          .map((u) => u.name)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {draftState.team2.bannedUmas.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-gray-700/50">
                      <span className="text-[9px] text-red-400/70 uppercase">
                        Banned:{" "}
                      </span>
                      <span className="text-[9px] text-gray-500">
                        {draftState.team2.bannedUmas
                          .map((u) => u.name)
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
                    const t1Maps = draftState.team1.pickedMaps;
                    const t2Maps = draftState.team2.pickedMaps;
                    // Interleave: T1 pick 1, T2 pick 1, T1 pick 2, T2 pick 2, etc.
                    const schedule: {
                      map: Map;
                      team: string;
                      index: number;
                    }[] = [];
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
                    return schedule.map((s) => (
                      <div
                        key={s.index}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/40 rounded-lg text-sm"
                      >
                        <span className="text-gray-500 font-mono text-xs w-5">
                          {s.index}.
                        </span>
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${s.team === team1Name ? "bg-blue-500" : "bg-red-500"}`}
                        />
                        <span className="text-gray-200 font-medium">
                          {s.map.track}
                        </span>
                        <span className="text-gray-500">{s.map.distance}m</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${s.map.surface?.toLowerCase() === "turf" ? "bg-green-900/40 text-green-400" : "bg-amber-900/40 text-amber-400"}`}
                        >
                          {s.map.surface}
                        </span>
                        {s.map.conditions && (
                          <span className="text-gray-500 text-xs ml-auto">
                            {s.map.conditions.season} /{" "}
                            {s.map.conditions.ground} /{" "}
                            {s.map.conditions.weather}
                          </span>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Tiebreaker */}
              <div className="bg-gray-900/40 rounded-lg p-3 lg:p-4 border border-gray-700/40 text-center">
                <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-2">
                  Tiebreaker Map
                </h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="w-16 h-10 rounded overflow-hidden bg-gray-700">
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
                  <div className="text-left">
                    <span className="text-white font-bold text-sm">
                      {draftState.wildcardMap.track}
                    </span>
                    <span className="text-gray-400 text-xs ml-2">
                      {draftState.wildcardMap.distance}m
                    </span>
                    <span
                      className={`text-xs ml-2 ${draftState.wildcardMap.surface?.toLowerCase() === "turf" ? "text-green-400" : "text-amber-400"}`}
                    >
                      {draftState.wildcardMap.surface}
                    </span>
                    {draftState.wildcardMap.conditions && (
                      <span className="text-gray-500 text-xs ml-2">
                        {draftState.wildcardMap.conditions.season} /{" "}
                        {draftState.wildcardMap.conditions.ground} /{" "}
                        {draftState.wildcardMap.conditions.weather}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Copy Results & Match Reporting Buttons */}
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={() => {
                    const t1Umas = draftState.team1.pickedUmas
                      .map((u) => u.name)
                      .join(", ");
                    const t2Umas = draftState.team2.pickedUmas
                      .map((u) => u.name)
                      .join(", ");
                    const t1PreBans = (draftState.team1.preBannedUmas || [])
                      .map((u) => u.name)
                      .join(", ");
                    const t2PreBans = (draftState.team2.preBannedUmas || [])
                      .map((u) => u.name)
                      .join(", ");
                    const t1Bans = draftState.team1.bannedUmas
                      .map((u) => u.name)
                      .join(", ");
                    const t2Bans = draftState.team2.bannedUmas
                      .map((u) => u.name)
                      .join(", ");
                    const formatConditions = (m: Map) =>
                      m.conditions
                        ? ` [${m.conditions.season} / ${m.conditions.weather} / ${m.conditions.ground}]`
                        : "";
                    const maps = [
                      ...draftState.team1.pickedMaps,
                      ...draftState.team2.pickedMaps,
                    ]
                      .map(
                        (m, i) =>
                          `${i + 1}. ${m.track} ${m.distance}m (${m.surface})${formatConditions(m)}`,
                      )
                      .join("\n");
                    const wcConditions = formatConditions(
                      draftState.wildcardMap,
                    );
                    const text = `=== DRAFT RESULTS ===\n\n${team1Name}: ${t1Umas}\nPre-Banned: ${t1PreBans || "None"}\nBanned: ${t1Bans || "None"}\n\n${team2Name}: ${t2Umas}\nPre-Banned: ${t2PreBans || "None"}\nBanned: ${t2Bans || "None"}\n\nMap Schedule:\n${maps}\n\nTiebreaker: ${draftState.wildcardMap.track} ${draftState.wildcardMap.distance}m (${draftState.wildcardMap.surface})${wcConditions}`;
                    navigator.clipboard.writeText(text);
                  }}
                  className="bg-gray-700/80 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600/50 text-sm"
                >
                  Copy Draft Results
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
                    className="bg-purple-600/80 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors border border-purple-500/50 disabled:border-gray-600 text-sm"
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
                        : `Report Race ${nextRaceIndex + 1}`}
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
            const isBanPhase =
              draftState.phase === "uma-ban" ||
              draftState.phase === "map-ban" ||
              draftState.phase === "uma-pre-ban";

            return (
              <div className="shrink-0 py-3 lg:py-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700/50">
                <div className="flex flex-col items-center gap-1">
                  {(() => {
                    const label = isBanPhase ? "BAN" : "LOCK IN";
                    const glowClass = isBanPhase
                      ? "ban-btn-glow"
                      : "lockin-btn-glow";
                    const bgClass = isBanPhase
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700";
                    return (
                      <>
                        <button
                          onClick={isMyTurn ? handleLockIn : undefined}
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
          showMapOrder={
            draftState.phase === "post-map-pause" ||
            draftState.phase === "uma-pick" ||
            draftState.phase === "uma-ban" ||
            draftState.phase === "uma-pre-ban" ||
            draftState.phase === "complete"
          }
          ghostSelection={
            isMultiplayer ? (pendingSelections.team2 ?? null) : null
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
      {showMatchReporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-4 lg:p-6 xl:p-8 border-2 border-gray-700 max-w-lg w-full">
            <h2 className="text-xl lg:text-2xl font-bold text-gray-100 mb-1 lg:mb-2">
              Report Race {reportRaceIndex + 1}
            </h2>
            {(() => {
              const schedule = getMapSchedule();
              const raceMap = schedule[reportRaceIndex];
              if (!raceMap) return null;
              return (
                <p className="text-sm text-gray-400 mb-4">
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
              );
            })()}

            <div className="space-y-3 mb-6">
              {[
                {
                  label: "1st Place",
                  key: "first" as const,
                  points: POINT_VALUES[1],
                },
                {
                  label: "2nd Place",
                  key: "second" as const,
                  points: POINT_VALUES[2],
                },
                {
                  label: "3rd Place",
                  key: "third" as const,
                  points: POINT_VALUES[3],
                },
              ].map(({ label, key, points }) => {
                // Filter out already-selected umas from other positions
                const selectedIds = Object.entries(reportPlacements)
                  .filter(([k]) => k !== key)
                  .map(([, v]) => v)
                  .filter(Boolean);

                return (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      {label}{" "}
                      {SCORING_MODE === "points" && (
                        <span className="text-gray-500">({points} pts)</span>
                      )}
                    </label>
                    <select
                      value={reportPlacements[key]}
                      onChange={(e) =>
                        setReportPlacements((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select Uma...</option>
                      {allDraftedUmas
                        .filter((u) => !selectedIds.includes(u.id.toString()))
                        .map((u) => (
                          <option key={u.id} value={u.id.toString()}>
                            {u.name} (
                            {u.team === "team1" ? team1Name : team2Name})
                          </option>
                        ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowMatchReporting(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-1.5 px-6 rounded-lg transition-colors border border-gray-600 text-sm"
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
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-1.5 px-6 rounded-lg transition-colors text-sm"
              >
                {isMultiplayer ? "Submit for Confirmation" : "Confirm Result"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
