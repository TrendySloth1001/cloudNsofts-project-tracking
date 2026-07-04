'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './switch.module.css';

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, description, disabled, className, ...props },
  ref,
) {
  return (
    <label className={cx(styles.root, disabled && styles.disabled, className)}>
      <span className={styles.control}>
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className={styles.input}
          disabled={disabled}
          {...props}
        />
        <span className={styles.track}>
          <span className={styles.thumb} />
        </span>
      </span>
      {(label || description) && (
        <span className={styles.text}>
          {label && <span className={styles.label}>{label}</span>}
          {description && (
            <span className={styles.description}>{description}</span>
          )}
        </span>
      )}
    </label>
  );
});
