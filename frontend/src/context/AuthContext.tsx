'use client';

import { clearCache } from '@/lib/cache';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as authApi from '@/lib/auth';
import { applyTheme, watchSystemTheme } from '@/lib/theme';
import type { User } from '@/types/user';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: {
    fullName: string;
    email: string;
    password: string;
    organizationName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await authApi.getMe();
      setUser(result.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const theme = user?.theme;
  useEffect(() => {
    if (!theme) {
      return;
    }
    applyTheme(theme);
    return watchSystemTheme(theme);
  }, [theme]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      setUser,
      login: async (email, password) => {
        const result = await authApi.login({ email, password });
        clearCache();
        setUser(result.user);
      },
      register: async (body) => {
        const result = await authApi.register(body);
        clearCache();
        setUser(result.user);
      },
      logout: async () => {
        await authApi.logout();
        clearCache();
        setUser(null);
      },
    }),
    [user, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
