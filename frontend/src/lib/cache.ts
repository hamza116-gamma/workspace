// In-memory stale-while-revalidate store for the current workspace.
// Everything is dropped on workspace switch (setCacheScope) and on login /
// register / logout (clearCache), so another workspace's or account's data
// is never shown. Responses that started before a clear are not stored.

type Entry = { value: unknown; at: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
let generation = 0;
let scope: string | null = null;

export const clearCache = () => {
  generation += 1;
  store.clear();
  inflight.clear();
};

/** Clears everything when the workspace (or account) changes. */
export const setCacheScope = (next: string | null) => {
  if (next !== scope) {
    scope = next;
    clearCache();
  }
};

export const cacheGeneration = () => generation;

export const peek = <T>(key: string): T | undefined => store.get(key)?.value as T | undefined;

export const cachedAt = (key: string): number | undefined => store.get(key)?.at;

export const put = <T>(key: string, value: T) => {
  store.set(key, { value, at: Date.now() });
};

export const drop = (key: string) => {
  store.delete(key);
  inflight.delete(key);
};

export const dropPrefix = (prefix: string) => {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};

/** Runs `loader` once per key at a time (in-flight dedupe) and stores the result. */
export const fetchShared = <T>(key: string, loader: () => Promise<T>): Promise<T> => {
  const running = inflight.get(key);
  if (running) {
    return running as Promise<T>;
  }
  const startedIn = generation;
  const promise = loader()
    .then((value) => {
      if (startedIn === generation) {
        put(key, value);
      }
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === promise) {
        inflight.delete(key);
      }
    });
  inflight.set(key, promise);
  return promise;
};

/** True when the generation changed since `startedIn` (a clear happened). */
export const isStaleGeneration = (startedIn: number) => startedIn !== generation;
