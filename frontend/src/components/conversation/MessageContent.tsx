'use client';

import { useAuth } from '@/hooks/useAuth';
import { renderRichText } from './richText';
import styles from './MessageContent.module.css';

const USER_TOKEN_RE = /^<@([0-9a-fA-F]{24})>$/;

export const MessageContent = ({
  content,
  mentions,
  senderId,
}: {
  content: string;
  mentions: { id: string; fullName: string }[];
  senderId?: string;
}) => {
  const { user } = useAuth();
  const nameById = new Map(mentions.map((mention) => [mention.id, mention.fullName]));
  const isMine = Boolean(senderId && senderId === user?.id);

  const renderToken = (token: string, key: string) => {
    const userMatch = USER_TOKEN_RE.exec(token);
    if (userMatch) {
      const id = userMatch[1].toLowerCase();
      const isSelf = user?.id === id;
      return (
        <span
          key={key}
          className={`${styles.mention} ${isSelf ? styles.self : isMine ? styles.mine : ''}`}
        >
          @{nameById.get(id) ?? 'member'}
        </span>
      );
    }
    const label = token.includes('channel') ? '@channel' : '@here';
    return (
      <span key={key} className={`${styles.mention} ${isMine ? styles.mine : ''}`}>
        {label}
      </span>
    );
  };

  return <>{renderRichText(content, renderToken)}</>;
};
