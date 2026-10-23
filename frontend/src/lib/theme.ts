import type { ThemeName } from '@/types/user';

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

export const applyTheme = (theme: ThemeName): void => {
  if (typeof document === 'undefined') {
    return;
  }
  const dark = theme === 'DARK' || (theme === 'SYSTEM' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
};

/** "System" follows OS light/dark changes live; returns a cleanup. */
export const watchSystemTheme = (theme: ThemeName): (() => void) => {
  if (theme !== 'SYSTEM' || typeof window === 'undefined') {
    return () => undefined;
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => applyTheme('SYSTEM');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};
