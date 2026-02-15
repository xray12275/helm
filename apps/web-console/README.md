# Helm Web Console

Web-based referee console for Warhammer 40K 10th Edition matches. Shows the full battlefield, event log, phase controls, and scoring.

## Features

- Real-time battlefield visualization with canvas rendering
- Unit selection and detailed stat blocks
- Phase navigation and step-by-step guides
- Event logging with color-coded types
- Dice roller with success/failure tracking
- Voice input support (speech-to-text)
- WebSocket integration with API Gateway
- Dark Warhammer-themed UI
- Responsive layout for desktop/tablet

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Starts Vite dev server on http://localhost:5173

### Build

```bash
npm run build
```

Produces optimized production build in `dist/`

### Preview

```bash
npm run preview
```

Serves the built app locally.

## Architecture

- **React 18** - UI framework
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Canvas API** - Battlefield rendering

## WebSocket Connection

Connects to `ws://localhost:3000/ws` (api-gateway).

Messages:
- `subscribe` - Subscribe to match updates
- `state_update` - Full match state (units, terrain, objectives)
- `event` - Individual match events (moves, damage, etc.)
- Command messages - Send game actions

## Key Components

- **MatchHeader** - Round, phase, player info, next phase button
- **BattlefieldMap** - Canvas-based battlefield with zoom/pan
- **UnitPanel** - Selected unit details and action buttons
- **EventLog** - Timestamped event history with filtering
- **PhaseGuide** - Contextual phase rules and stratagems
- **DiceRoller** - Roll tracking for tests
- **OverrideModal** - Referee override interface
- **VoiceIndicator** - Push-to-talk voice commands

## Customization

### Warhammer Theme Colors

Edit `tailwind.config.js`:
- `imperial-gold` - #D4AF37
- `imperial-red` - #CC0000
- `xenos-purple` - #7D3C98
- `chaos-black` - #0A0E27

## Type Definitions

Local type definitions in `src/types/index.ts` mirror the shared Helm types:
- Phase, GameSize, Position, UnitStatus
- Unit, Player, MatchState
- MatchEvent, MatchEventType
- WebSocketMessage, GameCommand
