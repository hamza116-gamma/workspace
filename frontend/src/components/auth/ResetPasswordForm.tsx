'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { resetPassword } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import styles from './authForm.module.css';

export const ResetPasswordForm = () => {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') ?? '');
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(token, password);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Alert>
        This reset link is missing its token. Request a new link from the{' '}
        <Link href="/forgot-password">forgot password</Link> page.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      {error && <Alert>{error}</Alert>}
      {message && (
        <Alert tone="success">
          {message}. <Link href="/login">Sign in</Link>
        </Alert>
      )}
      <Input
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Input
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
      />
      <Button type="submit" fullWidth loading={loading}>
        Reset password
      </Button>
    </form>
  );
};
