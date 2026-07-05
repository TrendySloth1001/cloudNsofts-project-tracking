'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectMember } from '@cnsofts/shared';
import { Icon } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { cx } from '@/lib/cx';
import styles from './assignee-picker.module.css';

export interface AssigneePickerProps {
  members: ProjectMember[];
  /** Currently assigned member ids. */
  values: string[];
  /** Called with the full new id list on every toggle (saves immediately). */
  onChange: (ids: string[]) => void;
  label?: string;
}

const GAP = 6;
const PANEL_MAX_HEIGHT = 280;

/**
 * A compact "+" affordance that opens a member-toggle popover — the fastest
 * way to assign people without opening any dialog. Rendered inline next to a
 * card/row's avatar stack; the panel portals to `document.body` so it isn't
 * clipped by board columns.
 */
export function AssigneePicker({
  members,
  values,
  onChange,
  label = 'Assign members',
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function computeCoords() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const estHeight = Math.min(PANEL_MAX_HEIGHT, members.length * 36 + 10);
    const openUp = r.bottom + estHeight + GAP > vh && r.top - estHeight - GAP > 8;
    const next: CSSProperties = {
      position: 'fixed',
      left: Math.max(8, Math.min(r.left, window.innerWidth - 240)),
    };
    if (openUp) next.bottom = vh - r.top + GAP;
    else next.top = r.bottom + GAP;
    setCoords(next);
  }

  function toggleValue(memberId: string) {
    onChange(
      values.includes(memberId)
        ? values.filter((v) => v !== memberId)
        : [...values, memberId],
    );
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    const reposition = () => computeCoords();
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const panel = (
    <div
      ref={panelRef}
      role="listbox"
      aria-multiselectable="true"
      aria-label={label}
      className={styles.panel}
      style={coords ?? undefined}
    >
      {members.length === 0 ? (
        <span className={styles.emptyText}>No members in this project.</span>
      ) : (
        members.map((member) => {
          const isSelected = values.includes(member.id);
          return (
            <button
              key={member.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={styles.row}
              onClick={() => toggleValue(member.id)}
            >
              <UserAvatar name={member.name} seed={member.id} size={22} />
              <span className={styles.rowName}>{member.name}</span>
              <span
                className={cx(styles.tick, isSelected && styles.tickChecked)}
                aria-hidden="true"
              >
                {isSelected && <Icon name="check" size={12} />}
              </span>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            setOpen(false);
          } else {
            computeCoords();
            setOpen(true);
          }
        }}
      >
        <Icon name="add" size={13} />
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(panel, document.body)}
    </>
  );
}
