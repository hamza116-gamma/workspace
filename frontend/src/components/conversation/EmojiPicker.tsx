'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Popover } from '@/components/ui/Popover';
import { EMOJI_CATEGORIES, loadRecentEmoji, rememberEmoji, searchEmoji } from '@/lib/emojiData';
import styles from './EmojiPicker.module.css';

/** Emoji button + picker: search, categories, recently used; closes on outside click / Esc. */
export const EmojiPicker = ({
  onSelect,
  label = 'Add reaction',
  triggerClassName,
}: {
  onSelect: (emoji: string) => void;
  label?: string;
  triggerClassName?: string;
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(EMOJI_CATEGORIES[0].id);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setRecent(loadRecentEmoji());
    setQuery('');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !ref.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const shown = useMemo(() => {
    if (query.trim()) return searchEmoji(query).map((entry) => entry.emoji);
    return (
      EMOJI_CATEGORIES.find((item) => item.id === category) ?? EMOJI_CATEGORIES[0]
    ).emojis.map((entry) => entry.emoji);
  }, [query, category]);

  const pick = (emoji: string) => {
    setRecent(rememberEmoji(emoji));
    onSelect(emoji);
    setOpen(false);
  };

  const renderGrid = (list: string[]) => (
    <div className={styles.grid}>
      {list.map((emoji) => (
        <button key={emoji} type="button" className={styles.emoji} onClick={() => pick(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={triggerClassName ?? styles.trigger}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        title={label}
      >
        <Icon name="smile" size={16} />
      </button>
      <Popover open={open} anchorRef={ref} align="right" panelClassName={styles.panel}>
        <div ref={panelRef}>
          <input
            className={styles.search}
            type="search"
            placeholder="Search emoji"
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search emoji"
          />
          {!query.trim() && (
            <div className={styles.tabs} role="tablist">
              {EMOJI_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={category === item.id}
                  className={`${styles.tab} ${category === item.id ? styles.tabActive : ''}`}
                  onClick={() => setCategory(item.id)}
                  title={item.label}
                >
                  {item.emojis[0].emoji}
                </button>
              ))}
            </div>
          )}
          {!query.trim() && recent.length > 0 && (
            <>
              <p className={styles.heading}>Recently used</p>
              {renderGrid(recent)}
            </>
          )}
          <p className={styles.heading}>
            {query.trim()
              ? 'Results'
              : EMOJI_CATEGORIES.find((item) => item.id === category)?.label}
          </p>
          {shown.length > 0 ? renderGrid(shown) : <p className={styles.none}>No emoji found</p>}
        </div>
      </Popover>
    </>
  );
};
