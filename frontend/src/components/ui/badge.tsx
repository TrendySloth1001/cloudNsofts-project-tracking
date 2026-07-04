import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './badge.module.css';

export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'teal';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  /** Show a leading status dot. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[variant], styles[size], className)}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
