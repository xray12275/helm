import { Pool, QueryResult } from 'pg';
import { MatchEvent, MatchEventSchema } from '@helm/shared-types';

/**
 * PostgreSQL-backed event store for Helm Warhammer 40K matches.
 * Implements append-only event log with strict ordering guarantees.
 */
export class EventStore {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Initialize the event store by creating required tables and indexes.
   * Safe to call multiple times (uses IF NOT EXISTS).
   */
  async initialize(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY,
        match_id UUID NOT NULL,
        sequence INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        player_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(match_id, sequence)
      );

      CREATE INDEX IF NOT EXISTS idx_events_match_id
        ON events(match_id);

      CREATE INDEX IF NOT EXISTS idx_events_match_sequence
        ON events(match_id, sequence);

      CREATE INDEX IF NOT EXISTS idx_events_type
        ON events(type);

      CREATE INDEX IF NOT EXISTS idx_events_player_id
        ON events(player_id);
    `;

    try {
      await this.pool.query(createTableSQL);
      console.log('Event store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize event store:', error);
      throw error;
    }
  }

  /**
   * Append a new event to the event store.
   * Automatically assigns the next sequence number for the match.
   *
   * @throws Error if the event fails validation or if a duplicate sequence is detected
   */
  async append(matchId: string, event: MatchEvent): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get the next sequence number for this match
      const sequenceResult = await client.query(
        `SELECT COALESCE(MAX(sequence), 0) + 1 as next_sequence
         FROM events
         WHERE match_id = $1
         FOR UPDATE`,
        [matchId]
      );

      const nextSequence = sequenceResult.rows[0].next_sequence;

      // Validate event with Zod schema
      const validatedEvent = MatchEventSchema.parse(event);

      // Insert the event
      await client.query(
        `INSERT INTO events (id, match_id, sequence, type, payload, timestamp, player_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          validatedEvent.id,
          matchId,
          nextSequence,
          validatedEvent.type,
          JSON.stringify(validatedEvent),
          validatedEvent.timestamp,
          validatedEvent.playerId,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to append event:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve all events for a match, optionally starting after a specific sequence.
   * Returns events in strict sequence order.
   */
  async getEvents(
    matchId: string,
    afterSequence?: number
  ): Promise<MatchEvent[]> {
    let query =
      'SELECT payload FROM events WHERE match_id = $1';
    const params: unknown[] = [matchId];

    if (afterSequence !== undefined) {
      query += ' AND sequence > $2';
      params.push(afterSequence);
    }

    query += ' ORDER BY sequence ASC';

    try {
      const result: QueryResult<{ payload: MatchEvent }> =
        await this.pool.query(query, params);

      // Validate each event payload
      return result.rows.map((row) => {
        const validated = MatchEventSchema.parse(row.payload);
        return validated;
      });
    } catch (error) {
      console.error('Failed to get events:', error);
      throw error;
    }
  }

  /**
   * Get the latest sequence number for a match.
   * Returns 0 if match has no events.
   */
  async getLatestSequence(matchId: string): Promise<number> {
    try {
      const result: QueryResult<{ max: number | null }> =
        await this.pool.query(
          'SELECT MAX(sequence) as max FROM events WHERE match_id = $1',
          [matchId]
        );

      return result.rows[0].max ?? 0;
    } catch (error) {
      console.error('Failed to get latest sequence:', error);
      throw error;
    }
  }

  /**
   * Get event count for a match
   */
  async getEventCount(matchId: string): Promise<number> {
    try {
      const result: QueryResult<{ count: string }> =
        await this.pool.query(
          'SELECT COUNT(*) as count FROM events WHERE match_id = $1',
          [matchId]
        );

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Failed to get event count:', error);
      throw error;
    }
  }

  /**
   * Delete all events for a match (used for cleanup/testing)
   */
  async deleteMatch(matchId: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM events WHERE match_id = $1', [
        matchId,
      ]);
    } catch (error) {
      console.error('Failed to delete match:', error);
      throw error;
    }
  }
}
