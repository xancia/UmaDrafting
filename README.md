# Uma Musume Drafting System

A League of Legends-style draft interface for Uma Musume Pretty Derby competitive play. Built for streaming and tournament use.

![Draft System](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-blue) ![Firebase](https://img.shields.io/badge/Firebase-Realtime-orange)

## Features

- **Team-based drafting** - Side-by-side team displays with clear visual hierarchy
- **Two-phase system** - Uma Musume selection followed by track/distance selection
- **Pre-ban phase** - Each team bans 1 character from the pool before picks begin
- **Ban mechanics** - Ban opponent picks after draft phase completes
- **Turn timer** - 60-second countdown per pick with auto-selection on timeout
- **Broadcast-ready UI** - Clean, professional interface designed for viewers
- **Multiplayer Support** - Real-time drafting with room codes via Firebase
- **Spectator Mode** - Watch live drafts without participating
- **Reconnection Support** - Rejoin your draft if disconnected
- **Dynamic Track Conditions** - Random weather and ground conditions for each race
- **Match Reporting** - Report race results with scoring, scoreboard, and series winner detection
- **Multiplayer Consensus** - Team 2 confirms or disputes reported results

## Multiplayer

The drafting system supports real-time multiplayer using Firebase Realtime Database:

### How to Play Online

1. **Host a Room** - Click "Multiplayer" → "Host Room" → Share the 6-character room code
2. **Join a Room** - Click "Multiplayer" → "Join Room" → Enter the room code
3. **Spectate** - Click "Multiplayer" → "Spectate" → Enter the room code to watch live

### How It Works

- Uses **Firebase Realtime Database** for synchronized game state
- The host processes all actions to maintain consistency
- Players can reconnect if they disconnect mid-draft
- No peer-to-peer setup required - works through firewalls

### Features

- Real-time state synchronization across all players
- Automatic team assignment (Host = Team 1, Player 2 = Team 2)
- Spectators can watch the draft live with pulsing turn indicators
- Wildcard tiebreaker map reveal before draft begins
- Waiting room with editable team names
- Turn timer with visual countdown

## Usage

https://drafter.uma.guide/

## Draft Flow

1. **Wildcard Map Reveal** - Random tiebreaker map revealed with track conditions

2. **Track Picking** (Team 1 starts)
   - Each team picks 4 track/distance combinations
   - Two-stage selection: choose racecourse, then specific distance
   - Random weather and ground conditions assigned

3. **Track Banning** (Team 2 starts)
   - Each team bans 1 track from opponent's picks

4. **Uma Musume Pre-Ban** (Team 1 starts)
   - Each team bans 1 character from the full available pool
   - Pre-banned characters are removed entirely and cannot be picked by either team
   - Bans alternate: Team 1 bans first, then Team 2

5. **Uma Musume Picking** (Team 1 starts)
   - Each team makes 7 total picks (ends with 6 after mid-draft ban)
   - Snake draft pattern with mid-draft banning
   - After 5 picks each, pause for ban phase

6. **Uma Musume Banning** (Team 2 starts)
   - Each team bans 1 character from opponent's 5 picks
   - Then resume picking for final 2 characters each (ending with 6 total)

## Match Reporting

After the draft is complete, the host can report race results directly from the summary screen.

### Scoring System

- **Points mode** (default): 1st place = 4 pts, 2nd = 2 pts, 3rd = 1 pt. First team to 25 points wins the series.
- **Wins mode** (alternate): Each race winner gets 1 win. Best of 7.

### How to Report

1. After draft completes, click **Report Race X** on the summary screen
2. Select the 1st, 2nd, and 3rd place finishers from the drafted uma pool
3. Click **Submit** to send the result

### Multiplayer Confirmation

In multiplayer mode, match reporting requires consensus:

- The **host** submits race results
- **Team 2** sees a confirmation prompt with the reported placements
- Team 2 can **Confirm** (result is recorded) or **Dispute** (result is discarded, host can resubmit)
- In local/single-player mode, results are auto-confirmed

### Scoreboard

- A live scoreboard appears on the summary screen showing cumulative scores
- Race-by-race breakdown is shown below the scoreboard
- When a team reaches the winning threshold, a series winner banner is displayed
- The **Copy Draft Results** button includes pre-banned and banned characters in the output

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app will be available at `http://localhost:5173`

## Project Structure

```
src/
├── components/      # React components
├── hooks/           # Custom React hooks (Firebase, timer, etc.)
├── services/        # Firebase service layer
├── utils/           # Utility functions
├── types.ts         # TypeScript interfaces
├── data.ts          # Character and track data
├── draftLogic.ts    # Core draft state management
└── App.tsx          # Main application
```

## Character Images

Place character portraits in `public/uma-portraits/` with the naming format:

- Filename should match character name (lowercase, spaces replaced with hyphens)
- Example: `special-week.jpg`, `silence-suzuka.jpg`

## Customization

### Adding Characters

Edit `src/data.ts` and add entries to `SAMPLE_UMAS`:

```typescript
{
  id: "57",
  name: "Character Name",
  imageUrl: "/uma-portraits/character-name.jpg"
}
```

### Adding Tracks

Edit `src/data.ts` and add entries to `SAMPLE_MAPS`:

```typescript
{
  id: "119",
  track: "Racecourse Name",
  distance: "1600",
  surface: "Turf", // or "Dirt"
  variant: "Inner", // optional
  name: "Racecourse Name 1600m (Turf)"
}
```

## Technology

- **React 19** - UI framework
- **TypeScript 5** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Styling
- **Firebase** - Realtime Database for multiplayer sync

## License

MIT

## Acknowledgments

Built for the Uma Musume Pretty Derby community.
