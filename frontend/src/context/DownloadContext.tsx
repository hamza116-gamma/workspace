'use client';

import { createContext, useCallback, useMemo, useState } from 'react';
import { fetchFileBlob, saveBlob } from '@/lib/download';

type DownloadStatus = 'downloading' | 'done' | 'error';

type DownloadTask = {
  id: string;
  name: string;
  progress: number;
  status: DownloadStatus;
  error?: string;
};

type DownloadValue = {
  tasks: DownloadTask[];
  download: (input: { url: string; name: string }) => Promise<void>;
  dismiss: (id: string) => void;
};

export const DownloadContext = createContext<DownloadValue | null>(null);

export const DownloadProvider = ({ children }: { children: React.ReactNode }) => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  const update = useCallback((id: string, patch: Partial<DownloadTask>) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }, []);

  const dismiss = useCallback((id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const download = useCallback(
    async ({ url, name }: { url: string; name: string }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setTasks((current) => [...current, { id, name, progress: 0, status: 'downloading' }]);

      try {
        const blob = await fetchFileBlob(url, (fraction) =>
          setTasks((current) =>
            current.map((task) => (task.id === id ? { ...task, progress: fraction } : task)),
          ),
        );
        saveBlob(blob, name);
        setTasks((current) =>
          current.map((task) =>
            task.id === id ? { ...task, progress: 1, status: 'done' } : task,
          ),
        );
        window.setTimeout(() => dismiss(id), 2500);
      } catch (error) {
        setTasks((current) =>
          current.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Download failed',
                }
              : task,
          ),
        );
      }
    },
    [dismiss],
  );

  const value = useMemo<DownloadValue>(() => ({ tasks, download, dismiss }), [tasks, download, dismiss]);

  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>;
};
