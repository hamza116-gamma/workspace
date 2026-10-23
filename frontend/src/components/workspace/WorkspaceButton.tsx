'use client';

import Image from 'next/image';
import { getInitials } from '@/lib/initials';
import type { Organization } from '@/types/organization';
import styles from './WorkspaceButton.module.css';

export const WorkspaceButton = ({
  organization,
  active,
  badge,
  expanded,
  onSelect,
}: {
  organization: Organization;
  active: boolean;
  badge?: { unread: number; mentions: number };
  expanded?: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    className={`${styles.tile} ${active ? styles.active : ''}`}
    onClick={onSelect}
    aria-current={active ? 'true' : undefined}
    aria-label={organization.name}
    aria-haspopup={expanded === undefined ? undefined : 'menu'}
    aria-expanded={expanded}
    title={organization.name}
  >
    {badge && badge.unread > 0 && <span className={styles.bar} aria-hidden />}
    {badge && badge.mentions > 0 && (
      <span className={styles.pill} aria-label={`${badge.mentions} mentions`}>
        {badge.mentions}
      </span>
    )}
    {organization.logoUrl ? (
      <Image src={organization.logoUrl} alt="" width={40} height={40} className={styles.logo} />
    ) : (
      <span className={styles.monogram}>{getInitials(organization.name)}</span>
    )}
  </button>
);
