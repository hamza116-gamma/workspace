import type { AuditEntry } from '@/types/audit';

// One sentence per backend AUDIT_ACTIONS key (config/constants.js). The
// actor's name is shown separately; these complete "<actor> ...".
const roleWord = (value: unknown) =>
  typeof value === 'string' ? value.charAt(0) + value.slice(1).toLowerCase() : '';

const target = (entry: AuditEntry) => entry.target?.label || 'someone';
const channel = (entry: AuditEntry) => `#${entry.target?.label ?? 'channel'}`;

type Change = { field: string; from: unknown; to: unknown };
const fieldsOf = (entry: AuditEntry) =>
  ((entry.metadata.changes as Change[] | undefined) ?? []).map((change) => change.field).join(', ');

const LABELS: Record<string, (entry: AuditEntry) => string> = {
  ORG_CREATED: () => 'created the workspace',
  ORG_SETTINGS_UPDATED: (e) => `changed workspace settings (${fieldsOf(e) || 'settings'})`,
  INVITATION_SENT: (e) => `invited ${target(e)} as ${roleWord(e.metadata.role) || 'Member'}`,
  INVITATION_RESENT: (e) => `resent the invitation to ${target(e)}`,
  INVITATION_REVOKED: (e) => `revoked the invitation for ${target(e)}`,
  INVITE_LINK_CREATED: () => 'created a new invite link',
  INVITE_LINK_DISABLED: () => 'turned off the invite link',
  MEMBER_JOINED: () => 'joined the workspace from an email invitation',
  MEMBER_JOINED_VIA_LINK: () => 'joined the workspace with the invite link',
  MEMBER_ROLE_CHANGED: (e) =>
    `changed ${target(e)}'s role from ${roleWord(e.metadata.from)} to ${roleWord(e.metadata.to)}`,
  MEMBER_DEACTIVATED: (e) => `deactivated ${target(e)}`,
  MEMBER_REACTIVATED: (e) => `reactivated ${target(e)}`,
  MEMBER_REMOVED: (e) => `removed ${target(e)} from the workspace`,
  MEMBER_LEFT: () => 'left the workspace',
  OWNERSHIP_TRANSFERRED: (e) => `transferred ownership to ${target(e)}`,
  CHANNEL_CREATED: (e) => `created ${channel(e)}`,
  CHANNEL_UPDATED: (e) => `edited ${channel(e)} (${fieldsOf(e) || 'details'})`,
  CHANNEL_ARCHIVED: (e) => `archived ${channel(e)}`,
  CHANNEL_UNARCHIVED: (e) => `unarchived ${channel(e)}`,
  CHANNEL_MEMBER_REMOVED: (e) => {
    const user = e.metadata.user as { label?: string } | undefined;
    return `removed ${user?.label || 'someone'} from ${channel(e)}`;
  },
  MESSAGE_DELETED_BY_ADMIN: (e) => `deleted a message by ${target(e)}`,
  PROJECT_CREATED: (e) => `created project ${target(e)}`,
  PROJECT_ARCHIVED: (e) => `archived project ${target(e)}`,
  PROJECT_RESTORED: (e) => `restored project ${target(e)}`,
  PROJECT_DELETED: (e) => `deleted project ${target(e)}`,
  PROJECT_KEY_CHANGED: (e) => `changed a project key to ${target(e)}`,
};

export const AUDIT_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All actions' },
  { value: 'MEMBER_ROLE_CHANGED', label: 'Role changes' },
  { value: 'MEMBER_DEACTIVATED', label: 'Deactivations' },
  { value: 'MEMBER_REMOVED', label: 'Removals' },
  { value: 'INVITATION_SENT', label: 'Invitations' },
  { value: 'MEMBER_JOINED_VIA_LINK', label: 'Link joins' },
  { value: 'OWNERSHIP_TRANSFERRED', label: 'Ownership' },
  { value: 'ORG_SETTINGS_UPDATED', label: 'Settings' },
  { value: 'CHANNEL_ARCHIVED', label: 'Archived channels' },
  { value: 'MESSAGE_DELETED_BY_ADMIN', label: 'Deleted messages' },
  { value: 'PROJECT_DELETED', label: 'Deleted projects' },
];

export const describeAuditEntry = (entry: AuditEntry): string =>
  LABELS[entry.action]?.(entry) ?? entry.action.toLowerCase().replace(/_/g, ' ');
