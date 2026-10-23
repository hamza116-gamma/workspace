import type { User } from '@/types/user';
import type { DndUpdate } from './users';

/** True while the user's notifications are paused. */
export const isDndActive = (user: Pick<User, 'dndUntil'> | null | undefined, now = Date.now()) =>
  Boolean(user?.dndUntil && new Date(user.dndUntil).getTime() > now);

/** Next 9:00 tomorrow (local time). */
export const tomorrowAtNine = (now = new Date()) => {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
};

export type DndPreset = { label: string; update: () => DndUpdate };

export const DND_PRESETS: DndPreset[] = [
  { label: 'For 30 minutes', update: () => ({ minutes: 30 }) },
  { label: 'For 1 hour', update: () => ({ minutes: 60 }) },
  { label: 'For 2 hours', update: () => ({ minutes: 120 }) },
  { label: 'Until tomorrow 9:00', update: () => ({ until: tomorrowAtNine().toISOString() }) },
];

/** "Paused until 3:30 PM" / "Paused until Tue 9:00 AM". */
export const formatDndUntil = (iso: string) => {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`;
};
