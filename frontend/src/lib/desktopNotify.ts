// Desktop notifications (Notification API) + a short Web Audio "knock".
// Preferences are per device (localStorage `notify.prefs`).

export type NotifyPrefs = { desktop: boolean; sound: boolean };

const PREFS_KEY = 'notify.prefs';
const DEFAULT_PREFS: NotifyPrefs = { desktop: true, sound: true };

export const readNotifyPrefs = (): NotifyPrefs => {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifyPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

export const writeNotifyPrefs = (prefs: NotifyPrefs) => {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable (private mode): prefs last for this page only
  }
};

export const desktopSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export const desktopPermission = (): NotificationPermission | 'unsupported' =>
  desktopSupported() ? Notification.permission : 'unsupported';

export const requestDesktopPermission = async () => {
  if (!desktopSupported()) {
    return 'unsupported' as const;
  }
  if (Notification.permission !== 'default') {
    return Notification.permission;
  }
  return Notification.requestPermission();
};

/** Shows a desktop popup; `tag` dedupes the same alert across tabs. */
export const showDesktopNotification = ({
  title,
  body,
  tag,
  icon,
  onClick,
}: {
  title: string;
  body: string;
  tag: string;
  icon?: string | null;
  onClick?: () => void;
}) => {
  if (!desktopSupported() || Notification.permission !== 'granted') {
    return;
  }
  try {
    const popup = new Notification(title, { body, tag, icon: icon ?? undefined });
    popup.onclick = () => {
      window.focus();
      popup.close();
      onClick?.();
    };
  } catch {
    // some browsers only allow notifications from a service worker
  }
};

let audioContext: AudioContext | null = null;

/** Two soft tones ("knock"); silently skipped if audio is blocked. */
export const playKnock = () => {
  try {
    audioContext = audioContext ?? new AudioContext();
    const context = audioContext;
    [0, 0.13].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + offset;
      oscillator.type = 'sine';
      oscillator.frequency.value = index === 0 ? 660 : 880;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.13);
    });
  } catch {
    // audio unavailable
  }
};
