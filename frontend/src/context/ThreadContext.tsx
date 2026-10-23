'use client';

import { createContext, useCallback, useMemo, useState } from 'react';
import { useDelayedClose } from '@/hooks/useDelayedClose';

type ThreadValue = {
  rootId: string | null;
  open: boolean;
  /** True while the panel plays its slide-out before closing. */
  closing: boolean;
  openThread: (rootId: string) => void;
  closeThread: () => void;
};

export const ThreadContext = createContext<ThreadValue | null>(null);

export const ThreadProvider = ({ children }: { children: React.ReactNode }) => {
  const [rootId, setRootId] = useState<string | null>(null);

  const { closing, close, cancel } = useDelayedClose();

  const openThread = useCallback(
    (id: string) => {
      cancel();
      setRootId(id);
    },
    [cancel],
  );
  const closeThread = useCallback(() => close(() => setRootId(null)), [close]);

  const value = useMemo<ThreadValue>(
    () => ({ rootId, open: Boolean(rootId), closing, openThread, closeThread }),
    [rootId, closing, openThread, closeThread],
  );

  return <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>;
};
