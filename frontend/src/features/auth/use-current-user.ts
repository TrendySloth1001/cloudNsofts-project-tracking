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
    // Auth is cookie-based: ask the server who we are. `me()` transparently
    // refreshes an expired access token; a real 401 means no session.
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        // Hard reload (not a client route change) so any in-memory store from
        // the ended session is wiped before /login renders.
        window.location.href = '/login';
      })
      .finally(() => setLoading(false));
  }, [router]);

  return { user, loading };
}
