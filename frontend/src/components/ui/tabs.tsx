'use client';

import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName, type IconTone } from './icon';
import styles from './tabs.module.css';

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: IconName;
  /** Muted semantic color for the item's icon. Omit to inherit tab color. */
  iconTone?: IconTone;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

export function Tabs({
  items,
  value,
  onValueChange,
  variant = 'underline',
  className,
}: TabsProps) {
  return (
    <div
      role="tablist"
      className={cx(styles.tabs, styles[variant], className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx(styles.tab, active && styles.active)}
            onClick={() => onValueChange(item.value)}
          >
            {item.icon && (
              <Icon name={item.icon} size={16} tone={item.iconTone} />
            )}
            <span>{item.label}</span>
            {item.count != null && (
              <span className={styles.count}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
