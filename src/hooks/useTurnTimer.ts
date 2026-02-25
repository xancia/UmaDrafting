import { useState, useEffect, useCallback, useRef } from "react";
import type { DraftPhase } from "../types";

/** Default turn duration in seconds */
export const DEFAULT_TURN_DURATION = 60;

/** Phases where timer should be active */
const ACTIVE_PHASES: DraftPhase[] = [
  "map-pick",
  "map-ban",
  "uma-pick",
  "uma-ban",
  "uma-pre-ban",
];

/**
 * Configuration for the turn timer
 */
interface TurnTimerConfig {
  /** Turn duration in seconds (default: 60) */
  duration?: number;
  /** Whether the timer is enabled (default: true) */
  enabled?: boolean;
  /** Callback when timer expires */
  onTimeout: () => void;
  /** Current draft phase */
  phase: DraftPhase;
  /** Current team's turn identifier (used to detect turn changes) */
  currentTurnKey: string;
  /** Whether this client should control the timer (host in multiplayer, always in local) */
  isTimerAuthority: boolean;
}

/**
 * Return type for useTurnTimer hook
 */
interface UseTurnTimerResult {
  /** Remaining seconds on the timer */
  timeRemaining: number;
  /** Whether the timer is currently running */
  isRunning: boolean;
  /** Pause the timer */
  pause: () => void;
  /** Resume the timer */
  resume: () => void;
  /** Reset timer to full duration */
  reset: () => void;
  /** Whether timer is in warning state (< 10 seconds) */
  isWarning: boolean;
  /** Whether timer is in critical state (< 5 seconds) */
  isCritical: boolean;
  /** The turn key the timer is currently tracking */
  activeTurnKey: string;
}

/**
 * Hook for managing turn-based countdown timer
 *
 * Timer automatically:
 * - Resets when turn changes (currentTurnKey changes)
 * - Pauses during non-active phases (lobby, wildcard-reveal, complete)
 * - Calls onTimeout when timer reaches 0
 *
 * @param config - Timer configuration
 * @returns Timer state and control functions
 */
export function useTurnTimer({
  duration = DEFAULT_TURN_DURATION,
  enabled = true,
  onTimeout,
  phase,
  currentTurnKey,
  isTimerAuthority,
}: TurnTimerConfig): UseTurnTimerResult {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutCalledRef = useRef(false);
  const previousTurnKeyRef = useRef(currentTurnKey);
  const turnStartTimeRef = useRef(Date.now());
  const previousIsAuthorityRef = useRef(isTimerAuthority);

  // Track the turn key actively being timed so consumers can verify
  // the timeout is for the correct turn.
  const activeTurnKeyRef = useRef(currentTurnKey);

  /** Hard minimum: never fire a timeout within this many ms of a reset */
  const MINIMUM_ELAPSED_MS = 2000;

  // Keep onTimeout ref current to avoid stale closures in the interval.
  // Without this, the interval captures an old onTimeout and can fire a stale
  // callback via setTimeout after state has already changed.
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Determine if timer should be active based on phase
  const isActivePhase = ACTIVE_PHASES.includes(phase);
  // Timer counts down visually for everyone, but only authority triggers timeout
  const shouldCountDown = enabled && isActivePhase && !isPaused;
  const isRunning = shouldCountDown;

  // Reset timer when turn changes
  useEffect(() => {
    if (previousTurnKeyRef.current !== currentTurnKey) {
      previousTurnKeyRef.current = currentTurnKey;
      activeTurnKeyRef.current = currentTurnKey;
      turnStartTimeRef.current = Date.now();
      setTimeRemaining(duration);
      timeoutCalledRef.current = false;
    }
  }, [currentTurnKey, duration]);

  // Reset timer when becoming timer authority (handles multiplayer turn switches).
  // When the turn switches to us, isTimerAuthority goes false → true. Without this,
  // turnStartTimeRef retains the value from ~60s ago and the first interval tick
  // immediately computes remaining=0, causing an instant timeout.
  useEffect(() => {
    if (isTimerAuthority && !previousIsAuthorityRef.current) {
      activeTurnKeyRef.current = currentTurnKey;
      turnStartTimeRef.current = Date.now();
      setTimeRemaining(duration);
      timeoutCalledRef.current = false;
    }
    previousIsAuthorityRef.current = isTimerAuthority;
  }, [isTimerAuthority, duration, currentTurnKey]);

  // Reset timer when phase changes to an active phase
  useEffect(() => {
    if (isActivePhase) {
      activeTurnKeyRef.current = currentTurnKey;
      turnStartTimeRef.current = Date.now();
      setTimeRemaining(duration);
      timeoutCalledRef.current = false;
    }
  }, [phase, isActivePhase, duration, currentTurnKey]);

  // Countdown effect - uses timestamp-based calculation to handle background tab throttling
  // Uses onTimeoutRef instead of onTimeout in deps to prevent interval churn
  // every time handleTurnTimeout is recreated (which happens on every state change).
  useEffect(() => {
    if (!shouldCountDown) return;

    const interval = setInterval(() => {
      const elapsedMs = Date.now() - turnStartTimeRef.current;
      const elapsed = Math.floor(elapsedMs / 1000);
      const remaining = Math.max(0, duration - elapsed);

      setTimeRemaining(remaining);

      if (
        remaining <= 0 &&
        !timeoutCalledRef.current &&
        isTimerAuthority &&
        // HARD GUARD: never fire timeout within MINIMUM_ELAPSED_MS of a reset.
        // This prevents instant double-timeouts caused by stale intervals,
        // React effect ordering, or network latency in multiplayer.
        elapsedMs >= MINIMUM_ELAPSED_MS
      ) {
        timeoutCalledRef.current = true;
        // Call latest onTimeout via ref to avoid stale closures.
        // setInterval callback is already async so no risk of calling during render.
        onTimeoutRef.current();
      }
    }, 100); // Update more frequently to catch up quickly when tab becomes active

    return () => clearInterval(interval);
  }, [shouldCountDown, isTimerAuthority, duration]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const reset = useCallback(() => {
    activeTurnKeyRef.current = currentTurnKey;
    turnStartTimeRef.current = Date.now();
    setTimeRemaining(duration);
    timeoutCalledRef.current = false;
  }, [duration, currentTurnKey]);

  return {
    timeRemaining,
    isRunning,
    pause,
    resume,
    reset,
    isWarning: timeRemaining <= 10 && timeRemaining > 5,
    isCritical: timeRemaining <= 5,
    activeTurnKey: activeTurnKeyRef.current,
  };
}
