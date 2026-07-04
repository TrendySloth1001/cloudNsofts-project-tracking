'use client';

import { Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { ProfileSetup } from '@/features/profile/components/profile-setup';

export default function ProfileSetupPage() {
  const { user, loading } = useCurrentUser();

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spinner size={28} />
      </div>
    );
  }

  return <ProfileSetup user={user} />;
}
