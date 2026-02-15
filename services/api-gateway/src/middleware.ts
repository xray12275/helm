import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Type-safe extension of Express Request for our app
 */
export interface AppRequest extends Request {
  requestId: string;
  userId?: string;
  matchId?: string;
}

/**
 * Middleware: Add unique request ID and logging
 */
export function requestLoggingMiddleware(
  req: AppRequest,
  res: Response,
  next: NextFunction
): void {
  req.requestId = uuidv4();

  const startTime = Date.now();
  const originalSend = res.send;

  // Log response
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    console.log(
      `[${req.requestId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Middleware: Extract Bearer token and verify (stub implementation)
 * In production, this would validate against a real auth service
 */
export function authMiddleware(
  req: AppRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  // For MVP, accept any Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // TODO: Validate token against auth service
    // For now, treat token as user ID
    req.userId = token;
    next();
  } else if (process.env.NODE_ENV === 'development') {
    // In dev, allow requests without auth
    req.userId = 'dev-user';
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
  }
}

/**
 * Middleware: Extract matchId from route params and attach to request
 */
export function matchIdMiddleware(
  req: AppRequest,
  res: Response,
  next: NextFunction
): void {
  const { matchId } = req.params as { matchId?: string };
  if (matchId) {
    req.matchId = matchId;
  }
  next();
}

/**
 * Middleware: Global error handler
 */
export function errorHandler(
  err: any,
  req: AppRequest,
  res: Response,
  next: NextFunction
): void {
  console.error(`[${req.requestId}] Error:`, err);

  // Default to 500 if no status is set
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Middleware: Validate JSON body before processing
 */
export function validateJsonBody(
  req: AppRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.is('application/json')) {
      res.status(400).json({ error: 'Content-Type must be application/json' });
      return;
    }
  }
  next();
}
