'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon } from './icon';
import styles from './checkbox.module.css';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, description, disabled, className, ...props }, ref) {
    return (
      <label
        className={cx(styles.root, disabled && styles.disabled, className)}
      >
        <span className={styles.control}>
          <input
            ref={ref}
            type="checkbox"
            className={styles.input}
            disabled={disabled}
            {...props}
          />
          <span className={styles.box}>
            <Icon
              name="check"
              size={12}
              strokeWidth={3}
              className={styles.check}
            />
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
  },
);
