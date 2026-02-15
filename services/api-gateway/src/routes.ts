import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RulesEngine } from '@helm/rules-engine';
import { AppRequest } from './middleware';
import { StateEngine } from './state-engine';

export function createRoutes(stateEngine: StateEngine, rulesEngine: RulesEngine): Router {
  const router = Router();

  // ============= MATCH ENDPOINTS =============

  /**
   * POST /api/matches
   * Create a new match
   */
  router.post('/matches', (req: AppRequest, res) => {
    try {
      const { player1Id, player2Id } = req.body;

      if (!player1Id || !player2Id) {
        res.status(400).json({ error: 'player1Id and player2Id are required' });
        return;
      }

      const match = stateEngine.createMatch(player1Id, player2Id);
      res.status(201).json(match);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/matches/:id
   * Get match state
   */
  router.get('/matches/:id', (req: AppRequest, res) => {
    try {
      const match = stateEngine.getMatch(req.params.id);

      if (!match) {
        res.status(404).json({ error: 'Match not found' });
        return;
      }

      res.json(match);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/matches/:id/army
   * Submit army for a player
   */
  router.post('/matches/:id/army', (req: AppRequest, res) => {
    try {
      const { playerId, units } = req.body;

      if (!playerId || !Array.isArray(units)) {
        res.status(400).json({ error: 'playerId and units[] are required' });
        return;
      }

      const updated = stateEngine.submitArmy(req.params.id, playerId, units);
      if (!updated) {
        res.status(404).json({ error: 'Match not found' });
        return;
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/matches/:id/command
   * Send a command and check legality
   */
  router.post('/matches/:id/command', (req: AppRequest, res) => {
    try {
      const match = stateEngine.getMatch(req.params.id);

      if (!match) {
        res.status(404).json({ error: 'Match not found' });
        return;
      }

      const command = {
        id: uuidv4(),
        type: req.body.type,
        ...req.body,
      };

      // Check legality with RulesEngine
      const legalityResult = rulesEngine.checkLegality(match, command);

      // If legal, apply the command
      if (legalityResult.isLegal) {
        const applyResult = stateEngine.applyCommand(req.params.id, command);
        res.json({
          ...legalityResult,
          applied: applyResult.success,
          newState: applyResult.newState,
        });
      } else {
        // Return the legality violation without applying
        res.status(400).json(legalityResult);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/matches/:id/events
   * Get event log
   */
  router.get('/matches/:id/events', (req: AppRequest, res) => {
    try {
      const match = stateEngine.getMatch(req.params.id);

      if (!match) {
        res.status(404).json({ error: 'Match not found' });
        return;
      }

      const events = stateEngine.getEvents(req.params.id);
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/matches/:id/override
   * Apply override to a blocked action
   */
  router.post('/matches/:id/override', (req: AppRequest, res) => {
    try {
      const { legalityResultId } = req.body;

      if (!legalityResultId) {
        res.status(400).json({ error: 'legalityResultId is required' });
        return;
      }

      // TODO: Verify that the user has authority to override
      const result = stateEngine.applyOverride(req.params.id, legalityResultId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/matches/:id/advance-phase
   * Advance to next phase
   */
  router.post('/matches/:id/advance-phase', (req: AppRequest, res) => {
    try {
      const updated = stateEngine.advancePhase(req.params.id);

      if (!updated) {
        res.status(404).json({ error: 'Match not found' });
        return;
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============= UTILITY ENDPOINTS =============

  /**
   * GET /api/health
   * Health check
   */
  router.get('/health', (req: AppRequest, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  /**
   * GET /api/rules
   * Get all loaded rules (for debugging)
   */
  router.get('/rules', (req: AppRequest, res) => {
    try {
      const rules = rulesEngine.getAllRules();
      res.json({
        count: rules.length,
        rules,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/rules/:id
   * Get detailed info about a specific rule
   */
  router.get('/rules/:id', (req: AppRequest, res) => {
    try {
      const { rule, explanation } = rulesEngine.explainRule(req.params.id);

      if (!rule) {
        res.status(404).json({ error: explanation });
        return;
      }

      res.json({ rule, explanation });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
