'use client';

import { Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { StoragePanel } from '@/features/storage/components/storage-panel';

export default function StorageSettingsPage() {
  const { user, loading } = useCurrentUser();

  if (loading || !user) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: '4rem 0' }}>
        <Spinner size={28} />
      </div>
    );
  }

  // Defence in depth — the API is the real gate, but don't render the tool for
  // anyone but the platform super-admin.
  if (!user.isPlatformAdmin) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: '4rem 0' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>
          This page is available to platform administrators only.
        </p>
      </div>
    );
  }

  return <StoragePanel />;
}
