export type User = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string;
  department: string;
  presence: PresenceState;
  statusMessage: string;
  statusEmoji: string;
  statusClearAt: string | null;
  /** Do Not Disturb end; only set while notifications are paused. */
  dndUntil?: string | null;
  theme: ThemeName;
  role: string;
  isDisabled: boolean;
  lastLoginAt: string | null;
  // null until the welcome intro was finished or skipped.
  introSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ThemeName = 'LIGHT' | 'DARK' | 'SYSTEM';

export type PresenceState = 'ACTIVE' | 'AWAY' | 'DND' | 'OFFLINE';

export type Role = 'ADMIN' | 'MODERATOR' | 'MEMBER';
