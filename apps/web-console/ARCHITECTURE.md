# Helm Web Console Architecture

## Project Structure

```
web-console/
├── src/
│   ├── components/          # React components
│   │   ├── BattlefieldMap.tsx      # Canvas battlefield rendering (170 lines)
│   │   ├── MatchHeader.tsx         # Match info & phase controls (100 lines)
│   │   ├── UnitPanel.tsx           # Unit details sidebar (250 lines)
│   │   ├── EventLog.tsx            # Event log with filtering (200 lines)
│   │   ├── PhaseGuide.tsx          # Phase rules & stratagems (150 lines)
│   │   ├── DiceRoller.tsx          # Dice roller utility (200 lines)
│   │   ├── OverrideModal.tsx       # Referee override modal (100 lines)
│   │   └── VoiceIndicator.tsx      # Voice control interface (130 lines)
│   ├── hooks/               # Custom React hooks
│   │   ├── useWebSocket.ts         # WebSocket connection & messaging (150 lines)
│   │   └── useVoice.ts             # Speech recognition/synthesis (150 lines)
│   ├── store/               # State management
│   │   └── match-store.ts          # Zustand store (80 lines)
│   ├── lib/                 # Utilities
│   │   └── canvas-renderer.ts      # Canvas rendering functions (450 lines)
│   ├── types/               # TypeScript types
│   │   └── index.ts                # Type definitions (200 lines)
│   ├── App.tsx              # Main app component (250 lines)
│   ├── main.tsx             # React root
│   └── index.css            # Global styles & Tailwind
├── index.html               # HTML entry point
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite config
├── tailwind.config.js       # Tailwind theme
└── postcss.config.js        # PostCSS config
```

## Component Data Flow

```
App (Home/Match Screen)
├── MatchHeader (read: state, connected | write: sendCommand)
├── BattlefieldMap (read: state, selectedUnitId | write: selectUnit)
├── UnitPanel (read: state, selectedUnitId | write: selectUnit, sendCommand)
├── EventLog (read: events, showEventLog)
├── PhaseGuide (read: state, showPhaseGuide)
├── DiceRoller (read: showDiceRoller)
├── OverrideModal (read: overrideModal | write: hideOverride, sendCommand)
└── VoiceIndicator (read: none | write: implicit actions)

State Flow:
  Zustand Store (match-store.ts)
      ↓
  useWebSocket Hook
      ↓
  WebSocket events (state_update, event)
      ↓
  Component re-renders via Zustand subscriptions
```

## Key Technologies

### React 18
- Functional components with hooks
- Context-based state via Zustand
- Conditional rendering for screens

### Zustand Store
```typescript
interface MatchStore {
  // Data
  matchId: string | null
  state: MatchState | null
  events: MatchEvent[]
  connected: boolean
  selectedUnitId: string | null
  
  // UI State
  showEventLog: boolean
  showPhaseGuide: boolean
  showDiceRoller: boolean
  overrideModal: { visible: boolean; event: MatchEvent | null }
  
  // Actions
  setMatchId, updateState, addEvent, setConnected, selectUnit, etc.
}
```

### Canvas Rendering
- 60" × 44" battlefield (standard table)
- Scaling: adjustable pixels-per-inch
- Panning: right-click drag
- Zooming: scroll wheel
- Elements rendered: grid, deployment zones, terrain, objectives, units
- Unit rendering: faction colors, base sizes, status borders, selection highlight
- Range visualization: movement range (dashed), weapon ranges (dotted)

### WebSocket Protocol

Connects to `ws://localhost:3000/ws`

**Outbound Messages:**
```typescript
{ type: 'subscribe', matchId: string }
{ type: 'command', data: GameCommand }
```

**Inbound Messages:**
```typescript
{ type: 'state_update', state: MatchState }
{ type: 'event', event: MatchEvent }
{ type: 'command_result', commandId: string, success: boolean }
```

### Styling
- Tailwind CSS with custom Warhammer theme
- Dark mode by default (#0A0E27)
- Imperial gold accents (#D4AF37)
- Custom colors: imperial-red, xenos-purple, chaos-black
- Responsive grid/flexbox layouts
- Smooth transitions and hover states

## Feature Breakdown

### Battlefield Map
- Canvas-based 2D rendering
- Layers: grid → deployment zones → terrain → objectives → units
- Click to select units (0.5" tolerance)
- Right-click to pan
- Scroll to zoom
- Grid toggle
- Reset view button
- Selection highlight with ranges

### Match Header
- Current round & phase display
- Phase icons for visual recognition
- Player info (CP, VP, active player highlight)
- Next Phase button → AdvancePhase command
- Connection status indicator

### Unit Panel
- Stat block display (M, T, Sv, W, Ld, OC)
- Models/wounds tracking
- Status badges (Moved, Advanced, Fell Back, In Combat, Battleshocked)
- Weapons list with full stats
- Abilities & enhancements
- Phase-specific action buttons (Move, Advance, Fall Back, Attack, Charge, Fight)
- Warlord indicator

### Event Log
- Auto-scrolling event feed
- Color-coded event types
- Event icons for quick visual reference
- Expandable details for each event
- Filter by event type
- Timestamps

### Phase Guide
- Step-by-step phase instructions
- Available stratagems with CP costs
- Collapsible panel
- Context-sensitive tips

### Dice Roller
- Configurable number of dice (1-20)
- Target value buttons (2+ through 6+)
- Animated roll display
- Success/failure count
- Critical hit highlighting
- Roll history
- Floating panel in bottom-left

### Voice Indicator
- Push-to-talk (PTT) button
- Live transcript display
- Intent parsing for commands
- Speech synthesis readback capability
- Supports common 40K commands

### Override Modal
- Triggers on IllegalActionBlocked event
- Shows rule violated & explanation
- Suggested fix display
- Referee override with reason input
- Red warning styling

## Type System

All types mirrored from shared `@helm/shared-types`:
- **Phase**: Command, Movement, Shooting, Charge, Fight (enum)
- **GameSize**: Incursion, Onslaught, Apocalypse (enum)
- **UnitStatus**: Healthy, Damaged, Battleshocked, InEngagement, HasMoved, etc.
- **Unit**: Full unit with stats, weapons, abilities, position, status
- **Player**: ID, name, faction, CP, VP, units array
- **MatchState**: Full game state including round, phase, players, terrain, objectives
- **MatchEvent**: Type, timestamp, player, unit, data fields
- **Position**: {x, y} in table coordinates

## Deployment

### Development
```bash
npm run dev          # Runs on http://localhost:5173
npm run type-check   # Type checking
```

### Production
```bash
npm run build        # Creates optimized dist/
npm run preview      # Test production build locally
```

### Environment
- Node 16+
- npm/yarn
- Target: Modern browsers (Chrome, Firefox, Safari, Edge)
- Canvas API support required
- WebSocket support required
- Speech APIs optional (graceful fallback)

## Future Enhancements

- Multiplayer cursor tracking
- Board state persistence
- Undo/redo system
- Hotkey support for common actions
- Custom terrain/objective editor
- Army list import
- Statistics/replay system
- Mobile responsiveness improvements
- Accessibility features (WCAG 2.1)
