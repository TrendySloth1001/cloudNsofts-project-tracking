'use client';

import { useRouter } from 'next/navigation';
import type { AuthUser } from '@cnsofts/shared';
import { Menu } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { cx } from '@/lib/cx';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { profileStorage } from '@/lib/profile-storage';
import { NotificationButton } from './notification-button';
import styles from './app-bar.module.css';

export interface AppBarProps {
  user: AuthUser;
  onSignOut: () => void;
}

/** Floating app bar: brand chip on the left, actions chip on the right.
 *  Logout lives inside the account (avatar) menu, not as a standalone button. */
export function AppBar({ user, onSignOut }: AppBarProps) {
  const router = useRouter();
  const avatarId = profileStorage.getAvatar(user.id);

  return (
    <div className={styles.wrap}>
      <div className={cx(styles.chip, styles.chipBrand)}>
        <Logo size="sm" />
      </div>

      <div className={cx(styles.chip, styles.chipActions)}>
        <NotificationButton />
        <Menu
          align="end"
          trigger={
            <button
              type="button"
              className={styles.avatarBtn}
              aria-label="Account menu"
            >
              <UserAvatar
                name={user.name}
                seed={user.id}
                avatarId={avatarId}
                size={32}
              />
            </button>
          }
          items={[
            { label: user.email, icon: 'userCircle', disabled: true },
            { separator: true },
            {
              label: 'Profile',
              icon: 'user',
              onSelect: () => router.push('/profile-setup'),
            },
            {
              label: 'Log out',
              icon: 'logout',
              danger: true,
              onSelect: onSignOut,
            },
          ]}
        />
      </div>
    </div>
  );
}
