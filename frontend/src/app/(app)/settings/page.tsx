'use client';

import { Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { SettingsView } from '@/features/settings/components/settings-view';

export default function SettingsPage() {
  const { user, loading } = useCurrentUser();

  if (loading || !user) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: '4rem 0' }}>
        <Spinner size={28} />
      </div>
    );
  }

  return <SettingsView user={user} />;
}
