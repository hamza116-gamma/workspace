'use client';

import { Icon } from '@/components/ui/Icon';
import { shortWhen } from '@/lib/relativeDays';
import type { ActivitySummary } from '@/lib/notifications';
import styles from './Activity.module.css';

type Props = {
  mentionCount: number;
  oldestMentionAt: string | null;
  savedCount: number;
  savedToday: number;
  summary: ActivitySummary | null;
};

const Kpi = ({
  label,
  icon,
  tone,
  value,
  foot,
  glow = false,
}: {
  label: string;
  icon: React.ReactNode;
  tone?: 'warn' | 'info' | 'pos';
  value: React.ReactNode;
  foot: React.ReactNode;
  glow?: boolean;
}) => (
  <div className={styles.kpi}>
    {glow && <div className={styles.kpiGlow} aria-hidden />}
    <div className={styles.kpiTop}>
      <span className={styles.eyebrow}>{label}</span>
      <span className={`${styles.kpiIc} ${tone ? styles[tone] : ''}`}>{icon}</span>
    </div>
    <div className={styles.kpiVal}>{value}</div>
    <div className={styles.kpiFoot}>{foot}</div>
  </div>
);

const changeVsYesterday = (summary: ActivitySummary) => {
  const { messagesToday: today, messagesYesterday: yesterday } = summary;
  if (!yesterday) {
    return today ? 'none yesterday' : 'quiet so far today';
  }
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return (
    <>
      <span className={pct >= 0 ? styles.up : styles.down}>
        {pct >= 0 ? '+' : ''}
        {pct}%
      </span>
      vs yesterday
    </>
  );
};

const TrendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 17 9 12l3.5 3.5L20 8" />
  </svg>
);

// The four KPI tiles at the top of Activity (design: .grid.g4 > .kpi).
export const ActivityKpis = ({ mentionCount, oldestMentionAt, savedCount, savedToday, summary }: Props) => (
  <div className={styles.g4}>
    <Kpi
      glow
      label="Unread mentions"
      tone="warn"
      icon="@"
      value={mentionCount}
      foot={oldestMentionAt ? `oldest from ${shortWhen(oldestMentionAt)}` : 'nothing waiting'}
    />
    <Kpi
      label="Threads you follow"
      tone="info"
      icon={<Icon name="message" size={15} />}
      value={summary ? summary.threadsFollowed : '–'}
      foot={summary ? `${summary.threadsWithNewReplies} with new replies` : '—'}
    />
    <Kpi
      label="Messages today"
      icon={<TrendIcon />}
      value={summary ? summary.messagesToday : '–'}
      foot={summary ? changeVsYesterday(summary) : '—'}
    />
    <Kpi
      label="Saved for later"
      tone="pos"
      icon={<Icon name="bookmark" size={15} />}
      value={savedCount}
      foot={
        savedToday ? `${savedToday} saved today` : savedCount ? 'in your saved items' : 'nothing saved yet'
      }
    />
  </div>
);
