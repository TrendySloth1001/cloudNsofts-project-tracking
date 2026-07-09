'use client';

import { Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { Onboarding } from '@/features/onboarding/components/onboarding';

export default function OnboardingPage() {
  const { user, loading } = useCurrentUser();

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spinner size={28} />
      </div>
    );
  }

  return <Onboarding user={user} />;
}
