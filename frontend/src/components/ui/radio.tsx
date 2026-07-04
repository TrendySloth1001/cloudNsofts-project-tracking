'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './radio.module.css';

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, description, disabled, className, ...props },
  ref,
) {
  return (
    <label className={cx(styles.root, disabled && styles.disabled, className)}>
      <span className={styles.control}>
        <input
          ref={ref}
          type="radio"
          className={styles.input}
          disabled={disabled}
          {...props}
        />
        <span className={styles.circle}>
          <span className={styles.dot} />
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
