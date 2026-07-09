'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PROFILE_BIO_MAX_LENGTH,
  USER_ROLE_LABELS,
  type UpdateProfileInput,
  type UserProfile,
  type UserRole,
} from '@cnsofts/shared';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Icon,
  Input,
  Markdown,
  Textarea,
  type BadgeVariant,
} from '@/components/ui';
import { cx } from '@/lib/cx';
import { ApiRequestError, fieldErrorMessage } from '@/lib/api-client';
import { authApi } from '@/features/auth/auth.api';
import { profileStorage } from '@/lib/profile-storage';
import { UserAvatar } from './user-avatar';
import { SkillsField } from './skills-field';
import styles from './profile-view.module.css';

const ROLE_VARIANT: Record<UserRole, BadgeVariant> = {
  ADMIN: 'primary',
  MEMBER: 'info',
  VIEWER: 'neutral',
  CLIENT: 'teal',
};

/** Prefix a bare host with https:// so the link is followable. */
function hrefFor(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function ProfileView({ user }: { user: UserProfile }) {
  const avatarId = profileStorage.getAvatar(user.id);
  const [profile, setProfile] = useState<UserProfile>(user);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit-form state (seeded from the current profile when editing begins).
  const [name, setName] = useState(profile.name);
  const [title, setTitle] = useState(profile.title);
  const [bio, setBio] = useState(profile.bio);
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [location, setLocation] = useState(profile.location);
  const [githubUrl, setGithubUrl] = useState(profile.githubUrl);
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl);
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl);

  function startEdit() {
    setName(profile.name);
    setTitle(profile.title);
    setBio(profile.bio);
    setSkills(profile.skills);
    setLocation(profile.location);
    setGithubUrl(profile.githubUrl);
    setWebsiteUrl(profile.websiteUrl);
    setLinkedinUrl(profile.linkedinUrl);
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (saving || !name.trim() || bio.length > PROFILE_BIO_MAX_LENGTH) return;
    const input: UpdateProfileInput = {
      name: name.trim(),
      title: title.trim(),
      bio: bio.trim(),
      skills,
      location: location.trim(),
      githubUrl: githubUrl.trim(),
      websiteUrl: websiteUrl.trim(),
      linkedinUrl: linkedinUrl.trim(),
    };
    setSaving(true);
    setError(null);
    try {
      const { user: updated } = await authApi.updateProfile(input);
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      setError(
        fieldErrorMessage(err, 'name') ??
          fieldErrorMessage(err, 'bio') ??
          (err instanceof ApiRequestError
            ? err.message
            : 'Could not save your profile.'),
      );
    } finally {
      setSaving(false);
    }
  }

  const links = [
    { label: 'GitHub', icon: 'code' as const, url: profile.githubUrl },
    { label: 'Website', icon: 'link' as const, url: profile.websiteUrl },
    { label: 'LinkedIn', icon: 'share' as const, url: profile.linkedinUrl },
  ].filter((l) => l.url);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Profile</h1>
          <p className={styles.subtitle}>Your account details and skills.</p>
        </div>
        {!editing && (
          <Button variant="outline" leftIcon="edit" onClick={startEdit}>
            Edit profile
          </Button>
        )}
      </header>

      <Card>
        <CardBody>
          <div className={styles.identity}>
            <UserAvatar
              name={profile.name}
              seed={profile.id}
              avatarId={avatarId}
              size={72}
            />
            <div className={styles.idText}>
              <h2 className={styles.name}>{profile.name}</h2>
              {profile.title && (
                <p className={styles.jobTitle}>{profile.title}</p>
              )}
              <div className={styles.idMeta}>
                <Badge variant={ROLE_VARIANT[profile.role]} dot>
                  {USER_ROLE_LABELS[profile.role]}
                </Badge>
                {profile.location && (
                  <span className={styles.metaChip}>{profile.location}</span>
                )}
              </div>
            </div>
            <Link href="/profile-setup" className={styles.avatarLink}>
              <Button variant="ghost" leftIcon="edit">
                Avatar
              </Button>
            </Link>
          </div>

          {editing ? (
            <div className={styles.form}>
              <div className={styles.grid2}>
                <Input
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="Job title"
                  value={title}
                  placeholder="e.g. Senior Frontend Engineer"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <Textarea
                label="About"
                value={bio}
                rows={4}
                placeholder="A short bio — markdown supported."
                hint={`${bio.length}/${PROFILE_BIO_MAX_LENGTH}`}
                error={bio.length > PROFILE_BIO_MAX_LENGTH ? 'Too long' : undefined}
                onChange={(e) => setBio(e.target.value)}
              />

              <div className={styles.labelledField}>
                <span className={styles.formLabel}>Skills</span>
                <SkillsField values={skills} onChange={setSkills} />
              </div>

              <div className={styles.grid2}>
                <Input
                  label="Location"
                  value={location}
                  placeholder="e.g. Mumbai, India"
                  onChange={(e) => setLocation(e.target.value)}
                />
                <Input
                  label="GitHub"
                  value={githubUrl}
                  placeholder="github.com/you"
                  onChange={(e) => setGithubUrl(e.target.value)}
                />
                <Input
                  label="Website"
                  value={websiteUrl}
                  placeholder="you.dev"
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
                <Input
                  label="LinkedIn"
                  value={linkedinUrl}
                  placeholder="linkedin.com/in/you"
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.formActions}>
                <Button
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={save}
                  loading={saving}
                  disabled={!name.trim() || bio.length > PROFILE_BIO_MAX_LENGTH}
                >
                  Save changes
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.view}>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>About</h3>
                {profile.bio.trim() ? (
                  <Markdown className={styles.bio}>{profile.bio}</Markdown>
                ) : (
                  <p className={styles.empty}>No bio yet.</p>
                )}
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Skills</h3>
                {profile.skills.length ? (
                  <div className={styles.skills}>
                    {profile.skills.map((s) => (
                      <span key={s} className={styles.skill}>
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={styles.empty}>No skills added yet.</p>
                )}
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Details</h3>
                <dl className={styles.fields}>
                  <div className={styles.field}>
                    <dt className={styles.fieldLabel}>Email</dt>
                    <dd className={styles.fieldValue}>{profile.email}</dd>
                  </div>
                  <div className={styles.field}>
                    <dt className={styles.fieldLabel}>Role</dt>
                    <dd className={styles.fieldValue}>
                      {USER_ROLE_LABELS[profile.role]}
                    </dd>
                  </div>
                  {links.length > 0 && (
                    <div className={styles.field}>
                      <dt className={styles.fieldLabel}>Links</dt>
                      <dd className={cx(styles.fieldValue, styles.links)}>
                        {links.map((l) => (
                          <a
                            key={l.label}
                            href={hrefFor(l.url)}
                            target="_blank"
                            rel="noreferrer noopener"
                            className={styles.linkTag}
                          >
                            <Icon name={l.icon} size={14} />
                            {l.label}
                          </a>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
