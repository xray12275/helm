/**
 * Intent types that the voice service can recognize
 */
export type IntentType =
  | 'move_unit'
  | 'declare_attack'
  | 'roll_dice'
  | 'use_stratagem'
  | 'advance_phase'
  | 'score_points'
  | 'query_rule'
  | 'undo'
  | 'select_unit'
  | 'show_targets'
  | 'unknown';

/**
 * Parsed intent from voice transcript
 */
export interface Intent {
  /**
   * The type of intent recognized
   */
  type: IntentType;

  /**
   * Extracted entities from the transcript (e.g., unitName, targetName)
   */
  entities: Record<string, string>;

  /**
   * Original transcript
   */
  rawTranscript: string;

  /**
   * Confidence score (0.0 to 1.0)
   */
  confidence: number;

  /**
   * Whether additional clarification is needed
   */
  requiresConfirmation: boolean;

  /**
   * Optional prompt for user confirmation
   */
  confirmationPrompt?: string;
}

/**
 * Parses voice transcripts into structured intents using regex and keyword matching
 */
export class IntentParser {
  /**
   * Parse a transcript into an Intent
   */
  parseIntent(transcript: string): Intent {
    const normalized = transcript.toLowerCase().trim();

    // Try each pattern matcher in order
    const matchers: Array<(text: string) => Intent | null> = [
      this.tryMoveUnit,
      this.tryDeclareAttack,
      this.tryRollDice,
      this.tryUseStratagem,
      this.tryAdvancePhase,
      this.tryScorePoints,
      this.tryQueryRule,
      this.tryUndo,
      this.trySelectUnit,
      this.tryShowTargets,
    ];

    for (const matcher of matchers) {
      const result = matcher.call(this, normalized);
      if (result) {
        return result;
      }
    }

    // Default: unknown intent
    return {
      type: 'unknown',
      entities: {},
      rawTranscript: transcript,
      confidence: 0.0,
      requiresConfirmation: false,
    };
  }

  /**
   * Try to parse as move_unit intent
   * Patterns: "move {unit}", "move {unit} to {location}"
   */
  private tryMoveUnit(text: string): Intent | null {
    const patterns = [
      /^move\s+(\w+(?:\s+\w+)*?)(?:\s+to\s+(.+))?$/,
      /^move\s+(\w+(?:\s+\w+)*)$/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'move_unit',
          entities: {
            unitName: match[1],
            ...(match[2] && { location: match[2] }),
          },
          rawTranscript: text,
          confidence: 0.9,
          requiresConfirmation: false,
        };
      }
    }

    return null;
  }

  /**
   * Try to parse as declare_attack intent
   * Patterns: "attack with {unit}", "shoot {target} with {unit}", "shoot {target}"
   */
  private tryDeclareAttack(text: string): Intent | null {
    const patterns = [
      /^(?:shoot|attack)\s+(\w+(?:\s+\w+)*?)\s+with\s+(\w+(?:\s+\w+)*)$/,
      /^(?:shoot|attack)\s+(?:with\s+)?(\w+(?:\s+\w+)*)$/,
      /^attack\s+(\w+(?:\s+\w+)*)$/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'declare_attack',
          entities: {
            ...(text.includes('with') && match[2]
              ? { targetName: match[1], unitName: match[2] }
              : { unitName: match[1] }),
          },
          rawTranscript: text,
          confidence: 0.85,
          requiresConfirmation: !text.includes('with'), // Require confirmation if target not specified
        };
      }
    }

    return null;
  }

  /**
   * Try to parse as roll_dice intent
   * Patterns: "roll {N} dice", "roll to {action}", "roll {action}"
   */
  private tryRollDice(text: string): Intent | null {
    const patterns = [
      /^roll\s+(\d+)\s+(?:d?ices?|dice)(?:\s+to\s+(.+))?$/,
      /^roll\s+(?:to\s+)?(.+)?\s*$/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'roll_dice',
          entities: {
            ...(match[1] && { count: match[1] }),
            ...(match[2] && { action: match[2] }),
          },
          rawTranscript: text,
          confidence: 0.88,
          requiresConfirmation: false,
        };
      }
    }

    return null;
  }

  /**
   * Try to parse as use_stratagem intent
   * Patterns: "use {stratagem}", "activate {stratagem}"
   */
  private tryUseStratagem(text: string): Intent | null {
    const patterns = [
      /^(?:use|activate|cast)\s+(?:the\s+)?(\w+(?:\s+\w+)*)$/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'use_stratagem',
          entities: {
            stratagemName: match[1],
          },
          rawTranscript: text,
          confidence: 0.9,
          requiresConfirmation: true,
          confirmationPrompt: `Activate stratagem: "${match[1]}"?`,
        };
      }
    }

    return null;
  }

  /**
   * Try to parse as advance_phase intent
   * Patterns: "next phase", "end phase", "advance", "next turn"
   */
  private tryAdvancePhase(text: string): Intent | null {
    if (/^(?:next|end|advance)\s+(?:phase|turn)?$/.test(text)) {
      return {
        type: 'advance_phase',
        entities: {},
        rawTranscript: text,
        confidence: 0.95,
        requiresConfirmation: true,
        confirmationPrompt: 'Advance to next phase?',
      };
    }

    return null;
  }

  /**
   * Try to parse as score_points intent
   * Patterns: "score {N}", "score {N} points", "add {N} points"
   */
  private tryScorePoints(text: string): Intent | null {
    const patterns = [
      /^(?:score|add)\s+(\d+)\s+(?:points?)?$/,
      /^points?\s+(\d+)$/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'score_points',
          entities: {
            points: match[1],
          },
          rawTranscript: text,
          confidence: 0.85,
          requiresConfirmation: true,
          confirmationPrompt: `Score ${match[1]} points?`,
        };
      }
    }

    return null;
  }

  /**
   * Try to parse as query_rule intent
   * Patterns: "what is {rule}", "explain {rule}", "rule {rule}"
   */
  private tryQueryRule(text: string): Intent | null {
    const patterns = [
      /^(?:what|explain|tell me about)\s+(?:the\s+)?(\w+(?:\s+\w+)*)$/,
      /^(?:rule|rules?)\s+(?:about\s+)?(\w+(?:\s+\w+)*)$/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'query_rule',
          entities: {
            ruleName: match[1],
          },
          rawTranscript: text,
          confidence: 0.8,
          requiresConfirmation: false,
        };
      }
    }

    return null;
  }

  /**
   * Try to parse as undo intent
   * Patterns: "undo", "take that back", "revert"
   */
  private tryUndo(text: string): Intent | null {
    if (/^(?:undo|take\s+that\s+back|revert|undo\s+last|cancel)/.test(text)) {
      return {
        type: 'undo',
        entities: {},
        rawTranscript: text,
        confidence: 0.95,
        requiresConfirmation: true,
        confirmationPrompt: 'Undo last action?',
      };
    }

    return null;
  }

  /**
   * Try to parse as select_unit intent
   * Patterns: "select {unit}", "choose {unit}", "pick {unit}"
   */
  private trySelectUnit(text: string): Intent | null {
    const patterns = [
      /^(?:select|choose|pick)\s+(?:the\s+)?(\w+(?:\s+\w+)*)$/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'select_unit',
          entities: {
            unitName: match[1],
          },
          rawTranscript: text,
          confidence: 0.9,
          requiresConfirmation: false,
        };
      }
    }

    return null;
  }

  /**
   * Try to parse as show_targets intent
   * Patterns: "show targets", "who can I attack", "valid targets"
   */
  private tryShowTargets(text: string): Intent | null {
    if (/^(?:show\s+)?(?:targets|who\s+can\s+i\s+attack|valid\s+targets)/.test(text)) {
      return {
        type: 'show_targets',
        entities: {},
        rawTranscript: text,
        confidence: 0.9,
        requiresConfirmation: false,
      };
    }

    return null;
  }
}
