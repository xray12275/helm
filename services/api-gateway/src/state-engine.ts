import { v4 as uuidv4 } from 'uuid';
import { MatchState, MatchCommand, MatchEvent, Unit, Phase, Player } from '@helm/shared-types';

/**
 * Simplified in-memory state engine for MVP.
 *
 * This is intentionally separate from services/state-engine/ which contains
 * the full event-sourced PostgreSQL implementation. Once the event-sourced
 * version is production-ready, this file will be replaced with an import
 * from @helm/state-engine.
 *
 * TODO: Replace with @helm/state-engine once PostgreSQL event store is wired up
 */
export class StateEngine {
  private matches: Map<string, MatchState> = new Map();
  private eventLogs: Map<string, MatchEvent[]> = new Map();

  /**
   * Create a new match
   */
  createMatch(player1Id: string, player2Id: string): MatchState {
    const matchId = uuidv4();

    const initialState: MatchState = {
      id: matchId,
      status: 'setup',
      currentPhase: 'movement',
      currentRound: 1,
      players: [
        {
          id: player1Id,
          name: `Player ${player1Id.slice(0, 8)}`,
          commandPoints: 5,
          stratagems: [],
          armyPoints: 0,
          score: 0,
        },
        {
          id: player2Id,
          name: `Player ${player2Id.slice(0, 8)}`,
          commandPoints: 5,
          stratagems: [],
          armyPoints: 0,
          score: 0,
        },
      ],
      units: [],
      terrain: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
   * Submit an army for a player
   */
  submitArmy(matchId: string, playerId: string, units: Unit[]): MatchState | null {
    const match = this.matches.get(matchId);
    if (!match) return null;

    // Calculate total points
    const totalPoints = units.reduce((sum, unit) => sum + (unit.points || 0), 0);

    // Add units to the match (without duplicating if already present)
    const newUnits = units.filter(
      (u) => !match.units.some((existing) => existing.id === u.id)
    );
    match.units.push(...newUnits);

    // Update player army points
    const player = match.players.find((p) => p.id === playerId);
    if (player) {
      player.armyPoints = totalPoints;
    }

    // Record event
    this.recordEvent(matchId, {
      type: 'army_submitted',
      playerId,
      unitCount: units.length,
      totalPoints,
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
   * Advance to the next phase
   */
  advancePhase(matchId: string): MatchState | null {
    const match = this.matches.get(matchId);
    if (!match) return null;

    const phases: Phase[] = ['movement', 'psychic', 'shooting', 'charge', 'fight', 'morale'];
    const currentIndex = phases.indexOf(match.currentPhase);
    const nextIndex = (currentIndex + 1) % phases.length;

    // If we wrap around, advance the round
    if (nextIndex === 0) {
      match.currentRound += 1;
    }

    match.currentPhase = phases[nextIndex];
    match.updatedAt = new Date().toISOString();

    this.recordEvent(matchId, {
      type: 'phase_advanced',
      newPhase: match.currentPhase,
      round: match.currentRound,
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
