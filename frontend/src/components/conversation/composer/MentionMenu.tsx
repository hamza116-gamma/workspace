'use client';

import { Avatar } from '@/components/ui/Avatar';
import type { User } from '@/types/user';
import styles from '../MessageComposer.module.css';

export type MentionOption = {
  key: string;
  label: string;
  sublabel?: string;
  /** Stored token: <@id> | <!channel> | <!here>. */
  token: string;
  user?: User;
};

const MAX_OPTIONS = 8;

/** Members (+ @channel / @here in channels) matching the typed "@query". */
export const mentionOptions = (
  query: string,
  mentionables: User[],
  allowChannelMention: boolean,
): MentionOption[] => {
  const needle = query.toLowerCase();
  const list: MentionOption[] = mentionables
    .filter(
      (user) =>
        !needle ||
        user.fullName.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle),
    )
    .map((user) => ({
      key: user.id,
      label: user.fullName,
      sublabel: user.email,
      token: `<@${user.id}>`,
      user,
    }));
  if (allowChannelMention) {
    if ('channel'.includes(needle)) {
      list.push({
        key: 'channel',
        label: 'channel',
        sublabel: 'Notify everyone in this channel',
        token: '<!channel>',
      });
    }
    if ('here'.includes(needle)) {
      list.push({
        key: 'here',
        label: 'here',
        sublabel: 'Notify active members',
        token: '<!here>',
      });
    }
  }
  return list.slice(0, MAX_OPTIONS);
};

export const MentionMenu = ({
  options,
  highlight,
  onHighlight,
  onPick,
}: {
  options: MentionOption[];
  highlight: number;
  onHighlight: (index: number) => void;
  onPick: (option: MentionOption) => void;
}) => (
  <div className={styles.mentionMenu} role="listbox">
    <p className={styles.mentionHeading}>Members</p>
    {options.map((option, index) => (
      <button
        key={option.key}
        type="button"
        role="option"
        aria-selected={index === highlight}
        className={`${styles.mentionItem} ${index === highlight ? styles.mentionActive : ''}`}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => onHighlight(index)}
        onClick={() => onPick(option)}
      >
        {option.user ? (
          <Avatar name={option.user.fullName} src={option.user.avatarUrl} size={26} />
        ) : (
          <span className={styles.mentionGlyph}>@</span>
        )}
        <span className={styles.mentionLabel}>{option.label}</span>
        {option.sublabel && <span className={styles.mentionSub}>{option.sublabel}</span>}
      </button>
    ))}
  </div>
);
