'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchWorkspace } from '@/lib/search';
import type { SearchList, SearchResult, SearchType } from '@/types/search';

const mergeList = <T>(current: SearchList<T>, next: SearchList<T>): SearchList<T> => ({
  items: [...current.items, ...next.items],
  hasMore: next.hasMore,
});

/** Runs workspace search for (query, type) and pages with loadMore. */
export const useSearch = (query: string, type: SearchType) => {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  useEffect(() => {
    const request = ++requestRef.current;
    if (!query.trim()) {
      setResult(null);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    searchWorkspace(query, type, 0)
      .then((data) => {
        if (request === requestRef.current) {
          setResult(data);
        }
      })
      .catch((reason: unknown) => {
        if (request === requestRef.current) {
          setResult(null);
          setError(reason instanceof Error ? reason.message : 'Search failed');
        }
      })
      .finally(() => {
        if (request === requestRef.current) {
          setLoading(false);
        }
      });
  }, [query, type]);

  // "Load more" appends the next page of the active (single-type) tab.
  const loadMore = useCallback(async () => {
    if (!result || type === 'all' || loadingMore) {
      return;
    }
    const request = requestRef.current;
    setLoadingMore(true);
    try {
      const next = await searchWorkspace(query, type, result.page + 1);
      if (request !== requestRef.current) {
        return;
      }
      setResult((current) => {
        if (!current) {
          return next;
        }
        return {
          ...next,
          messages: mergeList(current.messages, next.messages),
          channels: mergeList(current.channels, next.channels),
          people: mergeList(current.people, next.people),
          files: mergeList(current.files, next.files),
        };
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Search failed');
    } finally {
      setLoadingMore(false);
    }
  }, [query, type, result, loadingMore]);

  return { result, loading, loadingMore, error, loadMore };
};
