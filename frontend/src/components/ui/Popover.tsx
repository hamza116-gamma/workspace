'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Popover.module.css';

const GAP = 8;
const PAD = 8;

export const Popover = ({
  open,
  anchorRef,
  align = 'left',
  placement = 'bottom',
  panelClassName,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: 'left' | 'right';
  placement?: 'bottom' | 'right';
  panelClassName?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = panelRef.current?.offsetWidth || 220;
    const height = panelRef.current?.offsetHeight || 120;

    let top: number;
    let left: number;

    if (placement === 'right') {
      // Vertically beside the anchor (clamped), horizontally to its right.
      top = rect.top;
      left = rect.right + GAP;
      if (left + width > window.innerWidth - PAD) {
        left = Math.max(PAD, rect.left - GAP - width);
      }
      if (top + height > window.innerHeight - PAD) {
        top = Math.max(PAD, window.innerHeight - PAD - height);
      }
      left = Math.min(left, window.innerWidth - width - PAD);
    } else {
      top = rect.bottom + GAP;
      if (top + height > window.innerHeight - PAD) {
        top = Math.max(PAD, rect.top - GAP - height);
      }
      const preferred = align === 'right' ? rect.right - width : rect.left;
      left = Math.min(Math.max(PAD, preferred), window.innerWidth - width - PAD);
    }

    setCoords({ top, left });
  }, [open, align, placement, anchorRef]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      className={[styles.panel, panelClassName].filter(Boolean).join(' ')}
      style={{
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        visibility: coords ? 'visible' : 'hidden',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  );
};
