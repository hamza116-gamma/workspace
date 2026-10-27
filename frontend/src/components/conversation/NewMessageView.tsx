'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useChannels } from '@/hooks/useChannels';
import { useConversations } from '@/hooks/useConversations';
import { useMessages } from '@/hooks/useMessages';
import { useUnread } from '@/hooks/useUnread';
import {
  createConversation,
  findConversation,
  listConversationCandidates,
} from '@/lib/conversations';
import { sendConversationMessage } from '@/lib/messages';
import { Avatar } from '@/components/ui/Avatar';
import { Alert } from '@/components/ui/Alert';
import { Icon } from '@/components/ui/Icon';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import type { Conversation } from '@/types/conversation';
import type { PendingAttachment } from '@/types/message';
import type { User } from '@/types/user';
import styles from './NewMessageView.module.css';

export const NewMessageView = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { channels } = useChannels();
  const { refresh: refreshDms } = useConversations();

  const [candidates, setCandidates] = useState<User[]>([]);
  const [recipients, setRecipients] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resolved, setResolved] = useState<Conversation | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listConversationCandidates()
      .then((result) => setCandidates(result.candidates.map((candidate) => candidate.user)))
      .catch(() => setCandidates([]));
  }, []);

  const recipientIds = recipients.map((recipient) => recipient.id);
  const recipientKey = [...recipientIds].sort().join(',');

  useEffect(() => {
    if (recipientIds.length === 0) {
      setResolved(null);
      return;
    }
    let active = true;
    findConversation(recipientIds)
      .then((result) => {
        if (active) {
          setResolved(result.conversation);
        }
      })
      .catch(() => {
        if (active) {
          setResolved(null);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientKey]);

  const target = resolved ? { kind: 'conversation' as const, id: resolved.id } : null;
  const { messages, loading, typingUsers, recordingUsers, edit, remove, react, setTyping } =
    useMessages(target);
  const { mark } = useUnread();
  const targetKey = target ? `conversation:${target.id}` : undefined;

  const selectedIds = useMemo(() => new Set(recipientIds), [recipientKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const term = query.trim().toLowerCase();

  const people = candidates
    .filter((candidate) => !selectedIds.has(candidate.id))
    .filter(
      (candidate) =>
        !term ||
        candidate.fullName.toLowerCase().includes(term) ||
        candidate.email.toLowerCase().includes(term),
    )
    .slice(0, 8);

  const channelResults = channels
    .filter((channel) => !term || channel.name.toLowerCase().includes(term))
    .slice(0, 6);

  const names = recipients.map((recipient) => recipient.fullName).join(', ');
  const composerPlaceholder = recipients.length === 0 ? 'Message' : `Message ${names}`;

  const addRecipient = (candidate: User) => {
    setRecipients((current) =>
      current.some((item) => item.id === candidate.id) ? current : [...current, candidate],
    );
    setQuery('');
    inputRef.current?.focus();
  };

  const removeRecipient = (userId: string) =>
    setRecipients((current) => current.filter((item) => item.id !== userId));

  const handleSend = async (content: string, attachments: PendingAttachment[]) => {
    if (recipients.length === 0) {
      return;
    }
    setError('');
    let conversation = resolved;
    if (!conversation) {
      const created = await createConversation(recipientIds);
      conversation = created.conversation;
    }
    await sendConversationMessage(conversation.id, content, {
      ...(attachments.length ? { attachments } : {}),
    });
    await refreshDms();
    router.replace(`/dm/${conversation.id}`);
  };

  const placeholder =
    recipients.length === 0 ? (
      <p className={styles.empty}>Search for people to start a conversation.</p>
    ) : (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>
          <Icon name="message" size={24} />
        </span>
        <h2 className={styles.emptyTitle}>{names}</h2>
        <p className={styles.emptyText}>This is the beginning of your conversation with {names}.</p>
      </div>
    );

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <h1 className={styles.title}>New message</h1>

        <div className={styles.toRow}>
          <span className={styles.toLabel}>To:</span>
          <div className={styles.inputWrap}>
            {recipients.map((recipient) => (
              <span key={recipient.id} className={styles.chip}>
                <Avatar name={recipient.fullName} src={recipient.avatarUrl} size={18} />
                {recipient.fullName}
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => removeRecipient(recipient.id)}
                  aria-label={`Remove ${recipient.fullName}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              className={styles.input}
              placeholder={recipients.length === 0 ? 'Search people' : ''}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) {
                  setPickerOpen(false);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Backspace' && query === '' && recipients.length > 0) {
                  setRecipients((current) => current.slice(0, -1));
                }
                if (event.key === 'Escape') {
                  setPickerOpen(false);
                }
              }}
            />
          </div>
        </div>

        {pickerOpen && (people.length > 0 || channelResults.length > 0) && (
          <div className={styles.results} onMouseDown={(event) => event.preventDefault()}>
            {people.length > 0 && (
              <>
                <p className={styles.groupLabel}>People</p>
                {people.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={styles.result}
                    onClick={() => addRecipient(candidate)}
                  >
                    <Avatar name={candidate.fullName} src={candidate.avatarUrl} size={28} />
                    <span className={styles.resultName}>{candidate.fullName}</span>
                    <span className={styles.resultMeta}>{candidate.email}</span>
                  </button>
                ))}
              </>
            )}
            {channelResults.length > 0 && (
              <>
                <p className={styles.groupLabel}>Channels</p>
                {channelResults.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    className={styles.result}
                    onClick={() => router.push(`/channels/${channel.id}`)}
                  >
                    <span className={styles.channelIcon}>
                      <Icon name={channel.type === 'PRIVATE' ? 'lock' : 'hash'} size={15} />
                    </span>
                    <span className={styles.resultName}>{channel.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </header>

      {error && (
        <div className={styles.alertWrap}>
          <Alert>{error}</Alert>
        </div>
      )}

      <MessageList
        messages={messages}
        loading={loading && Boolean(resolved)}
        placeholder={placeholder}
        targetKey={targetKey}
        onReact={react}
        onEdit={edit}
        onDelete={remove}
        onMarkUnread={(messageId) => targetKey && mark(targetKey, messageId)}
      />

      <TypingIndicator users={typingUsers} recording={recordingUsers} />
      <MessageComposer
        disabled={recipients.length === 0}
        placeholder={composerPlaceholder}
        mentionables={recipients}
        onSend={handleSend}
        onTyping={setTyping}
      />
    </div>
  );
};
