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

// The reverse: stored tokens back to readable text ("<@id>" -> "@Full Name",
// "<!channel>" -> "@channel", "<!here>" -> "@here"). Unknown ids become "@someone".
export const tokensToDisplay = (
  text: string,
  mentions: { id: string; fullName?: string }[] = [],
): string => {
  const names = new Map(mentions.map((user) => [user.id, user.fullName]));
  return text
    .replace(/<@([a-f0-9]{24})>/gi, (_match, id: string) => `@${names.get(id) || 'someone'}`)
    .replace(/<!channel>/g, '@channel')
    .replace(/<!here>/g, '@here');
};
