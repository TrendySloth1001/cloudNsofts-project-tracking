'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
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
  /**
   * Render the panel in a fixed-position portal on `document.body` so it can't
   * be clipped by a scrolling/overflow ancestor (e.g. a board column). It also
   * flips above the trigger when there isn't room below.
   */
  portal?: boolean;
  className?: string;
}

function isSeparator(entry: MenuEntry): entry is { separator: true } {
  return 'separator' in entry;
}

const GAP = 6;

export function Menu({
  trigger,
  items,
  align = 'start',
  side = 'bottom',
  portal = false,
  className,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function computeCoords() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const estHeight = Math.min(320, items.length * 40 + 12);
    const openUp = r.bottom + estHeight > vh && r.top - estHeight > 8;
    const next: CSSProperties = {
      position: 'fixed',
      top: 'auto',
      left: 'auto',
      right: 'auto',
      bottom: 'auto',
    };
    if (align === 'end') next.right = Math.max(8, vw - r.right);
    else next.left = Math.max(8, r.left);
    if (openUp) next.bottom = vh - r.top + GAP;
    else next.top = r.bottom + GAP;
    setCoords(next);
  }

  function toggle() {
    setOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen && portal) computeCoords();
      return nextOpen;
    });
  }

  // Close on outside click / Escape. The portal panel lives outside rootRef, so
  // it's checked explicitly to keep item clicks from being treated as outside.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
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

  // Keep a portal panel pinned to the trigger while scrolling/resizing.
  useEffect(() => {
    if (!open || !portal) return;
    const reposition = () => computeCoords();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portal]);

  const panel = (
    <div
      ref={panelRef}
      role="menu"
      className={cx(
        styles.panel,
        !portal && align === 'end' && styles.alignEnd,
        !portal && side === 'top' && styles.sideTop,
      )}
      style={portal ? (coords ?? undefined) : undefined}
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
  );

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      <div
        ref={triggerRef}
        className={styles.trigger}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </div>
      {open &&
        (portal
          ? typeof document !== 'undefined' &&
            createPortal(panel, document.body)
          : panel)}
    </div>
  );
}
