'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUnread } from '@/hooks/useUnread';
import { usePins } from '@/hooks/usePins';
import { useSaved } from '@/hooks/useSaved';
import { useFocusMessage } from '@/hooks/useFocusMessage';
import { formatFullTimestamp } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { MessageActions } from './MessageActions';
import { MessageContent } from './MessageContent';
import { HuddleSummary } from '@/components/huddle/HuddleSummary';
import { MessageEditor } from './editor/MessageEditor';
import { UserProfileTrigger } from '@/components/profile/UserProfileTrigger';
import { MessageAttachments } from './MessageAttachments';
import { DeleteMessageDialog } from './DeleteMessageDialog';
import { ReactionPill } from './ReactionPill';
import type { Message } from '@/types/message';
import type { ScrollAnchor } from '@/lib/chatCache';
import styles from './MessageList.module.css';

const GROUP_WINDOW_MS = 5 * 60 * 1000;
// Older pages auto-loaded to reach a focused (searched / linked) message.
const MAX_FOCUS_PAGES = 10;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const dayKey = (iso: string) => new Date(iso).toDateString();

const formatDay = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

// The topmost visible message and its offset from the list's top edge.
const readAnchor = (container: HTMLElement): ScrollAnchor => {
  const top = container.getBoundingClientRect().top;
  const rows = container.querySelectorAll<HTMLElement>('[data-message-id]');
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (rect.bottom > top) {
      return { messageId: row.dataset.messageId ?? '', offset: rect.top - top };
    }
  }
  return null;
};

// Scrolls so the anchored message sits at its recorded offset again.
const pinTo = (container: HTMLElement, anchor: NonNullable<ScrollAnchor>) => {
  const row = container.querySelector<HTMLElement>(`[data-message-id="${anchor.messageId}"]`);
  if (!row) return false;
  const top = container.getBoundingClientRect().top;
  container.scrollTop += row.getBoundingClientRect().top - top - anchor.offset;
  return true;
};

// Re-pinned for 3 frames while row heights settle (images, fonts).
const repin = (container: HTMLElement, anchor: NonNullable<ScrollAnchor>) => {
  if (!pinTo(container, anchor)) return false;
  let frames = 0;
  const step = () => {
    frames += 1;
    pinTo(container, anchor);
    if (frames < 3) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return true;
};

type MessageGroup = { id: string; sender: Message['sender']; items: Message[] };

const groupMessages = (messages: Message[], breakAfterId?: string): MessageGroup[] => {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    const previous = last?.items[last.items.length - 1];
    const sameAuthor =
      last &&
      previous?.id !== breakAfterId &&
      previous &&
      last.sender.id === message.sender.id &&
      dayKey(previous.createdAt) === dayKey(message.createdAt) &&
      new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
        GROUP_WINDOW_MS;

    if (sameAuthor) {
      last.items.push(message);
    } else {
      groups.push({ id: message.id, sender: message.sender, items: [message] });
    }
  }
  return groups;
};

export const MessageList = ({
  messages,
  loading,
  placeholder,
  targetKey,
  onReact,
  onEdit,
  onDelete,
  onMarkUnread,
  onOpenThread,
  autoScroll = true,
  compact = false,
  showDayDividers = true,
  fullTimestamps = false,
  hasOlder = false,
  loadingOlder = false,
  onLoadOlder,
  hasNewer = false,
  loadingNewer = false,
  onLoadNewer,
  onJumpToLatest,
  latestToken = 0,
  scrollMemory,
  canModerate = false,
  editRequest = 0,
  separatorAfter,
}: {
  messages: Message[];
  loading: boolean;
  placeholder?: React.ReactNode;
  targetKey?: string;
  onReact?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, content: string) => void | Promise<void>;
  onDelete?: (messageId: string) => void;
  onMarkUnread?: (messageId: string) => void;
  onOpenThread?: (messageId: string) => void;
  autoScroll?: boolean;
  compact?: boolean;
  showDayDividers?: boolean;
  fullTimestamps?: boolean;
  // History paging: older pages load when scrolled near the top.
  hasOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  // Bounded window: the newest messages were dropped (page back with ?after=).
  hasNewer?: boolean;
  loadingNewer?: boolean;
  onLoadNewer?: () => void;
  onJumpToLatest?: () => void;
  /** Changes when the window was replaced by the latest page -> bottom. */
  latestToken?: number;
  /** Remembers the reading position per chat (restored on revisit). */
  scrollMemory?: {
    get: (key: string) => ScrollAnchor;
    save: (key: string, anchor: ScrollAnchor) => void;
  };
  // Shows "Delete message" on other people's channel messages.
  canModerate?: boolean;
  /** Incremented to edit the viewer's last message (composer Up arrow). */
  editRequest?: number;
  /** Divider (e.g. "3 replies") after this message; it also ends its group. */
  separatorAfter?: { messageId: string; label: string };
}) => {
  const { user } = useAuth();
  const { marks } = useUnread();
  const { channelId: pinsChannelId, pinnedIds, togglePin } = usePins();
  const { savedIds, toggleSave } = useSaved();
  const { focus } = useFocusMessage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressScrollRef = useRef(false);

  // Explicit "mark as unread" shows the "New messages" divider. (There is no
  // automatic divider on opening a channel/DM - it was removed on request.)
  const unreadMark = targetKey ? marks[targetKey] : undefined;

  const focusId = focus?.id ?? null;
  const focusToken = focus?.token ?? 0;

  // Scroll behavior (Slack): opening a conversation lands on the latest
  // message; while you are scrolled up reading, new messages NEVER yank you
  // down - an arrow button appears instead, and clicking it jumps to the
  // latest. Typing indicators must not cause any scrolling.
  const [atBottom, setAtBottom] = useState(true);
  const [pendingNew, setPendingNew] = useState(0);
  const atBottomRef = useRef(true);
  const seenCountRef = useRef(0);
  const lastNewestIdRef = useRef<string | null>(null);
  const lastTargetRef = useRef<string | undefined>(undefined);
  const handledFocusRef = useRef<string | null>(null);
  const focusPagesRef = useRef<{ key: string | null; pages: number }>({ key: null, pages: 0 });
  // The reader's place is pinned to a message + offset (pageAnchorRef),
  // never to scrollHeight differences: the far end may be trimmed in the
  // same update that adds a page.
  const firstId = messages[0]?.id ?? null;
  const newestId = messages[messages.length - 1]?.id ?? null;
  const pageAnchorRef = useRef<ScrollAnchor>(null);
  const windowRef = useRef<{
    target?: string;
    firstId: string | null;
    newestId: string | null;
    hasNewer: boolean;
  }>({ firstId: null, newestId: null, hasNewer: false });
  // Set when newer messages were paged in (not live): no auto-scroll then.
  const pagedNewerRef = useRef(false);
  // The chat whose remembered position was handled (restored or not).
  const restoredRef = useRef<string | undefined>(undefined);

  const rememberAnchor = (element: HTMLDivElement) => {
    pageAnchorRef.current = readAnchor(element);
  };

  const maybeLoadOlder = (element: HTMLDivElement) => {
    if (element.scrollTop < 200 && hasOlder && !loadingOlder && onLoadOlder) {
      rememberAnchor(element);
      onLoadOlder();
    }
  };

  const maybeLoadNewer = (element: HTMLDivElement) => {
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distance < 200 && hasNewer && !loadingNewer && onLoadNewer) {
      rememberAnchor(element);
      onLoadNewer();
    }
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    // Within 80px of the bottom counts as "at the bottom" (never while the
    // newest messages are dropped from the window).
    const nearBottom =
      !hasNewer && element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    atBottomRef.current = nearBottom;
    setAtBottom(nearBottom);
    rememberAnchor(element);
    maybeLoadOlder(element);
    maybeLoadNewer(element);
    if (nearBottom) {
      seenCountRef.current = messages.length;
      setPendingNew(0);
    }
  };

  // Opening a chat: restore its remembered position before paint, if any.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !targetKey || !scrollMemory || restoredRef.current === targetKey) {
      return;
    }
    if (messages.length === 0) {
      return;
    }
    restoredRef.current = targetKey;
    const anchor = scrollMemory.get(targetKey);
    const restored = Boolean(anchor && repin(element, anchor));
    pageAnchorRef.current = restored ? anchor : null;
    atBottomRef.current = !restored;
    setAtBottom(!restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, messages.length]);

  // Leaving a chat: remember where the reader was (null = at the bottom).
  useLayoutEffect(() => {
    const key = targetKey;
    return () => {
      if (key && scrollMemory && restoredRef.current === key) {
        scrollMemory.save(key, atBottomRef.current ? null : pageAnchorRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  // Keep the reading position when a page is added at either end (and the
  // other end possibly trimmed in the same update).
  useLayoutEffect(() => {
    const element = scrollRef.current;
    const previous = windowRef.current;
    windowRef.current = { target: targetKey, firstId, newestId, hasNewer };
    if (!element || previous.target !== targetKey) {
      return;
    }
    const prepended = Boolean(previous.firstId) && firstId !== previous.firstId;
    const pagedNewer = previous.hasNewer && newestId !== previous.newestId;
    if (pagedNewer) {
      pagedNewerRef.current = true;
    }
    const anchor = pageAnchorRef.current;
    if (prepended && atBottomRef.current && !hasNewer) {
      // History added above a short list the reader sees from the bottom.
      element.scrollTop = element.scrollHeight;
    } else if ((prepended || pagedNewer) && !atBottomRef.current && anchor) {
      repin(element, anchor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstId, newestId, targetKey]);

  // The window was replaced by the latest page ("Jump to latest", sending
  // while scrolled back): land on the bottom.
  const lastLatestToken = useRef(latestToken);
  useLayoutEffect(() => {
    if (latestToken === lastLatestToken.current) {
      return;
    }
    lastLatestToken.current = latestToken;
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
    atBottomRef.current = true;
    setAtBottom(true);
    setPendingNew(0);
    seenCountRef.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestToken]);

  useEffect(() => {
    if (!autoScroll) {
      return;
    }
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const toBottom = () => {
      // Don't fight a "jump to message" that is in progress.
      if (suppressScrollRef.current) {
        return;
      }
      element.scrollTop = element.scrollHeight;
    };

    const isInitial = lastTargetRef.current !== targetKey;
    const previousNewest = lastNewestIdRef.current;
    lastTargetRef.current = targetKey;
    lastNewestIdRef.current = newestId;

    if (isInitial && restoredRef.current === targetKey && !atBottomRef.current) {
      // A remembered reading position was restored (revisit).
      seenCountRef.current = messages.length;
      setPendingNew(0);
      return;
    }

    if (isInitial) {
      // Opening (or switching to) a conversation lands on the latest.
      toBottom();
      seenCountRef.current = messages.length;
      setPendingNew(0);
      setAtBottom(true);
      atBottomRef.current = true;
      // Run again after layout/paint (and after images start loading).
      const raf = requestAnimationFrame(toBottom);
      const timer = setTimeout(toBottom, 120);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }

    // Only messages appended after the previous newest one are "new"
    // (prepended history pages are not).
    const previousIndex = previousNewest
      ? messages.findIndex((message) => message.id === previousNewest)
      : -1;
    const added = previousIndex === -1 ? messages : messages.slice(previousIndex + 1);
    if (added.length === 0 || (previousIndex === -1 && previousNewest)) {
      return;
    }
    // A page of newer history (not live messages): the anchor holds the place.
    if (pagedNewerRef.current) {
      pagedNewerRef.current = false;
      return;
    }

    // Sending your own message always brings you to it (like Slack);
    // otherwise only follow the conversation when already at the bottom.
    const ownMessage = added.some((message) => message.sender.id === user?.id);

    if (ownMessage || atBottomRef.current) {
      toBottom();
      seenCountRef.current = messages.length;
      setPendingNew(0);
    } else {
      // Keep the reader where they are; surface the new messages via the
      // arrow button.
      setPendingNew((count) => count + added.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll, targetKey, newestId, user?.id]);

  // A short first page may not fill the view: keep loading until it scrolls.
  useEffect(() => {
    const element = scrollRef.current;
    if (element && element.scrollHeight <= element.clientHeight) {
      maybeLoadOlder(element);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstId, hasOlder, loadingOlder]);

  // Scroll to (and briefly highlight) a focused message - used by the channel
  // Pinned list and by deep links (?message=<id>).
  useEffect(() => {
    // Each focus request is handled once (no replay on new messages).
    const focusKey = focusId ? `${focusId}:${focusToken}` : null;
    if (!focusId || handledFocusRef.current === focusKey) {
      return;
    }
    const container = scrollRef.current;
    const element = container?.querySelector<HTMLElement>(`[data-message-id="${focusId}"]`);
    if (!element) {
      // Search results / deep links may point at older history: page back
      // (at most MAX_FOCUS_PAGES pages per focus request) to reach it.
      if (focusPagesRef.current.key !== focusKey) {
        focusPagesRef.current = { key: focusKey, pages: 0 };
      }
      if (
        hasOlder &&
        !loadingOlder &&
        onLoadOlder &&
        focusPagesRef.current.pages < MAX_FOCUS_PAGES
      ) {
        focusPagesRef.current.pages += 1;
        onLoadOlder();
      }
      return;
    }
    handledFocusRef.current = focusKey;
    suppressScrollRef.current = true;
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlashId(focusId);
    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
    }
    flashTimer.current = setTimeout(() => setFlashId(null), 2200);
    const release = setTimeout(() => {
      suppressScrollRef.current = false;
    }, 600);
    return () => clearTimeout(release);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, focusToken, messages.length, hasOlder, loadingOlder]);

  useEffect(
    () => () => {
      if (flashTimer.current) {
        clearTimeout(flashTimer.current);
      }
    },
    [],
  );

  const startEdit = (message: Message) => {
    setEditingId(message.id);
    setEditError('');
  };

  // Composer Up arrow: edit the newest message I sent that still has text.
  const lastEditRequest = useRef(editRequest);
  useEffect(() => {
    if (editRequest === lastEditRequest.current || !onEdit) {
      return;
    }
    lastEditRequest.current = editRequest;
    const mine = [...messages]
      .reverse()
      .find((message) => message.sender.id === user?.id && !message.deletedAt && message.content);
    if (!mine) {
      return;
    }
    setEditingId(mine.id);
    setEditError('');
    scrollRef.current
      ?.querySelector(`[data-message-id="${mine.id}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [editRequest, messages, onEdit, user?.id]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const saveEdit = async (messageId: string, content: string) => {
    if (!onEdit) {
      return;
    }
    if (content.trim() === '' || saving) {
      return;
    }
    setSaving(true);
    try {
      await onEdit(messageId, content);
      setEditingId(null);
      setEditError('');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save the edit');
    } finally {
      setSaving(false);
    }
  };

  // Deleted roots that still have replies stay as placeholders.
  const visible = messages.filter(
    (message) => !message.deletedAt || (!message.parentMessageId && message.replyCount > 0),
  );
  const groups = groupMessages(visible, separatorAfter?.messageId);

  return (
    <>
      <div className={styles.listWrap}>
        <div
          className={`${styles.scroll} ${compact ? styles.scrollCompact : ''}`}
          ref={scrollRef}
          onScroll={handleScroll}
        >
          {visible.length > 0 && (hasOlder || loadingOlder) && onLoadOlder && (
            <div className={styles.older}>
              {loadingOlder ? (
                <Spinner />
              ) : (
                <button type="button" className={styles.olderButton} onClick={onLoadOlder}>
                  Load older messages
                </button>
              )}
            </div>
          )}

          {loading && visible.length === 0 && (
            <div className={styles.center}>
              <Spinner />
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div className={styles.center}>
              {placeholder ?? <p className={styles.empty}>No messages yet. Say hello.</p>}
            </div>
          )}

          {groups.map((group, index) => {
            const previousGroup = groups[index - 1];
            const showDay =
              index === 0 ||
              dayKey(group.items[0].createdAt) !==
                dayKey(previousGroup.items[previousGroup.items.length - 1].createdAt);
            const isOwn = group.sender.id === user?.id;

            return (
              <div key={group.id} className={styles.group}>
                {showDayDividers && showDay && (
                  <div className={styles.day}>
                    <span>{formatDay(group.items[0].createdAt)}</span>
                  </div>
                )}

                {group.items.map((message, itemIndex) => {
                  const first = itemIndex === 0;
                  const isDeleted = Boolean(message.deletedAt);
                  const pinned = pinnedIds.has(message.id);

                  return (
                    <div key={message.id} data-message-id={message.id}>
                      {unreadMark === message.id && (
                        <div className={styles.unread}>
                          <span>New messages</span>
                        </div>
                      )}

                      <div
                        className={`${styles.row} ${first ? '' : styles.cont} ${flashId === message.id ? styles.flash : ''}`}
                      >
                        <div className={styles.avatarCol}>
                          {first ? (
                            <UserProfileTrigger user={group.sender}>
                              <Avatar
                                name={group.sender.fullName}
                                src={group.sender.avatarUrl}
                                size={compact ? 26 : 36}
                              />
                            </UserProfileTrigger>
                          ) : (
                            <span className={styles.hoverTime}>
                              {formatTime(message.createdAt)}
                            </span>
                          )}
                        </div>

                        <div className={styles.stack}>
                          {first && (
                            <div className={styles.meta}>
                              <UserProfileTrigger user={group.sender}>
                                <span className={styles.name}>{group.sender.fullName}</span>
                              </UserProfileTrigger>
                              <span className={styles.dot}>•</span>
                              <span className={styles.time}>
                                {fullTimestamps
                                  ? formatFullTimestamp(group.items[0].createdAt)
                                  : formatTime(group.items[0].createdAt)}
                              </span>
                            </div>
                          )}

                          {pinned && (
                            <span className={styles.pinBadge}>
                              <Icon name="pin" size={11} /> Pinned
                            </span>
                          )}

                          {editingId === message.id ? (
                            <MessageEditor
                              message={message}
                              saving={saving}
                              error={editError}
                              onSave={(content) => void saveEdit(message.id, content)}
                              onCancel={cancelEdit}
                            />
                          ) : (
                            <div className={styles.bubble}>
                              {isDeleted ? (
                                <em className={styles.deleted}>This message was deleted.</em>
                              ) : message.huddleId ? (
                                <HuddleSummary message={message} />
                              ) : (
                                <>
                                  <MessageContent
                                    content={message.content}
                                    mentions={message.mentions}
                                    senderId={message.sender.id}
                                  />
                                  <MessageAttachments
                                    attachments={message.attachments}
                                    compact={compact}
                                  />
                                </>
                              )}
                              {!isDeleted && message.editedAt && (
                                <span className={styles.edited}> (edited)</span>
                              )}
                            </div>
                          )}

                          {!isDeleted && message.reactions.length > 0 && (
                            <div className={styles.reactions}>
                              {message.reactions.map((reaction) => (
                                <ReactionPill
                                  key={reaction.emoji}
                                  reaction={reaction}
                                  onToggle={() => onReact?.(message.id, reaction.emoji)}
                                  tooltip={!compact}
                                />
                              ))}
                            </div>
                          )}

                          {message.replyCount > 0 && onOpenThread && !message.parentMessageId && (
                            <button
                              type="button"
                              className={styles.threadLink}
                              onClick={() => onOpenThread(message.id)}
                            >
                              {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
                            </button>
                          )}
                        </div>

                        {!isDeleted && onReact && !compact && editingId !== message.id && (
                          <div className={styles.actions}>
                            <MessageActions
                              message={message}
                              // Huddle cards are not editable.
                              isOwn={isOwn && !message.huddleId}
                              canModerate={canModerate}
                              onReact={(emoji) => onReact(message.id, emoji)}
                              onEdit={() => startEdit(message)}
                              onDelete={() => setDeleteTarget(message)}
                              onMarkUnread={() => onMarkUnread?.(message.id)}
                              onReplyInThread={
                                onOpenThread ? () => onOpenThread(message.id) : undefined
                              }
                              pinned={pinned}
                              onTogglePin={
                                pinsChannelId ? () => void togglePin(message.id) : undefined
                              }
                              saved={savedIds.has(message.id)}
                              onToggleSave={() => void toggleSave(message.id)}
                            />
                          </div>
                        )}
                      </div>
                      {separatorAfter?.messageId === message.id && (
                        <div className={styles.separator}>
                          <span>{separatorAfter.label}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {visible.length > 0 && (hasNewer || loadingNewer) && onLoadNewer && (
            <div className={styles.older}>
              {loadingNewer ? (
                <Spinner />
              ) : (
                <button type="button" className={styles.olderButton} onClick={onLoadNewer}>
                  Load newer messages
                </button>
              )}
            </div>
          )}
        </div>

        {!compact && ((!atBottom && pendingNew > 0) || (hasNewer && onJumpToLatest)) && (
          <button
            type="button"
            className={styles.jumpButton}
            onClick={() => {
              if (hasNewer && onJumpToLatest) {
                onJumpToLatest();
                return;
              }
              const element = scrollRef.current;
              if (element) {
                element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
              }
              setPendingNew(0);
              seenCountRef.current = messages.length;
              setAtBottom(true);
              atBottomRef.current = true;
            }}
            aria-label="Jump to latest message"
            title="Jump to latest message"
          >
            <Icon name="chevron-down" size={18} />
          </button>
        )}
      </div>

      <DeleteMessageDialog
        open={Boolean(deleteTarget)}
        message={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDelete?.(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
      />
    </>
  );
};
