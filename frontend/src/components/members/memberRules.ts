import type { OrganizationMember, OrgRole } from '@/types/organization';

export const ALL_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'];
export const ROLE_RANK: Record<OrgRole, number> = { MEMBER: 0, MODERATOR: 1, ADMIN: 2, OWNER: 3 };
export const roleLabel = (role: OrgRole) => role.charAt(0) + role.slice(1).toLowerCase();

// Owners manage everyone; admins only members ranked below them and can
// only grant roles below their own (the server enforces the same rule).
export const memberRules = (actorRole: OrgRole | undefined, selfId: string | undefined) => {
  const isOwner = actorRole === 'OWNER';
  const canManage = isOwner || actorRole === 'ADMIN';
  const actorRank = actorRole ? (ROLE_RANK[actorRole] ?? -1) : -1;
  return {
    canManage,
    canManageMember: (member: OrganizationMember) =>
      canManage && member.user.id !== selfId && (isOwner || ROLE_RANK[member.role] < actorRank),
    assignableRoles: isOwner ? ALL_ROLES : ALL_ROLES.filter((role) => ROLE_RANK[role] < actorRank),
  };
};
