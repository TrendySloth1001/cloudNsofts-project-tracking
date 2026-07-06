'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmProvider, Icon, Spinner } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { Sidebar } from '@/components/layout/sidebar';
import { AccountMenu } from '@/components/layout/account-menu';
import { authApi } from '@/features/auth/auth.api';
import { useCurrentUser } from '@/features/auth/use-current-user';
import styles from './app-layout.module.css';

/** Authenticated app shell: a left sidebar (an off-canvas drawer on mobile)
 *  with a scrollable main area. Unauthenticated visitors go to /login. */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);

  function signOut() {
    authApi.logout();
    router.replace('/login');
  }

  if (loading || !user) {
    return (
      <div className={styles.center}>
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <ConfirmProvider>
      <div className={styles.shell}>
        {menuOpen && (
          <div
            className={styles.overlay}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        <Sidebar
          user={user}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <div className={styles.content}>
          <header className={styles.topBar}>
            <button
              type="button"
              className={styles.hamburger}
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" size={22} />
            </button>
            <span className={styles.mobileBrand}>
              <Logo size="sm" />
            </span>
            <div className={styles.topBarRight}>
              <AccountMenu user={user} onSignOut={signOut} />
            </div>
          </header>
          <main className={styles.main}>{children}</main>
        </div>
      </div>
    </ConfirmProvider>
  );
}
