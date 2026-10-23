'use client';

import { useEffect, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { listOrganizationMembers } from '@/lib/organizations';
import type { OrganizationMember } from '@/types/organization';

// Read-only member list of the active workspace (Activity "Who's around").
export const useOrgMembers = () => {
  const { active } = useOrg();
  const [members, setMembers] = useState<OrganizationMember[]>([]);

  useEffect(() => {
    if (!active?.id) {
      return;
    }
    let cancelled = false;
    listOrganizationMembers(active.id)
      .then((result) => !cancelled && setMembers(result.members))
      .catch(() => !cancelled && setMembers([]));
    return () => {
      cancelled = true;
    };
  }, [active?.id]);

  return members;
};
