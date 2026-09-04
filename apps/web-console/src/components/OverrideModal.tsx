import React, { useState } from 'react'
import { useMatchStore } from '../store/match-store'
import { useWebSocket } from '../hooks/useWebSocket'
import { CommandType } from '../types'

export const OverrideModal: React.FC = () => {
  const { state, overrideModal, hideOverride } = useMatchStore()
  const { sendCommand } = useWebSocket()
  const [reason, setReason] = useState('')

  if (!overrideModal.visible || !overrideModal.event || !state) {
    return null
  }

  const event = overrideModal.event
  // event.data is untyped JSON from the gateway; narrow once for rendering.
  const data = (event.data ?? {}) as Record<string, string | undefined>

  const handleAccept = () => {
    hideOverride()
  }

  const handleOverride = () => {
    const currentPlayer = state.players[state.currentPlayerIndex]

    sendCommand({
      type: CommandType.ApplyOverride,
      matchId: state.id,
      playerId: currentPlayer?.id || '',
      data: {
        eventId: event.id,
        reason,
      },
    })

    hideOverride()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-chaos-black border-2 border-imperial-red rounded-lg p-6 max-w-lg w-full mx-4">
        <h2 className="text-2xl font-bold text-imperial-red mb-4">
          ⚠️ Illegal Action Blocked
        </h2>

        <div className="bg-gray-900 border border-imperial-red/50 rounded p-4 mb-4">
          <p className="text-sm text-gray-300 mb-3">
            {data.description ||
              'An action was attempted that violates game rules.'}
          </p>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-gray-500">Rule Violated:</span>
              <div className="text-imperial-red font-bold mt-1">
                {data.rule || 'Unknown Rule'}
              </div>
            </div>

            {data.details && (
              <div>
                <span className="text-gray-500">Details:</span>
                <div className="text-gray-300 mt-1 bg-black/30 p-2 rounded">
                  {data.details}
                </div>
              </div>
            )}

            {data.suggestion && (
              <div>
                <span className="text-gray-500">Suggested Fix:</span>
                <div className="text-cyan-300 mt-1 bg-cyan-900/20 p-2 rounded">
                  {data.suggestion}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-700/50 rounded p-3 mb-4 text-xs text-blue-100">
          <strong>Referee Override:</strong> If you believe this was incorrect, you can override
          the block with referee authority.
        </div>

        <div className="mb-4">
          <label className="text-sm text-gray-400 block mb-2">
            Override Reason (optional):
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this override is being applied..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm min-h-20 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded transition-colors"
          >
            Accept & Fix
          </button>
          <button
            onClick={handleOverride}
            disabled={!reason.trim()}
            className="flex-1 bg-imperial-red hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-2 rounded transition-colors"
          >
            Override (Referee)
          </button>
        </div>
      </div>
    </div>
  )
}
