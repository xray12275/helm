import { v4 as uuidv4 } from 'uuid';
import {
  MatchState,
  MatchCommand,
  MatchEvent,
  Unit,
  Phase,
  Player,
  GameSize,
  GameSizeEnum,
} from '@helm/shared-types';

/**
 * Simplified in-memory state engine for MVP.
 *
 * This is intentionally separate from services/state-engine/ which contains
 * the full event-sourced PostgreSQL implementation. Once the event-sourced
 * version is production-ready, this file will be replaced with an import
 * from @helm/state-engine.
 *
 * The state it holds IS the shared `MatchState` from @helm/shared-types, so
 * the rules engine, the event-sourced engine and this stub all agree on shape.
 *
 * TODO: Replace with @helm/state-engine once PostgreSQL event store is wired up
 */

/** Phase order for one player turn. `pre_game` is only ever the starting phase. */
const TURN_PHASES: Phase[] = ['command', 'movement', 'shooting', 'charge', 'fight', 'morale'];

export interface CreateMatchOptions {
  gameSize?: unknown;
  mission?: unknown;
}

function emptyPlayer(id: string): Player {
  return {
    id,
    name: `Player ${id.slice(0, 8)}`,
    faction: 'unknown',
    cp: 5,
    vp: 0,
    army: {
      id: uuidv4(),
      playerId: id,
      faction: 'unknown',
      detachment: '',
      units: [],
      enhancements: [],
      totalPoints: 0,
    },
  };
}

export class StateEngine {
  private matches: Map<string, MatchState> = new Map();
  private eventLogs: Map<string, MatchEvent[]> = new Map();

  /**
   * Create a new match
   */
  createMatch(player1Id: string, player2Id: string, options: CreateMatchOptions = {}): MatchState {
    const matchId = uuidv4();
    const now = new Date().toISOString();
    const parsedSize = GameSizeEnum.safeParse(options.gameSize);
    const gameSize: GameSize = parsedSize.success ? parsedSize.data : 'strike_force';

    const initialState: MatchState = {
      id: matchId,
      round: 1,
      phase: 'pre_game',
      activePlayerId: player1Id,
      players: [emptyPlayer(player1Id), emptyPlayer(player2Id)],
      terrain: [],
      objectives: [],
      turnLog: [],
      createdAt: now,
      updatedAt: now,
      gameSize,
      mission: typeof options.mission === 'string' ? options.mission : '',
      isActive: true,
    };

    this.matches.set(matchId, initialState);
    this.eventLogs.set(matchId, []);

    console.log(`Created match ${matchId}`);
    return initialState;
  }

  /**
   * Get a match state by ID
   */
  getMatch(matchId: string): MatchState | undefined {
    return this.matches.get(matchId);
  }

  /**
   * Submit an army for a player. Units carry no points in the shared schema
   * (points live on UnitProfile.pointsCosts), so the caller supplies the total.
   */
  submitArmy(matchId: string, playerId: string, units: Unit[], totalPoints?: number): MatchState | null {
    const match = this.matches.get(matchId);
    if (!match) return null;

    const player = match.players.find((p) => p.id === playerId);
    if (!player) return null;

    // Add units to the player's army (without duplicating if already present)
    const newUnits = units.filter(
      (u) => !player.army.units.some((existing) => existing.id === u.id)
    );
    player.army.units.push(...newUnits);
    if (typeof totalPoints === 'number') {
      player.army.totalPoints = totalPoints;
    }

    // Record event
    this.recordEvent(matchId, {
      type: 'army_submitted',
      playerId,
      unitCount: units.length,
      totalPoints: player.army.totalPoints,
    });

    match.updatedAt = new Date().toISOString();
    return match;
  }

  /**
   * Apply a command and update the match state
   * TODO: Integrate with RulesEngine for legality checks
   */
  applyCommand(matchId: string, command: MatchCommand): { success: boolean; newState?: MatchState; error?: string } {
    const match = this.matches.get(matchId);
    if (!match) {
      return { success: false, error: 'Match not found' };
    }

    try {
      // Simplified command application
      // In production, this would:
      // 1. Run through RulesEngine.checkLegality()
      // 2. Update unit positions/states
      // 3. Generate MatchEvent
      // 4. Persist changes

      // For MVP, we just record the command as an event
      this.recordEvent(matchId, {
        type: 'command_executed',
        commandType: command.type,
        playerId: (command as any).playerId,
      });

      match.updatedAt = new Date().toISOString();
      return { success: true, newState: match };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Advance to the next phase. From `pre_game` the first real phase is
   * `command`; after `morale` the round advances and the active player swaps.
   */
  advancePhase(matchId: string): MatchState | null {
    const match = this.matches.get(matchId);
    if (!match) return null;

    const currentIndex = TURN_PHASES.indexOf(match.phase);
    const nextIndex = (currentIndex + 1) % TURN_PHASES.length; // pre_game (-1) -> 0

    // If we wrap around, advance the round and hand the turn to the other player
    if (currentIndex === TURN_PHASES.length - 1) {
      match.round += 1;
      const next = match.players.find((p) => p.id !== match.activePlayerId);
      if (next) match.activePlayerId = next.id;
    }

    match.phase = TURN_PHASES[nextIndex];
    match.updatedAt = new Date().toISOString();

    this.recordEvent(matchId, {
      type: 'phase_advanced',
      newPhase: match.phase,
      round: match.round,
      activePlayerId: match.activePlayerId,
    });

    return match;
  }

  /**
   * Get the event log for a match
   */
  getEvents(matchId: string): MatchEvent[] {
    return this.eventLogs.get(matchId) || [];
  }

  /**
   * Record an event in the match log
   */
  recordEvent(matchId: string, eventData: any): void {
    const events = this.eventLogs.get(matchId) || [];
    const event: MatchEvent = {
      id: uuidv4(),
      matchId,
      timestamp: new Date().toISOString(),
      sequence: events.length + 1,
      playerId: 'system',
      ...eventData,
    };
    events.push(event);
    this.eventLogs.set(matchId, events);
  }

  /**
   * Apply an override to a previously blocked action
   * TODO: Implement proper override logic with audit trail
   */
  applyOverride(matchId: string, legalityResultId: string): { success: boolean; message: string } {
    const match = this.matches.get(matchId);
    if (!match) {
      return { success: false, message: 'Match not found' };
    }

    // Record override event
    this.recordEvent(matchId, {
      type: 'override_applied',
      legalityResultId,
    });

    return { success: true, message: 'Override applied and logged' };
  }
}
