import { randomBytes, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Result of a dice roll, including cryptographic proof
 */
export interface DiceRollResult {
  /**
   * Unique identifier for this roll
   */
  id: string;

  /**
   * Seed used to generate the roll (hex string)
   */
  seed: string;

  /**
   * Individual die results
   */
  results: number[];

  /**
   * SHA-256 hash of seed + results for audit
   */
  hash: string;

  /**
   * Timestamp of the roll
   */
  timestamp: string;

  /**
   * Number of dice rolled
   */
  count: number;

  /**
   * Number of sides on each die
   */
  sides: number;

  /**
   * Total sum of all dice
   */
  total: number;
}

/**
 * Auditable dice roller with cryptographic verification.
 * Uses a seed-based PRNG to generate deterministic results that can be verified later.
 */
export class AuditableDice {
  /**
   * Roll dice with the given parameters.
   * Each roll is seeded with random bytes and can be verified later.
   */
  roll(count: number, sides: number = 6): DiceRollResult {
    if (count <= 0 || count > 1000) {
      throw new Error('count must be between 1 and 1000');
    }

    if (sides <= 1 || sides > 1000) {
      throw new Error('sides must be between 2 and 1000');
    }

    // Generate a random seed
    const seed = randomBytes(32).toString('hex');

    // Generate die results from seed
    const results = this.generateDiceFromSeed(seed, count, sides);

    // Calculate total
    const total = results.reduce((sum, val) => sum + val, 0);

    // Create hash for verification
    const hash = this.hashRoll(seed, results);

    const result: DiceRollResult = {
      id: uuidv4(),
      seed,
      results,
      hash,
      timestamp: new Date().toISOString(),
      count,
      sides,
      total,
    };

    return result;
  }

  /**
   * Verify that a roll result is authentic.
   * Re-derives the results from the seed and checks the hash.
   */
  verify(result: DiceRollResult): boolean {
    // Re-derive results from seed
    const derivedResults = this.generateDiceFromSeed(
      result.seed,
      result.count,
      result.sides
    );

    // Check if derived results match
    if (derivedResults.length !== result.results.length) {
      return false;
    }

    for (let i = 0; i < derivedResults.length; i++) {
      if (derivedResults[i] !== result.results[i]) {
        return false;
      }
    }

    // Verify hash
    const expectedHash = this.hashRoll(result.seed, result.results);
    return expectedHash === result.hash;
  }

  /**
   * Generate deterministic dice results from a seed.
   * Uses a simple LCPRNG based on the seed.
   */
  private generateDiceFromSeed(
    seed: string,
    count: number,
    sides: number
  ): number[] {
    const results: number[] = [];

    // Convert seed to a number we can use as initial state
    // Take first 16 chars of seed hex and parse as number
    let state = parseInt(seed.slice(0, 16), 16);

    for (let i = 0; i < count; i++) {
      // Linear congruential generator: simple but deterministic PRNG
      // Using parameters from MINSTD (Park and Miller)
      state = (state * 1664525 + 1013904223) >>> 0;

      // Convert to die value (1 to sides)
      const dieValue = (state % sides) + 1;
      results.push(dieValue);
    }

    return results;
  }

  /**
   * Create a SHA-256 hash of the roll for audit trail
   */
  private hashRoll(seed: string, results: number[]): string {
    const data = seed + JSON.stringify(results);
    return createHash('sha256').update(data).digest('hex');
  }
}
