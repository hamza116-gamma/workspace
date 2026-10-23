'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatBytes, attachmentDownloadUrl } from '@/lib/attachments';
import { useDownload } from '@/hooks/useDownload';
import type { MessageAttachment } from '@/types/message';
import type { MessageLink } from '@/types/link';
import styles from './FilesLinks.module.css';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

const extensionOf = (name: string) => {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(index + 1).toUpperCase() : 'FILE';
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

type Row = {
  key: string;
  createdAt: string;
  url: string;
  title: string;
  meta: string;
  image: boolean;
  isLink: boolean;
  downloadUrl?: string;
};

export const FilesLinks = ({
  attachments,
  links,
  loading = false,
  title,
}: {
  attachments: MessageAttachment[];
  links: MessageLink[];
  loading?: boolean;
  title?: string;
}) => {
  const { download } = useDownload();

  const rows = useMemo<Row[]>(() => {
    const fileRows: Row[] = attachments.map((attachment) => ({
      key: `file:${attachment.id}`,
      createdAt: attachment.createdAt,
      url: attachment.url,
      title: attachment.name,
      meta: `${formatBytes(attachment.bytes)} · ${formatDate(attachment.createdAt)}`,
      image: attachment.kind === 'IMAGE',
      isLink: false,
      downloadUrl: attachmentDownloadUrl(attachment.id),
    }));

    const linkRows: Row[] = links.map((link) => ({
      key: `link:${link.id}`,
      createdAt: link.createdAt,
      url: link.url,
      title: hostOf(link.url),
      meta: `Shared by ${link.sender.fullName} · ${formatDate(link.createdAt)}`,
      image: false,
      isLink: true,
    }));

    return [...fileRows, ...linkRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [attachments, links]);

  return (
    <section className={styles.wrap}>
      {title && <h3 className={styles.title}>{title}</h3>}

      {loading && rows.length === 0 && <p className={styles.hint}>Loading…</p>}

      {!loading && rows.length === 0 && (
        <p className={styles.hint}>No files or links have been shared here yet.</p>
      )}

      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.key}>
              <div
                className={styles.row}
                role="button"
                tabIndex={0}
                onClick={() => window.open(row.url, '_blank', 'noopener,noreferrer')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    window.open(row.url, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                <span className={`${styles.media} ${row.isLink ? styles.linkMedia : ''}`}>
                  {row.image ? (
                    <Image src={row.url} alt="" fill sizes="48px" className={styles.thumb} />
                  ) : (
                    <Icon name={row.isLink ? 'link' : 'file'} size={18} />
                  )}
                </span>

                <span className={styles.info}>
                  <span className={styles.name}>{row.title}</span>
                  <span className={styles.meta}>{row.meta}</span>
                </span>

                <span className={styles.actions}>
                  {!row.isLink && (
                    <button
                      type="button"
                      className={styles.action}
                      aria-label={`Download ${row.title}`}
                      title="Download"
                      onClick={(event) => {
                        event.stopPropagation();
                        void download({
                          url: row.downloadUrl ?? '',
                          name: row.title,
                        });
                      }}
                    >
                      <Icon name="download" size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.action}
                    aria-label="Copy link"
                    title="Copy link"
                    onClick={(event) => {
                      event.stopPropagation();
                      void navigator.clipboard?.writeText(row.url);
                    }}
                  >
                    <Icon name="link" size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    aria-label="Open in new tab"
                    title="Open"
                    onClick={(event) => {
                      event.stopPropagation();
                      window.open(row.url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <Icon name="external" size={16} />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
