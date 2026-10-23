import { apiData } from './api';
import type {
  Invitation,
  Organization,
  OrganizationMember,
  OrgMemberStatus,
  OrgRole,
  OrganizationSettings,
} from '@/types/organization';

export const listOrganizations = () => apiData<{ organizations: Organization[] }>('/organizations');

export const createOrganization = (name: string) =>
  apiData<{ organization: Organization }>('/organizations', { method: 'POST', body: { name } });

export const switchOrganization = (id: string) =>
  apiData<{ organization: Organization }>(`/organizations/${id}/switch`, { method: 'POST' });

export const listOrganizationMembers = (id: string) =>
  apiData<{ members: OrganizationMember[] }>(`/organizations/${id}/members`);

export const updateOrganizationMember = (
  id: string,
  userId: string,
  body: { role?: OrgRole; status?: OrgMemberStatus },
) =>
  apiData<{ member: OrganizationMember }>(`/organizations/${id}/members/${userId}`, {
    method: 'PATCH',
    body,
  });

export const removeOrganizationMember = (id: string, userId: string) =>
  apiData<{ message: string }>(`/organizations/${id}/members/${userId}`, { method: 'DELETE' });

export const listInvitations = (id: string) =>
  apiData<{ invitations: Invitation[] }>(`/organizations/${id}/invitations`);

export const createInvitation = (id: string, body: { email: string; role: OrgRole }) =>
  apiData<{ invitation: Invitation }>(`/organizations/${id}/invitations`, {
    method: 'POST',
    body,
  });

export const revokeInvitation = (id: string, invitationId: string) =>
  apiData<{ message: string }>(`/organizations/${id}/invitations/${invitationId}`, {
    method: 'DELETE',
  });

export const acceptInvitation = (token: string) =>
  apiData<{ organization: Organization }>('/invitations/accept', {
    method: 'POST',
    body: { token },
  });

export type InvitationLookup = {
  email: string;
  role: OrgRole;
  organizationName: string;
  expiresAt: string;
};

export const lookupInvitation = (token: string) =>
  apiData<{ invitation: InvitationLookup }>(`/invitations/${encodeURIComponent(token)}`);

export const updateOrganization = (
  id: string,
  body: { name?: string; settings?: Partial<OrganizationSettings> },
) => apiData<{ organization: Organization }>(`/organizations/${id}`, { method: 'PATCH', body });

export const leaveOrganization = (id: string) =>
  apiData<{ message: string }>(`/organizations/${id}/leave`, { method: 'POST' });

/** `confirm` must equal the workspace name. */
export const transferOwnership = (id: string, userId: string, confirm: string) =>
  apiData<{ member: OrganizationMember }>(`/organizations/${id}/transfer-ownership`, {
    method: 'POST',
    body: { userId, confirm },
  });

export const resendInvitation = (id: string, invitationId: string) =>
  apiData<{ invitation: Invitation }>(`/organizations/${id}/invitations/${invitationId}/resend`, {
    method: 'POST',
  });
