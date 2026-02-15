import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { RulesEngine } from '@helm/rules-engine';
import {
  requestLoggingMiddleware,
  authMiddleware,
  errorHandler,
  validateJsonBody,
} from './middleware';
import { StateEngine } from './state-engine';
import { createRoutes } from './routes';
import { MatchWebSocketServer } from './websocket';

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
const httpServer = createServer(app);

// Initialize engines
const stateEngine = new StateEngine();
const rulesEngine = new RulesEngine();
const wsServer = new MatchWebSocketServer(httpServer, stateEngine, rulesEngine);

// ============= MIDDLEWARE =============

app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(requestLoggingMiddleware);
app.use(validateJsonBody);

// Auth middleware (optional in dev mode)
if (NODE_ENV === 'production') {
  app.use(authMiddleware);
}

// ============= ROUTES =============

app.use('/api', createRoutes(stateEngine, rulesEngine));

// ============= ERROR HANDLING =============

app.use(errorHandler);

// ============= SERVER START =============

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   Helm Warhammer 40K Referee - API Gateway            ║
╚═══════════════════════════════════════════════════════╝

🎮 REST API:    http://localhost:${PORT}/api
🔌 WebSocket:   ws://localhost:${PORT}/ws
📊 Health:      http://localhost:${PORT}/api/health
📋 Rules API:   http://localhost:${PORT}/api/rules

Environment:    ${NODE_ENV}
Rules Loaded:   ${rulesEngine.getAllRules().length}

Example usage:
  POST http://localhost:${PORT}/api/matches
  Body: {"player1Id": "alice", "player2Id": "bob"}

Press Ctrl+C to stop
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, httpServer, stateEngine, rulesEngine, wsServer };
