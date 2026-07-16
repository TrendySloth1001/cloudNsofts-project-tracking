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
import { securityHeaders } from './shared/http/security-headers';

/** Assemble the Express application: middleware, feature routers, error handling. */
export function createApp(): Express {
  const app = express();

  // Don't advertise the framework (removes the `X-Powered-By: Express` header).
  app.disable('x-powered-by');

  // Trust the first proxy so req.ip reflects the real client (correct IP-based
  // rate limiting behind a load balancer / tunnel).
  app.set('trust proxy', 1);

  app.use(securityHeaders);
  // `credentials: true` so the browser sends/stores the session cookies; the
  // origin is a single fixed value (never `*`, which credentialed CORS forbids).
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
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
