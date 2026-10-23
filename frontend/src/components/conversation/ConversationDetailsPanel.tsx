'use client';

import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { useActiveConversation } from '@/hooks/useActiveConversation';
import { useWorkspaceUi } from '@/hooks/useWorkspaceUi';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import type { PresenceState, User } from '@/types/user';
import styles from './ConversationDetailsPanel.module.css';

const PRESENCE_LABEL: Record<PresenceState, string> = {
  ACTIVE: 'Active',
  AWAY: 'Away',
  DND: 'Do not disturb',
  OFFLINE: 'Offline',
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.field}>
    <span className={styles.fieldLabel}>{label}</span>
    <span className={styles.fieldValue}>{value || 'Not set'}</span>
  </div>
);

const PersonRow = ({ person, presence }: { person: User; presence: PresenceState }) => (
  <li className={styles.person}>
    <Avatar name={person.fullName} src={person.avatarUrl} size={34} presence={presence} />
    <span className={styles.personInfo}>
      <span className={styles.personName}>{person.fullName}</span>
      <span className={styles.personMeta}>{person.jobTitle || person.email}</span>
    </span>
  </li>
);

export const ConversationDetailsPanel = () => {
  const { user } = useAuth();
  const presence = usePresence();
  const { conversation, loading } = useActiveConversation();
  const { closeDetails } = useWorkspaceUi();

  const others = (conversation?.participants ?? []).filter(
    (participant) => participant.user.id !== user?.id,
  );
  const single = others.length === 1 ? others[0].user : null;

  return (
    <aside className={styles.panel} aria-label="Conversation details">
      <div className={styles.bar}>
        <span className={styles.barTitle}>Details</span>
        <button
          type="button"
          className={styles.barClose}
          onClick={closeDetails}
          aria-label="Hide details"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      {!conversation && (
        <div className={styles.hint}>
          <Icon name="message" size={16} />
          <p>{loading ? 'Loading…' : 'Open a conversation to see details here.'}</p>
        </div>
      )}

      {conversation && single && (
        <div className={styles.profile}>
          <Avatar
            name={single.fullName}
            src={single.avatarUrl}
            size={72}
            presence={presence[single.id] ?? single.presence}
          />
          <h2 className={styles.profileName}>{single.fullName}</h2>
          <p className={styles.profileMeta}>
            {PRESENCE_LABEL[presence[single.id] ?? single.presence]}
          </p>

          <div className={styles.fields}>
            <Field label="Email" value={single.email} />
            <Field label="Job title" value={single.jobTitle} />
            <Field label="Department" value={single.department} />
            <Field label="Status" value={single.statusMessage} />
          </div>
        </div>
      )}

      {conversation && !single && (
        <div className={styles.group}>
          <h2 className={styles.groupTitle}>
            {conversation.participants.length} members
          </h2>
          <ul className={styles.people}>
            {conversation.participants.map((participant) => (
              <PersonRow
                key={participant.user.id}
                person={participant.user}
                presence={presence[participant.user.id] ?? participant.user.presence}
              />
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};
