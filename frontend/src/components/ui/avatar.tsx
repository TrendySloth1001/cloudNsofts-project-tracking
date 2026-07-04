import { cx } from '@/lib/cx';
import styles from './avatar.module.css';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
}

const PX: Record<AvatarSize, number> = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 };

/** Deterministic tint per name, drawn from the palette. */
const TINTS = [
  { bg: 'var(--violet-100)', fg: 'var(--violet-700)' },
  { bg: 'var(--teal-100)', fg: 'var(--teal-700)' },
  { bg: 'var(--amber-100)', fg: 'var(--amber-700)' },
  { bg: 'var(--blue-100)', fg: 'var(--blue-700)' },
  { bg: 'var(--green-100)', fg: 'var(--green-700)' },
  { bg: 'var(--red-100)', fg: 'var(--red-700)' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function tintFor(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return TINTS[sum % TINTS.length]!;
}

export function Avatar({
  name,
  src,
  size = 'md',
  status,
  className,
}: AvatarProps) {
  const px = PX[size];
  const tint = tintFor(name);
  return (
    <span
      className={cx(styles.avatar, className)}
      style={{ width: px, height: px }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.image} src={src} alt={name} />
      ) : (
        <span
          className={styles.initials}
          style={{
            background: tint.bg,
            color: tint.fg,
            fontSize: Math.round(px * 0.4),
          }}
          aria-label={name}
        >
          {initials(name)}
        </span>
      )}
      {status && (
        <span
          className={cx(styles.status, styles[status])}
          title={status}
          aria-label={status}
        />
      )}
    </span>
  );
}
