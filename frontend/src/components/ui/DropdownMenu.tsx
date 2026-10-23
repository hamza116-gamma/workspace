'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import styles from './DropdownMenu.module.css';

export type MenuItem =
  | { separator: true }
  | {
      separator?: false;
      label: string;
      icon?: IconName;
      onSelect?: () => void;
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
      heading?: boolean;
    };

const MENU_MARGIN = 6;
const VIEWPORT_PAD = 8;
const DEFAULT_MENU_WIDTH = 224;

export const DropdownMenu = ({
  items,
  label = 'More options',
  align = 'right',
  icon = 'kebab',
  triggerClassName,
  triggerContent,
}: {
  items: MenuItem[];
  label?: string;
  align?: 'left' | 'right';
  /** Trigger icon (default: kebab). */
  icon?: IconName;
  /** Replaces the default trigger styles. */
  triggerClassName?: string;
  /** Extra content inside the trigger (e.g. a status dot). */
  triggerContent?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const trigger = wrapperRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth || DEFAULT_MENU_WIDTH;
    const menuHeight = menuRef.current?.offsetHeight || 220;

    let top = rect.bottom + MENU_MARGIN;
    if (top + menuHeight > window.innerHeight - VIEWPORT_PAD) {
      top = Math.max(VIEWPORT_PAD, rect.top - MENU_MARGIN - menuHeight);
    }

    const preferred = align === 'right' ? rect.right - menuWidth : rect.left;
    const left = Math.min(
      Math.max(VIEWPORT_PAD, preferred),
      window.innerWidth - menuWidth - VIEWPORT_PAD,
    );

    setCoords({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (open) {
      place();
    } else {
      setCoords(null);
    }
  }, [open, place]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    const reposition = () => place();

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, place]);

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className={styles.menu}
            role="menu"
            style={{
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              visibility: coords ? 'visible' : 'hidden',
            }}
          >
            {items.map((item, index) =>
              item.separator ? (
                <div key={`sep-${index}`} className={styles.separator} role="separator" />
              ) : item.heading ? (
                <div key={item.label} className={styles.heading}>
                  {item.label}
                </div>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect?.();
                  }}
                >
                  <span className={styles.icon}>
                    {item.checked ? (
                      <Icon name="check" size={15} />
                    ) : item.icon ? (
                      <Icon name={item.icon} size={15} />
                    ) : null}
                  </span>
                  <span className={styles.label}>{item.label}</span>
                </button>
              ),
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={styles.wrap} ref={wrapperRef}>
      <button
        type="button"
        className={triggerClassName ?? styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={icon} size={18} />
        {triggerContent}
      </button>
      {menu}
    </div>
  );
};
