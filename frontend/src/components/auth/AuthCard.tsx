'use client';

import { useHealth } from '@/hooks/useHealth';
import { AuthShowcase } from './AuthShowcase';
import styles from './AuthCard.module.css';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
};

const BrandMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <rect x="1" y="1" width="6" height="6" rx="1.5" />
    <rect x="9" y="1" width="6" height="6" rx="1.5" />
    <rect x="1" y="9" width="6" height="6" rx="1.5" />
    <rect x="9" y="9" width="6" height="6" rx="1.5" />
  </svg>
);

export const AuthCard = ({ title, subtitle, children, className = '' }: Props) => {
  const { status } = useHealth();
  const online = status === 'ok';

  return (
    <main className={`${styles.shell} ${className}`}>
      <section className={styles.panel}>
        <header className={styles.topRow}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>
              <BrandMark />
            </span>
            <span className={styles.brandName}>Workspace</span>
            <span className={styles.brandDot} />
          </div>

          <span className={`${styles.chip} ${online ? '' : styles.chipDown}`}>
            <span className={styles.chipDot} />
            {online ? 'System Operational' : status === 'loading' ? 'Checking system' : 'System Degraded'}
          </span>
        </header>

        <div className={styles.formWrap}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          <div className={styles.body}>{children}</div>
        </div>

        <footer className={styles.panelFooter}>
          <span>© 2026 Workspace Technologies, Inc.</span>
          <span className={styles.footerLinks}>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Security</span>
          </span>
        </footer>
      </section>

      <AuthShowcase />
    </main>
  );
};
