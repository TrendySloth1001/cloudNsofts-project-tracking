import type { NextFunction, Request, Response } from 'express';
import {
  projectAbilities,
  type AuthUser,
  type ProjectAbilities,
  type ProjectRole,
  type UserRole,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';
import { isPlatformAdmin } from './platform-admin';

/** The authenticated principal, or a 401 if the request wasn't authed. */
export function requireUser(req: Request): AuthUser {
  if (!req.authUser) throw HttpError.unauthorized('Authentication required');
  return req.authUser;
}

/**
 * The user's effective role *within a project*, or `null` if they can't enter
 * it. Resolved purely from that project's rosters — **never** the global account
 * role (CLAUDE.md §6). The env platform super-admin gets no bypass here: it only
 * "enters" a project it is actually a roster member of (project content is
 * membership-gated). Its cross-project *metadata* oversight lives in the list
 * path ({@link projectScopeWhere}), not here.
 *  - a `ProjectMember` of this project: their `ProjectMember.role`.
 *  - a `ProjectClient` of this project: `client`.
 *  - otherwise: `null` (no content access).
 */
export async function getProjectRole(
  user: AuthUser,
  projectId: string,
): Promise<ProjectRole | null> {
  const membership = await prisma.projectMember.findFirst({
    where: { projectId, email: user.email },
    select: { role: true },
  });
  if (membership) return membership.role;
  const isClient = await prisma.projectClient.count({
    where: { projectId, email: user.email },
  });
  return isClient > 0 ? 'client' : null;
}

/** Whether a user may see/enter a project's contents (any roster role at all). */
export async function canAccessProject(
  user: AuthUser,
  projectId: string,
): Promise<boolean> {
  return (await getProjectRole(user, projectId)) !== null;
}

/** Prisma `where` for content-level queries: the projects a user may actually
 *  read *inside* — roster membership only, with NO platform-admin bypass. Use
 *  this whenever a query returns task/message/doc bodies (e.g. the agent
 *  activity feed), so the super-admin can't read contents it isn't a member of. */
export function rosterScopeWhere(user: AuthUser) {
  return {
    OR: [
      { members: { some: { email: user.email } } },
      { clients: { some: { email: user.email } } },
    ],
  };
}

/** Prisma `where` that scopes the project *list* to what the user may see. A
 *  normal user sees only their roster projects. The env platform super-admin
 *  additionally sees every project for oversight — but the list path returns
 *  those foreign projects as **metadata only** (no contents); see
 *  `projectsService.list`. */
export function projectScopeWhere(user: AuthUser) {
  if (isPlatformAdmin(user)) return {};
  return rosterScopeWhere(user);
}

/**
 * Gate the `/:id` project subtree: 404 (not 403, to avoid leaking existence)
 * unless the authed user may access that project. On success, the resolved
 * per-project role is stashed on `req.projectRole` for downstream ability
 * checks (so they don't re-query).
 */
export function requireProjectAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  void (async () => {
    const user = requireUser(req);
    // A project-scoped PAT may only reach the projects it was limited to.
    const scope = req.tokenScope;
    if (
      scope &&
      scope.projectIds.length > 0 &&
      !scope.projectIds.includes(req.params.id)
    ) {
      throw HttpError.forbidden('This token is not scoped to that project.');
    }
    const role = await getProjectRole(user, req.params.id);
    if (!role) throw HttpError.notFound('Project not found');
    req.projectRole = role;
  })()
    .then(() => next())
    .catch(next);
}

/**
 * Middleware factory: 403 unless the caller's per-project role grants the given
 * ability. Relies on {@link requireProjectAccess} having run first to populate
 * `req.projectRole`.
 */
export function requireProjectAbility(ability: keyof ProjectAbilities) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.projectRole;
    if (!role || !projectAbilities(role)[ability]) {
      next(HttpError.forbidden());
      return;
    }
    next();
  };
}

/** Middleware factory: 403 unless the user's *global* role is one of `roles`
 *  (used for cross-project gates like creating a project). */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.authUser?.role;
    if (!role || !roles.includes(role)) {
      next(HttpError.forbidden());
      return;
    }
    next();
  };
}
