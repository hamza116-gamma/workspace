'use client';

import Image from 'next/image';
import { getInitials } from '@/lib/initials';
import { Icon } from '@/components/ui/Icon';
import type { Organization } from '@/types/organization';
import styles from './WorkspaceHoverCard.module.css';

/** Floating workspace switcher: every workspace + "Create workspace". */
export const WorkspaceHoverCard = ({
  organizations,
  activeId,
  mentions,
  onSelect,
  onCreate,
}: {
  organizations: Organization[];
  activeId: string | undefined;
  mentions: number;
  onSelect: (organizationId: string) => void;
  onCreate: () => void;
}) => (
  <div className={styles.card} role="menu" aria-label="Switch workspace">
    <p className={styles.eyebrow}>Workspaces</p>
    {organizations.map((organization) => {
      const active = organization.id === activeId;
      return (
        <button
          key={organization.id}
          type="button"
          role="menuitemradio"
          aria-checked={active}
          className={`${styles.row} ${active ? styles.rowActive : ''}`}
          onClick={() => onSelect(organization.id)}
        >
          {organization.logoUrl ? (
            <Image src={organization.logoUrl} alt="" width={30} height={30} className={styles.logo} />
          ) : (
            <span className={styles.monogram}>{getInitials(organization.name)}</span>
          )}
          <span className={styles.meta}>
            <span className={styles.name}>{organization.name}</span>
            <span className={styles.sub}>
              {organization.role.charAt(0) + organization.role.slice(1).toLowerCase()}
            </span>
          </span>
          {active && mentions > 0 && <span className={styles.badge}>{mentions}</span>}
          {active && <Icon name="check" size={15} className={styles.check} />}
        </button>
      );
    })}
    <div className={styles.sep} />
    <button type="button" role="menuitem" className={styles.row} onClick={onCreate}>
      <span className={styles.addTile}>
        <Icon name="plus" size={15} />
      </span>
      <span className={styles.name}>Create workspace</span>
    </button>
  </div>
);
