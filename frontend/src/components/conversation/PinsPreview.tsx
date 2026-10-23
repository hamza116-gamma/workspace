'use client';

import { useMemo } from 'react';
import { MessageList } from './MessageList';
import { usePins } from '@/hooks/usePins';
import { useUnread } from '@/hooks/useUnread';
import { useThreadPanel } from '@/hooks/useThreadPanel';
import { deleteMessage, toggleReaction, updateMessage } from '@/lib/messages';
import styles from './PinsPreview.module.css';

// Slack-style "Pins" hover card: renders every pinned message as a fully
// interactive message (reactions, reply in thread, save, edit/delete) with
// hover-download on any of its attachments. Clicking a pinned message jumps
// to it in the chat (without breaking hover downloads/other controls).
export const PinsPreview = ({
  targetKey,
  onOpenMessage,
}: {
  targetKey?: string;
  onOpenMessage?: (messageId: string) => void;
}) => {
  const { pins, applyMessage, removeMessage } = usePins();
  const { mark } = useUnread();
  const { openThread } = useThreadPanel();

  const messages = useMemo(
    () => [...pins].reverse().map((pin) => pin.message),
    [pins],
  );

  const react = async (messageId: string, emoji: string) => {
    const result = await toggleReaction(messageId, emoji);
    applyMessage(result.message);
  };

  const edit = async (messageId: string, content: string) => {
    const result = await updateMessage(messageId, content);
    applyMessage(result.message);
  };

  const remove = async (messageId: string) => {
    await deleteMessage(messageId);
    removeMessage(messageId);
  };

  // Click-to-jump: clicking anywhere on a pinned message scrolls to it in the
  // chat, except for interactive controls (download, copy, reactions, thread,
  // kebab, media players, edit box...).
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onOpenMessage) {
      return;
    }
    const target = event.target as HTMLElement;
    if (
      target.closest(
        'a, button, textarea, input, select, video, audio, iframe, [role="listbox"], [role="menu"], [role="dialog"]',
      )
    ) {
      return;
    }
    const row = target.closest<HTMLElement>('[data-message-id]');
    const messageId = row?.getAttribute('data-message-id');
    if (messageId) {
      onOpenMessage(messageId);
    }
  };

  return (
    <div className={styles.wrap} onClick={handleClick}>
      <MessageList
        messages={messages}
        loading={false}
        autoScroll={false}
        compact
        showDayDividers={false}
        fullTimestamps
        targetKey={targetKey}
        onReact={react}
        onEdit={edit}
        onDelete={remove}
        onMarkUnread={(messageId) => targetKey && mark(targetKey, messageId)}
        onOpenThread={(messageId) => openThread(messageId)}
        placeholder={<p className={styles.empty}>No pinned messages.</p>}
      />
    </div>
  );
};
