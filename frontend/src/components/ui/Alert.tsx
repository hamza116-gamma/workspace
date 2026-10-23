import styles from './Alert.module.css';

type Tone = 'error' | 'success' | 'info';

export const Alert = ({ tone = 'error', children }: { tone?: Tone; children: React.ReactNode }) => (
  <div role="alert" className={`${styles.alert} ${styles[tone]}`}>
    {children}
  </div>
);
