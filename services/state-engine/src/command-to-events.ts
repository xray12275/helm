import { v4 as uuidv4 } from 'uuid';
import {
  MatchCommand,
  MatchEvent,
  MatchState,
  UnitMoved,
  AttackDeclared,
  PhaseAdvanced,
  Phase,
  PhaseEnum,
} from '@helm/shared-types';

/**
 * Converts a validated user command into one or more events.
 * This is the primary way commands are translated into the event log.
 *
 * @throws Error if command is incomplete or invalid for current state
 */
export function commandToEvents(
  state: MatchState,
  command: MatchCommand
): MatchEvent[] {
  const timestamp = new Date().toISOString();

  switch (command.type) {
    // ========================================================================
    // MOVEMENT COMMANDS
    // ========================================================================

    case 'MoveUnit': {
      const event: UnitMoved = {
        type: 'UnitMoved',
        id: uuidv4(),
        matchId: command.matchId,
        timestamp,
        sequence: 0, // Will be set by event store
        playerId: command.playerId,
        unitId: command.unitId,
        from: findUnitPosition(state, command.unitId) || {
          x: 0,
          y: 0,
          tableInches: { x: 0, y: 0 },
        },
        to: command.destination,
        moveType: command.moveType,
        distanceMoved: calculateDistance(
          findUnitPosition(state, command.unitId) || {
            x: 0,
            y: 0,
            tableInches: { x: 0, y: 0 },
          },
          command.destination
        ),
      };
      return [event];
    }

    // ========================================================================
    // COMBAT COMMANDS
    // ========================================================================

    case 'DeclareAttack': {
      const event: AttackDeclared = {
        type: 'AttackDeclared',
        id: uuidv4(),
        matchId: command.matchId,
        timestamp,
        sequence: 0,
        playerId: command.playerId,
        attackerUnitId: command.attackerUnitId,
        defenderUnitId: command.defenderUnitId,
        weaponIds: command.weaponIds,
      };
      return [event];
    }

    case 'RollDice': {
      // Generate random dice rolls
      const dice: number[] = [];
      for (let i = 0; i < command.diceCount; i++) {
        dice.push(Math.floor(Math.random() * 6) + 1);
      }

      // Count successes based on target value
      const results = dice.map((d) => (d >= command.targetValue ? 1 : 0));

      const event = {
        type: 'DiceRolled' as const,
        id: uuidv4(),
        matchId: command.matchId,
        timestamp,
        sequence: 0,
        playerId: command.playerId,
        rollId: uuidv4(),
        purpose: command.purpose,
        diceCount: command.diceCount,
        dice,
        results,
        seed: `${Date.now()}-${Math.random()}`, // Simple seed for replay
      };
      return [event];
    }

    // ========================================================================
    // STRATAGEM COMMANDS
    // ========================================================================

    case 'UseStratagem': {
      const event = {
        type: 'StratagemUsed' as const,
        id: uuidv4(),
        matchId: command.matchId,
        timestamp,
        sequence: 0,
        playerId: command.playerId,
        stratagemId: command.stratagemId,
        targetUnitIds: command.targetUnitIds,
        cpSpent: command.cpSpent,
      };
      return [event];
    }

    // ========================================================================
    // PHASE ADVANCEMENT
    // ========================================================================

    case 'AdvancePhase': {
      const currentPhase = state.phase;
      const nextPhase = getNextPhase(currentPhase, state.round);
      let roundNumber = state.round;

      // Increment round if we're looping back to command phase
      if (nextPhase === 'command' && currentPhase !== 'command') {
        roundNumber += 1;
      }

      const event: PhaseAdvanced = {
        type: 'PhaseAdvanced',
        id: uuidv4(),
        matchId: command.matchId,
        timestamp,
        sequence: 0,
        playerId: command.playerId,
        from: currentPhase as Phase,
        to: nextPhase as Phase,
        round: roundNumber,
      };
      return [event];
    }

    // ========================================================================
    // OBJECTIVE SCORING
    // ========================================================================

    case 'ScoreObjective': {
      const event = {
        type: 'ObjectiveScored' as const,
        id: uuidv4(),
        matchId: command.matchId,
        timestamp,
        sequence: 0,
        playerId: command.playerId,
        objectiveId: command.objectiveId,
        scoringPlayerId: command.playerId,
        points: command.points,
        round: state.round,
      };
      return [event];
    }

    // ========================================================================
    // ADMIN COMMANDS
    // ========================================================================

    case 'ApplyOverride': {
      const event = {
        type: 'OverrideApplied' as const,
        id: uuidv4(),
        matchId: command.matchId,
        timestamp,
        sequence: 0,
        playerId: command.playerId,
        originalBlockedEventId: command.blockedEventId,
        reason: command.reason,
        approvedBy: command.playerId,
      };
      return [event];
    }

    case 'QueryRule': {
      // Rule queries don't produce events - they're read-only
      // This should be handled by a separate service
      console.log(`Rule query: ${command.query}`);
      return [];
    }

    // ========================================================================
    // SETUP COMMANDS
    // ========================================================================

    case 'SubmitArmy': {
      const event = {
        type: 'ArmySubmitted' as const,
        id: uuidv4(),
        matchId: command.matchId,
        timestamp,
        sequence: 0,
        playerId: command.playerId,
        army: {
          id: command.army.id,
          faction: command.army.faction,
          detachment: command.army.detachment,
          totalPoints: command.army.totalPoints,
          unitCount: command.army.units.length,
        },
      };
      return [event];
    }

    default:
      // Exhaustiveness check
      const _exhaustive: never = command;
      throw new Error(`Unknown command type: ${_exhaustive}`);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine the next game phase based on current phase
 */
function getNextPhase(currentPhase: Phase, _round: number): Phase {
  const phaseSequence: Phase[] = [
    'command',
    'movement',
    'shooting',
    'charge',
    'fight',
    'morale',
  ];

  const currentIndex = phaseSequence.indexOf(currentPhase);
  if (currentIndex === -1) {
    throw new Error(`Unknown phase: ${currentPhase}`);
  }

  const nextIndex = (currentIndex + 1) % phaseSequence.length;
  return phaseSequence[nextIndex];
}

/**
 * Find the current position of a unit
 */
function findUnitPosition(state: MatchState, unitId: string) {
  for (const player of state.players) {
    const unit = player.army.units.find((u) => u.id === unitId);
    if (unit) {
      return unit.position;
    }
  }
  return null;
}

/**
 * Calculate distance between two positions (in inches)
 */
function calculateDistance(from: any, to: any): number {
  const dx = to.tableInches.x - from.tableInches.x;
  const dy = to.tableInches.y - from.tableInches.y;
  return Math.sqrt(dx * dx + dy * dy);
}
