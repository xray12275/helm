/**
 * Result of attempting to disambiguate a unit name
 */
export interface DisambiguationResult {
  /**
   * If a single match was found, it's included here
   */
  matched?: any;

  /**
   * If multiple matches were found, this is true
   */
  ambiguous?: boolean;

  /**
   * List of matching units if ambiguous
   */
  options?: any[];

  /**
   * Prompt to ask the user for clarification
   */
  prompt?: string;

  /**
   * Error message if no matches found
   */
  error?: string;
}

/**
 * Disambiguates unit names when multiple units match (e.g., "Intercessors" with squads A and B)
 */
export class UnitDisambiguator {
  /**
   * Attempt to disambiguate a unit name against available units
   */
  disambiguate(unitName: string, availableUnits: any[]): DisambiguationResult {
    if (!availableUnits || availableUnits.length === 0) {
      return {
        error: 'No units available',
      };
    }

    const normalized = unitName.toLowerCase().trim();

    // Exact matches first. Duplicate squads share a name ("Intercessors" A and B),
    // so a single exact hit resolves and several exact hits fall through to the
    // clarification prompt instead of silently picking the first.
    const exactMatches = availableUnits.filter(
      (u) => u.name?.toLowerCase() === normalized ||
             u.id?.toLowerCase() === normalized ||
             u.label?.toLowerCase() === normalized
    );

    if (exactMatches.length === 1) {
      return { matched: exactMatches[0] };
    }

    // Partial matches (only consulted when there was no exact hit)
    const partialMatches = exactMatches.length > 1
      ? exactMatches
      : availableUnits.filter((u) =>
          (u.name?.toLowerCase().includes(normalized) ||
           u.label?.toLowerCase().includes(normalized) ||
           u.keywords?.some((k: string) => k.toLowerCase().includes(normalized)))
        );

    if (partialMatches.length === 0) {
      return {
        error: `No units matching "${unitName}" found`,
      };
    }

    if (partialMatches.length === 1) {
      return { matched: partialMatches[0] };
    }

    // Multiple matches: ask for clarification
    const options = partialMatches.map((u, idx) => ({
      ...u,
      clarification: u.label ? `${u.name} ${u.label}` : u.name,
    }));

    const promptOptions = options
      .map((u, idx) => `${idx + 1}) ${u.clarification}`)
      .join(', ');

    return {
      ambiguous: true,
      options,
      prompt: `Which ${unitName}? ${promptOptions}`,
    };
  }

  /**
   * Score how well a unit name matches a candidate unit
   * Higher scores indicate better matches
   */
  private scoreMatch(query: string, unit: any): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    if (unit.name?.toLowerCase() === queryLower) {
      score += 100; // Exact match on name
    } else if (unit.name?.toLowerCase().includes(queryLower)) {
      score += 50; // Partial match on name
    }

    if (unit.label?.toLowerCase().includes(queryLower)) {
      score += 30; // Match on label (e.g., "A", "B")
    }

    if (unit.keywords?.some((k: string) => k.toLowerCase().includes(queryLower))) {
      score += 20; // Match on keywords
    }

    // Penalty for having the keyword but not matching exactly
    if (unit.keywords?.includes('infantry') && !queryLower.includes('infantry')) {
      score -= 5;
    }

    return score;
  }
}
