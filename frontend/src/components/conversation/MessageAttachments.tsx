'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Lightbox } from '@/components/ui/Lightbox';
import { AudioPlayer } from './AudioPlayer';
import { formatBytes, attachmentDownloadUrl } from '@/lib/attachments';
import { useDownload } from '@/hooks/useDownload';
import type { MessageAttachment } from '@/types/message';
import styles from './MessageAttachments.module.css';

// Keeps the intrinsic aspect ratio but caps the requested size so next/image
// does not fetch needlessly large variants for a small on-screen preview.
const displaySize = (attachment: MessageAttachment) => {
  const width = attachment.width ?? 320;
  const height = attachment.height ?? 220;
  const max = 640;
  const scale = Math.max(width, height) > max ? max / Math.max(width, height) : 1;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

const DownloadButton = ({ attachment }: { attachment: MessageAttachment }) => {
  const { download } = useDownload();
  return (
    <button
      type="button"
      className={styles.download}
      aria-label={`Download ${attachment.name}`}
      title="Download"
      onClick={(event) => {
        event.stopPropagation();
        void download({ url: attachmentDownloadUrl(attachment.id), name: attachment.name });
      }}
    >
      <Icon name="download" size={16} />
    </button>
  );
};

const FileRow = ({ attachment }: { attachment: MessageAttachment }) => {
  const { download } = useDownload();
  const start = () =>
    download({ url: attachmentDownloadUrl(attachment.id), name: attachment.name });
  return (
    <div
      className={styles.file}
      role="button"
      tabIndex={0}
      onClick={start}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          start();
        }
      }}
      aria-label={`Download ${attachment.name}`}
      title={attachment.name}
    >
      <span className={styles.fileIcon}>
        <Icon name="file" size={18} />
      </span>
      <span className={styles.fileInfo}>
        <span className={styles.fileName}>{attachment.name}</span>
        <span className={styles.fileMeta}>{formatBytes(attachment.bytes)}</span>
      </span>
      <span className={styles.fileDownload}>
        <Icon name="download" size={16} />
      </span>
    </div>
  );
};

export const MessageAttachments = ({
  attachments,
  compact = false,
}: {
  attachments: MessageAttachment[];
  compact?: boolean;
}) => {
  const [zoom, setZoom] = useState<MessageAttachment | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const images = attachments.filter((attachment) => attachment.kind === 'IMAGE');
  const others = attachments.filter((attachment) => attachment.kind !== 'IMAGE');

  const wrapClass = compact ? `${styles.wrap} ${styles.compact}` : styles.wrap;
  const imagesClass = `${styles.images} ${images.length === 1 ? styles.single : ''}`;

  return (
    <div className={wrapClass}>
      {images.length > 0 && (
        <div className={imagesClass}>
          {images.map((attachment) => (
            <div key={attachment.id} className={styles.media}>
              <button
                type="button"
                className={styles.thumb}
                onClick={() => setZoom(attachment)}
                aria-label={`View ${attachment.name}`}
                title={attachment.name}
              >
                <Image
                  src={attachment.url}
                  alt={attachment.name}
                  width={displaySize(attachment).width}
                  height={displaySize(attachment).height}
                  className={styles.image}
                />
              </button>
              <DownloadButton attachment={attachment} />
            </div>
          ))}
        </div>
      )}

      {others.map((attachment) => (
        <div key={attachment.id} className={styles.media}>
          {attachment.kind === 'VIDEO' ? (
            <video className={styles.video} src={attachment.url} controls preload="metadata" />
          ) : attachment.kind === 'AUDIO' ? (
            <AudioPlayer
              src={attachment.url}
              name={attachment.name}
              duration={attachment.duration}
              downloadUrl={attachmentDownloadUrl(attachment.id)}
              waveformSource={attachmentDownloadUrl(attachment.id)}
              compact={compact}
            />
          ) : (
            <FileRow attachment={attachment} />
          )}
          {attachment.kind !== 'FILE' && attachment.kind !== 'AUDIO' && (
            <DownloadButton attachment={attachment} />
          )}
        </div>
      ))}

      <Lightbox
        open={Boolean(zoom)}
        src={zoom?.url ?? null}
        alt={zoom?.name}
        onClose={() => setZoom(null)}
      />
    </div>
  );
};
