'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { MessageContent } from '@/components/conversation/MessageContent';
import { useFocusMessage } from '@/hooks/useFocusMessage';
import { useThreadPanel } from '@/hooks/useThreadPanel';
import { createConversation } from '@/lib/conversations';
import { formatBytes } from '@/lib/attachments';
import { formatFullTimestamp } from '@/lib/format';
import { messageHref } from '@/lib/search';
import type { SearchChannel, SearchFile, SearchMessage, SearchPerson } from '@/types/search';
import { TASK_STATUS_LABELS, type Task } from '@/types/task';
import styles from './SearchView.module.css';

// Opening a result focuses the message; thread replies open their thread
// (the chat is focused on the root, which is in the main history).
export const MessageResult = ({ message }: { message: SearchMessage }) => {
  const { focusMessage } = useFocusMessage();
  const { openThread } = useThreadPanel();
  const rootId =
    message.parentMessageId && !message.alsoSentToChannel ? message.parentMessageId : null;
  const where =
    message.location.kind === 'channel'
      ? `#${message.location.name || 'channel'}`
      : message.location.name || 'Direct message';

  return (
    <li className={styles.item}>
      <Link
        href={messageHref(message, rootId ?? message.id)}
        className={styles.open}
        onClick={() => {
          focusMessage(rootId ?? message.id);
          if (rootId) {
            openThread(rootId);
          }
        }}
      >
        <div className={styles.head}>
          <Avatar name={message.sender.fullName} src={message.sender.avatarUrl} size={28} />
          <span className={styles.name}>{message.sender.fullName}</span>
          <span className={styles.where}>{where}</span>
          {rootId && <span className={styles.pill}>Thread reply</span>}
          <span className={styles.time}>{formatFullTimestamp(message.createdAt)}</span>
        </div>
        {message.content && (
          <div className={styles.body}>
            <MessageContent
              content={message.content}
              mentions={message.mentions}
              senderId={message.sender.id}
            />
          </div>
        )}
      </Link>
    </li>
  );
};

export const ChannelResult = ({ channel }: { channel: SearchChannel }) => (
  <li className={styles.item}>
    <Link href={`/channels/${channel.id}`} className={`${styles.open} ${styles.row}`}>
      <span className={styles.badgeIcon} aria-hidden>
        <Icon name={channel.type === 'PRIVATE' ? 'lock' : 'hash'} size={15} />
      </span>
      <span className={styles.rowText}>
        <span className={styles.name}>{channel.name}</span>
        {(channel.topic || channel.purpose) && (
          <span className={styles.meta}>{channel.topic || channel.purpose}</span>
        )}
      </span>
      {channel.isMember ? (
        <span className={styles.pill}>Joined</span>
      ) : (
        <span className={styles.pillMuted}>Not joined</span>
      )}
    </Link>
  </li>
);

export const PersonResult = ({ person }: { person: SearchPerson }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const message = async () => {
    setBusy(true);
    try {
      const { conversation } = await createConversation([person.id]);
      router.push(`/dm/${conversation.id}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <li className={`${styles.item} ${styles.row}`}>
      <Avatar name={person.fullName} src={person.avatarUrl} size={32} />
      <span className={styles.rowText}>
        <span className={styles.name}>{person.fullName}</span>
        <span className={styles.meta}>
          {[person.jobTitle, person.department].filter(Boolean).join(' · ') || person.email}
        </span>
      </span>
      <button
        type="button"
        className={styles.action}
        onClick={() => void message()}
        disabled={busy}
      >
        <Icon name="message" size={14} />
        Message
      </button>
    </li>
  );
};

export const FileResult = ({ file }: { file: SearchFile }) => {
  const { focusMessage } = useFocusMessage();
  return (
    <li className={styles.item}>
      <Link
        href={messageHref(file, file.messageId)}
        className={`${styles.open} ${styles.row}`}
        onClick={() => focusMessage(file.messageId)}
      >
        <span className={styles.badgeIcon} aria-hidden>
          <Icon name={file.kind === 'IMAGE' ? 'image' : 'file'} size={15} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.name}>{file.name}</span>
          <span className={styles.meta}>
            {formatBytes(file.bytes)} · {formatFullTimestamp(file.createdAt)}
          </span>
        </span>
      </Link>
    </li>
  );
};

export const TaskResult = ({ task }: { task: Task }) => {
  const { focusMessage } = useFocusMessage();
  return (
    <li className={styles.item}>
      <Link
        href={messageHref(task, task.messageId)}
        className={`${styles.open} ${styles.row}`}
        onClick={() => focusMessage(task.messageId)}
      >
        <span className={styles.badgeIcon} aria-hidden>
          <Icon name="task" size={15} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.name}>
            {task.key} · {task.title}
          </span>
          <span className={styles.meta}>
            {TASK_STATUS_LABELS[task.status]} ·{' '}
            {task.assignees.length
              ? task.assignees.map((user) => user.fullName).join(', ')
              : 'Unassigned'}
          </span>
        </span>
      </Link>
    </li>
  );
};
