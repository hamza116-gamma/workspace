'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrg } from './useOrg';
import { isAccessLost } from '@/lib/chatCache';

type Options<T> = {
  /** Network fetch (also stores the result in the chat cache). */
  fetch: (id: string) => Promise<T>;
  /** Instant seed: chat cache, then the sidebar list. */
  seed: (id: string) => T | undefined;
  /** Forget the chat everywhere (403 / 404). */
  forget: (id: string) => void;
  fallbackError: string;
};

// Header details of the open chat, stale-while-revalidate: a cached / sidebar
// copy shows at once, the server copy replaces it in the background. A 403 /
// 404 drops the cache entry and shows the normal error. Responses for a chat
// the user already left are ignored.
export const useChatDetails = <T>({ fetch, seed, forget, fallbackError }: Options<T>) => {
  const { active } = useOrg();
  const idRef = useRef<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Kept in refs so callers may pass inline functions.
  const options = useRef({ fetch, seed, forget, fallbackError });
  useEffect(() => {
    options.current = { fetch, seed, forget, fallbackError };
  });

  const refresh = useCallback(async (id: string, hasCopy: boolean) => {
    if (!hasCopy) setLoading(true);
    try {
      const result = await options.current.fetch(id);
      if (idRef.current !== id) return;
      setItem(result);
      setError('');
    } catch (err) {
      if (idRef.current !== id) return;
      const lost = isAccessLost(err);
      if (lost) options.current.forget(id);
      // Network hiccups keep a shown copy; lost access never does.
      if (lost || !hasCopy) {
        setItem(null);
        setError(err instanceof Error ? err.message : options.current.fallbackError);
      }
    } finally {
      if (idRef.current === id) setLoading(false);
    }
  }, []);

  const load = useCallback(
    (id: string) => {
      idRef.current = id;
      setTargetId(id);
      setError('');
      const copy = options.current.seed(id);
      setItem(copy ?? null);
      setLoading(!copy);
      void refresh(id, Boolean(copy));
    },
    [refresh],
  );

  const reload = useCallback(() => {
    const id = idRef.current;
    return id ? refresh(id, true) : Promise.resolve();
  }, [refresh]);

  const clear = useCallback(() => {
    idRef.current = null;
    setTargetId(null);
    setItem(null);
    setError('');
  }, []);

  const organizationId = active?.id;
  useEffect(() => {
    const id = idRef.current;
    if (!id) return;
    if (organizationId) {
      void refresh(id, false);
    } else {
      setItem(null);
    }
  }, [organizationId, refresh]);

  return { item, targetId, loading, error, load, reload, clear };
};
