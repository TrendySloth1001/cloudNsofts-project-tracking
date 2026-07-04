import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wrap an async controller so thrown/rejected errors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<unknown> | unknown,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
