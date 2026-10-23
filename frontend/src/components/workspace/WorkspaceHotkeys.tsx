'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/hooks/useOrg';
import { rememberRecentChat } from '@/lib/recentChats';
import { QuickSwitcher } from './QuickSwitcher';
import { ShortcutsDialog } from './ShortcutsDialog';

const CHAT_ROUTE = /^\/(channels|dm)\/([0-9a-fA-F]{24})$/;

/** Global keys: Ctrl/Cmd+K quick switcher, Ctrl/Cmd+/ shortcuts list. */
export const WorkspaceHotkeys = () => {
  const pathname = usePathname();
  const { active } = useOrg();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        setShortcutsOpen(false);
        setSwitcherOpen((value) => !value);
      } else if (key === '/') {
        event.preventDefault();
        setSwitcherOpen(false);
        setShortcutsOpen((value) => !value);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Opened chats feed the switcher's "Recent" group.
  useEffect(() => {
    const match = CHAT_ROUTE.exec(pathname ?? '');
    if (match && active?.id) {
      rememberRecentChat(active.id, `${match[1] === 'dm' ? 'dm' : 'channel'}:${match[2]}`);
    }
  }, [pathname, active?.id]);

  return (
    <>
      <QuickSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
};
