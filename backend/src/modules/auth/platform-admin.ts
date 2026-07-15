import { timingSafeEqual } from 'node:crypto';
import type { AuthUser } from '@cnsofts/shared';
import { env } from '../../infra/env';

/** Length-safe, constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * The single platform super-admin is the env `ADMIN_EMAIL` — the one authority
 * above per-project roles (CLAUDE.md §6). Platform-wide powers key off *this
 * identity*, never the global `UserRole` value: a DB `users.role === 'ADMIN'`
 * row must NOT confer cross-project access (that would silently mint a second
 * super-admin). `env.ADMIN_EMAIL` is already normalized (trimmed + lowercased);
 * normalize the candidate the same way so a differently-cased token can't slip
 * past — or fail to match — the reserved identity.
 */
export function isPlatformAdmin(user: Pick<AuthUser, 'email'>): boolean {
  return safeEqual(user.email.trim().toLowerCase(), env.ADMIN_EMAIL);
}
