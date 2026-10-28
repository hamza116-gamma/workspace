'use client';

import { useState } from 'react';
import { Dropdown } from '@/components/ui/Dropdown';
import { useChannels } from '@/hooks/useChannels';
import { shareTask, unshareTask } from '@/lib/tasks';
import type { Task } from '@/types/task';
import styles from './Tasks.module.css';

/**
 * Channels a project ticket is shared in, and "Share to channel". Every
 * shared card opens this ticket's thread, so comments stay one conversation.
 */
export const TicketShares = ({ task }: { task: Task }) => {
  const { channels } = useChannels();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!task.projectId) return null;

  const shares = task.shares ?? [];
  const sharedIds = new Set(shares.map((share) => share.channelId));
  const nameOf = (id: string) => channels.find((c) => c.id === id)?.name ?? 'a channel';
  const options = channels
    .filter((c) => c.isMember && c.status === 'ACTIVE' && !sharedIds.has(c.id))
    .map((c) => ({ value: c.id, label: `${c.type === 'PRIVATE' ? '🔒 ' : '# '}${c.name}` }));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.shares} aria-label="Shared in channels">
      <div className={styles.shareRow}>
        <span className={styles.shareLabel}>Shared in</span>
        {shares.length === 0 && <span className={styles.muted}>No channels yet</span>}
        {shares.map((share) => (
          <span key={share.channelId} className={styles.shareChip}>
            # {nameOf(share.channelId)}
            <button
              type="button"
              aria-label={`Remove from #${nameOf(share.channelId)}`}
              disabled={busy}
              onClick={() => void run(() => unshareTask(task.id, share.channelId))}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      {options.length > 0 && (
        <Dropdown
          size="sm"
          ariaLabel="Share to channel"
          placeholder="+ Share to channel"
          options={options}
          value=""
          disabled={busy}
          onChange={(channelId) => void run(() => shareTask(task.id, channelId))}
        />
      )}
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
};
