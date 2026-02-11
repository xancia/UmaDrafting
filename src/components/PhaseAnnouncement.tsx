import { useState, useEffect, useRef } from "react";
import type { DraftPhase } from "../types";

interface PhaseAnnouncementProps {
  /** Current draft phase */
  phase: DraftPhase;
}

/** Maps draft phases to announcement text and styling */
const PHASE_CONFIG: Partial<
  Record<DraftPhase, { text: string; color: string }>
> = {
  "map-pick": {
    text: "MAP PICK PHASE",
    color: "text-green-400",
  },
  "map-ban": {
    text: "MAP BAN PHASE",
    color: "text-red-400",
  },
  "uma-pick": {
    text: "UMA PICK PHASE",
    color: "text-green-400",
  },
  "uma-ban": {
    text: "UMA BAN PHASE",
    color: "text-red-400",
  },
  complete: {
    text: "DRAFT COMPLETE",
    color: "text-yellow-400",
  },
};

/**
 * Full-screen overlay that announces major phase transitions.
 *
 * Displays for ~2 seconds with a scale-up + fade animation,
 * then auto-dismisses. Only fires on phases listed in PHASE_CONFIG.
 */
export default function PhaseAnnouncement({ phase }: PhaseAnnouncementProps) {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<{
    text: string;
    color: string;
  } | null>(null);
  const prevPhaseRef = useRef<DraftPhase>(phase);

  useEffect(() => {
    // Only trigger when phase actually changes
    if (phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;

    const phaseConfig = PHASE_CONFIG[phase];
    if (!phaseConfig) return;

    setConfig(phaseConfig);
    setVisible(true);

    // Auto-dismiss after animation duration (2.2s)
    const timer = setTimeout(() => {
      setVisible(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, [phase]);

  if (!visible || !config) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Announcement text */}
      <div className="phase-announcement relative">
        <h1
          className={`text-5xl lg:text-6xl xl:text-7xl font-black tracking-widest ${config.color} drop-shadow-lg`}
          style={{ textShadow: "0 0 40px currentColor" }}
        >
          {config.text}
        </h1>
      </div>
    </div>
  );
}
