import { apiData } from './api';
import type { Organization } from '@/types/organization';

export type InviteLink = {
  token: string;
  url: string;
  expiresAt: string;
  createdBy: string | null;
};

export type InviteLinkWorkspace = {
  organizationId: string;
  organizationName: string;
  logoUrl: string | null;
};

export const getInviteLink = (organizationId: string) =>
  apiData<{ link: InviteLink | null }>(`/organizations/${organizationId}/invite-link`);

/** Creates the link, or regenerates it (the old one stops working). */
export const createInviteLink = (organizationId: string) =>
  apiData<{ link: InviteLink }>(`/organizations/${organizationId}/invite-link`, { method: 'POST' });

export const disableInviteLink = (organizationId: string) =>
  apiData<{ link: null }>(`/organizations/${organizationId}/invite-link`, { method: 'DELETE' });

export const lookupInviteLink = (token: string) =>
  apiData<{ workspace: InviteLinkWorkspace }>(`/invitations/link/${encodeURIComponent(token)}`);

export const joinWithInviteLink = (token: string) =>
  apiData<{ joined: boolean; organization: Organization }>('/invitations/link/join', {
    method: 'POST',
    body: { token },
  });
