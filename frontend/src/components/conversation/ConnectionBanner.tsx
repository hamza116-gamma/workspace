'use client';

import { useSocket } from '@/hooks/useSocket';
import styles from './ConnectionBanner.module.css';

export const ConnectionBanner = () => {
  const { connected, everConnected } = useSocket();

  if (!everConnected || connected) {
    return null;
  }

  return (
    <div className={styles.banner} role="status">
      Connection lost — reconnecting…
    </div>
  );
};
