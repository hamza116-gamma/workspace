'use client';

import { ChangeEvent, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { getAvatarSignature, uploadToCloudinary, updateAvatar } from '@/lib/users';
import { getInitials } from '@/lib/initials';
import { Alert } from '@/components/ui/Alert';
import { Icon } from '@/components/ui/Icon';
import type { PresenceState } from '@/types/user';
import styles from './ProfileIdCard.module.css';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const PRESENCE_LABEL: Record<PresenceState, string> = {
  ACTIVE: 'Active',
  AWAY: 'Away',
  DND: 'Do not disturb',
  OFFLINE: 'Offline',
};

export const ProfileIdCard = () => {
  const { user, setUser } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setError('');

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Unsupported image type');
      return;
    }

    setLoading(true);
    try {
      const signature = await getAvatarSignature();
      if (file.size > signature.maxUploadBytes) {
        setError('File size exceeds the allowed limit');
        return;
      }
      const uploaded = await uploadToCloudinary(file, signature);
      const result = await updateAvatar(uploaded.public_id, uploaded.secure_url);
      setUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className={styles.card}>
      <span className={styles.avatarWrap}>
        {user?.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt="Profile photo"
            width={96}
            height={96}
            className={styles.avatar}
          />
        ) : (
          <span className={styles.monogram}>{getInitials(user?.fullName ?? '?')}</span>
        )}
        <label className={styles.photoButton} title="Change photo">
          <Icon name="pencil" size={14} />
          <span>{loading ? 'Uploading…' : 'Change photo'}</span>
          <input
            type="file"
            accept="image/*"
            className={styles.fileInput}
            disabled={loading}
            onChange={onChange}
          />
        </label>
      </span>

      <div className={styles.identity}>
        <h1 className={styles.name}>{user?.fullName ?? 'Your profile'}</h1>
        <p className={styles.email}>{user?.email}</p>
        <p className={styles.meta}>
          {[user?.jobTitle, user?.department].filter(Boolean).join(' · ') || 'Add your role details'}
        </p>
        {user?.statusMessage && (
          <p className={styles.status}>
            {user.statusEmoji ? `${user.statusEmoji} ` : ''}
            {user.statusMessage}
          </p>
        )}
        <span className={styles.presence}>
          <span className={`${styles.dot} ${styles[user?.presence ?? 'OFFLINE']}`} aria-hidden />
          {PRESENCE_LABEL[user?.presence ?? 'OFFLINE']}
        </span>
      </div>

      {error && <Alert>{error}</Alert>}
    </aside>
  );
};
