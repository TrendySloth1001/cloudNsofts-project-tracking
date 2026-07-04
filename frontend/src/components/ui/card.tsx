import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevation. `sm` = resting, `md` = hoverable/raised, `none` = flat outline. */
  elevation?: 'none' | 'sm' | 'md';
  /** Interactive hover affordance (e.g. clickable card). */
  interactive?: boolean;
}

export function Card({
  elevation = 'sm',
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cx(
        styles.card,
        styles[`elevation-${elevation}`],
        interactive && styles.interactive,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx(styles.header, className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className={styles.title}>{children}</h3>;
}

export function CardDescription({ children }: { children: ReactNode }) {
  return <p className={styles.description}>{children}</p>;
}

export function CardBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx(styles.body, className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx(styles.footer, className)} {...props}>
      {children}
    </div>
  );
}
