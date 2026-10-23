import styles from './PageHeader.module.css';

// Page title block (design: .split > eyebrow / .h1 / .sub + right actions).
export const PageHeader = ({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow: string;
  title: string;
  sub: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <header className={styles.split}>
    <div>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h1 className={styles.h1}>{title}</h1>
      <p className={styles.sub}>{sub}</p>
    </div>
    {actions && <div className={styles.row}>{actions}</div>}
  </header>
);
