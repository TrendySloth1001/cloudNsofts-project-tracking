'use client';

import {
  forwardRef,
  useId,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react';
import { cx } from '@/lib/cx';
import { Field } from './field';
import styles from './textarea.module.css';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      label,
      hint,
      error,
      id,
      required,
      disabled,
      rows = 4,
      className,
      containerClassName,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const descriptionId = `${textareaId}-desc`;

    return (
      <Field
        label={label}
        hint={hint}
        error={error}
        required={required}
        htmlFor={textareaId}
        descriptionId={descriptionId}
        className={containerClassName}
      >
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? descriptionId : undefined}
          className={cx(styles.textarea, !!error && styles.hasError, className)}
          {...props}
        />
      </Field>
    );
  },
);
