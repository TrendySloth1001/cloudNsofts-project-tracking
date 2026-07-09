'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthUser } from '@cnsofts/shared';
import { Icon, Menu } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { cx } from '@/lib/cx';
import { useProjects } from '@/features/projects/use-projects';
import { CreateProjectDialog } from '@/features/projects/components/create-project-dialog';
import { projectTint } from '@/features/projects/project-visuals';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { profileStorage } from '@/lib/profile-storage';
import { NotificationButton } from './notification-button';
import styles from './sidebar.module.css';

export interface SidebarProps {
  user: AuthUser;
  /** Mobile drawer open state. */
  open: boolean;
  onClose: () => void;
  /** Sign the user out (from the account chip menu). */
  onSignOut: () => void;
}

export function Sidebar({ user, open, onClose, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { projects } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  // Desktop rail collapse. In-memory only (no persisted client preference).
  const [collapsed, setCollapsed] = useState(false);
  const avatarId = profileStorage.getAvatar(user.id);

  return (
    <aside className={cx(styles.sidebar, open && styles.open, collapsed && styles.collapsed)}>
      <div className={styles.header}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="Home"
          onClick={onClose}
        >
          <Logo size="sm" markOnly={collapsed} />
        </Link>
        <span className={styles.bell}>
          <NotificationButton />
        </span>
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name="sidebar" size={18} />
        </button>
      </div>

      <nav className={styles.nav}>
        {/* One project section: the "All projects" home + inline add, then the
            list directly below — no separate caption row. */}
        <div className={styles.navTop}>
          <Link
            href="/"
            onClick={onClose}
            title={collapsed ? 'All projects' : undefined}
            className={cx(
              styles.navItem,
              styles.grow,
              pathname === '/' && styles.active,
            )}
          >
            <Icon name="home" size={18} tone="brand" />
            <span className={styles.label}>All projects</span>
          </Link>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setCreateOpen(true)}
            aria-label="New project"
            title="New project"
          >
            <Icon name="add" size={16} tone="brand" />
          </button>
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
                  title={collapsed ? p.name : undefined}
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

      <div className={styles.bottomNav}>
        <Link
          href="/settings"
          onClick={onClose}
          title={collapsed ? 'Settings' : undefined}
          className={cx(
            styles.navItem,
            pathname === '/settings' && styles.active,
          )}
        >
          <Icon name="settings" size={18} tone="brand" />
          <span className={styles.label}>Settings</span>
        </Link>
        <Link
          href="/settings/agent"
          onClick={onClose}
          title={collapsed ? 'Connect coding agent' : undefined}
          className={cx(
            styles.navItem,
            pathname.startsWith('/settings/agent') && styles.active,
          )}
        >
          <Icon name="plug" size={18} tone="brand" />
          <span className={styles.label}>Connect coding agent</span>
        </Link>

        {/* Account chip — the signed-in user + a menu (relocated here from the
            floating top-right corner). */}
        <Menu
          align="start"
          portal
          trigger={
            <button
              type="button"
              className={styles.account}
              aria-label="Account menu"
              title={user.name}
            >
              <UserAvatar
                name={user.name}
                seed={user.id}
                avatarId={avatarId}
                size={30}
              />
              <span className={styles.accountName}>{user.name}</span>
            </button>
          }
          items={[
            {
              label: 'Profile',
              icon: 'user',
              onSelect: () => {
                onClose();
                router.push('/profile');
              },
            },
            {
              label: 'Settings',
              icon: 'settings',
              onSelect: () => {
                onClose();
                router.push('/settings');
              },
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
