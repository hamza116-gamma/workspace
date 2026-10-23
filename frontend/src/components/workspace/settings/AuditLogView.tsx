'use client';

import { useCallback, useEffect, useState } from 'react';
import { listAuditLog } from '@/lib/audit';
import { formatFullTimestamp } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { AuditEntry } from '@/types/audit';
import { AUDIT_ACTION_OPTIONS, describeAuditEntry } from './auditLabels';
import styles from './Settings.module.css';

export const AuditLogView = ({ organizationId }: { organizationId: string }) => {
  const [action, setAction] = useState('');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (before?: string) => {
      setLoading(true);
      setError('');
      try {
        const page = await listAuditLog(organizationId, { action, before });
        setEntries((current) => (before ? [...current, ...page.entries] : page.entries));
        setCursor(page.hasMore ? page.nextCursor : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load the audit log');
      } finally {
        setLoading(false);
      }
    },
    [organizationId, action],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Audit log</h2>
        <select
          className={styles.filter}
          value={action}
          aria-label="Filter by action"
          onChange={(event) => setAction(event.target.value)}
        >
          {AUDIT_ACTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <div className={styles.cardBody}>
          <Alert>{error}</Alert>
        </div>
      )}
      {loading && entries.length === 0 ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <p className={styles.muted}>No administrative actions recorded yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Who</th>
                <th>What</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <span className={styles.who}>
                      <Avatar
                        name={entry.actor?.fullName ?? 'System'}
                        src={entry.actor?.avatarUrl ?? null}
                        size={24}
                      />
                      {entry.actor?.fullName ?? 'System'}
                    </span>
                  </td>
                  <td>{describeAuditEntry(entry)}</td>
                  <td className={styles.when}>{formatFullTimestamp(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && (
        <div className={styles.more}>
          <Button variant="ghost" loading={loading} onClick={() => void load(cursor)}>
            Load older
          </Button>
        </div>
      )}
    </section>
  );
};
