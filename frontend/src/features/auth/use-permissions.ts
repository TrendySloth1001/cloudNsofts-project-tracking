'use client';

import { useEffect, useState } from 'react';
import { userRoleSchema, type UserRole } from '@cnsofts/shared';
import { authStorage } from '@/lib/auth-storage';

export interface Principal {
  role: UserRole;
  email: string;
}

/** Decode the role + email from the stored JWT payload (UI gating only — the
 *  backend is the real authority). Returns null if there's no/invalid token. */
function readPrincipal(): Principal | null {
  const token = authStorage.get();
  if (!token) return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as {
      role?: unknown;
      email?: unknown;
    };
    return {
      role: userRoleSchema.parse(payload.role),
      email: typeof payload.email === 'string' ? payload.email : '',
    };
  } catch {
    return null;
  }
}

/**
 * The stored principal, resolved after mount (client-only) to avoid a hydration
 * mismatch. `null` on the server and until the first effect runs.
 */
export function usePrincipal(): Principal | null {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  useEffect(() => {
    setPrincipal(readPrincipal());
  }, []);
  return principal;
}

export interface Permissions {
  role: UserRole | null;
  email: string | null;
  isAdmin: boolean;
  isClient: boolean;
}

/**
 * Global (cross-project) principal facts. Per-project abilities (edit board,
 * manage team/channels) come from {@link useProjectPermissions} instead, since
 * they depend on the caller's role *within* a specific project.
 */
export function usePermissions(): Permissions {
  const principal = usePrincipal();
  const role = principal?.role ?? null;
  return {
    role,
    email: principal?.email ?? null,
    isAdmin: role === 'ADMIN',
    isClient: role === 'CLIENT',
  };
}
