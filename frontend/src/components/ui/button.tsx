import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icon';
import { Spinner } from './spinner';
import styles from './button.module.css';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'info';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cx(
          styles.button,
          styles[variant],
          styles[size],
          fullWidth && styles.fullWidth,
          loading && styles.loading,
          className,
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span className={styles.spinner}>
            <Spinner size={ICON_SIZE[size]} />
          </span>
        )}
        <span className={styles.content}>
          {leftIcon && <Icon name={leftIcon} size={ICON_SIZE[size]} />}
          {children != null && <span>{children}</span>}
          {rightIcon && <Icon name={rightIcon} size={ICON_SIZE[size]} />}
        </span>
      </button>
    );
  },
);
