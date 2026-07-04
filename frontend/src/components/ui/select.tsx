'use client';

import {
  forwardRef,
  useId,
  type SelectHTMLAttributes,
  type ReactNode,
} from 'react';
import { cx } from '@/lib/cx';
import { Icon } from './icon';
import { Field } from './field';
import styles from './select.module.css';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  selectSize?: 'sm' | 'md' | 'lg';
  options?: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    selectSize = 'md',
    options,
    placeholder,
    id,
    required,
    disabled,
    className,
    containerClassName,
    children,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = `${selectId}-desc`;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={selectId}
      descriptionId={descriptionId}
      className={containerClassName}
    >
      <div
        className={cx(
          styles.wrapper,
          styles[selectSize],
          !!error && styles.hasError,
          disabled && styles.disabled,
        )}
      >
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? descriptionId : undefined}
          className={cx(styles.select, className)}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
        <Icon name="chevronDown" size={18} className={styles.chevron} />
      </div>
    </Field>
  );
});
