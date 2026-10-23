'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { listOrganizations, switchOrganization } from '@/lib/organizations';
import { reconnectSocket } from '@/lib/socket';
import { clearCache, setCacheScope } from '@/lib/cache';
import type { Organization } from '@/types/organization';

type OrgContextValue = {
  organizations: Organization[];
  active: Organization | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  switchOrg: (organizationId: string) => Promise<void>;
};

export const OrgContext = createContext<OrgContextValue | null>(null);

export const OrgProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setLoading(false);
      return;
    }
    try {
      const result = await listOrganizations();
      setOrganizations(result.organizations);
      setError('');
    } catch (err) {
      setOrganizations([]);
      setError(err instanceof Error ? err.message : 'Unable to load organizations');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchOrg = useCallback(
    async (organizationId: string) => {
      await switchOrganization(organizationId);
      // Never show the previous workspace's cached chats.
      clearCache();
      reconnectSocket();
      await refresh();
    },
    [refresh],
  );

  const active = useMemo(
    () => organizations.find((organization) => organization.isActive) ?? null,
    [organizations],
  );

  // The memory cache belongs to one account + workspace. Set during render
  // (idempotent) so no child reads another workspace's entries first.
  setCacheScope(user && active ? `${user.id}:${active.id}` : null);

  const value = useMemo<OrgContextValue>(
    () => ({ organizations, active, loading, error, refresh, switchOrg }),
    [organizations, active, loading, error, refresh, switchOrg],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
};
