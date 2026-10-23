'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { updateMe } from '@/lib/users';
import { applyTheme } from '@/lib/theme';
import type { ThemeName } from '@/types/user';
import styles from './ThemeSelector.module.css';

const OPTIONS: { value: ThemeName; label: string; hint: string }[] = [
  { value: 'LIGHT', label: 'Light', hint: 'Paper background, ink text' },
  { value: 'DARK', label: 'Dark', hint: 'Ink background, paper text' },
  { value: 'SYSTEM', label: 'System', hint: 'Follow your device setting' },
];

export const ThemeSelector = () => {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const onChange = async (theme: ThemeName) => {
    setLoading(true);
    try {
      const result = await updateMe({ theme });
      applyTheme(result.user.theme);
      setUser(result.user);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.options} role="radiogroup" aria-label="Theme">
      {OPTIONS.map((option) => {
        const selected = user?.theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={loading}
            className={`${styles.option} ${selected ? styles.selected : ''}`}
            onClick={() => void onChange(option.value)}
          >
            <span className={`${styles.swatch} ${styles[option.value]}`} aria-hidden />
            <span className={styles.optionInfo}>
              <span className={styles.optionLabel}>{option.label}</span>
              <span className={styles.optionHint}>{option.hint}</span>
            </span>
            {selected && <span className={styles.check} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
};
