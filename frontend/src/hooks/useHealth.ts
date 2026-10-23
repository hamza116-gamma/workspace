import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type HealthStatus = {
  status: string;
  services: { database: string };
};

export const useHealth = () => {
  const [status, setStatus] = useState<'loading' | 'ok' | 'down'>('loading');

  const check = useCallback(async () => {
    try {
      const result = await apiRequest<HealthStatus>('/health');
      setStatus(result.status === 'ok' ? 'ok' : 'down');
    } catch {
      setStatus('down');
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { status, check };
};
