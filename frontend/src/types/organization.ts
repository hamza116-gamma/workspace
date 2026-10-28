import type { ChannelType } from './channel';
import type { User } from './user';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

export type OrganizationStatus = 'ACTIVE' | 'ARCHIVED';

export type OrgMemberStatus = 'ACTIVE' | 'DISABLED';

export type OrganizationSettings = {
  allowMemberChannelCreation: boolean;
  /** Feature switch: Projects (tickets, milestones). */
  projectsEnabled?: boolean;
  defaultChannelType: ChannelType;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  settings: OrganizationSettings;
  status: OrganizationStatus;
  createdAt: string;
  role: OrgRole;
  membershipStatus: OrgMemberStatus;
  isActive: boolean;
};

export type OrganizationMember = {
  id: string;
  role: OrgRole;
  status: OrgMemberStatus;
  joinedAt: string;
  user: User;
};

export type Invitation = {
  id: string;
  email: string;
  role: OrgRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  expiresAt: string;
  createdAt?: string;
};
