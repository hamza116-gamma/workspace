'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useOrg } from '@/hooks/useOrg';
import { GeneralSettings } from './GeneralSettings';
import { InviteLinkSettings } from './InviteLinkSettings';
import { AuditLogView } from './AuditLogView';
import { WorkspaceDangerZone } from './WorkspaceDangerZone';
import styles from './Settings.module.css';

type Tab = 'general' | 'invite' | 'audit';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'invite', label: 'Invite link' },
  { id: 'audit', label: 'Audit log' },
];

export const WorkspaceSettings = () => {
  const { active } = useOrg();
  const [tab, setTab] = useState<Tab>('general');

  if (!active) {
    return null;
  }

  const isAdmin = active.role === 'OWNER' || active.role === 'ADMIN';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Workspace</span>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>
          {isAdmin
            ? `Manage ${active.name}: its name, channel defaults, invite link and audit trail.`
            : `Your membership in ${active.name}.`}
        </p>
      </header>

      {isAdmin && (
        <nav className={styles.tabs} role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      <div className={styles.stack}>
        {isAdmin && tab === 'general' && (
          <>
            <GeneralSettings />
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardTitle}>Members & roles</h2>
                  <p className={styles.hint}>Invite people, change roles, deactivate or remove.</p>
                </div>
                <Link href="/members" className={styles.linkButton}>
                  Manage members
                </Link>
              </div>
            </section>
          </>
        )}
        {isAdmin && tab === 'invite' && <InviteLinkSettings organizationId={active.id} />}
        {isAdmin && tab === 'audit' && <AuditLogView organizationId={active.id} />}
        {(!isAdmin || tab === 'general') && <WorkspaceDangerZone organization={active} />}
      </div>
    </div>
  );
};
