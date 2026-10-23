import styles from './Spinner.module.css';

export const Spinner = ({ className = '' }: { className?: string }) => (
  <span role="status" aria-label="Loading" className={`${styles.spinner} ${className}`} />
);
