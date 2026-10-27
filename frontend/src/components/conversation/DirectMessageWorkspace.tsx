'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { useConversations } from '@/hooks/useConversations';
import { useActiveConversation } from '@/hooks/useActiveConversation';
import { useAttachments } from '@/hooks/useAttachments';
import { useLinks } from '@/hooks/useLinks';
import { useUnread } from '@/hooks/useUnread';
import { useWorkspaceUi } from '@/hooks/useWorkspaceUi';
import { useConversationMute } from '@/hooks/useConversationMute';
import { addConversationParticipants } from '@/lib/conversations';
import { peekConversation } from '@/lib/chatCache';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import type { MenuItem } from '@/components/ui/DropdownMenu';
import { MemberFacepile } from './MemberFacepile';
import { HuddleStartButton } from '@/components/huddle/HuddleStartButton';
import { ConversationView } from './ConversationView';
import { ConversationHeader, type ConversationTab } from './ConversationHeader';
import { useFocusMessage } from '@/hooks/useFocusMessage';
import { TasksBoard } from '@/components/tasks/TasksBoard';
import { FilesLinks } from './FilesLinks';
import headerStyles from './ConversationHeader.module.css';
import { MemberPickerDialog } from './MemberPickerDialog';
import type { PresenceState } from '@/types/user';
import styles from './DirectMessageWorkspace.module.css';

const PRESENCE_LABEL: Record<PresenceState, string> = {
  ACTIVE: 'Active',
  AWAY: 'Away',
  DND: 'Do not disturb',
  OFFLINE: 'Offline',
};

export const DirectMessageWorkspace = ({ conversationId }: { conversationId: string }) => {
  const { user } = useAuth();
  const router = useRouter();
  const presence = usePresence();
  const { refresh } = useConversations();
  const { toggleDetails } = useWorkspaceUi();
  const { markConversationRead } = useUnread();
  const active_ = useActiveConversation();
  const { load, clear } = active_;
  // Shown at once from memory on a revisit (or from the sidebar list), then
  // refreshed in the background; never another conversation's data.
  const conversation =
    active_.conversation?.id === conversationId
      ? active_.conversation
      : active_.targetId === conversationId && active_.error
        ? null
        : (peekConversation(conversationId) ?? null);
  const error = active_.targetId === conversationId ? active_.error : '';
  const { attachments, loading: filesLoading } = useAttachments(
    conversation ? { kind: 'conversation', id: conversation.id } : null,
  );
  const { links, loading: linksLoading } = useLinks(
    conversation ? { kind: 'conversation', id: conversation.id } : null,
  );
  const [addOpen, setAddOpen] = useState(false);
  const { isMuted, setMuted } = useConversationMute();
  const [tab, setTab] = useState<'messages' | 'files' | 'links' | 'tasks'>('messages');
  const { focusMessage } = useFocusMessage();
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    load(conversationId);
    return () => clear();
  }, [conversationId, load, clear]);

  const others = useMemo(
    () =>
      (conversation?.participants ?? [])
        .filter((participant) => participant.user.id !== user?.id)
        .map((participant) => participant.user),
    [conversation, user?.id],
  );

  const title = useMemo(() => {
    if (!conversation) {
      return 'Direct message';
    }
    if (conversation.type === 'GROUP') {
      return others.map((other) => other.fullName).join(', ');
    }
    return others[0]?.fullName ?? 'Direct message';
  }, [conversation, others]);

  // Opening the DM marks it read (Slack behavior).
  useEffect(() => {
    if (!conversation) {
      return;
    }
    if (markedRef.current === conversation.id) {
      return;
    }
    markedRef.current = conversation.id;
    void markConversationRead(conversation.id);
  }, [conversation, markConversationRead]);

  // Fall back to Messages when the Files tab is no longer available.
  useEffect(() => {
    if ((tab === 'files' && attachments.length === 0) || (tab === 'links' && links.length === 0)) {
      setTab('messages');
    }
  }, [tab, attachments.length, links.length]);

  // Spinner only on a first visit (nothing cached yet).
  if (!conversation && !error) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  if (error || !conversation) {
    return <Alert>{error || 'Conversation not found'}</Alert>;
  }

  const single = others.length === 1 ? others[0] : null;
  const singlePresence = single ? (presence[single.id] ?? single.presence) : undefined;
  const meta =
    conversation.type === 'GROUP'
      ? `${conversation.participants.length} members`
      : [
          singlePresence ? PRESENCE_LABEL[singlePresence] : '',
          single?.statusMessage ? `${single.statusEmoji} ${single.statusMessage}`.trim() : '',
        ]
          .filter(Boolean)
          .join(' · ') || undefined;

  const leading = single ? (
    <Avatar name={single.fullName} src={single.avatarUrl} size={30} presence={singlePresence} />
  ) : undefined;

  const muted = isMuted(conversation.id, Boolean(conversation.muted));
  const menuItems: MenuItem[] = [
    { label: 'Conversation details', icon: 'info', onSelect: toggleDetails },
    { label: 'Add people', icon: 'plus', onSelect: () => setAddOpen(true) },
    { separator: true },
    {
      label: muted ? 'Unmute conversation' : 'Mute conversation',
      icon: muted ? 'bell' : 'bell-off',
      onSelect: () => void setMuted(conversation.id, !muted).catch(() => undefined),
    },
  ];

  const placeholder = (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name="message" size={26} />
      </span>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyText}>
        This is the beginning of your conversation with {title}. Send the first message.
      </p>
    </div>
  );

  const tabs: ConversationTab[] = [
    { label: 'Messages', active: tab === 'messages', onClick: () => setTab('messages') },
  ];
  if (attachments.length > 0) {
    tabs.push({
      label: 'Files',
      count: attachments.length,
      active: tab === 'files',
      onClick: () => setTab('files'),
      preview: (
        <FilesLinks
          attachments={attachments}
          links={links}
          loading={filesLoading || linksLoading}
        />
      ),
      previewClassName: headerStyles.previewFiles,
    });
  }
  if (links.length > 0) {
    tabs.push({
      label: 'Links',
      count: links.length,
      active: tab === 'links',
      onClick: () => setTab('links'),
    });
  }
  tabs.push({ label: 'Tasks', active: tab === 'tasks', onClick: () => setTab('tasks') });

  return (
    <>
      <ConversationView
        target={{ kind: 'conversation', id: conversation.id }}
        composerPlaceholder={`Message ${title}`}
        header={
          <ConversationHeader
            name={title}
            icon="users"
            leading={leading}
            meta={meta}
            onTitleClick={toggleDetails}
            facepile={
              conversation.type === 'GROUP' ? (
                <MemberFacepile
                  users={conversation.participants.map((participant) => participant.user)}
                  total={conversation.participants.length}
                  onClick={toggleDetails}
                />
              ) : undefined
            }
            actions={<HuddleStartButton target={{ kind: 'conversation', id: conversation.id }} />}
            tabs={tabs}
            menuItems={menuItems}
          />
        }
        placeholder={placeholder}
        panel={
          tab === 'files' || tab === 'links' ? (
            <FilesLinks
              title={tab === 'files' ? 'Files' : 'Links'}
              attachments={tab === 'files' ? attachments : []}
              links={tab === 'links' ? links : []}
              loading={filesLoading || linksLoading}
            />
          ) : tab === 'tasks' ? (
            <TasksBoard
              conversationId={conversation.id}
              onOpenTask={(task) => {
                setTab('messages');
                focusMessage(task.messageId);
              }}
            />
          ) : undefined
        }
      />

      <MemberPickerDialog
        open={addOpen}
        title="Add people"
        submitLabel="Add"
        excludeUserIds={conversation.participants.map((participant) => participant.user.id)}
        onClose={() => setAddOpen(false)}
        onSubmit={async (userIds) => {
          // "Add people" never changes this DM: it opens (or creates) the
          // group DM for everyone combined. Earlier history is not shared.
          const result = await addConversationParticipants(conversation.id, userIds);
          await refresh();
          setAddOpen(false);
          router.push(`/dm/${result.conversation.id}`);
        }}
      />
    </>
  );
};
