'use client';

import {
  projectAbilities,
  type Project,
  type ProjectAbilities,
  type ProjectRole,
} from '@cnsofts/shared';
import { usePrincipal, type Principal } from './use-permissions';

const NO_ABILITIES: ProjectAbilities = {
  canEditBoard: false,
  canManageTeam: false,
  canManageChannels: false,
  canEditProject: false,
  canDeleteProject: false,
};

export interface ProjectPermissions extends ProjectAbilities {
  /** The caller's effective role in this project (null until resolved). */
  role: ProjectRole | null;
  email: string | null;
  isAdmin: boolean;
  isClient: boolean;
  isViewer: boolean;
}

/** Resolve the caller's role for `project` from the members roster + global
 *  principal — the same rule the backend enforces (`getProjectRole`). */
function resolveProjectRole(
  project: Project | null | undefined,
  principal: Principal | null,
): ProjectRole | null {
  if (!principal) return null;
  if (principal.role === 'ADMIN') return 'admin';
  if (principal.role === 'CLIENT') return 'client';
  if (!project) return null;
  const email = principal.email.toLowerCase();
  const mine = project.members.find((m) => m.email.toLowerCase() === email);
  // A visible project the caller isn't explicitly a member of → treat as viewer.
  return mine ? mine.role : 'viewer';
}

/**
 * Per-project UI permissions: the caller's role in this project and the
 * abilities it grants, derived from the shared `projectAbilities` matrix. UI
 * gating only — the backend is the real authority. Abilities are all `false`
 * until the principal resolves after mount, so privileged controls never flash.
 */
export function useProjectPermissions(
  project: Project | null | undefined,
): ProjectPermissions {
  const principal = usePrincipal();
  const role = resolveProjectRole(project, principal);
  const abilities = role ? projectAbilities(role) : NO_ABILITIES;
  return {
    ...abilities,
    role,
    email: principal?.email ?? null,
    isAdmin: role === 'admin',
    isClient: role === 'client',
    isViewer: role === 'viewer',
  };
}
