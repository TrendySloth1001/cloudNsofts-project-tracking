'use client';

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icon';
import styles from './menu.module.css';

export interface MenuItem {
  label: ReactNode;
  icon?: IconName;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Show a check on the right (for selectable items). */
  selected?: boolean;
}

export type MenuEntry = MenuItem | { separator: true };

export interface MenuProps {
  trigger: ReactNode;
  items: MenuEntry[];
  align?: 'start' | 'end';
  /** Which side of the trigger the panel opens on. Default 'bottom'. */
  side?: 'top' | 'bottom';
  className?: string;
}

function isSeparator(entry: MenuEntry): entry is { separator: true } {
  return 'separator' in entry;
}

export function Menu({
  trigger,
  items,
  align = 'start',
  side = 'bottom',
  className,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      <div
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </div>
      {open && (
        <div
          role="menu"
          className={cx(
            styles.panel,
            align === 'end' && styles.alignEnd,
            side === 'top' && styles.sideTop,
          )}
        >
          {items.map((entry, index) => {
            if (isSeparator(entry)) {
              return <div key={`sep-${index}`} className={styles.separator} />;
            }
            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                disabled={entry.disabled}
                className={cx(styles.item, entry.danger && styles.danger)}
                onClick={() => {
                  entry.onSelect?.();
                  setOpen(false);
                }}
              >
                {entry.icon && <Icon name={entry.icon} size={16} />}
                <span className={styles.itemLabel}>{entry.label}</span>
                {entry.selected && (
                  <Icon name="check" size={16} className={styles.itemCheck} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
