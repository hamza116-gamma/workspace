'use client';

import { useMemo, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useFocusMessage } from '@/hooks/useFocusMessage';
import { useChannels } from '@/hooks/useChannels';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import { useSaved } from '@/hooks/useSaved';
import { useActivitySummary } from '@/hooks/useActivitySummary';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import type { NotificationItem } from '@/types/notification';
import { ActivityKpis } from './ActivityKpis';
import { ActivityFeedItem } from './ActivityFeedItem';
import { WhoIsAround } from './WhoIsAround';
import { FILTERS, applyFilter, type ActivityFilter } from './activityFilters';
import styles from './Activity.module.css';

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

// "Mentions & activity" page (design: #view-activity): KPI row, Recent feed
// with filters, and who's around.
export const NotificationsView = () => {
  const { items, unreadCount, mentionCount, loading, markRead, markAllRead, remove } =
    useNotifications();
  const { focusMessage } = useFocusMessage();
  const { channels } = useChannels();
  const { user } = useAuth();
  const { active } = useOrg();
  const saved = useSaved();
  const summary = useActivitySummary();
  const members = useOrgMembers();
  const [filter, setFilter] = useState<ActivityFilter>('ALL');

  const visible = useMemo(() => applyFilter(items, filter), [items, filter]);
  const oldestMentionAt = useMemo(() => {
    const unreadMentions = items.filter((item) => item.type === 'MENTION' && !item.readAt);
    return unreadMentions.length ? unreadMentions[unreadMentions.length - 1].createdAt : null;
  }, [items]);
  const visibleUnread = visible.filter((item) => !item.readAt).length;

  const channelName = (id: string | null) =>
    id ? `#${channels.find((channel) => channel.id === id)?.name ?? 'channel'}` : '';

  const action = (item: NotificationItem) => {
    const channel = channelName(item.channelId);
    switch (item.type) {
      case 'MENTION':
        return channel ? <>mentioned you in <b>{channel}</b></> : 'mentioned you';
      case 'DM':
        return 'sent you a message';
      case 'THREAD_REPLY':
        return 'replied to a thread you follow';
      default:
        return channel ? <>posted in <b>{channel}</b></> : 'posted a message';
    }
  };

  const where = (item: NotificationItem) =>
    item.type === 'MENTION' ? '' : item.channelId ? channelName(item.channelId) : 'Direct message';

  const href = (item: NotificationItem) =>
    item.channelId
      ? `/channels/${item.channelId}?message=${item.messageId}`
      : `/dm/${item.conversationId}?message=${item.messageId}`;

  const actions = (
    <>
      {FILTERS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={styles.chip}
          aria-pressed={filter === option.id}
          onClick={() => setFilter(option.id)}
        >
          {option.label}
        </button>
      ))}
      <Button
        variant="secondary"
        size="sm"
        disabled={unreadCount === 0}
        onClick={() => void markAllRead()}
      >
        Mark all read
      </Button>
    </>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Activity"
        title="Catch up"
        sub={
          <>
            Mentions, thread replies and reactions across <b>{active?.name ?? 'your workspace'}</b>.{' '}
            {unreadCount > 0
              ? `${unreadCount} unread since you were last here.`
              : 'You are all caught up.'}
          </>
        }
        actions={actions}
      />

      <ActivityKpis
        mentionCount={mentionCount}
        oldestMentionAt={oldestMentionAt}
        savedCount={saved.items.length}
        savedToday={saved.items.filter((entry) => isToday(entry.createdAt)).length}
        summary={summary}
      />

      <div className={styles.g21}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Recent</h3>
            <div className={styles.spacer} />
            {visibleUnread > 0 && <Pill tone="info">{visibleUnread} unread</Pill>}
          </div>

          {loading && items.length === 0 &&
            [0, 1, 2].map((key) => (
              <div key={key} className={styles.skelRow} aria-hidden>
                <span className={styles.skelIc} />
                <div className={styles.skelLines}>
                  <span className={styles.skel} style={{ width: '55%' }} />
                  <span className={styles.skel} style={{ width: '85%' }} />
                </div>
              </div>
            ))}

          {!loading && visible.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyIc} aria-hidden>
                <Icon name="check" size={20} />
              </span>
              <p className={styles.emptyTitle}>All caught up</p>
              <p className={styles.hint}>
                {filter === 'ALL'
                  ? 'No activity yet. Mentions, DMs and thread replies appear here.'
                  : 'Nothing here for this filter.'}
              </p>
            </div>
          )}

          {visible.map((item) => (
            <ActivityFeedItem
              key={item.id}
              item={item}
              href={href(item)}
              action={action(item)}
              where={where(item)}
              onOpen={() => {
                void markRead(item.id);
                focusMessage(item.messageId);
              }}
              onRemove={() => void remove(item.id)}
            />
          ))}
        </section>

        <WhoIsAround members={members} selfId={user?.id} />
      </div>
    </div>
  );
};
