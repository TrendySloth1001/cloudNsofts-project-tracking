import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './tooltip.module.css';

export interface TooltipProps {
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  className?: string;
}

/** Lightweight CSS tooltip — shows on hover and keyboard focus. */
export function Tooltip({
  content,
  side = 'top',
  children,
  className,
}: TooltipProps) {
  return (
    <span className={cx(styles.wrapper, className)}>
      {children}
      <span role="tooltip" className={cx(styles.tooltip, styles[side])}>
        {content}
      </span>
    </span>
  );
}
