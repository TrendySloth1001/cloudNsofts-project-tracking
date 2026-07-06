'use client';

import { useRouter } from 'next/navigation';
import type { AuthUser } from '@cnsofts/shared';
import { Menu } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { profileStorage } from '@/lib/profile-storage';
import styles from './account-menu.module.css';

export interface AccountMenuProps {
  user: AuthUser;
  onSignOut: () => void;
}

/** Top-right account control: avatar trigger opening the profile/settings menu. */
export function AccountMenu({ user, onSignOut }: AccountMenuProps) {
  const router = useRouter();
  const avatarId = profileStorage.getAvatar(user.id);

  return (
    <Menu
      align="end"
      portal
      trigger={
        <button
          type="button"
          className={styles.trigger}
          aria-label="Account menu"
          title={user.email}
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
        {
          label: 'Profile & settings',
          icon: 'settings',
          onSelect: () => router.push('/profile-setup'),
        },
        { separator: true },
        {
          label: 'Log out',
          icon: 'logout',
          danger: true,
          onSelect: onSignOut,
        },
      ]}
    />
  );
}
