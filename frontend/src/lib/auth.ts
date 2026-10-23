import { apiData } from './api';
import type { User } from '@/types/user';

type AuthResult = { user: User };

export const register = (body: {
  fullName: string;
  email: string;
  password: string;
  organizationName?: string;
}) => apiData<AuthResult>('/auth/register', { method: 'POST', body });

export const login = (body: { email: string; password: string }) =>
  apiData<AuthResult>('/auth/login', { method: 'POST', body });

export const logout = () => apiData<{ message: string }>('/auth/logout', { method: 'POST' });

export const requestPasswordReset = (email: string) =>
  apiData<{ message: string }>('/auth/password/reset', { method: 'POST', body: { email } });

export const resetPassword = (token: string, newPassword: string) =>
  apiData<{ message: string }>('/auth/password/reset/confirm', {
    method: 'POST',
    body: { token, newPassword },
  });

export const changePassword = (currentPassword: string, newPassword: string) =>
  apiData<{ message: string }>('/auth/password/change', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });

export const getMe = () => apiData<AuthResult>('/users/me');
