import type { User } from './user';

export type ProjectUpdates = 'OFF' | 'KEY' | 'SUMMARY';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
// PUBLIC: everyone in the workspace. PRIVATE: only the people in memberIds.
export type ProjectVisibility = 'PUBLIC' | 'PRIVATE';

// The built-in board of tasks that are in no project (TASK-n).
export const UNASSIGNED_KEY = 'TASK';

export type Project = {
  id: string;
  key: string;
  name: string;
  description: string;
  // null = no channel: private to the people in memberIds.
  homeChannelId: string | null;
  visibility: ProjectVisibility;
  // People added directly (private projects; empty when public).
  memberIds: string[];
  // Everyone who is a member (the whole workspace when public).
  memberCount?: number;
  linkedChannelIds: string[];
  lead: User;
  updates: ProjectUpdates;
  status: ProjectStatus;
  archivedAt: string | null;
  createdAt: string;
  // What the viewer may do (the server re-checks every action).
  isMember?: boolean;
  canManage?: boolean;
  readOnly?: boolean;
  counts?: { total: number; done: number };
  // Tickets that would be deleted with the project (no channel to return to).
  channelFreeTickets?: number;
};

export type ProjectInput = {
  name?: string;
  key?: string;
  description?: string;
  // '' removes the home channel.
  homeChannelId?: string;
  visibility?: ProjectVisibility;
  memberIds?: string[];
  linkedChannelIds?: string[];
  leadId?: string;
  updates?: ProjectUpdates;
  adoptTasks?: boolean;
};

// Same rule as the server: 2-6 letters/digits, starts with a letter, not TASK.
export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;

/** "Mobile App" -> "MA", "Website" -> "WEB": a starting suggestion only. */
export const suggestProjectKey = (name: string) => {
  const words = name.toUpperCase().match(/[A-Z0-9]+/g) || [];
  const key =
    words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] || '').slice(0, 3);
  const clean = key.replace(/^[^A-Z]+/, '').slice(0, 6);
  return clean.length >= 2 && clean !== 'TASK' ? clean : '';
};

/** "Public · 12 people" / "🔒 Private · 3 people". */
export const peopleLabel = (project: Project) => {
  const count = project.memberCount ?? project.memberIds.length;
  const people = `${count} ${count === 1 ? 'person' : 'people'}`;
  return project.visibility === 'PUBLIC' ? `Public · ${people}` : `🔒 Private · ${people}`;
};
