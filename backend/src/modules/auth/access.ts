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

/** The authenticated principal, or a 401 if the request wasn't authed. */
export function requireUser(req: Request): AuthUser {
  if (!req.authUser) throw HttpError.unauthorized('Authentication required');
  return req.authUser;
}

/**
 * The user's effective role *within a project*, or `null` if they can't see it:
 *  - ADMIN: `admin` (any project).
 *  - CLIENT: `client` if they're a client of it.
 *  - MEMBER/VIEWER: their `ProjectMember.role` (manager/member/viewer).
 */
export async function getProjectRole(
  user: AuthUser,
  projectId: string,
): Promise<ProjectRole | null> {
  if (user.role === 'ADMIN') {
    const exists = await prisma.project.count({ where: { id: projectId } });
    return exists > 0 ? 'admin' : null;
  }
  if (user.role === 'CLIENT') {
    const isClient = await prisma.projectClient.count({
      where: { projectId, email: user.email },
    });
    return isClient > 0 ? 'client' : null;
  }
  const membership = await prisma.projectMember.findFirst({
    where: { projectId, email: user.email },
    select: { role: true },
  });
  return membership ? membership.role : null;
}

/** Whether a user may see/enter a project (any role at all). */
export async function canAccessProject(
  user: AuthUser,
  projectId: string,
): Promise<boolean> {
  return (await getProjectRole(user, projectId)) !== null;
}

/** Prisma `where` that scopes a project list to what the user may see. */
export function projectScopeWhere(user: AuthUser) {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'CLIENT') {
    return { clients: { some: { email: user.email } } };
  }
  return { members: { some: { email: user.email } } };
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
