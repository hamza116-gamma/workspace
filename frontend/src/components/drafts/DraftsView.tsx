'use client';

import Link from 'next/link';
import { useDrafts } from '@/hooks/useDrafts';
import { useChannels } from '@/hooks/useChannels';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';
import { useFocusMessage } from '@/hooks/useFocusMessage';
import { useThreadPanel } from '@/hooks/useThreadPanel';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { formatFullTimestamp } from '@/lib/format';
import type { Draft } from '@/types/draft';
import styles from './DraftsView.module.css';

const hrefFor = (draft: Draft) => {
  const base = draft.channelId ? `/channels/${draft.channelId}` : `/dm/${draft.conversationId}`;
  return draft.threadRootId ? `${base}?message=${draft.threadRootId}` : base;
};

// Slack "Drafts": every unsent composer text in this workspace.
export const DraftsView = () => {
  const { drafts, loaded, removeDraft } = useDrafts();
  const { channels } = useChannels();
  const { conversations } = useConversations();
  const { user } = useAuth();
  const { focusMessage } = useFocusMessage();
  const { openThread } = useThreadPanel();

  const where = (draft: Draft) => {
    let name = 'a conversation';
    if (draft.channelId) {
      name = `#${channels.find((channel) => channel.id === draft.channelId)?.name ?? 'channel'}`;
    } else {
      const conversation = conversations.find((item) => item.id === draft.conversationId);
      const others = conversation?.participants
        .filter((participant) => participant.user.id !== user?.id)
        .map((participant) => participant.user.fullName);
      name = others?.length ? others.join(', ') : name;
    }
    return draft.threadRootId ? `Thread in ${name}` : name;
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Library</span>
        <h1 className={styles.title}>Drafts</h1>
        <p className={styles.subtitle}>
          Messages you started but have not sent. Drafts save automatically as you type.
        </p>
      </header>

      {!loaded && (
        <div className={styles.center}>
          <Spinner />
        </div>
      )}

      {loaded && drafts.length === 0 && (
        <div className={styles.emptyCard}>
          <span className={styles.emptyIcon} aria-hidden>
            <Icon name="pencil" size={20} />
          </span>
          <p className={styles.emptyTitle}>No drafts</p>
          <p className={styles.empty}>Anything you type and don’t send shows up here.</p>
        </div>
      )}

      {drafts.length > 0 && (
        <ul className={styles.list}>
          {drafts.map((draft) => (
            <li key={draft.id} className={styles.item}>
              <div className={styles.head}>
                <span className={styles.icon} aria-hidden>
                  <Icon name={draft.threadRootId ? 'thread' : draft.channelId ? 'hash' : 'message'} size={15} />
                </span>
                <span className={styles.name}>{where(draft)}</span>
                <span className={styles.time}>{formatFullTimestamp(draft.updatedAt)}</span>
                <Link
                  href={hrefFor(draft)}
                  className={styles.jump}
                  onClick={() => {
                    if (draft.threadRootId) {
                      focusMessage(draft.threadRootId);
                      openThread(draft.threadRootId);
                    }
                  }}
                >
                  Open
                </Link>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => void removeDraft(draft.id)}
                  aria-label="Delete draft"
                  title="Delete draft"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
              <div className={styles.body}>{draft.content}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
