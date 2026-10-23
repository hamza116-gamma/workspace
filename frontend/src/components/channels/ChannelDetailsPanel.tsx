'use client';

import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useOrg } from '@/hooks/useOrg';
import { useWorkspaceUi } from '@/hooks/useWorkspaceUi';
import { Icon } from '@/components/ui/Icon';
import { ChannelAboutCard } from './ChannelAboutCard';
import { ChannelMembersSummary } from './ChannelMembersSummary';
import styles from './ChannelDetailsPanel.module.css';

const PanelBar = ({ onClose }: { onClose: () => void }) => (
  <div className={styles.bar}>
    <span className={styles.barTitle}>Details</span>
    <button type="button" className={styles.barClose} onClick={onClose} aria-label="Hide details">
      <Icon name="chevron-right" size={16} />
    </button>
  </div>
);

export const ChannelDetailsPanel = () => {
  const { active } = useOrg();
  const { closeDetails } = useWorkspaceUi();
  const { channel, error, reload } = useActiveChannel();

  if (!channel) {
    return (
      <aside className={styles.panel} aria-label="Workspace details">
        <PanelBar onClose={closeDetails} />
        <div className={styles.workspaceCard}>
          <span className={styles.wsMark} aria-hidden />
          <h2 className={styles.wsName}>{active?.name ?? 'Workspace'}</h2>
          <p className={styles.wsMeta}>
            {active ? `${active.role.charAt(0) + active.role.slice(1).toLowerCase()} · ${active.slug}` : ''}
          </p>
        </div>
        <div className={styles.hint}>
          <Icon name="hash" size={16} />
          <p>Select a channel to see its details, members, and media here.</p>
        </div>
      </aside>
    );
  }

  const canManage =
    channel.membership?.role === 'MODERATOR' ||
    active?.role === 'OWNER' ||
    active?.role === 'ADMIN';

  return (
    <aside className={styles.panel} aria-label="Channel details">
      <PanelBar onClose={closeDetails} />

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.identity}>
        <span className={styles.hashCircle}>
          <Icon name={channel.type === 'PRIVATE' ? 'lock' : 'hash'} size={22} />
        </span>
        <h2 className={styles.channelName}>{channel.name}</h2>
        <p className={styles.channelMeta}>
          {channel.memberCount} {channel.memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>

      <ChannelAboutCard channel={channel} canManage={canManage} onChanged={reload} />

      <ChannelMembersSummary channel={channel} />
    </aside>
  );
};
