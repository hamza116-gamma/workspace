'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import styles from './Input.module.css';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  trailing?: React.ReactNode;
  labelAction?: React.ReactNode;
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, id, name, className = '', trailing, labelAction, ...rest }, ref) => {
    const inputId = id || name;

    return (
      <div className={styles.field}>
        <div className={styles.labelRow}>
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
            className={[styles.input, error ? styles.inputError : '', trailing ? styles.hasTrailing : '', className]
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
