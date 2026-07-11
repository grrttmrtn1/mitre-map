import crypto from 'crypto';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(incoming)
    ? incoming : crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export const apiErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = (req as any).requestId;
  const status = Number(error?.status ?? error?.statusCode ?? 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const message = safeStatus >= 500 ? 'Internal server error' : String(error?.message ?? 'Request failed');
  console.error(JSON.stringify({
    level: 'error', event: 'api_error', request_id: requestId,
    method: req.method, path: req.originalUrl, status: safeStatus,
    error: error instanceof Error ? error.message : String(error),
  }));
  if (res.headersSent) return;
  res.status(safeStatus).json({ error: message, request_id: requestId });
};
