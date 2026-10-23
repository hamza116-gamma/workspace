'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { FormatAction } from '@/lib/composerFormat';
import {
  editorToMarkdown,
  escapeHtml,
  markdownToEditorHtml,
  mentionChipHtml,
  type MentionResolver,
} from './markdown';
import styles from './RichEditor.module.css';

export type ActiveFormats = Partial<Record<FormatAction | 'link', boolean>>;

export type EditorState = {
  /** Text after an "@" right before the caret (null when not typing a mention). */
  mentionQuery: string | null;
  formats: ActiveFormats;
};

export type RichEditorHandle = {
  focus: () => void;
  /** Replaces the whole content with Slack text (drafts, clear on send). */
  setValue: (markdown: string) => void;
  insertText: (text: string) => void;
  /** Replaces the "@query" before the caret with a mention chip. */
  insertMention: (token: string, label: string) => void;
  applyFormat: (action: FormatAction) => void;
  /** Selected text (pre-fills the link dialog); also remembers the selection. */
  captureSelection: () => string;
  /** Inserts [text](url) at the selection remembered by captureSelection. */
  insertLink: (text: string, url: string) => void;
  /** Re-labels mention chips (e.g. after the member list loaded). */
  refreshMentions: () => void;
};

type Props = {
  initialValue?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  resolveMention: MentionResolver;
  onChange: (markdown: string) => void;
  /** Runs first; call preventDefault() to stop the editor's own handling. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onStateChange?: (state: EditorState) => void;
  onPasteFiles?: (files: File[]) => void;
  onBlur?: () => void;
};

const exec = (command: string, value?: string) => document.execCommand(command, false, value);

/**
 * WYSIWYG message editor without dependencies: a contenteditable driven by
 * document.execCommand (so the browser's undo works). Inline code is custom
 * (<code> wrap/unwrap); leaving code (Right arrow at its end, or the Code
 * button with a caret) makes the next typed text land AFTER the <code>.
 * Shift+Enter: "\n" in code blocks, a new item in lists, a new line
 * elsewhere. Paste/drop insert plain text only; pasted files go to
 * onPasteFiles.
 */
export const RichEditor = forwardRef<RichEditorHandle, Props>(
  (
    {
      initialValue = '',
      placeholder,
      disabled = false,
      ariaLabel = 'Message',
      className,
      resolveMention,
      onChange,
      onKeyDown,
      onStateChange,
      onPasteFiles,
      onBlur,
    },
    ref,
  ) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const exitCodeRef = useRef<HTMLElement | null>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const resolveRef = useRef(resolveMention);
    resolveRef.current = resolveMention;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onStateRef = useRef(onStateChange);
    onStateRef.current = onStateChange;

    const inEditor = (node: Node | null) => Boolean(node && rootRef.current?.contains(node));

    const selectionRange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      const range = selection.getRangeAt(0);
      return inEditor(range.commonAncestorContainer) ? range : null;
    };

    const closest = (selector: string) => {
      const range = selectionRange();
      const node = range?.startContainer ?? null;
      const element = node instanceof HTMLElement ? node : node?.parentElement;
      const found = element?.closest(selector) ?? null;
      return found && inEditor(found) ? (found as HTMLElement) : null;
    };

    const updateEmpty = () => {
      const root = rootRef.current;
      if (!root) return;
      const empty =
        (root.textContent ?? '').replace(/\u200b/g, '') === '' &&
        !root.querySelector('[data-mention], li, pre, blockquote');
      root.dataset.empty = empty ? 'true' : 'false';
    };

    const reportState = useCallback(() => {
      const range = selectionRange();
      if (!range) return;
      let mentionQuery: string | null = null;
      if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
        const before = (range.startContainer.textContent ?? '').slice(0, range.startOffset);
        const match = /(?:^|[\s\u00a0])@([^\s@\u00a0]*)$/.exec(before);
        if (match) mentionQuery = match[1];
      }
      const state = (command: string) => {
        try {
          return document.queryCommandState(command);
        } catch {
          return false;
        }
      };
      onStateRef.current?.({
        mentionQuery,
        formats: {
          bold: state('bold'),
          italic: state('italic'),
          underline: state('underline'),
          strike: state('strikeThrough'),
          numberedList: state('insertOrderedList'),
          bulletList: state('insertUnorderedList'),
          code: Boolean(closest('code')) && !closest('pre'),
          codeBlock: Boolean(closest('pre')),
          quote: Boolean(closest('blockquote')),
          link: Boolean(closest('a')),
        },
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const emitChange = useCallback(() => {
      const root = rootRef.current;
      if (!root) return;
      updateEmpty();
      onChangeRef.current(editorToMarkdown(root));
      reportState();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportState]);

    const placeCaret = (node: Node, offset: number) => {
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    };

    // Moves the caret right after an inline element, into a text node.
    const caretAfter = (element: HTMLElement, text = '\u200b') => {
      const node = document.createTextNode(text);
      element.after(node);
      placeCaret(node, node.length);
      return node;
    };

    const toggleInlineCode = () => {
      const range = selectionRange();
      if (!range) return;
      const code = closest('code');
      if (code && !closest('pre')) {
        if (range.collapsed) {
          exitCodeRef.current = code;
          caretAfter(code);
        } else {
          code.replaceWith(document.createTextNode(code.textContent ?? ''));
        }
        emitChange();
        return;
      }
      if (range.collapsed) {
        exec('insertHTML', '<code data-new="true">\u200b</code>');
        const inserted = rootRef.current?.querySelector<HTMLElement>('code[data-new]');
        inserted?.removeAttribute('data-new');
        const text = inserted?.firstChild;
        if (text) placeCaret(text, text.textContent?.length ?? 0);
      } else {
        exec('insertHTML', `<code>${escapeHtml(range.toString())}</code>`);
      }
      emitChange();
    };

    const toggleBlock = (tag: 'pre' | 'blockquote') => {
      const current = closest(tag);
      exec('formatBlock', current ? 'div' : tag);
      emitChange();
    };

    const applyFormat = (action: FormatAction) => {
      rootRef.current?.focus();
      switch (action) {
        case 'bold':
          exec('bold');
          break;
        case 'italic':
          exec('italic');
          break;
        case 'underline':
          exec('underline');
          break;
        case 'strike':
          exec('strikeThrough');
          break;
        case 'bulletList':
          exec('insertUnorderedList');
          break;
        case 'numberedList':
          exec('insertOrderedList');
          break;
        case 'quote':
          toggleBlock('blockquote');
          return;
        case 'codeBlock':
          toggleBlock('pre');
          return;
        case 'code':
          toggleInlineCode();
          return;
      }
      emitChange();
    };

    const setValue = (markdown: string) => {
      const root = rootRef.current;
      if (!root) return;
      root.innerHTML = markdownToEditorHtml(markdown, resolveRef.current);
      exitCodeRef.current = null;
      updateEmpty();
      if (document.activeElement === root) {
        placeCaret(root, root.childNodes.length);
      }
    };

    useImperativeHandle(ref, () => ({
      focus: () => {
        const root = rootRef.current;
        if (!root) return;
        root.focus();
        if (!selectionRange()) placeCaret(root, root.childNodes.length);
      },
      setValue,
      insertText: (text: string) => {
        const root = rootRef.current;
        if (!root) return;
        root.focus();
        if (!selectionRange()) placeCaret(root, root.childNodes.length);
        exec('insertText', text);
        emitChange();
      },
      insertMention: (token: string, label: string) => {
        const range = selectionRange();
        if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return;
        const node = range.startContainer;
        const before = (node.textContent ?? '').slice(0, range.startOffset);
        const at = before.lastIndexOf('@');
        if (at < 0) return;
        const replace = document.createRange();
        replace.setStart(node, at);
        replace.setEnd(node, range.startOffset);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(replace);
        exec('insertHTML', `${mentionChipHtml(token, label)}\u00a0`);
        emitChange();
      },
      applyFormat,
      captureSelection: () => {
        const range = selectionRange();
        savedRangeRef.current = range ? range.cloneRange() : null;
        return range?.toString() ?? '';
      },
      insertLink: (text: string, url: string) => {
        const root = rootRef.current;
        if (!root) return;
        root.focus();
        const saved = savedRangeRef.current;
        const selection = window.getSelection();
        if (saved && inEditor(saved.commonAncestorContainer)) {
          selection?.removeAllRanges();
          selection?.addRange(saved);
        } else if (!selectionRange()) {
          placeCaret(root, root.childNodes.length);
        }
        exec('insertHTML', `<a href="${escapeHtml(url)}">${escapeHtml(text || url)}</a>\u200b`);
        savedRangeRef.current = null;
        emitChange();
      },
      refreshMentions: () => {
        rootRef.current?.querySelectorAll<HTMLElement>('[data-mention]').forEach((chip) => {
          const label = resolveRef.current(chip.dataset.mention ?? '');
          if (chip.textContent !== label) chip.textContent = label;
        });
      },
    }));

    // First render: show the initial Slack text.
    useEffect(() => {
      setValue(initialValue);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const onSelection = () => {
        if (document.activeElement === rootRef.current) reportState();
      };
      document.addEventListener('selectionchange', onSelection);
      return () => document.removeEventListener('selectionchange', onSelection);
    }, [reportState]);

    // Typing right after leaving inline code goes after the <code>.
    const onBeforeInput = (event: React.FormEvent<HTMLDivElement>) => {
      const native = event.nativeEvent as InputEvent;
      const code = exitCodeRef.current;
      if (!code || native.inputType !== 'insertText' || !native.data) return;
      exitCodeRef.current = null;
      const range = selectionRange();
      if (!range || !code.isConnected) return;
      const inside = code.contains(range.startContainer);
      const rightAfter =
        range.startContainer === code.nextSibling ||
        (range.startContainer === code.parentNode &&
          code.parentNode.childNodes[range.startOffset - 1] === code);
      if (!inside && !rightAfter) return;
      event.preventDefault();
      const next = code.nextSibling;
      if (next && next.nodeType === Node.TEXT_NODE && next !== range.startContainer) {
        next.textContent = native.data + (next.textContent ?? '');
        placeCaret(next, native.data.length);
      } else if (next && next === range.startContainer) {
        const text = next as Text;
        text.insertData(range.startOffset, native.data);
        placeCaret(text, range.startOffset + native.data.length);
      } else {
        caretAfter(code, native.data);
      }
      emitChange();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229) {
        return;
      }
      if (event.key === 'ArrowRight') {
        const range = selectionRange();
        const code = closest('code');
        if (
          range?.collapsed &&
          code &&
          !closest('pre') &&
          range.startContainer.nodeType === Node.TEXT_NODE &&
          range.startOffset === (range.startContainer.textContent ?? '').length &&
          range.startContainer === code.lastChild
        ) {
          exitCodeRef.current = code;
        }
        return;
      }
      if (event.key !== 'Shift') {
        exitCodeRef.current = null;
      }
      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        if (closest('pre')) {
          exec('insertText', '\n');
        } else {
          exec('insertParagraph');
        }
        emitChange();
      }
    };

    const insertPlain = (text: string) => {
      if (!text) return;
      exec('insertText', text.replace(/\r\n?/g, '\n'));
      emitChange();
    };

    const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length > 0) {
        onPasteFiles?.(files);
        return;
      }
      insertPlain(event.clipboardData.getData('text/plain'));
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
      if (event.dataTransfer.files.length > 0) {
        return; // the composer's drop zone uploads them
      }
      event.preventDefault();
      insertPlain(event.dataTransfer.getData('text/plain'));
    };

    return (
      <div
        ref={rootRef}
        className={[styles.editor, className].filter(Boolean).join(' ')}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        data-placeholder={placeholder}
        data-empty="true"
        spellCheck
        onInput={emitChange}
        onBeforeInput={onBeforeInput}
        onKeyDown={handleKeyDown}
        onKeyUp={reportState}
        onMouseUp={reportState}
        onPaste={onPaste}
        onDrop={onDrop}
        onBlur={onBlur}
      />
    );
  },
);

RichEditor.displayName = 'RichEditor';
