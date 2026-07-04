import type { Router } from 'express';
import { API_ROUTES } from '@cnsofts/shared';
import { healthRoutes } from './modules/health/health.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { projectsRoutes } from './modules/projects/projects.routes';

export interface RouteModule {
  /** Base mount path (from the shared single source of truth). */
  base: string;
  router: Router;
}

/**
 * The single source of truth for HTTP routing: every feature module's router
 * is registered here, mounted at a path defined once in `@cnsofts/shared`.
 * Add a new module by adding one line.
 */
export const routeRegistry: RouteModule[] = [
  { base: API_ROUTES.health, router: healthRoutes },
  { base: API_ROUTES.auth, router: authRoutes },
  { base: API_ROUTES.users, router: usersRoutes },
  { base: API_ROUTES.projects, router: projectsRoutes },
];
