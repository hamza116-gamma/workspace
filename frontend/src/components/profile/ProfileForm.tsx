'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { updateMe } from '@/lib/users';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import styles from './ProfileForm.module.css';

export const ProfileForm = () => {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage ?? '');
  const [statusEmoji, setStatusEmoji] = useState(user?.statusEmoji ?? '');
  const [statusClearAt, setStatusClearAt] = useState((user?.statusClearAt ?? '').slice(0, 16));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await updateMe({
        fullName,
        jobTitle,
        department,
        statusMessage,
        statusEmoji,
        statusClearAt: statusClearAt ? new Date(statusClearAt).toISOString() : null,
      });
      setUser(result.user);
      setMessage('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      <div className={styles.grid}>
        <Input
          label="Full name"
          name="fullName"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <Input
          label="Job title"
          name="jobTitle"
          value={jobTitle}
          onChange={(event) => setJobTitle(event.target.value)}
        />
        <Input
          label="Department"
          name="department"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        />
      </div>

      <div className={styles.statusRow}>
        <Input
          label="Status emoji"
          name="statusEmoji"
          value={statusEmoji}
          onChange={(event) => setStatusEmoji(event.target.value)}
        />
        <Input
          label="Status message"
          name="statusMessage"
          value={statusMessage}
          onChange={(event) => setStatusMessage(event.target.value)}
        />
        <Input
          label="Clear status after"
          name="statusClearAt"
          type="datetime-local"
          value={statusClearAt}
          onChange={(event) => setStatusClearAt(event.target.value)}
        />
      </div>

      <div className={styles.actions}>
        <Button type="submit" loading={loading}>
          Save changes
        </Button>
      </div>
    </form>
  );
};
