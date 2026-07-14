'use client';

import { useEffect, useState } from 'react';
import { ConfirmProvider, Icon, Spinner } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { Sidebar } from '@/components/layout/sidebar';
import { PendingInvitesModal } from '@/features/invitations/components/pending-invites-modal';
import { authApi } from '@/features/auth/auth.api';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { applyAppearance } from '@/lib/appearance';
import styles from './app-layout.module.css';

/** Authenticated app shell: a left sidebar (an off-canvas drawer on mobile)
 *  with a scrollable main area. Unauthenticated visitors go to /login. */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, loading } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);

  // Mirror the signed-in user's DB-backed appearance prefs onto <html> so the
  // theme/density tokens take effect across the app.
  useEffect(() => {
    if (user) applyAppearance(user.theme, user.density);
  }, [user]);

  // Full-page navigation (not a client route change): clearing the token isn't
  // enough — the in-memory project/notification stores are module singletons
  // that would survive into the next account signed in from this tab and leak
  // one user's data to another. A hard reload wipes all client state.
  function signOut() {
    authApi.logout();
    window.location.href = '/login';
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
          onSignOut={signOut}
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
          </header>
          <main className={styles.main}>{children}</main>
        </div>

        <PendingInvitesModal />
      </div>
    </ConfirmProvider>
  );
}
