'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROFILE_BIO_MAX_LENGTH, type UserProfile } from '@cnsofts/shared';
import { Button, Icon, Input, Spinner, Textarea } from '@/components/ui';
import { cx } from '@/lib/cx';
import { authApi } from '@/features/auth/auth.api';
import { profileStorage } from '@/lib/profile-storage';
import {
  avatarCatalog,
  defaultAvatarFor,
  isKnownAvatar,
} from '@/features/profile/avatar-catalog';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { SkillsField } from '@/features/profile/components/skills-field';
import { useMyInvitations } from '@/features/invitations/use-my-invitations';
import { InvitationCard } from '@/features/invitations/components/invitation-card';
import styles from './onboarding.module.css';

const STEPS = ['Avatar', 'About you', 'Invitations'];

export function Onboarding({ user }: { user: UserProfile }) {
  const router = useRouter();
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  const stored = profileStorage.getAvatar(user.id);
  const [avatar, setAvatar] = useState(
    isKnownAvatar(stored) ? stored : defaultAvatarFor(user.id),
  );
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title);
  const [bio, setBio] = useState(user.bio);
  const [skills, setSkills] = useState<string[]>(user.skills);
  const [location, setLocation] = useState(user.location);

  const { invitations, loading: invitesLoading, removeLocal } =
    useMyInvitations();

  function pickAvatar(id: string) {
    setAvatar(id);
    profileStorage.setAvatar(user.id, id);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await authApi.updateProfile({
        name: name.trim() || user.name,
        title: title.trim(),
        bio: bio.trim(),
        skills,
        location: location.trim(),
      });
      setStep(2);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.stepbar}>
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={cx(styles.seg, i <= step && styles.segActive)}
          />
        ))}
      </div>

      <div className={styles.content}>
        {step === 0 && (
          <div className={styles.step}>
            <div className={styles.preview}>
              <div className={styles.previewRing}>
                <UserAvatar
                  name={user.name}
                  seed={user.id}
                  avatarId={avatar}
                  size={88}
                />
              </div>
              <h1 className={styles.title}>Welcome, {firstName} 👋</h1>
              <p className={styles.subtitle}>
                Let&apos;s set up your profile. Start by picking an avatar.
              </p>
            </div>
            <div className={styles.grid}>
              {avatarCatalog.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={id === avatar}
                  aria-label={`Avatar ${id}`}
                  className={cx(styles.cell, id === avatar && styles.cellActive)}
                  onClick={() => pickAvatar(id)}
                >
                  <UserAvatar
                    name={user.name}
                    seed={user.id}
                    avatarId={id}
                    size={52}
                  />
                  {id === avatar && (
                    <span className={styles.check}>
                      <Icon name="check" size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className={styles.step}>
            <div className={styles.stepHead}>
              <h1 className={styles.title}>About you</h1>
              <p className={styles.subtitle}>
                Help your team know who you are. You can change this anytime.
              </p>
            </div>
            <div className={styles.form}>
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Job title"
                value={title}
                placeholder="e.g. Frontend Engineer"
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                label="About"
                value={bio}
                rows={3}
                placeholder="A short bio — markdown supported."
                hint={`${bio.length}/${PROFILE_BIO_MAX_LENGTH}`}
                onChange={(e) => setBio(e.target.value)}
              />
              <div className={styles.labelled}>
                <span className={styles.fieldLabel}>Skills</span>
                <SkillsField values={skills} onChange={setSkills} />
              </div>
              <Input
                label="Location"
                value={location}
                placeholder="e.g. Mumbai, India"
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.step}>
            <div className={styles.stepHead}>
              <h1 className={styles.title}>Your invitations</h1>
              <p className={styles.subtitle}>
                {invitations.length > 0
                  ? 'You’ve been invited to these projects — accept to jump in.'
                  : 'No invitations yet. A manager can invite you to a project anytime.'}
              </p>
            </div>
            {invitesLoading ? (
              <div className={styles.invitesState}>
                <Spinner size={22} />
              </div>
            ) : invitations.length > 0 ? (
              <div className={styles.invites}>
                {invitations.map((inv) => (
                  <InvitationCard
                    key={inv.id}
                    invitation={inv}
                    onResolved={(id) => removeLocal(id)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyInvites}>
                <span className={styles.emptyIcon}>
                  <Icon name="mail" size={26} tone="brand" />
                </span>
                <p className={styles.emptyText}>Nothing waiting for you yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {step > 0 && (
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={saving}
          >
            Back
          </Button>
        )}
        <span className={styles.footerGrow} />
        {step === 0 && (
          <Button size="lg" onClick={() => setStep(1)}>
            Continue
          </Button>
        )}
        {step === 1 && (
          <Button size="lg" loading={saving} onClick={() => void saveProfile()}>
            Continue
          </Button>
        )}
        {step === 2 && (
          <Button size="lg" onClick={() => router.replace('/')}>
            {invitations.length > 0 ? 'Done' : 'Go to workspace'}
          </Button>
        )}
      </div>
    </div>
  );
}
