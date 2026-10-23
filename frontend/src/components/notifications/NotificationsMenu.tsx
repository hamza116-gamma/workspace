'use client';

import { useEffect, useState } from 'react';
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu';
import { useDnd } from '@/hooks/useDnd';
import { DND_PRESETS, formatDndUntil } from '@/lib/dnd';
import {
  desktopPermission,
  readNotifyPrefs,
  requestDesktopPermission,
  writeNotifyPrefs,
  type NotifyPrefs,
} from '@/lib/desktopNotify';
import styles from './NotificationsMenu.module.css';

// Rail bell: pause notifications (DND) presets, resume, and per-device
// desktop / sound toggles.
export const NotificationsMenu = () => {
  const { active, dndUntil, pause, resume } = useDnd();
  const [prefs, setPrefs] = useState<NotifyPrefs>({ desktop: true, sound: true });
  const [permission, setPermission] = useState<string>('default');

  useEffect(() => {
    setPrefs(readNotifyPrefs());
    setPermission(desktopPermission());
  }, []);

  const updatePrefs = (next: NotifyPrefs) => {
    setPrefs(next);
    writeNotifyPrefs(next);
  };

  const toggleDesktop = async () => {
    if (!prefs.desktop || permission === 'granted') {
      updatePrefs({ ...prefs, desktop: !prefs.desktop });
      return;
    }
    const result = await requestDesktopPermission();
    setPermission(result);
    updatePrefs({ ...prefs, desktop: true });
  };

  const run = (action: () => Promise<void>) => () => {
    action().catch(() => {});
  };

  const desktopLabel =
    permission === 'unsupported'
      ? 'Desktop notifications (unsupported)'
      : permission === 'denied'
        ? 'Desktop notifications (blocked)'
        : permission === 'granted'
          ? 'Desktop notifications'
          : 'Desktop notifications (allow…)';

  const items: MenuItem[] = [
    {
      heading: true,
      label: active && dndUntil ? `Paused until ${formatDndUntil(dndUntil)}` : 'Pause notifications',
    },
    ...(active
      ? [{ label: 'Resume notifications', icon: 'bell' as const, onSelect: run(resume) }]
      : []),
    ...DND_PRESETS.map((preset) => ({
      label: active ? `Pause ${preset.label.toLowerCase()}` : preset.label,
      icon: 'moon' as const,
      onSelect: run(() => pause(preset.update())),
    })),
    { separator: true },
    {
      label: desktopLabel,
      checked: prefs.desktop && permission === 'granted',
      disabled: permission === 'unsupported' || permission === 'denied',
      onSelect: () => void toggleDesktop(),
    },
    {
      label: 'Notification sound',
      checked: prefs.sound,
      onSelect: () => updatePrefs({ ...prefs, sound: !prefs.sound }),
    },
  ];

  return (
    <DropdownMenu
      items={items}
      align="left"
      icon={active ? 'moon' : 'bell'}
      label={active && dndUntil ? `Notifications paused until ${formatDndUntil(dndUntil)}` : 'Notifications'}
      triggerClassName={`${styles.trigger} ${active ? styles.paused : ''}`}
      triggerContent={active ? <span className={styles.badge} aria-hidden>z</span> : null}
    />
  );
};
