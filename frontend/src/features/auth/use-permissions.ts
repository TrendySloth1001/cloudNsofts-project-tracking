'use client';

import { useSyncExternalStore } from 'react';
import type { UserRole } from '@cnsofts/shared';
import { authApi } from './auth.api';

export interface Principal {
  role: UserRole;
  email: string;
}

/**
 * The signed-in principal, loaded once from `/auth/me` and shared across the app
 * via an external store. With httpOnly cookie auth the client can't read the
 * JWT, so identity comes from the API, not from decoding a token. `null` until
 * loaded (and when signed out).
 */
interface State {
  principal: Principal | null;
  loaded: boolean;
}

const SIGNED_OUT: State = { principal: null, loaded: true };
const INITIAL: State = { principal: null, loaded: false };

let state: State = INITIAL;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function ensureLoaded(): void {
  if (state.loaded || inflight) return;
  inflight = authApi
    .me()
    .then((res) => {
      state = {
        principal: { role: res.user.role, email: res.user.email },
        loaded: true,
      };
    })
    .catch(() => {
      state = SIGNED_OUT;
    })
    .finally(() => {
      inflight = null;
      emit();
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureLoaded();
  return () => listeners.delete(listener);
}

/** Drop the cached principal and reload it — call after login/logout so the UI
 *  reflects the new session immediately. */
export function invalidatePrincipal(): void {
  state = INITIAL;
  inflight = null;
  ensureLoaded();
  emit();
}

export function usePrincipal(): Principal | null {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
  return snapshot.principal;
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
