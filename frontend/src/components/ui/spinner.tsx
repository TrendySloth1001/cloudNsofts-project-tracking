import { cx } from '@/lib/cx';
import styles from './spinner.module.css';

export interface SpinnerProps {
  /** Diameter in pixels. Default 20. */
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 20, className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      className={cx(styles.spinner, className)}
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 10) }}
      role="status"
      aria-label={label}
    />
  );
}
