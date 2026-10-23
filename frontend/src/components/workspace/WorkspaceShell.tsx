'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { WorkspaceRail } from './WorkspaceRail';
import { TabTitle } from './TabTitle';
import { OrgLiveUpdates } from './OrgLiveUpdates';
import { WorkspaceHotkeys } from './WorkspaceHotkeys';
import { ChatPreloader } from './ChatPreloader';
import { ChatCacheSync } from './ChatCacheSync';
import { Icon } from '@/components/ui/Icon';
import { useOrg } from '@/hooks/useOrg';
import { ChannelPanel } from '@/components/navigation/ChannelPanel';
import { DetailsPanel } from '@/components/channels/DetailsPanel';
import { ConnectionBanner } from '@/components/conversation/ConnectionBanner';
import { ThreadPanel } from '@/components/conversation/ThreadPanel';
import { DownloadToaster } from '@/components/download/DownloadToaster';
import { HuddleBar } from '@/components/huddle/HuddleBar';
import { HuddleRingPopup } from '@/components/huddle/HuddleRingPopup';
import { WorkspaceUiProvider } from '@/context/WorkspaceUiContext';
import { useWorkspaceUi } from '@/hooks/useWorkspaceUi';
import { useThreadPanel } from '@/hooks/useThreadPanel';
import styles from './WorkspaceShell.module.css';

const WorkspaceGrid = ({ children }: { children: React.ReactNode }) => {
  const { detailsOpen, detailsClosing, navOpen, openNav, closeNav } = useWorkspaceUi();
  const { active } = useOrg();
  const pathname = usePathname();

  // The mobile drawer closes whenever the user navigates.
  useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNav();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen, closeNav]);
  const { open: threadOpen, closing: threadClosing } = useThreadPanel();
  const shellClass = threadOpen ? styles.withThread : detailsOpen ? styles.withDetails : '';

  return (
    <>
      <ConnectionBanner />
      <TabTitle />
      <OrgLiveUpdates />
      <WorkspaceHotkeys />
      <ChatPreloader />
      <ChatCacheSync />
      <div className={`${styles.shell} ${shellClass}`}>
        <div className={`${styles.nav} ${navOpen ? styles.navOpen : ''}`}>
          <WorkspaceRail />
          <ChannelPanel />
        </div>
        {navOpen && <div className={styles.backdrop} onClick={closeNav} aria-hidden />}
        <div className={styles.mobileBar}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={openNav}
            aria-label="Open navigation"
            aria-expanded={navOpen}
          >
            <Icon name="menu" size={18} />
          </button>
          <span className={styles.mobileTitle}>{active?.name ?? 'Workspace'}</span>
        </div>
        <main className={styles.main}>{children}</main>
        {threadOpen && (
          <div className={`${styles.threadColumn} ${threadClosing ? styles.closing : ''}`}>
            <ThreadPanel />
          </div>
        )}
        {!threadOpen && detailsOpen && (
          <div className={`${styles.context} ${detailsClosing ? styles.closing : ''}`}>
            <DetailsPanel />
          </div>
        )}
      </div>
      <DownloadToaster />
      <HuddleBar />
      <HuddleRingPopup />
    </>
  );
};

export const WorkspaceShell = ({ children }: { children: React.ReactNode }) => (
  <WorkspaceUiProvider>
    <WorkspaceGrid>{children}</WorkspaceGrid>
  </WorkspaceUiProvider>
);
