'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { OPEN_QUICK_SEARCH } from '@/components/search/QuickSearch';
import { useMyOpenTaskCount } from '@/hooks/useMyOpenTaskCount';
import { useProjectsEnabled } from '@/hooks/useProjectsEnabled';
import { useProjects } from '@/hooks/useProjects';
import { useDrafts } from '@/hooks/useDrafts';
import { useOnlineCount } from '@/hooks/useOnlineCount';
import { useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { useChannels } from '@/hooks/useChannels';
import { useConversations } from '@/hooks/useConversations';
import { useNotifications } from '@/hooks/useNotifications';
import { useOrg } from '@/hooks/useOrg';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Popover } from '@/components/ui/Popover';
import { ActivityDropdown } from '@/components/notifications/ActivityDropdown';
import { ChannelListItem } from '@/components/channels/ChannelListItem';
import { CreateChannelDialog } from '@/components/channels/CreateChannelDialog';
import { DirectMessageListItem } from './DirectMessageListItem';
import styles from './ChannelPanel.module.css';

const QUICK_LINKS: { label: string; icon: IconName; href?: string }[] = [
  { label: 'Activity', icon: 'bell', href: '/activity' },
  { label: 'Drafts', icon: 'pencil', href: '/drafts' },
  { label: 'Bookmarks', icon: 'bookmark', href: '/saved' },
  { label: 'My tasks', icon: 'task', href: '/tasks' },
];

// Slack behavior: hovering "Activity" opens the recent-activity dropdown to
// the right; the badge counts only unread MENTIONS.
const ActivityNavItem = ({ label, icon }: { label: string; icon: IconName }) => {
  const { mentionCount } = useNotifications();
  const anchorRef = useRef<HTMLAnchorElement>(null);
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

  return (
    <>
      <Link
        ref={anchorRef}
        href="/activity"
        className={`${styles.quickItem} ${styles.quickLink}`}
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
        onFocus={openNow}
        onBlur={scheduleClose}
      >
        <Icon name={icon} size={15} />
        <span>{label}</span>
        {mentionCount > 0 && <span className={styles.quickBadge}>{mentionCount}</span>}
      </Link>
      <Popover
        open={open}
        anchorRef={anchorRef}
        placement="right"
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
      >
        <ActivityDropdown onNavigate={() => setOpen(false)} />
      </Popover>
    </>
  );
};

export const ChannelPanel = () => {
  const { active } = useOrg();
  const { user } = useAuth();
  const presence = usePresence();
  const { channels, loading, error } = useChannels();
  const { conversations, loading: dmLoading, error: dmError } = useConversations();
  const params = useParams<{ channelId?: string; conversationId?: string }>();
  const { pendingDrafts } = useDrafts();
  const openTasks = useMyOpenTaskCount();
  const projectsEnabled = useProjectsEnabled();
  const { projects } = useProjects();
  const online = useOnlineCount();
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);

  // Sidebar shows joined channels only (Slack); starred ones get their own
  // section at the top. Others are found via "Browse channels".
  const { starred, joined } = useMemo(() => {
    const mine = channels.filter((channel) => channel.isMember);
    return {
      starred: mine.filter((channel) => channel.membership?.starred),
      joined: mine.filter((channel) => !channel.membership?.starred),
    };
  }, [channels]);
  const joinedCount = useMemo(
    () => channels.filter((channel) => channel.isMember).length,
    [channels],
  );

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.workspace}>{active?.name ?? 'Workspace'}</h1>
          {online !== null && (
            <div className={styles.statusLine}>
              <i className={styles.onlineDot} aria-hidden />
              {online} {online === 1 ? 'member' : 'members'} online
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          <Link
            href="/settings"
            className={styles.addChannel}
            aria-label="Workspace settings"
            title="Workspace settings"
          >
            <Icon name="settings" size={16} />
          </Link>
          <Link
            href="/dm/new"
            className={styles.addChannel}
            aria-label="New message"
            title="New message"
          >
            <Icon name="plus" size={16} />
          </Link>
        </div>
      </header>

      {/* Opens the Ctrl+K quick search (components/search/QuickSearch). */}
      <button
        type="button"
        className={styles.search}
        data-tour="search"
        onClick={() => window.dispatchEvent(new Event(OPEN_QUICK_SEARCH))}
        aria-label="Search (Ctrl+K)"
      >
        <Icon name="search" size={15} />
        <span className={styles.searchLabel}>Search…</span>
        <kbd className={styles.searchKbd}>Ctrl K</kbd>
      </button>

      <nav className={styles.quick}>
        {QUICK_LINKS.map((link) =>
          link.href === '/activity' ? (
            <ActivityNavItem key={link.label} label={link.label} icon={link.icon} />
          ) : link.href ? (
            <Link
              key={link.label}
              href={link.href}
              className={`${styles.quickItem} ${styles.quickLink}`}
              data-tour={link.href === '/tasks' ? 'tasks' : undefined}
            >
              <Icon name={link.icon} size={15} />
              <span>{link.label}</span>
              {link.href === '/drafts' && pendingDrafts.length > 0 && (
                <span className={styles.quickBadge}>{pendingDrafts.length}</span>
              )}
              {link.href === '/tasks' && openTasks > 0 && (
                <span
                  className={styles.quickBadge}
                  title={`${openTasks} open tasks assigned to you`}
                >
                  {openTasks}
                </span>
              )}
            </Link>
          ) : (
            <button key={link.label} type="button" className={styles.quickItem} disabled>
              <Icon name={link.icon} size={15} />
              <span>{link.label}</span>
            </button>
          ),
        )}
      </nav>

      <div className={styles.scroll}>
        {projectsEnabled && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>
                <Icon name="task" size={14} />
                <span>Projects</span>
              </span>
              <Link href="/projects" className={styles.sectionLink}>
                All
              </Link>
            </div>
            <div className={styles.list}>
              <Link
                href="/projects/TASK"
                className={`${styles.quickItem} ${styles.quickLink}`}
              >
                <span className={styles.projectKey}>TASK</span>
                <span>Unassigned</span>
              </Link>
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.key}`}
                  className={`${styles.quickItem} ${styles.quickLink}`}
                >
                  <span className={styles.projectKey}>{project.key}</span>
                  <span>{project.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        {starred.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>
                <Icon name="star" size={14} />
                <span>Starred</span>
              </span>
            </div>
            <div className={styles.list}>
              {starred.map((channel) => (
                <ChannelListItem
                  key={channel.id}
                  channel={channel}
                  active={channel.id === params?.channelId}
                />
              ))}
            </div>
          </div>
        )}

        <div className={styles.section} data-tour="channels">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>
              <Icon name="hash" size={14} />
              <span>Channels</span>
            </span>
            <button
              type="button"
              className={styles.sectionAdd}
              onClick={() => setChannelDialogOpen(true)}
              aria-label="Create a channel"
              title="Create a channel"
            >
              <Icon name="plus" size={15} />
            </button>
          </div>
          {loading && (
            <div className={styles.center}>
              <Spinner />
            </div>
          )}
          {!loading && error && <Alert>{error}</Alert>}
          {!loading && !error && joinedCount === 0 && (
            <p className={styles.empty}>You haven’t joined any channels yet.</p>
          )}
          <div className={styles.list}>
            {joined.map((channel) => (
              <ChannelListItem
                key={channel.id}
                channel={channel}
                active={channel.id === params?.channelId}
              />
            ))}
            <Link href="/channels" className={styles.browse}>
              <Icon name="compass" size={14} />
              <span>Browse channels</span>
            </Link>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>
              <Icon name="users" size={14} />
              <span>Team Messages</span>
            </span>
            <Link
              href="/dm/new"
              className={styles.sectionAdd}
              aria-label="New message"
              title="New message"
            >
              <Icon name="plus" size={15} />
            </Link>
          </div>
          {dmLoading && (
            <div className={styles.center}>
              <Spinner />
            </div>
          )}
          {!dmLoading && dmError && <Alert>{dmError}</Alert>}
          {!dmLoading && !dmError && conversations.length === 0 && (
            <p className={styles.empty}>No direct messages yet.</p>
          )}
          <div className={styles.list}>
            {conversations.map((conversation) => (
              <DirectMessageListItem
                key={conversation.id}
                conversation={conversation}
                currentUserId={user?.id}
                presence={presence}
                active={conversation.id === params?.conversationId}
              />
            ))}
          </div>
        </div>
      </div>

      <CreateChannelDialog open={channelDialogOpen} onClose={() => setChannelDialogOpen(false)} />
    </aside>
  );
};
