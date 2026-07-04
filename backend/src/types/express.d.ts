import type { AuthUser } from '@cnsofts/shared';

// Expose the verified principal on the request for authenticated handlers.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export {};
