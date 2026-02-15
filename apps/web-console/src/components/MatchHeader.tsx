import React from 'react'
import { useMatchStore } from '../store/match-store'
import { Phase, CommandType } from '../types'
import { useWebSocket } from '../hooks/useWebSocket'

const PHASE_ORDER = [
  Phase.Command,
  Phase.Movement,
  Phase.Shooting,
  Phase.Charge,
  Phase.Fight,
]

const PHASE_ICONS: Record<Phase, string> = {
  [Phase.Command]: '⚔️',
  [Phase.Movement]: '🏃',
  [Phase.Shooting]: '🔫',
  [Phase.Charge]: '💥',
  [Phase.Fight]: '⚒️',
}

export const MatchHeader: React.FC = () => {
  const { state, connected } = useMatchStore()
  const { sendCommand } = useWebSocket()

  if (!state) {
    return null
  }

  const currentPlayer = state.players[state.currentPlayerIndex]

  const handleNextPhase = () => {
    if (!state) return

    sendCommand({
      type: CommandType.AdvancePhase,
      matchId: state.id,
      playerId: currentPlayer?.id || '',
      data: {},
    })
  }

  return (
    <div className="bg-chaos-black border-b-2 border-imperial-gold px-6 py-4">
      <div className="grid grid-cols-3 gap-4 items-center mb-4">
        {/* Left: Match Info */}
        <div>
          <div className="text-sm text-gray-400">Match ID</div>
          <div className="text-xl font-bold text-imperial-gold">
            {state.id.substring(0, 8)}
          </div>
          <div className="text-sm text-gray-300 mt-1">
            Battle Round {state.round}
          </div>
        </div>

        {/* Center: Current Phase */}
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-2">Current Phase</div>
          <div className="text-3xl font-bold text-imperial-gold mb-3">
            {PHASE_ICONS[state.phase]} {state.phase}
          </div>

          {/* Phase Navigation */}
          <div className="flex gap-1 justify-center mb-3">
            {PHASE_ORDER.map((phase) => (
              <button
                key={phase}
                className={`px-2 py-1 text-xs font-bold rounded transition-colors ${
                  phase === state.phase
                    ? 'bg-imperial-gold text-chaos-black'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                disabled={true}
              >
                {phase.substring(0, 3)}
              </button>
            ))}
          </div>

          <button
            onClick={handleNextPhase}
            className="w-full bg-imperial-gold hover:bg-yellow-500 text-chaos-black font-bold py-2 rounded transition-colors"
          >
            Next Phase →
          </button>
        </div>

        {/* Right: Player Info */}
        <div className="text-right">
          <div className="grid grid-cols-2 gap-4">
            {state.players.map((player, idx) => (
              <div
                key={player.id}
                className={`p-2 rounded border ${
                  idx === state.currentPlayerIndex
                    ? 'border-imperial-gold bg-chaos-black/50'
                    : 'border-gray-700 bg-gray-800/20'
                }`}
              >
                <div className="text-xs text-gray-400">{player.name}</div>
                <div className="text-sm font-bold text-imperial-gold">
                  CP: {player.commandPoints}
                </div>
                <div className="text-sm font-bold text-imperial-red">
                  VP: {player.victoryPoints}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-gray-400">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          Active Units: {state.players.reduce((sum, p) => sum + p.units.length, 0)}
        </div>
      </div>
    </div>
  )
}
