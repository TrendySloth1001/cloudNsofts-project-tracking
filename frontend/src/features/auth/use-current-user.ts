'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@cnsofts/shared';
import { authApi } from './auth.api';

/** Loads the signed-in user (full profile); redirects to /login when
 *  unauthenticated. */
export function useCurrentUser() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authApi.isAuthenticated()) {
      router.replace('/login');
      return;
    }
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        // Hard reload (not a client route change) so any in-memory store from
        // the expired session is wiped before /login renders.
        authApi.logout();
        window.location.href = '/login';
      })
      .finally(() => setLoading(false));
  }, [router]);

  return { user, loading };
}
