'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSearch } from '@/hooks/useSearch';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Icon } from '@/components/ui/Icon';
import type { SearchType } from '@/types/search';
import { SearchResults } from './SearchResults';
import styles from './SearchView.module.css';

const TABS: { type: SearchType; label: string }[] = [
  { type: 'all', label: 'All' },
  { type: 'messages', label: 'Messages' },
  { type: 'channels', label: 'Channels' },
  { type: 'people', label: 'People' },
  { type: 'files', label: 'Files' },
];

const OPERATORS = ['from:me', 'in:#general', 'in:@name', 'has:link', 'has:file', 'has:pin', 'before:2026-01-31', 'on:2026-01-15', '"exact phrase"'];

const isType = (value: string | null): value is SearchType =>
  TABS.some((tab) => tab.type === value);

// Slack-style workspace search (/search?q=&type=). Must render inside
// <Suspense> (useSearchParams).
export const SearchView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.get('q') ?? '';
  const typeParam = params.get('type');
  const type: SearchType = isType(typeParam) ? typeParam : 'all';
  const [draft, setDraft] = useState(query);
  const { result, loading, loadingMore, error, loadMore } = useSearch(query, type);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  const navigate = (nextQuery: string, nextType: SearchType) => {
    const search = new URLSearchParams();
    if (nextQuery.trim()) {
      search.set('q', nextQuery.trim());
    }
    if (nextType !== 'all') {
      search.set('type', nextType);
    }
    const suffix = search.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Workspace</span>
        <h1 className={styles.title}>Search</h1>
        <p className={styles.subtitle}>
          Messages, channels, people and files you have access to. Private channels and
          conversations you are not part of are never searched.
        </p>
      </header>

      <form
        className={styles.searchBox}
        onSubmit={(event) => {
          event.preventDefault();
          navigate(draft, type);
        }}
      >
        <Icon name="search" size={16} />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search the workspace…"
          aria-label="Search the workspace"
          autoFocus
        />
        <button type="submit" className={styles.submit}>
          Search
        </button>
      </form>

      <div className={styles.hint}>
        <span>Narrow it down:</span>
        {OPERATORS.map((operator) => (
          <button
            key={operator}
            type="button"
            className={styles.operator}
            onClick={() => setDraft((current) => `${current.trim()} ${operator}`.trim())}
          >
            {operator}
          </button>
        ))}
      </div>

      <nav className={styles.tabs} aria-label="Result types">
        {TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            className={`${styles.tab} ${tab.type === type ? styles.tabActive : ''}`}
            aria-pressed={tab.type === type}
            onClick={() => navigate(query, tab.type)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error && <Alert>{error}</Alert>}

      {loading && (
        <div className={styles.center}>
          <Spinner />
        </div>
      )}

      {!loading && !query.trim() && (
        <div className={styles.emptyCard}>
          <span className={styles.emptyIcon} aria-hidden>
            <Icon name="search" size={20} />
          </span>
          <p className={styles.emptyTitle}>Search your workspace</p>
          <p className={styles.empty}>Type a few words, or combine them with the filters above.</p>
        </div>
      )}

      {!loading && result && (
        <SearchResults
          result={result}
          type={type}
          onShowAll={(nextType) => navigate(query, nextType)}
        />
      )}

      {!loading && result && type !== 'all' && result[type].hasMore && (
        <div className={styles.center}>
          <button
            type="button"
            className={styles.more}
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};
