'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDrafts } from '@/hooks/useDrafts';
import { draftKey } from '@/lib/drafts';
import type { DraftTarget } from '@/types/draft';

const AUTOSAVE_MS = 800;

/**
 * Keeps a composer's text in the user's drafts:
 * - switching chats saves the previous text immediately and loads the new
 *   chat's draft;
 * - typing autosaves after 800 ms;
 * - markSent() tells it the text was sent (the server already deleted it).
 */
export const useComposerDraft = (
  target: DraftTarget | null,
  value: string,
  setValue: (value: string) => void,
) => {
  const { loaded, getDraft, saveDraft, forgetDraft, markOpen } = useDrafts();
  const key = target ? draftKey(target) : null;

  // While this composer is on screen its draft is not "pending" (Slack only
  // badges drafts left behind in other chats).
  useEffect(() => (key ? markOpen(key) : undefined), [key, markOpen]);

  // What the server has for the current key, and the live composer state.
  const savedRef = useRef<{ key: string | null; content: string }>({ key: null, content: '' });
  const liveRef = useRef<{ target: DraftTarget | null; value: string }>({ target, value });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getDraftRef = useRef(getDraft);
  getDraftRef.current = getDraft;
  liveRef.current = { target, value };

  const flush = useCallback(
    (draftTarget: DraftTarget | null, content: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!draftTarget) {
        return;
      }
      const draftKeyValue = draftKey(draftTarget);
      if (savedRef.current.key === draftKeyValue && savedRef.current.content === content) {
        return;
      }
      if (savedRef.current.key === draftKeyValue) {
        savedRef.current = { key: draftKeyValue, content };
      }
      saveDraft(draftTarget, content).catch(() => {});
    },
    [saveDraft],
  );

  // Chat switch (and first load of the drafts list): save the previous text,
  // then load this chat's draft.
  useEffect(() => {
    if (!key || !loaded) {
      return;
    }
    const content = getDraftRef.current(key)?.content ?? '';
    savedRef.current = { key, content };
    setValue(content);
    const draftTarget = liveRef.current.target;
    return () => {
      // Leaving this chat: save what was typed right away.
      flush(draftTarget, liveRef.current.value);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loaded]);

  // Typing autosaves after a pause.
  useEffect(() => {
    if (!key || !loaded || savedRef.current.key !== key || savedRef.current.content === value) {
      return;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const draftTarget = liveRef.current.target;
    timerRef.current = setTimeout(() => flush(draftTarget, value), AUTOSAVE_MS);
  }, [key, loaded, value, flush]);

  // Another tab changed this chat's draft while ours has no unsaved edits.
  const remote = key ? getDraft(key)?.content ?? '' : '';
  useEffect(() => {
    if (!key || !loaded || savedRef.current.key !== key) {
      return;
    }
    const clean = liveRef.current.value === savedRef.current.content;
    if (clean && remote !== savedRef.current.content) {
      savedRef.current = { key, content: remote };
      setValue(remote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote]);

  const markSent = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    savedRef.current = { key: savedRef.current.key, content: '' };
    if (savedRef.current.key) {
      forgetDraft(savedRef.current.key);
    }
  }, [forgetDraft]);

  return { markSent };
};
