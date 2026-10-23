'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadAttachment } from '@/lib/attachments';
import type { PendingAttachment } from '@/types/message';

export type UploadTask = {
  id: string;
  name: string;
  size: number;
  progress: number;
  error?: string;
};

/**
 * Composer attachments: uploads with progress / cancel, and the uploaded
 * (pending) attachments that go with the next message.
 */
export const useComposerUploads = () => {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  // Uploads files with progress; resolves with the ones that succeeded.
  const runUploads = useCallback(async (list: File[]): Promise<PendingAttachment[]> => {
    if (list.length === 0) return [];
    const tasks = list.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      progress: 0,
    }));
    setUploads((current) => [...current, ...tasks]);
    const controllers = tasks.map(() => new AbortController());
    tasks.forEach((task, index) => controllersRef.current.set(task.id, controllers[index]));

    const results = await Promise.allSettled(
      list.map((file, index) =>
        uploadAttachment(
          file,
          (fraction) =>
            setUploads((current) =>
              current.map((task) =>
                task.id === tasks[index].id ? { ...task, progress: fraction } : task,
              ),
            ),
          controllers[index].signal,
        ),
      ),
    );

    const completed: PendingAttachment[] = [];
    results.forEach((result, index) => {
      const id = tasks[index].id;
      controllersRef.current.delete(id);
      if (result.status === 'fulfilled') {
        completed.push(result.value);
        setUploads((current) => current.filter((task) => task.id !== id));
      } else {
        const message = result.reason instanceof Error ? result.reason.message : 'Upload failed';
        setUploads((current) =>
          current.map((task) => (task.id === id ? { ...task, error: message } : task)),
        );
      }
    });
    return completed;
  }, []);

  /** Uploads and adds the results to the pending attachments. */
  const addFiles = useCallback(
    async (files: FileList | File[] | null) => {
      const completed = await runUploads(Array.from(files ?? []));
      if (completed.length > 0) setPending((current) => [...current, ...completed]);
    },
    [runUploads],
  );

  const cancelUpload = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    controllersRef.current.delete(id);
    setUploads((current) => current.filter((task) => task.id !== id));
  }, []);

  const dismissUpload = useCallback((id: string) => {
    setUploads((current) => current.filter((task) => task.id !== id));
  }, []);

  const removePending = useCallback((index: number) => {
    setPending((current) => current.filter((_, position) => position !== index));
  }, []);

  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
    },
    [],
  );

  return {
    pending,
    setPending,
    uploads,
    uploading: uploads.some((task) => !task.error),
    runUploads,
    addFiles,
    cancelUpload,
    dismissUpload,
    removePending,
  };
};
