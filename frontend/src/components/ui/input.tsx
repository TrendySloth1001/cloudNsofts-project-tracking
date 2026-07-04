'use client';

import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icon';
import { Field } from './field';
import styles from './input.module.css';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  leftIcon?: IconName;
  rightIcon?: IconName;
  inputSize?: InputSize;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leftIcon,
    rightIcon,
    inputSize = 'md',
    id,
    type = 'text',
    required,
    disabled,
    className,
    containerClassName,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-desc`;
  const [reveal, setReveal] = useState(false);

  const isPassword = type === 'password';
  const effectiveType = isPassword && reveal ? 'text' : type;
  const hasRightAffordance = isPassword || Boolean(rightIcon);

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      descriptionId={descriptionId}
      className={containerClassName}
    >
      <div
        className={cx(
          styles.wrapper,
          styles[inputSize],
          !!error && styles.hasError,
          disabled && styles.disabled,
        )}
      >
        {leftIcon && (
          <Icon name={leftIcon} size={18} className={styles.affordanceLeft} />
        )}
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? descriptionId : undefined}
          className={cx(
            styles.input,
            leftIcon && styles.withLeft,
            hasRightAffordance && styles.withRight,
            className,
          )}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            <Icon name={reveal ? 'eyeOff' : 'eye'} size={18} />
          </button>
        ) : rightIcon ? (
          <Icon name={rightIcon} size={18} className={styles.affordanceRight} />
        ) : null}
      </div>
    </Field>
  );
});
