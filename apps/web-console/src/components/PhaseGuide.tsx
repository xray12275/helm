import React, { useState } from 'react'
import { useMatchStore } from '../store/match-store'
import { Phase } from '../types'

const PHASE_GUIDES: Record<Phase, { title: string; steps: string[]; stratagems: Array<{name: string; cost: number}> }> = {
  [Phase.Command]: {
    title: 'Command Phase',
    steps: [
      'Grant one instruction to one unit within 6" of a Character',
      'Use Command Stratagems (costs 1 CP)',
      'Gain 1 CP if you have the strategic advantage',
    ],
    stratagems: [
      { name: 'Counter-Offensive', cost: 1 },
      { name: 'Inspiring Leader', cost: 1 },
      { name: 'Insane Bravery', cost: 2 },
    ],
  },
  [Phase.Movement]: {
    title: 'Movement Phase',
    steps: [
      'Select units and move them up to their Movement value',
      'Alternative: Advance (move up to M + d6, cannot charge or shoot)',
      'Alternative: Fall Back (move up to M, cannot charge or shoot that turn)',
      'Units cannot move within engagement range of enemy units',
    ],
    stratagems: [
      { name: 'Rapid Deployment', cost: 1 },
      { name: 'Evasive Action', cost: 1 },
      { name: 'Vanguard', cost: 2 },
    ],
  },
  [Phase.Shooting]: {
    title: 'Shooting Phase',
    steps: [
      'Select one unit to shoot with',
      'Select targets within range of weapons',
      'Declare target and which weapons are attacking',
      'Roll to hit (BS check)',
      'Roll damage for successful hits',
      'Allocate wounds to targets',
      'Target makes saving throws if applicable',
      'Repeat for other units',
    ],
    stratagems: [
      { name: 'Focused Fire', cost: 1 },
      { name: 'Suppressive Fire', cost: 2 },
    ],
  },
  [Phase.Charge]: {
    title: 'Charge Phase',
    steps: [
      'Select one unit that can charge',
      'Roll 2d6 for charge distance',
      'If any model reaches engagement range, unit is in engagement',
      'All models in unit move together into engagement',
      'Unit cannot make further moves if charge failed',
    ],
    stratagems: [
      { name: 'Heroic Intervention', cost: 1 },
      { name: 'Counter-Charge', cost: 2 },
    ],
  },
  [Phase.Fight]: {
    title: 'Fight Phase',
    steps: [
      'Active player resolves combats with their units first',
      'Select one unit in engagement',
      'Choose melee weapons to attack with',
      'Target models in engagement',
      'Roll to hit (WS check)',
      'Roll damage for successful hits',
      'Target makes saving throws',
      'Opponent responds with their units in engagement',
    ],
    stratagems: [
      { name: 'Flurry of Blows', cost: 1 },
      { name: 'Furious Charge', cost: 2 },
    ],
  },
}

export const PhaseGuide: React.FC = () => {
  const { state, showPhaseGuide } = useMatchStore()
  const [expanded, setExpanded] = useState(true)

  if (!showPhaseGuide || !state) {
    return null
  }

  const guide = PHASE_GUIDES[state.phase]

  return (
    <div className="absolute left-4 top-20 bg-chaos-black border-2 border-imperial-gold rounded w-80 shadow-lg">
      <div
        className="flex items-center justify-between p-3 cursor-pointer border-b border-imperial-gold"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="font-bold text-imperial-gold text-lg">{guide.title}</h3>
        <span className="text-xl">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-imperial-gold mb-2">
              Steps:
            </h4>
            <ol className="text-xs text-gray-300 space-y-1">
              {guide.steps.map((step, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-imperial-gold font-bold min-w-fit">
                    {idx + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h4 className="text-sm font-bold text-imperial-gold mb-2">
              Available Stratagems:
            </h4>
            <div className="space-y-1">
              {guide.stratagems.map((strat, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-xs bg-gray-900 p-2 rounded border border-gray-700"
                >
                  <span className="text-gray-100">{strat.name}</span>
                  <span className="bg-imperial-gold text-chaos-black px-2 py-1 rounded font-bold text-xs">
                    {strat.cost} CP
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-2 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-100">
            <strong>Tip:</strong> Use the event log to track all actions. Review
            the opponent's threats before choosing your units.
          </div>
        </div>
      )}
    </div>
  )
}
