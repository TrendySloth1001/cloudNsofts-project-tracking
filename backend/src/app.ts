import express, { type Express } from 'express';
import cors from 'cors';
import { env } from './infra/env';
import { routeRegistry } from './router';
import {
  notFoundHandler,
  errorHandler,
} from './shared/http/error-middleware';
import { apiRateLimiter } from './shared/http/rate-limit';
import { idempotency } from './shared/http/idempotency';

/** Assemble the Express application: middleware, feature routers, error handling. */
export function createApp(): Express {
  const app = express();

  // Trust the first proxy so req.ip reflects the real client (correct IP-based
  // rate limiting behind a load balancer / tunnel).
  app.set('trust proxy', 1);

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(apiRateLimiter);
  app.use(idempotency);

  for (const { base, router } of routeRegistry) {
    app.use(base, router);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
