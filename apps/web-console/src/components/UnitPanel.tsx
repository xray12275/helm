import React from 'react'
import { useMatchStore } from '../store/match-store'
import { Phase, CommandType } from '../types'
import { useWebSocket } from '../hooks/useWebSocket'

export const UnitPanel: React.FC = () => {
  const { state, selectedUnitId } = useMatchStore()
  const { sendCommand } = useWebSocket()

  if (!selectedUnitId || !state) {
    return (
      <div className="w-80 bg-chaos-black border-l border-imperial-gold p-4 flex items-center justify-center text-gray-400">
        Select a unit to view details
      </div>
    )
  }

  // Find selected unit
  let selectedUnit = null
  let selectedPlayer = null
  for (const player of state.players) {
    const unit = player.units.find((u) => u.id === selectedUnitId)
    if (unit) {
      selectedUnit = unit
      selectedPlayer = player
      break
    }
  }

  if (!selectedUnit || !selectedPlayer) {
    return (
      <div className="w-80 bg-chaos-black border-l border-imperial-gold p-4 flex items-center justify-center text-gray-400">
        Unit not found
      </div>
    )
  }

  const handleAction = (action: string) => {
    if (!state) return

    let commandType: CommandType | null = null

    if (action === 'move') commandType = CommandType.MoveUnit
    if (action === 'advance') commandType = CommandType.AdvanceUnit
    if (action === 'fallback') commandType = CommandType.FallBackUnit
    if (action === 'attack') commandType = CommandType.DeclareAttack
    if (action === 'charge') commandType = CommandType.DeclareCharge
    if (action === 'fight') commandType = CommandType.FightEnemy

    if (commandType) {
      sendCommand({
        type: commandType,
        matchId: state.id,
        playerId: selectedPlayer.id,
        data: {
          unitId: selectedUnit.id,
        },
      })
    }
  }

  const getActionButtons = () => {
    const buttons = []

    if (state.phase === Phase.Movement) {
      buttons.push(
        <button
          key="move"
          onClick={() => handleAction('move')}
          className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm font-bold rounded"
        >
          Move
        </button>
      )
      buttons.push(
        <button
          key="advance"
          onClick={() => handleAction('advance')}
          className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm font-bold rounded"
        >
          Advance
        </button>
      )
      buttons.push(
        <button
          key="fallback"
          onClick={() => handleAction('fallback')}
          className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm font-bold rounded"
        >
          Fall Back
        </button>
      )
    } else if (state.phase === Phase.Shooting) {
      buttons.push(
        <button
          key="attack"
          onClick={() => handleAction('attack')}
          className="w-full bg-imperial-red hover:bg-red-700 px-3 py-2 text-sm font-bold rounded"
        >
          Declare Attack
        </button>
      )
    } else if (state.phase === Phase.Charge) {
      buttons.push(
        <button
          key="charge"
          onClick={() => handleAction('charge')}
          className="w-full bg-imperial-red hover:bg-red-700 px-3 py-2 text-sm font-bold rounded"
        >
          Declare Charge
        </button>
      )
    } else if (state.phase === Phase.Fight) {
      buttons.push(
        <button
          key="fight"
          onClick={() => handleAction('fight')}
          className="w-full bg-imperial-red hover:bg-red-700 px-3 py-2 text-sm font-bold rounded"
        >
          Fight
        </button>
      )
    }

    return buttons
  }

  return (
    <div className="w-80 bg-chaos-black border-l border-imperial-gold p-4 overflow-y-auto max-h-screen flex flex-col">
      {/* Header */}
      <div className="mb-4 pb-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-imperial-gold">
              {selectedUnit.name} {selectedUnit.letter}
            </h2>
            <p className="text-xs text-gray-400">{selectedUnit.faction}</p>
          </div>
          {selectedUnit.isWarlord && (
            <span className="bg-imperial-gold text-chaos-black px-2 py-1 text-xs font-bold rounded">
              Warlord
            </span>
          )}
        </div>
      </div>

      {/* Status and Wounds */}
      <div className="mb-4 pb-4 border-b border-gray-700">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-400">Models:</span>
            <div className="font-bold">
              {selectedUnit.models}/{selectedUnit.maxModels}
            </div>
          </div>
          <div>
            <span className="text-gray-400">Wounds:</span>
            <div className="font-bold">
              {selectedUnit.wounds}/{selectedUnit.maxWounds}
            </div>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedUnit.moved && (
            <span className="text-xs bg-cyan-600 text-white px-2 py-1 rounded">
              Moved
            </span>
          )}
          {selectedUnit.advanced && (
            <span className="text-xs bg-cyan-600 text-white px-2 py-1 rounded">
              Advanced
            </span>
          )}
          {selectedUnit.fallenBack && (
            <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
              Fell Back
            </span>
          )}
          {selectedUnit.inEngagement && (
            <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded">
              In Combat
            </span>
          )}
          {selectedUnit.battleshocked && (
            <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
              Battleshocked
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 pb-4 border-b border-gray-700">
        <h3 className="text-sm font-bold text-imperial-gold mb-2">Stats</h3>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-800 p-2 rounded">
            <div className="text-gray-400">M</div>
            <div className="font-bold">{selectedUnit.movement}"</div>
          </div>
          <div className="bg-gray-800 p-2 rounded">
            <div className="text-gray-400">T</div>
            <div className="font-bold">{selectedUnit.toughness}</div>
          </div>
          <div className="bg-gray-800 p-2 rounded">
            <div className="text-gray-400">Sv</div>
            <div className="font-bold">{selectedUnit.save}+</div>
          </div>
          <div className="bg-gray-800 p-2 rounded">
            <div className="text-gray-400">Ld</div>
            <div className="font-bold">{selectedUnit.leadership}</div>
          </div>
          <div className="bg-gray-800 p-2 rounded">
            <div className="text-gray-400">OC</div>
            <div className="font-bold">{selectedUnit.objectiveControl}</div>
          </div>
        </div>
      </div>

      {/* Weapons */}
      {selectedUnit.weapons.length > 0 && (
        <div className="mb-4 pb-4 border-b border-gray-700">
          <h3 className="text-sm font-bold text-imperial-gold mb-2">
            Weapons
          </h3>
          <div className="space-y-2">
            {selectedUnit.weapons.map((weapon) => (
              <div
                key={weapon.id}
                className="bg-gray-800 p-2 rounded text-xs"
              >
                <div className="font-bold text-gray-100">{weapon.name}</div>
                <div className="text-gray-400 grid grid-cols-2 gap-1 mt-1">
                  <div>Range: {weapon.range}"</div>
                  <div>A: {weapon.attacks}</div>
                  <div>BS: {weapon.ballisticSkill}+</div>
                  <div>S: {weapon.strength}</div>
                  <div>AP: {weapon.armorPenetration}</div>
                  <div>D: {weapon.damage}</div>
                </div>
                {weapon.abilities.length > 0 && (
                  <div className="text-gray-500 mt-1">
                    {weapon.abilities.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abilities */}
      {selectedUnit.abilities.length > 0 && (
        <div className="mb-4 pb-4 border-b border-gray-700">
          <h3 className="text-sm font-bold text-imperial-gold mb-2">
            Abilities
          </h3>
          <div className="space-y-2">
            {selectedUnit.abilities.map((ability, idx) => (
              <div key={idx} className="text-xs text-gray-300 bg-gray-800 p-2 rounded">
                {ability}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhancements */}
      {selectedUnit.enhancements.length > 0 && (
        <div className="mb-4 pb-4 border-b border-gray-700">
          <h3 className="text-sm font-bold text-imperial-gold mb-2">
            Enhancements
          </h3>
          <div className="space-y-1">
            {selectedUnit.enhancements.map((enh, idx) => (
              <div key={idx} className="text-xs text-imperial-gold bg-gray-900 p-2 rounded border border-imperial-gold/30">
                {enh}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap mt-auto pt-4 border-t border-gray-700">
        {getActionButtons()}
      </div>
    </div>
  )
}
