import express, { type Express } from 'express';
import cors from 'cors';
import { env } from './infra/env';
import { routeRegistry } from './router';
import {
  notFoundHandler,
  errorHandler,
} from './shared/http/error-middleware';

/** Assemble the Express application: middleware, feature routers, error handling. */
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  for (const { base, router } of routeRegistry) {
    app.use(base, router);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
