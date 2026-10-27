'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Popover } from '@/components/ui/Popover';
import { useNotificationItems } from '@/components/notifications/NotificationsMenu';
import { OPEN_WELCOME_INTRO } from '@/components/onboarding/WelcomeIntro';
import { formatDndUntil } from '@/lib/dnd';
import { useAuth } from '@/hooks/useAuth';
import { useThemeToggle } from './RailThemeToggle';
import styles from './ProfileMenu.module.css';

const CLOSE_DELAY_MS = 220;

const Row = ({
  icon,
  label,
  hint,
  danger,
  onClick,
  chevron,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
  chevron?: boolean;
}) => (
  <button
    type="button"
    role="menuitem"
    className={`${styles.row} ${danger ? styles.danger : ''}`}
    onClick={onClick}
  >
    <Icon name={icon} size={16} />
    <span className={styles.rowLabel}>{label}</span>
    {hint && <span className={styles.hint}>{hint}</span>}
    {chevron && <Icon name="chevron-right" size={14} />}
  </button>
);

/**
 * Rail avatar menu (opens on hover, or tap on touch): profile, notifications
 * (pause / desktop / sound), dark mode, "How this app works" and log out.
 * Keeps the rail short on small screens.
 */
export const ProfileMenu = ({
  trigger,
  onLogout,
}: {
  trigger: React.ReactNode;
  onLogout: () => void;
}) => {
  const { user } = useAuth();
  const { dark, busy, toggle } = useThemeToggle();
  const { items, active, dndUntil } = useNotificationItems();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'main' | 'notifications'>('main');

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  const close = () => {
    clearTimeout(closeTimer.current);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      setView('main');
      return;
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!anchorRef.current?.contains(target) && !target.closest('[data-profile-menu]')) {
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your profile and settings"
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onClick={() => (open ? close() : show())}
      >
        {trigger}
      </button>

      <Popover
        open={open}
        anchorRef={anchorRef}
        placement="right"
        panelClassName={styles.panel}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
      >
        <div data-profile-menu role="menu" className={styles.menu}>
          {view === 'main' ? (
            <>
              <div className={styles.head}>
                <span className={styles.name}>{user?.fullName}</span>
                <span className={styles.email}>{user?.email}</span>
                {active && dndUntil && (
                  <span className={styles.paused}>
                    <Icon name="moon" size={12} /> Paused until {formatDndUntil(dndUntil)}
                  </span>
                )}
              </div>
              <Link href="/profile" role="menuitem" className={styles.row} onClick={close}>
                <Icon name="users" size={16} />
                <span className={styles.rowLabel}>Your profile</span>
              </Link>
              <Row
                icon={active ? 'bell-off' : 'bell'}
                label="Notifications"
                hint={active ? 'Paused' : undefined}
                chevron
                onClick={() => setView('notifications')}
              />
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={dark}
                className={styles.row}
                disabled={busy}
                onClick={() => void toggle()}
              >
                <Icon name={dark ? 'sun' : 'moon'} size={16} />
                <span className={styles.rowLabel}>Dark mode</span>
                <span className={`${styles.switch} ${dark ? styles.switchOn : ''}`} aria-hidden />
              </button>
              <Row
                icon="info"
                label="How this app works"
                onClick={() => {
                  close();
                  window.dispatchEvent(new Event(OPEN_WELCOME_INTRO));
                }}
              />
              <div className={styles.sep} />
              <Row
                icon="logout"
                label="Log out"
                danger
                onClick={() => {
                  close();
                  onLogout();
                }}
              />
            </>
          ) : (
            <>
              <button type="button" className={styles.back} onClick={() => setView('main')}>
                <span className={styles.backArrow}>
                  <Icon name="chevron-right" size={14} />
                </span>
                Notifications
              </button>
              {items.map((item, index) =>
                item.separator ? (
                  <div key={`s-${index}`} className={styles.sep} />
                ) : item.heading ? (
                  <div key={item.label} className={styles.heading}>
                    {item.label}
                  </div>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                    aria-checked={item.checked}
                    className={styles.row}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onSelect?.();
                      if (item.checked === undefined) close();
                    }}
                  >
                    {item.icon && <Icon name={item.icon} size={16} />}
                    <span className={styles.rowLabel}>{item.label}</span>
                    {item.checked !== undefined && (
                      <span
                        className={`${styles.switch} ${item.checked ? styles.switchOn : ''}`}
                        aria-hidden
                      />
                    )}
                  </button>
                ),
              )}
            </>
          )}
        </div>
      </Popover>
    </>
  );
};
