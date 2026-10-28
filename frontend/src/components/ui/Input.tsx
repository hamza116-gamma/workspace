'use client';

import { InputHTMLAttributes, forwardRef, type CSSProperties } from 'react';
import styles from './Input.module.css';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  // Keep the label for screen readers only (the row around it shows one).
  hideLabel?: boolean;
  error?: string;
  trailing?: React.ReactNode;
  labelAction?: React.ReactNode;
};

const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
};

export const Input = forwardRef<HTMLInputElement, Props>(
  (
    { label, hideLabel = false, error, id, name, className = '', trailing, labelAction, ...rest },
    ref,
  ) => {
    const inputId = id || name;

    return (
      <div className={styles.field}>
        <div className={styles.labelRow} style={hideLabel ? VISUALLY_HIDDEN : undefined}>
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
          {labelAction}
        </div>
        <div className={styles.control}>
          <input
            ref={ref}
            id={inputId}
            name={name}
            className={[
              styles.input,
              error ? styles.inputError : '',
              trailing ? styles.hasTrailing : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...rest}
          />
          {trailing && <span className={styles.trailing}>{trailing}</span>}
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
