'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createInviteLink,
  disableInviteLink,
  getInviteLink,
  type InviteLink,
} from '@/lib/inviteLink';
import { formatFullTimestamp } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import styles from './Settings.module.css';

export const InviteLinkSettings = ({ organizationId }: { organizationId: string }) => {
  const [link, setLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLink((await getInviteLink(organizationId)).link);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the invite link');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<InviteLink | null>) => {
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      setLink(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const onCreate = () => run(async () => (await createInviteLink(organizationId)).link);

  const onRegenerate = () => {
    if (window.confirm('Regenerate the link? The current link will stop working.')) {
      void onCreate();
    }
  };

  const onDisable = () => {
    if (window.confirm('Turn off the invite link? Nobody will be able to join with it.')) {
      void run(async () => {
        await disableInviteLink(organizationId);
        return null;
      });
    }
  };

  const onCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the link and copy it manually.');
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Invite link</h2>
      </div>
      <div className={styles.cardBody}>
        <p className={styles.hint}>
          Anyone with this link can join the workspace as a Member. Links last 30 days.
        </p>
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className={styles.center}>
            <Spinner />
          </div>
        ) : link ? (
          <>
            <div className={styles.linkBox}>
              <span className={styles.linkText} title={link.url}>
                {link.url}
              </span>
              <Button variant="secondary" type="button" onClick={() => void onCopy()}>
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            <p className={styles.hint}>Expires {formatFullTimestamp(link.expiresAt)}.</p>
            <div className={styles.actions}>
              <Button variant="ghost" type="button" disabled={busy} onClick={onRegenerate}>
                Regenerate
              </Button>
              <Button variant="danger" type="button" disabled={busy} onClick={onDisable}>
                Turn off
              </Button>
            </div>
          </>
        ) : (
          <div className={styles.actions}>
            <Button type="button" loading={busy} onClick={() => void onCreate()}>
              Create invite link
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
