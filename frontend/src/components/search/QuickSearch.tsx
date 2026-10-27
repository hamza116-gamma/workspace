'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useChannels } from '@/hooks/useChannels';
import { useConversations } from '@/hooks/useConversations';
import { useFocusMessage } from '@/hooks/useFocusMessage';
import { searchWorkspace, messageHref } from '@/lib/search';
import { createConversation } from '@/lib/conversations';
import { tokensToDisplay } from '@/lib/mentions';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import type { SearchResult } from '@/types/search';
import styles from './QuickSearch.module.css';

// Open from anywhere: Ctrl/⌘+K, or window.dispatchEvent(new Event(OPEN_QUICK_SEARCH)).
export const OPEN_QUICK_SEARCH = 'quick-search:open';

const DEBOUNCE_MS = 200;
const PER_GROUP = 4;

type Item = {
  key: string;
  group: string;
  icon?: IconName;
  avatar?: { name: string; src: string | null };
  title: string;
  meta?: string;
  run: () => void | Promise<void>;
};

/** Ctrl+K quick search: jump to chats, people, tasks and messages. */
export const QuickSearch = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { channels } = useChannels();
  const { conversations } = useConversations();
  const { focusMessage } = useFocusMessage();
  const { statusOf } = useTaskStatuses();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  // Ctrl/⌘+K toggles; the sidebar button sends OPEN_QUICK_SEARCH.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_QUICK_SEARCH, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_QUICK_SEARCH, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResult(null);
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Live results (debounced; stale responses are ignored).
  useEffect(() => {
    const term = query.trim();
    if (!open || !term) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;
    const timer = setTimeout(() => {
      searchWorkspace(term, 'all').then(
        (next) => {
          if (alive) {
            setResult(next);
            setLoading(false);
            setActive(0);
          }
        },
        () => alive && setLoading(false),
      );
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, open]);

  const close = () => setOpen(false);
  const go = (href: string) => {
    close();
    router.push(href);
  };

  const dmTitle = (participants: { user: { id: string; fullName: string } }[]) =>
    participants
      .filter((participant) => participant.user.id !== user?.id)
      .map((participant) => participant.user.fullName)
      .join(', ') || 'Just you';

  const items = useMemo<Item[]>(() => {
    const term = query.trim().toLowerCase();
    const list: Item[] = [];

    if (!term) {
      // Nothing typed: recent chats.
      const recentDms = [...conversations]
        .sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))
        .slice(0, 4);
      channels
        .filter((channel) => channel.isMember)
        .slice(0, 5)
        .forEach((channel) =>
          list.push({
            key: `c-${channel.id}`,
            group: 'Jump to',
            icon: channel.type === 'PRIVATE' ? 'lock' : 'hash',
            title: channel.name,
            run: () => go(`/channels/${channel.id}`),
          }),
        );
      recentDms.forEach((conversation) =>
        list.push({
          key: `d-${conversation.id}`,
          group: 'Jump to',
          icon: 'message',
          title: dmTitle(conversation.participants),
          meta: 'Direct message',
          run: () => go(`/dm/${conversation.id}`),
        }),
      );
      list.push({
        key: 'my-tasks',
        group: 'Shortcuts',
        icon: 'task',
        title: 'My tasks',
        run: () => go('/tasks'),
      });
      return list;
    }

    // Channels match instantly from the local list; the rest come from search.
    channels
      .filter((channel) => channel.name.toLowerCase().includes(term))
      .slice(0, PER_GROUP)
      .forEach((channel) =>
        list.push({
          key: `c-${channel.id}`,
          group: 'Channels',
          icon: channel.type === 'PRIVATE' ? 'lock' : 'hash',
          title: channel.name,
          meta: channel.isMember ? undefined : 'Not joined',
          run: () => go(`/channels/${channel.id}`),
        }),
      );

    (result?.people.items ?? []).slice(0, PER_GROUP).forEach((person) =>
      list.push({
        key: `p-${person.id}`,
        group: 'People',
        avatar: { name: person.fullName, src: person.avatarUrl },
        title: person.fullName,
        meta: person.jobTitle || person.email,
        run: async () => {
          if (person.id === user?.id) {
            go('/profile');
            return;
          }
          const { conversation } = await createConversation([person.id]);
          go(`/dm/${conversation.id}`);
        },
      }),
    );

    (result?.tasks?.items ?? []).slice(0, PER_GROUP).forEach((task) =>
      list.push({
        key: `t-${task.id}`,
        group: 'Tasks',
        icon: 'task',
        title: `${task.key} · ${task.title}`,
        meta: statusOf(task).name,
        run: () => {
          focusMessage(task.messageId);
          go(messageHref(task, task.messageId));
        },
      }),
    );

    (result?.messages.items ?? []).slice(0, 3).forEach((message) =>
      list.push({
        key: `m-${message.id}`,
        group: 'Messages',
        avatar: { name: message.sender.fullName, src: message.sender.avatarUrl },
        title: tokensToDisplay(message.content, message.mentions) || 'Attachment',
        meta: `${message.sender.fullName} · ${message.location.kind === 'channel' ? '#' : ''}${message.location.name}`,
        run: () => {
          const rootId = message.parentMessageId ?? message.id;
          focusMessage(rootId);
          go(messageHref(message, rootId));
        },
      }),
    );

    list.push({
      key: 'all',
      group: 'Search',
      icon: 'search',
      title: `Search all results for “${query.trim()}”`,
      meta: 'Messages, files, filters…',
      run: () => go(`/search?q=${encodeURIComponent(query.trim())}`),
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, result, channels, conversations, user?.id, statusOf]);

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) {
    return null;
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void items[active]?.run();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  let lastGroup = '';

  return (
    <div className={styles.overlay} onMouseDown={close}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Quick search"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className={styles.inputRow}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search channels, people, tasks and messages…"
            aria-label="Quick search"
            aria-activedescendant={items[active] ? `qs-${items[active].key}` : undefined}
          />
          {loading && <span className={styles.spinner} aria-hidden />}
          <kbd className={styles.kbd}>Esc</kbd>
        </div>

        <div ref={listRef} className={styles.list} role="listbox">
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {header && <div className={styles.group}>{header}</div>}
                <button
                  id={`qs-${item.key}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  className={`${styles.item} ${index === active ? styles.active : ''}`}
                  onMouseMove={() => setActive(index)}
                  onClick={() => void item.run()}
                >
                  <span className={styles.itemIcon}>
                    {item.avatar ? (
                      <Avatar name={item.avatar.name} src={item.avatar.src} size={24} />
                    ) : (
                      <Icon name={item.icon ?? 'search'} size={15} />
                    )}
                  </span>
                  <span className={styles.itemText}>
                    <span className={styles.itemTitle}>{item.title}</span>
                    {item.meta && <span className={styles.itemMeta}>{item.meta}</span>}
                  </span>
                  {index === active && <span className={styles.enter}>↵</span>}
                </button>
              </div>
            );
          })}
          {query.trim() && !loading && items.length === 1 && (
            <p className={styles.none}>No quick matches. Try the full search.</p>
          )}
        </div>

        <div className={styles.footer}>
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
          <span>
            <kbd>Ctrl</kbd> <kbd>K</kbd> to toggle
          </span>
        </div>
      </div>
    </div>
  );
};
