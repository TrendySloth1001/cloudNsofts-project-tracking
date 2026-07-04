import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './field.module.css';

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  /** id applied to the hint/error text, for aria-describedby wiring. */
  descriptionId?: string;
  className?: string;
  children: ReactNode;
}

/** Labeled form-control wrapper: renders a label, the control, and a hint/error. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  descriptionId,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p id={descriptionId} className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
