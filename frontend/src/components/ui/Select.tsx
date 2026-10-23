'use client';

import { SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

export const Select = ({ label, error, id, name, className = '', children, ...rest }: Props) => {
  const selectId = id || name;

  return (
    <div className={styles.field}>
      <label htmlFor={selectId} className={styles.label}>
        {label}
      </label>
      <select
        id={selectId}
        name={name}
        className={[styles.select, error ? styles.selectError : '', className]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {children}
      </select>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};
