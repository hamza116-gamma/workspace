'use client';

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useOrg } from '@/hooks/useOrg';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import * as api from '@/lib/huddles';
import type { Huddle, HuddleRing, HuddleTarget } from '@/types/huddle';

type HuddleEvent = { organizationId: string; huddle: Huddle };
type RingEvent = HuddleEvent & Omit<HuddleRing, 'huddle'>;
type RingStopped = { organizationId: string; huddleId: string };

export type HuddleValue = {
  huddles: Huddle[];
  joinedId: string | null;
  activeHuddle: Huddle | null;
  rings: HuddleRing[];
  notice: string | null;
  error: string | null;
  busy: boolean;
  minimized: boolean;
  huddleForTarget: (target: HuddleTarget | null) => Huddle | null;
  isJoined: (huddleId: string | null | undefined) => boolean;
  start: (target: HuddleTarget) => Promise<void>;
  join: (huddleId: string) => Promise<void>;
  leave: () => Promise<void>;
  end: () => Promise<void>;
  decline: (huddleId: string) => Promise<void>;
  invite: (userIds: string[]) => Promise<void>;
  setMinimized: (value: boolean) => void;
  clearNotice: () => void;
  clearError: () => void;
};

export const HuddleContext = createContext<HuddleValue | null>(null);

const messageOf = (error: unknown) =>
  error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong';

const otherNames = (huddle: Huddle, myId: string | undefined, status: string) =>
  huddle.invites
    .filter((invite) => invite.status === status && invite.user.id !== myId)
    .map((invite) => invite.user.fullName.split(' ')[0])
    .join(', ');

export const HuddleProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket, connected } = useSocket();
  const { active } = useOrg();
  const { user } = useAuth();
  const orgId = active?.id ?? null;
  const myId = user?.id;

  const [byId, setById] = useState<Record<string, Huddle>>({});
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const [rings, setRings] = useState<HuddleRing[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const joinedRef = useRef<string | null>(null);
  joinedRef.current = joinedId;

  const upsert = useCallback((huddle: Huddle) => {
    setById((prev) => {
      const next = { ...prev };
      if (huddle.status === 'LIVE') next[huddle.id] = huddle;
      else delete next[huddle.id];
      return next;
    });
  }, []);

  const dropRing = useCallback((huddleId: string) => {
    setRings((prev) => prev.filter((ring) => ring.huddle.id !== huddleId));
  }, []);

  // Initial list + resync after every (re)connect / workspace switch.
  useEffect(() => {
    if (!orgId || !connected) {
      return;
    }
    let cancelled = false;
    api
      .listActiveHuddles()
      .then(({ huddles }) => {
        if (cancelled) return;
        setById(Object.fromEntries(huddles.map((huddle) => [huddle.id, huddle])));
        // Still ringing for me (e.g. after a reload)?
        setRings((prev) =>
          prev.filter((ring) => huddles.some((huddle) => huddle.id === ring.huddle.id)),
        );
      })
      .catch(() => undefined);
    // A dropped connection removed us server-side: rejoin the call.
    const current = joinedRef.current;
    if (current) {
      api.joinHuddle(current).then(
        ({ huddle }) => !cancelled && upsert(huddle),
        () => !cancelled && setJoinedId(null),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [orgId, connected, upsert]);

  // Leaving the workspace leaves the huddle UI too.
  useEffect(() => {
    setById({});
    setRings([]);
    setJoinedId(null);
  }, [orgId]);

  useEffect(() => {
    if (!socket || !orgId) {
      return;
    }
    const mine = (event: { organizationId: string }) => event.organizationId === orgId;
    const onLive = (event: HuddleEvent) => mine(event) && upsert(event.huddle);
    const onEnded = (event: HuddleEvent) => {
      if (!mine(event)) return;
      upsert(event.huddle);
      dropRing(event.huddle.id);
      if (joinedRef.current === event.huddle.id) {
        setJoinedId(null);
        setMinimized(false);
        if (event.huddle.outcome === 'DECLINED') {
          setNotice(`${otherNames(event.huddle, myId, 'DECLINED') || 'They'} declined`);
        } else if (event.huddle.outcome === 'MISSED') {
          setNotice('No answer');
        }
      }
    };
    const onRing = (event: RingEvent) => {
      if (!mine(event)) return;
      upsert(event.huddle);
      setRings((prev) => [
        ...prev.filter((ring) => ring.huddle.id !== event.huddle.id),
        { huddle: event.huddle, caller: event.caller, silent: event.silent },
      ]);
    };
    const onRingStopped = (event: RingStopped) => mine(event) && dropRing(event.huddleId);

    socket.on('huddle.started', onLive);
    socket.on('huddle.updated', onLive);
    socket.on('huddle.ended', onEnded);
    socket.on('huddle.ring', onRing);
    socket.on('huddle.ring.stopped', onRingStopped);
    return () => {
      socket.off('huddle.started', onLive);
      socket.off('huddle.updated', onLive);
      socket.off('huddle.ended', onEnded);
      socket.off('huddle.ring', onRing);
      socket.off('huddle.ring.stopped', onRingStopped);
    };
  }, [socket, orgId, myId, upsert, dropRing]);

  // Someone else removed us (e.g. reconnect race): drop the joined state.
  useEffect(() => {
    if (!joinedId || !myId) return;
    const huddle = byId[joinedId];
    if (huddle && !huddle.participants.some((p) => p.user.id === myId)) {
      setJoinedId(null);
    }
  }, [byId, joinedId, myId]);

  const run = useCallback(async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }, []);

  // One huddle at a time: joining another one leaves the current one.
  const leaveCurrent = useCallback(
    async (nextId?: string) => {
      const current = joinedRef.current;
      if (!current || current === nextId) return;
      setJoinedId(null);
      await api.leaveHuddle(current).then(
        ({ huddle }) => upsert(huddle),
        () => undefined,
      );
    },
    [upsert],
  );

  const enter = useCallback(
    (huddle: Huddle) => {
      upsert(huddle);
      dropRing(huddle.id);
      setNotice(null);
      setMinimized(false);
      setJoinedId(huddle.id);
    },
    [upsert, dropRing],
  );

  const start = useCallback(
    (target: HuddleTarget) =>
      run(async () => {
        await leaveCurrent();
        const { huddle } = await api.startHuddle(target);
        enter(huddle);
      }),
    [run, leaveCurrent, enter],
  );

  const join = useCallback(
    (huddleId: string) =>
      run(async () => {
        await leaveCurrent(huddleId);
        const { huddle } = await api.joinHuddle(huddleId);
        enter(huddle);
      }),
    [run, leaveCurrent, enter],
  );

  const leave = useCallback(() => run(() => leaveCurrent()), [run, leaveCurrent]);

  const end = useCallback(
    () =>
      run(async () => {
        const current = joinedRef.current;
        if (!current) return;
        const { huddle } = await api.endHuddle(current);
        setJoinedId(null);
        upsert(huddle);
      }),
    [run, upsert],
  );

  const decline = useCallback(
    (huddleId: string) =>
      run(async () => {
        dropRing(huddleId);
        const { huddle } = await api.declineHuddle(huddleId);
        upsert(huddle);
      }),
    [run, dropRing, upsert],
  );

  const invite = useCallback(
    (userIds: string[]) =>
      run(async () => {
        const current = joinedRef.current;
        if (!current) return;
        const { huddle } = await api.inviteToHuddle(current, userIds);
        upsert(huddle);
      }),
    [run, upsert],
  );

  const huddles = useMemo(() => Object.values(byId), [byId]);

  const huddleForTarget = useCallback(
    (target: HuddleTarget | null) => {
      if (!target) return null;
      const key = api.huddleTargetKey(target);
      return huddles.find((huddle) => api.huddleKeyFor(huddle) === key) ?? null;
    },
    [huddles],
  );

  const isJoined = useCallback(
    (huddleId: string | null | undefined) => Boolean(huddleId && huddleId === joinedId),
    [joinedId],
  );

  const value = useMemo<HuddleValue>(
    () => ({
      huddles,
      joinedId,
      activeHuddle: joinedId ? (byId[joinedId] ?? null) : null,
      rings,
      notice,
      error,
      busy,
      minimized,
      huddleForTarget,
      isJoined,
      start,
      join,
      leave,
      end,
      decline,
      invite,
      setMinimized,
      clearNotice: () => setNotice(null),
      clearError: () => setError(null),
    }),
    [
      huddles,
      joinedId,
      byId,
      rings,
      notice,
      error,
      busy,
      minimized,
      huddleForTarget,
      isJoined,
      start,
      join,
      leave,
      end,
      decline,
      invite,
    ],
  );

  return <HuddleContext.Provider value={value}>{children}</HuddleContext.Provider>;
};
