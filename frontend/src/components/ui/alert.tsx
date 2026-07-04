import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icon';
import styles from './alert.module.css';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const ICONS: Record<AlertVariant, IconName> = {
  info: 'info',
  success: 'checkCircle',
  warning: 'warning',
  danger: 'alertCircle',
};

export interface AlertProps {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  /** When provided, renders a dismiss button. */
  onClose?: () => void;
  className?: string;
}

export function Alert({
  variant = 'info',
  title,
  children,
  onClose,
  className,
}: AlertProps) {
  return (
    <div className={cx(styles.alert, styles[variant], className)} role="alert">
      <Icon name={ICONS[variant]} size={20} className={styles.icon} />
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.message}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Dismiss"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
