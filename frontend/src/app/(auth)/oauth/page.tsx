'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { authStorage } from '@/lib/auth-storage';

/**
 * Landing page for the Google OAuth redirect. The backend hands the JWT in the
 * URL fragment (`#token=…`, never sent to a server), which we store and then
 * bounce into the app. A missing token means the flow failed.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const token = new URLSearchParams(hash).get('token');
    if (token) {
      authStorage.set(token);
      // Clear the token from the URL/history before entering the app.
      router.replace('/');
    } else {
      router.replace('/login?error=oauth_failed');
    }
  }, [router]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
      <Spinner size={28} />
    </div>
  );
}
