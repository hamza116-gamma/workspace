'use client';

import { useRef } from 'react';
import styles from './Tasks.module.css';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Splits readable text into plain and "@Full Name" / @channel / @here parts.
const segments = (text: string, names: string[]) => {
  const all = [...names, 'channel', 'here'].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(@(?:${all.map(escapeRegExp).join('|')}))`, 'g');
  return text.split(pattern).map((part, index) => ({ part, mention: index % 2 === 1 }));
};

/** Readable text with mentions highlighted like in a message. */
export const MentionText = ({ text, names }: { text: string; names: string[] }) => (
  <>
    {segments(text, names).map(({ part, mention }, index) =>
      mention ? (
        <span key={index} className={styles.mention}>
          {part}
        </span>
      ) : (
        part
      ),
    )}
  </>
);

/**
 * Single-line input whose mentions get the message highlight. The text is
 * drawn by a layer behind a transparent input (same font, no width change).
 */
export const MentionInput = ({
  label,
  name,
  value,
  names,
  maxLength,
  autoFocus,
  disabled,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  names: string[];
  maxLength?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const sync = (event: React.SyntheticEvent<HTMLInputElement>) => {
    if (layerRef.current) {
      layerRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  };

  return (
    <div className={`${styles.mentionField} ${disabled ? styles.mentionDisabled : ''}`}>
      <label htmlFor={name} className={styles.mentionLabel}>
        {label}
      </label>
      <div className={styles.mentionControl}>
        <div ref={layerRef} className={styles.mentionLayer} aria-hidden>
          {segments(value, names).map(({ part, mention }, index) =>
            mention ? (
              <span key={index} className={styles.mentionMark}>
                {part}
              </span>
            ) : (
              <span key={index}>{part}</span>
            ),
          )}
        </div>
        <input
          id={name}
          name={name}
          className={styles.mentionInput}
          value={value}
          maxLength={maxLength}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            sync(event);
          }}
          onScroll={sync}
          onSelect={sync}
          onKeyUp={sync}
        />
      </div>
    </div>
  );
};
