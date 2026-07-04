'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@cnsofts/shared';
import { Button, Divider, Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { profileStorage } from '@/lib/profile-storage';
import {
  avatarCatalog,
  defaultAvatarFor,
  isKnownAvatar,
} from '../avatar-catalog';
import { UserAvatar } from './user-avatar';
import styles from './profile-setup.module.css';

export function ProfileSetup({ user }: { user: AuthUser }) {
  const router = useRouter();
  const first = user.name.trim().split(/\s+/)[0] || user.name;

  const stored = profileStorage.getAvatar(user.id);
  const [selected, setSelected] = useState<string>(
    isKnownAvatar(stored) ? stored : defaultAvatarFor(user.id),
  );
  const [step, setStep] = useState<0 | 1>(0);
  const [finishing, setFinishing] = useState(false);

  function pick(id: string) {
    setSelected(id);
    profileStorage.setAvatar(user.id, id);
  }

  function onPrimary() {
    if (step === 0) {
      setStep(1);
      return;
    }
    setFinishing(true);
    router.replace('/');
  }

  return (
    <div className={styles.shell}>
      <div className={styles.stepbar}>
        {[0, 1].map((i) => (
          <span
            key={i}
            className={cx(styles.seg, i <= step && styles.segActive)}
          />
        ))}
      </div>

      <div className={styles.content}>
        {step === 0 ? (
          <div className={styles.step}>
            <div className={styles.preview}>
              <div className={styles.previewRing}>
                <UserAvatar
                  name={user.name}
                  seed={user.id}
                  avatarId={selected}
                  size={92}
                />
              </div>
              <h1 className={styles.title}>Welcome, {first} 👋</h1>
              <p className={styles.subtitle}>
                Pick an avatar — you can change it anytime in Settings.
              </p>
            </div>
            <Divider />
            <div className={styles.grid}>
              {avatarCatalog.map((id) => {
                const active = id === selected;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    aria-label={`Avatar ${id}`}
                    className={cx(styles.cell, active && styles.cellActive)}
                    onClick={() => pick(id)}
                  >
                    <UserAvatar
                      name={user.name}
                      seed={user.id}
                      avatarId={id}
                      size={56}
                    />
                    {active && (
                      <span className={styles.check}>
                        <Icon name="check" size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={cx(styles.step, styles.ready)}>
            <div className={styles.glow}>
              <UserAvatar
                name={user.name}
                seed={user.id}
                avatarId={selected}
                size={112}
              />
              <span className={styles.readyCheck}>
                <Icon name="check" size={18} strokeWidth={3} />
              </span>
            </div>
            <h1 className={styles.title}>You&apos;re all set, {first}!</h1>
            <div className={styles.infoChip}>
              <Icon name="ai" size={20} className={styles.infoIcon} />
              <span>Your workspace is ready — jump in from your home screen.</span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button size="lg" fullWidth loading={finishing} onClick={onPrimary}>
          {step === 0 ? 'Continue' : 'Get started'}
        </Button>
      </div>
    </div>
  );
}
