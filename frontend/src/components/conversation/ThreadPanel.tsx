'use client';

import { useState } from 'react';
import { useThreadPanel } from '@/hooks/useThreadPanel';
import { useThread } from '@/hooks/useThread';
import { useMentionables } from '@/hooks/useMentionables';
import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useOrg } from '@/hooks/useOrg';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import styles from './ThreadPanel.module.css';

export const ThreadPanel = () => {
  const { rootId, closeThread } = useThreadPanel();
  const {
    root,
    replies,
    loading,
    error,
    following,
    typingUsers,
    send,
    react,
    edit,
    remove,
    setTyping,
    toggleFollow,
  } = useThread(rootId);
  const [alsoSend, setAlsoSend] = useState(false);
  const { channel } = useActiveChannel();
  const { active } = useOrg();
  // Channel moderators and org owners/admins may delete anyone's message.
  const canModerate = Boolean(
    root?.channelId &&
    (active?.role === 'OWNER' ||
      active?.role === 'ADMIN' ||
      (channel?.id === root.channelId && channel.membership?.role === 'MODERATOR')),
  );

  const mentionTarget = root
    ? root.channelId
      ? { kind: 'channel' as const, id: root.channelId }
      : { kind: 'conversation' as const, id: root.conversationId as string }
    : null;
  const mentionables = useMentionables(mentionTarget);

  const messages = root ? [root, ...replies] : replies;

  return (
    <aside className={styles.panel} aria-label="Thread">
      <header className={styles.header}>
        <h2 className={styles.title}>Thread</h2>
        <button
          type="button"
          className={`${styles.iconBtn} ${following ? styles.following : ''}`}
          onClick={() => void toggleFollow()}
          aria-pressed={following}
          title={following ? 'Unfollow thread' : 'Follow thread'}
        >
          <Icon name="bell" size={16} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={closeThread}
          aria-label="Close thread"
          title="Close"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </header>

      {loading && !root ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : error || !root ? (
        <div className={styles.alertWrap}>
          <Alert>{error || 'Thread not found'}</Alert>
        </div>
      ) : (
        <MessageList
          messages={messages}
          loading={false}
          onReact={react}
          onEdit={edit}
          onDelete={remove}
          canModerate={canModerate}
          separatorAfter={
            root && replies.length > 0
              ? {
                  messageId: root.id,
                  label: `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`,
                }
              : undefined
          }
        />
      )}

      {root?.channelId && (
        <label className={styles.also}>
          <input
            type="checkbox"
            checked={alsoSend}
            onChange={(event) => setAlsoSend(event.target.checked)}
          />
          Also send to channel
        </label>
      )}

      {root && (
        <>
          <MessageComposer
            placeholder="Reply…"
            mentionables={mentionables}
            onSend={(content, attachments) => send(content, alsoSend, attachments)}
            onTyping={setTyping}
            draftTarget={rootId ? { threadRootId: rootId } : null}
            scheduleTarget={
              mentionTarget && rootId
                ? { ...mentionTarget, parentMessageId: rootId, alsoSendToChannel: alsoSend }
                : null
            }
          />
          <TypingIndicator users={typingUsers} />
        </>
      )}
    </aside>
  );
};
