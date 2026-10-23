'use client';

import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu';
import { Icon } from '@/components/ui/Icon';
import { EmojiPicker } from './EmojiPicker';
import type { Message } from '@/types/message';
import styles from './MessageActions.module.css';

const QUICK_EMOJI = ['👍', '✅', '😄', '🎉'];

export const MessageActions = ({
  message,
  isOwn,
  canModerate = false,
  onReact,
  onEdit,
  onDelete,
  onMarkUnread,
  onReplyInThread,
  pinned,
  onTogglePin,
  saved,
  onToggleSave,
}: {
  message: Message;
  isOwn: boolean;
  // Channel moderators / org admins may delete anyone's channel message.
  canModerate?: boolean;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkUnread: () => void;
  onReplyInThread?: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
}) => {
  const copyText = () => {
    void navigator.clipboard?.writeText(message.content);
  };

  const copyLink = () => {
    const base = message.channelId
      ? `/channels/${message.channelId}`
      : `/dm/${message.conversationId}`;
    void navigator.clipboard?.writeText(
      `${window.location.origin}${base}?message=${message.id}`,
    );
  };

  const items: MenuItem[] = [
    { label: 'Mark as unread', icon: 'message', onSelect: onMarkUnread },
    { label: 'Copy text', icon: 'copy', onSelect: copyText },
    { label: 'Copy link', icon: 'link', onSelect: copyLink },
  ];

  if (onTogglePin) {
    items.push({
      label: pinned ? 'Unpin from channel' : 'Pin to channel',
      icon: 'pin',
      onSelect: onTogglePin,
    });
  }

  if (onToggleSave) {
    items.push({
      label: saved ? 'Remove from saved' : 'Save for later',
      icon: 'bookmark',
      onSelect: onToggleSave,
    });
  }

  if (isOwn) {
    items.push(
      { separator: true },
      { label: 'Edit message', icon: 'pencil', onSelect: onEdit },
      { label: 'Delete message', icon: 'trash', danger: true, onSelect: onDelete },
    );
  } else if (canModerate && message.channelId) {
    items.push(
      { separator: true },
      { label: 'Delete message', icon: 'trash', danger: true, onSelect: onDelete },
    );
  }

  return (
    <div className={styles.toolbar}>
      {QUICK_EMOJI.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className={styles.emoji}
          onClick={() => onReact(emoji)}
          aria-label={`React ${emoji}`}
          title={`React ${emoji}`}
        >
          {emoji}
        </button>
      ))}
      <EmojiPicker onSelect={onReact} />
      {onReplyInThread && (
        <button
          type="button"
          className={styles.emoji}
          onClick={onReplyInThread}
          aria-label="Reply in thread"
          title="Reply in thread"
        >
          <Icon name="thread" size={16} />
        </button>
      )}
      <span className={styles.divider} aria-hidden />
      <DropdownMenu items={items} />
    </div>
  );
};
