'use client';

import { useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu';
import { Popover } from '@/components/ui/Popover';
import styles from './ConversationHeader.module.css';

export type ConversationTab = {
  label: string;
  icon?: IconName;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  // When set, hovering the tab shows this content in a dropdown (Slack-style).
  preview?: React.ReactNode;
  previewClassName?: string;
};

const Tab = ({ tab }: { tab: ConversationTab }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openNow = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
    setOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const button = (
    <button
      ref={ref}
      type="button"
      className={`${styles.tab} ${tab.active ? styles.tabActive : ''}`}
      disabled={tab.disabled}
      onClick={tab.onClick}
      onMouseEnter={tab.preview ? openNow : undefined}
      onMouseLeave={tab.preview ? scheduleClose : undefined}
      onFocus={tab.preview ? openNow : undefined}
      onBlur={tab.preview ? scheduleClose : undefined}
    >
      {tab.icon && <Icon name={tab.icon} size={15} />}
      {tab.label}
      {tab.count !== undefined && tab.count > 0 && (
        <span className={styles.count}>{tab.count}</span>
      )}
    </button>
  );

  if (!tab.preview) {
    return button;
  }

  return (
    <>
      {button}
      <Popover
        open={open}
        anchorRef={ref}
        panelClassName={tab.previewClassName}
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
      >
        {tab.preview}
      </Popover>
    </>
  );
};

export const ConversationHeader = ({
  name,
  icon,
  meta,
  leading,
  starred = false,
  onToggleStar,
  tabs,
  menuItems,
  onTitleClick,
  facepile,
  actions,
}: {
  name: string;
  icon: IconName;
  meta?: string;
  leading?: React.ReactNode;
  starred?: boolean;
  onToggleStar?: () => void;
  tabs: ConversationTab[];
  menuItems: MenuItem[];
  onTitleClick?: () => void;
  facepile?: React.ReactNode;
  // e.g. the huddle button, shown next to the facepile.
  actions?: React.ReactNode;
}) => (
  <header className={styles.header}>
    <div className={styles.titleRow}>
      {leading}
      <div className={styles.titleBlock}>
        <button
          type="button"
          className={styles.titleButton}
          onClick={onTitleClick}
          disabled={!onTitleClick}
          aria-label={`${name} details`}
        >
          {!leading && (
            <span className={styles.typeIcon}>
              {icon === 'hash' ? '#' : <Icon name={icon} size={14} />}
            </span>
          )}
          <h1 className={styles.name}>{name}</h1>
          {onTitleClick && <Icon name="chevron-down" size={14} className={styles.chevron} />}
        </button>
        {meta && <span className={styles.meta}>{meta}</span>}
      </div>
      <div className={styles.spacer} />
      {facepile}
      {actions}
      {onToggleStar && (
        <button
          type="button"
          className={`${styles.star} ${starred ? styles.starred : ''}`}
          onClick={onToggleStar}
          aria-pressed={starred}
          aria-label={starred ? 'Remove from favorites' : 'Add to favorites'}
          title={starred ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Icon name="star" size={16} filled={starred} />
        </button>
      )}
      <DropdownMenu items={menuItems} />
    </div>

    <nav className={styles.tabs} aria-label="Conversation views">
      {tabs.map((tab) => (
        <Tab key={tab.label} tab={tab} />
      ))}
    </nav>
  </header>
);
