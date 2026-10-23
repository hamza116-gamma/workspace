import { apiData } from './api';
import type { UserSession } from '@/types/session';

export const listSessions = () => apiData<{ sessions: UserSession[] }>('/users/me/sessions');

export const revokeSession = (sessionId: string) =>
  apiData<{ message: string }>(`/users/me/sessions/${sessionId}`, { method: 'DELETE' });

export const revokeOtherSessions = () =>
  apiData<{ revoked: number }>('/users/me/sessions/revoke-others', { method: 'POST' });
