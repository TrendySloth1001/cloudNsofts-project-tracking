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
import type { SelectOption } from './select';
import selectStyles from './select.module.css';
import styles from './multi-select.module.css';

export interface MultiSelectProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  selectSize?: 'sm' | 'md' | 'lg';
  options: SelectOption[];
  /** Shown when nothing is selected (e.g. "Unassigned"). */
  placeholder?: string;
  values: string[];
  onValuesChange: (values: string[]) => void;
  disabled?: boolean;
  id?: string;
  containerClassName?: string;
}

const GAP = 6;
const PANEL_MAX_HEIGHT = 320;

/**
 * Multi-value companion to `Select`: same trigger + portal-panel mechanics,
 * but options toggle in and out of `values` and the panel stays open so
 * several can be picked in one visit.
 */
export function MultiSelect({
  label,
  hint,
  error,
  selectSize = 'md',
  options,
  placeholder = 'None',
  values,
  onValuesChange,
  disabled,
  id,
  containerClassName,
}: MultiSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = `${selectId}-desc`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coords, setCoords] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const selected = options.filter((o) => values.includes(o.value));
  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map((o) => o.label).join(', ')
        : `${selected[0].label} +${selected.length - 1}`;

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
    setActiveIndex(0);
    setOpen(true);
  }

  function toggleValue(option: SelectOption) {
    if (option.disabled) return;
    onValuesChange(
      values.includes(option.value)
        ? values.filter((v) => v !== option.value)
        : [...values, option.value],
    );
  }

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
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (options[activeIndex]) toggleValue(options[activeIndex]);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
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

  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const panel = (
    <div
      ref={panelRef}
      id={`${selectId}-listbox`}
      role="listbox"
      aria-multiselectable="true"
      aria-labelledby={selectId}
      className={selectStyles.panel}
      style={coords ?? undefined}
    >
      {options.map((option, index) => {
        const isSelected = values.includes(option.value);
        return (
          <button
            key={option.value}
            ref={index === activeIndex ? activeRef : undefined}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={option.disabled}
            className={cx(
              selectStyles.option,
              index === activeIndex && selectStyles.optionActive,
              isSelected && selectStyles.optionSelected,
            )}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => toggleValue(option)}
          >
            <span
              className={cx(styles.tick, isSelected && styles.tickChecked)}
              aria-hidden="true"
            >
              {isSelected && <Icon name="check" size={12} />}
            </span>
            <span className={selectStyles.optionLabel}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={selectId}
      descriptionId={descriptionId}
      className={containerClassName}
    >
      <div
        className={cx(
          selectStyles.wrapper,
          selectStyles[selectSize],
          !!error && selectStyles.hasError,
          disabled && selectStyles.disabled,
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
          className={selectStyles.trigger}
          onClick={() => (open ? setOpen(false) : openPanel())}
          onKeyDown={onTriggerKeyDown}
        >
          <span
            className={cx(
              selectStyles.triggerLabel,
              selected.length === 0 && selectStyles.triggerPlaceholder,
            )}
          >
            {triggerLabel}
          </span>
        </button>
        <Icon name="chevronDown" size={18} className={selectStyles.chevron} />
      </div>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(panel, document.body)}
    </Field>
  );
}
