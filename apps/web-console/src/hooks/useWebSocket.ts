import { useEffect, useRef, useCallback } from 'react'
import { useMatchStore } from '../store/match-store'
import { MatchState, MatchEvent, WebSocketMessage, GameCommand, CommandType } from '../types'

export interface UseWebSocketReturn {
  sendCommand(command: Omit<GameCommand, 'id' | 'timestamp'>): void
  isConnected: boolean
}

const WS_URL = 'ws://localhost:3000/ws'
const RECONNECT_INTERVAL = 3000
const RECONNECT_MAX_ATTEMPTS = 10

export const useWebSocket = (): UseWebSocketReturn => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const matchIdRef = useRef<string | null>(null)

  const {
    matchId,
    setConnected,
    updateState,
    addEvent,
    showOverride,
  } = useMatchStore()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        console.log('WebSocket connected')
        setConnected(true)
        reconnectAttemptsRef.current = 0

        // Subscribe to match if we have a match ID
        if (matchIdRef.current) {
          const message: WebSocketMessage = {
            type: 'subscribe',
            matchId: matchIdRef.current,
          }
          ws.send(JSON.stringify(message))
        }
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)

          if (message.type === 'state_update') {
            updateState(message.state)
          } else if (message.type === 'event') {
            addEvent(message.event)

            // Show override modal if illegal action was blocked
            if (message.event.type === 'IllegalActionBlocked') {
              showOverride(message.event)
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setConnected(false)

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < RECONNECT_MAX_ATTEMPTS) {
          reconnectAttemptsRef.current++
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(
              `Reconnecting... (attempt ${reconnectAttemptsRef.current})`
            )
            connect()
          }, RECONNECT_INTERVAL)
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      setConnected(false)
    }
  }, [setConnected, updateState, addEvent, showOverride])

  const sendCommand = useCallback(
    (
      command: Omit<GameCommand, 'id' | 'timestamp'>
    ) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not connected, cannot send command')
        return
      }

      const fullCommand: GameCommand = {
        ...command,
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      }

      wsRef.current.send(JSON.stringify(fullCommand))
    },
    []
  )

  // Initial connection
  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  // Subscribe to match when matchId changes
  useEffect(() => {
    matchIdRef.current = matchId

    if (matchId && wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: 'subscribe',
        matchId,
      }
      wsRef.current.send(JSON.stringify(message))
    }
  }, [matchId])

  return {
    sendCommand,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  }
}
