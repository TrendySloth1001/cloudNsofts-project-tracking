'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthUser } from '@cnsofts/shared';
import { Icon, Menu } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { cx } from '@/lib/cx';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { profileStorage } from '@/lib/profile-storage';
import { useProjects } from '@/features/projects/use-projects';
import { CreateProjectDialog } from '@/features/projects/components/create-project-dialog';
import { projectTint } from '@/features/projects/project-visuals';
import { NotificationButton } from './notification-button';
import styles from './sidebar.module.css';

export interface SidebarProps {
  user: AuthUser;
  onSignOut: () => void;
  /** Mobile drawer open state. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ user, onSignOut, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { projects } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const avatarId = profileStorage.getAvatar(user.id);

  return (
    <aside className={cx(styles.sidebar, open && styles.open)}>
      <div className={styles.header}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="Home"
          onClick={onClose}
        >
          <Logo size="sm" />
        </Link>
        <NotificationButton />
      </div>

      <nav className={styles.nav}>
        {/* One project section: the "All projects" home + inline add, then the
            list directly below — no separate caption row. */}
        <div className={styles.navTop}>
          <Link
            href="/"
            onClick={onClose}
            className={cx(
              styles.navItem,
              styles.grow,
              pathname === '/' && styles.active,
            )}
          >
            <Icon name="home" size={18} tone="brand" />
            <span>All projects</span>
          </Link>
          {user.role === 'ADMIN' && (
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => setCreateOpen(true)}
              aria-label="New project"
              title="New project"
            >
              <Icon name="add" size={16} tone="brand" />
            </button>
          )}
        </div>

        <div className={styles.projectList}>
          {projects.length === 0 ? (
            <p className={styles.emptyNav}>No projects yet</p>
          ) : (
            projects.map((p) => {
              const active = pathname === `/projects/${p.id}`;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  onClick={onClose}
                  className={cx(styles.projectItem, active && styles.active)}
                >
                  <span
                    className={styles.projectDot}
                    style={{ background: projectTint(p.id).fg }}
                  />
                  <span className={styles.projectName}>{p.name}</span>
                </Link>
              );
            })
          )}
        </div>
      </nav>

      <div className={styles.bottom}>
        {/* Single account row — Settings lives in its menu (no duplicate row). */}
        <Menu
          side="top"
          align="start"
          trigger={
            <button type="button" className={styles.user}>
              <UserAvatar
                name={user.name}
                seed={user.id}
                avatarId={avatarId}
                size={30}
              />
              <span className={styles.userMeta}>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.userEmail}>{user.email}</span>
              </span>
              <Icon name="chevronUp" size={15} className={styles.userChevron} />
            </button>
          }
          items={[
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
      </div>

      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          onClose();
          router.push(`/projects/${id}`);
        }}
      />
    </aside>
  );
}
