'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { nextFromLocation } from '@/lib/redirect';
import { useAuth } from '@/hooks/useAuth';
import { acceptInvitation, lookupInvitation } from '@/lib/organizations';
import { joinWithInviteLink, lookupInviteLink } from '@/lib/inviteLink';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { EyeToggle } from './EyeToggle';
import styles from './authForm.module.css';

export const RegisterForm = () => {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [inviteToken, setInviteToken] = useState('');
  const [invitedOrg, setInvitedOrg] = useState('');
  const [lookupError, setLookupError] = useState('');

  // ?join=<token>: shareable workspace link (/join page).
  const [joinToken, setJoinToken] = useState('');

  const isInvite = Boolean(inviteToken);
  const skipWorkspace = isInvite || Boolean(joinToken);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const join = params.get('join');
    if (join && !params.get('invite')) {
      setJoinToken(join);
      lookupInviteLink(join)
        .then((result) => setInvitedOrg(result.workspace.organizationName))
        .catch((err) =>
          setLookupError(err instanceof Error ? err.message : 'This invite link is invalid'),
        );
      return;
    }
    const token = params.get('invite');
    if (!token) {
      return;
    }
    setInviteToken(token);
    lookupInvitation(token)
      .then((result) => {
        setEmail(result.invitation.email);
        setInvitedOrg(result.invitation.organizationName);
      })
      .catch((err) =>
        setLookupError(
          err instanceof Error ? err.message : 'This invitation is invalid or has expired',
        ),
      );
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
      await register({
        fullName,
        email,
        password,
        ...(skipWorkspace ? {} : { organizationName }),
      });

      if (isInvite) {
        await acceptInvitation(inviteToken);
        router.replace('/channels');
      } else if (joinToken) {
        await joinWithInviteLink(joinToken);
        router.replace('/channels');
      } else {
        const next = nextFromLocation('/');
        router.replace(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setLoading(false);
    }
  };

  const signInHref = isInvite
    ? `/login?next=${encodeURIComponent(`/invite?token=${inviteToken}`)}`
    : joinToken
      ? `/login?next=${encodeURIComponent(`/join?token=${joinToken}`)}`
      : '/login';

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      {error && <Alert>{error}</Alert>}
      {lookupError && <Alert>{lookupError}</Alert>}
      {joinToken && invitedOrg && (
        <p className={styles.hint}>
          Create your account to join <strong>{invitedOrg}</strong>.
        </p>
      )}
      {isInvite && invitedOrg && (
        <p className={styles.hint}>
          You&apos;ve been invited to join <strong>{invitedOrg}</strong>. Create your account to
          accept.
        </p>
      )}

      <Input
        label="Full name"
        name="fullName"
        autoComplete="name"
        placeholder="Enter your full name"
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />

      <Input
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="name@company.com"
        required
        readOnly={isInvite}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        labelAction={isInvite ? <span className={styles.hint}>Invited</span> : undefined}
      />

      {!skipWorkspace && (
        <Input
          label="Workspace name"
          name="organizationName"
          autoComplete="organization"
          placeholder="Acme Inc."
          required
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
        />
      )}

      <div className={styles.group}>
        <Input
          label="Password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Create a password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          trailing={
            <EyeToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          }
        />
        <p className={styles.hint}>Must be at least 8 characters.</p>
      </div>

      <Input
        label="Confirm password"
        name="confirmPassword"
        type={showConfirm ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Re-enter your password"
        required
        minLength={8}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        trailing={<EyeToggle visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
      />

      <Button type="submit" fullWidth loading={loading}>
        {isInvite ? 'Create account & join' : 'Create account'}
      </Button>

      <p className={styles.center}>
        Already have an account?{' '}
        <Link className={styles.link} href={signInHref}>
          Sign in
        </Link>
      </p>
    </form>
  );
};
