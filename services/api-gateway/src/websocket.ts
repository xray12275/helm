import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { MatchState, MatchCommand } from '@helm/shared-types';
import { RulesEngine } from '@helm/rules-engine';
import { StateEngine } from './state-engine';

interface SubscribedClient {
  ws: WebSocket;
  clientId: string;
  matchId?: string;
}

interface WSMessage {
  type: 'subscribe' | 'unsubscribe' | 'command' | 'ping';
  matchId?: string;
  command?: MatchCommand;
  clientId?: string;
}

/**
 * WebSocket server for real-time match updates
 */
export class MatchWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, SubscribedClient> = new Map();
  private matchSubscribers: Map<string, Set<string>> = new Map(); // matchId -> clientIds
  private stateEngine: StateEngine;
  private rulesEngine: RulesEngine;

  constructor(
    httpServer: HTTPServer,
    stateEngine: StateEngine,
    rulesEngine: RulesEngine
  ) {
    this.stateEngine = stateEngine;
    this.rulesEngine = rulesEngine;

    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    this.wss.on('connection', (ws) => {
      const clientId = uuidv4();
      console.log(`WebSocket client connected: ${clientId}`);

      this.clients.set(clientId, { ws, clientId });

      ws.on('message', (data) => {
        try {
          this.handleMessage(clientId, data);
        } catch (err: any) {
          console.error(`Error handling message from ${clientId}:`, err);
          ws.send(
            JSON.stringify({
              type: 'error',
              message: err.message,
            })
          );
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', (err) => {
        console.error(`WebSocket error for ${clientId}:`, err);
      });

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: 'welcome',
          clientId,
          message: 'Connected to Helm Warhammer 40K Referee WebSocket',
        })
      );
    });
  }

  private handleMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    let message: WSMessage;
    try {
      message = JSON.parse(data.toString());
    } catch (err) {
      client.ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid JSON',
        })
      );
      return;
    }

    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(clientId, message.matchId);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId);
        break;

      case 'command':
        if (client.matchId && message.command) {
          this.handleCommand(clientId, client.matchId, message.command);
        } else {
          client.ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Not subscribed to a match or missing command',
            })
          );
        }
        break;

      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        client.ws.send(
          JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${message.type}`,
          })
        );
    }
  }

  private handleSubscribe(clientId: string, matchId?: string): void {
    if (!matchId) {
      const client = this.clients.get(clientId);
      if (client) {
        client.ws.send(
          JSON.stringify({
            type: 'error',
            message: 'matchId is required for subscribe',
          })
        );
      }
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) return;

    // Unsubscribe from previous match if any
    if (client.matchId) {
      this.handleUnsubscribe(clientId);
    }

    // Subscribe to new match
    client.matchId = matchId;

    if (!this.matchSubscribers.has(matchId)) {
      this.matchSubscribers.set(matchId, new Set());
    }
    this.matchSubscribers.get(matchId)!.add(clientId);

    // Send current match state
    const match = this.stateEngine.getMatch(matchId);
    if (match) {
      client.ws.send(
        JSON.stringify({
          type: 'state_update',
          state: match,
        })
      );
    }

    console.log(`Client ${clientId} subscribed to match ${matchId}`);
  }

  private handleUnsubscribe(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client || !client.matchId) return;

    const subscribers = this.matchSubscribers.get(client.matchId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.matchSubscribers.delete(client.matchId);
      }
    }

    client.matchId = undefined;
    console.log(`Client ${clientId} unsubscribed`);
  }

  private handleCommand(clientId: string, matchId: string, command: MatchCommand): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const match = this.stateEngine.getMatch(matchId);
    if (!match) {
      client.ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Match not found',
        })
      );
      return;
    }

    // Check legality
    const legalityResult = this.rulesEngine.checkLegality(match, command);

    // Send result to command sender
    client.ws.send(
      JSON.stringify({
        type: 'command_result',
        commandId: (command as any).id,
        legalityResult,
      })
    );

    // If legal, apply and broadcast state update
    if (legalityResult.isLegal) {
      const applyResult = this.stateEngine.applyCommand(matchId, command);
      if (applyResult.success && applyResult.newState) {
        this.broadcastStateUpdate(matchId, applyResult.newState);
      }
    }
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client && client.matchId) {
      this.handleUnsubscribe(clientId);
    }

    this.clients.delete(clientId);
    console.log(`Client ${clientId} disconnected`);
  }

  /**
   * Broadcast a state update to all clients subscribed to a match
   */
  private broadcastStateUpdate(matchId: string, state: MatchState): void {
    const subscribers = this.matchSubscribers.get(matchId);
    if (!subscribers) return;

    const message = JSON.stringify({
      type: 'state_update',
      state,
    });

    for (const clientId of subscribers) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Broadcast an event to all clients subscribed to a match
   */
  broadcastEvent(matchId: string, event: any): void {
    const subscribers = this.matchSubscribers.get(matchId);
    if (!subscribers) return;

    const message = JSON.stringify({
      type: 'event',
      event,
    });

    for (const clientId of subscribers) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Get number of subscribed clients for a match
   */
  getSubscriberCount(matchId: string): number {
    return this.matchSubscribers.get(matchId)?.size || 0;
  }
}
