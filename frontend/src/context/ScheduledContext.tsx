'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useSocket } from '@/hooks/useSocket';
import {
  cancelScheduled,
  createScheduled,
  listScheduled,
  sendScheduledNow,
  updateScheduled,
} from '@/lib/scheduled';
import type { ScheduledMessage, ScheduleTarget } from '@/types/scheduled';

type ScheduledValue = {
  /** The user's pending scheduled messages in this workspace (soonest first). */
  items: ScheduledMessage[];
  loaded: boolean;
  schedule: (target: ScheduleTarget, content: string, at: Date) => Promise<ScheduledMessage>;
  reschedule: (id: string, body: { content?: string; scheduledAt?: string }) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  sendNow: (id: string) => Promise<void>;
};

export const ScheduledContext = createContext<ScheduledValue | null>(null);

const upsert = (list: ScheduledMessage[], id: string, item: ScheduledMessage | null) => {
  const rest = list.filter((entry) => entry.id !== id);
  const next = item && item.status === 'pending' ? [...rest, item] : rest;
  return next.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
};

// Scheduled messages: loaded once per workspace, kept live by
// `scheduled.updated` (other tabs, the scheduler sending them).
export const ScheduledProvider = ({ children }: { children: React.ReactNode }) => {
  const { active } = useOrg();
  const { socket } = useSocket();
  const organizationId = active?.id;
  const [items, setItems] = useState<ScheduledMessage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems([]);
    setLoaded(false);
    if (!organizationId) {
      return;
    }
    let cancelled = false;
    listScheduled()
      .then((result) => {
        if (!cancelled) setItems(result.scheduled);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!socket || !organizationId) {
      return;
    }
    const onUpdated = (payload: {
      organizationId?: string;
      id?: string;
      scheduled?: ScheduledMessage | null;
    }) => {
      if (!payload?.id || (payload.organizationId && payload.organizationId !== organizationId)) {
        return;
      }
      setItems((current) => upsert(current, payload.id as string, payload.scheduled ?? null));
    };
    socket.on('scheduled.updated', onUpdated);
    return () => {
      socket.off('scheduled.updated', onUpdated);
    };
  }, [socket, organizationId]);

  const schedule = useCallback(async (target: ScheduleTarget, content: string, at: Date) => {
    const result = await createScheduled(target, content, at);
    setItems((current) => upsert(current, result.scheduled.id, result.scheduled));
    return result.scheduled;
  }, []);

  const reschedule = useCallback(
    async (id: string, body: { content?: string; scheduledAt?: string }) => {
      const result = await updateScheduled(id, body);
      setItems((current) => upsert(current, id, result.scheduled));
    },
    [],
  );

  const cancel = useCallback(async (id: string) => {
    await cancelScheduled(id);
    setItems((current) => upsert(current, id, null));
  }, []);

  const sendNow = useCallback(async (id: string) => {
    await sendScheduledNow(id);
    setItems((current) => upsert(current, id, null));
  }, []);

  const value = useMemo<ScheduledValue>(
    () => ({ items, loaded, schedule, reschedule, cancel, sendNow }),
    [items, loaded, schedule, reschedule, cancel, sendNow],
  );

  return <ScheduledContext.Provider value={value}>{children}</ScheduledContext.Provider>;
};
