import {
  MatchEvent,
  MatchState,
  UnitStatus,
  Player,
  Unit,
  Phase,
} from '@helm/shared-types';

/**
 * Pure reducer function that evolves match state by applying events.
 * This is a classic event-sourcing reducer - given a state and event,
 * it returns a new immutable state.
 *
 * @throws Error if event type is not recognized
 */
export function reduceEvent(state: MatchState, event: MatchEvent): MatchState {
  switch (event.type) {
    // ========================================================================
    // MATCH LIFECYCLE
    // ========================================================================

    case 'MatchCreated':
      return reduceMatchCreated(state, event);

    case 'ArmySubmitted':
      return reduceArmySubmitted(state, event);

    case 'MatchStarted':
      return reduceMatchStarted(state, event);

    case 'MatchEnded':
      return reduceMatchEnded(state, event);

    // ========================================================================
    // TURN/PHASE
    // ========================================================================

    case 'PhaseAdvanced':
      return reducePhaseAdvanced(state, event);

    // ========================================================================
    // UNIT ACTIONS
    // ========================================================================

    case 'UnitMoved':
      return reduceUnitMoved(state, event);

    case 'AttackDeclared':
      return reduceAttackDeclared(state, event);

    // ========================================================================
    // DICE & RESOLUTION
    // ========================================================================

    case 'DiceRolled':
      // TODO: Store dice rolls for audit trail
      return state;

    case 'AttackResolved':
      return reduceAttackResolved(state, event);

    case 'UnitDestroyed':
      return reduceUnitDestroyed(state, event);

    // ========================================================================
    // STRATAGEMS & MORALE
    // ========================================================================

    case 'StratagemUsed':
      return reduceStratagemUsed(state, event);

    case 'BattleShockTested':
      return reduceBattleShockTested(state, event);

    // ========================================================================
    // OVERRIDES & RULES
    // ========================================================================

    case 'IllegalActionBlocked':
      // Log but don't modify state
      console.log(
        `Action blocked: ${event.explanation} (Rule: ${event.ruleId})`
      );
      return state;

    case 'OverrideApplied':
      // TODO: Implement override tracking
      return state;

    // ========================================================================
    // OBJECTIVES
    // ========================================================================

    case 'ObjectiveScored':
      return reduceObjectiveScored(state, event);

    default:
      // Exhaustiveness check - TypeScript will error if we miss a case
      const _exhaustive: never = event;
      console.error('Unknown event type:', _exhaustive);
      return state;
  }
}

// ============================================================================
// MATCH LIFECYCLE REDUCERS
// ============================================================================

function reduceMatchCreated(
  state: MatchState,
  event: MatchEvent & { type: 'MatchCreated' }
): MatchState {
  const now = new Date().toISOString();

  return {
    ...state,
    id: event.matchId,
    createdAt: now,
    updatedAt: now,
    gameSize: event.gameSize,
    mission: event.mission,
    isActive: false, // Becomes active only after MatchStarted
    round: 1,
    phase: 'pre_game',
    players: event.players.map((p) => ({
      id: p.id,
      name: p.name,
      faction: p.faction,
      cp: 0, // Will be set by game size rules
      vp: 0,
      army: {
        id: '',
        playerId: p.id,
        faction: p.faction,
        detachment: '',
        units: [],
        enhancements: [],
        totalPoints: 0,
      },
    })),
  };
}

function reduceArmySubmitted(
  state: MatchState,
  event: MatchEvent & { type: 'ArmySubmitted' }
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.id === event.playerId) {
        // TODO: Fetch full army details from army database
        return {
          ...p,
          army: {
            ...p.army,
            id: event.army.id,
            faction: event.army.faction,
            detachment: event.army.detachment,
            totalPoints: event.army.totalPoints,
          },
        };
      }
      return p;
    }),
    updatedAt: event.timestamp,
  };
}

function reduceMatchStarted(
  state: MatchState,
  event: MatchEvent & { type: 'MatchStarted' }
): MatchState {
  return {
    ...state,
    isActive: true,
    phase: 'command',
    round: 1,
    updatedAt: event.timestamp,
    turnLog: [
      ...state.turnLog,
      `Match started at ${event.timestamp}`,
    ],
  };
}

function reduceMatchEnded(
  state: MatchState,
  event: MatchEvent & { type: 'MatchEnded' }
): MatchState {
  return {
    ...state,
    isActive: false,
    updatedAt: event.timestamp,
    turnLog: [
      ...state.turnLog,
      `Match ended: ${event.reason} - Winner: ${event.winnerId ?? 'Draw'}`,
    ],
  };
}

// ============================================================================
// TURN/PHASE REDUCERS
// ============================================================================

function reducePhaseAdvanced(
  state: MatchState,
  event: MatchEvent & { type: 'PhaseAdvanced' }
): MatchState {
  let updatedState = {
    ...state,
    phase: event.to as Phase,
    round: event.round,
    updatedAt: event.timestamp,
    turnLog: [
      ...state.turnLog,
      `Round ${event.round} - ${event.from} -> ${event.to}`,
    ],
  };

  // Reset unit statuses when returning to command phase
  if (event.to === 'command' && event.from !== 'command') {
    updatedState = {
      ...updatedState,
      players: updatedState.players.map((p) => ({
        ...p,
        army: {
          ...p.army,
          units: p.army.units.map((u) => ({
            ...u,
            status: {
              hasMoved: false,
              hasAdvanced: false,
              hasFallenBack: false,
              hasShot: false,
              hasCharged: false,
              isInEngagement: false,
              isBattleShocked: false,
              remainedStationary: true,
            },
          })),
        },
      })),
    };
  }

  return updatedState;
}

// ============================================================================
// UNIT ACTION REDUCERS
// ============================================================================

function reduceUnitMoved(
  state: MatchState,
  event: MatchEvent & { type: 'UnitMoved' }
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      army: {
        ...p.army,
        units: p.army.units.map((u) => {
          if (u.id === event.unitId) {
            return {
              ...u,
              position: event.to,
              status: {
                ...u.status,
                hasMoved: true,
                hasAdvanced: event.moveType === 'advance',
                hasFallenBack: event.moveType === 'fallback',
                remainedStationary: false,
              },
            };
          }
          return u;
        }),
      },
    })),
    updatedAt: event.timestamp,
  };
}

function reduceAttackDeclared(
  state: MatchState,
  _event: MatchEvent & { type: 'AttackDeclared' }
): MatchState {
  // Attack declaration doesn't immediately modify state
  // It just tracks the action in the event log
  return state;
}

// ============================================================================
// COMBAT RESOLUTION REDUCERS
// ============================================================================

function reduceAttackResolved(
  state: MatchState,
  event: MatchEvent & { type: 'AttackResolved' }
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      army: {
        ...p.army,
        units: p.army.units.map((u) => {
          if (u.id === event.defenderUnitId) {
            const newWoundsRemaining = Math.max(
              0,
              u.woundsRemaining - event.unsavedWounds
            );
            const newModelsRemaining = Math.max(
              0,
              u.modelsRemaining - event.modelsDestroyed
            );

            return {
              ...u,
              woundsRemaining: newWoundsRemaining,
              modelsRemaining: newModelsRemaining,
            };
          }
          return u;
        }),
      },
    })),
    updatedAt: event.timestamp,
    turnLog: [
      ...state.turnLog,
      `Attack resolved: ${event.hits} hits, ${event.wounds} wounds, ${event.modelsDestroyed} models destroyed`,
    ],
  };
}

function reduceUnitDestroyed(
  state: MatchState,
  event: MatchEvent & { type: 'UnitDestroyed' }
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      army: {
        ...p.army,
        units: p.army.units.map((u) => {
          if (u.id === event.unitId) {
            return {
              ...u,
              modelsRemaining: 0,
              woundsRemaining: 0,
            };
          }
          return u;
        }),
      },
    })),
    updatedAt: event.timestamp,
    turnLog: [...state.turnLog, `Unit destroyed: ${event.unitId}`],
  };
}

// ============================================================================
// STRATAGEM & MORALE REDUCERS
// ============================================================================

function reduceStratagemUsed(
  state: MatchState,
  event: MatchEvent & { type: 'StratagemUsed' }
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.id === event.playerId) {
        return {
          ...p,
          cp: Math.max(0, p.cp - event.cpSpent),
        };
      }
      return p;
    }),
    updatedAt: event.timestamp,
    turnLog: [
      ...state.turnLog,
      `Stratagem used: ${event.stratagemId} (${event.cpSpent} CP)`,
    ],
  };
}

function reduceBattleShockTested(
  state: MatchState,
  event: MatchEvent & { type: 'BattleShockTested' }
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      army: {
        ...p.army,
        units: p.army.units.map((u) => {
          if (u.id === event.unitId) {
            return {
              ...u,
              status: {
                ...u.status,
                isBattleShocked: !event.passed,
              },
            };
          }
          return u;
        }),
      },
    })),
    updatedAt: event.timestamp,
    turnLog: [
      ...state.turnLog,
      `Battle shock test: ${event.unitId} rolled ${event.roll} - ${
        event.passed ? 'Passed' : 'Failed (Battle Shocked)'
      }`,
    ],
  };
}

// ============================================================================
// OBJECTIVE REDUCERS
// ============================================================================

function reduceObjectiveScored(
  state: MatchState,
  event: MatchEvent & { type: 'ObjectiveScored' }
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.id === event.scoringPlayerId) {
        return {
          ...p,
          vp: p.vp + event.points,
        };
      }
      return p;
    }),
    objectives: state.objectives.map((obj) => {
      if (obj.id === event.objectiveId) {
        return {
          ...obj,
          controlledBy: event.scoringPlayerId,
          points: event.points,
        };
      }
      return obj;
    }),
    updatedAt: event.timestamp,
    turnLog: [
      ...state.turnLog,
      `Objective scored: ${event.points} VP for player ${event.scoringPlayerId}`,
    ],
  };
}
