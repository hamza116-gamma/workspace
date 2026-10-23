'use client';

import { useCallback, useEffect, useState } from 'react';
import { listChannels } from '@/lib/channels';
import type { Channel } from '@/types/channel';

/** GET /channels?archived=true, loaded only while `enabled`. */
export const useArchivedChannels = (enabled: boolean) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listChannels({ archived: true });
      setChannels(result.channels);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load archived channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void load();
    }
  }, [enabled, load]);

  return { channels, loading, error, reload: load };
};
