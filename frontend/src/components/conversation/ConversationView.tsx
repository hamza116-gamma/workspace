'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { HuddleJoinBar } from '@/components/huddle/HuddleJoinBar';
import { useMessages, type MessageTarget } from '@/hooks/useMessages';
import { useMentionables } from '@/hooks/useMentionables';
import { useUnread } from '@/hooks/useUnread';
import { useThreadPanel } from '@/hooks/useThreadPanel';
import { chatScrollMemory } from '@/lib/chatCache';
import styles from './ConversationView.module.css';

export const ConversationView = ({
  target,
  header,
  banner,
  placeholder,
  panel,
  canSend = true,
  composerPlaceholder,
  allowChannelMention = false,
  canModerate = false,
}: {
  target: MessageTarget | null;
  header: React.ReactNode;
  banner?: React.ReactNode;
  placeholder?: React.ReactNode;
  panel?: React.ReactNode;
  canSend?: boolean;
  composerPlaceholder?: string;
  allowChannelMention?: boolean;
  canModerate?: boolean;
}) => {
  const {
    messages,
    loading,
    error,
    hasOlder,
    hasNewer,
    loadingOlder,
    loadingNewer,
    loadOlder,
    loadNewer,
    jumpToLatest,
    latestToken,
    typingUsers,
    recordingUsers,
    send,
    edit,
    remove,
    react,
    setTyping,
  } = useMessages(target);
  const { mark } = useUnread();
  const { openThread } = useThreadPanel();
  const mentionables = useMentionables(target);
  const targetKey = target ? `${target.kind}:${target.id}` : undefined;
  // Up arrow in an empty composer -> MessageList edits your last message.
  const [editRequest, setEditRequest] = useState(0);

  return (
    <div className={styles.workspace}>
      {header}
      {banner}
      <HuddleJoinBar target={target} />
      {error && (
        <div className={styles.alertWrap}>
          <Alert>{error}</Alert>
        </div>
      )}
      {panel ? (
        <div className={styles.panelBody}>{panel}</div>
      ) : (
        <>
          <MessageList
            messages={messages}
            loading={loading}
            placeholder={placeholder}
            targetKey={targetKey}
            onReact={react}
            onEdit={edit}
            onDelete={remove}
            onMarkUnread={(messageId) => targetKey && mark(targetKey, messageId)}
            onOpenThread={openThread}
            hasOlder={hasOlder}
            loadingOlder={loadingOlder}
            onLoadOlder={() => void loadOlder()}
            hasNewer={hasNewer}
            loadingNewer={loadingNewer}
            onLoadNewer={() => void loadNewer()}
            onJumpToLatest={() => void jumpToLatest()}
            latestToken={latestToken}
            scrollMemory={chatScrollMemory}
            canModerate={canModerate}
            editRequest={editRequest}
          />
          <TypingIndicator users={typingUsers} recording={recordingUsers} />
          <MessageComposer
            disabled={!canSend}
            placeholder={composerPlaceholder}
            mentionables={mentionables}
            allowChannelMention={allowChannelMention}
            onSend={send}
            onTyping={setTyping}
            onEditLast={() => setEditRequest((value) => value + 1)}
            scheduleTarget={target ? { kind: target.kind, id: target.id } : null}
            draftTarget={
              target
                ? target.kind === 'channel'
                  ? { channelId: target.id }
                  : { conversationId: target.id }
                : null
            }
          />
        </>
      )}
    </div>
  );
};
