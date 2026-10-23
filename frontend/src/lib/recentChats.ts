/** Recently opened chats (for the quick switcher), per workspace, in localStorage. */
const KEY = 'quickSwitcher.recent';
const MAX = 8;

type RecentMap = Record<string, string[]>;

const read = (): RecentMap => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as RecentMap) : {};
  } catch {
    return {};
  }
};

export const loadRecentChats = (organizationId: string): string[] => {
  const list = read()[organizationId];
  return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : [];
};

/** `key` is "channel:<id>" or "dm:<id>". */
export const rememberRecentChat = (organizationId: string, key: string) => {
  const all = read();
  all[organizationId] = [
    key,
    ...loadRecentChats(organizationId).filter((item) => item !== key),
  ].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage unavailable: no recents
  }
};
