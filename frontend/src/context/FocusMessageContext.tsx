'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

type Focus = { id: string; token: number };

type FocusMessageValue = {
  focus: Focus | null;
  focusMessage: (messageId: string) => void;
};

export const FocusMessageContext = createContext<FocusMessageValue | null>(null);

export const FocusMessageProvider = ({ children }: { children: React.ReactNode }) => {
  const [focus, setFocus] = useState<Focus | null>(null);
  const pathname = usePathname();

  // Deep links (/channels/:id?message=<id>, /dm/:id?message=<id>) are
  // re-read on every pathname change; other pages clear the focus.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('message');
    setFocus(id ? { id, token: Date.now() } : null);
  }, [pathname]);

  const focusMessage = useCallback((messageId: string) => {
    setFocus({ id: messageId, token: Date.now() });
  }, []);

  const value = useMemo<FocusMessageValue>(() => ({ focus, focusMessage }), [focus, focusMessage]);

  return (
    <FocusMessageContext.Provider value={value}>{children}</FocusMessageContext.Provider>
  );
};
