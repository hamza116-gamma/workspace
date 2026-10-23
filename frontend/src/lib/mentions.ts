import type { User } from '@/types/user';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The composer shows readable "@Full Name" text; convert those to the
// stored Slack-style tokens (<@id>) right before sending. Longest names
// first so "@Ann Marie" wins over "@Ann".
export const displayToTokens = (text: string, users: User[]): string => {
  let result = text;
  const sorted = [...users].sort((a, b) => b.fullName.length - a.fullName.length);

  for (const user of sorted) {
    const pattern = new RegExp(`@${escapeRegExp(user.fullName)}(?=\\s|$)`, 'g');
    result = result.replace(pattern, `<@${user.id}>`);
  }

  return result;
};
