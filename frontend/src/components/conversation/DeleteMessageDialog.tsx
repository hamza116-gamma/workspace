'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { MessageContent } from './MessageContent';
import { MessageAttachments } from './MessageAttachments';
import { formatFullTimestamp } from '@/lib/format';
import type { Message } from '@/types/message';
import styles from './DeleteMessageDialog.module.css';

export const DeleteMessageDialog = ({
  open,
  message,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  message: Message | null;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <Modal open={open} title="Delete message" onClose={onCancel}>
    <p className={styles.intro}>
      Are you sure you want to delete this message? This cannot be undone.
    </p>

    {message && (
      <div className={styles.preview}>
        <div className={styles.previewHead}>
          <Avatar name={message.sender.fullName} src={message.sender.avatarUrl} size={34} />
          <span className={styles.previewName}>{message.sender.fullName}</span>
          <span className={styles.previewTime}>{formatFullTimestamp(message.createdAt)}</span>
        </div>
        {message.content && (
          <div className={styles.previewBody}>
            <MessageContent content={message.content} mentions={message.mentions} />
          </div>
        )}

        {(message.attachments?.length ?? 0) > 0 && (
          <div className={styles.previewAttachments}>
            <MessageAttachments attachments={message.attachments ?? []} />
          </div>
        )}
      </div>
    )}

    <div className={styles.actions}>
      <Button variant="secondary" type="button" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="danger" type="button" onClick={onConfirm}>
        Delete
      </Button>
    </div>
  </Modal>
);
