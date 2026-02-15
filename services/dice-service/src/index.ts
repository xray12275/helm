import express, { Request, Response } from 'express';
import { AuditableDice, DiceRollResult } from './dice-engine';
import { v4 as uuidv4 } from 'uuid';

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
const dice = new AuditableDice();

// In-memory store for MVP (would be database in production)
const rollStore: Map<string, DiceRollResult> = new Map();

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    console.log(
      `[${requestId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
    return originalSend.call(this, data);
  };

  next();
});

// ============= ENDPOINTS =============

/**
 * POST /api/roll
 * Roll dice with given parameters
 */
app.post('/api/roll', (req: Request, res: Response) => {
  try {
    const { count = 1, sides = 6 } = req.body;

    if (!Number.isInteger(count) || !Number.isInteger(sides)) {
      res.status(400).json({
        error: 'count and sides must be integers',
      });
      return;
    }

    const result = dice.roll(count, sides);

    // Store the roll
    rollStore.set(result.id, result);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/roll/:id
 * Retrieve a previous roll by ID
 */
app.get('/api/roll/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const result = rollStore.get(id);
  if (!result) {
    res.status(404).json({ error: `Roll ${id} not found` });
    return;
  }

  res.json(result);
});

/**
 * POST /api/verify/:id
 * Verify a roll's authenticity
 */
app.post('/api/verify/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const result = rollStore.get(id);
  if (!result) {
    res.status(404).json({ error: `Roll ${id} not found` });
    return;
  }

  const isValid = dice.verify(result);

  res.json({
    id,
    isValid,
    message: isValid
      ? 'Roll verified successfully'
      : 'Roll verification failed - results may have been tampered with',
    roll: result,
  });
});

/**
 * GET /api/roll
 * List recent rolls (for testing)
 */
app.get('/api/roll', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

  // Convert map to array and sort by timestamp (newest first)
  const rolls = Array.from(rollStore.values())
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, limit);

  res.json({
    count: rolls.length,
    total: rollStore.size,
    rolls,
  });
});

/**
 * GET /api/health
 * Health check
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'dice-service',
    timestamp: new Date().toISOString(),
    rollsStored: rollStore.size,
  });
});

// ============= ERROR HANDLING =============

app.use((err: any, req: Request, res: Response) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============= SERVER START =============

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   Helm Warhammer 40K Referee - Dice Service           ║
╚═══════════════════════════════════════════════════════╝

📊 Service:     http://localhost:${PORT}
📋 Health:      http://localhost:${PORT}/api/health

Endpoints:
  POST   http://localhost:${PORT}/api/roll
  GET    http://localhost:${PORT}/api/roll/:id
  POST   http://localhost:${PORT}/api/verify/:id
  GET    http://localhost:${PORT}/api/roll

Example usage:
  curl -X POST http://localhost:${PORT}/api/roll \\
    -H "Content-Type: application/json" \\
    -d '{"count": 2, "sides": 6}'

Environment:    ${NODE_ENV}
Press Ctrl+C to stop
  `);
});

export { app, dice };
