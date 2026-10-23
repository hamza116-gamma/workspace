'use client';

import { useCallback, useEffect, useState } from 'react';
import { listSessions, revokeOtherSessions, revokeSession } from '@/lib/sessions';
import { formatFullTimestamp } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Chip } from '@/components/ui/Chip';
import { Spinner } from '@/components/ui/Spinner';
import type { UserSession } from '@/types/session';
import styles from './SessionsList.module.css';

// Rough "Browser on OS" label from a user-agent string.
const describeDevice = (userAgent: string) => {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return os ? `${browser} on ${os}` : browser;
};

export const SessionsList = () => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setSessions((await listSessions()).sessions);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy('');
    }
  };

  const others = sessions.filter((session) => !session.current);

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {error && <Alert>{error}</Alert>}
      <ul className={styles.list}>
        {sessions.map((session) => (
          <li key={session.id} className={styles.row}>
            <div className={styles.info}>
              <span className={styles.device}>
                {describeDevice(session.userAgent)}
                {session.current && <Chip tone="good">This device</Chip>}
              </span>
              <span className={styles.meta}>
                {session.ipAddress || 'Unknown IP'} · signed in{' '}
                {formatFullTimestamp(session.createdAt)}
              </span>
            </div>
            {!session.current && (
              <Button
                variant="ghost"
                loading={busy === session.id}
                disabled={Boolean(busy)}
                onClick={() => void run(session.id, () => revokeSession(session.id))}
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <div className={styles.actions}>
          <Button
            variant="danger"
            loading={busy === 'others'}
            disabled={Boolean(busy)}
            onClick={() => {
              if (window.confirm('Sign out of all other devices?')) {
                void run('others', revokeOtherSessions);
              }
            }}
          >
            Sign out all other devices
          </Button>
        </div>
      )}
    </div>
  );
};
