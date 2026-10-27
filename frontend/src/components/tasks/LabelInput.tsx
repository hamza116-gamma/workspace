'use client';

import { useState } from 'react';
import styles from './Tasks.module.css';

const MAX_LABELS = 10;
const MAX_LENGTH = 30;

/** Label chips: type and press Enter or comma to add, × or Backspace to remove. */
export const LabelInput = ({
  value,
  disabled = false,
  onChange,
}: {
  value: string[];
  disabled?: boolean;
  onChange: (labels: string[]) => void;
}) => {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const label = raw.trim().toLowerCase().slice(0, MAX_LENGTH);
    if (label && !value.includes(label) && value.length < MAX_LABELS) {
      onChange([...value, label]);
    }
    setDraft('');
  };

  return (
    <div className={styles.mentionField}>
      <label htmlFor="task-labels" className={styles.mentionLabel}>
        Labels <span className={styles.optional}>(optional)</span>
      </label>
      <div className={`${styles.labelBox} ${disabled ? styles.labelBoxDisabled : ''}`}>
        {value.map((label) => (
          <span key={label} className={styles.labelChip}>
            {label}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={() => onChange(value.filter((item) => item !== label))}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!disabled && value.length < MAX_LABELS && (
          <input
            id="task-labels"
            value={draft}
            maxLength={MAX_LENGTH}
            placeholder={value.length ? '' : 'bug, frontend…'}
            onChange={(event) => setDraft(event.target.value.replace(',', ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                add(draft);
              } else if (event.key === 'Backspace' && !draft && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => draft && add(draft)}
          />
        )}
      </div>
    </div>
  );
};
