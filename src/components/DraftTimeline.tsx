import type { DraftPhase, Team } from "../types";

interface DraftTimelineProps {
  /** Current draft phase */
  phase: DraftPhase;
  /** Current team whose turn it is */
  currentTeam: Team;
  /** Number of picks/bans completed in current phase group */
  completedActions: number;
  /** Team 1 display name */
  team1Name?: string;
  /** Team 2 display name */
  team2Name?: string;
}

/**
 * Draft order definition for each phase.
 * Each entry is [team, label] where label describes the action.
 */
type TimelineStep = { team: Team; label: string };

/** Uma pre-ban order: T1 bans 1, T2 bans 1 (matches PRE_BANS_PER_TEAM=1) */
const UMA_PRE_BAN: TimelineStep[] = [
  { team: "team1", label: "X" },
  { team: "team2", label: "X" },
];

/** Pre-ban uma pick order: T1(1), T2(2), T1(2), T2(2), T1(2), T2(1) = 5 each */
const UMA_PICK_PRE_BAN: TimelineStep[] = [
  { team: "team1", label: "P" },
  { team: "team2", label: "P" },
  { team: "team2", label: "P" },
  { team: "team1", label: "P" },
  { team: "team1", label: "P" },
  { team: "team2", label: "P" },
  { team: "team2", label: "P" },
  { team: "team1", label: "P" },
  { team: "team1", label: "P" },
  { team: "team2", label: "P" },
];

/** Uma ban order: T2 first, then T1 */
const UMA_BAN: TimelineStep[] = [
  { team: "team2", label: "B" },
  { team: "team1", label: "B" },
];

/** Post-ban uma pick order: T2(1), T1(2), T2(1) = 2 each */
const UMA_PICK_POST_BAN: TimelineStep[] = [
  { team: "team2", label: "P" },
  { team: "team1", label: "P" },
  { team: "team1", label: "P" },
  { team: "team2", label: "P" },
];

/** Map pick order: alternating T1, T2 x4 */
const MAP_PICK: TimelineStep[] = [
  { team: "team1", label: "P" },
  { team: "team2", label: "P" },
  { team: "team1", label: "P" },
  { team: "team2", label: "P" },
  { team: "team1", label: "P" },
  { team: "team2", label: "P" },
  { team: "team1", label: "P" },
  { team: "team2", label: "P" },
];

/** Map ban order: T1 bans first, then T2 */
const MAP_BAN: TimelineStep[] = [
  { team: "team1", label: "B" },
  { team: "team2", label: "B" },
];

/**
 * Resolves which timeline to display and the current step index
 * given the draft phase and number of completed actions.
 */
function getTimelineForPhase(
  phase: DraftPhase,
  completedActions: number,
): {
  steps: TimelineStep[];
  currentIndex: number;
  sectionLabel: string;
} | null {
  switch (phase) {
    case "map-pick":
      return {
        steps: MAP_PICK,
        currentIndex: completedActions,
        sectionLabel: "Map Picks",
      };
    case "map-ban":
      return {
        steps: MAP_BAN,
        currentIndex: completedActions,
        sectionLabel: "Map Bans",
      };
    case "uma-pre-ban":
      return {
        steps: [
          ...UMA_PRE_BAN,
          ...UMA_PICK_PRE_BAN,
          ...UMA_BAN,
          ...UMA_PICK_POST_BAN,
        ],
        currentIndex: completedActions,
        sectionLabel: "Uma Draft",
      };
    case "uma-pick": {
      const preBanCount = UMA_PRE_BAN.length;
      // Pre-ban picks (5 each = 10 total), then post-ban picks (2 each = 4 total)
      if (completedActions < 10) {
        return {
          steps: [
            ...UMA_PRE_BAN,
            ...UMA_PICK_PRE_BAN,
            ...UMA_BAN,
            ...UMA_PICK_POST_BAN,
          ],
          currentIndex: preBanCount + completedActions,
          sectionLabel: "Uma Draft",
        };
      }
      // Post-ban phase: 10 pre-ban picks already done + 2 bans
      return {
        steps: [
          ...UMA_PRE_BAN,
          ...UMA_PICK_PRE_BAN,
          ...UMA_BAN,
          ...UMA_PICK_POST_BAN,
        ],
        currentIndex: preBanCount + 10 + 2 + (completedActions - 10),
        sectionLabel: "Uma Draft",
      };
    }
    case "uma-ban":
      return {
        steps: [
          ...UMA_PRE_BAN,
          ...UMA_PICK_PRE_BAN,
          ...UMA_BAN,
          ...UMA_PICK_POST_BAN,
        ],
        currentIndex: UMA_PRE_BAN.length + 10 + completedActions,
        sectionLabel: "Uma Draft",
      };
    default:
      return null;
  }
}

/**
 * Horizontal strip showing the full pick/ban order for the current phase.
 *
 * Completed steps are dimmed, the current step pulses, and future steps
 * are displayed at normal opacity. Each block is colored by team.
 */
export default function DraftTimeline({
  phase,
  completedActions,
  team1Name = "Team 1",
  team2Name = "Team 2",
}: DraftTimelineProps) {
  const timeline = getTimelineForPhase(phase, completedActions);
  if (!timeline) return null;

  const { steps, currentIndex, sectionLabel } = timeline;

  return (
    <div className="bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          {sectionLabel}
        </span>
      </div>
      <div className="flex items-center gap-0.5 flex-wrap">
        {steps.map((step, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isBan = step.label === "B";

          // Insert a visual separator before ban section
          const showDivider =
            i > 0 &&
            ((steps[i - 1].label !== "B" && step.label === "B") ||
              (steps[i - 1].label === "B" && step.label !== "B"));

          return (
            <div key={i} className="flex items-center gap-0.5">
              {showDivider && <div className="w-px h-5 bg-gray-600 mx-1" />}
              <div
                className={`
                  w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold
                  transition-all duration-200
                  ${
                    isCurrent
                      ? step.team === "team1"
                        ? "bg-blue-600 text-white ring-2 ring-blue-400/60 scale-110"
                        : "bg-red-600 text-white ring-2 ring-red-400/60 scale-110"
                      : isCompleted
                        ? step.team === "team1"
                          ? "bg-blue-900/40 text-blue-400/50"
                          : "bg-red-900/40 text-red-400/50"
                        : step.team === "team1"
                          ? "bg-blue-900/60 text-blue-300/70"
                          : "bg-red-900/60 text-red-300/70"
                  }
                  ${isBan ? "border border-dashed" : ""}
                  ${isBan && isCurrent ? "border-current" : ""}
                  ${isBan && !isCurrent ? "border-gray-600" : ""}
                `}
                title={`${step.team === "team1" ? team1Name : team2Name} ${isBan ? "Ban" : "Pick"}`}
              >
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
