import { useState, useEffect, useCallback } from "react";
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
import DraftHeader from "./DraftHeader";
import TeamPanel from "./TeamPanel";
import UmaCard from "./UmaCard";
import MapCard from "./MapCard";
import SpectatorView from "./SpectatorView";
import WaitingRoom from "./WaitingRoom";
import { usePeer } from "../hooks/usePeer";
import { useRoom } from "../hooks/useRoom";
import { useMultiplayerConnections } from "../hooks/useMultiplayerConnections";
import { useDraftSync } from "../hooks/useDraftSync";
import { useTurnTimer, DEFAULT_TURN_DURATION } from "../hooks/useTurnTimer";
import { generateRoomCode } from "../utils/roomCode";

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
  const { peer, peerId, status, initialize } = usePeer();
  const {
    roomState,
    isHost,
    createRoom,
    joinRoom,
    onRoomMessage,
    sendToHost,
    updateRoomDraftState,
    getAllConnections,
  } = useRoom(peer, peerId);
  const { onConnectionEvent } = useMultiplayerConnections();
  const {
    draftState: syncedDraftState,
    updateDraftState: syncUpdateDraftState,
    sendDraftAction,
    onDraftAction,
  } = useDraftSync(
    roomState,
    isHost,
    getAllConnections,
    peerId,
    onRoomMessage,
    sendToHost,
  );

  // Generate room code immediately for host
  const [localRoomCode] = useState<string>(() => {
    if (isMultiplayer && multiplayerConfig?.isHost) {
      return generateRoomCode();
    }
    return multiplayerConfig?.roomCode || "";
  });

  const [draftState, setDraftState] = useState<DraftState>(() => {
    const initialState = getInitialDraftState();

    // Add multiplayer state if in multiplayer mode
    if (isMultiplayer && multiplayerConfig) {
      // Non-host players start in lobby phase waiting for sync
      if (!multiplayerConfig.isHost) {
        initialState.phase = "lobby";
      }
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
  // For multiplayer guests/spectators, skip the team name modal (host controls names)
  const [showTeamNameModal, setShowTeamNameModal] = useState<boolean>(
    !multiplayerConfig || multiplayerConfig.isHost,
  );
  const [cyclingMap, setCyclingMap] = useState<Map | null>(null);
  const [revealStarted, setRevealStarted] = useState<boolean>(false);
  const [wildcardAcknowledged, setWildcardAcknowledged] =
    useState<boolean>(false);
  const [team1Name, setTeam1Name] = useState<string>("Team 1");
  const [team2Name, setTeam2Name] = useState<string>("Team 2");
  const [tempTeam1Name, setTempTeam1Name] = useState<string>("Team 1");
  const [tempTeam2Name, setTempTeam2Name] = useState<string>("Team 2");

  const isUmaPhase =
    draftState.phase === "uma-pick" || draftState.phase === "uma-ban";
  const isComplete = draftState.phase === "complete";

  // Timer authority: host controls timer in multiplayer, always in local mode
  const isTimerAuthority = !isMultiplayer || isHost;

  // Handle turn timeout - make random selection
  const handleTurnTimeout = useCallback(() => {
    console.log("Turn timeout triggered, current phase:", draftState.phase);

    const selection = getRandomTimeoutSelection(draftState);
    if (!selection) {
      console.warn("No valid random selection available for timeout");
      return;
    }

    console.log("Auto-selecting:", selection.type, selection.item);

    if (selection.type === "uma") {
      const uma = selection.item as UmaMusume;
      const newState = selectUma(draftState, uma);

      if (newState !== draftState) {
        if (isMultiplayer && isHost) {
          syncUpdateDraftState(newState);
        }
        setDraftState(newState);
        setHistory((prev) => [...prev, newState]);
      }
    } else {
      const map = selection.item as Map;
      // Add conditions for picked maps
      const mapWithConditions: Map = {
        ...map,
        conditions: map.conditions || generateTrackConditions(),
      };
      const newState = selectMap(draftState, mapWithConditions);

      if (newState !== draftState) {
        if (isMultiplayer && isHost) {
          syncUpdateDraftState(newState);
        }
        setDraftState(newState);
        setHistory((prev) => [...prev, newState]);
        setSelectedTrack(null);
      }
    }
  }, [draftState, isMultiplayer, isHost, syncUpdateDraftState]);

  // Calculate total picks for turn key - ensures timer resets after each pick in double-pick scenarios
  const totalPicks =
    draftState.phase === "uma-pick" || draftState.phase === "uma-ban"
      ? draftState.team1.pickedUmas.length +
        draftState.team2.pickedUmas.length +
        draftState.team1.bannedUmas.length +
        draftState.team2.bannedUmas.length
      : draftState.team1.pickedMaps.length +
        draftState.team2.pickedMaps.length +
        draftState.team1.bannedMaps.length +
        draftState.team2.bannedMaps.length;

  // Turn timer hook
  const { timeRemaining } = useTurnTimer({
    duration: DEFAULT_TURN_DURATION,
    enabled: true,
    onTimeout: handleTurnTimeout,
    phase: draftState.phase,
    currentTurnKey: `${draftState.phase}-${draftState.currentTeam}-${totalPicks}`,
    isTimerAuthority,
  });

  // Initialize multiplayer connection
  useEffect(() => {
    if (!isMultiplayer || !multiplayerConfig) return;

    let mounted = true;
    const initMultiplayer = async () => {
      try {
        if (mounted && multiplayerConfig.isHost) {
          // For host, use the pre-generated room code as peer ID
          await initialize(localRoomCode);
        } else if (mounted) {
          // For client/spectator, use random peer ID
          await initialize();
        }
      } catch (err) {
        console.error("Failed to initialize peer:", err);
      }
    };

    initMultiplayer();

    return () => {
      mounted = false;
    };
  }, [isMultiplayer, multiplayerConfig, initialize, localRoomCode]);

  // Create or join room once peer is ready
  useEffect(() => {
    if (!isMultiplayer || !multiplayerConfig || !peer) return;
    if (roomState) return; // Already in a room

    const setupRoom = async () => {
      try {
        if (multiplayerConfig.isHost) {
          // Pass the current draftState so the wildcard is shared with joining players
          await createRoom("5v5", draftState);
        } else if (!multiplayerConfig.isSpectator) {
          // Wait for connection for clients
          if (status !== "connected" || !peerId) return;
          await joinRoom(
            multiplayerConfig.roomCode,
            multiplayerConfig.playerName,
          );
        } else {
          // Wait for connection for spectators
          if (status !== "connected" || !peerId) return;
          await joinRoom(
            multiplayerConfig.roomCode,
            multiplayerConfig.playerName,
            true,
          );
        }
      } catch (err) {
        console.error("Failed to setup room:", err);
      }
    };

    setupRoom();
  }, [
    isMultiplayer,
    multiplayerConfig,
    peer,
    peerId,
    status,
    roomState,
    createRoom,
    joinRoom,
    draftState,
  ]);

  // Sync local draft state with network state in multiplayer mode
  useEffect(() => {
    if (
      isMultiplayer &&
      syncedDraftState &&
      syncedDraftState.wildcardMap?.track
    ) {
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

    const unsubscribe = onDraftAction((action, senderId) => {
      console.log("Host received action from client:", action, senderId);
      console.log(
        "Current phase:",
        draftState.phase,
        "Current team:",
        draftState.currentTeam,
      );

      // Handle control actions (phase transitions and ready state)
      if (action.itemType === "control") {
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
          action.phase === "uma-pick" &&
          draftState.phase === "post-map-pause"
        ) {
          const newState = {
            ...draftState,
            phase: "uma-pick" as const,
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
    });

    return unsubscribe;
  }, [isMultiplayer, isHost, onDraftAction, draftState, syncUpdateDraftState]);

  // Handle connection events (disconnections, errors)
  useEffect(() => {
    if (!isMultiplayer) return;

    const unsubscribe = onConnectionEvent((event) => {
      if (event.type === "disconnected") {
        console.log("Peer disconnected:", event.peerId);

        // Check if host disconnected
        if (roomState && event.peerId === roomState.hostId && !isHost) {
          // Host disconnected - show error and offer to return to menu
          const shouldReturn = window.confirm(
            "The host has disconnected. The draft session has ended. Return to menu?",
          );
          if (shouldReturn) {
            onBackToMenu();
          }
        }
      } else if (event.type === "error") {
        console.error("Connection error with peer:", event.peerId, event.error);
        // Could show a toast notification here
      }
    });

    return unsubscribe;
  }, [isMultiplayer, onConnectionEvent, roomState, isHost, onBackToMenu]);

  // Handle peer status changes
  useEffect(() => {
    if (!isMultiplayer) return;

    // Only log errors, not initial disconnected state
    if (status === "error") {
      console.error("Peer status error:", status);
    }
  }, [isMultiplayer, status]);

  const handleUmaSelect = (uma: UmaMusume) => {
    const team = draftState.currentTeam;

    // Use multiplayer-aware select function
    const newState = isMultiplayer
      ? selectUmaMultiplayer(draftState, uma, team)
      : selectUma(draftState, uma);

    // Only update if state changed (permission check passed)
    if (newState !== draftState) {
      if (isMultiplayer && isHost) {
        // Host broadcasts state to all peers and updates local state
        syncUpdateDraftState(newState);
        setDraftState(newState);
      } else if (isMultiplayer) {
        // Non-host sends action request to host (but update local optimistically)
        sendDraftAction({
          action: draftState.phase === "uma-pick" ? "pick" : "ban",
          itemId: uma.id.toString(),
          itemType: "uma",
        });
        setDraftState(newState);
      } else {
        // Local mode - just update state
        setDraftState(newState);
      }
      setHistory([...history, newState]);
    }
  };

  const handleMapSelect = (map: Map) => {
    const team = draftState.currentTeam;

    // Generate random track conditions
    const mapWithConditions: Map = {
      ...map,
      conditions: generateTrackConditions(),
    };

    // Use multiplayer-aware select function
    const newState = isMultiplayer
      ? selectMapMultiplayer(draftState, mapWithConditions, team)
      : selectMap(draftState, mapWithConditions);

    // Only update if state changed (permission check passed)
    if (newState !== draftState) {
      if (isMultiplayer && isHost) {
        // Host broadcasts state to all peers and updates local state
        syncUpdateDraftState(newState);
        setDraftState(newState);
      } else if (isMultiplayer) {
        // Non-host sends action request to host (but update local optimistically)
        sendDraftAction({
          action: draftState.phase === "map-pick" ? "pick" : "ban",
          itemId: map.name,
          itemType: "map",
        });
        setDraftState(newState);
      } else {
        // Local mode - just update state
        setDraftState(newState);
      }
      setHistory([...history, newState]);
      setSelectedTrack(null); // Reset track selection after picking
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
    setShowTeamNameModal(true);
    setRevealStarted(false);
    setCyclingMap(null);
  };

  const handleBackToMenu = () => {
    setShowMenuConfirm(true);
  };

  const confirmBackToMenu = () => {
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
        updateRoomDraftState(newState);
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
      updateRoomDraftState(newState);
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

  // Handle continuing to uma draft (from post-map-pause to uma-pick)
  const handleContinueToUma = () => {
    const newState = {
      ...draftState,
      phase: "uma-pick" as const,
      currentTeam: "team1" as const,
      team1Ready: false,
      team2Ready: false,
    };

    setDraftState(newState);

    // Sync to all clients in multiplayer
    if (isMultiplayer && isHost) {
      updateRoomDraftState(newState);
      syncUpdateDraftState(newState);
    } else if (isMultiplayer && !isHost) {
      // Non-host players send action to host
      sendDraftAction({
        action: "pick",
        itemType: "control",
        itemId: "continue-to-uma",
        phase: "uma-pick",
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

    // For multiplayer, go to lobby phase and wait for players
    // For local, show wildcard modal immediately
    if (isMultiplayer) {
      const newState: DraftState = {
        ...draftState,
        phase: "lobby" as const,
        multiplayer: {
          ...draftState.multiplayer,
          enabled: true,
          connectionType: draftState.multiplayer?.connectionType || "host",
          localTeam: draftState.multiplayer?.localTeam || "team1",
          roomId: draftState.multiplayer?.roomId || "",
          team1Name: name1,
          team2Name: name2,
        },
      };
      setDraftState(newState);
      // Update room state so new joiners get correct phase
      updateRoomDraftState(newState);
      // Sync to any players already in room
      syncUpdateDraftState(newState);
    } else {
      setShowWildcardModal(true);
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
      updateRoomDraftState(newState);
      syncUpdateDraftState(newState);
    }

    // Start the reveal animation
    setShowWildcardModal(true);
  };

  // Get opponent's picked items for ban phase
  const getOpponentTeam = () => {
    return draftState.currentTeam === "team1" ? "team2" : "team1";
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

  // Waiting room view for multiplayer lobby phase
  if (isMultiplayer && draftState.phase === "lobby") {
    const playerCount =
      (roomState?.connections.filter((c) => c.type === "player").length || 0) +
      1; // +1 for host
    const spectatorCount =
      roomState?.connections.filter((c) => c.type === "spectator").length || 0;

    return (
      <WaitingRoom
        roomCode={localRoomCode || roomState?.roomId || ""}
        team1Name={team1Name}
        team2Name={team2Name}
        isHost={multiplayerConfig?.isHost || false}
        playerCount={playerCount}
        spectatorCount={spectatorCount}
        onStartDraft={handleStartDraft}
        onLeave={onBackToMenu}
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
        connectionStatus={status}
        onBackToMenu={onBackToMenu}
        timeRemaining={timeRemaining}
      />
    );
  }

  return (
    <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex gap-2 lg:gap-4 px-2 lg:px-4 xl:px-6 py-2 lg:py-4 xl:py-6 overflow-hidden">
      <div className="w-56 lg:w-72 xl:w-96 shrink-0 flex flex-col px-1 lg:px-2 min-h-0">
        <TeamPanel
          team="team1"
          teamName={team1Name}
          pickedUmas={draftState.team1.pickedUmas}
          bannedUmas={draftState.team1.bannedUmas}
          pickedMaps={draftState.team1.pickedMaps}
          bannedMaps={draftState.team1.bannedMaps}
          isCurrentTurn={
            draftState.phase !== "complete" &&
            draftState.currentTeam === "team1"
          }
          distanceCounts={countDistances(draftState.team1.pickedMaps)}
          dirtCount={countDirtTracks(draftState.team1.pickedMaps)}
          showMapOrder={
            draftState.phase === "post-map-pause" ||
            draftState.phase === "uma-pick" ||
            draftState.phase === "uma-ban" ||
            draftState.phase === "complete"
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
            connectionStatus={status}
            roomCode={localRoomCode || roomState?.roomId}
            playerCount={
              (roomState?.connections.filter((c) => c.type === "player")
                .length || 0) + 1
            }
            isHost={multiplayerConfig?.isHost || false}
            timeRemaining={timeRemaining}
            timerEnabled={true}
          />
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {/* Pre-draft pause phase (before starting map draft) */}
          {draftState.phase === "pre-draft-pause" && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 lg:p-8 xl:p-10 text-center border border-gray-700">
              <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-100 mb-4 lg:mb-6">
                Ready to Start Draft?
              </h2>
              <p className="text-base lg:text-lg xl:text-xl text-gray-300 mb-6 lg:mb-8">
                Take your time to discuss strategy with your team.
              </p>
              <p className="text-sm lg:text-base text-gray-400 mb-6 lg:mb-8">
                The draft will begin with map selection when you're ready.
              </p>

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
                        {draftState.team1Ready ? "✓ Ready" : "Not Ready"}
                      </p>
                    </div>
                    <div
                      className={`px-6 py-3 rounded-lg border-2 ${draftState.team2Ready ? "border-green-500 bg-green-900/30" : "border-gray-600 bg-gray-700/50"}`}
                    >
                      <p className="text-sm text-gray-400 mb-1">{team2Name}</p>
                      <p
                        className={`font-bold ${draftState.team2Ready ? "text-green-400" : "text-gray-500"}`}
                      >
                        {draftState.team2Ready ? "✓ Ready" : "Not Ready"}
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
              <p className="text-sm lg:text-base text-gray-400 mb-6 lg:mb-8">
                The draft will continue with Uma Musume selection when you're
                ready.
              </p>

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
                        {draftState.team1Ready ? "✓ Ready" : "Not Ready"}
                      </p>
                    </div>
                    <div
                      className={`px-6 py-3 rounded-lg border-2 ${draftState.team2Ready ? "border-green-500 bg-green-900/30" : "border-gray-600 bg-gray-700/50"}`}
                    >
                      <p className="text-sm text-gray-400 mb-1">{team2Name}</p>
                      <p
                        className={`font-bold ${draftState.team2Ready ? "text-green-400" : "text-gray-500"}`}
                      >
                        {draftState.team2Ready ? "✓ Ready" : "Not Ready"}
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
              <div className="bg-gray-800 rounded-lg shadow-lg p-3 lg:p-4 xl:p-6 border border-gray-700">
                <h2 className="text-lg lg:text-xl xl:text-2xl font-bold mb-2 lg:mb-4 text-gray-100">
                  {draftState.phase === "uma-pick" && "Available Umamusume"}
                  {draftState.phase === "uma-ban" && "Ban Opponent's Umamusume"}
                  {draftState.phase === "map-pick" &&
                    !selectedTrack &&
                    "Select a Racecourse"}
                  {draftState.phase === "map-pick" &&
                    selectedTrack &&
                    `Select Distance - ${selectedTrack}`}
                  {draftState.phase === "map-ban" && "Ban Opponent's Map"}
                </h2>

                {isUmaPhase && (
                  <input
                    type="text"
                    placeholder="Search Umamusume..."
                    value={umaSearch}
                    onChange={(e) => setUmaSearch(e.target.value)}
                    className="w-full mb-2 lg:mb-4 px-3 lg:px-4 py-1.5 lg:py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm lg:text-base text-gray-100 placeholder-gray-400 focus:outline-none focus:border-gray-500"
                  />
                )}

                {draftState.phase === "map-pick" && selectedTrack && (
                  <button
                    onClick={() => setSelectedTrack(null)}
                    className="mb-2 lg:mb-4 bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-1.5 lg:py-2 px-3 lg:px-4 rounded-lg transition-colors border border-gray-600 text-sm lg:text-base"
                  >
                    ← Back to Racecourses
                  </button>
                )}

                <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-3 xl:gap-4">
                  {isUmaPhase &&
                    getFilteredUmas().map((uma) => (
                      <UmaCard
                        key={uma.id}
                        uma={uma}
                        onSelect={handleUmaSelect}
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
                        onSelect={handleMapSelect}
                        disabled={!canSelectMap(map)}
                      />
                    ))}

                  {draftState.phase === "map-ban" &&
                    getBannableMaps().map((map) => (
                      <MapCard
                        key={map.id}
                        map={map}
                        onSelect={handleMapSelect}
                      />
                    ))}
                </div>
              </div>
            )}

          {isComplete && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-4 lg:p-6 xl:p-8 text-center border border-gray-700">
              <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-100 mb-4 lg:mb-6 xl:mb-8">
                Tiebreaker Map
              </h2>
              <div className="flex justify-center mb-4 lg:mb-6 xl:mb-8">
                <div className="bg-gray-700 border-4 border-blue-500 rounded-xl p-4 lg:p-6 xl:p-8 max-w-md">
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
                  <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-white mb-1 lg:mb-2">
                    {draftState.wildcardMap.track}
                  </h3>
                  <div
                    className={`inline-block px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg mb-1 lg:mb-2 ${
                      draftState.wildcardMap.surface?.toLowerCase() === "turf"
                        ? "bg-green-700"
                        : "bg-amber-800"
                    }`}
                  >
                    <span className="text-sm lg:text-base xl:text-lg font-semibold text-white">
                      {draftState.wildcardMap.surface}
                    </span>
                  </div>
                  <p className="text-base lg:text-lg xl:text-xl text-gray-200">
                    {draftState.wildcardMap.distance}m
                    {draftState.wildcardMap.variant &&
                      ` (${draftState.wildcardMap.variant})`}
                  </p>
                  {draftState.wildcardMap.conditions && (
                    <p className="text-sm lg:text-base xl:text-lg text-gray-300 mt-1 lg:mt-2">
                      {draftState.wildcardMap.conditions.season} •{" "}
                      {draftState.wildcardMap.conditions.ground} •{" "}
                      {draftState.wildcardMap.conditions.weather}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-56 lg:w-72 xl:w-96 shrink-0 flex flex-col px-1 lg:px-2 min-h-0">
        <TeamPanel
          team="team2"
          teamName={team2Name}
          pickedUmas={draftState.team2.pickedUmas}
          bannedUmas={draftState.team2.bannedUmas}
          pickedMaps={draftState.team2.pickedMaps}
          bannedMaps={draftState.team2.bannedMaps}
          isCurrentTurn={
            draftState.phase !== "complete" &&
            draftState.currentTeam === "team2"
          }
          distanceCounts={countDistances(draftState.team2.pickedMaps)}
          dirtCount={countDirtTracks(draftState.team2.pickedMaps)}
          showMapOrder={
            draftState.phase === "post-map-pause" ||
            draftState.phase === "uma-pick" ||
            draftState.phase === "uma-ban" ||
            draftState.phase === "complete"
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
            <div className="flex justify-end">
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
    </div>
  );
}
