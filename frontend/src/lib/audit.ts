import { apiData } from './api';
import type { AuditPage } from '@/types/audit';

export const listAuditLog = (
  organizationId: string,
  { action, before }: { action?: string; before?: string } = {},
) => {
  const params = new URLSearchParams();
  if (action) params.set('action', action);
  if (before) params.set('before', before);
  const query = params.toString();
  return apiData<AuditPage>(`/organizations/${organizationId}/audit${query ? `?${query}` : ''}`);
};
