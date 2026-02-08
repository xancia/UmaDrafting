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

  // Determine if timer should be active based on phase
  const isActivePhase = ACTIVE_PHASES.includes(phase);
  // Timer counts down visually for everyone, but only authority triggers timeout
  const shouldCountDown = enabled && isActivePhase && !isPaused;
  const isRunning = shouldCountDown;

  // Reset timer when turn changes
  useEffect(() => {
    if (previousTurnKeyRef.current !== currentTurnKey) {
      previousTurnKeyRef.current = currentTurnKey;
      turnStartTimeRef.current = Date.now();
      setTimeRemaining(duration);
      timeoutCalledRef.current = false;
    }
  }, [currentTurnKey, duration]);

  // Reset timer when phase changes to an active phase
  useEffect(() => {
    if (isActivePhase) {
      turnStartTimeRef.current = Date.now();
      setTimeRemaining(duration);
      timeoutCalledRef.current = false;
    }
  }, [phase, isActivePhase, duration]);

  // Countdown effect - uses timestamp-based calculation to handle background tab throttling
  useEffect(() => {
    if (!shouldCountDown) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - turnStartTimeRef.current) / 1000,
      );
      const remaining = Math.max(0, duration - elapsed);

      setTimeRemaining(remaining);

      if (remaining <= 0 && !timeoutCalledRef.current && isTimerAuthority) {
        timeoutCalledRef.current = true;
        // Call timeout in next tick to avoid state update during render
        setTimeout(() => onTimeout(), 0);
      }
    }, 100); // Update more frequently to catch up quickly when tab becomes active

    return () => clearInterval(interval);
  }, [shouldCountDown, isTimerAuthority, onTimeout, duration]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const reset = useCallback(() => {
    turnStartTimeRef.current = Date.now();
    setTimeRemaining(duration);
    timeoutCalledRef.current = false;
  }, [duration]);

  return {
    timeRemaining,
    isRunning,
    pause,
    resume,
    reset,
    isWarning: timeRemaining <= 10 && timeRemaining > 5,
    isCritical: timeRemaining <= 5,
  };
}
