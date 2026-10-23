'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import styles from './page.module.css';

const PRESENCE_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  AWAY: 'Away',
  DND: 'Do not disturb',
  OFFLINE: 'Offline',
};

export default function HomePage() {
  const { user } = useAuth();
  const { active } = useOrg();

  if (!user) {
    return null;
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>{active ? active.name : 'Workspace'}</p>
        <h1 className={styles.title}>Welcome back, {user.fullName.split(' ')[0]}</h1>
        <p className={styles.subtitle}>
          Signed in as {user.email} · {PRESENCE_LABEL[user.presence] ?? user.presence}
        </p>
        <div className={styles.actions}>
          <Link href="/channels" className={styles.primaryAction}>
            Go to channels
          </Link>
          <Link href="/profile" className={styles.secondaryAction}>
            Manage profile
          </Link>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.card}>
          <p className={styles.cardLabel}>Job title</p>
          <p className={styles.cardValue}>{user.jobTitle || 'Not set'}</p>
        </div>
        <div className={styles.card}>
          <p className={styles.cardLabel}>Department</p>
          <p className={styles.cardValue}>{user.department || 'Not set'}</p>
        </div>
        <div className={styles.card}>
          <p className={styles.cardLabel}>Status</p>
          <p className={styles.cardValue}>{user.statusMessage || 'No status set'}</p>
        </div>
      </section>
    </div>
  );
}
