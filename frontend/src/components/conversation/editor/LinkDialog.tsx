'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { normalizeUrl } from '@/lib/composerFormat';
import styles from './LinkDialog.module.css';

/** "Add link" dialog shared by the composer and the message edit box. */
export const LinkDialog = ({
  open,
  initialText = '',
  onClose,
  onSubmit,
}: {
  open: boolean;
  initialText?: string;
  onClose: () => void;
  onSubmit: (text: string, url: string) => void;
}) => {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setText(initialText);
      setUrl('');
      setError('');
    }
  }, [open, initialText]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const href = normalizeUrl(url);
    if (!href) {
      setError('Enter a valid http(s) link');
      return;
    }
    onSubmit(text.trim() || href, href);
  };

  return (
    <Modal open={open} title="Add link" onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <Input
          label="Text"
          name="link-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Text to display"
        />
        <Input
          label="Link"
          name="link-url"
          value={url}
          autoFocus
          onChange={(event) => {
            setUrl(event.target.value);
            setError('');
          }}
          placeholder="https://example.com"
          error={error}
        />
        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={url.trim() === ''}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
};
