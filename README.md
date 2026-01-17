# Uma Musume Drafting System

A League of Legends-style draft interface for Uma Musume Pretty Derby competitive play. Built for streaming and tournament use.

![Draft System](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-blue) ![PeerJS](https://img.shields.io/badge/PeerJS-P2P-green)

## Features

- **Team-based drafting** - Side-by-side team displays with clear visual hierarchy
- **Two-phase system** - Uma Musume selection followed by track/distance selection
- **Ban mechanics** - Ban opponent picks after draft phase completes
- **Undo/Reset controls** - Full history tracking with ability to step backwards
- **Broadcast-ready UI** - Clean, professional interface designed for viewers
- **🆕 Multiplayer Support** - Real-time P2P drafting with room codes
- **🆕 Spectator Mode** - Watch live drafts without participating
- **🆕 Dynamic Track Conditions** - Random weather and ground conditions for each race

## Multiplayer

The drafting system supports real-time multiplayer using peer-to-peer WebRTC connections:

### How to Play Online

1. **Host a Room** - Click "Multiplayer" → "Host Room" → Enter team names → Share the 6-character room code
2. **Join a Room** - Click "Multiplayer" → "Join Room" → Enter the room code
3. **Spectate** - Click "Multiplayer" → "Spectate" → Enter the room code to watch live

### How It Works

- Uses **PeerJS** for WebRTC-based peer-to-peer connections
- The host's browser acts as the source of truth for game state
- All draft data flows directly between players (no game server required)
- Signaling server only helps peers discover each other initially

### Features

- Real-time state synchronization across all players
- Automatic team assignment (Host = Team 1, Player 2 = Team 2)
- Spectators can watch the draft live with pulsing turn indicators
- Wildcard tiebreaker map reveal before draft begins
- Waiting room with player count before starting

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

4. **Uma Musume Picking** (Team 1 starts)
   - Each team picks 6 characters
   - Alternating picks between teams

5. **Uma Musume Banning** (Team 2 starts)
   - Each team bans 1 character from opponent's picks

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
├── types.ts        # TypeScript interfaces
├── data.ts         # Character and track data
├── draftLogic.ts   # Core draft state management
└── App.tsx         # Main application
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
- **PeerJS** - WebRTC peer-to-peer connections for multiplayer

## License

MIT

## Acknowledgments

Built for the Uma Musume Pretty Derby community.
