import type { Invitation, OrganizationMember } from '@/types/organization';

const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;

// Downloads the currently visible directory rows as a CSV file (client-side).
export const exportMembersCsv = (
  members: OrganizationMember[],
  invitations: Invitation[],
  fileName: string,
) => {
  const rows = [
    ['Name', 'Email', 'Role', 'Status', 'Joined'],
    ...members.map((member) => [
      member.user.fullName,
      member.user.email,
      member.role,
      member.status === 'ACTIVE' ? 'Active' : 'Deactivated',
      member.joinedAt ? new Date(member.joinedAt).toISOString().slice(0, 10) : '',
    ]),
    ...invitations.map((invitation) => [
      '',
      invitation.email,
      invitation.role,
      'Invite pending',
      '',
    ]),
  ];
  const csv = rows.map((row) => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
