# Quick Start Guide

## Installation

```bash
cd web-console
npm install
```

## Running Locally

```bash
npm run dev
```

Opens http://localhost:5173 in your browser.

## Creating a Match

1. Click "Create Match"
2. Select game size (Incursion, Onslaught, Apocalypse)
3. Share the match code with your iPhone operator
4. Battlefield appears automatically when connected to api-gateway

## Using the Interface

### Battlefield Map
- Click units to select them
- Right-click and drag to pan
- Scroll to zoom in/out
- Toggle grid with button
- Yellow highlight = selected unit
- Dashed circle = movement range
- Dotted circles = weapon ranges

### Unit Details (Right Panel)
- View all unit stats and abilities
- See status flags (Moved, In Combat, etc.)
- Weapons with BS, Strength, AP, Damage
- Phase-specific action buttons

### Match Header
- Current round and phase
- Both players' Command Points & Victory Points
- Phase navigation buttons
- "Next Phase" button to advance

### Event Log (Bottom)
- Color-coded events (blue=move, red=damage, green=scoring)
- Click to expand details
- Filter by event type
- Auto-scrolls to latest events

### Side Panels
- **Phase Guide** (top-left): Step-by-step instructions
- **Dice Roller** (bottom-left): Roll tracking
- **Voice Control** (bottom-right): Push-to-talk

## WebSocket Connection

The app automatically connects to `ws://localhost:3000/ws`

Connection status shown in match header (green dot = connected).

Events from api-gateway update the battlefield in real-time.

## Commands

Common actions that trigger WebSocket commands:

- **Next Phase**: Sends AdvancePhase command
- **Move Unit**: Sends MoveUnit command
- **Declare Attack**: Sends DeclareAttack command
- **Override**: Sends ApplyOverride command (referee only)

All commands include matchId, playerId, and relevant unit/data.

## Hot Keys & Tips

- Hold mic button for voice input (if supported)
- Click event log entries to see full details
- Selected unit shows all eligible targets
- Filter event log by type to find key moments
- Use dice roller to track all tests

## Troubleshooting

**Blank battlefield?**
- Check connection status (header dot)
- Verify api-gateway is running on port 3000
- Check browser console for WebSocket errors

**WebSocket errors?**
- Ensure api-gateway is running
- Check firewall allows localhost:3000
- Try refreshing the page

**Missing units?**
- Check that state_update messages are being received
- Verify iPhone app is sending unit data
- Check browser console for parsing errors

## Development Tips

- Open browser DevTools (F12)
- Check Console for errors
- Network tab shows WebSocket messages
- React DevTools extension helpful for debugging

## Building for Production

```bash
npm run build
npm run preview  # Test the build locally
```

Output goes to `dist/` directory.

Deploy to web server of your choice (Netlify, Vercel, AWS, etc.)
