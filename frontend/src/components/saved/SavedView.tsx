'use client';

import Link from 'next/link';
import { useSaved } from '@/hooks/useSaved';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { MessageContent } from '@/components/conversation/MessageContent';
import { MessageAttachments } from '@/components/conversation/MessageAttachments';
import type { Message } from '@/types/message';
import styles from './SavedView.module.css';

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const locationFor = (message: Message) =>
  message.channelId ? `/channels/${message.channelId}` : `/dm/${message.conversationId}`;

export const SavedView = () => {
  const { items, loading, toggleSave } = useSaved();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Library</span>
        <h1 className={styles.title}>Saved items</h1>
        <p className={styles.subtitle}>
          Messages you saved for later. This list is private to you.
        </p>
      </header>

      {loading && items.length === 0 && (
        <div className={styles.center}>
          <Spinner />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className={styles.emptyCard}>
          <span className={styles.emptyIcon} aria-hidden>
            <Icon name="bookmark" size={20} />
          </span>
          <p className={styles.emptyTitle}>Nothing saved yet</p>
          <p className={styles.empty}>Hover a message and choose “Save for later”.</p>
        </div>
      )}

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.head}>
                <Avatar
                  name={item.message.sender.fullName}
                  src={item.message.sender.avatarUrl}
                  size={30}
                />
                <span className={styles.name}>{item.message.sender.fullName}</span>
                <span className={styles.time}>{formatWhen(item.message.createdAt)}</span>
                <Link href={locationFor(item.message)} className={styles.jump}>
                  Open
                </Link>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => void toggleSave(item.messageId)}
                  aria-label="Remove from saved"
                  title="Remove from saved"
                >
                  <Icon name="bookmark" size={16} />
                </button>
              </div>
              <div className={styles.body}>
                {item.message.content && (
                  <MessageContent
                    content={item.message.content}
                    mentions={item.message.mentions}
                    senderId={item.message.sender.id}
                  />
                )}
                {(item.message.attachments?.length ?? 0) > 0 && (
                  <MessageAttachments attachments={item.message.attachments} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
