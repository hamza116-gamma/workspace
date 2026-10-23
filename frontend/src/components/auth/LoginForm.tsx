'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { nextFromLocation } from '@/lib/redirect';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { EyeToggle } from './EyeToggle';
import styles from './authForm.module.css';

export const LoginForm = () => {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const next = nextFromLocation('/');
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      {error && <Alert>{error}</Alert>}

      <Input
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="name@company.com"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <Input
        label="Password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="Enter your password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        labelAction={
          <Link className={styles.link} href="/forgot-password">
            Forgot password?
          </Link>
        }
        trailing={
          <EyeToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
        }
      />

      <Button type="submit" fullWidth loading={loading}>
        Sign in
      </Button>

      <p className={styles.center}>
        Don&apos;t have an account?{' '}
        <Link className={styles.link} href="/register">
          Create workspace
        </Link>
      </p>
    </form>
  );
};
