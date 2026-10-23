'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import styles from './Lightbox.module.css';

export const Lightbox = ({
  open,
  src,
  alt = '',
  onClose,
}: {
  open: boolean;
  src: string | null;
  alt?: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !src || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
    >
      <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
        <a
          className={styles.action}
          href={src}
          target="_blank"
          rel="noreferrer"
          download={alt || undefined}
          aria-label="Open original"
          title="Open original"
        >
          <Icon name="download" size={18} />
        </a>
        <button
          type="button"
          className={styles.action}
          onClick={onClose}
          aria-label="Close preview"
          title="Close"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className={styles.stage} onClick={(event) => event.stopPropagation()}>
        <Image src={src} alt={alt} fill sizes="100vw" className={styles.image} />
      </div>
    </div>,
    document.body,
  );
};
