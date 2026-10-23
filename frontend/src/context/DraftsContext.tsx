'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useSocket } from '@/hooks/useSocket';
import { deleteDraft, draftKey, listDrafts, putDraft } from '@/lib/drafts';
import type { Draft, DraftTarget } from '@/types/draft';

type DraftsValue = {
  drafts: Draft[];
  /** Drafts of chats the user is NOT looking at (Slack counts only these). */
  pendingDrafts: Draft[];
  hasPendingDraft: (key: string) => boolean;
  /** A mounted composer marks its chat as open; returns the cleanup. */
  markOpen: (key: string) => () => void;
  loaded: boolean;
  getDraft: (key: string) => Draft | undefined;
  saveDraft: (target: DraftTarget, content: string) => Promise<void>;
  removeDraft: (id: string) => Promise<void>;
  /** Drops a draft locally (its message was just sent; the server deleted it). */
  forgetDraft: (key: string) => void;
};

export const DraftsContext = createContext<DraftsValue | null>(null);

const upsert = (list: Draft[], key: string, draft: Draft | null) => {
  const rest = list.filter((item) => item.key !== key);
  return draft ? [draft, ...rest] : rest;
};

// Unsent composer texts of this workspace (Slack "Drafts"), kept in sync
// across tabs by `draft.updated`.
export const DraftsProvider = ({ children }: { children: React.ReactNode }) => {
  const { active } = useOrg();
  const { socket } = useSocket();
  const organizationId = active?.id;
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openKeys, setOpenKeys] = useState<Record<string, number>>({});

  useEffect(() => {
    setDrafts([]);
    setLoaded(false);
    if (!organizationId) {
      return;
    }
    let cancelled = false;
    listDrafts()
      .then((result) => {
        if (!cancelled) {
          setDrafts(result.drafts);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!socket || !organizationId) {
      return;
    }
    const onUpdated = (payload: { organizationId?: string; key?: string; draft?: Draft | null }) => {
      if (!payload?.key || (payload.organizationId && payload.organizationId !== organizationId)) {
        return;
      }
      setDrafts((current) => upsert(current, payload.key as string, payload.draft ?? null));
    };
    socket.on('draft.updated', onUpdated);
    return () => {
      socket.off('draft.updated', onUpdated);
    };
  }, [socket, organizationId]);

  const getDraft = useCallback(
    (key: string) => drafts.find((draft) => draft.key === key),
    [drafts],
  );

  const saveDraft = useCallback(async (target: DraftTarget, content: string) => {
    const key = draftKey(target);
    const result = await putDraft(target, content);
    setDrafts((current) => upsert(current, key, result.draft));
  }, []);

  const removeDraft = useCallback(async (id: string) => {
    const result = await deleteDraft(id);
    setDrafts((current) => upsert(current, result.key, null));
  }, []);

  const forgetDraft = useCallback((key: string) => {
    setDrafts((current) => upsert(current, key, null));
  }, []);

  const markOpen = useCallback((key: string) => {
    setOpenKeys((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }));
    return () =>
      setOpenKeys((current) => {
        const next = { ...current };
        if ((next[key] ?? 0) <= 1) {
          delete next[key];
        } else {
          next[key] -= 1;
        }
        return next;
      });
  }, []);

  const pendingDrafts = useMemo(
    () => drafts.filter((draft) => !openKeys[draft.key] && draft.content.trim() !== ''),
    [drafts, openKeys],
  );

  const hasPendingDraft = useCallback(
    (key: string) => pendingDrafts.some((draft) => draft.key === key),
    [pendingDrafts],
  );

  const value = useMemo<DraftsValue>(
    () => ({
      drafts,
      pendingDrafts,
      hasPendingDraft,
      markOpen,
      loaded,
      getDraft,
      saveDraft,
      removeDraft,
      forgetDraft,
    }),
    [drafts, pendingDrafts, hasPendingDraft, markOpen, loaded, getDraft, saveDraft, removeDraft, forgetDraft],
  );

  return <DraftsContext.Provider value={value}>{children}</DraftsContext.Provider>;
};
