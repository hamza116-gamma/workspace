'use client';

import { useEffect, useRef, useState } from 'react';
import { Popover } from '@/components/ui/Popover';
import type { User } from '@/types/user';
import { ProfileCard } from './ProfileCard';
import styles from './UserProfileTrigger.module.css';

/**
 * Wraps an avatar or name: click opens the profile card (Slack). Closes on
 * outside click, Esc, or after navigating ("Message").
 */
export const UserProfileTrigger = ({
  user,
  children,
  className,
}: {
  user: User;
  children: React.ReactNode;
  className?: string;
}) => {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !anchorRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={[styles.trigger, className].filter(Boolean).join(' ')}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`View profile of ${user.fullName}`}
      >
        {children}
      </button>
      <Popover open={open} anchorRef={anchorRef} placement="right">
        <div ref={panelRef} role="dialog" aria-label={`${user.fullName} profile`}>
          <ProfileCard user={user} onNavigate={() => setOpen(false)} />
        </div>
      </Popover>
    </>
  );
};
