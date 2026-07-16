'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { invalidatePrincipal } from '@/features/auth/use-permissions';

/**
 * Landing page for the Google OAuth redirect. The backend has already set the
 * session cookies during the callback, so there's nothing to read from the URL
 * here — just refresh the cached principal and bounce into the app.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    invalidatePrincipal();
    router.replace('/');
  }, [router]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
      <Spinner size={28} />
    </div>
  );
}
