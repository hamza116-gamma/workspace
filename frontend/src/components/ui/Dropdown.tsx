'use client';

import { useEffect, useRef, useState } from 'react';
import { Popover } from './Popover';
import styles from './Dropdown.module.css';

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  // Optional colour dot shown before the label (status / priority).
  color?: string;
};

type BaseProps<T extends string> = {
  options: DropdownOption<T>[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'md' | 'sm';
  ariaLabel?: string;
};

type SingleProps<T extends string> = BaseProps<T> & {
  multiple?: false;
  value: T;
  onChange: (value: T) => void;
};

type MultiProps<T extends string> = BaseProps<T> & {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
};

/** Custom select: single choice, or multiple with checkmarks. */
export const Dropdown = <T extends string>(props: SingleProps<T> | MultiProps<T>) => {
  const { options, label, placeholder = 'Select…', disabled, size = 'md', ariaLabel } = props;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = props.multiple ? props.value : [props.value];
  const isSelected = (value: T) => selected.includes(value);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Close the dropdown only, not a surrounding modal.
        event.stopPropagation();
        setOpen(false);
        anchorRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const choose = (value: T) => {
    if (props.multiple) {
      props.onChange(
        isSelected(value) ? props.value.filter((item) => item !== value) : [...props.value, value],
      );
      return;
    }
    props.onChange(value);
    setOpen(false);
  };

  const chosen = options.filter((option) => isSelected(option.value));
  const summary = chosen.length ? chosen.map((option) => option.label).join(', ') : placeholder;
  const dot = !props.multiple ? chosen[0]?.color : undefined;

  return (
    <div className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      <button
        ref={anchorRef}
        type="button"
        className={`${styles.trigger} ${size === 'sm' ? styles.sm : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        onClick={() => setOpen((value) => !value)}
      >
        {dot && <span className={styles.dot} style={{ background: dot }} />}
        <span className={chosen.length ? styles.value : styles.placeholder}>{summary}</span>
        {!disabled && <span className={styles.caret} aria-hidden />}
      </button>
      <Popover open={open} anchorRef={anchorRef} align="left" panelClassName={styles.popover}>
        <div
          ref={panelRef}
          className={styles.panel}
          role="listbox"
          aria-multiselectable={props.multiple || undefined}
        >
          {options.length === 0 && <div className={styles.empty}>No options</div>}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={isSelected(option.value)}
              className={`${styles.option} ${isSelected(option.value) ? styles.active : ''}`}
              onClick={() => choose(option.value)}
            >
              {option.color && <span className={styles.dot} style={{ background: option.color }} />}
              <span className={styles.optionLabel}>{option.label}</span>
              {isSelected(option.value) && <span className={styles.check}>✓</span>}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
};
