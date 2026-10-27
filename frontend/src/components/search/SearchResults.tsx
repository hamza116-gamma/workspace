'use client';

import type { SearchResult, SearchType } from '@/types/search';
import { Icon, type IconName } from '@/components/ui/Icon';
import {
  ChannelResult,
  FileResult,
  MessageResult,
  PersonResult,
  TaskResult,
} from './SearchResultItems';
import styles from './SearchView.module.css';

const Section = ({
  title,
  icon,
  count,
  more,
  onShowAll,
  children,
}: {
  title: string;
  icon: IconName;
  count: number;
  more: boolean;
  onShowAll?: () => void;
  children: React.ReactNode;
}) => (
  <section className={styles.section}>
    <div className={styles.sectionHead}>
      <span className={styles.sectionTitle}>
        <Icon name={icon} size={14} />
        {title}
      </span>
      <span className={styles.pill}>
        {count}
        {more ? '+' : ''}
      </span>
      {onShowAll && more && (
        <button type="button" className={styles.showAll} onClick={onShowAll}>
          See all
        </button>
      )}
    </div>
    <ul className={styles.list}>{children}</ul>
  </section>
);

export const SearchResults = ({
  result,
  type,
  onShowAll,
}: {
  result: SearchResult;
  type: SearchType;
  onShowAll: (type: SearchType) => void;
}) => {
  const all = type === 'all';
  const show = (key: SearchType) =>
    (all || type === key) && (result[key as Exclude<SearchType, 'all'>]?.items.length ?? 0) > 0;
  const nothing =
    result.messages.items.length +
      result.channels.items.length +
      result.people.items.length +
      result.files.items.length +
      (result.tasks?.items.length ?? 0) ===
    0;

  if (nothing) {
    return (
      <div className={styles.emptyCard}>
        <span className={styles.emptyIcon} aria-hidden>
          <Icon name="search" size={20} />
        </span>
        <p className={styles.emptyTitle}>No results for “{result.query}”</p>
        <p className={styles.empty}>Try fewer words or different filters.</p>
      </div>
    );
  }

  return (
    <div className={styles.results}>
      {show('channels') && (
        <Section
          title="Channels"
          icon="hash"
          count={result.channels.items.length}
          more={result.channels.hasMore}
          onShowAll={all ? () => onShowAll('channels') : undefined}
        >
          {result.channels.items.map((channel) => (
            <ChannelResult key={channel.id} channel={channel} />
          ))}
        </Section>
      )}
      {show('people') && (
        <Section
          title="People"
          icon="users"
          count={result.people.items.length}
          more={result.people.hasMore}
          onShowAll={all ? () => onShowAll('people') : undefined}
        >
          {result.people.items.map((person) => (
            <PersonResult key={person.id} person={person} />
          ))}
        </Section>
      )}
      {show('tasks') && (
        <Section
          title="Tasks"
          icon="task"
          count={result.tasks.items.length}
          more={result.tasks.hasMore}
          onShowAll={all ? () => onShowAll('tasks') : undefined}
        >
          {result.tasks.items.map((task) => (
            <TaskResult key={task.id} task={task} />
          ))}
        </Section>
      )}
      {show('messages') && (
        <Section
          title="Messages"
          icon="message"
          count={result.messages.items.length}
          more={result.messages.hasMore}
          onShowAll={all ? () => onShowAll('messages') : undefined}
        >
          {result.messages.items.map((message) => (
            <MessageResult key={message.id} message={message} />
          ))}
        </Section>
      )}
      {show('files') && (
        <Section
          title="Files"
          icon="file"
          count={result.files.items.length}
          more={result.files.hasMore}
          onShowAll={all ? () => onShowAll('files') : undefined}
        >
          {result.files.items.map((file) => (
            <FileResult key={file.id} file={file} />
          ))}
        </Section>
      )}
    </div>
  );
};
