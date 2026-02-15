import React, { useState } from 'react'
import { useMatchStore } from '../store/match-store'

interface RollResult {
  id: string
  timestamp: number
  numDice: number
  target: number
  results: number[]
  successes: number
  failures: number
  criticals: number
}

export const DiceRoller: React.FC = () => {
  const { showDiceRoller } = useMatchStore()
  const [numDice, setNumDice] = useState(1)
  const [target, setTarget] = useState(4)
  const [history, setHistory] = useState<RollResult[]>([])
  const [isRolling, setIsRolling] = useState(false)
  const [lastResult, setLastResult] = useState<RollResult | null>(null)

  if (!showDiceRoller) {
    return null
  }

  const performRoll = () => {
    setIsRolling(true)
    const results: number[] = []

    for (let i = 0; i < numDice; i++) {
      results.push(Math.floor(Math.random() * 6) + 1)
    }

    const successes = results.filter((r) => r >= target).length
    const failures = numDice - successes
    const criticals = results.filter((r) => r === 6).length

    const roll: RollResult = {
      id: `roll_${Date.now()}`,
      timestamp: Date.now(),
      numDice,
      target,
      results,
      successes,
      failures,
      criticals,
    }

    setLastResult(roll)
    setHistory([...history, roll])

    // Animate for 500ms
    setTimeout(() => {
      setIsRolling(false)
    }, 500)
  }

  const handleClearHistory = () => {
    setHistory([])
    setLastResult(null)
  }

  return (
    <div className="fixed bottom-4 left-4 bg-chaos-black border-2 border-imperial-gold rounded w-72 shadow-xl p-4">
      <h3 className="font-bold text-imperial-gold mb-4 text-lg">Dice Roller</h3>

      {/* Roll Controls */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="text-sm text-gray-400 block mb-1">
            Number of Dice:
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={numDice}
            onChange={(e) => setNumDice(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">
            Target Value (pass on):
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[2, 3, 4, 5, 6].map((val) => (
              <button
                key={val}
                onClick={() => setTarget(val)}
                className={`py-2 rounded font-bold text-sm transition-colors ${
                  target === val
                    ? 'bg-imperial-gold text-chaos-black'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {val}+
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={performRoll}
          disabled={isRolling}
          className="w-full bg-imperial-gold hover:bg-yellow-500 disabled:bg-gray-600 text-chaos-black font-bold py-3 rounded text-lg transition-colors"
        >
          {isRolling ? 'ROLLING...' : 'ROLL DICE'}
        </button>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className="bg-gray-900 border border-imperial-gold/50 rounded p-3 mb-4">
          <div className="text-sm mb-2">
            <span className="text-gray-400">Result:</span>
            <span className="float-right font-bold text-imperial-gold">
              {lastResult.successes} Pass / {lastResult.failures} Fail
            </span>
          </div>

          <div className="flex gap-1 flex-wrap mb-3">
            {lastResult.results.map((result, idx) => (
              <div
                key={idx}
                className={`w-8 h-8 flex items-center justify-center rounded font-bold text-sm ${
                  result >= lastResult.target
                    ? 'bg-green-600 text-white'
                    : 'bg-red-600 text-white'
                } ${result === 6 ? 'border-2 border-imperial-gold' : ''}`}
              >
                {result}
              </div>
            ))}
          </div>

          {lastResult.criticals > 0 && (
            <div className="text-xs text-imperial-gold font-bold">
              {lastResult.criticals} Critical(s)!
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-bold text-imperial-gold">History</h4>
            <button
              onClick={handleClearHistory}
              className="text-xs text-gray-400 hover:text-gray-300"
            >
              Clear
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {history.slice(-5).map((roll) => (
              <div
                key={roll.id}
                className="text-xs bg-gray-800 p-2 rounded flex justify-between"
              >
                <span className="text-gray-300">
                  {roll.numDice}d6 vs {roll.target}+
                </span>
                <span className="text-imperial-gold font-bold">
                  {roll.successes}✓
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
