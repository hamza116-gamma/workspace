const ROLES = {
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  MEMBER: 'MEMBER',
};

const ORG_ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  MEMBER: 'MEMBER',
};

const MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
};

const ORGANIZATION_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
};

const INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
};

const CHANNEL_TYPES = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
};

const CHANNEL_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
};

const CHANNEL_ROLES = {
  MODERATOR: 'MODERATOR',
  MEMBER: 'MEMBER',
};

const CHANNEL_NOTIFY = {
  ALL: 'ALL',
  MENTIONS: 'MENTIONS',
  MUTE: 'MUTE',
};

const CHANNEL_MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
};

const CONVERSATION_TYPES = {
  DIRECT: 'DIRECT',
  GROUP: 'GROUP',
};

const PRESENCE_STATES = {
  ACTIVE: 'ACTIVE',
  AWAY: 'AWAY',
  DND: 'DND',
  OFFLINE: 'OFFLINE',
};

const THEMES = {
  LIGHT: 'LIGHT',
  DARK: 'DARK',
  SYSTEM: 'SYSTEM',
};

const ATTACHMENT_KINDS = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  FILE: 'FILE',
};

// Administrative actions recorded in the audit log (services/audit.service).
// Each key needs a sentence in frontend components/workspace/settings/auditLabels.ts.
const AUDIT_ACTIONS = {
  ORG_CREATED: 'ORG_CREATED',
  ORG_SETTINGS_UPDATED: 'ORG_SETTINGS_UPDATED',
  INVITATION_SENT: 'INVITATION_SENT',
  INVITATION_RESENT: 'INVITATION_RESENT',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
  INVITE_LINK_CREATED: 'INVITE_LINK_CREATED',
  INVITE_LINK_DISABLED: 'INVITE_LINK_DISABLED',
  MEMBER_JOINED: 'MEMBER_JOINED',
  MEMBER_JOINED_VIA_LINK: 'MEMBER_JOINED_VIA_LINK',
  MEMBER_ROLE_CHANGED: 'MEMBER_ROLE_CHANGED',
  MEMBER_DEACTIVATED: 'MEMBER_DEACTIVATED',
  MEMBER_REACTIVATED: 'MEMBER_REACTIVATED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  MEMBER_LEFT: 'MEMBER_LEFT',
  OWNERSHIP_TRANSFERRED: 'OWNERSHIP_TRANSFERRED',
  CHANNEL_CREATED: 'CHANNEL_CREATED',
  CHANNEL_UPDATED: 'CHANNEL_UPDATED',
  CHANNEL_ARCHIVED: 'CHANNEL_ARCHIVED',
  CHANNEL_UNARCHIVED: 'CHANNEL_UNARCHIVED',
  CHANNEL_MEMBER_REMOVED: 'CHANNEL_MEMBER_REMOVED',
  MESSAGE_DELETED_BY_ADMIN: 'MESSAGE_DELETED_BY_ADMIN',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',
  PROJECT_RESTORED: 'PROJECT_RESTORED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  PROJECT_KEY_CHANGED: 'PROJECT_KEY_CHANGED',
};

// Huddles (Phase 6.6): one LIVE huddle per channel / conversation.
const HUDDLE_STATUS = {
  LIVE: 'LIVE',
  ENDED: 'ENDED',
};

// Ringing state of each invitee (DM huddles ring; "Add people" rings anyone).
const HUDDLE_INVITE_STATUS = {
  RINGING: 'RINGING',
  JOINED: 'JOINED',
  DECLINED: 'DECLINED',
  MISSED: 'MISSED',
};

// Tasks (Phase 7): a task lives on a chat message; its thread is the discussion.
const TASK_STATUS = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
};

// Every status belongs to one group. The group drives "is it done?" (progress,
// closedAt, due reminders, open counts); names and colours are free.
const STATUS_GROUP = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
};

// Statuses of chat tasks (Unassigned) and the starting set of a new project.
// Their keys are the old fixed statuses, so existing tasks keep working.
const DEFAULT_TASK_STATUSES = [
  { key: TASK_STATUS.TODO, name: 'To do', color: '#8a94a6', group: STATUS_GROUP.TODO },
  {
    key: TASK_STATUS.IN_PROGRESS,
    name: 'In progress',
    color: '#3b82f6',
    group: STATUS_GROUP.IN_PROGRESS,
  },
  {
    key: TASK_STATUS.IN_REVIEW,
    name: 'In review',
    color: '#f59e0b',
    group: STATUS_GROUP.IN_PROGRESS,
  },
  { key: TASK_STATUS.DONE, name: 'Done', color: '#22a06b', group: STATUS_GROUP.DONE },
];

const TASK_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

// Projects (Phase 1): containers for tickets, behind settings.projectsEnabled.
const PROJECT_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
};

// What a project posts to its home channel automatically.
// PUBLIC: everyone active in the workspace is a member (now and later).
// PRIVATE: only the people listed.
const PROJECT_VISIBILITY = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
};

const PROJECT_UPDATES = {
  OFF: 'OFF',
  KEY: 'KEY',
  SUMMARY: 'SUMMARY',
};

// Key of tasks that belong to no project (TASK-1, TASK-2, ...).
const CHAT_TASK_KEY = 'TASK';

module.exports = {
  AUDIT_ACTIONS,
  PROJECT_STATUS,
  PROJECT_UPDATES,
  PROJECT_VISIBILITY,
  CHAT_TASK_KEY,
  TASK_STATUS,
  STATUS_GROUP,
  DEFAULT_TASK_STATUSES,
  TASK_PRIORITY,
  HUDDLE_STATUS,
  HUDDLE_INVITE_STATUS,
  ROLES,
  ORG_ROLES,
  MEMBER_STATUS,
  ORGANIZATION_STATUS,
  INVITATION_STATUS,
  CHANNEL_TYPES,
  CHANNEL_STATUS,
  CHANNEL_ROLES,
  CHANNEL_NOTIFY,
  CHANNEL_MEMBER_STATUS,
  CONVERSATION_TYPES,
  PRESENCE_STATES,
  THEMES,
  ATTACHMENT_KINDS,
};
