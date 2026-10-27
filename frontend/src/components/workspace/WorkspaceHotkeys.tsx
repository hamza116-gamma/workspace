'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/hooks/useOrg';
import { rememberRecentChat } from '@/lib/recentChats';
import { ShortcutsDialog } from './ShortcutsDialog';

const CHAT_ROUTE = /^\/(channels|dm)\/([0-9a-fA-F]{24})$/;

/** Global keys: Ctrl/Cmd+/ shortcuts list. (Ctrl/Cmd+K is components/search/QuickSearch.) */
export const WorkspaceHotkeys = () => {
  const pathname = usePathname();
  const { active } = useOrg();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === '/') {
        event.preventDefault();
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
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
};
