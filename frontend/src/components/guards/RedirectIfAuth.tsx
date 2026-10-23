'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { nextFromLocation } from '@/lib/redirect';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';

export const RedirectIfAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextFromLocation('/'));
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
};
