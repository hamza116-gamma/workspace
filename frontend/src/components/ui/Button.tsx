'use client';

import { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'mint' | 'quiet';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'sm';
};

export const Button = ({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  size = 'md',
  className = '',
  children,
  disabled,
  ...rest
}: Props) => (
  <button
    className={[styles.button, styles[variant], fullWidth ? styles.full : '', size === 'sm' ? styles.sm : '', className]
      .filter(Boolean)
      .join(' ')}
    disabled={disabled || loading}
    {...rest}
  >
    {loading && <Spinner />}
    {children}
  </button>
);
