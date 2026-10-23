'use client';

import { useEffect, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { getActivitySummary, type ActivitySummary } from '@/lib/notifications';

// Server-side counts for the Activity KPI row (threads, messages today).
export const useActivitySummary = () => {
  const { active } = useOrg();
  const [summary, setSummary] = useState<ActivitySummary | null>(null);

  useEffect(() => {
    if (!active?.id) {
      return;
    }
    let cancelled = false;
    getActivitySummary()
      .then((result) => !cancelled && setSummary(result.summary))
      .catch(() => !cancelled && setSummary(null));
    return () => {
      cancelled = true;
    };
  }, [active?.id]);

  return summary;
};
