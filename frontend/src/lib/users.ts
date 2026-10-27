import { apiData } from './api';
import type { PresenceState, ThemeName, User } from '@/types/user';

export type AvatarSignature = {
  timestamp: number;
  signature: string;
  folder: string;
  cloudName: string;
  apiKey: string;
  maxUploadBytes: number;
};

export type ProfileUpdate = {
  fullName?: string;
  jobTitle?: string;
  department?: string;
  statusMessage?: string;
  statusEmoji?: string;
  statusClearAt?: string | null;
  presence?: PresenceState;
  theme?: ThemeName;
  // true after the welcome intro, false to replay it.
  introSeen?: boolean;
};

export type DndUpdate = { minutes: number } | { until: string } | { off: true };

// Pause notifications (Do Not Disturb) or resume them.
export const updateDnd = (body: DndUpdate) =>
  apiData<{ user: User }>('/users/me/dnd', { method: 'PATCH', body });

export const getAvatarSignature = () => apiData<AvatarSignature>('/users/me/avatar/signature');

export const updateAvatar = (publicId: string, url: string) =>
  apiData<{ user: User }>('/users/me/avatar', {
    method: 'PATCH',
    body: { publicId, url },
  });

export const updateMe = (body: ProfileUpdate) =>
  apiData<{ user: User }>('/users/me', { method: 'PATCH', body });

export const uploadToCloudinary = async (
  file: File,
  signature: AvatarSignature,
): Promise<{ public_id: string; secure_url: string }> => {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  form.append('folder', signature.folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    { method: 'POST', body: form },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.message ?? 'Upload failed');
  }

  return response.json();
};
