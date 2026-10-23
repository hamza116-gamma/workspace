'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import type { OrganizationMember, OrgRole } from '@/types/organization';
import { roleLabel } from './memberRules';
import styles from './MembersView.module.css';

type Props = {
  member: OrganizationMember | null;
  roles: OrgRole[];
  onClose: () => void;
  onRoleChange: (member: OrganizationMember, role: OrgRole) => void;
  onToggleStatus: (member: OrganizationMember) => void;
  onRemove: (member: OrganizationMember) => void;
};

// "Manage" controls for one member: role, deactivate/reactivate, remove.
export const ManageMemberDialog = ({
  member,
  roles,
  onClose,
  onRoleChange,
  onToggleStatus,
  onRemove,
}: Props) => (
  <Modal open={Boolean(member)} title="Manage member" onClose={onClose}>
    {member && (
      <div className={styles.manage}>
        <div className={styles.who}>
          <Avatar name={member.user.fullName} src={member.user.avatarUrl} size={32} />
          <div>
            <div className={styles.name}>{member.user.fullName}</div>
            <div className={styles.hint}>{member.user.email}</div>
          </div>
        </div>

        <label className={styles.lbl} htmlFor="member-role">
          Role
        </label>
        <select
          id="member-role"
          className={styles.field}
          value={member.role}
          onChange={(event) => onRoleChange(member, event.target.value as OrgRole)}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>

        <div className={styles.manageActions}>
          <Button variant="secondary" size="sm" onClick={() => onToggleStatus(member)}>
            {member.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => onRemove(member)}>
            Remove from workspace
          </Button>
        </div>
      </div>
    )}
  </Modal>
);
