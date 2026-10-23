'use client';

import { useCallback, useState } from 'react';
import type { Message } from '@/types/message';
import { RichEditor } from './RichEditor';
import { ComposerToolbar } from './ComposerToolbar';
import { LinkDialog } from './LinkDialog';
import { useEditorControls } from './useEditorControls';
import styles from './MessageEditor.module.css';

const USER_TOKEN_RE = /^<@([0-9a-fA-F]{24})>$/;

/**
 * Edit box for a sent message: same rich editor + formatting bar as the
 * composer. Enter saves, Shift+Enter adds a line, Esc cancels. Chip names
 * come from message.mentions.
 */
export const MessageEditor = ({
  message,
  saving = false,
  error = '',
  onSave,
  onCancel,
}: {
  message: Message;
  saving?: boolean;
  error?: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState(message.content);
  const controls = useEditorControls();

  const resolveMention = useCallback(
    (token: string) => {
      const match = USER_TOKEN_RE.exec(token);
      if (match) {
        const id = match[1].toLowerCase();
        const found = message.mentions.find((mention) => mention.id.toLowerCase() === id);
        return `@${found?.fullName ?? 'unknown'}`;
      }
      return token.includes('channel') ? '@channel' : '@here';
    },
    [message.mentions],
  );

  const save = () => {
    if (value.trim() === '' || saving) return;
    onSave(value);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (controls.handleShortcut(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      save();
    }
  };

  return (
    <div className={styles.box}>
      <ComposerToolbar active={controls.formats} onAction={controls.runAction} />
      <RichEditor
        ref={controls.editorRef}
        initialValue={message.content}
        ariaLabel="Edit message"
        resolveMention={resolveMention}
        onChange={setValue}
        onKeyDown={onKeyDown}
        onStateChange={controls.onStateChange}
      />
      {error && <span className={styles.error}>{error}</span>}
      <div className={styles.actions}>
        <span className={styles.hint}>
          Enter to save, Shift+Enter for a new line, Esc to cancel
        </span>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.save}
          onClick={save}
          disabled={saving || value.trim() === ''}
        >
          Save
        </button>
      </div>
      <LinkDialog {...controls.linkDialog} />
    </div>
  );
};
