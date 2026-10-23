'use client';

import { prefetchChat } from '@/lib/chatCache';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuickSwitcherItems, type SwitcherItem } from '@/hooks/useQuickSwitcherItems';
import { createConversation } from '@/lib/conversations';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import styles from './QuickSwitcher.module.css';

/** Ctrl/Cmd+K "Jump to": channels, DMs, people, recent; arrows + Enter. */
export const QuickSwitcher = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const items = useQuickSwitcherItems(open, query);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setError('');
    }
  }, [open]);

  useEffect(() => {
    setSelected((current) => Math.min(current, Math.max(items.length - 1, 0)));
  }, [items.length]);

  // Prefetch the highlighted chat so Enter feels instant.
  const highlighted = items[selected];
  useEffect(() => {
    if (open && highlighted?.href) {
      router.prefetch(highlighted.href);
      // Also warm the chat cache (header + latest messages).
      const match = /^\/(channels|dm)\/([^/?]+)$/.exec(highlighted.href);
      if (match) void prefetchChat(match[1] === 'dm' ? 'conversation' : 'channel', match[2]);
    }
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, highlighted?.href, selected, router]);

  if (!open) {
    return null;
  }

  const choose = async (item: SwitcherItem | undefined) => {
    if (!item) return;
    try {
      if (item.href) {
        router.push(item.href);
      } else if (item.userId) {
        const { conversation } = await createConversation([item.userId]);
        router.push(`/dm/${conversation.id}`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open this conversation');
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((current) => (items.length ? (current + 1) % items.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((current) => (items.length ? (current - 1 + items.length) % items.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void choose(items[selected]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        className={styles.cmd}
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.inputRow}>
          <Icon name="search" size={16} />
          <input
            className={styles.input}
            autoFocus
            value={query}
            placeholder="Jump to a channel, conversation or person…"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="quick-switcher-list"
            aria-activedescendant={highlighted ? `qs-${selected}` : undefined}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.list} id="quick-switcher-list" role="listbox" ref={listRef}>
          {items.length === 0 && <p className={styles.empty}>No matches for “{query}”.</p>}
          {items.map((item, index) => (
            <div key={item.key}>
              {(index === 0 || items[index - 1].group !== item.group) && (
                <div className={styles.group}>{item.group}</div>
              )}
              <div
                id={`qs-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === selected}
                className={`${styles.item} ${index === selected ? styles.sel : ''}`}
                onMouseMove={() => setSelected(index)}
                onClick={() => void choose(item)}
              >
                {item.user ? (
                  <Avatar name={item.user.fullName} src={item.user.avatarUrl} size={22} />
                ) : (
                  <span className={styles.icon}>
                    <Icon name={item.icon} size={14} />
                  </span>
                )}
                <span className={styles.label}>{item.label}</span>
                {item.hint && <span className={styles.meta}>{item.hint}</span>}
                {index === selected && <span className={styles.hint}>Enter</span>}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.footer}>
          <span>
            <kbd className={styles.kbd}>↑</kbd> <kbd className={styles.kbd}>↓</kbd> to navigate
          </span>
          <span>
            <kbd className={styles.kbd}>Enter</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
};
