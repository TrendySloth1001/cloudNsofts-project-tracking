'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@cnsofts/shared';
import { authApi } from './auth.api';

/** Loads the signed-in user; redirects to /login when unauthenticated. */
export function useCurrentUser() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
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
        authApi.logout();
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  return { user, loading };
}
