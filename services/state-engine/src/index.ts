import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { MatchCommand, MatchCommandSchema, LegalityResult } from '@helm/shared-types';
import { EventStore } from './event-store';
import { StateManager } from './state-manager';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ?? 8080;
const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT ?? '5432', 10);
const DB_NAME = process.env.DB_NAME ?? 'helm';
const DB_USER = process.env.DB_USER ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';

// ============================================================================
// MAIN APPLICATION
// ============================================================================

async function main() {
  console.log('Starting Helm State Engine...');

  // Initialize database connection pool
  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  try {
    // Test connection
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected:', result.rows[0]);
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

  // Initialize event store
  const eventStore = new EventStore(pool);
  await eventStore.initialize();
  console.log('Event store initialized');

  // Initialize state manager
  const stateManager = new StateManager(eventStore);

  // Create HTTP server for WebSocket
  const httpServer = createServer();

  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer });

  // Track active connections by match ID
  const matchConnections: Map<string, Set<any>> = new Map();

  // ========================================================================
  // WEBSOCKET HANDLERS
  // ========================================================================

  wss.on('connection', (ws) => {
    console.log('Client connected');

    let currentMatchId: string | null = null;

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle subscription to match updates
        if (message.type === 'Subscribe') {
          currentMatchId = message.matchId;

          // Add to match connections
          if (!matchConnections.has(currentMatchId)) {
            matchConnections.set(currentMatchId, new Set());
          }
          matchConnections.get(currentMatchId)!.add(ws);

          // Send current state to client
          try {
            const state = await stateManager.getState(currentMatchId);
            ws.send(
              JSON.stringify({
                type: 'StateUpdate',
                state,
                timestamp: new Date().toISOString(),
              })
            );
          } catch (error) {
            console.error('Failed to get state:', error);
          }

          console.log(`Client subscribed to match ${currentMatchId}`);
          return;
        }

        // Handle command execution
        if (message.type === 'Command' && currentMatchId) {
          const commandData = message.command;

          // Validate command structure
          const command = MatchCommandSchema.parse({
            ...commandData,
            id: commandData.id ?? uuidv4(),
            matchId: currentMatchId,
            timestamp: commandData.timestamp ?? new Date().toISOString(),
          } as MatchCommand);

          // Process command with legality check
          const result = await stateManager.processCommand(
            currentMatchId,
            command,
            legalityCheckFn
          );

          // Send result back to client
          ws.send(
            JSON.stringify({
              type: 'CommandResult',
              result,
              timestamp: new Date().toISOString(),
            })
          );

          // Broadcast state update to all connected clients
          const updatedState = await stateManager.getState(currentMatchId);
          const connections = matchConnections.get(currentMatchId);
          if (connections) {
            const broadcastMessage = JSON.stringify({
              type: 'StateUpdate',
              state: updatedState,
              timestamp: new Date().toISOString(),
            });

            for (const client of connections) {
              if (client.readyState === 1) {
                // WebSocket.OPEN
                client.send(broadcastMessage);
              }
            }
          }

          console.log(
            `Command processed: ${command.type} (status: ${result.status})`
          );
          return;
        }

        // Handle query requests
        if (message.type === 'GetState' && currentMatchId) {
          try {
            const state = await stateManager.getState(currentMatchId);
            ws.send(
              JSON.stringify({
                type: 'StateUpdate',
                state,
                timestamp: new Date().toISOString(),
              })
            );
          } catch (error) {
            console.error('Failed to get state:', error);
            ws.send(
              JSON.stringify({
                type: 'Error',
                message: 'Failed to retrieve state',
              })
            );
          }
          return;
        }

        // Unknown message type
        ws.send(
          JSON.stringify({
            type: 'Error',
            message: `Unknown message type: ${message.type}`,
          })
        );
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(
          JSON.stringify({
            type: 'Error',
            message: 'Failed to process message',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        );
      }
    });

    ws.on('close', () => {
      if (currentMatchId) {
        const connections = matchConnections.get(currentMatchId);
        if (connections) {
          connections.delete(ws);
        }
      }
      console.log('Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // ========================================================================
  // LEGALITY CHECK FUNCTION
  // ========================================================================

  function legalityCheckFn(_state: any, _command: MatchCommand): LegalityResult {
    // TODO: Implement comprehensive rules checking
    // This should validate:
    // - Unit movement distances
    // - Attack ranges
    // - Stratagem costs and availability
    // - Phase-specific restrictions
    // - Keyword restrictions

    return {
      isLegal: true,
      ruleId: null,
      explanation: 'No rules violations detected (validation TODO)',
      suggestedFix: null,
    };
  }

  // ========================================================================
  // SERVER STARTUP
  // ========================================================================

  httpServer.listen(PORT, () => {
    console.log(`Helm State Engine listening on port ${PORT}`);
    console.log(`WebSocket server ready at ws://localhost:${PORT}`);
  });

  // ========================================================================
  // GRACEFUL SHUTDOWN
  // ========================================================================

  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');

    wss.close(() => {
      console.log('WebSocket server closed');
    });

    await pool.end();
    console.log('Database connection closed');

    process.exit(0);
  });
}

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
