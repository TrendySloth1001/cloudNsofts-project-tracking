import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icon';
import styles from './icon-button.module.css';

export type IconButtonVariant = 'ghost' | 'outline' | 'primary' | 'subtle';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: IconName;
  /** Required for accessibility — describes the action. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const ICON_SIZE: Record<IconButtonSize, number> = { sm: 16, md: 18, lg: 20 };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { icon, label, variant = 'ghost', size = 'md', className, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cx(styles.iconButton, styles[variant], styles[size], className)}
        {...props}
      >
        <Icon name={icon} size={ICON_SIZE[size]} />
      </button>
    );
  },
);
