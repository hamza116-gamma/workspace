'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useAttachments } from '@/hooks/useAttachments';
import { useFocusMessage } from '@/hooks/useFocusMessage';
import { TasksBoard } from '@/components/tasks/TasksBoard';
import { useLinks } from '@/hooks/useLinks';
import { useMentionables } from '@/hooks/useMentionables';
import { useOrg } from '@/hooks/useOrg';
import { usePins } from '@/hooks/usePins';
import { useSocket } from '@/hooks/useSocket';
import { useUnread } from '@/hooks/useUnread';
import { useWorkspaceUi } from '@/hooks/useWorkspaceUi';
import { useChannelStar } from '@/hooks/useChannelStar';
import { useChannels } from '@/hooks/useChannels';
import { peekChannel } from '@/lib/chatCache';
import { archiveChannel, joinChannel, leaveChannel, updateChannelPreference } from '@/lib/channels';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Icon } from '@/components/ui/Icon';
import type { MenuItem } from '@/components/ui/DropdownMenu';
import { ChannelMembers } from '@/components/channels/ChannelMembers';
import { ChannelPins } from '@/components/channels/ChannelPins';
import { FilesLinks } from './FilesLinks';
import { PinsPreview } from './PinsPreview';
import { ConversationView } from './ConversationView';
import { MemberFacepile } from './MemberFacepile';
import { SHOW_CHANNEL_MEMBERS_EVENT } from '@/components/channels/ChannelMembersSummary';
import { HuddleStartButton } from '@/components/huddle/HuddleStartButton';
import { ConversationHeader, type ConversationTab } from './ConversationHeader';
import headerStyles from './ConversationHeader.module.css';
import type { ChannelNotify } from '@/types/channel';
import styles from './ChannelWorkspace.module.css';

type ChannelTab = 'messages' | 'files' | 'links' | 'pins' | 'tasks' | 'members';

export const ChannelWorkspace = ({ channelId }: { channelId: string }) => {
  const router = useRouter();
  const { active } = useOrg();
  const active_ = useActiveChannel();
  const { load, reload, clear } = active_;
  // Shown at once from memory on a revisit (or from the sidebar list), then
  // refreshed in the background; never another channel's data.
  const channel =
    active_.channel?.id === channelId
      ? active_.channel
      : active_.targetId === channelId && active_.error
        ? null
        : (peekChannel(channelId) ?? null);
  const error = active_.targetId === channelId ? active_.error : '';
  const { socket } = useSocket();
  const { toggleDetails } = useWorkspaceUi();
  const { focusMessage } = useFocusMessage();
  const { markChannelRead } = useUnread();
  const { pins } = usePins();
  const { attachments, loading: filesLoading } = useAttachments(
    channel ? { kind: 'channel', id: channel.id } : null,
  );
  const { links, loading: linksLoading } = useLinks(
    channel ? { kind: 'channel', id: channel.id } : null,
  );
  // Shares the composer's cached member list (no extra request).
  const memberUsers = useMentionables(channel ? { kind: 'channel', id: channel.id } : null);

  // "View all" in the details drawer opens this channel's Members tab.
  useEffect(() => {
    const show = () => setTab('members');
    window.addEventListener(SHOW_CHANNEL_MEMBERS_EVENT, show);
    return () => window.removeEventListener(SHOW_CHANNEL_MEMBERS_EVENT, show);
  }, []);
  const { isStarred, setStarred } = useChannelStar();
  const { refresh: refreshChannels } = useChannels();
  const [tab, setTab] = useState<ChannelTab>('messages');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    load(channelId);
    return () => clear();
  }, [channelId, load, clear]);

  // Opening the channel marks it read (Slack behavior). The ref guard keeps
  // reloads of the same channel from re-posting.
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!channel) {
      return;
    }
    if (markedRef.current === channel.id) {
      return;
    }
    markedRef.current = channel.id;
    void markChannelRead(channel.id);
  }, [channel, markChannelRead]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    const onMembership = (payload: { channelId: string; member: boolean }) => {
      if (String(payload.channelId) === String(channelId)) {
        if (payload.member) {
          void reload();
        } else {
          router.push('/channels');
        }
      }
    };
    // Rename / topic / archive / member count changes reload the header.
    const onChannelUpdated = (payload: { channelId: string }) => {
      if (String(payload.channelId) === String(channelId)) {
        void reload();
      }
    };
    socket.on('channel.membership.updated', onMembership);
    socket.on('channel.updated', onChannelUpdated);
    return () => {
      socket.off('channel.membership.updated', onMembership);
      socket.off('channel.updated', onChannelUpdated);
    };
  }, [socket, channelId, router, reload]);

  const canManage = useMemo(() => {
    if (!channel) {
      return false;
    }
    return (
      channel.membership?.role === 'MODERATOR' ||
      active?.role === 'OWNER' ||
      active?.role === 'ADMIN'
    );
  }, [channel, active]);

  // Fall back to Messages when a tab's data disappears (or access changes).
  useEffect(() => {
    if (tab === 'files' && attachments.length === 0) {
      setTab('messages');
    }
    if (tab === 'links' && links.length === 0) {
      setTab('messages');
    }
    if (tab === 'pins' && pins.length === 0) {
      setTab('messages');
    }
    if (tab === 'members' && !channel?.isMember) {
      setTab('messages');
    }
  }, [tab, attachments.length, links.length, pins.length, channel?.isMember]);

  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setActionError('');
    try {
      await action();
      if (after) {
        after();
      } else {
        await reload();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  // Spinner only on a first visit (nothing cached yet); no "not found"
  // flash while switching.
  if (!channel && !error) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  if (error || !channel) {
    return <Alert>{error || 'Channel not found'}</Alert>;
  }

  const isArchived = channel.status === 'ARCHIVED';
  const notify = channel.membership?.notifyPreference ?? 'ALL';
  const setNotify = (preference: ChannelNotify) =>
    run(async () => {
      await updateChannelPreference(channel.id, preference);
      void refreshChannels({ silent: true });
    });
  const starred = channel.isMember && isStarred(channel.id);
  const toggleStar = () =>
    run(
      () => setStarred(channel.id, !starred),
      () => undefined,
    );

  const menuItems: MenuItem[] = [
    { label: 'Channel details', icon: 'info', onSelect: toggleDetails },
    { separator: true },
  ];

  if (channel.isMember) {
    menuItems.push(
      { label: 'Notifications', heading: true },
      { label: 'All activity', checked: notify === 'ALL', onSelect: () => setNotify('ALL') },
      {
        label: 'Mentions only',
        checked: notify === 'MENTIONS',
        onSelect: () => setNotify('MENTIONS'),
      },
      { label: 'Mute', checked: notify === 'MUTE', onSelect: () => setNotify('MUTE') },
      { separator: true },
    );
  }

  // The default channel (#general) can't be left or archived.
  if (!channel.isDefault || !channel.isMember) {
    menuItems.push(
      channel.isMember
        ? {
            label: 'Leave channel',
            icon: 'logout',
            danger: true,
            onSelect: () =>
              run(
                () => leaveChannel(channel.id),
                () => router.push('/channels'),
              ),
          }
        : {
            label: 'Join channel',
            icon: 'plus',
            disabled: isArchived,
            onSelect: () => run(() => joinChannel(channel.id)),
          },
    );
  }

  if (canManage && !isArchived && !channel.isDefault) {
    menuItems.push({
      label: 'Archive channel',
      icon: 'archive',
      danger: true,
      onSelect: () => {
        if (window.confirm(`Archive #${channel.name}? Members will no longer be able to post.`)) {
          void run(
            () => archiveChannel(channel.id),
            () => router.push('/channels'),
          );
        }
      },
    });
  }

  const openPinned = (messageId: string) => {
    setTab('messages');
    focusMessage(messageId);
  };

  const filesPreview = (
    <FilesLinks attachments={attachments} links={links} loading={filesLoading || linksLoading} />
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
      preview: filesPreview,
      previewClassName: headerStyles.previewFiles,
    });
  }
  if (pins.length > 0) {
    tabs.push({
      label: 'Pins',
      count: pins.length,
      active: tab === 'pins',
      onClick: () => setTab('pins'),
      preview: <PinsPreview targetKey={`channel:${channel.id}`} onOpenMessage={openPinned} />,
      previewClassName: headerStyles.previewPins,
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
  tabs.push({
    label: 'Tasks',
    active: tab === 'tasks',
    onClick: () => setTab('tasks'),
  });
  if (channel.isMember) {
    tabs.push({
      label: 'Members',
      count: channel.memberCount,
      active: tab === 'members',
      onClick: () => setTab('members'),
    });
  }

  const placeholder = (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name={channel.type === 'PRIVATE' ? 'lock' : 'hash'} size={26} />
      </span>
      <h2 className={styles.emptyTitle}>
        {channel.isMember ? `Welcome to #${channel.name}` : `Join #${channel.name}`}
      </h2>
      <p className={styles.emptyText}>
        {channel.isMember
          ? `This is the start of the #${channel.name} channel. Send the first message.`
          : 'Join this channel to see its conversations.'}
      </p>
    </div>
  );

  const panel =
    tab === 'files' || tab === 'links' ? (
      <FilesLinks
        title={tab === 'files' ? 'Files' : 'Links'}
        attachments={tab === 'files' ? attachments : []}
        links={tab === 'links' ? links : []}
        loading={filesLoading || linksLoading}
      />
    ) : tab === 'tasks' ? (
      <TasksBoard
        channelId={channel.id}
        canModerate={canManage}
        canCreate={channel.isMember && !isArchived}
      />
    ) : tab === 'pins' ? (
      <ChannelPins onSelectMessage={openPinned} />
    ) : channel.isMember && tab === 'members' ? (
      <ChannelMembers channel={channel} canManage={canManage} onChanged={reload} />
    ) : undefined;

  return (
    <ConversationView
      target={{ kind: 'channel', id: channel.id }}
      canModerate={canManage}
      canSend={channel.isMember && !isArchived}
      allowChannelMention={canManage}
      composerPlaceholder={channel.isMember ? `Message #${channel.name}` : 'Join to send messages'}
      header={
        <ConversationHeader
          name={channel.name}
          icon={channel.type === 'PRIVATE' ? 'lock' : 'hash'}
          meta={[
            channel.topic || channel.purpose,
            `${channel.memberCount} ${channel.memberCount === 1 ? 'member' : 'members'}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          onTitleClick={toggleDetails}
          facepile={
            <MemberFacepile
              users={memberUsers}
              total={channel.memberCount}
              onClick={channel.isMember ? () => setTab('members') : toggleDetails}
            />
          }
          actions={
            channel.isMember && !isArchived ? (
              <HuddleStartButton target={{ kind: 'channel', id: channel.id }} />
            ) : undefined
          }
          starred={starred}
          onToggleStar={channel.isMember ? toggleStar : undefined}
          tabs={tabs}
          menuItems={menuItems}
        />
      }
      banner={actionError ? <Alert>{actionError}</Alert> : undefined}
      placeholder={placeholder}
      panel={panel}
    />
  );
};
