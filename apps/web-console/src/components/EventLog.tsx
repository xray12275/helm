import React, { useState, useEffect, useRef } from 'react'
import { useMatchStore } from '../store/match-store'
import { MatchEventType } from '../types'

const EVENT_COLORS: Record<MatchEventType, string> = {
  [MatchEventType.UnitMoved]: 'bg-blue-900 border-blue-700',
  [MatchEventType.UnitAdvanced]: 'bg-blue-900 border-blue-700',
  [MatchEventType.UnitFallenBack]: 'bg-yellow-900 border-yellow-700',
  [MatchEventType.UnitDestroyed]: 'bg-red-900 border-red-700',
  [MatchEventType.UnitBattleshocked]: 'bg-red-900 border-red-700',
  [MatchEventType.ObjectiveClaimed]: 'bg-green-900 border-green-700',
  [MatchEventType.DamageRolled]: 'bg-orange-900 border-orange-700',
  [MatchEventType.SavingThrowRolled]: 'bg-purple-900 border-purple-700',
  [MatchEventType.VictoryPointsGained]: 'bg-green-900 border-green-700',
  [MatchEventType.IllegalActionBlocked]: 'bg-red-900 border-red-700',
  [MatchEventType.CommandUsed]: 'bg-yellow-900 border-yellow-700',
  [MatchEventType.PhaseAdvanced]: 'bg-cyan-900 border-cyan-700',
  [MatchEventType.RoundStarted]: 'bg-cyan-900 border-cyan-700',
  [MatchEventType.MatchEnded]: 'bg-purple-900 border-purple-700',
}

const EVENT_ICONS: Record<MatchEventType, string> = {
  [MatchEventType.UnitMoved]: '🏃',
  [MatchEventType.UnitAdvanced]: '💨',
  [MatchEventType.UnitFallenBack]: '🔙',
  [MatchEventType.UnitDestroyed]: '💀',
  [MatchEventType.UnitBattleshocked]: '😵',
  [MatchEventType.ObjectiveClaimed]: '🚩',
  [MatchEventType.DamageRolled]: '🎲',
  [MatchEventType.SavingThrowRolled]: '⛑️',
  [MatchEventType.VictoryPointsGained]: '⭐',
  [MatchEventType.IllegalActionBlocked]: '🚫',
  [MatchEventType.CommandUsed]: '📋',
  [MatchEventType.PhaseAdvanced]: '⏭️',
  [MatchEventType.RoundStarted]: '🔔',
  [MatchEventType.MatchEnded]: '🏁',
}

export const EventLog: React.FC = () => {
  const { events, showEventLog } = useMatchStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<MatchEventType | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  const filteredEvents = filterType
    ? events.filter((e) => e.type === filterType)
    : events

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatEventDescription = (event: any): string => {
    switch (event.type) {
      case MatchEventType.UnitMoved:
        return `Unit moved to new position`
      case MatchEventType.UnitAdvanced:
        return `Unit advanced in movement`
      case MatchEventType.UnitFallenBack:
        return `Unit fell back`
      case MatchEventType.UnitDestroyed:
        return `Unit was destroyed`
      case MatchEventType.UnitBattleshocked:
        return `Unit became battleshocked`
      case MatchEventType.ObjectiveClaimed:
        return `Objective was claimed`
      case MatchEventType.DamageRolled:
        return `Damage: ${event.data.total || '?'} wound(s)`
      case MatchEventType.SavingThrowRolled:
        return `Saving throw: ${event.data.successful ? 'Success' : 'Failed'}`
      case MatchEventType.VictoryPointsGained:
        return `Gained ${event.data.points} victory points`
      case MatchEventType.IllegalActionBlocked:
        return `Action blocked: ${event.data.reason || 'Rule violation'}`
      case MatchEventType.CommandUsed:
        return `Command used: ${event.data.command || 'Unknown'}`
      case MatchEventType.PhaseAdvanced:
        return `Advanced to ${event.data.phase || 'next phase'}`
      case MatchEventType.RoundStarted:
        return `Round ${event.data.round || '?'} started`
      case MatchEventType.MatchEnded:
        return `Match ended`
      default:
        return 'Unknown event'
    }
  }

  if (!showEventLog) {
    return null
  }

  return (
    <div className="h-48 bg-chaos-black border-t-2 border-imperial-gold flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="font-bold text-imperial-gold">Event Log</h3>
        <div className="flex gap-2">
          <select
            value={filterType || ''}
            onChange={(e) =>
              setFilterType((e.target.value as MatchEventType) || null)
            }
            className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
          >
            <option value="">All Events</option>
            {Object.values(MatchEventType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            {filteredEvents.length} event(s)
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1 p-2 bg-gray-950"
      >
        {filteredEvents.length === 0 ? (
          <div className="text-center text-gray-500 py-4 text-sm">
            No events yet
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`border-l-2 p-2 rounded text-xs cursor-pointer transition-colors ${
                EVENT_COLORS[event.type] || 'bg-gray-800 border-gray-700'
              } hover:opacity-80`}
              onClick={() =>
                setExpandedId(expandedId === event.id ? null : event.id)
              }
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{EVENT_ICONS[event.type]}</span>
                <div className="flex-1">
                  <div className="font-bold text-gray-100">
                    {formatEventDescription(event)}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {formatTime(event.timestamp)}
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === event.id && (
                <div className="mt-2 ml-7 pt-2 border-t border-gray-700/50 text-gray-300">
                  <div>
                    <span className="text-gray-500">ID:</span> {event.id.substring(0, 8)}
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span> {event.type}
                  </div>
                  {event.unitId && (
                    <div>
                      <span className="text-gray-500">Unit:</span> {event.unitId}
                    </div>
                  )}
                  {Object.keys(event.data).length > 0 && (
                    <div className="mt-1">
                      <span className="text-gray-500">Data:</span>
                      <pre className="text-xs bg-gray-900 p-1 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
