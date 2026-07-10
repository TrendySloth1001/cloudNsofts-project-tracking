'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@cnsofts/shared';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Icon,
  Switch,
} from '@/components/ui';
import { authApi } from '@/features/auth/auth.api';
import { NotificationPreferencesCard } from '@/features/notifications/components/notification-preferences';
import styles from './settings-view.module.css';

/** A single preference row: label + description on the left, control on the right. */
function Row({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowDesc}>{description}</span>
      </div>
      <div className={styles.rowControl}>{control}</div>
    </div>
  );
}

/** A not-yet-wired toggle — visibly disabled with a "Soon" badge so it never
 *  pretends to persist a value it can't. */
function SoonToggle({ label }: { label: string }) {
  return (
    <span className={styles.soon}>
      <Badge variant="neutral" size="sm">
        Soon
      </Badge>
      <Switch disabled aria-label={label} />
    </span>
  );
}

export function SettingsView({ user }: { user: UserProfile }) {
  const router = useRouter();

  function signOut() {
    authApi.logout();
    router.replace('/login');
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>
          Manage your preferences and workspace tools.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>How CloudNSofts looks for you.</CardDescription>
        </CardHeader>
        <CardBody>
          <Row
            label="Dark theme"
            description="Switch the interface to a dark palette."
            control={<SoonToggle label="Dark theme" />}
          />
          <Row
            label="Compact density"
            description="Tighter spacing to fit more on screen."
            control={<SoonToggle label="Compact density" />}
          />
        </CardBody>
      </Card>

      <NotificationPreferencesCard />

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Account and integrations.</CardDescription>
        </CardHeader>
        <CardBody>
          <Link href="/profile" className={styles.linkRow}>
            <Icon name="user" size={18} tone="brand" />
            <span className={styles.linkText}>
              <span className={styles.rowLabel}>Profile</span>
              <span className={styles.rowDesc}>Your name, email and role.</span>
            </span>
            <Icon name="chevronRight" size={16} className={styles.linkChevron} />
          </Link>
          <Link href="/profile-setup" className={styles.linkRow}>
            <Icon name="userCircle" size={18} tone="brand" />
            <span className={styles.linkText}>
              <span className={styles.rowLabel}>Change avatar</span>
              <span className={styles.rowDesc}>Pick a different avatar.</span>
            </span>
            <Icon name="chevronRight" size={16} className={styles.linkChevron} />
          </Link>
          <Link href="/settings/agent" className={styles.linkRow}>
            <Icon name="plug" size={18} tone="brand" />
            <span className={styles.linkText}>
              <span className={styles.rowLabel}>Connect coding agent</span>
              <span className={styles.rowDesc}>
                Generate a token for your coding agent.
              </span>
            </span>
            <Icon name="chevronRight" size={16} className={styles.linkChevron} />
          </Link>
        </CardBody>
      </Card>

      {user.isPlatformAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Platform admin</CardTitle>
            <CardDescription>
              Tools for the whole platform, not just this account.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Link href="/settings/storage" className={styles.linkRow}>
              <Icon name="image" size={18} tone="brand" />
              <span className={styles.linkText}>
                <span className={styles.rowLabel}>Storage</span>
                <span className={styles.rowDesc}>
                  Review and reclaim orphaned image uploads.
                </span>
              </span>
              <Icon
                name="chevronRight"
                size={16}
                className={styles.linkChevron}
              />
            </Link>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in as {user.name}.</CardDescription>
        </CardHeader>
        <CardBody>
          <Button variant="outline" leftIcon="logout" onClick={signOut}>
            Log out
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
