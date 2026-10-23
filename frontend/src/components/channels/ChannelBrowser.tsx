'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChannels } from '@/hooks/useChannels';
import { useOrg } from '@/hooks/useOrg';
import { useArchivedChannels } from '@/hooks/useArchivedChannels';
import { joinChannel, unarchiveChannel } from '@/lib/channels';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import type { Channel } from '@/types/channel';
import { CreateChannelDialog } from './CreateChannelDialog';
import { ChannelBrowserRow } from './ChannelBrowserRow';
import styles from './ChannelBrowser.module.css';

type Filter = 'all' | 'joined' | 'notJoined' | 'archived';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'joined', label: 'Joined' },
  { id: 'notJoined', label: 'Not joined' },
  { id: 'archived', label: 'Archived' },
];

const matches = (channel: Channel, term: string) =>
  !term ||
  channel.name.includes(term) ||
  channel.topic.toLowerCase().includes(term) ||
  channel.purpose.toLowerCase().includes(term);

/** /channels: browse, search, join, create and unarchive channels. */
export const ChannelBrowser = () => {
  const router = useRouter();
  const { active } = useOrg();
  const { channels, loading, error, refresh } = useChannels();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const archived = useArchivedChannels(filter === 'archived');

  const isOrgAdmin = active?.role === 'OWNER' || active?.role === 'ADMIN';

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/^#/, '');
    const source = filter === 'archived' ? archived.channels : channels;
    return source.filter((channel) => {
      if (filter === 'joined' && !channel.isMember) return false;
      if (filter === 'notJoined' && channel.isMember) return false;
      return matches(channel, term);
    });
  }, [channels, archived.channels, filter, query]);

  const act = async (channel: Channel, action: () => Promise<unknown>, open: boolean) => {
    setBusyId(channel.id);
    setActionError('');
    try {
      await action();
      await refresh({ silent: true });
      if (filter === 'archived') await archived.reload();
      if (open) router.push(`/channels/${channel.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  };

  const isLoading = filter === 'archived' ? archived.loading : loading;
  const listError = filter === 'archived' ? archived.error : error;

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Channels</h1>
          <p className={styles.subtitle}>
            Browse the channels in {active?.name ?? 'this workspace'}, join the ones you need, or
            start a new one.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={15} /> Create channel
        </Button>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={15} />
          <input
            type="search"
            value={query}
            placeholder="Search by name or description"
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search channels"
          />
        </label>
        <div className={styles.filters} role="tablist" aria-label="Filter channels">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={`${styles.filter} ${filter === item.id ? styles.filterActive : ''}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {(actionError || listError) && <Alert>{actionError || listError}</Alert>}

      <div className={styles.card}>
        {isLoading && (
          <div className={styles.center}>
            <Spinner />
          </div>
        )}
        {!isLoading && shown.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <Icon name="hash" size={22} />
            </span>
            <p>{query ? `No channels match "${query}".` : 'No channels here yet.'}</p>
          </div>
        )}
        {!isLoading &&
          shown.map((channel) => (
            <ChannelBrowserRow
              key={channel.id}
              channel={channel}
              busy={busyId === channel.id}
              canUnarchive={isOrgAdmin || channel.membership?.role === 'MODERATOR'}
              onOpen={() => router.push(`/channels/${channel.id}`)}
              onJoin={() => void act(channel, () => joinChannel(channel.id), true)}
              onUnarchive={() => void act(channel, () => unarchiveChannel(channel.id), false)}
            />
          ))}
      </div>

      <CreateChannelDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </section>
  );
};
