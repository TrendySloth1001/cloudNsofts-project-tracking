import { cx } from '@/lib/cx';
import styles from './divider.module.css';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  className?: string;
}

export function Divider({
  orientation = 'horizontal',
  label,
  className,
}: DividerProps) {
  if (label && orientation === 'horizontal') {
    return (
      <div className={cx(styles.labeled, className)} role="separator">
        <span className={styles.line} />
        <span className={styles.label}>{label}</span>
        <span className={styles.line} />
      </div>
    );
  }
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cx(
        orientation === 'vertical' ? styles.vertical : styles.horizontal,
        className,
      )}
    />
  );
}
