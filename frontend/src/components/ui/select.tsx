'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import { Icon } from './icon';
import { Field } from './field';
import styles from './select.module.css';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/** Minimal change event exposing `target.value`, mirroring the native shape so
 *  existing `(e) => setX(e.target.value)` handlers keep working unchanged. */
export interface SelectChangeEvent {
  target: { value: string };
}

export interface SelectProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  selectSize?: 'sm' | 'md' | 'lg';
  options: SelectOption[];
  placeholder?: string;
  value: string;
  onChange?: (event: SelectChangeEvent) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  containerClassName?: string;
}

const GAP = 6;
const PANEL_MAX_HEIGHT = 320;

/**
 * Design-system dropdown: a custom listbox replacing the native `<select>`
 * popup (which is OS-styled and clashes with the app). The panel renders in a
 * fixed-position portal on `document.body` so it can't be clipped by modals or
 * scroll containers, and flips above the trigger when there's no room below.
 */
export function Select({
  label,
  hint,
  error,
  selectSize = 'md',
  options,
  placeholder,
  value,
  onChange,
  disabled,
  required,
  id,
  className,
  containerClassName,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = `${selectId}-desc`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coords, setCoords] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  function computeCoords() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const estHeight = Math.min(PANEL_MAX_HEIGHT, options.length * 38 + 10);
    const openUp = r.bottom + estHeight + GAP > vh && r.top - estHeight - GAP > 8;
    const next: CSSProperties = {
      position: 'fixed',
      left: r.left,
      minWidth: r.width,
    };
    if (openUp) next.bottom = vh - r.top + GAP;
    else next.top = r.bottom + GAP;
    setCoords(next);
  }

  function openPanel() {
    if (disabled) return;
    computeCoords();
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function selectOption(option: SelectOption) {
    if (option.disabled) return;
    setOpen(false);
    if (option.value !== value) onChange?.({ target: { value: option.value } });
  }

  /** Next enabled option index from `start`, stepping by `dir` (wraps). */
  function step(start: number, dir: 1 | -1): number {
    if (options.length === 0) return -1;
    let i = start;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) return i;
    }
    return start;
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        openPanel();
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => step(i, 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => step(i, -1));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(step(-1, 1));
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(step(0, -1));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (options[activeIndex]) selectOption(options[activeIndex]);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default: {
        // First-letter type-ahead: jump to the next option starting with the key.
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const q = event.key.toLowerCase();
          const from = activeIndex >= 0 ? activeIndex : -1;
          for (let n = 1; n <= options.length; n++) {
            const i = (from + n) % options.length;
            if (
              !options[i].disabled &&
              options[i].label.toLowerCase().startsWith(q)
            ) {
              setActiveIndex(i);
              break;
            }
          }
        }
      }
    }
  }

  // Close on outside click / keep pinned to the trigger while scrolling.
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
    const reposition = () => computeCoords();
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the keyboard-active option in view.
  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const panel = (
    <div
      ref={panelRef}
      id={`${selectId}-listbox`}
      role="listbox"
      aria-labelledby={selectId}
      className={styles.panel}
      style={coords ?? undefined}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={index === activeIndex ? activeRef : undefined}
          type="button"
          role="option"
          aria-selected={option.value === value}
          disabled={option.disabled}
          className={cx(
            styles.option,
            index === activeIndex && styles.optionActive,
            option.value === value && styles.optionSelected,
          )}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => selectOption(option)}
        >
          <span className={styles.optionLabel}>{option.label}</span>
          {option.value === value && (
            <Icon name="check" size={16} className={styles.optionCheck} />
          )}
        </button>
      ))}
    </div>
  );

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
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? `${selectId}-listbox` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? descriptionId : undefined}
          disabled={disabled}
          className={cx(styles.trigger, className)}
          onClick={() => (open ? setOpen(false) : openPanel())}
          onKeyDown={onTriggerKeyDown}
        >
          <span
            className={cx(
              styles.triggerLabel,
              !selected && styles.triggerPlaceholder,
            )}
          >
            {selected?.label ?? placeholder ?? ''}
          </span>
        </button>
        <Icon name="chevronDown" size={18} className={styles.chevron} />
      </div>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(panel, document.body)}
    </Field>
  );
}
