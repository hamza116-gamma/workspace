'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { updateMe } from '@/lib/users';
import { applyTheme } from '@/lib/theme';
import { Icon } from '@/components/ui/Icon';
import styles from './RailButton.module.css';

const isDarkNow = () =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

/** Moon/sun toggle; persists via the same user.theme preference as Profile > Appearance. */
export const RailThemeToggle = () => {
  const { user, setUser } = useAuth();
  const [dark, setDark] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDark(isDarkNow());
    const observer = new MutationObserver(() => setDark(isDarkNow()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [user?.theme]);

  const onToggle = async () => {
    const next = dark ? 'LIGHT' : 'DARK';
    applyTheme(next);
    setBusy(true);
    try {
      const result = await updateMe({ theme: next });
      setUser(result.user);
    } catch {
      if (user?.theme) {
        applyTheme(user.theme);
      }
    } finally {
      setBusy(false);
    }
  };

  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={() => void onToggle()}
      disabled={busy}
      aria-label={label}
      title={label}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  );
};
