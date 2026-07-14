'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AppDensity, AppTheme, UserProfile } from '@cnsofts/shared';
import {
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
import { applyAppearance } from '@/lib/appearance';
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

export function SettingsView({ user }: { user: UserProfile }) {
  // Appearance prefs are DB-backed (UserProfile). We keep local state so the
  // toggles feel instant, apply the change to the DOM optimistically, persist
  // via PATCH /auth/me, and revert both if the save fails.
  const [theme, setTheme] = useState<AppTheme>(user.theme);
  const [density, setDensity] = useState<AppDensity>(user.density);
  const [savingAppearance, setSavingAppearance] = useState(false);

  async function saveAppearance(patch: { theme?: AppTheme; density?: AppDensity }) {
    const prev = { theme, density };
    const next = {
      theme: patch.theme ?? theme,
      density: patch.density ?? density,
    };
    setTheme(next.theme);
    setDensity(next.density);
    applyAppearance(next.theme, next.density);
    setSavingAppearance(true);
    try {
      await authApi.updateProfile(patch);
    } catch {
      setTheme(prev.theme);
      setDensity(prev.density);
      applyAppearance(prev.theme, prev.density);
    } finally {
      setSavingAppearance(false);
    }
  }

  // Hard navigation so the in-memory stores (module singletons) are wiped and
  // can't leak into the next account signed in from this tab. See app layout.
  function signOut() {
    authApi.logout();
    window.location.href = '/login';
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
            control={
              <Switch
                checked={theme === 'dark'}
                disabled={savingAppearance}
                aria-label="Dark theme"
                onChange={(e) =>
                  void saveAppearance({
                    theme: e.target.checked ? 'dark' : 'light',
                  })
                }
              />
            }
          />
          <Row
            label="Compact density"
            description="Tighter spacing to fit more on screen."
            control={
              <Switch
                checked={density === 'compact'}
                disabled={savingAppearance}
                aria-label="Compact density"
                onChange={(e) =>
                  void saveAppearance({
                    density: e.target.checked ? 'compact' : 'comfortable',
                  })
                }
              />
            }
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
