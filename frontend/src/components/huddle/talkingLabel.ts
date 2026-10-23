import type { HuddleUser } from '@/types/huddle';

// "Ana is talking" / "Ana and Ben are talking" / "Ana, Ben and 2 others are talking".
export const talkingLabel = (users: HuddleUser[]) => {
  const names = users.map((user) => user.fullName.split(' ')[0]);
  if (names.length === 0) return 'Nobody is in the huddle';
  if (names.length === 1) return `${names[0]} is talking`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are talking`;
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} and ${rest} ${rest === 1 ? 'other' : 'others'} are talking`;
};
