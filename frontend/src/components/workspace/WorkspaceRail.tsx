'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import { useUnread } from '@/hooks/useUnread';
import { useDnd } from '@/hooks/useDnd';
import { getInitials } from '@/lib/initials';
import { Icon } from '@/components/ui/Icon';
import { WorkspaceStack } from './WorkspaceStack';
import { RailNav } from './RailNav';
import { ProfileMenu } from './ProfileMenu';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';
import styles from './WorkspaceRail.module.css';

export const WorkspaceRail = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { organizations, active, switchOrg } = useOrg();
  const { totals } = useUnread();
  const dnd = useDnd();
  const [dialogOpen, setDialogOpen] = useState(false);

  const openWorkspace = async (organizationId: string) => {
    if (organizationId !== active?.id) {
      await switchOrg(organizationId);
    }
    router.push('/channels');
  };

  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <nav className={styles.rail} aria-label="Workspaces">
      <div className={styles.tiles}>
        <WorkspaceStack
          organizations={organizations}
          active={active}
          totals={totals}
          onSelect={(id) => void openWorkspace(id)}
          onCreate={() => setDialogOpen(true)}
        />
        <button
          type="button"
          className={styles.add}
          onClick={() => setDialogOpen(true)}
          aria-label="Create a workspace"
          title="Create a workspace"
        >
          <Icon name="plus" size={16} />
        </button>
        <div className={styles.sep} aria-hidden />
        <RailNav />
      </div>

      <div className={styles.bottom}>
        {/* Notifications, theme, intro and log out live in the avatar menu. */}
        <ProfileMenu
          onLogout={() => void onLogout()}
          trigger={
            <span
              className={`${styles.user} ${dnd.active ? styles.userDnd : ''}`}
              title={dnd.active ? 'Your profile - notifications paused' : 'Your profile'}
            >
              {user?.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt=""
                  width={38}
                  height={38}
                  className={styles.avatar}
                />
              ) : (
                <span className={styles.monogram}>{getInitials(user?.fullName ?? '?')}</span>
              )}
            </span>
          }
        />
      </div>

      <CreateWorkspaceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </nav>
  );
};
