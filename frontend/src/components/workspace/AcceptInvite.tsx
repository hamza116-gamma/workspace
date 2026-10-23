'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvitation } from '@/lib/organizations';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import styles from './AcceptInvite.module.css';

export const AcceptInvite = () => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (loading || started.current) {
      return;
    }
    started.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setError('This invitation link is missing its token.');
      return;
    }

    if (!user) {
      router.replace(`/register?invite=${encodeURIComponent(token)}`);
      return;
    }

    (async () => {
      try {
        await acceptInvitation(token);
        router.replace('/channels');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to accept invitation');
      }
    })();
  }, [loading, user, router]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {error ? (
          <>
            <Alert>{error}</Alert>
            <p className={styles.hint}>
              Sign in with the email the invitation was sent to, then open the link again.
            </p>
          </>
        ) : (
          <>
            <Spinner />
            <p className={styles.hint}>Preparing your invitation…</p>
          </>
        )}
      </div>
    </div>
  );
};
