'use client';

import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { formatBytes } from '@/lib/attachments';
import type { PendingAttachment } from '@/types/message';
import type { UploadTask } from '@/hooks/useComposerUploads';
import styles from '../MessageComposer.module.css';

/** Uploaded attachments + uploads in progress, inside the compose box. */
export const AttachmentChips = ({
  pending,
  uploads,
  onRemovePending,
  onCancelUpload,
  onDismissUpload,
}: {
  pending: PendingAttachment[];
  uploads: UploadTask[];
  onRemovePending: (index: number) => void;
  onCancelUpload: (id: string) => void;
  onDismissUpload: (id: string) => void;
}) => {
  if (pending.length === 0 && uploads.length === 0) return null;
  return (
    <div className={styles.attachments}>
      {pending.map((attachment, index) => (
        <span key={`${attachment.publicId}-${index}`} className={styles.attachment}>
          {attachment.kind === 'IMAGE' ? (
            <Image
              src={attachment.url}
              alt=""
              width={28}
              height={28}
              className={styles.attachmentThumb}
            />
          ) : (
            <span className={styles.attachmentGlyph}>
              <Icon name={attachment.kind === 'VIDEO' ? 'video' : 'file'} size={15} />
            </span>
          )}
          <span className={styles.attachmentInfo}>
            <span className={styles.attachmentName}>{attachment.originalName}</span>
            <span className={styles.attachmentSize}>{formatBytes(attachment.bytes)}</span>
          </span>
          <button
            type="button"
            className={styles.attachmentRemove}
            onClick={() => onRemovePending(index)}
            aria-label={`Remove ${attachment.originalName}`}
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      ))}

      {uploads.map((task) => (
        <span key={task.id} className={styles.attachment}>
          <span className={styles.attachmentGlyph}>
            <Icon name="file" size={15} />
          </span>
          <span className={styles.attachmentInfo}>
            <span className={styles.attachmentName}>{task.name}</span>
            {task.error ? (
              <span className={styles.attachmentError}>{task.error}</span>
            ) : (
              <span
                className={styles.progress}
                role="progressbar"
                aria-valuenow={Math.round(task.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span
                  className={styles.progressFill}
                  style={{ width: `${Math.round(task.progress * 100)}%` }}
                />
              </span>
            )}
          </span>
          {!task.error && (
            <span className={styles.attachmentPercent}>{Math.round(task.progress * 100)}%</span>
          )}
          <button
            type="button"
            className={styles.attachmentRemove}
            onClick={() => (task.error ? onDismissUpload(task.id) : onCancelUpload(task.id))}
            aria-label={task.error ? `Dismiss ${task.name}` : `Cancel upload of ${task.name}`}
            title={task.error ? 'Dismiss' : 'Cancel upload'}
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      ))}
    </div>
  );
};
