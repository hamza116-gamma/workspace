'use client';

import { useMemo } from 'react';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { usePresence } from '@/hooks/usePresence';

/**
 * Active workspace members who are not offline (live via presence events);
 * null until the member list has loaded, so callers never flash "0".
 */
export const useOnlineCount = () => {
  const members = useOrgMembers();
  const presence = usePresence();
  return useMemo(
    () =>
      members.length === 0
        ? null
        : members.filter(
            (m) => m.status === 'ACTIVE' && (presence[m.user.id] ?? m.user.presence) !== 'OFFLINE',
          ).length,
    [members, presence],
  );
};
