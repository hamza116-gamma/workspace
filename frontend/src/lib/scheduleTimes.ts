/** Send-later presets (local time) for the schedule menu. */
export const tomorrowAt9 = (now = new Date()) => {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
};

export const nextMondayAt9 = (now = new Date()) => {
  const date = new Date(now);
  const days = (8 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date;
};

export const MIN_AHEAD_MS = 60 * 1000;
export const MAX_AHEAD_MS = 120 * 24 * 60 * 60 * 1000;

/** Value for <input type="datetime-local"> in local time. */
export const toLocalInputValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

/** Error text for a chosen time, or '' when it can be scheduled. */
export const scheduleTimeError = (date: Date, now = Date.now()) => {
  if (Number.isNaN(date.getTime())) return 'Pick a date and time';
  if (date.getTime() < now + MIN_AHEAD_MS) return 'Pick a time at least 1 minute from now';
  if (date.getTime() > now + MAX_AHEAD_MS) return 'You can schedule up to 120 days ahead';
  return '';
};

/** "Tomorrow at 9:00 AM" / "Mon, Oct 27 at 9:00 AM". */
export const formatScheduleTime = (value: string | Date) => {
  const date = new Date(value);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return `today at ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  const day = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} at ${time}`;
};
