'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthUser } from '@cnsofts/shared';
import { Icon } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { cx } from '@/lib/cx';
import { useProjects } from '@/features/projects/use-projects';
import { CreateProjectDialog } from '@/features/projects/components/create-project-dialog';
import { projectTint } from '@/features/projects/project-visuals';
import { NotificationButton } from './notification-button';
import styles from './sidebar.module.css';

export interface SidebarProps {
  user: AuthUser;
  /** Mobile drawer open state. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ user, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { projects } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  // Desktop rail collapse. In-memory only (no persisted client preference).
  const [collapsed, setCollapsed] = useState(false);

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
          href="/profile-setup"
          onClick={onClose}
          title={collapsed ? 'Profile & settings' : undefined}
          className={cx(
            styles.navItem,
            pathname === '/profile-setup' && styles.active,
          )}
        >
          <Icon name="userCircle" size={18} tone="brand" />
          <span className={styles.label}>Profile &amp; settings</span>
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
