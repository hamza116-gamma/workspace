'use client';

import { useEffect, useRef, useState } from 'react';
import type { Organization } from '@/types/organization';
import { WorkspaceButton } from './WorkspaceButton';
import { WorkspaceHoverCard } from './WorkspaceHoverCard';
import styles from './WorkspaceStack.module.css';

const CLOSE_DELAY_MS = 250;

/** Active workspace tile with the others stacked behind it like a deck. */
export const WorkspaceStack = ({
  organizations,
  active,
  totals,
  onSelect,
  onCreate,
}: {
  organizations: Organization[];
  active: Organization | null;
  totals: { unread: number; mentions: number };
  onSelect: (organizationId: string) => void;
  onCreate: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover-intent: give the pointer time to cross the gap to the card.
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openNow = () => {
    cancelClose();
    setOpen(true);
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => cancelClose, []);
  const current = active ?? organizations[0];
  const others = organizations.length - 1;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!current) {
    return null;
  }

  const pick = (organizationId: string) => {
    setOpen(false);
    onSelect(organizationId);
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.stack} ${open ? styles.open : ''}`}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      {others >= 2 && <span className={`${styles.layer} ${styles.layer2}`} aria-hidden />}
      {others >= 1 && <span className={`${styles.layer} ${styles.layer1}`} aria-hidden />}
      <WorkspaceButton
        organization={current}
        active
        badge={totals}
        expanded={open}
        onSelect={() => setOpen((value) => !value)}
      />
      {others > 2 && (
        <span className={styles.count} aria-hidden>
          +{others}
        </span>
      )}
      {open && (
        <WorkspaceHoverCard
          organizations={organizations}
          activeId={current.id}
          mentions={totals.mentions}
          onSelect={pick}
          onCreate={() => {
            setOpen(false);
            onCreate();
          }}
        />
      )}
    </div>
  );
};
