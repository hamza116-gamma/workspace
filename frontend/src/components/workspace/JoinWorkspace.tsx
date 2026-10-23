'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { joinWithInviteLink, lookupInviteLink, type InviteLinkWorkspace } from '@/lib/inviteLink';
import { safeNextPath } from '@/lib/redirect';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import styles from './JoinWorkspace.module.css';

// /join?token=... - shareable workspace link. Signed-in users confirm and
// join; others sign in or create an account and come back here.
export const JoinWorkspace = () => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [token, setToken] = useState('');
  const [workspace, setWorkspace] = useState<InviteLinkWorkspace | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('token') ?? '';
    setToken(value);
    if (!value) {
      setError('This invite link is missing its token.');
      setChecking(false);
      return;
    }
    lookupInviteLink(value)
      .then((result) => setWorkspace(result.workspace))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'This invite link is invalid or has expired'),
      )
      .finally(() => setChecking(false));
  }, []);

  const next = safeNextPath(`/join?token=${encodeURIComponent(token)}`);

  const onJoin = async () => {
    setJoining(true);
    setError('');
    try {
      await joinWithInviteLink(token);
      // Full navigation so the workspace providers and socket start fresh.
      window.location.assign('/channels');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join the workspace');
      setJoining(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {checking || loading ? (
          <>
            <Spinner />
            <p className={styles.hint}>Checking your invite link…</p>
          </>
        ) : !workspace ? (
          <>
            <Alert>{error || 'This invite link is invalid or has expired.'}</Alert>
            <p className={styles.hint}>Ask a workspace admin for a new link.</p>
            <Button variant="ghost" onClick={() => router.replace(user ? '/' : '/login')}>
              {user ? 'Back to your workspace' : 'Go to sign in'}
            </Button>
          </>
        ) : (
          <>
            <span className={styles.eyebrow}>You&apos;re invited</span>
            <h1 className={styles.title}>Join {workspace.organizationName}</h1>
            {error && <Alert>{error}</Alert>}
            {user ? (
              <>
                <p className={styles.hint}>
                  You&apos;ll join as <strong>{user.email}</strong> with the Member role.
                </p>
                <Button fullWidth loading={joining} onClick={() => void onJoin()}>
                  Join workspace
                </Button>
              </>
            ) : (
              <>
                <p className={styles.hint}>Sign in or create an account to join.</p>
                <div className={styles.actions}>
                  <Link
                    className={styles.primary}
                    href={`/register?join=${encodeURIComponent(token)}`}
                  >
                    Create account
                  </Link>
                  <Link
                    className={styles.secondary}
                    href={`/login?next=${encodeURIComponent(next)}`}
                  >
                    Sign in
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
