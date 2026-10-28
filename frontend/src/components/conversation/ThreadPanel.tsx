'use client';

import { useEffect, useState } from 'react';
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
import { TaskCard } from '@/components/tasks/TaskCard';
import { MoveToProject } from '@/components/tasks/MoveToProject';
import { Subtasks } from '@/components/tasks/Subtasks';
import { TicketActivity } from '@/components/tasks/TicketActivity';
import { TicketShares } from '@/components/tasks/TicketShares';
import { TicketFold } from './TicketFold';
import { listAssignable } from '@/lib/tasks';
import type { User } from '@/types/user';
import styles from './ThreadPanel.module.css';
import { NotFoundState, isNotFound } from '@/components/ui/NotFoundState';

export const ThreadPanel = () => {
  const { rootId, closeThread } = useThreadPanel();
  const {
    root,
    replies,
    loading,
    error,
    following,
    typingUsers,
    recordingUsers,
    send,
    react,
    edit,
    remove,
    setTyping,
    toggleFollow,
  } = useThread(rootId);
  const [alsoSend, setAlsoSend] = useState(false);
  const ticket = Boolean(root?.ticketThread);
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
  const channelMentionables = useMentionables(ticket ? null : mentionTarget);
  // A ticket's own thread: comments go to the ticket, @mentions offer the
  // people who can be on it (project members, incl. linked channels).
  const [ticketPeople, setTicketPeople] = useState<User[]>([]);
  const ticketId = ticket ? root?.taskId : null;
  useEffect(() => {
    if (!ticketId) return;
    listAssignable({ id: ticketId, channelId: null, conversationId: null }).then(
      setTicketPeople,
      () => setTicketPeople([]),
    );
  }, [ticketId]);
  const mentionables = ticket ? ticketPeople : channelMentionables;

  // Ticket thread: the ticket card replaces the (hidden) anchor message.
  const messages = root && !ticket ? [root, ...replies] : replies;

  return (
    <aside className={styles.panel} aria-label="Thread">
      <header className={styles.header}>
        <h2 className={styles.title}>
          {ticket && root?.task ? `${root.task.key} · Ticket` : 'Thread'}
        </h2>
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
          <NotFoundState
            compact
            icon="thread"
            title={isNotFound(error) ? 'Thread not found' : 'Couldn’t load this thread'}
            text={
              isNotFound(error)
                ? 'The message may have been deleted, or you no longer have access to it.'
                : (error ?? '')
            }
            actionHref={null}
          />
        </div>
      ) : (
        <>
          {ticket && root.task && (
            <TicketFold task={root.task}>
              <TaskCard task={root.task} canModerate={canModerate} />
              <Subtasks task={root.task} />
              <TicketShares task={root.task} />
              <TicketActivity
                task={root.task}
                following={following}
                onToggleFollow={() => void toggleFollow()}
              />
              <p className={styles.ticketHint}>
                Comments and activity stay on this ticket; they are not posted to the channel.
              </p>
            </TicketFold>
          )}
          {!ticket && root.task && (
            <TicketFold task={root.task} label="Subtasks and project">
              <MoveToProject task={root.task} />
              {!root.task.locked && <Subtasks task={root.task} />}
              {!root.task.locked && (
                <TicketActivity
                  task={root.task}
                  following={following}
                  onToggleFollow={() => void toggleFollow()}
                />
              )}
            </TicketFold>
          )}
          <MessageList
            messages={messages}
            loading={false}
            onReact={react}
            onEdit={edit}
            onDelete={remove}
            canModerate={canModerate}
            ownTicketKey={ticket ? root.task?.key : undefined}
            separatorAfter={
              root && !ticket && replies.length > 0
                ? {
                    messageId: root.id,
                    label: `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`,
                  }
                : undefined
            }
          />
        </>
      )}

      {root?.channelId && !ticket && (
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
          <TypingIndicator users={typingUsers} recording={recordingUsers} />
          <MessageComposer
            placeholder={ticket ? 'Comment on this ticket…' : 'Reply…'}
            mentionables={mentionables}
            onSend={(content, attachments) => send(content, alsoSend, attachments)}
            onTyping={setTyping}
            draftTarget={rootId ? { threadRootId: rootId } : null}
            scheduleTarget={
              mentionTarget && rootId && !ticket
                ? { ...mentionTarget, parentMessageId: rootId, alsoSendToChannel: alsoSend }
                : null
            }
          />
        </>
      )}
    </aside>
  );
};
