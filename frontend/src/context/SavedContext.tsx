'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useSocket } from '@/hooks/useSocket';
import { listBookmarks, saveMessage, unsaveMessage } from '@/lib/bookmarks';
import type { SavedMessage } from '@/types/saved';

type SavedValue = {
  items: SavedMessage[];
  savedIds: Set<string>;
  loading: boolean;
  save: (messageId: string) => Promise<void>;
  unsave: (messageId: string) => Promise<void>;
  toggleSave: (messageId: string) => Promise<void>;
  reload: () => Promise<void>;
};

export const SavedContext = createContext<SavedValue | null>(null);

export const SavedProvider = ({ children }: { children: React.ReactNode }) => {
  const { active } = useOrg();
  const { socket } = useSocket();
  const organizationId = active?.id;
  const [items, setItems] = useState<SavedMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const savedIds = useMemo(() => new Set(items.map((item) => item.messageId)), [items]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listBookmarks();
      setItems(result.bookmarks);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (organizationId) {
      void load();
    } else {
      setItems([]);
    }
  }, [organizationId, load]);

  // A saved message that gets deleted disappears from the saved list.
  useEffect(() => {
    if (!socket) {
      return;
    }
    const onDeleted = (payload: { message?: { id?: string } }) => {
      const id = payload?.message?.id;
      if (id) {
        setItems((current) => current.filter((item) => item.messageId !== id));
      }
    };
    socket.on('message.deleted', onDeleted);
    return () => {
      socket.off('message.deleted', onDeleted);
    };
  }, [socket]);

  const save = useCallback(async (messageId: string) => {
    const result = await saveMessage(messageId);
    if (result.bookmark) {
      setItems((current) =>
        current.some((item) => item.id === result.bookmark?.id)
          ? current
          : [result.bookmark as SavedMessage, ...current],
      );
    }
  }, []);

  const unsave = useCallback(async (messageId: string) => {
    await unsaveMessage(messageId);
    setItems((current) => current.filter((item) => item.messageId !== messageId));
  }, []);

  const toggleSave = useCallback(
    async (messageId: string) => {
      if (savedIds.has(messageId)) {
        await unsave(messageId);
      } else {
        await save(messageId);
      }
    },
    [savedIds, save, unsave],
  );

  const value = useMemo<SavedValue>(
    () => ({ items, savedIds, loading, save, unsave, toggleSave, reload: load }),
    [items, savedIds, loading, save, unsave, toggleSave, load],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
};
