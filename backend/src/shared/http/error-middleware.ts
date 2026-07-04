import type { Request, Response, NextFunction } from 'express';
import type { ApiError } from '@cnsofts/shared';
import { HttpError } from './http-error';

/** Terminal 404 handler for unmatched routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  const body: ApiError = { error: { message: 'Not found' } };
  res.status(404).json(body);
}

/** Central error handler — converts thrown errors into JSON responses. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    const body: ApiError = {
      error: { message: err.message, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }
  console.error('Unexpected error:', err);
  const body: ApiError = { error: { message: 'Internal server error' } };
  res.status(500).json(body);
}
