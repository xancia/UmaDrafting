# Uma Musume Drafting System

A League of Legends-style draft interface for Uma Musume Pretty Derby competitive play. Built for streaming and tournament use.

![Draft System](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-blue)

## Features

- **Team-based drafting** - Side-by-side team displays with clear visual hierarchy
- **Two-phase system** - Uma Musume selection followed by track/distance selection
- **Ban mechanics** - Ban opponent picks after draft phase completes
- **Undo/Reset controls** - Full history tracking with ability to step backwards
- **Broadcast-ready UI** - Clean, professional interface designed for viewers

## Draft Flow

1. **Uma Musume Picking** (Team 1 starts)

   - Each team picks 6 characters
   - Alternating picks between teams

2. **Uma Musume Banning** (Team 2 starts)

   - Each team bans 1 character from opponent's picks

3. **Track Picking** (Team 2 starts)

   - Each team picks 4 track/distance combinations
   - Two-stage selection: choose racecourse, then specific distance

4. **Track Banning** (Team 1 starts)
   - Each team bans 1 track from opponent's picks

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

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Styling

## Deployment

To deploy to GitHub Pages:

```bash
npm run deploy
```

This will build the app and push it to the `gh-pages` branch. Then:

1. Go to your repository settings on GitHub
2. Navigate to **Pages** section
3. Set **Source** to `gh-pages` branch
4. Click **Save**

Your site will be available at: `https://<username>.github.io/Uma-drafting/`

## License

MIT

## Acknowledgments

Built for the Uma Musume Pretty Derby community.
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
globalIgnores(['dist']),
{
files: ['**/*.{ts,tsx}'],
extends: [
// Other configs...
// Enable lint rules for React
reactX.configs['recommended-typescript'],
// Enable lint rules for React DOM
reactDom.configs.recommended,
],
languageOptions: {
parserOptions: {
project: ['./tsconfig.node.json', './tsconfig.app.json'],
tsconfigRootDir: import.meta.dirname,
},
// other options...
},
},
])

```

```
