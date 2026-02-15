# File Index - Helm Web Console

Complete listing of all files in the web console project.

## Root Configuration Files

### `package.json`
- Project metadata and npm dependencies
- Scripts: dev, build, preview, type-check
- Dependencies: React 18.2, React DOM 18.2, Zustand 4.4, Zod 3.22
- Dev Dependencies: TypeScript, Vite, Tailwind, PostCSS

### `tsconfig.json`
- TypeScript compiler configuration
- Strict mode enabled
- JSX: react-jsx
- Target: ESNext

### `vite.config.ts`
- Vite build configuration
- React plugin enabled
- Dev server port: 5173
- Source map generation enabled

### `tailwind.config.js`
- Custom Warhammer theme colors
- imperial-gold, imperial-red, xenos-purple, chaos-black

### `postcss.config.js`
- PostCSS plugin configuration
- Tailwind CSS and Autoprefixer

### `index.html`
- HTML entry point
- Dark theme (class="dark")
- Loads /src/main.tsx
- Meta tags for viewport and charset

### `.gitignore`
- Standard Node.js and IDE exclusions
- dist/, node_modules/, .DS_Store, etc.

## Documentation Files

### `README.md`
- Project overview
- Features list
- Installation and build instructions
- Architecture overview
- Key components summary

### `QUICKSTART.md`
- Quick start guide
- Installation steps
- Interface overview
- Common commands
- Troubleshooting

### `ARCHITECTURE.md`
- Detailed architecture documentation
- Component data flow
- Technology stack overview
- Feature breakdown by component
- Type system explanation
- Deployment instructions

### `FILE_INDEX.md`
- This file - complete file listing and descriptions

## Source Code Files

### Main Entry Point

#### `src/main.tsx` (10 lines)
- ReactDOM.createRoot setup
- Renders <App /> component
- Strict mode enabled

### Root Component

#### `src/App.tsx` (250 lines)
- Main application component
- Handles home and match screens
- State management integration
- WebSocket connection setup
- Home screen UI with match creation/join
- Match screen layout with all components

### Components (`src/components/`)

#### `src/components/MatchHeader.tsx` (100 lines)
- Match header UI at top of screen
- Shows match ID, battle round, current phase
- Phase icons (⚔️🏃🔫💥⚒️)
- Player info (CP, VP)
- Next Phase button
- Connection status indicator

#### `src/components/BattlefieldMap.tsx` (170 lines)
- HTML5 Canvas battlefield rendering
- Interactive canvas with click handling
- Pan (right-click drag) and zoom (scroll)
- Grid toggle
- Unit selection
- Calls canvas-renderer functions
- Event handlers for canvas interaction

#### `src/components/UnitPanel.tsx` (250 lines)
- Right sidebar showing selected unit details
- Stat blocks (M, T, Sv, W, Ld, OC)
- Models and wounds tracking
- Status badges
- Weapons list with full stats
- Abilities and enhancements
- Warlord indicator
- Phase-specific action buttons

#### `src/components/EventLog.tsx` (200 lines)
- Bottom panel with event history
- Auto-scrolling feed
- 14 event types with icons and colors
- Expandable event details
- Filter by event type
- Timestamps on each event

#### `src/components/PhaseGuide.tsx` (150 lines)
- Left panel with phase information
- Step-by-step phase instructions
- Available stratagems with CP costs
- Collapsible interface
- Context-sensitive tips

#### `src/components/DiceRoller.tsx` (200 lines)
- Floating dice roller panel
- Configurable number of dice (1-20)
- Target value selector (2+ to 6+)
- Roll animation
- Success/failure counting
- Critical hit highlighting
- Roll history tracking

#### `src/components/OverrideModal.tsx` (100 lines)
- Modal dialog for illegal action blocking
- Shows rule violated
- Displays explanation and suggested fix
- Reason input field for override
- Referee override button
- Red warning styling

#### `src/components/VoiceIndicator.tsx` (130 lines)
- Floating voice control button
- Push-to-talk (PTT) implementation
- Live transcript display
- Intent parsing for 40K commands
- Pulsing animation when active
- Graceful degradation if API unavailable

### Hooks (`src/hooks/`)

#### `src/hooks/useWebSocket.ts` (150 lines)
- Custom React hook for WebSocket connection
- Connects to ws://localhost:3000/ws
- Auto-reconnect with exponential backoff
- Message handling (state_update, event, command_result)
- Command sending function
- Subscription management

#### `src/hooks/useVoice.ts` (150 lines)
- Custom React hook for speech APIs
- Speech Recognition (STT)
- Speech Synthesis (TTS)
- Push-to-talk mode
- Transcript management
- Error handling and graceful fallback

### State Management (`src/store/`)

#### `src/store/match-store.ts` (80 lines)
- Zustand store definition
- Match state: matchId, state, events, connected
- UI state: selectedUnitId, showEventLog, showPhaseGuide, etc.
- Modal state: overrideModal
- All action creators (setMatchId, updateState, addEvent, etc.)

### Type Definitions (`src/types/`)

#### `src/types/index.ts` (200 lines)
- Complete TypeScript type definitions
- Enums: Phase, GameSize, UnitStatus, MatchEventType, CommandType
- Interfaces: Position, Weapon, Unit, Player, TerrainPiece, Objective
- MatchState interface with full game state
- MatchEvent interface with 14 event types
- GameCommand interface
- WebSocketMessage union type

### Rendering Engine (`src/lib/`)

#### `src/lib/canvas-renderer.ts` (450 lines)
- Canvas rendering utilities
- Main render loop: renderBattlefield()
- Layer functions:
  - renderGrid() - Grid overlay with labels
  - renderDeploymentZones() - Deployment zone visualization
  - renderTerrain() - Terrain pieces (circles, rectangles, polygons)
  - renderObjectives() - Objective markers with control indicators
  - renderUnits() - Units with faction colors and status
  - renderMovementRange() - Movement range dashed circle
  - renderWeaponRanges() - Weapon range dotted circles
- Coordinate transformation functions
- Support for 4 unit base sizes
- Faction-specific coloring
- Status indicator borders

### Styling

#### `src/index.css` (102 lines)
- Tailwind CSS imports (@tailwind directives)
- Custom Warhammer theme properties
- Global styles (scrollbar, animations, focus states)
- Color utility classes
- Selection and disabled states
- Custom font smoothing

## Directory Structure

```
web-console/
├── Configuration (6 files)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── index.html
├── Documentation (4 files)
│   ├── README.md
│   ├── QUICKSTART.md
│   ├── ARCHITECTURE.md
│   └── FILE_INDEX.md
├── Source Code (17 files)
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── components/ (8 files)
│       ├── hooks/ (2 files)
│       ├── store/ (1 file)
│       ├── types/ (1 file)
│       └── lib/ (1 file)
└── Other
    └── .gitignore
```

## Total Statistics

- **Total Files**: 27
- **Configuration Files**: 6 (111 lines)
- **Documentation Files**: 4
- **Source Code Files**: 17 (2,563 lines)
- **Total Code Lines**: 2,674

## File Dependencies

```
index.html
  ↓
src/main.tsx
  ↓
src/App.tsx
  ├─→ src/store/match-store.ts
  ├─→ src/hooks/useWebSocket.ts
  ├─→ src/types/index.ts
  └─→ src/components/*
       ├─→ src/lib/canvas-renderer.ts
       ├─→ src/hooks/useWebSocket.ts
       ├─→ src/hooks/useVoice.ts
       └─→ src/store/match-store.ts

src/index.css
  ├─→ @tailwind directives
  └─→ tailwind.config.js
```

## File Sizes

Configuration: ~111 lines
Main code: ~2,563 lines
Documentation: ~800 lines
Total: ~3,374 lines of project content

## Key File Relationships

1. **App.tsx** - Orchestrates all components and state
2. **match-store.ts** - Central state, used by all components
3. **useWebSocket.ts** - Connection logic, updates store
4. **canvas-renderer.ts** - Used exclusively by BattlefieldMap
5. **types/index.ts** - Referenced throughout project
6. **index.css** - Global styles for all components

## Build Outputs

- `npm run build` → Creates `dist/` directory with bundled app
- `npm run dev` → Serves from `src/` with hot reload
- `npm run preview` → Serves `dist/` directory locally
