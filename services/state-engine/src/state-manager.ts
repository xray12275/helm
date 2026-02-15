import { v4 as uuidv4 } from 'uuid';
import {
  MatchCommand,
  MatchEvent,
  MatchState,
  CommandAccepted,
  CommandBlocked,
  LegalityResult,
  IllegalActionBlocked,
} from '@helm/shared-types';
import { EventStore } from './event-store';
import { reduceEvent } from './reducer';
import { commandToEvents } from './command-to-events';

/**
 * State Manager: Orchestrates event storage and state reconstruction.
 * Implements the event-sourcing pattern with command handling.
 */
export class StateManager {
  private eventStore: EventStore;
  private stateCache: Map<string, { state: MatchState; lastSequence: number }> =
    new Map();

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
  }

  /**
   * Get the current state of a match by replaying all events.
   * Uses caching to avoid replaying from the beginning on every call.
   */
  async getState(matchId: string): Promise<MatchState> {
    const cached = this.stateCache.get(matchId);

    if (cached) {
      // Get any new events since last cache
      const newEvents = await this.eventStore.getEvents(
        matchId,
        cached.lastSequence
      );

      if (newEvents.length === 0) {
        return cached.state;
      }

      // Replay only new events
      let state = cached.state;
      for (const event of newEvents) {
        state = reduceEvent(state, event);
      }

      // Update cache
      const latestSequence = await this.eventStore.getLatestSequence(matchId);
      this.stateCache.set(matchId, {
        state,
        lastSequence: latestSequence,
      });

      return state;
    }

    // Cold start: replay from beginning
    const events = await this.eventStore.getEvents(matchId);

    if (events.length === 0) {
      throw new Error(`No match found with ID: ${matchId}`);
    }

    // Create initial state from MatchCreated event
    const firstEvent = events[0];
    if (firstEvent.type !== 'MatchCreated') {
      throw new Error('First event must be MatchCreated');
    }

    let state = createInitialState(firstEvent);

    // Replay all events
    for (const event of events) {
      state = reduceEvent(state, event);
    }

    // Cache the result
    const latestSequence = await this.eventStore.getLatestSequence(matchId);
    this.stateCache.set(matchId, {
      state,
      lastSequence: latestSequence,
    });

    return state;
  }

  /**
   * Process a command: validate, generate events, store, return result
   *
   * Workflow:
   * 1. Get current state
   * 2. Run legality check
   * 3. If illegal → store IllegalActionBlocked event, return CommandBlocked
   * 4. If legal → convert command to events, store them, return CommandAccepted
   */
  async processCommand(
    matchId: string,
    command: MatchCommand,
    legalityCheck: (state: MatchState, cmd: MatchCommand) => LegalityResult
  ): Promise<CommandAccepted | CommandBlocked> {
    try {
      const state = await this.getState(matchId);

      // Run legality check
      const legality = legalityCheck(state, command);

      if (!legality.isLegal) {
        // Store the blocked action event
        const blockedEvent: IllegalActionBlocked = {
          type: 'IllegalActionBlocked',
          id: uuidv4(),
          matchId,
          timestamp: new Date().toISOString(),
          sequence: 0, // Will be set by event store
          playerId: command.playerId,
          attemptedCommandType: command.type,
          ruleId: legality.ruleId ?? 'UNKNOWN',
          explanation: legality.explanation,
          suggestedFix: legality.suggestedFix,
        };

        await this.eventStore.append(matchId, blockedEvent);

        return {
          status: 'blocked',
          commandId: command.id,
          ruleId: legality.ruleId ?? 'UNKNOWN',
          explanation: legality.explanation,
          suggestedFix: legality.suggestedFix,
          timestamp: new Date().toISOString(),
        };
      }

      // Convert command to events
      const events = commandToEvents(state, command);

      // Append all events to store
      for (const event of events) {
        await this.eventStore.append(matchId, event);
      }

      // Invalidate cache so next read gets fresh state
      this.stateCache.delete(matchId);

      return {
        status: 'accepted',
        commandId: command.id,
        events,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error processing command:', error);
      throw error;
    }
  }

  /**
   * Undo the last event by replaying all but the last
   * This is destructive - it doesn't store an "undo" event, but rather
   * creates a new state by replaying without the last event.
   *
   * TODO: Implement proper undo via an UndoRequested event type
   */
  async undo(matchId: string): Promise<MatchState> {
    const events = await this.eventStore.getEvents(matchId);

    if (events.length === 0) {
      throw new Error('No events to undo');
    }

    // Replay all but the last event
    const firstEvent = events[0];
    if (firstEvent.type !== 'MatchCreated') {
      throw new Error('First event must be MatchCreated');
    }

    let state = createInitialState(firstEvent);

    // Replay events except the last one
    for (let i = 0; i < events.length - 1; i++) {
      state = reduceEvent(state, events[i]);
    }

    // Invalidate cache
    this.stateCache.delete(matchId);

    return state;
  }

  /**
   * Clear the cache for a specific match
   */
  invalidateCache(matchId: string): void {
    this.stateCache.delete(matchId);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.stateCache.clear();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create initial match state from MatchCreated event
 */
function createInitialState(
  event: MatchEvent & { type: 'MatchCreated' }
): MatchState {
  const now = new Date().toISOString();

  return {
    id: event.matchId,
    round: 1,
    phase: 'pre_game',
    activePlayerId: event.players[0]?.id ?? '',
    players: event.players.map((p) => ({
      id: p.id,
      name: p.name,
      faction: p.faction,
      cp: 0,
      vp: 0,
      army: {
        id: uuidv4(),
        playerId: p.id,
        faction: p.faction,
        detachment: '',
        units: [],
        enhancements: [],
        totalPoints: 0,
      },
    })),
    terrain: [],
    objectives: [],
    turnLog: [],
    createdAt: now,
    updatedAt: now,
    gameSize: event.gameSize,
    mission: event.mission,
    isActive: false,
  };
}
