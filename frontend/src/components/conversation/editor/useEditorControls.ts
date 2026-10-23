'use client';

import { useCallback, useRef, useState } from 'react';
import { shortcutAction, type ShortcutAction } from '@/lib/composerFormat';
import type { ActiveFormats, EditorState, RichEditorHandle } from './RichEditor';

/**
 * Shared wiring for a RichEditor + ComposerToolbar + LinkDialog (composer and
 * message edit box): active formats, the "@query" before the caret, toolbar
 * actions, keyboard shortcuts and the link dialog state.
 */
export const useEditorControls = () => {
  const editorRef = useRef<RichEditorHandle>(null);
  const [formats, setFormats] = useState<ActiveFormats>({});
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [link, setLink] = useState<{ open: boolean; text: string }>({ open: false, text: '' });

  const onStateChange = useCallback((state: EditorState) => {
    setFormats(state.formats);
    setMentionQuery(state.mentionQuery);
  }, []);

  const runAction = useCallback((action: ShortcutAction) => {
    if (action === 'link') {
      const text = editorRef.current?.captureSelection() ?? '';
      setLink({ open: true, text });
      return;
    }
    editorRef.current?.applyFormat(action);
  }, []);

  /** Handles formatting shortcuts; returns true when the key was used. */
  const handleShortcut = useCallback(
    (event: React.KeyboardEvent) => {
      const action = shortcutAction(event);
      if (!action) return false;
      event.preventDefault();
      runAction(action);
      return true;
    },
    [runAction],
  );

  const closeLink = useCallback(() => {
    setLink({ open: false, text: '' });
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  const submitLink = useCallback((text: string, url: string) => {
    setLink({ open: false, text: '' });
    requestAnimationFrame(() => editorRef.current?.insertLink(text, url));
  }, []);

  return {
    editorRef,
    formats,
    mentionQuery,
    setMentionQuery,
    onStateChange,
    runAction,
    handleShortcut,
    linkDialog: {
      open: link.open,
      initialText: link.text,
      onClose: closeLink,
      onSubmit: submitLink,
    },
  };
};
