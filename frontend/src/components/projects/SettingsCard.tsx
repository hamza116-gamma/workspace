import type { ReactNode } from 'react';
import styles from './ProjectSettings.module.css';

/** A titled card; `foot` is its action bar. */
export const SettingsCard = ({
  title,
  text,
  danger = false,
  foot,
  children,
}: {
  title: string;
  text: ReactNode;
  danger?: boolean;
  foot?: ReactNode;
  children: ReactNode;
}) => (
  <section className={`${styles.card} ${danger ? styles.danger : ''}`}>
    <header className={styles.cardHead}>
      <div>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardText}>{text}</p>
      </div>
    </header>
    <div className={styles.cardBody}>{children}</div>
    {foot && <footer className={styles.cardFoot}>{foot}</footer>}
  </section>
);
