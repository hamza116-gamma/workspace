'use client';

import { useEffect, useState } from 'react';

// Seconds since `since`, ticking once a second (null -> 0).
export const useElapsed = (since: string | null | undefined) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);
  return since ? Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000)) : 0;
};
