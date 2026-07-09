'use client';

import { Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { ProfileView } from '@/features/profile/components/profile-view';

export default function ProfilePage() {
  const { user, loading } = useCurrentUser();

  if (loading || !user) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: '4rem 0' }}>
        <Spinner size={28} />
      </div>
    );
  }

  return <ProfileView user={user} />;
}
