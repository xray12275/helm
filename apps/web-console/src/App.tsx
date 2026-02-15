import React, { useState, useEffect } from 'react'
import { useMatchStore } from './store/match-store'
import { useWebSocket } from './hooks/useWebSocket'
import { MatchState, GameSize } from './types'
import { MatchHeader } from './components/MatchHeader'
import { BattlefieldMap } from './components/BattlefieldMap'
import { UnitPanel } from './components/UnitPanel'
import { EventLog } from './components/EventLog'
import { PhaseGuide } from './components/PhaseGuide'
import { DiceRoller } from './components/DiceRoller'
import { OverrideModal } from './components/OverrideModal'
import { VoiceIndicator } from './components/VoiceIndicator'

type Screen = 'home' | 'match'

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('home')
  const [gameSize, setGameSize] = useState<GameSize>(GameSize.Onslaught)
  const [joinCode, setJoinCode] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const { matchId, state, setMatchId } = useMatchStore()
  const { isConnected } = useWebSocket()

  // Switch to match screen when a match is loaded
  useEffect(() => {
    if (state && screen === 'home') {
      setScreen('match')
    }
  }, [state, screen])

  const handleCreateMatch = () => {
    // Generate a match ID and set it
    const newMatchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setMatchId(newMatchId)
    setErrorMessage('')
    // WebSocket hook will automatically subscribe to this match
  }

  const handleJoinMatch = () => {
    if (!joinCode.trim()) {
      setErrorMessage('Please enter a match code')
      return
    }
    setMatchId(joinCode.trim())
    setErrorMessage('')
  }

  if (screen === 'match' && state) {
    return (
      <div className="flex flex-col w-screen h-screen bg-gray-950 text-gray-100">
        <MatchHeader />

        <div className="flex flex-1 overflow-hidden">
          <BattlefieldMap />
          <UnitPanel />
        </div>

        <EventLog />

        {/* Overlay Components */}
        <PhaseGuide />
        <DiceRoller />
        <OverrideModal />
        <VoiceIndicator />

        {/* Match Info Footer */}
        <div className="absolute top-4 right-4 text-xs text-gray-500 bg-black/50 px-3 py-2 rounded">
          {isConnected ? (
            <span className="text-green-500">● Connected</span>
          ) : (
            <span className="text-red-500">● Disconnected</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-chaos-black via-gray-900 to-chaos-black flex items-center justify-center">
      <div className="max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-imperial-gold mb-2">HELM</h1>
          <p className="text-xl text-gray-400">
            Warhammer 40K Referee Console
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Desktop companion for real-time match management
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-chaos-black border-2 border-imperial-gold rounded-lg p-8 shadow-2xl">
          {/* Connection Status */}
          <div className="mb-6 p-3 rounded border border-gray-700 flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-300">
              {isConnected
                ? 'Connected to API Gateway'
                : 'Attempting to connect...'}
            </span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-3 rounded border border-imperial-red bg-red-900/20 text-imperial-red text-sm">
              {errorMessage}
            </div>
          )}

          {/* Create Match Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-imperial-gold mb-4">
              Create New Match
            </h2>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Game Size:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[GameSize.Incursion, GameSize.Onslaught, GameSize.Apocalypse].map(
                  (size) => (
                    <button
                      key={size}
                      onClick={() => setGameSize(size)}
                      className={`py-3 px-4 rounded font-bold transition-colors ${
                        gameSize === size
                          ? 'bg-imperial-gold text-chaos-black'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {size}
                    </button>
                  )
                )}
              </div>
            </div>

            <button
              onClick={handleCreateMatch}
              className="w-full bg-imperial-gold hover:bg-yellow-500 text-chaos-black font-bold py-3 rounded text-lg transition-colors"
            >
              Create Match
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 border-t border-gray-700" />
            <span className="text-gray-500 text-sm">OR</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>

          {/* Join Match Section */}
          <div>
            <h2 className="text-xl font-bold text-imperial-gold mb-4">
              Join Existing Match
            </h2>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Match Code:
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter match code from iPhone scanner..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 text-white placeholder-gray-600 focus:border-imperial-gold"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleJoinMatch()
                  }
                }}
              />
            </div>

            <button
              onClick={handleJoinMatch}
              className="w-full bg-imperial-gold hover:bg-yellow-500 text-chaos-black font-bold py-3 rounded text-lg transition-colors"
            >
              Join Match
            </button>
          </div>

          {/* Info Section */}
          <div className="mt-8 p-4 bg-blue-900/20 border border-blue-700 rounded text-sm text-blue-100">
            <strong>How to Use:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Create a new match for your game</li>
              <li>iPhone user will scan the match code</li>
              <li>Battlefield appears on this screen in real-time</li>
              <li>Manage phases, events, and scoring from here</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          <p>Helm Web Console v0.1.0</p>
          <p>For Warhammer 40K 10th Edition</p>
        </div>
      </div>
    </div>
  )
}

export default App
