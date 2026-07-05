'use client';

import { useState } from 'react';
import { cx } from '@/lib/cx';
import {
  avatarAsset,
  defaultAvatarFor,
  isKnownAvatar,
} from '../avatar-catalog';
import styles from './user-avatar.module.css';

const FALLBACK_PALETTE = [
  '#6c5ce7',
  '#00b894',
  '#e17055',
  '#0984e3',
  '#d63031',
  '#e84393',
  '#fda7df',
  '#00897b',
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export interface UserAvatarProps {
  name: string;
  /** Stable seed (the user id) used for the default avatar. */
  seed: string;
  avatarId?: string | null;
  /** Rendered diameter in px. */
  size?: number;
  className?: string;
}

/**
 * Renders a user's illustration avatar. Uses the chosen [avatarId] if set,
 * otherwise a stable default derived from [seed]. Falls back to a colored
 * initial if the image can't load.
 */
export function UserAvatar({
  name,
  seed,
  avatarId,
  size = 32,
  className,
}: UserAvatarProps) {
  const [errored, setErrored] = useState(false);
  const id = isKnownAvatar(avatarId) ? avatarId : defaultAvatarFor(seed);
  // Tolerate a missing name (e.g. an older token without one).
  const safeName = name ?? '';
  const initial = safeName.trim() ? safeName.trim()[0].toUpperCase() : '?';

  return (
    <span
      className={cx(styles.avatar, className)}
      style={{ width: size, height: size }}
    >
      {errored ? (
        <span
          className={styles.fallback}
          style={{
            background:
              FALLBACK_PALETTE[hash(safeName) % FALLBACK_PALETTE.length],
            fontSize: Math.round(size * 0.42),
          }}
        >
          {initial}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.img}
          src={avatarAsset(id)}
          alt={safeName}
          width={size}
          height={size}
          onError={() => setErrored(true)}
        />
      )}
    </span>
  );
}
