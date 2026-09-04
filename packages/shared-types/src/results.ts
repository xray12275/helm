import { z } from 'zod';
import { MatchEventSchema } from './events';

// ============================================================================
// COMMAND RESULT SCHEMAS
// ============================================================================

export const CommandAcceptedSchema = z.object({
  status: z.literal('accepted'),
  commandId: z.string().uuid(),
  events: z.array(MatchEventSchema),
  timestamp: z.string().datetime(),
});

export type CommandAccepted = z.infer<typeof CommandAcceptedSchema>;

export const CommandBlockedSchema = z.object({
  status: z.literal('blocked'),
  commandId: z.string().uuid(),
  ruleId: z.string(),
  explanation: z.string(),
  suggestedFix: z.string().nullable(),
  timestamp: z.string().datetime(),
});

export type CommandBlocked = z.infer<typeof CommandBlockedSchema>;

export const CommandErrorSchema = z.object({
  status: z.literal('error'),
  commandId: z.string().uuid(),
  error: z.string(),
  timestamp: z.string().datetime(),
});

export type CommandError = z.infer<typeof CommandErrorSchema>;

export const CommandResultSchema = z.discriminatedUnion('status', [
  CommandAcceptedSchema,
  CommandBlockedSchema,
  CommandErrorSchema,
]);

export type CommandResult = z.infer<typeof CommandResultSchema>;

// ============================================================================
// LEGALITY CHECK RESULT
// ============================================================================

export const LegalityResultSchema = z.object({
  isLegal: z.boolean(),
  ruleId: z.string().nullable(),
  explanation: z.string(),
  suggestedFix: z.string().nullable(),
  // Audit fields — populated by @helm/rules-engine, referenced by overrides.
  id: z.string().uuid().optional(),
  matchId: z.string().optional(),
  commandId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  appliedRules: z.array(z.string()).optional(),
  violations: z.array(z.string()).optional(),
  blockedByRuleIds: z.array(z.string()).optional(),
});

export type LegalityResult = z.infer<typeof LegalityResultSchema>;

// ============================================================================
// QUERY RESULT
// ============================================================================

export const RuleQueryResultSchema = z.object({
  query: z.string(),
  matches: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      relevanceScore: z.number().min(0).max(1),
    })
  ),
  found: z.boolean(),
});

export type RuleQueryResult = z.infer<typeof RuleQueryResultSchema>;
